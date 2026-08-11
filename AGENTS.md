# Hermes repository instructions

Project identity: repository `bohueilin/Hermes`, Python distribution `hermes-autonomy`, and import package `hermes`. Preserve these names unless the user explicitly changes them.

## Canonical project identity

- Human-facing product and repository name: `Hermes`.
- Target GitHub repository: `bohueilin/Hermes`.
- Recommended local root: `~/Projects/Hermes`.
- Python distribution: `hermes-autonomy`.
- Python import package: `hermes`.
- Console command: `hermes`; module equivalent: `python -m hermes.cli`.
- Do not reintroduce the former project name or a different package namespace.

## Product invariants

- Simulation only. Never connect this repository to a real road vehicle or public-road actuator.
- The candidate policy proposes an action; deterministic runtime checks may override it; offline verifiers evaluate the run; the release gate issues PASS, CONDITIONAL, HOLD, or INVALID_EVIDENCE.
- Do not claim an SAE automation level, production safety, certification, or regulatory compliance.
- Prototype thresholds must live in configuration, be labeled illustrative, and never be presented as real-world safety limits.
- An LLM may generate scenarios, explain results, or draft documentation. It must never sit in the real-time driving-control loop.

## Engineering rules

- Use Python 3.11 unless the installed simulator requires a compatible fallback.
- Treat MetaDrive as an external dependency. Do not modify its source unless a task explicitly requires it; prefer a simulator adapter.
- Before using any MetaDrive config key or API, inspect the installed source, examples, and `default_config()`; do not invent keys.
- Keep simulator-specific code under `src/hermes/adapters/`.
- Keep domain models, verifiers, gate logic, trace integrity, and tests simulator-neutral.
- Use deterministic seeds. Every run manifest must record the repository commit, simulator commit, scenario hash, policy version, gate-config hash, Python version, platform, and seed.
- Write tests before or with behavior changes. Unit tests must not require a graphical display.
- No silent exception swallowing, fabricated metrics, placeholder pass results, or hard-coded successful verdicts.
- Do not commit large simulator assets, videos, datasets, virtual environments, credentials, or generated run artifacts.

## Required validation

Run these before declaring a phase complete:

```bash
ruff check .
pytest -q
hermes doctor
```

When the simulator is installed, also run:

```bash
hermes sim-smoke --headless
hermes verify-artifact artifacts/latest
```

## Definition of done

- The requested behavior works from a documented command.
- Relevant tests pass.
- A failure path is tested.
- Documentation and acceptance criteria are updated.
- Generated evidence is replayable and its hash chain verifies.
- Summaries distinguish observed evidence, assumptions, and unresolved risks.

## Git behavior

- Small, reviewable local commits are allowed after tests pass.
- Never push, publish, deploy, purchase services, or change remote infrastructure without explicit user direction.
