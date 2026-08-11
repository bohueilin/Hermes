# Autonomy PM Leader Skills Matrix

| Domain | What the PM leader must be able to do | Hermes artifact/evidence |
|---|---|---|
| Product and ODD | Define the service promise, operating conditions, exclusions, fallback, and expansion gates. | `PROJECT_BRIEF.md`, ODD schema, scenario eligibility checks. |
| Autonomy architecture | Explain localization, perception, prediction, planning, control, vehicle interface, and cross-cutting platform dependencies; challenge interface and latency budgets. | Architecture document, simulator/policy/verifier contracts, latency telemetry. |
| Simulation and evaluation | Turn hazards and field failures into reproducible scenarios, distinguish open-loop from closed-loop tests, define coverage and deterministic oracles. | Scenario catalog, seed management, fake adapter, closed-loop replay, coverage dashboard. |
| Safety case and launch governance | Translate hazards into requirements, evidence, hard invariants, residual-risk decisions, and explicit owners. | Gate configuration, verdict logic, evidence bundle, risk register, decision log. |
| Data and ML lifecycle | Understand data provenance, consent/purpose, labeling, scenario mining, training/eval splits, model versions, and feedback loops. | Run manifest, policy versioning, optional real-log replay, no leakage between golden and development scenarios. |
| Hardware–software integration | Manage sensor placement/calibration, time synchronization, compute, bandwidth, power, thermal, actuator limits, redundancy, diagnostics, and fault handling. | Fault-injection plan, hardware interface document, timing/latency metrics, HIL roadmap. |
| Developer platform | Drive reproducible environments, CI, observability, replay, regression detection, artifact lineage, and fast debugging. | CLI, unit tests, headless smoke test, GitHub Actions, hash-chained traces. |
| Fleet and operations | Define staged rollout, monitoring, remote assistance boundaries, incident response, rollback, and post-deployment learning. | Operations playbook, alert thresholds, rollback criteria, incident template. |
| Cross-functional leadership | Establish decision rights, review forums, escalation paths, and a shared metric hierarchy across autonomy, simulation, vehicle, safety, operations, legal, and UX. | RACI, architecture review, scenario review, and release-readiness agenda. |

## Leadership standard

You do not need to personally implement every perception model or controller. You must be able to identify the system contract, define measurable requirements, expose unsupported assumptions, demand reproducible evidence, assign residual-risk ownership, and make or escalate the release decision.
