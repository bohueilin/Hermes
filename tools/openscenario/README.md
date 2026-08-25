# esmini / OpenSCENARIO cut-in audition

**SIMULATION-ONLY / NOT HERMES EVIDENCE.** This directory is a standards audition, not a
Hermes simulator adapter, backend-parity result, real-world safety result, certification
artifact, or production-validation claim.

## Contents

- `adas_cut_in_near.xosc` translates the current Hermes `adas_cut_in_near` scenario to ASAM
  OpenSCENARIO 1.1 using inline vehicle declarations.
- `adas_cut_in_near.xodr` is the minimal two-lane straight OpenDRIVE input. The official
  esmini binary archive contains no road, catalog, model, or config resources, so the scenario
  would not be self-contained without it.
- `esmini_cutin_audition.py` authorizes and invokes the official esmini 3.7.1 macOS binary,
  parses actual esmini CSV and Hermes `events.jsonl`, and creates deterministic outputs.
- `adas_cut_in_near_comparison.json` is the machine-readable observed comparison.
- `adas_cut_in_near_comparison.svg` is the dependency-free review plot.
- `COMPARISON.md` records provenance, numerical findings, mismatches, and graduation cost.

Raw esmini CSV, the release archive/binary, and Hermes run bundles stay untracked.

## Reproduce

Use Python 3.11 and the repository source path. First create a fresh seed-7 comparator (choose
a new run ID; never overwrite a stored bundle):

```bash
export PYTHONPATH="$PWD/src"
export HERMES_PY=/Users/bohueilin/miniconda3/envs/hermes-dev/bin/python

$HERMES_PY -m hermes run --simulator metadrive --headless \
  --scenario scenarios/adas/adas_cut_in_near.yaml \
  --policy adas-longitudinal \
  --policy-config config/adas/baseline.yaml \
  --gate-config config/gates.adas.yaml \
  --seed 7 --run-id <fresh-run-id>
```

The expected Hermes verdict is `CONDITIONAL` (CLI exit 10); verify the artifact before using
it. Download the official asset named in `COMPARISON.md` into an ignored sandbox, then run:

```bash
$HERMES_PY tools/openscenario/esmini_cutin_audition.py \
  --esmini-bin sandbox/esmini-3.7.1/extracted/esmini/bin/esmini \
  --esmini-archive sandbox/esmini-3.7.1/download/esmini-bin_macOS.zip \
  --hermes-artifact artifacts/<fresh-run-id> \
  --raw-csv sandbox/esmini-3.7.1/runs/reproduction.csv \
  --summary-out tools/openscenario/adas_cut_in_near_comparison.json \
  --svg-out tools/openscenario/adas_cut_in_near_comparison.svg
```

The runner removes any ambient `ESMINI_CONFIG_FILE` before launch. It refuses an existing raw
CSV, wrong producer bits/version/architecture, malformed CSV, wrong Hermes
scenario/policy/gate/shield identity, dirty comparator provenance, or a truncated/non-0.1-second
trace or terminal sequence. Raw, summary, and SVG paths must remain distinct and outside the
comparator artifact root. A fresh post-commit Hermes run has different repository/manifest
provenance, so numerical results should reproduce while the whole summary hash is expected to
change. The committed byte hashes bind the exact producer inputs recorded in `COMPARISON.md`.
