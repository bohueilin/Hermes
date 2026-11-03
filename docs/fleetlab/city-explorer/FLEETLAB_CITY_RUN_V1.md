# FleetLab city run v1

September 29, 2026. **Recorded synthetic operational experiment, not operator evidence.** Gate authority NONE; SIMULATION_ONLY; NOT_AUTHENTICATED.

## Architecture and ownership

Pinned source → directed graph → frozen protocol and exogenous tapes → graph/resource runner → stored events → independent interval/metric reducers → paired comparison → immutable viewer projections.

The selected model is `fleetlab.graph-resource/1.0.0`. It has no endogenous traffic, signal interactions, lane changing, driving policy, sensors or physical contact. The browser never runs it or modifies its outcomes. Nonzero background traffic and incident tapes are explicitly rejected by this model. SUMO 1.27.1 remains a separately measured feasibility path, not an interchangeable engine. SF netconvert emitted unresolved restriction mapping warnings; its depot controller is not qualified.

`city-scenario/1.0.0` represents frozen arrivals, initial vehicles, backgrounds/incidents and seed namespaces. `frozen-protocol.json` supplies the specification, pack identity and digest of every case's scenario tape. `city-run/1.0.0` binds the input digest, graph digest, model and exact specification. The bundle also contains execution context, inputs, and verification. JSON schemas are structural contracts; event semantics are checked separately.

## Frozen experiment

100 generic 60 kWh vehicles; 07:00–15:00 America/Los_Angeles on a fixed synthetic date; 1,200 requests; identical initial positions and 30 kWh energy in both arms; capacity one party; no pooling. Synthetic zone-balanced supported endpoints and hourly arrival weights are recorded. Unreachable requests remain unserved and counted.

One depot has eight ports, 200 kW and four turnaround slots. Two depots split these 4+4, 100+100 kW and 2+2. Fictional locations follow the preregistered geometric quantile rule. No starting relocation, inter-depot work transfer, curb capacity, worker shifts or operator calibration is modeled.

A one-second clock orders arrivals/completed transitions, demand, abandonment, returns, resource release/acquisition, dispatch, then interval movement and energy. Nearest-feasible dispatch runs every 15 seconds, ties by vehicle ID. Unassigned patience is 900 seconds; boarding is 30 seconds. Admission includes pickup, passenger trip and a reachable depot. Turnaround is six minutes after every fourth completed trip, preceding charging when both are due.

Energy is 0.18 kWh/km plus 1 kW auxiliary outside depot storage; storage auxiliary is zero. Port maximum 50 kW; target 48 kWh; reserve 12 kWh; return trigger 21 kWh. Charging is linear, without thermal/taper/grade calibration. Finite power, ports and slots are shared locally; capacity fragmentation can harm service.

Tuning seeds 42/43/44 exercised charging, turnaround and contention. No treatment-favoring amendment was made. Evaluation seeds 1001–1012 and five separately named sensitivities were frozen before either arm. Lower/higher demand, lower/higher initial energy and turnaround load remain separate from stochastic intervals.

## Verification and reproducibility

Events are ordered and lossless within a completed run. The verifier checks identity, sequences, request conservation, connected allowed graph paths, frozen request endpoints, arrival timing, finite resources, resource ownership/power, energy and state intervals, final inventories and counter agreement. It never invokes the simulator or policy. The interval reducer independently derives charging, distance, empty distance, auxiliary time, queue/busy/idle time and recorded state/energy/heading. Metric reduction is separate from the producer but shares graph/schema and authorship; this is not independent organizational assurance or producer authentication.

Poses are recorded every 15 seconds at the end of the preceding interval, before discrete transitions at that timestamp. Coordinate rounding is 1e-7 degree; heading 0.1 degree; energy 1e-6 kWh. Playback holds samples and stops at gaps; dots depict recorded samples, not interpolated road trajectories. Terminal post-arrival state can differ from the terminal pre-transition pose by this declared ordering.

Validation tolerances: per-vehicle energy 1e-6 kWh; derived distance 1e-5 m; pose coordinate reconstruction 0.10 m (rounding tolerance, not positional truth); pose energy 1.1e-6 kWh; heading 0.051 degrees. Counts and sequence/state relationships are exact. Cross-platform acceptance requires fresh checks against these tolerances; bitwise identity is claimed only for an observed repeat in the pinned local environment.

Eight-hour seed-1001 baseline repeats exactly with semantic digest `1925fc5c4cec7ef84a52fdc159a33eb05220d6215dc2eae5652c5ea9ceda28b6`. Volatile start/end/wall time/RSS are in `execution-context.json`, excluded from semantic run identity but covered by the outer bundle hash. Integrity is separate from authenticity.

A controlled early stop produces INCOMPLETE and retains unfinished populations. Forced process kill/power loss is not a qualified resumable execution mode; an absent arm bundle cannot be accepted as complete. All initial failed runs and failure logs are retained.

## Metrics and decisions

Completion denominator is all created requests: completed + unserved + waiting + assigned/in-progress = created. Assigned/not-boarded is separately reported. Wait quantiles use boarded requests and report their count; null populations carry reasons. Empty km per completed trip, queue vehicle-minutes, charged energy, site power, hard violations and origin-zone outcomes are explicit.

The exploratory bootstrap uses 2,000 resamples of 12 paired seed deltas, fixed RNG 20260929, 95% intervals. Practical completion margin is +2 percentage points. Guardrails are zero hard violations, empty-distance relative increase upper bound ≤10%, wait-p90 delta upper bound ≤60 seconds, pooled zone harm veto below −5 points, and ≥30 requests per arm/zone. These intervals do not cover model/map uncertainty or supply joint guardrail confidence.

Execution, verification, eligibility and outcome are separate fields. A valid reserve-breach trace remains inspectable and ineligible for support. Incompatible/invalid runs never get a winner. Source qualification failure takes precedence: all numerical results here are diagnostic, and outcome remains INCOMPLETE.

## Authoring and packaging

F0 explanations are deterministic and separately hashed. The optional mock adapter rejects unknown references, numeric substitutions and attempted decision authority. Live Fireworks transport, price/usage qualification and an atomic project cost ledger are **not implemented/NOT_RUN**; even the explicit paid CLI option returns the template and does not contact a provider. No API keys are read or copied. Actual spend: $0.

The builder freshly verifies each captured run, checks the frozen input/specification identities, recomputes the paired comparison and refuses mismatching stored reports before projecting viewer data. Selected vehicle chunks carry source run digests. The same-origin browser checks each chunk's size and SHA-256. This protects internal consistency, not an adversarial producer's authenticity.

Rollback is the whole compatible viewer+catalogue+pack projection+run/metric schema release. Keep previously published assets for at least 30 days if later publication is approved. Local corruption/restore and unsupported-schema tests are rehearsals, not production rollback evidence.
