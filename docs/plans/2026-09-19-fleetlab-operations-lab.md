# FleetLab operational simulation extension

> **For agentic workers:** Use superpowers:subagent-driven-development for bounded implementation and review tasks. Do not commit, push, publish or alter unrelated work.

**Goal:** Make a fleet day understandable through individual cars, visible lifecycle steps, time/weather/resource controls, computed capacity comparisons, a complete learning catalog, and an honest Google traffic/CARLA path.

**Architecture:** Add a versioned operational teaching simulator alongside the unchanged regional paired-experiment model. It models each vehicle, trip, depot stage and resource with explicit minute resolution. A new UI projects its frames and events; it contains no simulation math or recommendation gate. Google Routes is an optional separate local companion whose content stays on a Google Map or an attributed non-map result. No external traffic is silently substituted for synthetic data.

**Tech stack:** Plain JavaScript/DOM/SVG, built-in Node tests and optional local Node HTTP companion. Existing offline and static packages remain network-free.

**Spec and rationale:** This document is the specification and implementation plan. The current user explicitly requests more simulation behavior and Google/CARLA research, superseding prior presentation-only scope, old blanket copy bans where they prevent an accurate integration label, and the Phase 6 CARLA stop only for this bounded research. No driving simulator installation or physical integration is authorized by this plan. The broader evidence-review core and all historical fixtures stay unchanged.

## Global constraints

- Work only in `/Users/bohueilin/Documents/GitHub/Hermes-playground`, branch `feat/fleetlab-playground`; preserve previous uncommitted redesign.
- Simulation only. Synthetic demand, weather effects, geography, energy and service times must be labeled. No real-fleet, calibrated digital-twin, safety or deployment claim.
- Existing model, instrument, metric contracts and golden fixtures remain unchanged. The new operations model has its own explicit version and no gate score.
- No external dependencies for the default experience; no network in offline/static packages. No keys in browser bundles, files, screenshots or logs.
- All visitor text through DOM textContent. Responsive phone/desktop UI, keyboard controls, visible focus, user-controlled movement and reduced motion.
- Run day is an explicit request to replay movement. Reduced-motion users get paused step controls. Navigation pauses replay; configuration edits mark prior results stale.
- Every requested trip is completed, unserved, waiting or in progress; no disappearance. Each vehicle has exactly one state; depot stages enforce finite resources; charging enforces energy and power bounds.
- Package generated output only under ignored `dist/`; validation reports/screenshots under ignored `artifacts/`. No commits or remote writes.

## Task 1: Operational model and capacity comparisons

**Files:** Create `playground/fleetlab/src/model/operations.js`, `playground/fleetlab/test/operations.test.mjs`.

**API:** Export `OPERATIONS_VERSION`, `OPERATIONS_STATES`, `defaultOperationsConfig()`, `validateOperationsConfig(config)` returning string errors, `simulateOperations(config, {capture=true}={})`, and `analyzeOperationsCapacity(config)`.

Config fields: `fleet_size`, `depot_count`, `requests_per_hour`, `start_hour`, `duration_hours`, `weather` (`clear`, `rain`, `heat`), `seed`, `trip_minutes`, `pickup_minutes`, `patience_minutes`, `trips_between_visits`, `cleaning_minutes`, `software_minutes`, `upload_minutes`, `software_every_visits`, `cleaning_bays`, `software_bays`, `upload_bays`, `chargers`, `charger_kw`, `site_power_kw`, `battery_kwh`, `initial_soc_pct`, `charge_target_pct`, `reserve_soc_pct`, `energy_kwh_per_minute`, `peak_multiplier`. Resources are per depot. Default fleet 24, depots 2, 30 requests/hour, 07:00 start, 8 hours, seed 42; remaining defaults explicit and documented in module.

Return `{version,config,locations,frames,events,requests,visits,metrics,assumptions}`. Locations `{id,label,x,y,kind}` use invented 0..100 geometry. Frames `{minute,clock_minute,vehicles,counts,depot_queues}`. Vehicles `{id,state,node,from,to,progress,soc_kwh,depot_id,request_id,remaining_min}`; progress 0..1 and from/to are location ids for route motion, otherwise node supplies parked location. Export state ids/labels. Events `{minute,vehicle_id,kind,detail}`. Explicit stages cover available, pickup, passenger trip, drive to depot, queued/active software, cleaning, charging, upload, and ready. A visit is a sequential flow; software runs only when scheduled. No two stages use a vehicle simultaneously.

Metrics include `fleet_size`, `depot_count`, `total_requests`, `completed_trips`, `unserved_requests`, `pending_requests`, `in_progress_trips`, `trips_per_vehicle`, `avg_wait_min_completed` (null if absent), `avg_depot_turnaround_min` (null if no completed visit), `avg_active_service_min`, `censored_visits`, `max_queue`, `energy_delivered_kwh`. Return additional diagnostics rather than hiding failures. Explain clock rounding, synthetic effects, fixed service times and unfinished visits.

Capacity analysis runs same-demand comparisons across bounded fleet counts and depot counts. Return `{target_completion_fraction:0.95,fleet_trials,depot_trials,min_depots}`; trials contain tested config counts plus metrics and `completion_fraction`. `min_depots` is null if no tested count meets the target. Explain this is a tested scenario requirement, not a global optimum. UI must display the tested range and unmet-target cases.

- [x] Write failing deterministic, vehicle/request conservation, queue-resource, SOC/energy/site-power, missing population, weather/time, lifecycle, shared-demand comparison and input-boundary tests.
- [x] Implement a bounded deterministic minute-step/discrete-event model; generate demand once independently of fleet and depot counts. Use common request-keyed travel inputs for sweeps.
- [x] Validate: integer counts, finite positive durations, supported time range; no zero/negative power or impossible SOC thresholds; bound fleet <=120, depots <=6, duration <=24 hours, demand <=240/hour.
- [x] Test and report exact command/counts plus API sample to root. No edits outside assigned files.

## Task 2: Legible vehicles and movement

**Files:** New `src/ui/car-glyph.js`, `src/ui/operations-map.js`, tests; optional changes to existing `src/ui/iso.js` with targeted tests.

- [x] Build a cute clear SVG car with wheels, cabin/windows, headlights and a small sensor pod, using code-native geometry and current palette.
- [x] Project every operations frame to a small street grid and depot; visibly show actual vehicle ids, state color plus text, selection and route movement. No random decorative moving vehicles.
- [x] Interpolate only along the current modeled leg; next-minute and next-activity controls land on actual simulated frames/events. Provide a vehicle table and selected-car activity trail.
- [x] Improve existing regional moving-car glyph without changing its numeric projections or aggregates.

## Task 3: Human-centered UI and complete catalog

**Files:** New `src/ui/operations-lab.js`, `src/ui/simulation-catalog.js`, tests; update `studio.js`, `styles.css`, packaging copy list and documentation.

- [x] Make the primary entry question explicit: how many trips can this fleet serve today? Main destinations include Simulation, Experiments, Learning catalog and Product approach.
- [x] Build presets, grouped labeled controls and steps: set demand/fleet/time/weather; choose depot resources; Run day; inspect outcomes; compare fleet/depot capacity.
- [x] Run explicitly starts replay unless reduced motion. Pause/play, scrub time, next-minute and next-activity, speed, vehicle selection, stage explanations and a count of completed/unserved/waiting/in-progress trips stay available.
- [x] Show requested/served trips, trips/car, mean completed depot turnaround, service breakdown and censored visits. Sweeps show actual tested counts and the first count meeting the declared target, or unavailable.
- [x] Catalog every existing preset programmatically from PRESETS, plus new model capabilities. Each item says question, controls, outputs, what it teaches, and limitations; search/filter and launch relevant model. Distinguish model versions and advanced-workbench scope.
- [x] Update stale statements that charging/software/data transfer are absent everywhere; they remain absent in the regional model and simplified in the new operational model.
- [x] Run integrated navigation, stale-result, no-autoplay-on-load, reduced-motion, missing-value and catalog completeness tests; preserve old workbench tests.

## Task 4: Google traffic companion and CARLA research

**Files:** Optional local-only tools/companion outside offline bundle; targeted tests; research/configuration documentation.

- [x] Verify official Routes API traffic model, departure time, authentication, attribution and storage constraints. Build a credential-free-tested client and local companion that keeps credentials server-side, rejects non-loopback hosts/origins, validates request bounds and never logs secrets or provider responses.
- [x] Provide an explicit connected/unconfigured/error state. Do not say Google traffic powers the default synthetic replay. If connection cannot run without keys, document that dependency and finish all independent work.
- [x] Keep Google route content in an attributed non-map panel in the companion, with proper attribution and visibly separate synthetic assumptions. Do not import Google content into the non-Google schematic or persist it in artifacts by default.
- [x] Research CARLA repository/license, weather effects, Traffic Manager, synchronization/seeded runs, recording and SUMO/ScenarioRunner. Assess reuse by decision fidelity and resource cost; do not install CARLA or claim its traffic forecasts actual road conditions.

## Task 5: Validation, local packages, handoff

- [x] Independent review of model invariants, integration and claims; fix material findings.
- [x] Browser QA on desktop/phone: visible moving individual cars, stage transitions, charging queues, edits/stale state, sweeps and catalog routes. Save screenshots.
- [x] Run focused and complete JS tests, Python parity/boundary, Ruff, doctor and diff checks. Record broad Python historical fixture failures without inventing repairs.
- [x] Repack offline and static distributions, verify size/policy/content, update local preview and final handoff with actual results and limitations.

## Decisions and progress

- Ruling: proceed with reversible local implementation under the current explicit user request; no repeated design approval is required by the higher-priority collaboration instructions.
- Ruling: separate the new operational model from the regional experiment model to avoid silently changing historical metrics or evidence semantics. The UI must make this separation understandable, not expose unnecessary internals.
- Ruling: Google traffic cannot honestly power a keyless offline schematic. A working optional companion and clear unconfigured state are the authorized achievable integration until credentials are available.
- Ruling: no local commit because full repository validation has known historical fixture failures and the current wave has not yet completed its gates.

Completion note: 2026-09-19 UTC, all local tasks validated. Google connection requires owner configuration and was not tested live. See the operational handoff for exact results and unresolved broader Python fixture failures.
