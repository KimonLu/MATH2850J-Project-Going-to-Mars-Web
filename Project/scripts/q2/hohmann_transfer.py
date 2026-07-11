#!/usr/bin/env python3
"""Generate the ideal circular-coplanar Earth-to-Mars Hohmann-transfer figure."""

from __future__ import annotations

import csv
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
INPUT_FILE = ROOT / "data" / "input" / "q2" / "hohmann_parameters.csv"
OUTPUT_DIR = ROOT / "data" / "output" / "q2"
FIGURES_DIR = ROOT / "figures"


def load_parameters(path: Path) -> dict[str, float]:
    values: dict[str, float] = {}
    with path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            values[row["parameter"]] = float(row["value"])
    return values


def calculate_hohmann_values(parameters: dict[str, float]) -> dict[str, float]:
    r1_au = parameters["earth_circular_radius_au"]
    r2_au = parameters["mars_circular_radius_au"]
    au_km = parameters["astronomical_unit"]
    mu_sun = parameters["solar_gravitational_parameter"]

    r1_km = r1_au * au_km
    r2_km = r2_au * au_km
    transfer_a_km = 0.5 * (r1_km + r2_km)
    transfer_a_au = 0.5 * (r1_au + r2_au)
    transfer_e = (r2_km - r1_km) / (r2_km + r1_km)

    earth_speed = math.sqrt(mu_sun / r1_km)
    mars_speed = math.sqrt(mu_sun / r2_km)
    transfer_departure_speed = math.sqrt(mu_sun * (2.0 / r1_km - 1.0 / transfer_a_km))
    transfer_arrival_speed = math.sqrt(mu_sun * (2.0 / r2_km - 1.0 / transfer_a_km))
    departure_delta_v = transfer_departure_speed - earth_speed
    arrival_delta_v = mars_speed - transfer_arrival_speed
    time_of_flight_days = math.pi * math.sqrt(transfer_a_km**3 / mu_sun) / 86400.0
    mars_mean_motion = math.sqrt(mu_sun / r2_km**3)
    phase_angle_deg = math.degrees(math.pi - mars_mean_motion * time_of_flight_days * 86400.0)

    return {
        "earth_radius_au": r1_au,
        "mars_radius_au": r2_au,
        "transfer_semimajor_axis_au": transfer_a_au,
        "transfer_eccentricity": transfer_e,
        "earth_circular_speed_km_s": earth_speed,
        "mars_circular_speed_km_s": mars_speed,
        "transfer_departure_speed_km_s": transfer_departure_speed,
        "transfer_arrival_speed_km_s": transfer_arrival_speed,
        "departure_delta_v_km_s": departure_delta_v,
        "arrival_delta_v_km_s": arrival_delta_v,
        "total_heliocentric_delta_v_km_s": departure_delta_v + arrival_delta_v,
        "time_of_flight_days": time_of_flight_days,
        "required_phase_angle_deg": phase_angle_deg,
    }


def plot_hohmann_transfer(values: dict[str, float]) -> Path:
    r1 = values["earth_radius_au"]
    r2 = values["mars_radius_au"]
    a = values["transfer_semimajor_axis_au"]
    e = values["transfer_eccentricity"]

    theta = np.linspace(0.0, 2.0 * math.pi, 900)
    transfer_theta = np.linspace(0.0, math.pi, 600)
    transfer_r = a * (1.0 - e**2) / (1.0 + e * np.cos(transfer_theta))

    fig, ax = plt.subplots(figsize=(7.2, 6.0))
    ax.plot(r1 * np.cos(theta), r1 * np.sin(theta), color="#2C7FB8", label="Earth orbit")
    ax.plot(r2 * np.cos(theta), r2 * np.sin(theta), color="#C43C39", label="Mars orbit")
    ax.plot(
        transfer_r * np.cos(transfer_theta),
        transfer_r * np.sin(transfer_theta),
        color="#6A3D9A",
        linewidth=2.5,
        label="Hohmann half-ellipse",
    )
    ax.scatter([0.0], [0.0], s=180, color="#FDB813", edgecolor="#8A5A00", zorder=6)
    ax.scatter([r1], [0.0], s=70, color="#2C7FB8", zorder=6)
    ax.scatter([-r2], [0.0], s=70, color="#C43C39", zorder=6)
    ax.annotate(
        f"$\\Delta v_1={values['departure_delta_v_km_s']:.2f}$ km/s",
        (r1, 0.0),
        xytext=(16, 22),
        textcoords="offset points",
    )
    ax.annotate(
        f"$\\Delta v_2={values['arrival_delta_v_km_s']:.2f}$ km/s",
        (-r2, 0.0),
        xytext=(14, -34),
        textcoords="offset points",
    )
    ax.text(
        0.02,
        0.02,
        f"TOF = {values['time_of_flight_days']:.1f} d\n"
        f"required phase = {values['required_phase_angle_deg']:.1f} deg",
        transform=ax.transAxes,
        bbox={"boxstyle": "round,pad=0.35", "facecolor": "white", "alpha": 0.9},
    )
    ax.set_aspect("equal", adjustable="box")
    ax.set_xlabel("ecliptic $x$ [AU]")
    ax.set_ylabel("ecliptic $y$ [AU]")
    ax.set_title("Ideal circular-coplanar Earth-to-Mars Hohmann transfer")
    ax.legend(frameon=False, loc="upper right")
    fig.tight_layout()

    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    figure_path = FIGURES_DIR / "hohmann_transfer.png"
    fig.savefig(figure_path, dpi=300)
    plt.close(fig)
    return figure_path


def write_output(values: dict[str, float]) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / "hohmann_transfer_values.csv"
    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(values))
        writer.writeheader()
        writer.writerow(values)
    return output_path


def main() -> None:
    parameters = load_parameters(INPUT_FILE)
    values = calculate_hohmann_values(parameters)
    figure_path = plot_hohmann_transfer(values)
    output_path = write_output(values)
    print(f"Saved: {figure_path}")
    print(f"Saved: {output_path}")


if __name__ == "__main__":
    main()
