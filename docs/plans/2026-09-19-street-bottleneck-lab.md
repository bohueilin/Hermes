# Street bottleneck lab: design and implementation plan

## User request and product decision
Enhance FleetLab from regional routes to block-level downtown San Francisco bottlenecks, the SFO corridor and cross-bay commuting. Make queues and fleet decisions understandable. The current explicit build request authorizes this new isolated teaching subsystem. Prior authorization covers publishing reviewed enhancements to the existing GitHub feature branch and Cloudflare playground. Historical local-only rules do not override that instruction; no core evidence/physical-system boundary changes.

## Chosen fidelity
A mesoscopic directed-road queue model: real OSM road geometry/topology and available access/one-way/turn tags, with synthetic demand, signals, capacities and incidents. Vehicles move along recorded edges, wait at link exits and cannot enter a full downstream link. This answers operational bottleneck questions without claiming driving physics, observed traffic, a legal navigation service or a calibrated digital twin. The user's 15–45 minute descriptions are stress-test motivation, not measured typical travel times.

Other approaches considered: a decorative delay overlay is inexpensive but cannot explain spillback; SUMO/CARLA can support richer traffic/driving fidelity but add substantial runtime and integration cost for this browser portfolio. Choose a transparent, tested road-queue model now with a documented SUMO calibration path.

## Experience
New Street lab navigation, concise question-first introduction and presets for bridge rush, curb blockage, waterfront event, Chinatown friction, Van Ness signals and Lombard tourism. Show full SF–SFO/East Bay context or focus a named hotspot. Native 3D AVs, road-name labels, queues and selected vehicle itinerary; replay pause/step/scrub. Fleet, background demand, incident severity and route-policy inputs; same-demand baseline/candidate comparison with completion, waiting, travel, queue, unfinished demand and empty-distance trade-offs. Explain operational actions as simulation policies, never street-control permissions.

## Architecture and contracts
1. Frozen compact OSM extract in `src/data/sf-streets.js`, only `src/model/street-network.js` imports it. Export nodes, directed edges, anchors, hotspots and turn-aware route finding. Real-source metadata and complete attributed-data download remain available offline.
2. `src/model/street-simulation.js`: deterministic demand and finite-capacity link queues, AV assignment, pickup/boarding/dropoff and explicit outside-network turnaround. Demand independent of routing policy; return unavailable when routing fails. No synthetic geographic connectors. Preserve previous two teaching models.
3. `src/ui/street-scene.js`: reuses native WebGL mesh primitives with street-scale geometry, optional flat fallback, names and queue overlays. `street-lab.js` owns controls, replay and projection only. `studio.js` adds one route and pauses the street replay on navigation.
4. Preserve static/offline packaging and network bans. Prefer compact data within 2 MiB offline budget; a measured, justified increase is permitted only if source completeness requires it and must be documented. Keep existing Python core/CI untouched.

## Task ownership
- Map implementer: source extraction, map facade, network tests, provenance. API brief defines exact stable ids and shapes. No UI or simulator edits.
- Root: simulator and invariant tests, street scene/UI/integration, research, docs, package boundaries, verification and publication.
- Independent reviewer: directed routing/queue conservation, comparison demand identity, partial-horizon reporting, UI/replay lifecycle and publication boundary.

## Acceptance
- All six named hotspot families selectable; real street labels and turn-aware routes across a bounded connected network.
- SF–SFO and East Bay routes distinct; airport/bridge boundaries explicit. Do not imply actual terminal or commercial AV access permissions.
- Queues accumulate under constrained discharge; downstream storage blocks upstream movement; AVs never travel against imported directions or prohibited modeled turns.
- Background vehicles compete with AVs for road capacity. Per-car trajectories stop during waits and advance along the actual used edge sequence.
- Repeated identical seed/settings reproduce demand/results; comparisons use identical exogenous arrivals/incidents. Vehicle/request conservation and unavailable values tested.
- Before/end-of-day requests, disconnected routes, horizon-censored work and policy trade-offs visible; no unsupported typical-minute claim or universal winner score.
- Browser desktop/phone, both bundles, all JS, focused Python boundaries/parity and lint pass. Document remaining model limitations and actual release identity.
