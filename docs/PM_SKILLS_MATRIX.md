# Autonomy PM Leader Skills Matrix

| Domain | What the PM leader must be able to do | Hermes artifact/evidence |
|---|---|---|
| Product and ODD | Define the service promise, operating conditions, exclusions, fallback, and expansion gates. | `PROJECT_BRIEF.md`, ODD schema, scenario eligibility checks. |
| Autonomy architecture | Explain localization, perception, prediction, planning, control, vehicle interface, and cross-cutting platform dependencies; challenge interface and latency budgets. | Architecture document, simulator/policy/verifier contracts, latency telemetry. |
| Simulation and evaluation | Turn hazards and field failures into reproducible scenarios, distinguish open-loop from closed-loop tests, define coverage and deterministic oracles. | Strict scenario catalog, seed/context binding, deterministic fake adapter, repeated-run digest tests. |
| Safety case and launch governance | Translate hazards into requirements, evidence, hard invariants, residual-risk decisions, and explicit owners. | Non-compensatory gate configuration, complete findings, explicit verdict semantics, traceability matrix, decision log. |
| Data and ML lifecycle | Understand data provenance, consent/purpose, labeling, scenario mining, training/eval splits, model versions, and feedback loops. | Run manifest, policy versioning, optional real-log replay, no leakage between golden and development scenarios. |
| Hardware–software integration | Manage sensor placement/calibration, time synchronization, compute, bandwidth, power, thermal, actuator limits, redundancy, diagnostics, and fault handling. | Fault-injection plan, hardware interface document, timing/latency metrics, HIL roadmap. |
| Developer platform | Drive reproducible environments, CI, observability, replay, regression detection, artifact lineage, and fast debugging. | CLI exits 0/10/20/30/40, unit/integration/tamper tests, atomic bundles, hash-chained traces, stored-only verification. |
| Fleet and operations | Define staged rollout, monitoring, remote assistance boundaries, incident response, rollback, and post-deployment learning. | Operations playbook, alert thresholds, rollback criteria, incident template. |
| Cross-functional leadership | Establish decision rights, review forums, escalation paths, and a shared metric hierarchy across autonomy, simulation, vehicle, safety, operations, legal, and UX. | RACI, architecture review, scenario review, and release-readiness agenda. |

## Leadership standard

You do not need to personally implement every perception model or controller. You must be able to identify the system contract, define measurable requirements, expose unsupported assumptions, demand reproducible evidence, assign residual-risk ownership, and make or escalate the release decision.

## Phase 1 leadership evidence

- **Capability versus permission:** policy candidate and shield-executed actions are separate.
- **Verifier integrity:** structured findings, mandatory suite identity, hard-invariant precedence,
  and coherent-envelope adversarial tests prevent common false passes.
- **Residual-risk honesty:** fake dynamics, illustrative thresholds, unsupported authenticity, and
  explicit `NOT_AVAILABLE` signals are visible in every decision.
- **Reversible rollout discipline:** no-overwrite artifacts, atomic publication, stable exit codes,
  and operational-failure cleanup support safe iteration.
