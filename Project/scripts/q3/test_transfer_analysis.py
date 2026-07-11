"""Numerical regression tests for the Earth--Mars transfer analysis."""

from __future__ import annotations

import sys
import unittest
from datetime import date
from pathlib import Path

import numpy as np
import spiceypy as spice

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from run_transfer_analysis import (  # noqa: E402
    STANDISH_VELOCITY_STEP_DAYS,
    hohmann_analysis,
    lambert_universal,
    load_spice,
    standish_state,
    utc_midnight_et,
)


class LambertTests(unittest.TestCase):
    def test_vallado_benchmark(self) -> None:
        r1 = np.array([5000.0, 10000.0, 2100.0])
        r2 = np.array([-14600.0, 2500.0, 7000.0])
        result = lambert_universal(r1, r2, 3600.0, 398600.0)
        expected_v1 = np.array([-5.9925, 1.9254, 3.2456])
        expected_v2 = np.array([-3.3125, -4.1966, -0.38529])
        np.testing.assert_allclose(result.v1, expected_v1, atol=6e-5, rtol=0.0)
        np.testing.assert_allclose(result.v2, expected_v2, atol=6e-5, rtol=0.0)


class PhysicalModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.constants = load_spice()
        cls.hohmann = hohmann_analysis(cls.constants)

    @classmethod
    def tearDownClass(cls) -> None:
        spice.kclear()

    def test_hohmann_vis_viva_identity(self) -> None:
        r = self.hohmann.earth_radius_au * self.constants.au
        a = self.hohmann.transfer_semimajor_au * self.constants.au
        speed = self.hohmann.transfer_departure_speed_km_s
        state_energy = 0.5 * speed**2 - self.constants.mu_sun / r
        axis_energy = -self.constants.mu_sun / (2.0 * a)
        self.assertAlmostEqual(state_energy, axis_energy, places=10)

    def test_standish_states_have_expected_accuracy_scale(self) -> None:
        day = date(2026, 11, 1)
        et = utc_midnight_et(day)
        approximate_earth = standish_state("EM_BARY", day, self.constants)
        precise_earth = np.asarray(
            spice.spkezr("EARTH BARYCENTER", et, "ECLIPJ2000", "NONE", "SUN")[0]
        )
        approximate_mars = standish_state("MARS", day, self.constants)
        precise_mars = np.asarray(
            spice.spkezr("MARS BARYCENTER", et, "ECLIPJ2000", "NONE", "SUN")[0]
        )
        self.assertLess(np.linalg.norm(approximate_earth[:3] - precise_earth[:3]), 20_000.0)
        self.assertLess(np.linalg.norm(approximate_mars[:3] - precise_mars[:3]), 80_000.0)
        self.assertLess(np.linalg.norm(approximate_earth[3:] - precise_earth[3:]), 0.003)
        self.assertLess(np.linalg.norm(approximate_mars[3:] - precise_mars[3:]), 0.008)

    def test_standish_velocity_central_difference_is_converged(self) -> None:
        day = date(2026, 11, 1)
        nominal = standish_state("MARS", day, self.constants)
        self.assertLess(STANDISH_VELOCITY_STEP_DAYS, 0.1)
        self.assertGreater(np.linalg.norm(nominal[3:]), 20.0)
        self.assertLess(np.linalg.norm(nominal[3:]), 30.0)


if __name__ == "__main__":
    unittest.main()
