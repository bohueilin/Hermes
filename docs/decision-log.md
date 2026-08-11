# Hermes Decision Log

## 2026-08-11 — Phase 0 environment doctor and package bootstrap

### Scope

Implement only the Python package scaffold and truthful environment doctor. Simulator execution,
policies, safety shields, release gates, evidence bundles, and dashboards remain later-phase work.

### Decisions

- Use distribution `hermes-autonomy`, import package `hermes`, and console command `hermes`.
- Require Python 3.11 for the package. The verified environment is Conda environment `hermes-dev`.
- Keep MetaDrive external to Hermes. The doctor cross-checks distribution/source version 0.4.3,
  representative asset sentinels, source path, clean nested Git revision, and the recorded pin
  without launching a simulation. Asset integrity remains unverified because the 0.4.3 bundle has
  no checksum manifest.
- Treat the official MetaDrive headless verification script as an upstream runtime diagnostic, not
  standalone proof. The user reported that it passed before Phase 0; the doctor independently
  imports its prerequisites and finds a graphics pipe, while explicitly not claiming rendering ran.
- Resolve the actual current Git root instead of enforcing the recommended `~/Projects/Hermes`
  path. This workspace is `/Users/bohueilin/Documents/GitHub/Hermes`.
- Exit successfully for `WARN` and `NOT_AVAILABLE`, but exit nonzero for any `FAIL`. Every failure
  includes an actionable remediation.

### Observed initial state

- Python in `hermes-dev`: 3.11.15.
- MetaDrive distribution: 0.4.3, imported from `third_party/metadrive`.
- MetaDrive source and recorded `SIMULATOR_COMMIT`:
  `85e5dadc6c7436d324348f6e3d8f8e680c06b4db`.
- The root Git repository has no commits yet and all starter files are untracked. Until an initial
  validated commit exists, Git provenance is `NOT_AVAILABLE` and the working tree is `WARN` dirty.
- Optional `DISPLAY`/`WAYLAND_DISPLAY` variables are unset on macOS. This is reported as
  `NOT_AVAILABLE` and is not treated as an offscreen prerequisite failure.

### Reversibility and follow-up

The doctor probes are simulator-light and isolated in `src/hermes/doctor.py`; later phases can
reuse their structured results without changing the three supported CLI entry paths. Phase 0 does
not implement `sim-smoke` or artifact verification commands.
