#!/usr/bin/env python3
"""Reproducible Earth-to-Mars transfer analysis for MATH2850J.

The script intentionally separates three planetary-state model levels:

1. a phase-anchored circular, coplanar benchmark;
2. a secular Keplerian approximation using the JPL/Standish elements;
3. a heliocentric two-body Lambert transfer whose boundary states come from
   the NASA/JPL DE440s planetary ephemeris.

The resulting hyperbolic excess velocities are then converted into a
two-impulse patched-conic budget for departure from a 200 km circular LEO and
capture into a 250 km circular low-Mars orbit.

The approximate model is used both as a preliminary screening method and as an
independent physical cross-check on the location of the DE440s low-energy
window. All distances are kilometres, times are seconds, and velocities are
km/s unless a label says otherwise. Kernels live under data/external/kernels/, CSV/JSON results under data/output/q3/, figures under figures/, and TeX snippets under doc/generated/.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta, timezone
from importlib.metadata import version
from pathlib import Path
from typing import Iterable

_ROOT_HINT = Path(__file__).resolve().parents[2]
os.environ.setdefault("MPLCONFIGDIR", str(_ROOT_HINT / "tmp" / "matplotlib"))

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import spiceypy as spice
from scipy.integrate import solve_ivp
from scipy.optimize import brentq


ROOT = Path(__file__).resolve().parents[2]
KERNEL_DIR = ROOT / "data" / "external" / "kernels"
RESULTS_DIR = ROOT / "data" / "output" / "q3"
FIGURES_DIR = ROOT / "figures"
TEX_OUTPUT_DIR = ROOT / "doc" / "generated"

KERNELS = (
    KERNEL_DIR / "naif0012.tls",
    KERNEL_DIR / "de440s.bsp",
    KERNEL_DIR / "gm_de440.tpc",
    KERNEL_DIR / "pck00011.tpc",
)

SECONDS_PER_DAY = 86_400.0
G0_KM_S2 = 9.80665e-3
WINDOW_DEPARTURE_START = date(2026, 7, 1)
WINDOW_DEPARTURE_END = date(2027, 6, 30)
WINDOW_LABEL = "2026-2027"
WINDOW_NAME = "2026 launch opportunity"
TOF_START_DAYS = 140
TOF_END_DAYS = 360
TIME_OF_FLIGHT_LINE_DAYS = (180, 240, 300, 360)
OBSOLETE_OUTPUTS = (
    RESULTS_DIR / "schedule_sensitivity.csv",
    FIGURES_DIR / "porkchop_2028_2029.png",
    FIGURES_DIR / "porkchop_model_comparison.png",
    FIGURES_DIR / "schedule_sensitivity.png",
)

LEO_ALTITUDE_KM = 200.0
LMO_ALTITUDE_KM = 250.0
FAST_DV_THRESHOLDS_KM_S = (0.25, 0.50, 0.75, 1.00)
CANDIDATE_VINF_LIMIT_KM_S = 12.0
STANDISH_VELOCITY_STEP_DAYS = 0.05

STANDISH_ELEMENTS = {
    "EM_BARY": {
        "a": (1.00000261, 0.00000562),
        "e": (0.01671123, -0.00004392),
        "i": (-0.00001531, -0.01294668),
        "L": (100.46457166, 35999.37244981),
        "varpi": (102.93768193, 0.32327364),
        "Omega": (0.0, 0.0),
    },
    "MARS": {
        "a": (1.52371034, 0.00001847),
        "e": (0.09339410, 0.00007882),
        "i": (1.84969142, -0.00813131),
        "L": (-4.55343205, 19140.30268499),
        "varpi": (-23.94362959, 0.44441088),
        "Omega": (49.55953891, -0.29257343),
    },
}


@dataclass(frozen=True)
class PhysicalConstants:
    mu_sun: float
    mu_earth: float
    mu_mars: float
    radius_earth: float
    radius_mars: float
    au: float


@dataclass(frozen=True)
class HohmannResult:
    earth_radius_au: float
    mars_radius_au: float
    transfer_semimajor_au: float
    earth_circular_speed_km_s: float
    mars_circular_speed_km_s: float
    transfer_departure_speed_km_s: float
    transfer_arrival_speed_km_s: float
    heliocentric_departure_dv_km_s: float
    heliocentric_arrival_dv_km_s: float
    heliocentric_total_dv_km_s: float
    time_of_flight_days: float
    required_phase_angle_deg: float
    synodic_period_days: float
    transfer_specific_energy_mj_kg: float
    departure_energy_increment_mj_kg: float
    arrival_energy_increment_mj_kg: float
    leo_departure_dv_km_s: float
    lmo_capture_dv_km_s: float
    patched_conic_total_dv_km_s: float
    earth_departure_c3_km2_s2: float
    oberth_energy_gain_ratio: float


@dataclass(frozen=True)
class LambertSolution:
    v1: np.ndarray
    v2: np.ndarray
    transfer_angle_rad: float
    universal_z: float
    iterations: int


def ensure_inputs() -> None:
    missing = [str(path) for path in KERNELS if not path.exists()]
    if missing:
        joined = "\n  - ".join(missing)
        raise FileNotFoundError(f"Missing required SPICE kernels:\n  - {joined}")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_spice() -> PhysicalConstants:
    ensure_inputs()
    spice.kclear()
    for kernel in KERNELS:
        spice.furnsh(str(kernel))
    mu_sun = float(spice.bodvrd("SUN", "GM", 1)[1][0])
    mu_earth = float(spice.bodvrd("EARTH", "GM", 1)[1][0])
    mu_mars = float(spice.bodvrd("MARS", "GM", 1)[1][0])
    radius_earth = float(spice.bodvrd("EARTH", "RADII", 3)[1][0])
    radius_mars = float(spice.bodvrd("MARS", "RADII", 3)[1][0])
    au = float(spice.convrt(1.0, "AU", "KM"))
    return PhysicalConstants(
        mu_sun=mu_sun,
        mu_earth=mu_earth,
        mu_mars=mu_mars,
        radius_earth=radius_earth,
        radius_mars=radius_mars,
        au=au,
    )


def as_utc_datetime(when: date | datetime) -> datetime:
    if isinstance(when, datetime):
        if when.tzinfo is None:
            return when.replace(tzinfo=timezone.utc)
        return when.astimezone(timezone.utc)
    return datetime.combine(when, datetime.min.time(), tzinfo=timezone.utc)


def utc_et(when: date | datetime) -> float:
    stamp = as_utc_datetime(when).strftime("%Y-%m-%d %H:%M:%S.%f UTC")
    return float(spice.str2et(stamp))


def utc_midnight_et(day: date) -> float:
    return utc_et(day)


def stumpff_c(z: float) -> float:
    if z > 1e-7:
        root = math.sqrt(z)
        return (1.0 - math.cos(root)) / z
    if z < -1e-7:
        root = math.sqrt(-z)
        return (math.cosh(root) - 1.0) / (-z)
    return 0.5 - z / 24.0 + z * z / 720.0 - z**3 / 40_320.0


def stumpff_s(z: float) -> float:
    if z > 1e-7:
        root = math.sqrt(z)
        return (root - math.sin(root)) / (root**3)
    if z < -1e-7:
        root = math.sqrt(-z)
        return (math.sinh(root) - root) / (root**3)
    return 1.0 / 6.0 - z / 120.0 + z * z / 5_040.0 - z**3 / 362_880.0


def lambert_universal(
    r1_vec: np.ndarray,
    r2_vec: np.ndarray,
    tof_seconds: float,
    mu: float,
    *,
    prograde: bool = True,
) -> LambertSolution:
    """Solve the zero-revolution Lambert problem with universal variables.

    This is the standard Lagrange f-g formulation.  The returned branch is
    prograde by default; transfer angles larger than pi are retained when
    required by the endpoint geometry.
    """
    if tof_seconds <= 0.0:
        raise ValueError("Time of flight must be positive")
    r1_vec = np.asarray(r1_vec, dtype=float)
    r2_vec = np.asarray(r2_vec, dtype=float)
    r1 = float(np.linalg.norm(r1_vec))
    r2 = float(np.linalg.norm(r2_vec))
    cosine = float(np.clip(np.dot(r1_vec, r2_vec) / (r1 * r2), -1.0, 1.0))
    theta = math.acos(cosine)
    cross_z = float(np.cross(r1_vec, r2_vec)[2])
    if prograde and cross_z < 0.0:
        theta = 2.0 * math.pi - theta
    if not prograde and cross_z >= 0.0:
        theta = 2.0 * math.pi - theta

    denominator = 1.0 - math.cos(theta)
    if abs(denominator) < 1e-14:
        raise ValueError("Lambert geometry is singular for collinear endpoints")
    A = math.sin(theta) * math.sqrt(r1 * r2 / denominator)
    if abs(A) < 1e-10:
        raise ValueError("Lambert geometry is numerically singular near 180 degrees")

    root_mu_t = math.sqrt(mu) * tof_seconds

    def residual(z: float) -> float:
        c = stumpff_c(z)
        s = stumpff_s(z)
        if c <= 0.0 or not math.isfinite(c) or not math.isfinite(s):
            return math.nan
        y = r1 + r2 + A * (z * s - 1.0) / math.sqrt(c)
        if y <= 0.0 or not math.isfinite(y):
            return math.nan
        return (y / c) ** 1.5 * s + A * math.sqrt(y) - root_mu_t

    f0 = residual(0.0)
    if not math.isfinite(f0):
        raise RuntimeError("Lambert residual is invalid at z=0")

    iterations = 0
    if abs(f0) < 1e-8:
        z_root = 0.0
    elif f0 < 0.0:
        z_low, f_low = 0.0, f0
        z_high = 0.5
        while z_high < 4.0 * math.pi**2 - 1e-5:
            f_high = residual(z_high)
            iterations += 1
            if math.isfinite(f_high) and f_high >= 0.0:
                break
            z_low, f_low = z_high, f_high
            z_high = min(1.55 * z_high + 0.35, 4.0 * math.pi**2 - 1e-5)
        else:
            raise RuntimeError("Could not bracket positive Lambert root")
        if not math.isfinite(f_low):
            raise RuntimeError("Invalid lower Lambert bracket")
        z_root, result = brentq(
            residual,
            z_low,
            z_high,
            xtol=1e-11,
            rtol=1e-13,
            maxiter=100,
            full_output=True,
        )
        iterations += int(result.iterations)
    else:
        # A negative-z root corresponds to a transfer faster than the
        # parabolic-time value.  Scan from the hyperbolic limit toward zero;
        # the last finite negative residual brackets the positive f(0).
        z_values = np.linspace(-4.0 * math.pi**2 + 1e-5, 0.0, 180)
        finite_values: list[tuple[float, float]] = []
        for z_trial in z_values:
            f_trial = residual(float(z_trial))
            iterations += 1
            if math.isfinite(f_trial):
                finite_values.append((float(z_trial), f_trial))
        bracket = None
        for left, right in zip(finite_values[:-1], finite_values[1:]):
            if left[1] <= 0.0 <= right[1]:
                bracket = (left[0], right[0])
        if bracket is None:
            raise RuntimeError("Could not bracket negative Lambert root")
        z_root, result = brentq(
            residual,
            bracket[0],
            bracket[1],
            xtol=1e-11,
            rtol=1e-13,
            maxiter=100,
            full_output=True,
        )
        iterations += int(result.iterations)

    c = stumpff_c(z_root)
    s = stumpff_s(z_root)
    y = r1 + r2 + A * (z_root * s - 1.0) / math.sqrt(c)
    f = 1.0 - y / r1
    g = A * math.sqrt(y / mu)
    gdot = 1.0 - y / r2
    if abs(g) < 1e-12:
        raise RuntimeError("Lambert Lagrange coefficient g is singular")
    v1 = (r2_vec - f * r1_vec) / g
    v2 = (gdot * r2_vec - r1_vec) / g
    return LambertSolution(
        v1=v1,
        v2=v2,
        transfer_angle_rad=theta,
        universal_z=float(z_root),
        iterations=iterations,
    )


def patched_conic_dv(vinf: float, mu: float, radius: float, altitude: float) -> float:
    periapsis = radius + altitude
    hyperbolic_periapsis = math.sqrt(vinf * vinf + 2.0 * mu / periapsis)
    circular_speed = math.sqrt(mu / periapsis)
    return hyperbolic_periapsis - circular_speed


def hohmann_analysis(constants: PhysicalConstants) -> HohmannResult:
    # JPL's J2000 best-fit semi-major axes for the Earth-Moon barycenter and Mars.
    earth_au = 1.00000261
    mars_au = 1.52371034
    r1 = earth_au * constants.au
    r2 = mars_au * constants.au
    transfer_a = 0.5 * (r1 + r2)
    v_earth = math.sqrt(constants.mu_sun / r1)
    v_mars = math.sqrt(constants.mu_sun / r2)
    v_depart = math.sqrt(constants.mu_sun * (2.0 / r1 - 1.0 / transfer_a))
    v_arrive = math.sqrt(constants.mu_sun * (2.0 / r2 - 1.0 / transfer_a))
    dv_depart = v_depart - v_earth
    dv_arrive = v_mars - v_arrive
    tof = math.pi * math.sqrt(transfer_a**3 / constants.mu_sun)
    n_earth = math.sqrt(constants.mu_sun / r1**3)
    n_mars = math.sqrt(constants.mu_sun / r2**3)
    phase = math.pi - n_mars * tof
    synodic = 2.0 * math.pi / abs(n_earth - n_mars)
    transfer_energy = -constants.mu_sun / (2.0 * transfer_a)
    departure_energy_increment = 0.5 * (v_depart**2 - v_earth**2)
    arrival_energy_increment = 0.5 * (v_mars**2 - v_arrive**2)
    leo_dv = patched_conic_dv(
        dv_depart,
        constants.mu_earth,
        constants.radius_earth,
        LEO_ALTITUDE_KM,
    )
    lmo_dv = patched_conic_dv(
        dv_arrive,
        constants.mu_mars,
        constants.radius_mars,
        LMO_ALTITUDE_KM,
    )
    leo_circular = math.sqrt(
        constants.mu_earth / (constants.radius_earth + LEO_ALTITUDE_KM)
    )
    oberth_ratio = (leo_circular * leo_dv + 0.5 * leo_dv**2) / (0.5 * leo_dv**2)
    return HohmannResult(
        earth_radius_au=earth_au,
        mars_radius_au=mars_au,
        transfer_semimajor_au=transfer_a / constants.au,
        earth_circular_speed_km_s=v_earth,
        mars_circular_speed_km_s=v_mars,
        transfer_departure_speed_km_s=v_depart,
        transfer_arrival_speed_km_s=v_arrive,
        heliocentric_departure_dv_km_s=dv_depart,
        heliocentric_arrival_dv_km_s=dv_arrive,
        heliocentric_total_dv_km_s=dv_depart + dv_arrive,
        time_of_flight_days=tof / SECONDS_PER_DAY,
        required_phase_angle_deg=math.degrees(phase),
        synodic_period_days=synodic / SECONDS_PER_DAY,
        transfer_specific_energy_mj_kg=transfer_energy,
        departure_energy_increment_mj_kg=departure_energy_increment,
        arrival_energy_increment_mj_kg=arrival_energy_increment,
        leo_departure_dv_km_s=leo_dv,
        lmo_capture_dv_km_s=lmo_dv,
        patched_conic_total_dv_km_s=leo_dv + lmo_dv,
        earth_departure_c3_km2_s2=dv_depart**2,
        oberth_energy_gain_ratio=oberth_ratio,
    )


def metrics_from_states(
    departure_dt: datetime,
    tof_days: float,
    constants: PhysicalConstants,
    earth_state: np.ndarray,
    mars_state: np.ndarray,
) -> dict[str, float | str]:
    arrival_dt = departure_dt + timedelta(days=float(tof_days))
    earth_state = np.asarray(earth_state, dtype=float)
    mars_state = np.asarray(mars_state, dtype=float)
    solution = lambert_universal(
        earth_state[:3],
        mars_state[:3],
        float(tof_days) * SECONDS_PER_DAY,
        constants.mu_sun,
        prograde=True,
    )
    vinf_departure_vec = solution.v1 - earth_state[3:]
    vinf_arrival_vec = solution.v2 - mars_state[3:]
    vinf_departure = float(np.linalg.norm(vinf_departure_vec))
    vinf_arrival = float(np.linalg.norm(vinf_arrival_vec))
    leo_dv = patched_conic_dv(
        vinf_departure,
        constants.mu_earth,
        constants.radius_earth,
        LEO_ALTITUDE_KM,
    )
    lmo_dv = patched_conic_dv(
        vinf_arrival,
        constants.mu_mars,
        constants.radius_mars,
        LMO_ALTITUDE_KM,
    )
    h1 = np.cross(earth_state[:3], solution.v1)
    h2 = np.cross(mars_state[:3], solution.v2)
    energy1 = 0.5 * float(np.dot(solution.v1, solution.v1)) - (
        constants.mu_sun / float(np.linalg.norm(earth_state[:3]))
    )
    energy2 = 0.5 * float(np.dot(solution.v2, solution.v2)) - (
        constants.mu_sun / float(np.linalg.norm(mars_state[:3]))
    )
    transfer_plane_inclination = math.degrees(
        math.acos(float(np.clip(h1[2] / np.linalg.norm(h1), -1.0, 1.0)))
    )
    return {
        "departure_datetime_utc": departure_dt.isoformat(),
        "departure_date": departure_dt.date().isoformat(),
        "arrival_datetime_utc": arrival_dt.isoformat(),
        "arrival_date": arrival_dt.date().isoformat(),
        "tof_days": float(tof_days),
        "c3_km2_s2": vinf_departure**2,
        "departure_vinf_km_s": vinf_departure,
        "arrival_vinf_km_s": vinf_arrival,
        "leo_departure_dv_km_s": leo_dv,
        "lmo_capture_dv_km_s": lmo_dv,
        "total_patched_dv_km_s": leo_dv + lmo_dv,
        "departure_energy_at_infinity_mj_kg": 0.5 * vinf_departure**2,
        "transfer_angle_deg": math.degrees(solution.transfer_angle_rad),
        "transfer_plane_inclination_deg": transfer_plane_inclination,
        "universal_z": solution.universal_z,
        "lambert_iterations": solution.iterations,
        "specific_energy_start_km2_s2": energy1,
        "specific_energy_end_km2_s2": energy2,
        "specific_energy_mismatch_abs_km2_s2": abs(energy2 - energy1),
        "angular_momentum_mismatch_rel": float(
            np.linalg.norm(h2 - h1) / np.linalg.norm(h1)
        ),
    }


def mission_metrics(
    departure: date | datetime,
    tof_days: float,
    constants: PhysicalConstants,
) -> dict[str, float | str]:
    departure_dt = as_utc_datetime(departure)
    # SPICE accepts the exact fractional arrival time; departure is midnight UTC.
    dep_et = utc_et(departure_dt)
    arr_et = dep_et + float(tof_days) * SECONDS_PER_DAY
    earth_state, _ = spice.spkezr(
        "EARTH", dep_et, "ECLIPJ2000", "NONE", "SUN"
    )
    mars_state, _ = spice.spkezr(
        "MARS BARYCENTER", arr_et, "ECLIPJ2000", "NONE", "SUN"
    )
    return metrics_from_states(
        departure_dt,
        tof_days,
        constants,
        np.asarray(earth_state, dtype=float),
        np.asarray(mars_state, dtype=float),
    )



def standish_position(
    body: str,
    when: date | datetime,
    constants: PhysicalConstants,
) -> np.ndarray:
    """Return a J2000 ecliptic heliocentric position from JPL's 1800--2050 elements."""
    if body not in STANDISH_ELEMENTS:
        raise ValueError(f"Unsupported Standish body: {body}")
    et = utc_et(as_utc_datetime(when))
    jd_tdb = float(spice.unitim(et, "ET", "JDTDB"))
    centuries = (jd_tdb - 2451545.0) / 36525.0
    values = {
        name: base + rate * centuries
        for name, (base, rate) in STANDISH_ELEMENTS[body].items()
    }
    semimajor_km = values["a"] * constants.au
    eccentricity = values["e"]
    inclination = math.radians(values["i"])
    longitude_perihelion = math.radians(values["varpi"])
    longitude_node = math.radians(values["Omega"])
    argument_perihelion = longitude_perihelion - longitude_node
    mean_anomaly = math.radians((values["L"] - values["varpi"] + 180.0) % 360.0 - 180.0)

    eccentric_anomaly = mean_anomaly + eccentricity * math.sin(mean_anomaly)
    for _ in range(20):
        correction = (
            mean_anomaly
            - eccentric_anomaly
            + eccentricity * math.sin(eccentric_anomaly)
        ) / (1.0 - eccentricity * math.cos(eccentric_anomaly))
        eccentric_anomaly += correction
        if abs(correction) < 1e-13:
            break

    xp = semimajor_km * (math.cos(eccentric_anomaly) - eccentricity)
    yp = semimajor_km * math.sqrt(1.0 - eccentricity**2) * math.sin(eccentric_anomaly)
    cos_w = math.cos(argument_perihelion)
    sin_w = math.sin(argument_perihelion)
    cos_o = math.cos(longitude_node)
    sin_o = math.sin(longitude_node)
    cos_i = math.cos(inclination)
    sin_i = math.sin(inclination)
    x = (cos_w * cos_o - sin_w * sin_o * cos_i) * xp + (
        -sin_w * cos_o - cos_w * sin_o * cos_i
    ) * yp
    y = (cos_w * sin_o + sin_w * cos_o * cos_i) * xp + (
        -sin_w * sin_o + cos_w * cos_o * cos_i
    ) * yp
    z = sin_w * sin_i * xp + cos_w * sin_i * yp
    return np.array([x, y, z], dtype=float)


def standish_state(
    body: str,
    when: date | datetime,
    constants: PhysicalConstants,
) -> np.ndarray:
    """Return approximate position and a converged central-difference velocity."""
    when_dt = as_utc_datetime(when)
    step = timedelta(days=STANDISH_VELOCITY_STEP_DAYS)
    position = standish_position(body, when_dt, constants)
    velocity = (
        standish_position(body, when_dt + step, constants)
        - standish_position(body, when_dt - step, constants)
    ) / (2.0 * STANDISH_VELOCITY_STEP_DAYS * SECONDS_PER_DAY)
    return np.hstack((position, velocity))


def standish_mission_metrics(
    departure: date | datetime,
    tof_days: float,
    constants: PhysicalConstants,
) -> dict[str, float | str]:
    departure_dt = as_utc_datetime(departure)
    arrival_dt = departure_dt + timedelta(days=float(tof_days))
    earth_state = standish_state("EM_BARY", departure_dt, constants)
    mars_state = standish_state("MARS", arrival_dt, constants)
    record = metrics_from_states(
        departure_dt,
        float(tof_days),
        constants,
        earth_state,
        mars_state,
    )
    record["model"] = "standish_secular_elements"
    return record


def run_standish_grid(
    constants: PhysicalConstants,
    *,
    departure_start: date,
    departure_end: date,
    departure_step_days: int,
    tof_start_days: int,
    tof_end_days: int,
    tof_step_days: int,
) -> pd.DataFrame:
    records: list[dict[str, float | str]] = []
    failures = 0
    state_cache: dict[tuple[str, str], np.ndarray] = {}

    def cached_state(body: str, when: datetime) -> np.ndarray:
        key = (body, when.isoformat())
        if key not in state_cache:
            state_cache[key] = standish_state(body, when, constants)
        return state_cache[key]

    for departure in date_range(departure_start, departure_end, departure_step_days):
        departure_dt = as_utc_datetime(departure)
        earth_state = cached_state("EM_BARY", departure_dt)
        for tof_days in range(tof_start_days, tof_end_days + 1, tof_step_days):
            arrival_dt = departure_dt + timedelta(days=float(tof_days))
            try:
                mars_state = cached_state("MARS", arrival_dt)
                record = metrics_from_states(
                    departure_dt,
                    float(tof_days),
                    constants,
                    earth_state,
                    mars_state,
                )
                record["model"] = "standish_secular_elements"
                records.append(record)
            except (RuntimeError, ValueError, OverflowError):
                failures += 1
    if failures:
        print(f"Standish solver failures: {failures}")
    frame = pd.DataFrame.from_records(records)
    frame["departure_datetime"] = pd.to_datetime(frame["departure_date"], utc=True)
    frame["arrival_datetime"] = pd.to_datetime(frame["arrival_datetime_utc"], utc=True)
    return frame


def refine_candidate_with_evaluator(
    row: pd.Series,
    evaluator,
    *,
    half_window_days: float = 6.0,
    step_days: float = 0.25,
    objective_metric: str = "total_patched_dv_km_s",
) -> tuple[pd.Series, pd.DataFrame]:
    departure0 = datetime.fromisoformat(str(row["departure_datetime_utc"]))
    tof0 = float(row["tof_days"])
    offsets = np.arange(-half_window_days, half_window_days + 0.1 * step_days, step_days)
    records: list[dict[str, float | str]] = []
    for dep_offset in offsets:
        departure = departure0 + timedelta(days=float(dep_offset))
        for tof_offset in offsets:
            try:
                record = evaluator(departure, tof0 + float(tof_offset))
                record["departure_offset_days"] = float(dep_offset)
                record["tof_offset_days"] = float(tof_offset)
                records.append(record)
            except (RuntimeError, ValueError, OverflowError):
                continue
    refined = pd.DataFrame.from_records(records)
    best = refined.loc[refined[objective_metric].idxmin()].copy()
    return best, refined


def compare_standish_with_de440s(
    constants: PhysicalConstants,
    *,
    start: date,
    end: date,
    step_days: int = 2,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    rows: list[dict[str, float | str]] = []
    body_pairs = (
        ("Earth--Moon barycentre", "EM_BARY", "EARTH BARYCENTER"),
        ("Mars barycentre", "MARS", "MARS BARYCENTER"),
    )
    for day in date_range(start, end, step_days):
        et = utc_midnight_et(day)
        for label, standish_body, spice_body in body_pairs:
            approximate = standish_state(standish_body, day, constants)
            precise, _ = spice.spkezr(spice_body, et, "ECLIPJ2000", "NONE", "SUN")
            precise = np.asarray(precise, dtype=float)
            rows.append(
                {
                    "date_utc": day.isoformat(),
                    "body": label,
                    "position_difference_km": float(np.linalg.norm(approximate[:3] - precise[:3])),
                    "velocity_difference_m_s": 1000.0 * float(np.linalg.norm(approximate[3:] - precise[3:])),
                }
            )
    differences = pd.DataFrame(rows)
    summary = (
        differences.groupby("body", as_index=False)
        .agg(
            median_position_difference_km=("position_difference_km", "median"),
            maximum_position_difference_km=("position_difference_km", "max"),
            median_velocity_difference_m_s=("velocity_difference_m_s", "median"),
            maximum_velocity_difference_m_s=("velocity_difference_m_s", "max"),
        )
    )
    return differences, summary


def fast_threshold_sensitivity(frame: pd.DataFrame) -> pd.DataFrame:
    valid = frame[
        np.isfinite(frame["total_patched_dv_km_s"])
        & (frame["departure_vinf_km_s"] < CANDIDATE_VINF_LIMIT_KM_S)
        & (frame["arrival_vinf_km_s"] < CANDIDATE_VINF_LIMIT_KM_S)
    ].copy()
    minimum = float(valid["total_patched_dv_km_s"].min())
    rows = []
    for threshold in FAST_DV_THRESHOLDS_KM_S:
        subset = valid[valid["total_patched_dv_km_s"] <= minimum + threshold]
        selected = subset.sort_values(["tof_days", "total_patched_dv_km_s"]).iloc[0]
        rows.append(
            {
                "allowed_dv_above_minimum_km_s": threshold,
                "departure_datetime_utc": selected["departure_datetime_utc"],
                "arrival_datetime_utc": selected["arrival_datetime_utc"],
                "tof_days": selected["tof_days"],
                "total_patched_dv_km_s": selected["total_patched_dv_km_s"],
                "penalty_above_minimum_km_s": float(selected["total_patched_dv_km_s"]) - minimum,
            }
        )
    return pd.DataFrame(rows)


def date_range(start: date, end: date, step_days: int) -> Iterable[date]:
    current = start
    while current <= end:
        yield current
        current += timedelta(days=step_days)


def run_porkchop_grid(
    constants: PhysicalConstants,
    *,
    departure_start: date,
    departure_end: date,
    departure_step_days: int,
    tof_start_days: int,
    tof_end_days: int,
    tof_step_days: int,
) -> pd.DataFrame:
    records: list[dict[str, float | str]] = []
    failures = 0
    departures = list(date_range(departure_start, departure_end, departure_step_days))
    tofs = range(tof_start_days, tof_end_days + 1, tof_step_days)
    total = len(departures) * len(tofs)
    done = 0
    for departure in departures:
        for tof_days in tofs:
            done += 1
            try:
                records.append(mission_metrics(departure, float(tof_days), constants))
            except (RuntimeError, ValueError, OverflowError):
                failures += 1
        if len(departures) >= 20 and (done // len(tofs)) % 20 == 0:
            print(f"porkchop progress: {done}/{total} cases")
    if failures:
        print(f"porkchop solver failures: {failures}/{total}")
    frame = pd.DataFrame.from_records(records)
    frame["departure_datetime"] = pd.to_datetime(frame["departure_date"], utc=True)
    frame["arrival_datetime"] = pd.to_datetime(frame["arrival_datetime_utc"], utc=True)
    return frame


def circular_state(
    when: date | datetime,
    *,
    reference_et: float,
    phase_at_reference: float,
    radius_km: float,
    mu_sun: float,
) -> np.ndarray:
    elapsed = utc_et(as_utc_datetime(when)) - reference_et
    angular_rate = math.sqrt(mu_sun / radius_km**3)
    theta = phase_at_reference + angular_rate * elapsed
    speed = math.sqrt(mu_sun / radius_km)
    return np.array(
        [
            radius_km * math.cos(theta),
            radius_km * math.sin(theta),
            0.0,
            -speed * math.sin(theta),
            speed * math.cos(theta),
            0.0,
        ],
        dtype=float,
    )


def run_circular_coplanar_grid(
    constants: PhysicalConstants,
    hohmann: HohmannResult,
    *,
    departure_start: date,
    departure_end: date,
    departure_step_days: int,
    tof_start_days: int,
    tof_end_days: int,
    tof_step_days: int,
) -> pd.DataFrame:
    """Circular-coplanar comparison with DE440s phase anchoring.

    The reference phases are the ecliptic longitudes of Earth and Mars at the
    start of the same launch-window scan. Thereafter each body moves at the
    circular mean motion for the radii used in the Hohmann benchmark.
    """
    reference_et = utc_midnight_et(departure_start)
    earth_ref, _ = spice.spkezr(
        "EARTH", reference_et, "ECLIPJ2000", "NONE", "SUN"
    )
    mars_ref, _ = spice.spkezr(
        "MARS BARYCENTER", reference_et, "ECLIPJ2000", "NONE", "SUN"
    )
    earth_phase = math.atan2(float(earth_ref[1]), float(earth_ref[0]))
    mars_phase = math.atan2(float(mars_ref[1]), float(mars_ref[0]))
    earth_radius = hohmann.earth_radius_au * constants.au
    mars_radius = hohmann.mars_radius_au * constants.au

    records: list[dict[str, float | str]] = []
    failures = 0
    for departure in date_range(departure_start, departure_end, departure_step_days):
        departure_dt = as_utc_datetime(departure)
        for tof_days in range(tof_start_days, tof_end_days + 1, tof_step_days):
            arrival_dt = departure_dt + timedelta(days=float(tof_days))
            try:
                earth_state = circular_state(
                    departure_dt,
                    reference_et=reference_et,
                    phase_at_reference=earth_phase,
                    radius_km=earth_radius,
                    mu_sun=constants.mu_sun,
                )
                mars_state = circular_state(
                    arrival_dt,
                    reference_et=reference_et,
                    phase_at_reference=mars_phase,
                    radius_km=mars_radius,
                    mu_sun=constants.mu_sun,
                )
                record = metrics_from_states(
                    departure_dt,
                    float(tof_days),
                    constants,
                    earth_state,
                    mars_state,
                )
                record["model"] = "phase_anchored_circular_coplanar"
                records.append(record)
            except (RuntimeError, ValueError, OverflowError):
                failures += 1
    if failures:
        print(f"circular-coplanar solver failures: {failures}")
    frame = pd.DataFrame.from_records(records)
    frame["departure_datetime"] = pd.to_datetime(frame["departure_date"], utc=True)
    frame["arrival_datetime"] = pd.to_datetime(frame["arrival_datetime_utc"], utc=True)
    return frame


def pareto_front(frame: pd.DataFrame) -> pd.DataFrame:
    ordered = frame.sort_values(
        ["tof_days", "total_patched_dv_km_s"],
        ascending=[True, True],
    )
    running_best = math.inf
    indices: list[int] = []
    for idx, row in ordered.iterrows():
        value = float(row["total_patched_dv_km_s"])
        if value < running_best - 1e-10:
            indices.append(idx)
            running_best = value
    return frame.loc[indices].sort_values("tof_days").copy()


def select_candidates(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    valid = frame[
        np.isfinite(frame["total_patched_dv_km_s"])
        & (frame["departure_vinf_km_s"] < CANDIDATE_VINF_LIMIT_KM_S)
        & (frame["arrival_vinf_km_s"] < CANDIDATE_VINF_LIMIT_KM_S)
    ].copy()
    if valid.empty:
        raise RuntimeError("No feasible porkchop cases")
    frontier = pareto_front(valid)
    min_total = valid.loc[valid["total_patched_dv_km_s"].idxmin()].copy()
    min_c3 = valid.loc[valid["c3_km2_s2"].idxmin()].copy()

    # Fastest point no more than 0.5 km/s above the global minimum.
    fast_set = valid[
        valid["total_patched_dv_km_s"]
        <= float(min_total["total_patched_dv_km_s"]) + 0.5
    ]
    fast = fast_set.sort_values(
        ["tof_days", "total_patched_dv_km_s"]
    ).iloc[0].copy()

    # A transparent equal-weight compromise on the Pareto set: minimum
    # Euclidean distance to the normalized time-delta-v utopia point.
    t = frontier["tof_days"].to_numpy(dtype=float)
    d = frontier["total_patched_dv_km_s"].to_numpy(dtype=float)
    t_span = max(float(t.max() - t.min()), 1e-12)
    d_span = max(float(d.max() - d.min()), 1e-12)
    score = np.sqrt(((t - t.min()) / t_span) ** 2 + ((d - d.min()) / d_span) ** 2)
    balanced = frontier.iloc[int(np.argmin(score))].copy()

    candidates = pd.DataFrame([min_total, min_c3, fast, balanced])
    candidates.insert(
        0,
        "design",
        ["minimum_total_dv", "minimum_c3", "fast_within_0.5", "balanced_pareto"],
    )
    return candidates, frontier


def refine_candidate(
    row: pd.Series,
    constants: PhysicalConstants,
    *,
    half_window_days: float = 6.0,
    step_days: float = 0.25,
    objective_metric: str = "total_patched_dv_km_s",
) -> tuple[pd.Series, pd.DataFrame]:
    departure0 = datetime.fromisoformat(str(row["departure_datetime_utc"]))
    tof0 = float(row["tof_days"])
    offsets = np.arange(-half_window_days, half_window_days + 0.1 * step_days, step_days)
    records: list[dict[str, float | str]] = []
    for dep_offset in offsets:
        departure = departure0 + timedelta(days=float(dep_offset))
        for tof_offset in offsets:
            try:
                record = mission_metrics(departure, tof0 + float(tof_offset), constants)
                record["departure_offset_days"] = float(dep_offset)
                record["tof_offset_days"] = float(tof_offset)
                records.append(record)
            except (RuntimeError, ValueError, OverflowError):
                continue
    refined = pd.DataFrame.from_records(records)
    best = refined.loc[refined[objective_metric].idxmin()].copy()
    return best, refined


def propagation_validation(
    mission: pd.Series,
    constants: PhysicalConstants,
) -> tuple[dict[str, float], np.ndarray, np.ndarray]:
    departure = datetime.fromisoformat(str(mission["departure_datetime_utc"]))
    tof_days = float(mission["tof_days"])
    dep_et = utc_et(departure)
    arr_et = dep_et + tof_days * SECONDS_PER_DAY
    earth_state, _ = spice.spkezr(
        "EARTH", dep_et, "ECLIPJ2000", "NONE", "SUN"
    )
    mars_state, _ = spice.spkezr(
        "MARS BARYCENTER", arr_et, "ECLIPJ2000", "NONE", "SUN"
    )
    earth_state = np.asarray(earth_state, dtype=float)
    mars_state = np.asarray(mars_state, dtype=float)
    solution = lambert_universal(
        earth_state[:3],
        mars_state[:3],
        tof_days * SECONDS_PER_DAY,
        constants.mu_sun,
    )

    def rhs(_: float, y: np.ndarray) -> np.ndarray:
        r = y[:3]
        acceleration = -constants.mu_sun * r / np.linalg.norm(r) ** 3
        return np.hstack((y[3:], acceleration))

    sample_times = np.linspace(0.0, tof_days * SECONDS_PER_DAY, 500)
    ivp = solve_ivp(
        rhs,
        (0.0, tof_days * SECONDS_PER_DAY),
        np.hstack((earth_state[:3], solution.v1)),
        method="DOP853",
        t_eval=sample_times,
        rtol=2e-12,
        atol=np.array([1e-5, 1e-5, 1e-5, 1e-10, 1e-10, 1e-10]),
    )
    if not ivp.success:
        raise RuntimeError(ivp.message)
    position_error = float(np.linalg.norm(ivp.y[:3, -1] - mars_state[:3]))
    velocity_error = float(np.linalg.norm(ivp.y[3:, -1] - solution.v2))
    start_energy = 0.5 * float(np.dot(solution.v1, solution.v1)) - (
        constants.mu_sun / float(np.linalg.norm(earth_state[:3]))
    )
    end_energy = 0.5 * float(np.dot(ivp.y[3:, -1], ivp.y[3:, -1])) - (
        constants.mu_sun / float(np.linalg.norm(ivp.y[:3, -1]))
    )
    start_h = np.cross(earth_state[:3], solution.v1)
    end_h = np.cross(ivp.y[:3, -1], ivp.y[3:, -1])
    validation = {
        "endpoint_position_error_km": position_error,
        "endpoint_velocity_error_km_s": velocity_error,
        "specific_energy_drift_abs_km2_s2": abs(end_energy - start_energy),
        "specific_energy_drift_rel": abs(end_energy - start_energy) / abs(start_energy),
        "angular_momentum_drift_rel": float(
            np.linalg.norm(end_h - start_h) / np.linalg.norm(start_h)
        ),
        "ode_function_evaluations": int(ivp.nfev),
    }
    return validation, ivp.t, ivp.y


def local_date_stability(
    mission: pd.Series,
    constants: PhysicalConstants,
    half_window_days: int = 7,
) -> pd.DataFrame:
    departure0 = datetime.fromisoformat(str(mission["departure_datetime_utc"]))
    arrival0 = datetime.fromisoformat(str(mission["arrival_datetime_utc"]))
    records: list[dict[str, float | str]] = []
    for dep_offset in range(-half_window_days, half_window_days + 1):
        departure = departure0 + timedelta(days=float(dep_offset))
        for arr_offset in range(-half_window_days, half_window_days + 1):
            arrival = arrival0 + timedelta(days=float(arr_offset))
            tof = float((arrival - departure).total_seconds() / SECONDS_PER_DAY)
            try:
                record = mission_metrics(departure, tof, constants)
                record["departure_offset_days"] = dep_offset
                record["arrival_offset_days"] = arr_offset
                records.append(record)
            except (RuntimeError, ValueError, OverflowError):
                continue
    return pd.DataFrame.from_records(records)


def make_orbit_classification_figure() -> None:
    fig, ax = plt.subplots(figsize=(7.2, 5.2))
    styles = [
        (0.55, "ellipse: $0<e<1$", "#2C7FB8"),
        (1.00, "parabola: $e=1$", "#F28E2B"),
        (1.35, "hyperbola: $e>1$", "#C43C39"),
    ]
    for eccentricity, label, color in styles:
        if eccentricity < 1.0:
            theta = np.linspace(-math.pi, math.pi, 1400)
        else:
            limit = math.acos(-1.0 / eccentricity) - 0.035
            theta = np.linspace(-limit, limit, 1400)
        radius = 1.0 / (1.0 + eccentricity * np.cos(theta))
        x = radius * np.cos(theta)
        y = radius * np.sin(theta)
        mask = radius < 8.0
        ax.plot(x[mask], y[mask], lw=2.2, color=color, label=label)
    ax.scatter([0], [0], s=150, color="#FDB813", edgecolor="#8A5A00", zorder=5)
    ax.annotate("focus", (0, 0), xytext=(8, 8), textcoords="offset points")
    ax.axhline(0, color="#777777", lw=0.6)
    ax.axvline(0, color="#777777", lw=0.6)
    ax.set_aspect("equal", adjustable="box")
    ax.set_xlim(-3.0, 4.5)
    ax.set_ylim(-3.2, 3.2)
    ax.set_xlabel("$x/p$")
    ax.set_ylabel("$y/p$")
    ax.set_title("Keplerian conics from $r=p/(1+e\\cos\\theta)$")
    ax.legend(frameon=False, loc="upper right")
    fig.tight_layout()
    fig.savefig(FIGURES_DIR / "keplerian_orbit_classes.png", dpi=300)
    plt.close(fig)


def make_hohmann_figure(hohmann: HohmannResult) -> None:
    theta = np.linspace(0.0, 2.0 * math.pi, 900)
    r1 = hohmann.earth_radius_au
    r2 = hohmann.mars_radius_au
    a = hohmann.transfer_semimajor_au
    e = (r2 - r1) / (r2 + r1)
    transfer_theta = np.linspace(0.0, math.pi, 600)
    transfer_r = a * (1.0 - e * e) / (1.0 + e * np.cos(transfer_theta))

    fig, ax = plt.subplots(figsize=(7.2, 6.0))
    ax.plot(r1 * np.cos(theta), r1 * np.sin(theta), color="#2C7FB8", label="Earth orbit")
    ax.plot(r2 * np.cos(theta), r2 * np.sin(theta), color="#C43C39", label="Mars orbit")
    ax.plot(
        transfer_r * np.cos(transfer_theta),
        transfer_r * np.sin(transfer_theta),
        color="#6A3D9A",
        lw=2.5,
        label="Hohmann half-ellipse",
    )
    ax.scatter([0], [0], s=180, color="#FDB813", edgecolor="#8A5A00", zorder=6)
    ax.scatter([r1], [0], s=70, color="#2C7FB8", zorder=6)
    ax.scatter([-r2], [0], s=70, color="#C43C39", zorder=6)
    ax.annotate(
        f"$\\Delta v_1={hohmann.heliocentric_departure_dv_km_s:.2f}$ km/s",
        (r1, 0),
        xytext=(16, 22),
        textcoords="offset points",
    )
    ax.annotate(
        f"$\\Delta v_2={hohmann.heliocentric_arrival_dv_km_s:.2f}$ km/s",
        (-r2, 0),
        xytext=(14, -34),
        textcoords="offset points",
    )
    ax.text(
        0.02,
        0.02,
        f"TOF = {hohmann.time_of_flight_days:.1f} d\n"
        f"required phase = {hohmann.required_phase_angle_deg:.1f} deg",
        transform=ax.transAxes,
        bbox={"boxstyle": "round,pad=0.35", "facecolor": "white", "alpha": 0.9},
    )
    ax.set_aspect("equal", adjustable="box")
    ax.set_xlabel("ecliptic $x$ [AU]")
    ax.set_ylabel("ecliptic $y$ [AU]")
    ax.set_title("Ideal circular-coplanar Earth-to-Mars Hohmann transfer")
    ax.legend(frameon=False, loc="upper right")
    fig.tight_layout()
    fig.savefig(FIGURES_DIR / "hohmann_transfer.png", dpi=300)
    plt.close(fig)


def pivot_metric(frame: pd.DataFrame, metric: str) -> pd.DataFrame:
    return frame.pivot_table(
        index="tof_days",
        columns="departure_datetime",
        values=metric,
        aggfunc="min",
    ).sort_index().sort_index(axis=1)


def contour_levels(values: np.ndarray, preferred: list[float], count: int = 7) -> list[float]:
    finite = values[np.isfinite(values)]
    low = float(np.nanmin(finite))
    high = float(np.nanmax(finite))
    levels = [level for level in preferred if low < level < high]
    if len(levels) >= 3:
        return levels
    return list(np.linspace(low, high, count + 2)[1:-1])


def add_time_of_flight_lines(ax: plt.Axes, xlim: tuple[float, float], ylim: tuple[float, float]) -> None:
    dep_values = np.linspace(xlim[0], xlim[1], 500)
    for tof_days in TIME_OF_FLIGHT_LINE_DAYS:
        arr_values = dep_values + float(tof_days)
        mask = (arr_values >= ylim[0]) & (arr_values <= ylim[1])
        if not np.any(mask):
            continue
        ax.plot(
            dep_values[mask],
            arr_values[mask],
            color="#D62728",
            linestyle="--",
            linewidth=0.75,
            alpha=0.95,
            zorder=6,
        )
        visible_dep = dep_values[mask]
        visible_arr = arr_values[mask]
        label_index = min(max(len(visible_dep) // 5, 0), len(visible_dep) - 1)
        ax.text(
            visible_dep[label_index],
            visible_arr[label_index],
            f"{tof_days} d",
            color="#D62728",
            fontsize=7,
            rotation=28,
            ha="center",
            va="center",
            bbox={"facecolor": "white", "edgecolor": "none", "alpha": 0.55, "pad": 0.4},
            zorder=7,
        )


def configure_date_axes(ax: plt.Axes) -> None:
    ax.xaxis_date()
    ax.yaxis_date()
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
    ax.yaxis.set_major_locator(mdates.MonthLocator(interval=2))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    ax.yaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    ax.tick_params(axis="x", rotation=35)
    ax.set_xlabel("departure date [UTC]")
    ax.grid(color="white", alpha=0.18, lw=0.5)


def mark_candidate(
    ax: plt.Axes,
    candidates: pd.DataFrame,
    design: str,
    *,
    marker: str,
    label: str,
    size: float,
) -> None:
    row = candidates[candidates["design"] == design].iloc[0]
    ax.scatter(
        [mdates.date2num(pd.Timestamp(row["departure_date"]))],
        [mdates.date2num(pd.Timestamp(row["arrival_date"]))],
        marker=marker,
        s=size,
        facecolor="white",
        edgecolor="black",
        linewidth=0.9,
        zorder=9,
        label=label,
    )


def make_porkchop_metric_pair_figure(
    frame: pd.DataFrame,
    candidates: pd.DataFrame,
    *,
    output_name: str,
    title: str,
) -> None:
    dep = pd.to_datetime(frame["departure_date"]).map(mdates.date2num).to_numpy()
    arr = pd.to_datetime(frame["arrival_date"]).map(mdates.date2num).to_numpy()
    tri = matplotlib.tri.Triangulation(dep, arr)
    xlim = (float(np.nanmin(dep)), float(np.nanmax(dep)))
    ylim = (float(np.nanmin(arr)), float(np.nanmax(arr)))
    panels = [
        {
            "metric": "c3_km2_s2",
            "title": "Earth departure characteristic energy",
            "colorbar": "$C_3$ [km$^2$/s$^2$]",
            "cmap": "viridis",
            "clip": 65.0,
            "preferred_levels": [8, 10, 12, 15, 20, 30, 45, 60],
            "fmt": "%.0f",
            "best_design": "minimum_c3",
            "best_label": "minimum $C_3$",
        },
        {
            "metric": "total_patched_dv_km_s",
            "title": "LEO injection plus LMO capture impulse",
            "colorbar": "total patched $\\Delta v$ [km/s]",
            "cmap": "cividis",
            "clip": 12.0,
            "preferred_levels": [5.6, 5.8, 6.0, 6.3, 6.8, 7.5, 8.5, 10.0, 12.0],
            "fmt": "%.1f",
            "best_design": "minimum_total_dv",
            "best_label": "minimum total $\\Delta v$",
        },
    ]

    fig, axes = plt.subplots(1, 2, figsize=(12.4, 5.35), sharex=True, sharey=True)
    for ax, panel in zip(axes, panels):
        values = frame[str(panel["metric"])].to_numpy(dtype=float)
        clipped = np.clip(values, 0.0, float(panel["clip"]))
        fill = ax.tricontourf(tri, clipped, levels=42, cmap=str(panel["cmap"]))
        levels = contour_levels(values, list(panel["preferred_levels"]))
        lines = ax.tricontour(
            tri,
            values,
            levels=levels,
            colors="white",
            linewidths=0.72,
        )
        ax.clabel(lines, inline=True, fontsize=7, fmt=str(panel["fmt"]))
        add_time_of_flight_lines(ax, xlim, ylim)
        mark_candidate(
            ax,
            candidates,
            str(panel["best_design"]),
            marker="*",
            label=str(panel["best_label"]),
            size=95,
        )
        other_design = "minimum_total_dv" if panel["best_design"] == "minimum_c3" else "minimum_c3"
        other_label = "minimum total $\\Delta v$" if other_design == "minimum_total_dv" else "minimum $C_3$"
        mark_candidate(
            ax,
            candidates,
            other_design,
            marker="o",
            label=other_label,
            size=34,
        )
        configure_date_axes(ax)
        ax.set_xlim(xlim)
        ax.set_ylim(ylim)
        ax.set_title(str(panel["title"]))
        ax.legend(frameon=True, framealpha=0.75, fontsize=7, loc="upper left")
        fig.colorbar(fill, ax=ax, label=str(panel["colorbar"]))
    axes[0].set_ylabel("arrival date [UTC]")
    fig.suptitle(title, y=1.02)
    fig.tight_layout()
    fig.savefig(FIGURES_DIR / output_name, dpi=300, bbox_inches="tight")
    plt.close(fig)


def make_porkchop_figure(frame: pd.DataFrame, candidates: pd.DataFrame) -> None:
    make_porkchop_metric_pair_figure(
        frame,
        candidates,
        output_name="porkchop_2026_2027.png",
        title=f"DE440s + zero-revolution Lambert porkchop map ({WINDOW_NAME})",
    )


def make_circular_coplanar_porkchop_figure(
    frame: pd.DataFrame,
    candidates: pd.DataFrame,
) -> None:
    make_porkchop_metric_pair_figure(
        frame,
        candidates,
        output_name="porkchop_circular_coplanar_2026_2027.png",
        title=f"Phase-anchored circular-coplanar porkchop map ({WINDOW_NAME})",
    )


def make_pareto_figure(frame: pd.DataFrame, frontier: pd.DataFrame, candidates: pd.DataFrame) -> None:
    fig, ax = plt.subplots(figsize=(7.4, 5.3))
    sample = frame[
        np.isfinite(frame["total_patched_dv_km_s"])
        & (frame["departure_vinf_km_s"] < CANDIDATE_VINF_LIMIT_KM_S)
        & (frame["arrival_vinf_km_s"] < CANDIDATE_VINF_LIMIT_KM_S)
    ]
    color_values = pd.to_datetime(sample["departure_date"]).map(mdates.date2num)
    scatter = ax.scatter(
        sample["tof_days"],
        sample["total_patched_dv_km_s"],
        c=color_values,
        s=7,
        alpha=0.22,
        cmap="viridis",
        edgecolors="none",
    )
    ax.plot(
        frontier["tof_days"],
        frontier["total_patched_dv_km_s"],
        color="#C43C39",
        lw=2.2,
        label="non-dominated frontier",
    )
    label_offsets = {
        "minimum_total_dv": (8, 10),
        "minimum_c3": (8, -19),
        "fast_within_0.5": (8, 6),
        "balanced_pareto": (8, 6),
    }
    for _, row in candidates.iterrows():
        ax.scatter(
            row["tof_days"],
            row["total_patched_dv_km_s"],
            s=70,
            marker="*" if row["design"] == "minimum_total_dv" else "o",
            facecolor="white",
            edgecolor="black",
            zorder=8,
        )
        ax.annotate(
            str(row["design"]).replace("_", " "),
            (row["tof_days"], row["total_patched_dv_km_s"]),
            xytext=label_offsets[str(row["design"])],
            textcoords="offset points",
            fontsize=7,
        )
    colorbar = fig.colorbar(scatter, ax=ax, label="departure date [UTC]")
    colorbar.ax.yaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    ax.set_xlabel("time of flight [days]")
    ax.set_ylabel("LEO departure + LMO capture $\\Delta v$ [km/s]")
    ax.set_title(f"Time-energy tradeoff in the {WINDOW_NAME}")
    ax.grid(alpha=0.25)
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(FIGURES_DIR / "pareto_time_delta_v.png", dpi=300)
    plt.close(fig)


def make_solution_stability_figure(stability: pd.DataFrame) -> None:
    panels = [
        (
            "minimum_c3",
            "c3_km2_s2",
            "Stability about the minimum-$C_3$ design",
            "$C_3$ [km$^2$/s$^2$]",
            "viridis",
            "%.2f",
        ),
        (
            "minimum_total_dv",
            "total_patched_dv_km_s",
            "Stability about the minimum-total-$\\Delta v$ design",
            "total patched $\\Delta v$ [km/s]",
            "cividis",
            "%.3f",
        ),
    ]
    fig, axes = plt.subplots(1, 2, figsize=(12.0, 5.2), sharex=True, sharey=True)
    for ax, (design, metric, title, colorbar_label, cmap, fmt) in zip(axes, panels):
        subset = stability[stability["reference_design"] == design]
        matrix = subset.pivot_table(
            index="arrival_offset_days",
            columns="departure_offset_days",
            values=metric,
            aggfunc="min",
        ).sort_index()
        x = matrix.columns.to_numpy(dtype=float)
        y = matrix.index.to_numpy(dtype=float)
        z = matrix.to_numpy(dtype=float)
        image = ax.imshow(
            z,
            aspect="auto",
            cmap=cmap,
            extent=[x.min() - 0.5, x.max() + 0.5, y.min() - 0.5, y.max() + 0.5],
            origin="lower",
        )
        levels = np.linspace(float(np.nanmin(z)), float(np.nanmax(z)), 8)[1:-1]
        contours = ax.contour(x, y, z, colors="white", linewidths=0.7, levels=levels)
        ax.clabel(contours, inline=True, fontsize=7, fmt=fmt)
        ax.scatter([0], [0], marker="*", s=115, facecolor="white", edgecolor="black", zorder=6)
        ax.set_xlabel("departure-date displacement [days]")
        ax.set_title(title)
        fig.colorbar(image, ax=ax, label=colorbar_label)
        ax.grid(color="white", alpha=0.12, lw=0.5)
    axes[0].set_ylabel("arrival-date displacement [days]")
    fig.suptitle("Local robustness of the two reported optimum definitions", y=1.02)
    fig.tight_layout()
    fig.savefig(FIGURES_DIR / "optimal_solution_stability.png", dpi=300, bbox_inches="tight")
    plt.close(fig)



def make_standish_difference_figure(differences: pd.DataFrame) -> None:
    fig, axes = plt.subplots(1, 2, figsize=(12.0, 4.8), sharex=True)
    for body, subset in differences.groupby("body"):
        dates = pd.to_datetime(subset["date_utc"])
        axes[0].plot(dates, subset["position_difference_km"], lw=1.6, label=body)
        axes[1].plot(dates, subset["velocity_difference_m_s"], lw=1.6, label=body)
    axes[0].set_ylabel("state-position difference [km]")
    axes[1].set_ylabel("state-velocity difference [m/s]")
    for ax in axes:
        ax.set_xlabel("date [UTC]")
        ax.xaxis.set_major_locator(mdates.MonthLocator(interval=4))
        ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
        ax.tick_params(axis="x", rotation=30)
        ax.grid(alpha=0.25)
        ax.legend(frameon=False)
    axes[0].set_title("Position difference")
    axes[1].set_title("Velocity difference")
    fig.suptitle("JPL/Standish secular elements relative to DE440s", y=1.02)
    fig.tight_layout()
    fig.savefig(FIGURES_DIR / "standish_de440s_state_difference.png", dpi=300, bbox_inches="tight")
    plt.close(fig)


def make_transfer_trajectory_figure(
    mission: pd.Series,
    constants: PhysicalConstants,
    integration_t: np.ndarray,
    integration_y: np.ndarray,
) -> None:
    departure = datetime.fromisoformat(str(mission["departure_datetime_utc"]))
    tof_days = float(mission["tof_days"])
    dep_et = utc_et(departure)
    sample_et = dep_et + integration_t
    earth_positions = []
    mars_positions = []
    for et in sample_et:
        earth_positions.append(
            spice.spkezr("EARTH", float(et), "ECLIPJ2000", "NONE", "SUN")[0][:3]
        )
        mars_positions.append(
            spice.spkezr(
                "MARS BARYCENTER", float(et), "ECLIPJ2000", "NONE", "SUN"
            )[0][:3]
        )
    earth_positions = np.asarray(earth_positions) / constants.au
    mars_positions = np.asarray(mars_positions) / constants.au
    transfer = integration_y[:3].T / constants.au
    departure_label = departure.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    arrival_label = datetime.fromisoformat(
        str(mission["arrival_datetime_utc"])
    ).astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    fig = plt.figure(figsize=(8.0, 6.4))
    ax = fig.add_subplot(111, projection="3d")
    ax.plot(
        earth_positions[:, 0],
        earth_positions[:, 1],
        earth_positions[:, 2],
        color="#2C7FB8",
        lw=1.5,
        label="Earth during flight",
    )
    ax.plot(
        mars_positions[:, 0],
        mars_positions[:, 1],
        mars_positions[:, 2],
        color="#C43C39",
        lw=1.5,
        label="Mars during flight",
    )
    ax.plot(
        transfer[:, 0],
        transfer[:, 1],
        transfer[:, 2],
        color="#6A3D9A",
        lw=2.5,
        label="Lambert transfer",
    )
    ax.scatter([0], [0], [0], s=180, color="#FDB813", edgecolor="#8A5A00")
    ax.scatter(*transfer[0], s=60, color="#2C7FB8")
    ax.scatter(*transfer[-1], s=60, color="#C43C39")
    ax.set_xlabel("$x$ [AU]")
    ax.set_ylabel("$y$ [AU]")
    ax.set_zlabel("$z$ [AU]")
    ax.set_title(
        f"DE440s boundary states and Lambert arc\n"
        f"{departure_label} to {arrival_label} ({tof_days:.1f} d)"
    )
    ax.view_init(elev=23, azim=-66)
    ax.set_box_aspect((1.0, 1.0, 0.42))
    ax.legend(frameon=False, loc="upper left")
    fig.tight_layout()
    fig.savefig(FIGURES_DIR / "lambert_transfer_3d.png", dpi=300)
    plt.close(fig)


def write_tex_outputs(
    constants: PhysicalConstants,
    hohmann: HohmannResult,
    candidates: pd.DataFrame,
    circular_minimum: pd.Series,
    standish_minimum: pd.Series,
    validation: dict[str, float],
    convergence: pd.DataFrame,
    stability: pd.DataFrame,
    standish_summary: pd.DataFrame,
    fast_sensitivity: pd.DataFrame,
) -> None:
    def timestamp_label(value: str) -> str:
        stamp = datetime.fromisoformat(value).astimezone(timezone.utc)
        if stamp.hour == 0 and stamp.minute == 0:
            return stamp.strftime("%Y-%m-%d")
        return stamp.strftime("%Y-%m-%d %H:%M")

    minimum = candidates[candidates["design"] == "minimum_total_dv"].iloc[0]
    minimum_c3 = candidates[candidates["design"] == "minimum_c3"].iloc[0]
    balanced = candidates[candidates["design"] == "balanced_pareto"].iloc[0]
    fast = candidates[candidates["design"] == "fast_within_0.5"].iloc[0]
    nominal_dv = float(minimum["total_patched_dv_km_s"])
    total_stability = stability[stability["reference_design"] == "minimum_total_dv"]
    c3_stability = stability[stability["reference_design"] == "minimum_c3"]
    total_stability_penalty = float(
        np.nanmax(total_stability["total_patched_dv_km_s"].to_numpy(dtype=float)) - nominal_dv
    )
    c3_stability_penalty = float(
        np.nanmax(c3_stability["c3_km2_s2"].to_numpy(dtype=float))
        - float(minimum_c3["c3_km2_s2"])
    )
    earth_summary = standish_summary[standish_summary["body"] == "Earth--Moon barycentre"].iloc[0]
    mars_summary = standish_summary[standish_summary["body"] == "Mars barycentre"].iloc[0]
    macros = f"""\\newcommand{{\\HohmannTOF}}{{{hohmann.time_of_flight_days:.1f}}}
\\newcommand{{\\HohmannDVOne}}{{{hohmann.heliocentric_departure_dv_km_s:.3f}}}
\\newcommand{{\\HohmannDVTwo}}{{{hohmann.heliocentric_arrival_dv_km_s:.3f}}}
\\newcommand{{\\HohmannEarthSpeed}}{{{hohmann.earth_circular_speed_km_s:.3f}}}
\\newcommand{{\\HohmannMarsSpeed}}{{{hohmann.mars_circular_speed_km_s:.3f}}}
\\newcommand{{\\HohmannTransferDepartureSpeed}}{{{hohmann.transfer_departure_speed_km_s:.3f}}}
\\newcommand{{\\HohmannTransferArrivalSpeed}}{{{hohmann.transfer_arrival_speed_km_s:.3f}}}
\\newcommand{{\\HohmannDepartureEnergy}}{{{hohmann.departure_energy_increment_mj_kg:.3f}}}
\\newcommand{{\\HohmannArrivalEnergy}}{{{hohmann.arrival_energy_increment_mj_kg:.3f}}}
\\newcommand{{\\HohmannTransferEnergy}}{{{hohmann.transfer_specific_energy_mj_kg:.3f}}}
\\newcommand{{\\HohmannCThree}}{{{hohmann.earth_departure_c3_km2_s2:.3f}}}
\\newcommand{{\\HohmannLEODV}}{{{hohmann.leo_departure_dv_km_s:.3f}}}
\\newcommand{{\\HohmannLMODV}}{{{hohmann.lmo_capture_dv_km_s:.3f}}}
\\newcommand{{\\HohmannPhase}}{{{hohmann.required_phase_angle_deg:.2f}}}
\\newcommand{{\\HohmannSynodic}}{{{hohmann.synodic_period_days:.1f}}}
\\newcommand{{\\HohmannPatchedDV}}{{{hohmann.patched_conic_total_dv_km_s:.3f}}}
\\newcommand{{\\MinimumDeparture}}{{{timestamp_label(str(minimum['departure_datetime_utc']))}}}
\\newcommand{{\\MinimumArrival}}{{{timestamp_label(str(minimum['arrival_datetime_utc']))}}}
\\newcommand{{\\MinimumTOF}}{{{float(minimum['tof_days']):.2f}}}
\\newcommand{{\\MinimumCThree}}{{{float(minimum['c3_km2_s2']):.2f}}}
\\newcommand{{\\MinimumArrivalVInf}}{{{float(minimum['arrival_vinf_km_s']):.3f}}}
\\newcommand{{\\MinimumLEODV}}{{{float(minimum['leo_departure_dv_km_s']):.3f}}}
\\newcommand{{\\MinimumLMODV}}{{{float(minimum['lmo_capture_dv_km_s']):.3f}}}
\\newcommand{{\\MinimumTotalDV}}{{{nominal_dv:.3f}}}
\\newcommand{{\\MinimumTransferAngle}}{{{float(minimum['transfer_angle_deg']):.2f}}}
\\newcommand{{\\MinimumTransferInclination}}{{{float(minimum['transfer_plane_inclination_deg']):.2f}}}
\\newcommand{{\\MinimumTransferSemimajor}}{{{-constants.mu_sun / (2.0 * float(minimum['specific_energy_start_km2_s2'])) / constants.au:.3f}}}
\\newcommand{{\\MinCThreeDeparture}}{{{timestamp_label(str(minimum_c3['departure_datetime_utc']))}}}
\\newcommand{{\\MinCThreeArrival}}{{{timestamp_label(str(minimum_c3['arrival_datetime_utc']))}}}
\\newcommand{{\\MinCThreeTOF}}{{{float(minimum_c3['tof_days']):.2f}}}
\\newcommand{{\\MinCThreeCThree}}{{{float(minimum_c3['c3_km2_s2']):.2f}}}
\\newcommand{{\\MinCThreeArrivalVInf}}{{{float(minimum_c3['arrival_vinf_km_s']):.2f}}}
\\newcommand{{\\MinCThreeTotalDV}}{{{float(minimum_c3['total_patched_dv_km_s']):.3f}}}
\\newcommand{{\\CircularMinimumDeparture}}{{{timestamp_label(str(circular_minimum['departure_datetime_utc']))}}}
\\newcommand{{\\CircularMinimumArrival}}{{{timestamp_label(str(circular_minimum['arrival_datetime_utc']))}}}
\\newcommand{{\\CircularMinimumTOF}}{{{float(circular_minimum['tof_days']):.1f}}}
\\newcommand{{\\CircularMinimumCThree}}{{{float(circular_minimum['c3_km2_s2']):.2f}}}
\\newcommand{{\\CircularMinimumArrivalVInf}}{{{float(circular_minimum['arrival_vinf_km_s']):.2f}}}
\\newcommand{{\\CircularMinimumTotalDV}}{{{float(circular_minimum['total_patched_dv_km_s']):.3f}}}
\\newcommand{{\\StandishMinimumDeparture}}{{{timestamp_label(str(standish_minimum['departure_datetime_utc']))}}}
\\newcommand{{\\StandishMinimumArrival}}{{{timestamp_label(str(standish_minimum['arrival_datetime_utc']))}}}
\\newcommand{{\\StandishMinimumTOF}}{{{float(standish_minimum['tof_days']):.2f}}}
\\newcommand{{\\StandishMinimumCThree}}{{{float(standish_minimum['c3_km2_s2']):.2f}}}
\\newcommand{{\\StandishMinimumTotalDV}}{{{float(standish_minimum['total_patched_dv_km_s']):.3f}}}
\\newcommand{{\\RealMinusCircularDV}}{{{nominal_dv - float(circular_minimum['total_patched_dv_km_s']):.3f}}}
\\newcommand{{\\RealMinusCircularTOF}}{{{float(minimum['tof_days']) - float(circular_minimum['tof_days']):.1f}}}
\\newcommand{{\\RealMinusStandishDV}}{{{nominal_dv - float(standish_minimum['total_patched_dv_km_s']):.4f}}}
\\newcommand{{\\RealMinusStandishDepartureDays}}{{{(datetime.fromisoformat(str(minimum['departure_datetime_utc'])) - datetime.fromisoformat(str(standish_minimum['departure_datetime_utc']))).total_seconds() / SECONDS_PER_DAY:.2f}}}
\\newcommand{{\\RealMinusStandishTOF}}{{{float(minimum['tof_days']) - float(standish_minimum['tof_days']):.2f}}}
\\newcommand{{\\FastDeparture}}{{{timestamp_label(str(fast['departure_datetime_utc']))}}}
\\newcommand{{\\FastArrival}}{{{timestamp_label(str(fast['arrival_datetime_utc']))}}}
\\newcommand{{\\BalancedDeparture}}{{{timestamp_label(str(balanced['departure_datetime_utc']))}}}
\\newcommand{{\\BalancedArrival}}{{{timestamp_label(str(balanced['arrival_datetime_utc']))}}}
\\newcommand{{\\FastCThree}}{{{float(fast['c3_km2_s2']):.2f}}}
\\newcommand{{\\FastArrivalVInf}}{{{float(fast['arrival_vinf_km_s']):.2f}}}
\\newcommand{{\\BalancedCThree}}{{{float(balanced['c3_km2_s2']):.2f}}}
\\newcommand{{\\BalancedArrivalVInf}}{{{float(balanced['arrival_vinf_km_s']):.2f}}}
\\newcommand{{\\BalancedTOF}}{{{float(balanced['tof_days']):.1f}}}
\\newcommand{{\\BalancedTotalDV}}{{{float(balanced['total_patched_dv_km_s']):.3f}}}
\\newcommand{{\\FastTOF}}{{{float(fast['tof_days']):.1f}}}
\\newcommand{{\\FastTotalDV}}{{{float(fast['total_patched_dv_km_s']):.3f}}}
\\newcommand{{\\ActualDVPenaltyPercent}}{{{100.0 * (nominal_dv / hohmann.patched_conic_total_dv_km_s - 1.0):.2f}}}
\\newcommand{{\\ActualTOFPenaltyPercent}}{{{100.0 * (float(minimum['tof_days']) / hohmann.time_of_flight_days - 1.0):.2f}}}
\\newcommand{{\\FastDVPenaltyPercent}}{{{100.0 * (float(fast['total_patched_dv_km_s']) / nominal_dv - 1.0):.2f}}}
\\newcommand{{\\BalancedDVPenaltyPercent}}{{{100.0 * (float(balanced['total_patched_dv_km_s']) / nominal_dv - 1.0):.2f}}}
\\newcommand{{\\LambertEndpointError}}{{{validation['endpoint_position_error_km']:.6f}}}
\\newcommand{{\\CThreeStabilityWorstPenalty}}{{{c3_stability_penalty:.2f}}}
\\newcommand{{\\TotalDVStabilityWorstPenalty}}{{{total_stability_penalty:.3f}}}
\\newcommand{{\\StandishEarthMedianPositionError}}{{{float(earth_summary['median_position_difference_km']):.0f}}}
\\newcommand{{\\StandishEarthMaximumPositionError}}{{{float(earth_summary['maximum_position_difference_km']):.0f}}}
\\newcommand{{\\StandishEarthMedianVelocityError}}{{{float(earth_summary['median_velocity_difference_m_s']):.2f}}}
\\newcommand{{\\StandishEarthMaximumVelocityError}}{{{float(earth_summary['maximum_velocity_difference_m_s']):.2f}}}
\\newcommand{{\\StandishMarsMedianPositionError}}{{{float(mars_summary['median_position_difference_km']):.0f}}}
\\newcommand{{\\StandishMarsMaximumPositionError}}{{{float(mars_summary['maximum_position_difference_km']):.0f}}}
\\newcommand{{\\StandishMarsMedianVelocityError}}{{{float(mars_summary['median_velocity_difference_m_s']):.2f}}}
\\newcommand{{\\StandishMarsMaximumVelocityError}}{{{float(mars_summary['maximum_velocity_difference_m_s']):.2f}}}
\\newcommand{{\\OberthGainRatio}}{{{hohmann.oberth_energy_gain_ratio:.2f}}}
\\newcommand{{\\SolarGM}}{{{constants.mu_sun:.6f}}}
"""
    (TEX_OUTPUT_DIR / "results_macros.tex").write_text(macros, encoding="utf-8")

    labels = {
        "minimum_total_dv": "Minimum total $\\Delta v$",
        "minimum_c3": "Minimum launch $C_3$",
        "fast_within_0.5": "Fast (within 0.5 km/s)",
        "balanced_pareto": "Balanced Pareto design",
    }
    table_rows = []
    for _, row in candidates.iterrows():
        table_rows.append(
            f"{labels[str(row['design'])]} & "
            f"{timestamp_label(str(row['departure_datetime_utc']))} & "
            f"{timestamp_label(str(row['arrival_datetime_utc']))} & "
            f"{float(row['tof_days']):.1f} & "
            f"{float(row['c3_km2_s2']):.2f} & {float(row['arrival_vinf_km_s']):.2f} & "
            f"{float(row['total_patched_dv_km_s']):.3f} \\\\"
        )
    candidate_tex = (
        r"\begin{tabular}{p{0.20\textwidth}llrrrr}" "\n"
        r"\toprule" "\n"
        r"Design & Departure & Arrival & TOF [d] & $C_3$ & $v_{\infty,M}$ & Total $\Delta v$ \\" "\n"
        r"\midrule" "\n"
        + "\n".join(table_rows)
        + "\n" r"\bottomrule" "\n" r"\end{tabular}"
    )
    (TEX_OUTPUT_DIR / "candidate_rows.tex").write_text(candidate_tex, encoding="utf-8")

    convergence_rows = [
        f"{row['grid_label']} & {row['departure_date']} & {float(row['tof_days']):.2f} & "
        f"{float(row['total_patched_dv_km_s']):.6f} \\\\"
        for _, row in convergence.iterrows()
    ]
    convergence_tex = (
        r"\begin{tabular}{lrrr}" "\n"
        r"\toprule" "\n"
        r"Resolution & Departure [UTC] & TOF [d] & Total $\Delta v$ [km/s] \\" "\n"
        r"\midrule" "\n"
        + "\n".join(convergence_rows)
        + "\n" r"\bottomrule" "\n" r"\end{tabular}"
    )
    (TEX_OUTPUT_DIR / "convergence_rows.tex").write_text(convergence_tex, encoding="utf-8")

    model_rows = []
    for model, row in (
        ("Circular--coplanar", circular_minimum),
        ("JPL/Standish secular elements", standish_minimum),
        ("DE440s ephemeris", minimum),
    ):
        model_rows.append(
            f"{model} & {timestamp_label(str(row['departure_datetime_utc']))} & "
            f"{timestamp_label(str(row['arrival_datetime_utc']))} & {float(row['tof_days']):.2f} & "
            f"{float(row['c3_km2_s2']):.2f} & {float(row['total_patched_dv_km_s']):.3f} \\\\"
        )
    model_tex = (
        r"\begin{tabular}{lccrrr}" "\n"
        r"\toprule" "\n"
        r"Planetary-state model & Departure & Arrival & TOF [d] & $C_3$ & Total $\Delta v$ [km/s] \\" "\n"
        r"\midrule" "\n"
        + "\n".join(model_rows)
        + "\n" r"\bottomrule" "\n" r"\end{tabular}"
    )
    (TEX_OUTPUT_DIR / "model_comparison_rows.tex").write_text(model_tex, encoding="utf-8")

    threshold_rows = []
    for _, row in fast_sensitivity.iterrows():
        threshold_rows.append(
            f"{float(row['allowed_dv_above_minimum_km_s']):.2f} & "
            f"{timestamp_label(str(row['departure_datetime_utc']))} & "
            f"{timestamp_label(str(row['arrival_datetime_utc']))} & "
            f"{float(row['tof_days']):.0f} & {float(row['total_patched_dv_km_s']):.3f} \\\\"
        )
    threshold_tex = (
        r"\begin{tabular}{rccrr}" "\n"
        r"\toprule" "\n"
        r"Allowed excess [km/s] & Departure & Arrival & TOF [d] & Total $\Delta v$ [km/s] \\" "\n"
        r"\midrule" "\n"
        + "\n".join(threshold_rows)
        + "\n" r"\bottomrule" "\n" r"\end{tabular}"
    )
    (TEX_OUTPUT_DIR / "fast_threshold_rows.tex").write_text(threshold_tex, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quick", action="store_true", help="use a 4-day grid for a faster smoke test")
    args = parser.parse_args()
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    TEX_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for obsolete in OBSOLETE_OUTPUTS:
        obsolete.unlink(missing_ok=True)

    constants = load_spice()
    hohmann = hohmann_analysis(constants)
    pd.DataFrame([asdict(hohmann)]).to_csv(RESULTS_DIR / "ideal_hohmann.csv", index=False)
    step = 4 if args.quick else 2

    frame = run_porkchop_grid(
        constants,
        departure_start=WINDOW_DEPARTURE_START,
        departure_end=WINDOW_DEPARTURE_END,
        departure_step_days=step,
        tof_start_days=TOF_START_DAYS,
        tof_end_days=TOF_END_DAYS,
        tof_step_days=step,
    )
    frame.to_csv(RESULTS_DIR / "porkchop_grid.csv", index=False)
    candidates, frontier = select_candidates(frame)

    circular_frame = run_circular_coplanar_grid(
        constants,
        hohmann,
        departure_start=WINDOW_DEPARTURE_START,
        departure_end=WINDOW_DEPARTURE_END,
        departure_step_days=step,
        tof_start_days=TOF_START_DAYS,
        tof_end_days=TOF_END_DAYS,
        tof_step_days=step,
    )
    circular_frame.to_csv(RESULTS_DIR / "circular_coplanar_grid.csv", index=False)
    circular_candidates, _ = select_candidates(circular_frame)
    circular_candidates.to_csv(RESULTS_DIR / "circular_coplanar_candidates.csv", index=False)

    standish_frame = run_standish_grid(
        constants,
        departure_start=WINDOW_DEPARTURE_START,
        departure_end=WINDOW_DEPARTURE_END,
        departure_step_days=step,
        tof_start_days=TOF_START_DAYS,
        tof_end_days=TOF_END_DAYS,
        tof_step_days=step,
    )
    standish_frame.to_csv(RESULTS_DIR / "standish_grid.csv", index=False)
    standish_candidates, _ = select_candidates(standish_frame)
    standish_coarse = standish_candidates[standish_candidates["design"] == "minimum_total_dv"].iloc[0]
    standish_minimum, standish_refinement = refine_candidate_with_evaluator(
        standish_coarse,
        lambda departure, tof: standish_mission_metrics(departure, tof, constants),
        objective_metric="total_patched_dv_km_s",
    )
    standish_refinement.to_csv(RESULTS_DIR / "standish_minimum_dv_refinement.csv", index=False)

    coarse_min = candidates[candidates["design"] == "minimum_total_dv"].iloc[0]
    refined_min, refinement = refine_candidate(
        coarse_min, constants, objective_metric="total_patched_dv_km_s"
    )
    replacement = refined_min.to_dict()
    replacement["design"] = "minimum_total_dv"
    coarse_min_c3 = candidates[candidates["design"] == "minimum_c3"].iloc[0]
    refined_min_c3, c3_refinement = refine_candidate(
        coarse_min_c3, constants, objective_metric="c3_km2_s2"
    )
    replacement_c3 = refined_min_c3.to_dict()
    replacement_c3["design"] = "minimum_c3"
    keep = candidates[~candidates["design"].isin(["minimum_total_dv", "minimum_c3"])].copy()
    candidates = pd.concat([pd.DataFrame([replacement, replacement_c3]), keep], ignore_index=True)
    order = ["minimum_total_dv", "minimum_c3", "fast_within_0.5", "balanced_pareto"]
    candidates["_order"] = candidates["design"].map({name: index for index, name in enumerate(order)})
    candidates = candidates.sort_values("_order").drop(columns="_order")
    candidates.to_csv(RESULTS_DIR / "candidate_missions.csv", index=False)
    frontier.to_csv(RESULTS_DIR / "pareto_front.csv", index=False)
    refinement.to_csv(RESULTS_DIR / "minimum_dv_refinement.csv", index=False)
    c3_refinement.to_csv(RESULTS_DIR / "minimum_c3_refinement.csv", index=False)

    minimum = candidates[candidates["design"] == "minimum_total_dv"].iloc[0]
    circular_minimum = circular_candidates[circular_candidates["design"] == "minimum_total_dv"].iloc[0]
    comparison_rows = []
    for model_name, row in (
        ("phase_anchored_circular_coplanar", circular_minimum),
        ("standish_secular_elements", standish_minimum),
        ("de440s_ephemeris", minimum),
    ):
        comparison_rows.append(
            {
                "model": model_name,
                "departure_datetime_utc": row["departure_datetime_utc"],
                "arrival_datetime_utc": row["arrival_datetime_utc"],
                "tof_days": row["tof_days"],
                "c3_km2_s2": row["c3_km2_s2"],
                "arrival_vinf_km_s": row["arrival_vinf_km_s"],
                "total_patched_dv_km_s": row["total_patched_dv_km_s"],
            }
        )
    model_comparison = pd.DataFrame(comparison_rows)
    model_comparison.to_csv(RESULTS_DIR / "model_comparison_minima.csv", index=False)

    state_end = WINDOW_DEPARTURE_END + timedelta(days=TOF_END_DAYS)
    standish_differences, standish_summary = compare_standish_with_de440s(
        constants, start=WINDOW_DEPARTURE_START, end=state_end, step_days=step
    )
    standish_differences.to_csv(RESULTS_DIR / "standish_de440s_state_differences.csv", index=False)
    standish_summary.to_csv(RESULTS_DIR / "standish_de440s_state_summary.csv", index=False)

    fast_sensitivity = fast_threshold_sensitivity(frame)
    fast_sensitivity.to_csv(RESULTS_DIR / "fast_threshold_sensitivity.csv", index=False)

    validation, integration_t, integration_y = propagation_validation(minimum, constants)
    stability_frames = []
    for design_name, row in (
        ("minimum_c3", candidates[candidates["design"] == "minimum_c3"].iloc[0]),
        ("minimum_total_dv", minimum),
    ):
        local = local_date_stability(row, constants)
        local.insert(0, "reference_design", design_name)
        stability_frames.append(local)
    stability = pd.concat(stability_frames, ignore_index=True)
    stability.to_csv(RESULTS_DIR / "optimal_solution_stability.csv", index=False)

    departure_offsets = (
        pd.to_datetime(frame["departure_date"]) - pd.Timestamp(WINDOW_DEPARTURE_START)
    ).dt.days
    coarse4 = frame[(departure_offsets % 4 == 0) & (frame["tof_days"] % 4 == 0)]
    if coarse4.empty:
        coarse4 = frame
    row4 = coarse4.loc[coarse4["total_patched_dv_km_s"].idxmin()]
    row_primary = frame.loc[frame["total_patched_dv_km_s"].idxmin()]
    convergence = pd.DataFrame(
        [
            {
                "grid_label": "4-day subsample",
                "departure_date": row4["departure_date"],
                "tof_days": row4["tof_days"],
                "total_patched_dv_km_s": row4["total_patched_dv_km_s"],
            },
            {
                "grid_label": f"{step}-day production grid",
                "departure_date": row_primary["departure_date"],
                "tof_days": row_primary["tof_days"],
                "total_patched_dv_km_s": row_primary["total_patched_dv_km_s"],
            },
            {
                "grid_label": "local 0.25-day refinement",
                "departure_date": minimum["departure_date"],
                "tof_days": minimum["tof_days"],
                "total_patched_dv_km_s": minimum["total_patched_dv_km_s"],
            },
        ]
    )
    convergence.to_csv(RESULTS_DIR / "grid_convergence.csv", index=False)

    make_porkchop_figure(frame, candidates)
    make_circular_coplanar_porkchop_figure(circular_frame, circular_candidates)
    make_standish_difference_figure(standish_differences)
    make_pareto_figure(frame, frontier, candidates)
    make_solution_stability_figure(stability)
    make_transfer_trajectory_figure(minimum, constants, integration_t, integration_y)

    write_tex_outputs(
        constants,
        hohmann,
        candidates,
        circular_minimum,
        standish_minimum,
        validation,
        convergence,
        stability,
        standish_summary,
        fast_sensitivity,
    )

    summary = {
        "run_timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "software": {
            "python": sys.version.split()[0],
            "numpy": version("numpy"),
            "pandas": version("pandas"),
            "scipy": version("scipy"),
            "matplotlib": version("matplotlib"),
            "spiceypy": version("spiceypy"),
        },
        "methods": {
            "lambert": "universal-variable Lagrange f-g with scipy.optimize.brentq",
            "trajectory_validation": "scipy.integrate.solve_ivp DOP853",
            "standish": "JPL 1800--2050 secular Keplerian elements; central-difference velocity",
            "pareto": (
                "strict nondominance in time of flight and total patched delta-v "
                f"within the declared v-infinity analysis domain below "
                f"{CANDIDATE_VINF_LIMIT_KM_S:.0f} km/s at both endpoints"
            ),
        },
        "grid": {
            "departure_start_utc": WINDOW_DEPARTURE_START.isoformat(),
            "departure_end_utc": WINDOW_DEPARTURE_END.isoformat(),
            "departure_step_days": step,
            "tof_start_days": TOF_START_DAYS,
            "tof_end_days": TOF_END_DAYS,
            "tof_step_days": step,
            "successful_cases": int(len(frame)),
            "local_refinement_step_days": 0.25,
        },
        "model_scope": {
            "ephemeris": "NASA/JPL DE440s geometric states",
            "frame": "ECLIPJ2000",
            "observer": "SUN",
            "aberration_correction": "NONE",
            "departure_target": "EARTH",
            "arrival_target": "MARS BARYCENTER",
            "time_conversion": "UTC input converted by SPICE to ET/TDB",
            "transfer": "zero-revolution prograde heliocentric two-body Lambert",
            "departure": f"patched-conic injection from {LEO_ALTITUDE_KM:.0f} km circular LEO",
            "arrival": f"patched-conic capture into {LMO_ALTITUDE_KM:.0f} km circular LMO",
            "candidate_domain": (
                f"departure and arrival hyperbolic excess speeds below "
                f"{CANDIDATE_VINF_LIMIT_KM_S:.0f} km/s"
            ),
        },
        "constants": asdict(constants),
        "kernels": {
            path.name: {
                "sha256": sha256(path),
                "bytes": path.stat().st_size,
            }
            for path in KERNELS
        },
        "hohmann": asdict(hohmann),
        "candidate_missions": candidates.to_dict(orient="records"),
        "model_comparison_minima": model_comparison.to_dict(orient="records"),
        "standish_state_summary": standish_summary.to_dict(orient="records"),
        "fast_threshold_sensitivity": fast_sensitivity.to_dict(orient="records"),
        "validation": validation,
        "grid_convergence": convergence.to_dict(orient="records"),
        "outputs": {
            "tables": [str(path.relative_to(ROOT)) for path in RESULTS_DIR.glob("*.csv")],
            "figures": [str(path.relative_to(ROOT)) for path in FIGURES_DIR.glob("*.png")],
            "tex": [str(path.relative_to(ROOT)) for path in TEX_OUTPUT_DIR.glob("*.tex")],
        },
        "random_seed": None,
    }
    (RESULTS_DIR / "analysis_summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False, default=str), encoding="utf-8"
    )
    print(json.dumps(summary["model_comparison_minima"], indent=2))
    print(json.dumps(validation, indent=2))
    spice.kclear()


if __name__ == "__main__":
    main()
