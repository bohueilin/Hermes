# FleetLab: Google traffic estimates and CARLA reuse

Research checked 2026-09-19 UTC. Scope: optional local prototype and simulator research. No paid Google request was made, no credentials were inspected, and CARLA was not installed or run. The default FleetLab simulation remains synthetic and network-free.

## Optional Google Maps companion

`tools/fleetlab-traffic/` provides a separate local page for one origin/destination estimate. Its server holds `GOOGLE_MAPS_API_KEY`; the browser never receives the key. It starts **unconfigured** without a key, reports **configured, connection not tested** when one exists, and reports **connected** only after a successful estimate. Provider failures are explicit; missing durations never become zero.

The client calls the fixed Compute Routes endpoint with `DRIVE`, `TRAFFIC_AWARE_OPTIMAL`, an explicit UTC `departureTime`, and `BEST_GUESS`, `OPTIMISTIC`, or `PESSIMISTIC`. Google requires the optimal traffic routing preference for traffic models. These models are currently experimental; best guess may fall outside the other two models, so they are not confidence bounds. [Traffic model documentation](https://developers.google.com/maps/documentation/routes/traffic-model)

The field mask requests `routes.duration`, `routes.staticDuration`, `routes.distanceMeters`, and `fallbackInfo`. `duration` considers traffic; `staticDuration` excludes traffic on the same returned route. The client rejects incomplete or fallback responses instead of silently labeling them traffic-aware. The seven-day future limit is a **local product constraint**, not Google’s documented maximum for driving. Input accepts canonical UTC timestamps; the browser converts local time. [Compute Routes reference](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes)

### Run locally

Use Node.js 22 or later. From the repository root:

```sh
# Preview the unconfigured companion safely, regardless of inherited environment.
env -u GOOGLE_MAPS_API_KEY node tools/fleetlab-traffic/server.mjs
```

Open `http://127.0.0.1:8768`. There are no dependencies to install. The example route is San Francisco (37.7749, −122.4194) to San Jose (37.3382, −121.8863); choose a future departure. A page load only checks local configuration. Every estimate requires pressing **Request one estimate**.

For an authorized live session, first enable the Routes API and billing in the operator’s Google Cloud project, restrict the key to the Routes API and applicable server restrictions, and set an appropriate quota. Inject `GOOGLE_MAPS_API_KEY` into the server process through the operator’s secret manager or a hidden terminal prompt; do not paste it into source, a URL, a browser field, a screenshot, or a committed `.env` file. Then run `node tools/fleetlab-traffic/server.mjs`. No Maps JavaScript browser key is required. Google usage is billable according to its applicable plan and SKU; this prototype does not estimate a monetary budget. [API setup](https://developers.google.com/maps/documentation/routes/get-api-key), [usage and billing](https://developers.google.com/maps/documentation/routes/usage-and-billing)

The server binds only to `127.0.0.1`, checks the exact Host and same Origin, accepts one fixed JSON request schema, caps request bodies at 4 KB and provider responses at 64 KB, times out provider calls after 10 seconds, and makes no retries. It permits one concurrent estimate, six attempts per minute and thirty per process session, including failed provider attempts. Restarting resets these counters; they are accident controls, not durable billing enforcement. The server cannot protect against another process already controlling the operator’s machine.

### Attribution and data handling

Google content stays in an isolated **non-map result panel** with an unmodified official Google Maps logo, exact values, route coordinates and query time. It is never overlaid on FleetLab’s invented schematic. Google requires a Google Map when its route content is displayed on a map. The current attribution guidance uses **Google Maps**, with logo sizing, clear space and accessibility requirements. The checked-in logo is from the official attribution archive, not a recreated mark. [Routes policy and official logo download](https://developers.google.com/maps/documentation/routes/policies)

Requests send coordinates, departure and model to Google; Google also sees the server’s network address and configured account. The app uses no provider-response cache, persistent browser storage, telemetry, export or artifact ingestion. A result exists in memory for display; edits, clearing or leaving the page remove it. All responses have `Cache-Control: no-store`. Local privacy and terms pages link Google’s terms and privacy policy. **Those local pages are not publicly hosted policies:** before distributing a connected application, its operator must provide applicable publicly accessible Terms of Use and Privacy Policy and review the applicable regional agreement. This wave does not establish that operational prerequisite or account compliance. [Routes policy](https://developers.google.com/maps/documentation/routes/policies), [Google Maps terms](https://www.google.com/help/terms_maps/), [Google privacy policy](https://policies.google.com/privacy)

Validation command: `node --test tools/fleetlab-traffic/test/*.test.mjs`. Tests use synthetic provider responses and exercise actual local HTTP handling. No live connection, coverage or prediction accuracy has been verified.

## CARLA decision brief

**Decision:** retain the minute-step fleet/depot model for fleet counts, charging queues and operational capacity. Consider a separate CARLA pilot only when a decision depends on lane interactions, local motion, perception or sensor effects. This is an engineering recommendation about sufficient fidelity, not a claim that either simulator validates real-world safety.

| Question | Appropriate next step | CARLA reuse and limitation |
| --- | --- | --- |
| How many cars, chargers or depots serve a synthetic day? | FleetLab paired operational experiments | A 3D driving engine adds resource cost without replacing demand, depot service or energy calibration. |
| What is the predicted travel time for a real route and future departure? | Separate authorized Google Routes query | CARLA Traffic Manager generates simulated traffic; it is not an actual-road forecast service. |
| How do lane behavior, vehicle interactions and camera conditions affect a local driving scenario? | Bounded, version-pinned CARLA pilot | Reuse maps, actors, Traffic Manager, sensors and recorder; define decision metrics and calibration first. |
| Does city-network traffic assignment need local sensor detail? | Evaluate SUMO first; co-simulate a bounded area only if needed | CARLA’s official SUMO bridge synchronizes traffic with CARLA; map conversion, signal ownership and synchronization remain work. |

**Version and cost.** The official release page currently marks **0.9.16** as Latest; **0.10.0** separately introduced Unreal Engine 5.5 and Chaos physics. The repository maintains UE4 and UE5 branches and warns of significant differences. Do not pick by version number alone or mix APIs and binary packages. The UE5 README recommends a substantial Windows/Linux GPU workstation (32+ GB RAM and 16+ GB VRAM); this Mac workspace is not a validated runtime target. Some `latest` quick-start prose still names 0.9.15, illustrating documentation drift. [Releases](https://github.com/carla-simulator/carla/releases), [0.10.0 release](https://github.com/carla-simulator/carla/releases/tag/0.10.0), [repository requirements](https://github.com/carla-simulator/carla), [quick start](https://carla.readthedocs.io/en/latest/start_quickstart/)

**Reusable capabilities.** Traffic Manager controls simulated autopilot actors with adjustable behavior. Deterministic mode needs synchronized CARLA and Traffic Manager execution, the same conditions and a seed reset after each world reload. Pin versions, assets and timestep, then verify repeatability empirically; a seed alone is insufficient. Hybrid physics reduces cost by disabling physics outside a selected radius, which changes what physical conclusions are supportable. [Traffic Manager](https://carla.readthedocs.io/en/latest/adv_traffic_manager/), [synchrony and timestep](https://carla.readthedocs.io/en/latest/adv_synchrony_timestep/)

**Weather caveat.** The referenced CARLA world documentation says weather changes are visual and do not change physics. Rain-looking imagery is not calibrated wet-road friction, braking, energy use, demand or traffic delay. A future pilot must separately specify and validate any physical/behavioral weather coupling for its exact release; do not transfer this claim across engine versions without checking. FleetLab’s rain/heat effects remain explicit synthetic assumptions. [World and weather documentation](https://carla.readthedocs.io/en/latest/core_world/)

**Scenario and evidence reuse.** ScenarioRunner is an existing scenario-definition/execution project. The SUMO bridge supports traffic co-simulation, with OpenDRIVE/network conversion and explicit synchronization. CARLA’s recorder captures actor and traffic events for replay and can include additional physics/velocity information. Replay reconstructs a captured execution; it is not an independent authenticity check, and replay must end under explicit control because actors can switch to autopilot afterward. No CARLA recordings enter Hermes evidence in this wave. [ScenarioRunner](https://github.com/carla-simulator/scenario_runner), [SUMO co-simulation](https://carla.readthedocs.io/en/latest/adv_sumo/), [recorder](https://carla.readthedocs.io/en/latest/adv_recorder/)

**License.** CARLA-specific code is MIT; CARLA-specific assets are CC-BY. Unreal Engine and integrated dependencies have their own terms. Preserve notices and verify licenses for the chosen assets and release before redistribution. [CARLA license](https://github.com/carla-simulator/carla/blob/ue5-dev/LICENSE), [repository license inventory](https://github.com/carla-simulator/carla#licenses)

## Recommendation

Use the local companion for a clearly separate route estimate after account prerequisites are satisfied. Keep FleetLab’s default day simulation synthetic. Defer CARLA installation until a sensor or interaction question justifies its added fidelity and hardware cost.

## Top risks + mitigations

- **Misleading precision:** show exact provider fields and query context; keep synthetic assumptions distinct and avoid safety or actual-fleet claims.
- **Unexpected charges or location disclosure:** require explicit requests, protect server credentials, cap attempts and apply provider-side quotas; do not submit sensitive routes.
- **Version or fidelity drift:** pin CARLA/engine/maps before a pilot; test synchronized repeatability and explicitly model any weather physics.

## Next 3 actions

1. Review the unconfigured companion and its privacy/terms pages locally.
2. If live estimates are desired, complete the account, key restriction, quota and applicable policy prerequisites; perform one expressly authorized query and verify attribution and response semantics.
3. Define one CARLA decision question with acceptance metrics, hardware budget and release selection before authorizing an installation or integration.
