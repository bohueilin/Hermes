# Hermes — Autonomous Driving Scenario & Safety Evidence Lab

**Repository:** `bohueilin/Hermes`
**Distribution:** `hermes-autonomy`
**Python package:** `hermes`
**Positioning:** Scenario-to-evidence control plane for simulation-based autonomy development.

## Product identity

Hermes is the trusted evidence courier for autonomy development. It carries the exact scenario, versions, candidate and executed actions, findings, metrics, verdict, and integrity checks from experiment to review.

Hermes does not declare a driving policy safe merely because a simulated vehicle completes a route.

## Product thesis

> **Autonomy policy proposes → environment executes → verifiers evaluate → gate decides → trace proves.**

## Problem

Autonomy teams can produce large volumes of simulator output without producing a trustworthy advancement decision. Aggregate reward or route-completion metrics may hide collisions, boundary violations, missing evidence, non-reproducible runs, or runtime interventions that are not auditable.

Hermes creates an explicit control plane linking:

```text
Hazard and product requirement
→ reproducible scenario
→ candidate and executed behavior
→ independent verifier finding
→ release-gate consequence
→ replayable evidence bundle
```

## Primary user

An autonomy product leader, safety reviewer, simulation engineer, autonomy developer, or release owner determining whether a policy or software change is ready to advance within a constrained operational design domain.

## Core jobs to be done

1. Reproduce a defined driving condition under a deterministic seed.
2. Inspect what the policy proposed and what actually executed.
3. Determine whether hard safety, mission, comfort, and system requirements held.
4. Understand why the release gate issued its verdict.
5. Verify the artifact without rerunning the simulator.
6. Compare baseline and candidate behavior without hiding regressions.
7. Preserve provenance for review, debugging, and learning.

## Current validated status

Phase 0 is preserved and the Phase 1 deterministic evidence core is implemented on the gated
feature branch:

- the `hermes` CLI is installed and recognized;
- `hermes doctor` validates the Python, Git, MetaDrive, asset, and headless prerequisites;
- the Phase 0 repository has a clean baseline commit and its doctor behavior remains covered;
- strict scenario, gate, trace, finding, verdict, and artifact schemas are implemented;
- nominal, collision, boundary, soft-degradation, tamper, and repeated-input paths are automated;
- stored verification recomputes the decision without importing or launching a simulator;
- the full automated suite and Ruff pass at the Phase 1 checkpoint;
- MetaDrive 0.4.3 is installed at the recorded source commit;
- MetaDrive headless and offscreen launch have been verified on the development machine.

Current baseline commit:

```text
c181509a691b132cb732a50c24612f6bd40bafca
```

## Phase 1 acceptance outcomes

The deterministic, simulator-neutral evidence vertical slice is the required gate before
integrating MetaDrive into Hermes runtime logic and is implemented on this feature branch.

Required Phase 1 outcomes:

| Condition | Verdict |
|---|---|
| Nominal fake scenario | `PASS` |
| Collision scenario | `HOLD` |
| Boundary violation | `HOLD` |
| Soft degradation | `CONDITIONAL` |
| Modified or incomplete evidence | `INVALID_EVIDENCE` |

## Next product milestone

Add one bounded MetaDrive headless adapter run through the same contracts, verifiers, gate, and
artifact format. Do not begin the runtime safety shield until that adapter path is independently
verified and committed.

## Constrained prototype ODD

- Lane-structured procedural roads.
- Daylight and clear weather.
- Bounded speed configured per scenario.
- Vehicle actors only for the initial MetaDrive milestone.
- State and simulator-supported surrounding context.
- Simulation-only delay, dropout, stale-observation, noise, and actuator-fault profiles.
- No pedestrians, emergency vehicles, severe weather, construction, unstructured roads, or public-road use in the initial ODD.

## Product invariants

- Candidate and executed actions are distinct evidence fields.
- Hard invariants override aggregate scores.
- Missing evidence is explicit and never silently treated as zero or pass.
- Artifact verification never reruns a simulator.
- A simulator or policy crash never produces PASS.
- Scenario, policy, shield, adapter, verifier, gate, and schema versions are recorded.
- Identical deterministic inputs produce an identical deterministic trace digest.
- Prototype thresholds are versioned, configurable, and labeled illustrative.

## Evidence model

Each completed run exports:

```text
manifest.json
scenario.resolved.yaml
gate-config.resolved.yaml
events.jsonl
metrics.json
verdict.json
trace.sha256
```

Each event preserves:

- sequence and simulation time;
- summarized observation;
- candidate action;
- executed action;
- override reason codes;
- vehicle state and verifier-relevant facts;
- simulated or measured latency source;
- previous and current event hashes.

## Gate semantics

- `PASS`: required evidence is valid; hard and configured soft criteria pass.
- `CONDITIONAL`: hard criteria pass, mission succeeds, but one or more configured soft thresholds fail.
- `HOLD`: a hard invariant or required advancement criterion fails.
- `INVALID_EVIDENCE`: the bundle is missing, malformed, inconsistent, unsupported, or fails integrity verification.

## Success criteria for the hackathon MVP

- Deterministic fake and MetaDrive adapters implement the same contract.
- Nominal, collision, boundary, and challenge runs execute from documented CLI commands.
- Candidate and executed actions are auditable.
- Independent verifiers produce structured findings with supporting event sequences.
- Hard-invariant precedence is tested.
- Tampered evidence is rejected.
- Repeated deterministic inputs produce the same trace digest.
- One bounded MetaDrive run creates a complete artifact that verifies without simulator rerun.
- A deterministic shield demonstrates an explicit intervention reason on a reproducible challenge scenario.
- Tests cover core logic without requiring a display.
- Documentation maps requirements to scenarios, verifiers, tests, artifacts, and gates.

## Non-goals

- Real vehicle, public-road, CAN, or actuator control.
- A production autonomy stack.
- Photorealistic simulation as the first milestone.
- SAE automation-level classification.
- Certification or formal compliance evidence.
- Replacing functional-safety, SOTIF, cybersecurity, or regulatory processes.
- Claiming local hash chaining provides independent authenticity.
- Dashboard, RL, CARLA, ROS 2, Autoware, or hardware-in-the-loop before the evidence core is complete.

## Executive narrative

Hermes demonstrates leadership at the boundary of product, simulation, software infrastructure, and safety assurance. The project’s differentiator is not a car moving in a simulator; it is the disciplined transformation of a proposed autonomy change into reproducible evidence and a defensible advancement decision.
