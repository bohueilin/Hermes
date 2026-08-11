# Hermes

**Hermes** is an autonomous-driving scenario and safety-evidence lab for a simulation-only hackathon prototype.

Core thesis:

> Autonomy policy proposes → simulator verifies → gate decides → trace proves.

## Canonical naming

Use these names consistently across GitHub, the local workspace, Python, documentation, and commands:

| Surface | Canonical value |
|---|---|
| Product and repository display name | `Hermes` |
| GitHub repository | `bohueilin/Hermes` |
| Local project folder | `~/Projects/Hermes` |
| Python distribution | `hermes-autonomy` |
| Python import package | `hermes` |
| Console command | `hermes ...` |
| Module-form CLI | `python -m hermes.cli ...` |
| Evidence output root | `artifacts/` |

Do not create a parallel product name, repository name, or Python namespace unless a later migration is explicitly approved.

## Contents

- `MASTER_PROMPT.md` — paste into a Codex chat in the ChatGPT Desktop app.
- `BUILD_PLAN.md` — complete implementation sequence, gates, demo, and learning roadmap.
- `AGENTS.md` — copy to the root of the Hermes repository before starting.
- `PROJECT_BRIEF.md` — product scope, ODD, success criteria, and non-goals.
- `config/gates.example.yaml` — illustrative prototype gate thresholds.
- `scenarios/cut_in.example.yaml` — simulator-neutral scenario-schema example.
- `docs/PM_SKILLS_MATRIX.md` — capabilities and artifacts for an autonomy PM leader.

## Recommended local layout

```text
~/Projects/Hermes/                 # Primary ChatGPT Desktop local-project folder
~/Projects/Hermes/third_party/
~/Projects/Hermes/third_party/metadrive/
```

## First commands

```bash
conda activate hermes-dev
python -m pip install -e .
python -m pip install -e ".[dev]"
python -m hermes doctor
```

The equivalent Phase 0 doctor entry paths are:

```bash
hermes doctor
python -m hermes doctor
python -m hermes.cli doctor
```

The doctor reports `PASS`, `WARN`, `FAIL`, or `NOT_AVAILABLE` for each observed fact. It exits
nonzero when a required check is `FAIL`; warnings and unavailable non-blocking observations remain
visible without being fabricated as successful. It inspects only static/import prerequisites and
does not launch MetaDrive.

MetaDrive remains an external dependency installed from the verified local source at
`third_party/metadrive`. Do not clone or reinstall it when the existing import, version, assets,
and source revision checks pass. MetaDrive's upstream runtime diagnostic command is:

```bash
python -m metadrive.examples.verify_headless_installation
```

Record the exact simulator revision:

```bash
git -C third_party/metadrive rev-parse HEAD > SIMULATOR_COMMIT
```

When you intentionally create the GitHub remote, use the exact repository name `bohueilin/Hermes`. Do not let an agent create, publish, push, or change the remote without your explicit direction.

The recommended root is `~/Projects/Hermes`, but the doctor reports the actual containing Git root
so an explicitly selected desktop workspace remains valid. See `docs/decision-log.md` for Phase 0
decisions and observed deviations.

## Safety boundary

Hermes is for simulation and closed-lab learning only. Do not connect it to a road vehicle, public-road actuator, or safety-critical production system.
