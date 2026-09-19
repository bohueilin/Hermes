# FleetLab Street lab

The Street lab connects a local street constraint to fleet availability and rider service. It adds a directed, block-level San Francisco network with distinct SFO and East Bay journeys, finite road queues, per-AV replay and a controlled routing comparison. It is an independent product exploration by Bo-Huei Lin, not a Waymo tool or a calibrated digital twin.

## Try the operating story

1. Open **Street lab**, keep **Bridge rush**, and choose **Start the street demo**.
2. Choose **Largest queue**. Select a queued First Street block, inspect upstream spillback and front-car exit wait, then follow an AV or step five seconds at a time.
3. Choose **Compare route policies**. Replay both policies and compare completed journeys, unfinished demand and empty distance. A routing improvement can impose another cost.

The other five cases are SoMa ramp feeders, Chinatown friction, Van Ness signals, a waterfront event and the Lombard visitor queue. Each is a parameterized capacity stress case on its named geography, not an independently calibrated traffic model.

## Product question and model choice

The question is whether a localized bottleneck consumes enough vehicle time to change service, and whether a different route policy improves the trade-off. A decorative traffic multiplier cannot show finite block storage or upstream spillback. A full sensor/driving simulator is unnecessary to demonstrate this operating mechanism.

This implementation uses a **mesoscopic road-link queue model**: individual AVs and background journeys traverse directed links, with FIFO discharge and finite storage. It does not simulate lane changes, individual pedestrian decisions, collisions, intersection conflict phases or vehicle control. Three-dimensional geometry is a presentation of the recorded model state. It does not add physical fidelity.

The existing models remain separate:

| Model | Decision scope | Principal gap |
| --- | --- | --- |
| Fleet day | Bay Area vehicle supply, battery and sequential depot work | Sparse undirected routes; no block queues |
| Street lab | Directed street congestion, pickup capacity and route trade-offs | Synthetic traffic; no charging or depot resource network |
| Regional experiments | Declared paired changes, uncertainty and guardrails on four invented areas | Different geography and operating scope |

The catalog now contains 50 cases and lessons: 12 Fleet day, six Street lab and 32 regional examples. Results from different models are not interchangeable.

## What is sourced

The frozen September 19, 2026 OSM extract contains 1,646 nodes, 2,343 directed edges and 154 enforced turn pairs. It retains US 101, I-280, the I-80 Bay Bridge and an Oakland-side connection, plus six downtown hotspot groups. All 72 distinct ordered pairs of the nine representative anchors are reachable. Full source identities, timestamps, extraction semantics and unsupported restrictions are in [the map data record](FLEETLAB_STREET_MAP_DATA.md).

SFO is an airport-approach handoff. East Bay is a modeled Oakland-side gateway. Neither endpoint identifies a permitted AV pickup zone or establishes commercial operating access. Real source geometry does not make all route restrictions complete or the trips suitable for navigation.

Public research supports the choice of mechanisms, with specific limits:

| Evidence | Design implication | What it does not establish |
| --- | --- | --- |
| [SFMTA Van Ness BRT](https://www.sfmta.com/projects/van-ness-bus-rapid-transit) describes separated transit lanes and transit signal priority. | General-traffic capacity and signal effects belong in the model; simulated AVs receive no bus-lane entitlement. | A typical 30–45 minute car journey or actual signal plan. |
| [SFCTA Lombard studies](https://www.sfcta.org/projects/lombard-crooked-street) document visitor-related congestion and study reservation approaches. | Local arrivals and constrained discharge can affect nearby streets; throughput and resident impact should be considered together. | Present-day measured wait distributions or an operating reservation system. |
| [SFMTA Market Street announcement](https://www.sfmta.com/vi/node/44275) and [loading evaluation](https://www.sfmta.com/ar/node/44269) describe a limited passenger-loading pilot beginning in 2025. | Exclude Market conservatively as model scope; do not claim that an older blanket access statement describes every current operator. | Complete current permissions, hours or vehicle eligibility. |
| [SUMO vehicle insertion](https://eclipse.dev/sumo/docs/Simulation/VehicleInsertion.html) retains departures when road space is unavailable. | Keep network-entry queues visible rather than dropping congestion-producing demand. | Equivalence between this custom engine and SUMO. |
| [SUMO routing](https://eclipse.dev/sumo/docs/Simulation/Routing.html) documents travel-time routing and rerouting mechanisms. | Queue state can inform route choice; policies need identical exogenous demand for a useful comparison. | A globally optimal fleet policy or a calibrated prediction. |

The user's quoted 15–45 minute delays motivate stress cases. They are not used as verified typical travel times, hard-coded per-trip delays or calibration targets. No blanket “best alternative street” is encoded: a route must exist in the directed subset and satisfy its supported restrictions. This also avoids presenting a route alternative without knowing its direction, current access or the congestion it would receive.

## Operating assumptions

| Input or rule | Implementation |
| --- | --- |
| Default scope | 120 minutes from a 16:00 clock label; 24 AVs; 36 rider requests/hour; 900 background journeys/hour; seed 42 |
| Time of day | Labels the replay. Arrival rates are constant; no additional automatic rush-hour factor. |
| Rider destinations | Before reversal: 40% SFO, 40% East Bay, 20% local. One in five journeys reverses origin/destination. Realized counts vary stochastically. |
| Origin emphasis | 60% at the selected hotspot's representative anchor, remainder across local anchors before reversal. |
| Background routes | 60% selected hotspot sample, 20% all hotspot samples, 20% selected origin to SFO/East Bay. Journeys enter and exit at modeled network boundaries. |
| Randomness | Separate seeded streams for rider gaps, rider OD choices, background gaps and background route choices. Extending duration preserves the arrival prefix; changing rider rate does not change background arrivals. |
| Resolution | Five-second road steps, deterministic edge ordering. Minimum one step per edge; short segments can add discretization delay. |
| Storage | At least one slot per edge, otherwise floor(length in meters × modeled lanes / 7.5). |
| Discharge | 0.32 vehicles/second/modeled lane, up to four lanes. Only fractional service opportunity carries between steps; unused whole departures are not banked through a red or blockage. |
| Signals | Tagged exit signals use a 90-second cycle, 45 seconds green, deterministic synthetic offsets. Missing tags are not evidence of an unsignalized real intersection. |
| Incident | Default 75% capacity loss across selected hotspot edges from minute 15 through minute 90. It changes discharge, not storage or a hard-coded trip delay. |
| Rain | 20% longer uncongested edge time and 15% lower discharge. These are independent teaching assumptions, not weather observations. |
| Dispatch | Oldest waiting requests first; choose the nearest available vehicle node by straight-line distance among reachable choices. Imported incoming-edge restrictions are preserved between legs. |
| Pickup | Two hypothetical off-road berths per anchor and 60 seconds boarding. Curb queues use AV time but do not block traffic lanes. |
| Patience | Unassigned requests expire after 30 minutes. Assigned/boarded work can remain unfinished at the horizon. |
| Turnaround | Eight minutes off-road after dropoff, at the same network node. No teleportation back to downtown and no charging/depot process is implied. |
| Vehicle types | Alternating I-PACE/Ojai illustrative bodies; identical road rules and capacity. Configurable battery/profile effects remain in Fleet day. |

All requests and background journeys with modeled arrival times strictly before the horizon are included. Full downstream storage stops the front vehicle and therefore the upstream FIFO. Pending road insertions remain counted. The end-state conservation identity is submitted road journeys = completed + on-road + pending, and rider requests = completed + expired + waiting + in-progress + unroutable.

Road queues are represented visually by colored links, bars and counts. Only AV bodies are rendered individually. Cars are enlarged; roads are flattened and styled in 3D. Overpasses retain graph connectivity but do not have sourced elevation. Roads crossing a close-up viewport remain visible even when their stored shape endpoints are outside it.

## Comparison and metric contracts

Free-flow routing minimizes stored length/speed. Queue-aware routing uses current travel inputs, a synthetic signal penalty, current queue/discharge estimates, a spillback penalty and the selected incident's capacity reduction. It makes that choice at each leg departure. It does not continuously reroute a vehicle already inside a queue.

Both policies receive identical rider arrivals, OD choices, background journeys and incident settings. Dispatch follows the same rule, although different vehicle availability leads to different assignments. A single seed demonstrates a mechanism; it cannot establish a statistically reliable policy advantage.

| Metric | Population and meaning |
| --- | --- |
| Completed journeys | Passenger legs completed within the selected horizon; gateway completion is not actual terminal curb service. |
| Pickup wait | Mean request-to-boarding-complete time for boarded riders, including pickup travel, berth wait and dwell. Riders never boarded are excluded and remain visible in counts. |
| Passenger leg time | Mean boarding-complete to dropoff for completed journeys only. Unfinished trips are excluded and reported separately. |
| Empty distance | Actual completed pickup distance plus traveled distance of partial pickup legs. No full-distance credit for unfinished movement. |
| Unavailable vehicle-minutes | Time in pickup, berth wait, boarding, passenger travel and turnaround, integrated over elapsed intervals. |
| Front-car exit wait | Current time beyond the front car's uncongested exit-ready time on one block; not total journey delay or an estimated queue clearance. |
| Peak queued vehicles | Exit-eligible cars waiting on road links at a recorded step, summed over the full network or selected hotspot. Entry queues are separate. |
| Blocked link-minutes | Sum of steps where a link's front car cannot enter a full downstream link; multiple blocked links count separately. This is a discrete end-of-step measure. |
| No route | An unavailable path is reported, never replaced by a straight-line connector. |

Boarded/completed cohorts can differ between policies. Interpret means with coverage, unfinished work and the associated counts. Displayed numbers are rounded; result downloads retain machine values, configuration, network version, requests and route IDs. The download is an experiment summary, not every replay frame or authenticated operational evidence.

## Implementation and review

`street-network.js` owns the frozen-data facade and turn-aware router. `street-queue.js` owns finite FIFO road links. `street-simulation.js` owns demand, fleet state and summaries. `street-scene.js` projects recorded trajectories; `street-lab.js` owns setup, replay and result presentation. All three website models pause when navigating away. A pending run respects a later pause; invalid replacements preserve the previous comparison and its export.

Independent review found and helped resolve fractional discharge loss, stale block inspection, failed-run comparison corruption, hidden autoplay and missing long road segments during close-up follow. Dedicated regression tests reproduce each issue. Catalog launches now focus their selected street before running.

The attributed directed extract adds approximately 329 KB. The measured offline artifact grew beyond the old 2 MiB cap, so its explicit budget is now **2.5 MiB (2,621,440 bytes)**. The static site remains below 2 MiB at implementation review. The checker still forbids arbitrary external URLs and runtime network connections; the only new URL exception is the exact OSM copyright link in inert source metadata. There is no new dependency, paid service, API key or Cloudflare function.

## Recommendation

Use this as the interview demonstration of decision framing: local constraints affect rider service and infrastructure planning, and a policy needs inspectable trade-offs. Keep the distinction between a useful mechanism demonstration and a decision-grade planning tool explicit.

## Top risks and mitigations

- **Uncalibrated traffic:** collect approved counts, travel distributions and turn movements; validate against held-out periods and report error bounds.
- **Incomplete road/curb rules:** review time-dependent restrictions, via-way rules, lane turns and actual access with authoritative data before treating routes as operational.
- **Model isolation:** Fleet day depot/energy results are not coupled to Street lab road queues. Integrate them through a versioned experiment contract before making combined capacity claims.
- **App performance:** experiments currently compute in the browser main thread after yielding for the status message. Longer/high-load runs can pause interaction; a dedicated worker is an appropriate next performance improvement.

## Next three actions

1. Use the default comparison in an interview: inspect First Street spillback, follow a gateway-bound rider, then explain the completion/empty-distance trade-off.
2. Calibrate one corridor first in SUMO using measured signals, turns and counts. Preserve shared demand and compare model error before expanding coverage.
3. Add curb access, repositioning and depot coupling as separate policy axes with repeated paired seeds and explicit service/energy guardrails. CARLA can complement this when a question needs sensor/driving-policy fidelity; no CARLA runtime is installed or embedded here.
