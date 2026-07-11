#!/usr/bin/env python3
"""Generate the historical gravity-assist mission comparison figure and data."""

from __future__ import annotations

import csv
import math
from datetime import datetime
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
EVENTS_FILE = ROOT / "data" / "input" / "q4" / "historical_flyby_events.csv"
PLANETS_FILE = ROOT / "data" / "input" / "q4" / "planetary_constants.csv"
REFERENCE_FILE = ROOT / "data" / "input" / "q4" / "reference_constants.csv"
OUTPUT_DIR = ROOT / "data" / "output" / "q4"
FIGURES_DIR = ROOT / "figures"

PLANET_COLORS = {
    "MERCURY": {"fill": "#8C7853", "edge": "#5A4A35"},
    "VENUS": {"fill": "#E3BB76", "edge": "#A68550"},
    "EARTH": {"fill": "#6B93D6", "edge": "#4A6BA0"},
    "MARS": {"fill": "#C1440E", "edge": "#8A3008"},
    "JUPITER": {"fill": "#D8CA9D", "edge": "#A6906A"},
    "SATURN": {"fill": "#F4D59E", "edge": "#C4A060"},
    "URANUS": {"fill": "#D1E7E7", "edge": "#8AA8A8"},
    "NEPTUNE": {"fill": "#5B5DDF", "edge": "#3A3A9F"},
}


def load_events(path: Path) -> list[dict[str, str | float | datetime]]:
    events: list[dict[str, str | float | datetime]] = []
    with path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            events.append(
                {
                    "event_id": row["event_id"],
                    "mission": row["mission"],
                    "date": datetime.fromisoformat(row["date_utc"]),
                    "planet": row["planet"],
                    "altitude_km": float(row["altitude_km"]),
                    "v_infinity_km_s": float(row["v_infinity_km_s"]),
                    "source_url": row["source_url"],
                }
            )
    return events


def load_planetary_constants(path: Path) -> dict[str, dict[str, float]]:
    constants: dict[str, dict[str, float]] = {}
    with path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            constants[row["planet"]] = {
                "mu_km3_s2": float(row["mu_km3_s2"]),
                "equatorial_radius_km": float(row["equatorial_radius_km"]),
                "semimajor_axis_au": float(row["semimajor_axis_au"]),
            }
    return constants


def load_reference_constants(path: Path) -> dict[str, float]:
    values: dict[str, float] = {}
    with path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            values[row["parameter"]] = float(row["value"])
    return values


def calculate_flyby_parameters(v_infinity: float, periapsis_radius: float, planet_mu: float) -> dict[str, float]:
    semimajor_axis = -planet_mu / v_infinity**2
    eccentricity = 1.0 + periapsis_radius * v_infinity**2 / planet_mu
    turning_angle = 2.0 * math.asin(1.0 / eccentricity) if eccentricity > 1.0 else 0.0
    delta_v = 2.0 * v_infinity * math.sin(turning_angle / 2.0)
    return {
        "semimajor_axis_km": semimajor_axis,
        "eccentricity": eccentricity,
        "turning_angle_deg": math.degrees(turning_angle),
        "delta_v_km_s": delta_v,
    }


def generate_mission_data() -> list[dict[str, str | float]]:
    events = load_events(EVENTS_FILE)
    planets = load_planetary_constants(PLANETS_FILE)
    reference = load_reference_constants(REFERENCE_FILE)
    mu_sun = reference["solar_gravitational_parameter"]
    au_km = reference["astronomical_unit"]
    approach_angle_deg = reference["historical_comparison_approach_angle"]
    approach_angle = math.radians(approach_angle_deg)

    results: list[dict[str, str | float]] = []
    for event in events:
        planet_name = str(event["planet"])
        planet = planets[planet_name]
        altitude = float(event["altitude_km"])
        v_infinity = float(event["v_infinity_km_s"])
        periapsis_radius = planet["equatorial_radius_km"] + altitude
        flyby = calculate_flyby_parameters(v_infinity, periapsis_radius, planet["mu_km3_s2"])

        planet_speed = math.sqrt(mu_sun / (planet["semimajor_axis_au"] * au_km))
        planet_velocity_direction = np.array([1.0, 0.0, 0.0])
        perpendicular_direction = np.array([0.0, 0.0, 1.0])
        incoming = v_infinity * (
            math.cos(approach_angle) * planet_velocity_direction
            + math.sin(approach_angle) * perpendicular_direction
        )
        turning_angle = math.radians(flyby["turning_angle_deg"])
        outgoing = v_infinity * (
            incoming / v_infinity * math.cos(turning_angle)
            + np.cross([0.0, 0.0, 1.0], incoming / v_infinity) * math.sin(turning_angle)
        )
        planet_velocity = planet_velocity_direction * planet_speed
        heliocentric_before = planet_velocity + incoming
        heliocentric_after = planet_velocity + outgoing
        heliocentric_before_speed = float(np.linalg.norm(heliocentric_before))
        heliocentric_after_speed = float(np.linalg.norm(heliocentric_after))
        displayed_delta_v = float(np.linalg.norm(heliocentric_after - heliocentric_before))
        specific_energy_change = 0.5 * (heliocentric_after_speed**2 - heliocentric_before_speed**2)

        results.append(
            {
                "event_id": str(event["event_id"]),
                "mission": str(event["mission"]),
                "planet": planet_name,
                "date_utc": event["date"].strftime("%Y-%m-%d"),
                "altitude_km": altitude,
                "periapsis_radius_km": periapsis_radius,
                "v_infinity_km_s": v_infinity,
                "turning_angle_deg": flyby["turning_angle_deg"],
                "delta_v_km_s": displayed_delta_v,
                "maximum_delta_v_km_s": flyby["delta_v_km_s"],
                "heliocentric_speed_before_km_s": heliocentric_before_speed,
                "heliocentric_speed_after_km_s": heliocentric_after_speed,
                "specific_energy_change_km2_s2": specific_energy_change,
                "hyperbolic_eccentricity": flyby["eccentricity"],
                "approach_angle_deg": approach_angle_deg,
                "source_url": str(event["source_url"]),
            }
        )
    return results


def plot_comparison(missions: list[dict[str, str | float]]) -> Path:
    fig, axes = plt.subplots(2, 2, figsize=(14, 12))
    fig.suptitle("Historical Gravity Assist Mission Comparison", fontsize=16, fontweight="bold")

    planets_order = ["VENUS", "EARTH", "MARS", "JUPITER", "SATURN", "URANUS", "NEPTUNE"]
    planet_y = {planet: index for index, planet in enumerate(planets_order)}
    ax1 = axes[0, 0]
    for mission in missions:
        planet = str(mission["planet"])
        if planet not in planet_y:
            continue
        year = datetime.fromisoformat(str(mission["date_utc"])).year
        colors = PLANET_COLORS.get(planet, {"fill": "#888888", "edge": "#666666"})
        ax1.add_patch(
            plt.Circle(
                (year, planet_y[planet]),
                0.3,
                facecolor=colors["fill"],
                edgecolor=colors["edge"],
                linewidth=1.5,
            )
        )
    ax1.set_xlabel("Year", fontsize=11)
    ax1.set_ylabel("Planet", fontsize=11)
    ax1.set_yticks(range(len(planets_order)))
    ax1.set_yticklabels(planets_order, fontsize=9)
    ax1.set_title("Mission Timeline", fontsize=12, fontweight="bold")
    ax1.grid(True, alpha=0.2, axis="x")
    ax1.set_xlim(1978, 2014)
    ax1.set_ylim(-0.5, 6.5)

    displayed = missions[:10]
    labels = [str(item["event_id"]).replace("_", " ") for item in displayed]
    delta_v_values = [float(item["delta_v_km_s"]) for item in displayed]
    colors = [PLANET_COLORS.get(str(item["planet"]), {"fill": "#888888"})["fill"] for item in displayed]

    ax2 = axes[0, 1]
    bars = ax2.barh(range(len(labels)), delta_v_values, color=colors, edgecolor="black", linewidth=1.5)
    ax2.set_yticks(range(len(labels)))
    ax2.set_yticklabels(labels, fontsize=8)
    ax2.set_xlabel(r"$\Delta v$ [km/s]", fontsize=11)
    ax2.set_title(r"Velocity Change $\Delta v$", fontsize=12, fontweight="bold")
    ax2.grid(True, alpha=0.2, axis="x")
    for bar, value in zip(bars, delta_v_values):
        ax2.text(value + 0.2, bar.get_y() + bar.get_height() / 2.0, f"{value:.2f}", va="center", fontsize=8)

    turning_angles = [float(item["turning_angle_deg"]) for item in displayed]
    ax3 = axes[1, 0]
    bars = ax3.barh(range(len(labels)), turning_angles, color=colors, edgecolor="black", linewidth=1.5)
    ax3.set_yticks(range(len(labels)))
    ax3.set_yticklabels(labels, fontsize=8)
    ax3.set_xlabel(r"Deflection angle $\delta$ [°]", fontsize=11)
    ax3.set_title(r"Deflection Angle $\delta$", fontsize=12, fontweight="bold")
    ax3.grid(True, alpha=0.2, axis="x")
    for bar, value in zip(bars, turning_angles):
        ax3.text(value + 2.0, bar.get_y() + bar.get_height() / 2.0, f"{value:.1f}", va="center", fontsize=8)

    ax4 = axes[1, 1]
    for planet in planets_order:
        subset = [item for item in missions if item["planet"] == planet]
        if not subset:
            continue
        planet_color = PLANET_COLORS.get(planet, {"fill": "#888888", "edge": "#666666"})
        ax4.scatter(
            [float(item["turning_angle_deg"]) for item in subset],
            [float(item["delta_v_km_s"]) for item in subset],
            s=150,
            facecolor=planet_color["fill"],
            edgecolor=planet_color["edge"],
            linewidth=2,
            label=planet,
            zorder=3,
        )
    ax4.set_xlabel(r"Deflection angle $\delta$ [°]", fontsize=11)
    ax4.set_ylabel(r"$\Delta v$ [km/s]", fontsize=11)
    ax4.set_title(r"$\Delta v$ vs $\delta$ by Planet", fontsize=12, fontweight="bold")
    ax4.legend(loc="best", fontsize=8)
    ax4.grid(True, alpha=0.2)

    fig.tight_layout()
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    figure_path = FIGURES_DIR / "historical_mission_comparison.png"
    fig.savefig(figure_path, bbox_inches="tight", dpi=300)
    plt.close(fig)
    return figure_path


def write_output(missions: list[dict[str, str | float]]) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / "historical_flyby_results.csv"
    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(missions[0]))
        writer.writeheader()
        writer.writerows(missions)
    return output_path


def main() -> None:
    missions = generate_mission_data()
    figure_path = plot_comparison(missions)
    output_path = write_output(missions)
    print(f"Saved: {figure_path}")
    print(f"Saved: {output_path}")


if __name__ == "__main__":
    main()
