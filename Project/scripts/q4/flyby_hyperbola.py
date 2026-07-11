#!/usr/bin/env python3
"""Generate the normalized planet-centered hyperbolic-flyby geometry figure."""

from __future__ import annotations

import csv
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib import rcParams

ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "data" / "output" / "q4"
FIGURES_DIR = ROOT / "figures"

rcParams["font.family"] = "sans-serif"
rcParams["font.sans-serif"] = ["Arial", "Liberation Sans", "DejaVu Sans"]
rcParams["font.size"] = 14
rcParams["axes.unicode_minus"] = False


def calculate_geometry(mu: float = 1.0, v_infinity: float = 1.2, periapsis: float = 1.0) -> dict[str, float]:
    semimajor_axis = -mu / v_infinity**2
    eccentricity = 1.0 + periapsis * v_infinity**2 / mu
    asymptote_true_anomaly = float(np.arccos(-1.0 / eccentricity))
    semilatus_rectum = abs(semimajor_axis) * (eccentricity**2 - 1.0)
    turning_angle = 2.0 * float(np.arcsin(1.0 / eccentricity))
    return {
        "mu_normalized": mu,
        "v_infinity_normalized": v_infinity,
        "periapsis_normalized": periapsis,
        "semimajor_axis_normalized": semimajor_axis,
        "eccentricity": eccentricity,
        "asymptote_true_anomaly_rad": asymptote_true_anomaly,
        "semilatus_rectum_normalized": semilatus_rectum,
        "turning_angle_rad": turning_angle,
        "turning_angle_deg": float(np.degrees(turning_angle)),
    }


def plot_geometry(values: dict[str, float]) -> Path:
    theta_inf = values["asymptote_true_anomaly_rad"]
    semilatus_rectum = values["semilatus_rectum_normalized"]
    eccentricity = values["eccentricity"]
    semimajor_axis = values["semimajor_axis_normalized"]

    theta = np.linspace(-theta_inf + 0.005, theta_inf - 0.005, 1000)
    radius = semilatus_rectum / (1.0 + eccentricity * np.cos(theta))
    x = radius * np.cos(theta)
    y = radius * np.sin(theta)

    fig, ax = plt.subplots(figsize=(10, 8), dpi=300)
    ax.plot(x, y, "#203864", linewidth=2.8, label="Spacecraft Hyperbolic Trajectory")
    ax.plot(0.0, 0.0, "o", color="#D4AF37", markersize=18, label="Planet (Focus)")

    beta = np.arccos(1.0 / eccentricity)
    slope = np.tan(beta)
    center_x = -semimajor_axis * eccentricity
    parameter = np.linspace(-20.0, 20.0, 500)
    line_x = parameter + center_x
    ax.plot(line_x, slope * parameter, "#9098A8", linestyle="--", linewidth=1.6, alpha=0.85, label="Asymptotes")
    ax.plot(line_x, -slope * parameter, "#9098A8", linestyle="--", linewidth=1.6, alpha=0.85)

    arrow_color = "#8B1E3F"
    ax.annotate(
        "",
        xy=(-1.4, -4.0),
        xytext=(-2.5, -6.0),
        arrowprops={"arrowstyle": "->", "color": arrow_color, "lw": 2.4, "mutation_scale": 28},
    )
    ax.text(-2.5, -4.0, r"$v_\infty^-$", fontsize=13.5, color=arrow_color, fontweight="bold")
    ax.annotate(
        "",
        xy=(-2.5, 6.0),
        xytext=(-1.4, 4.0),
        arrowprops={"arrowstyle": "->", "color": arrow_color, "lw": 2.4, "mutation_scale": 28},
    )
    ax.text(-2.5, 4.0, r"$v_\infty^+$", fontsize=13.5, color=arrow_color, fontweight="bold")
    ax.annotate(r"$r_p$", xy=(0.65, 0.48), fontsize=13.5, color="#203864", fontweight="bold")
    ax.annotate(r"$\delta$ Turning Angle", xy=(3.8, 0.0), fontsize=13, color="#203864", ha="center")

    ax.set_aspect("equal")
    ax.set_xlim(-9.5, 9.5)
    ax.set_ylim(-7.0, 7.0)
    ax.set_xlabel("Planet-Centered X")
    ax.set_ylabel("Planet-Centered Y")
    ax.set_title("Hyperbolic Fly-by Geometry\n(Planet at Focus)", pad=25)
    ax.legend(loc="upper right", frameon=True, facecolor="white", edgecolor="gray")
    ax.grid(True, alpha=0.25)
    fig.tight_layout()

    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    figure_path = FIGURES_DIR / "fig3_flyby_hyperbola.png"
    fig.savefig(figure_path, dpi=300, bbox_inches="tight", pad_inches=0.3)
    plt.close(fig)
    return figure_path


def write_output(values: dict[str, float]) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / "flyby_hyperbola_parameters.csv"
    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(values))
        writer.writeheader()
        writer.writerow(values)
    return output_path


def main() -> None:
    values = calculate_geometry()
    figure_path = plot_geometry(values)
    output_path = write_output(values)
    print(f"Saved: {figure_path}")
    print(f"Saved: {output_path}")


if __name__ == "__main__":
    main()
