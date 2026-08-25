# Hermes — Phase 6 Draft README

> Stage 6A design-frozen target. Commands below are not available until Stage 6B implements and
> validates them; this draft must be reconciled with actual implementation before replacing README.

Hermes is a simulation-only autonomous-driving scenario and safety-evidence lab.

> **Autonomy policy proposes → environment executes → verifiers evaluate → gate decides → trace proves.**

Current Hermes preserves a reproducible scenario, findings, metrics, gate verdict, provenance, and
integrity checks. Evidence schema 1 preserves candidate and executed actions; it does not provide a
separately identifiable permitted action. Evidence schema 2 preserves candidate, permitted, and
executed actions. Phase 6 adds a local, read-only Evidence Review Workbench that consumes the same
stored-verification core.

The portable ReviewEnvelope/ComparisonEnvelope contract is version 1.0. It contains no generated
timestamp or absolute path. All source references resolve only within one captured snapshot.

## Safety and trust boundary

Hermes does not prove real-world vehicle safety. Current evidence is:

```text
Scope: SIMULATION_ONLY
Authenticity: NOT_AUTHENTICATED
Authorization: NOT_EVALUATED
Deployment permission: NONE
```

A gate `PASS` means the installed Hermes gate recomputed PASS from an internally consistent stored artifact. It does not mean safe, certified, approved, authenticated, or deployable.

## Environment

```bash
cd /Users/bohueilin/Documents/GitHub/Hermes
conda activate hermes-dev
python -m pip install -e ".[dev,workbench]"
```

## Core validation

```bash
make check
```

Real MetaDrive smoke remains local and manual:

```bash
make sim-smoke
```

## Review one artifact

```bash
hermes review-artifact artifacts/<run-id> \
  --artifact-root artifacts \
  --format text
```

Machine-readable:

```bash
hermes review-artifact artifacts/<run-id> \
  --artifact-root artifacts \
  --format json
```

## Compare two artifacts

```bash
hermes review-compare \
  artifacts/<baseline-run-id> \
  artifacts/<candidate-run-id> \
  --artifact-root artifacts \
  --format text
```

Hermes independently verifies both artifacts and refuses incompatible comparison. It reports improvements and regressions; it does not produce a winner score.

## Launch local workbench

```bash
hermes workbench \
  --artifact-root artifacts \
  --host 127.0.0.1 \
  --port 8501 \
  --no-browser
```

Phase 6 rejects public bind addresses. The workbench has no run, edit, repair, sign, approve, promote, release, or deploy action.

Only numeric loopback literals are accepted. Telemetry, external assets/APIs, upload, and database
persistence are disabled.

## Review views

- artifact intake and verification;
- trust-state summary;
- gate rationale and findings;
- evidence sufficiency;
- schema-aware candidate/executed timeline, plus permitted actions only for schema 2;
- provenance, integrity, and limitations;
- compatible baseline-versus-candidate comparison.

## Canonical completed-run bundle

```text
manifest.json
execution-context.json
scenario.resolved.yaml
gate-config.resolved.yaml
events.jsonl
metrics.json
findings.json
verdict.json
trace.sha256
bundle.sha256
```

## Integrity limitation

Local canonical hashing and event or bundle digests make modification detectable under the installed verifier, but they do not independently authenticate the producer. A party able to rewrite the entire bundle can recompute hashes. Signing is a later phase.

## Non-goals

- physical vehicle control;
- public-road use;
- approval or deployment workflow;
- evidence signing in Phase 6;
- cloud or multi-user workbench;
- RL, CARLA, ROS 2, Autoware, or hardware integration.
