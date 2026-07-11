#!/usr/bin/env python3
"""Generate the Jupiter flyby sensitivity figure and numerical grid."""

from __future__ import annotations

import csv
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
PLANETS_FILE = ROOT / "data" / "input" / "q4" / "planetary_constants.csv"
OUTPUT_DIR = ROOT / "data" / "output" / "q4"
FIGURES_DIR = ROOT / "figures"


def load_jupiter_constants(path: Path) -> tuple[float, float]:
    with path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if row["planet"] == "JUPITER":
                return float(row["mu_km3_s2"]), float(row["equatorial_radius_km"])
    raise ValueError("Jupiter constants were not found in planetary_constants.csv")


def calculate_flyby_parameters(v_infinity: float, periapsis_radius: float, planet_mu: float) -> dict[str, float]:
    semimajor_axis = -planet_mu / v_infinity**2
    eccentricity = 1.0 + periapsis_radius * v_infinity**2 / planet_mu
    turning_angle = 2.0 * math.asin(1.0 / eccentricity) if eccentricity > 1.0 else 0.0
    maximum_delta_v = 2.0 * v_infinity * math.sin(turning_angle / 2.0)
    return {
        "semimajor_axis_km": semimajor_axis,
        "eccentricity": eccentricity,
        "turning_angle_deg": math.degrees(turning_angle),
        "maximum_delta_v_km_s": maximum_delta_v,
    }


def generate_grid(jupiter_mu: float, jupiter_radius: float) -> list[dict[str, float]]:
    v_infinity_values = np.linspace(5.0, 20.0, 100)
    periapsis_values = np.linspace(jupiter_radius + 100000.0, jupiter_radius + 5000000.0, 100)
    rows: list[dict[str, float]] = []
    for v_infinity in v_infinity_values:
        for periapsis_radius in periapsis_values:
            values = calculate_flyby_parameters(v_infinity, periapsis_radius, jupiter_mu)
            rows.append(
                {
                    "v_infinity_km_s": float(v_infinity),
                    "periapsis_radius_km": float(periapsis_radius),
                    "altitude_km": float(periapsis_radius - jupiter_radius),
                    "semimajor_axis_km": values["semimajor_axis_km"],
                    "hyperbolic_eccentricity": values["eccentricity"],
                    "turning_angle_deg": values["turning_angle_deg"],
                    "maximum_delta_v_km_s": values["maximum_delta_v_km_s"],
                }
            )
    return rows


def plot_sensitivity(rows: list[dict[str, float]]) -> Path:
    v_values = np.unique([row["v_infinity_km_s"] for row in rows])
    periapsis_values = np.unique([row["periapsis_radius_km"] for row in rows])
    x_grid, y_grid = np.meshgrid(v_values, periapsis_values)
    turning_grid = np.zeros_like(x_grid)
    delta_v_grid = np.zeros_like(x_grid)
    eccentricity_grid = np.zeros_like(x_grid)

    v_index = {value: index for index, value in enumerate(v_values)}
    periapsis_index = {value: index for index, value in enumerate(periapsis_values)}
    for row in rows:
        i = periapsis_index[row["periapsis_radius_km"]]
        j = v_index[row["v_infinity_km_s"]]
        turning_grid[i, j] = row["turning_angle_deg"]
        delta_v_grid[i, j] = row["maximum_delta_v_km_s"]
        eccentricity_grid[i, j] = row["hyperbolic_eccentricity"]

    fig, axes = plt.subplots(2, 2, figsize=(14, 12))
    fig.suptitle("Jupiter Fly-by Sensitivity Analysis", fontsize=16, fontweight="bold")

    ax1 = axes[0, 0]
    contour1 = ax1.contourf(x_grid, y_grid, turning_grid, levels=20, cmap="RdYlBu_r")
    colorbar1 = plt.colorbar(contour1, ax=ax1)
    colorbar1.set_label("Deflection angle $\\delta$ [°]", fontsize=10)
    ax1.set_xlabel(r"$v_{\infty}$ [km/s]", fontsize=11)
    ax1.set_ylabel(r"Periapsis distance $r_p$ [km]", fontsize=11)
    ax1.set_title("Deflection angle distribution", fontsize=12, fontweight="bold")
    ax1.grid(True, alpha=0.2)
    lines1 = ax1.contour(x_grid, y_grid, turning_grid, levels=[10, 20, 30, 40, 50, 60, 70, 80, 90], colors="black", linewidths=0.8, alpha=0.6)
    ax1.clabel(lines1, inline=True, fontsize=8, fmt="%.0f")

    ax2 = axes[0, 1]
    contour2 = ax2.contourf(x_grid, y_grid, delta_v_grid, levels=20, cmap="viridis")
    colorbar2 = plt.colorbar(contour2, ax=ax2)
    colorbar2.set_label(r"Maximum $\Delta v$ [km/s]", fontsize=10)
    ax2.set_xlabel(r"$v_{\infty}$ [km/s]", fontsize=11)
    ax2.set_ylabel(r"Periapsis distance $r_p$ [km]", fontsize=11)
    ax2.set_title("Maximum velocity change distribution", fontsize=12, fontweight="bold")
    ax2.grid(True, alpha=0.2)
    lines2 = ax2.contour(x_grid, y_grid, delta_v_grid, levels=[5, 10, 15, 20, 25], colors="white", linewidths=0.8, alpha=0.8)
    ax2.clabel(lines2, inline=True, fontsize=8, fmt="%.0f")

    ax3 = axes[1, 0]
    contour3 = ax3.contourf(x_grid, y_grid, eccentricity_grid, levels=20, cmap="plasma")
    colorbar3 = plt.colorbar(contour3, ax=ax3)
    colorbar3.set_label(r"Hyperbolic eccentricity $e_h$", fontsize=10)
    ax3.set_xlabel(r"$v_{\infty}$ [km/s]", fontsize=11)
    ax3.set_ylabel(r"Periapsis distance $r_p$ [km]", fontsize=11)
    ax3.set_title("Hyperbolic eccentricity distribution", fontsize=12, fontweight="bold")
    ax3.grid(True, alpha=0.2)
    lines3 = ax3.contour(x_grid, y_grid, eccentricity_grid, levels=[2, 3, 4, 5, 6, 7, 8, 9, 10], colors="white", linewidths=0.8, alpha=0.8)
    ax3.clabel(lines3, inline=True, fontsize=8, fmt="%.0f")

    ax4 = axes[1, 1]
    altitude_targets = [100000.0, 500000.0, 1000000.0, 5000000.0]
    colors = ["#C43C39", "#F28E2B", "#2C7FB8", "#6A3D9A"]
    for altitude, color in zip(altitude_targets, colors):
        subset = [row for row in rows if abs(row["altitude_km"] - altitude) < altitude * 0.01]
        if len(subset) <= 10:
            continue
        subset.sort(key=lambda row: row["v_infinity_km_s"])
        ax4.plot(
            [row["v_infinity_km_s"] for row in subset],
            [row["turning_angle_deg"] for row in subset],
            "o-",
            color=color,
            linewidth=2,
            markersize=4,
            label=f"{altitude / 1000:.0f}k km",
        )
    ax4.set_xlabel(r"$v_{\infty}$ [km/s]", fontsize=11)
    ax4.set_ylabel(r"Deflection angle $\delta$ [°]", fontsize=11)
    ax4.set_title(r"Deflection angle vs $v_{\infty}$ at different altitudes", fontsize=12, fontweight="bold")
    ax4.legend(loc="best", fontsize=9, title="Flyby altitude")
    ax4.grid(True, alpha=0.3)

    fig.tight_layout()
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    figure_path = FIGURES_DIR / "jupiter_sensitivity_analysis.png"
    fig.savefig(figure_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    return figure_path


def write_output(rows: list[dict[str, float]]) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / "jupiter_sensitivity_grid.csv"
    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    return output_path


def main() -> None:
    jupiter_mu, jupiter_radius = load_jupiter_constants(PLANETS_FILE)
    rows = generate_grid(jupiter_mu, jupiter_radius)
    figure_path = plot_sensitivity(rows)
    output_path = write_output(rows)
    print(f"Saved: {figure_path}")
    print(f"Saved: {output_path}")


if __name__ == "__main__":
    main()
