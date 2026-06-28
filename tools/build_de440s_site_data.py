"""Build static DE440s data used by the GitHub Pages visualisation."""

from __future__ import annotations

import json
import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / "q1_q3_final"
SITE = ROOT / "MATH2850J-Project-Going-to-Mars-Web"
sys.path.insert(0, str(REPORT / "scripts"))

import run_de440s_lambert_porkchop as report  # noqa: E402


WINDOWS = [
    {
        "id": "2026-2027",
        "label_zh": "2026-2027 窗口",
        "label_en": "2026-2027 window",
        "start": date(2026, 7, 1),
        "end": date(2027, 6, 30),
        "departure_step_days": 2,
        "tof_step_days": 2,
        "source": "report_grid",
    },
    {
        "id": "2028-2029",
        "label_zh": "2028-2029 窗口",
        "label_en": "2028-2029 window",
        "start": date(2028, 8, 1),
        "end": date(2029, 7, 31),
        "departure_step_days": 4,
        "tof_step_days": 4,
        "source": "generated_grid",
    },
    {
        "id": "2030-2031",
        "label_zh": "2030-2031 窗口",
        "label_en": "2030-2031 window",
        "start": date(2030, 10, 1),
        "end": date(2031, 9, 30),
        "departure_step_days": 4,
        "tof_step_days": 4,
        "source": "generated_grid",
    },
    {
        "id": "2033-2034",
        "label_zh": "2033-2034 窗口",
        "label_en": "2033-2034 window",
        "start": date(2033, 1, 1),
        "end": date(2033, 12, 31),
        "departure_step_days": 4,
        "tof_step_days": 4,
        "source": "generated_grid",
    },
    {
        "id": "2035-2036",
        "label_zh": "2035-2036 窗口",
        "label_en": "2035-2036 window",
        "start": date(2035, 3, 1),
        "end": date(2036, 2, 29),
        "departure_step_days": 4,
        "tof_step_days": 4,
        "source": "generated_grid",
    },
]

KEEP_COLUMNS = [
    "departure_datetime_utc",
    "departure_date",
    "arrival_datetime_utc",
    "arrival_date",
    "tof_days",
    "c3_km2_s2",
    "departure_vinf_km_s",
    "arrival_vinf_km_s",
    "leo_departure_dv_km_s",
    "lmo_capture_dv_km_s",
    "total_patched_dv_km_s",
    "transfer_angle_deg",
    "transfer_plane_inclination_deg",
]


def jd_from_date(day: date) -> float:
    y, m = day.year, day.month
    d = day.day
    if m <= 2:
        y -= 1
        m += 12
    a = y // 100
    b = 2 - a + a // 4
    return int(365.25 * (y + 4716)) + int(30.6001 * (m + 1)) + d + b - 1524.5


def clean_record(row: pd.Series) -> dict[str, float | str]:
    out: dict[str, float | str] = {}
    for key in KEEP_COLUMNS:
        value = row[key]
        if isinstance(value, np.generic):
            value = value.item()
        if isinstance(value, float):
            out[key] = round(value, 6)
        else:
            out[key] = str(value)
    return out


def load_window_frame(constants: report.PhysicalConstants, spec: dict) -> tuple[pd.DataFrame, pd.DataFrame]:
    if spec["source"] == "report_grid":
        frame = pd.read_csv(REPORT / "data" / "output" / "porkchop_grid.csv")
        candidates = pd.read_csv(REPORT / "data" / "output" / "candidate_missions.csv")
        return frame, candidates

    frame = report.run_porkchop_grid(
        constants,
        departure_start=spec["start"],
        departure_end=spec["end"],
        departure_step_days=spec["departure_step_days"],
        tof_start_days=140,
        tof_end_days=360,
        tof_step_days=spec["tof_step_days"],
    )
    candidates, _ = report.select_candidates(frame)
    return frame, candidates


def build_window_payload(constants: report.PhysicalConstants, spec: dict) -> dict:
    frame, candidates = load_window_frame(constants, spec)
    frame = frame.sort_values(["departure_date", "tof_days"]).reset_index(drop=True)
    dep_dates = sorted(frame["departure_date"].unique().tolist())
    tof_days = sorted(float(v) for v in frame["tof_days"].unique().tolist())
    dep_index = {value: i for i, value in enumerate(dep_dates)}
    tof_index = {value: i for i, value in enumerate(tof_days)}

    rows = []
    for _, row in frame.iterrows():
        rows.append(
            [
                dep_index[str(row["departure_date"])],
                tof_index[float(row["tof_days"])],
                round(float(row["c3_km2_s2"]), 4),
                round(float(row["departure_vinf_km_s"]), 4),
                round(float(row["arrival_vinf_km_s"]), 4),
                round(float(row["leo_departure_dv_km_s"]), 4),
                round(float(row["lmo_capture_dv_km_s"]), 4),
                round(float(row["total_patched_dv_km_s"]), 4),
                round(float(row["transfer_angle_deg"]), 4),
                round(float(row["transfer_plane_inclination_deg"]), 4),
            ]
        )

    cand = {}
    for _, row in candidates.iterrows():
        cand[str(row["design"])] = clean_record(row)

    return {
        "id": spec["id"],
        "labelZh": spec["label_zh"],
        "labelEn": spec["label_en"],
        "departureStart": spec["start"].isoformat(),
        "departureEnd": spec["end"].isoformat(),
        "departureStepDays": spec["departure_step_days"],
        "tofStartDays": 140,
        "tofEndDays": 360,
        "tofStepDays": spec["tof_step_days"],
        "depDates": dep_dates,
        "tofDays": tof_days,
        "columns": [
            "depIndex",
            "tofIndex",
            "c3",
            "vinfE",
            "vinfM",
            "leoDv",
            "lmoDv",
            "totalDv",
            "transferAngle",
            "inclination",
        ],
        "rows": rows,
        "candidates": cand,
        "caseCount": len(rows),
    }


def build_ephemeris(constants: report.PhysicalConstants) -> dict:
    start = min(w["start"] for w in WINDOWS) - timedelta(days=30)
    end = max(w["end"] for w in WINDOWS) + timedelta(days=430)
    sample_days = (end - start).days
    earth = []
    mars = []
    for offset in range(sample_days + 1):
        day = start + timedelta(days=offset)
        et = report.utc_midnight_et(day)
        earth_state, _ = report.spice.spkezr("EARTH", et, "ECLIPJ2000", "NONE", "SUN")
        mars_state, _ = report.spice.spkezr("MARS BARYCENTER", et, "ECLIPJ2000", "NONE", "SUN")
        for state, target in [(earth_state, earth), (mars_state, mars)]:
            state = np.asarray(state, dtype=float)
            target.append(
                [
                    round(float(state[0] / constants.au), 9),
                    round(float(state[1] / constants.au), 9),
                    round(float(state[2] / constants.au), 9),
                    round(float(state[3]), 7),
                    round(float(state[4]), 7),
                    round(float(state[5]), 7),
                ]
            )
    return {
        "jd0": jd_from_date(start),
        "stepDays": 1,
        "units": {"position": "AU", "velocity": "km/s"},
        "earth": earth,
        "mars": mars,
    }


def main() -> None:
    constants = report.load_spice()
    windows = [build_window_payload(constants, spec) for spec in WINDOWS]
    payload = {
        "model": {
            "ephemeris": "NASA/JPL DE440s geometric states",
            "frame": "ECLIPJ2000",
            "transfer": "zero-revolution prograde heliocentric two-body Lambert",
            "departure": "patched-conic impulsive injection from 200 km circular LEO",
            "arrival": "patched-conic impulsive capture into 250 km circular LMO",
        },
        "constants": {
            "muSunM3S2": constants.mu_sun * 1e9,
            "muEarthM3S2": constants.mu_earth * 1e9,
            "muMarsM3S2": constants.mu_mars * 1e9,
            "radiusEarthM": constants.radius_earth * 1000,
            "radiusMarsM": constants.radius_mars * 1000,
            "auM": constants.au * 1000,
        },
        "windows": windows,
        "ephemeris": build_ephemeris(constants),
    }
    target = SITE / "js" / "de440s_data.js"
    text = "window.MarsDE440sData = "
    text += json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    text += ";\n"
    target.write_text(text, encoding="utf-8")
    print(f"wrote {target} ({target.stat().st_size / 1024:.1f} KiB)")


if __name__ == "__main__":
    main()
