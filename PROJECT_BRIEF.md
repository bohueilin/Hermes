# Hermes — Autonomous Driving Scenario & Safety Evidence Lab

**Repository:** `bohueilin/Hermes`  
**Implementation package:** `hermes`  
**Positioning:** Scenario-to-evidence control plane for simulation-based autonomy development.

## Product identity

**Hermes** is the trusted evidence courier for autonomy development. It does not claim that a policy is safe merely because the vehicle completed a route; it carries the exact scenario, software versions, candidate and executed actions, verifier findings, metrics, verdict, and integrity proof from experiment to review.

Canonical repository and software naming:

- GitHub: `bohueilin/Hermes`
- Local root: `~/Projects/Hermes`
- Distribution: `hermes-autonomy`
- Python package: `hermes`
- CLI: `hermes`

## Product thesis

Autonomy teams need more than an aggregate driving score. They need reproducible evidence showing what the system encountered, what it decided, whether safety invariants held, and why a change should pass or be held.

**Autonomy policy proposes → simulator verifies → gate decides → trace proves.**

## Primary user

An autonomy product leader, safety reviewer, simulation engineer, or autonomy developer assessing whether a policy change is ready to advance within a constrained operational design domain.

## MVP user journey

1. Select a scenario, seed, policy, and gate configuration.
2. Run a closed-loop simulation.
3. Inspect candidate actions, safety overrides, vehicle state, and findings.
4. Review safety, mission, comfort, and system metrics.
5. Receive PASS, CONDITIONAL, HOLD, or INVALID_EVIDENCE.
6. Compare baseline and candidate policies.
7. Export a replayable, tamper-evident evidence bundle.

## Constrained prototype ODD

- Procedurally generated, lane-structured roads.
- Daylight and clear weather.
- Bounded speed range configured per scenario.
- Vehicle traffic only in MVP.
- State/LiDAR-like observation with configurable noise, delay, and dropout.
- No public-road deployment and no claim of production representativeness.

## MVP scenarios

1. Nominal lane following.
2. Lead vehicle hard braking.
3. Near-field vehicle cut-in.
4. Static obstacle blocking the lane.
5. Dense merge or bottleneck.
6. Actuation-latency fault.

Stretch scenarios: sensor dropout, low friction, real-log replay, construction detour, and an occluded pedestrian in a higher-fidelity simulator.

## Policies

- **Baseline:** simulator-supported IDM or equivalent deterministic policy.
- **Candidate:** baseline plus a deterministic safety shield for minimum time-to-collision, speed cap, stale-observation handling, and emergency braking.
- **Optional research extension:** PPO or another learned policy, evaluated against the same hard invariants and evidence gate.

## Evidence model

Each run exports:

```text
manifest.json
scenario.resolved.yaml
gate-config.resolved.yaml
events.jsonl
metrics.json
verdict.json
trace.sha256
replay.gif or representative frames
```

Each event contains a sequence number, simulation timestamp, summarized observation, candidate action, executed action, override reason, vehicle state, verifier findings, previous hash, and current hash.

## Success criteria

- Six deterministic scenario definitions execute from the CLI.
- The baseline fails at least two challenge scenarios for a clear demonstration.
- The candidate policy improves the pass rate without bypassing hard invariants.
- Re-running a scenario with the same seed produces the same verdict and equivalent metrics within declared tolerances.
- A tampered event causes evidence verification to fail.
- The dashboard compares baseline and candidate runs.
- Unit tests cover domain logic without requiring the simulator.
- A documented headless simulator smoke test passes on the development machine.

## Non-goals

- A full perception, prediction, planning, and controls production stack.
- Photorealistic simulation as the first milestone.
- Public-road operation, real-vehicle control, or remote vehicle operation.
- SAE automation-level claims.
- ISO, UL, NHTSA, or other certification claims.
- Replacing professional functional-safety, SOTIF, cybersecurity, or regulatory processes.
