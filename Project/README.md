# Reproducing the Project Calculations

Run all commands from the `Project` directory.

## Environment

```bash
python -m venv .venv
```

Activate the environment, then install the dependencies:

```bash
python -m pip install -r scripts/requirements.txt
```

## Directory layout

- `data/external/kernels/`: SPICE kernels used by the Q3 ephemeris model.
- `data/input/q2/`: fixed inputs for the ideal Hohmann-transfer calculation.
- `data/input/q4/`: historical flyby inputs and physical constants.
- `data/output/q2/`, `data/output/q3/`, `data/output/q4/`: numerical results written by the scripts.
- `scripts/q2/`, `scripts/q3/`, `scripts/q4/`: calculation and plotting programs.

The plotting programs write report figures to `figures/`. The Q3 program also writes LaTeX tables and macros to `doc/generated/`. These directories are created automatically when needed.

## Commands

```bash
python scripts/q2/hohmann_transfer.py
python scripts/q3/run_transfer_analysis.py
python scripts/q3/test_transfer_analysis.py
python scripts/q4/flyby_hyperbola.py
python scripts/q4/historical_mission_comparison.py
python scripts/q4/jupiter_sensitivity_analysis.py
```

For a faster Q3 smoke test, use:

```bash
python scripts/q3/run_transfer_analysis.py --quick
```

The full Q3 run uses the production two-day grid and then performs local quarter-day refinement. Running the scripts overwrites the corresponding files in `data/output/` and updates the report figures.
