# Hermes PM Leadership Learning Plan

Hermes is not only an engineering prototype. It is a structured way for a product leader to learn how software, simulation, safety, data, and hardware disciplines fit together in autonomous driving.

## 1. Learning objectives

By completing the Hermes milestones, a PM leader should be able to:

- define and defend an operational design domain;
- distinguish autonomy capability, permission, verification, evidence, and release authority;
- explain the perception/prediction/planning/control loop at the right technical altitude;
- design scenario-based acceptance criteria;
- reason about simulator fidelity and limitations;
- identify false-pass and verifier-integrity risks;
- specify deterministic reproduction and provenance requirements;
- translate hazards into requirements, tests, artifacts, and launch gates;
- understand hardware-aware latency, compute, power, thermal, synchronization, and actuator constraints;
- lead cross-functional decisions across autonomy, simulation, safety, vehicle, infrastructure, operations, security, legal, and UX.

## 2. Core PM mental model

```text
Capability: What behavior can the policy propose?
Permission: What behavior is allowed to execute?
Verification: How do independent checks evaluate the result?
Evidence: What proves the inputs, versions, events, and findings?
Gate: Who/what decides advancement?
Residual risk: What remains, and who owns it?
```

Hermes should make each concept visible in code and artifacts.

## 3. Phase-to-skill mapping

| Build phase | Technical learning | PM leadership artifact |
|---|---|---|
| Phase 0 | Environment, dependencies, reproducibility | Readiness checklist and baseline commit |
| Phase 1 | Contracts, scenarios, evidence, verifiers, gates | Requirements traceability and release semantics |
| Phase 2 | Real simulator integration and API/fidelity limits | Simulator strategy and dependency contract |
| Phase 3 | Runtime intervention and challenge scenarios | Risk-control trade-off and residual-risk review |
| Phase 4 | Fault injection | Failure-mode matrix and recovery expectations |
| Phase 5 | CI and DevEx | Regression strategy and engineering productivity metrics |
| Later hardware | Timing, compute, sensors, actuation | Hardware-software integration plan |

## 4. Product questions the PM should answer

### User and business value

- Who is the primary release reviewer?
- What decision is blocked without Hermes evidence?
- Which review cycle becomes faster or more defensible?
- What is the wedge: scenario reproduction, evidence integrity, policy comparison, or release governance?
- What integrations would create platform leverage?

### ODD and scope

- Which road, weather, actor, speed, and sensor conditions are included?
- Which conditions are explicitly excluded?
- What signal allows ODD expansion?
- What fallback applies when the system leaves its intended domain?

### Architecture

- Which component owns world state?
- Which component proposes an action?
- Which component can override it?
- Which component is independent enough to verify it?
- Which data is required to reproduce a failure?
- Which interface lets the simulator later become CARLA, Autoware, or hardware-in-the-loop?

### Safety and verifier integrity

- What hard invariant can never be averaged away?
- What is the verifier’s false-pass risk?
- Can a policy exploit the metric without achieving the intended behavior?
- What happens when evidence is missing, stale, or contradictory?
- Is the gate independent from the system it judges?
- Who accepts residual risk?

### Developer infrastructure

- Can the issue be reproduced from one command?
- Are versions and seeds preserved?
- Does verification require the original simulator?
- What is the cost of adding a new scenario or verifier?
- What telemetry is necessary versus excessive?

### Hardware awareness

- What is the sensor-to-action latency budget?
- What are p95/p99 jitter and missed-deadline tolerances?
- How are clocks synchronized?
- What happens under CPU/GPU/NPU saturation?
- How do power and thermal throttling affect the control loop?
- What sensor or actuator failure modes require fallback?

## 5. PM artifacts to produce

Hermes documentation should include or enable:

1. Product brief.
2. ODD and exclusions.
3. Architecture diagram.
4. Hazard-to-requirement traceability.
5. Scenario catalog.
6. Verifier catalog and integrity risks.
7. Release-gate policy.
8. Evidence schema.
9. Fault-injection plan.
10. Demo runbook.
11. Risk register.
12. Residual-risk ownership table.
13. Hardware-aware roadmap.
14. Incident/reproduction playbook.

## 6. Metrics framework

### Safety evidence

- collision rate/count;
- boundary violations;
- minimum TTC and unsafe-gap duration when available;
- emergency interventions;
- unavailable-evidence rate;
- invalid-artifact rate;
- verifier false-pass/false-fail findings.

### Mission

- destination completion;
- route progress;
- stuck duration;
- termination reason.

### Comfort

- acceleration/deceleration;
- jerk;
- harsh braking;
- intervention-induced discomfort.

### System and DevEx

- deterministic replay rate;
- artifact verification success;
- scenario authoring time;
- regression runtime;
- policy latency source and distribution;
- evidence completeness;
- time from failure report to reproducible scenario.

### Product outcome

- release-review cycle time;
- percentage of changes with complete evidence;
- defects caught before higher-cost validation;
- scenario reuse across teams;
- residual-risk decisions with named owner.

## 7. Cross-functional operating model

| Function | Core responsibility | PM alignment question |
|---|---|---|
| Autonomy engineering | Policy behavior | What changed and what new behavior is possible? |
| Simulation | Scenario fidelity and execution | Which risk is represented and with what limitations? |
| Safety/assurance | Requirements and evidence sufficiency | What bar must hold before advancement? |
| Vehicle/hardware | Sensors, compute, networks, actuators | Which physical constraint invalidates a software assumption? |
| Data/ML platform | Logging, labels, lineage | Can the failure be found, reproduced, and separated from training leakage? |
| Developer infrastructure | CI, replay, observability | Can teams debug and regress changes efficiently? |
| Operations | Monitoring, fallback, incidents | What happens after deployment or field anomaly? |
| Security/privacy | Integrity and data protection | Can evidence, commands, or training data be tampered with or exposed? |
| Legal/policy | Claim and deployment boundaries | What may the team responsibly claim or launch? |
| Product/UX | User promise and trust | How does the system communicate capability and fallback? |

## 8. Executive review prompts

After each phase, answer:

1. What user/reviewer decision became possible?
2. What evidence is now trustworthy?
3. What is still simulated, assumed, or unavailable?
4. What hard gate prevents false confidence?
5. What new risk did the implementation introduce?
6. What would have to be true to expand the ODD?
7. What is the highest-leverage next milestone?

## 9. Interview narrative

A concise leadership narrative:

> I built Hermes to understand the full autonomy development loop, not just a driving demo. I defined a constrained ODD, created simulator-neutral contracts, separated candidate from executed actions, built deterministic scenarios and independent verifiers, enforced hard release gates, and preserved replayable evidence. I then attached a real simulator through the same contract and evaluated runtime interventions without allowing aggregate metrics to hide safety failures. That exercise sharpened how I would lead autonomy software, simulation, safety, and hardware teams around measurable advancement criteria and residual-risk ownership.

## 10. Residual learning roadmap

After Hermes MVP:

- study real autonomy incident and disengagement taxonomies;
- map scenario standards such as OpenSCENARIO/OpenDRIVE;
- inspect ROS 2 and Autoware data flows;
- explore camera/LiDAR/radar synchronization and calibration;
- model compute, power, thermal, and network budgets;
- compare open-loop log replay with closed-loop simulation;
- design processor-in-the-loop and hardware-in-the-loop entry criteria;
- develop a safety-case argument structure without overstating prototype evidence.
