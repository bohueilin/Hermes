# FleetLab street-network data

The Street lab uses a frozen, directed OpenStreetMap extract for a mesoscopic teaching model. Streets, node topology, available one-way/access tags, node-via turn restrictions and traffic-signal presence are source-derived. Demand, queue capacities, signal timing, driving behavior, incidents and some speed/lane inputs are modeled. This dataset does not establish legal navigation completeness, observed travel times, commercial AV operating permission, curb access, real-world safety or deployment authority.

## Source, attribution and reproduction

© OpenStreetMap contributors. The derived database is distributed under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). See [OpenStreetMap attribution and license](https://www.openstreetmap.org/copyright). No Google content contributes to this geometry or graph.

The bounded queries in `tools/street-map-data/` use the [Overpass API](https://overpass-api.de/api/interpreter). Downtown includes ordinary road classes through residential/unclassified; the larger corridor query includes motorway through secondary classes. The total bounding box is south 37.604, west −122.475, north 37.837, east −122.267. Ways are cut to source segments wholly within the box; there are no straight-line gap fillers.

The original downtown snapshot was captured at **2026-09-19 05:55:49 UTC**, and corridors at **05:56:34 UTC**. They are two source snapshots, not a single atomic observation. Checked-in queries pin these source timestamps for historical reproduction. The manifest records SHA-256 digests of both raw responses and the generated module.

From the repository root, use the Python 3.11 `hermes-dev` environment:

```sh
conda activate hermes-dev
python tools/street-map-data/fetch.py downtown
python tools/street-map-data/fetch.py corridors
python tools/street-map-data/extract.py
python -m unittest discover -s tools/street-map-data -p 'test_*.py'
node --test playground/fleetlab/test/street-network.test.mjs
```

The extractor uses only Python's standard library. Each source request is bounded to 40 MB and rejects Overpass error remarks. Raw source and detailed exclusion audits stay in ignored `artifacts/street-map/`. The source query, source timestamp, raw digest, derivation program and manifest are retained for reproducibility. Historical Overpass responses may have different byte formatting; rederive and inspect the resulting manifest if re-fetching.

The checked-in `sf-streets.js` module contains compact, lossless tables for the **derived graph**. The facade expands these tables into the immutable `STREET_NETWORK`. `streetMapDownload()` exports the entire attributed derived database used by the model: nodes, edges, geometries, source way tags, anchor offsets, hotspot sample routes, restrictions, assumptions, source timestamps and digests. It is not a copy of every raw OSM element returned by the broader queries.

## Retained graph and geographic scope

The current module is **328,545 bytes**, containing 1,646 nodes, 1,605 source ways, 1,863 geometric segments, 2,343 directed edges and 154 enforced turn pairs. The first all-pairs-alternates derivation was 431,675 bytes. Restricting penalized alternative selection to useful local origins reduced the payload while retaining real intersections and the regional journeys. This exceeds the initial 140 KB preference because a directed block-level graph preserves substantially more detail than the earlier undirected regional illustration.

Every edge is a consecutive chain within one source OSM way. Chains stop at shared source nodes, way endpoints, signal nodes and restriction-via nodes. Simplification removes intermediate shape points within a one-meter tolerance; coordinates are projected in kilometers and rounded to 0.1 meter. Endpoints retain exact source longitude/latitude. Length is computed from the original unsimplified coordinates. Rendered geometry and exact length may therefore differ slightly.

The graph retains shortest directed routes for every ordered anchor pair, selected penalized alternatives within downtown, the six hotspot corridors and real paths connecting those corridors. Genuine reverse-direction counterparts are retained only when source direction/access permits. A pruned street is unavailable to this model, even if it exists in the city.

| Hotspot ID | Local grouping | Sample journey |
| --- | --- | --- |
| `first` | 1st Street, Market approach toward Harrison/I-80 | 17 edges, 785 m |
| `harrison` | Harrison, Bryant, Essex and 4th near SoMa ramps | 35 edges, 1,944 m |
| `stockton` | Stockton/Post, Stockton Tunnel and Chinatown | 20 edges, 1,175 m |
| `van-ness` | General-traffic Van Ness carriageways, Market toward Lombard | 49 edges, 3,098 m |
| `embarcadero` | Ferry Building toward Oracle Park along The Embarcadero | 31 edges, 1,792 m |
| `lombard` | East of Van Ness through the crooked block | 9 edges, 863 m |

Groups use both exact source names and local geographic bounds. Their `sample_route` is the longest shortest legal modeled route confined to retained edges in that group. It supplies a deterministic corridor journey for synthetic background demand; it is not observed travel demand.

The required anchors are `fidi`, `soma`, `chinatown`, `van-ness`, `waterfront`, `lombard`, `sfo`, and `east-bay`; `oracle` adds a waterfront endpoint. Each is an explicitly chosen representative coordinate snapped to a reachable source node. The source-node ID, chosen coordinate and snap offset remain inspectable. All 72 distinct ordered anchor pairs are reachable.

SFO is a **modeled airport approach handoff**, approximately 538 m from the requested illustrative approach coordinate. It is not an official terminal pickup or commercial AV pickup authorization. East Bay is a **modeled Oakland-side street gateway**, approximately 79 m from the requested coordinate. It is not a curb reservation. The graph includes US 101, I-280 south from the waterfront to its actual US 101 connection, I-80 across the Bay Bridge and relevant Oakland I-880 approaches.

Illustrative free-flow geometric routes: Financial District→SFO 24.91 km and return 20.08 km; Financial District→Oakland gateway 14.60 km and return 14.14 km. Asymmetry follows retained directions and turn constraints. These are model routes, not recommended navigation or typical travel-time claims.

## Direction, access and restriction policy

The importer follows source way order for `oneway=yes`, reverses it for `oneway=-1`, honors explicit `oneway=no`, and applies default one-way travel to motorways and roundabout/circular junctions. It does not assume all motorway links are one-way. Motorcar-specific one-way tags override generic ones. See [OSM one-way semantics](https://wiki.openstreetmap.org/wiki/Key:oneway).

Access uses the most specific available motorcar→motor_vehicle→vehicle→access value. Only absent, yes, designated or permissive access is retained. Private, no, destination, delivery and other restrictive values are excluded conservatively. Direction-specific access further filters each direction. Conditional access/one-way ways and reversible/alternating ways are excluded. Transit-only ways tagged against ordinary motorcars are excluded; mapped bus-lane presence does not give simulated vehicles transit access. See [OSM access semantics](https://wiki.openstreetmap.org/wiki/Key:access).

Downtown San Francisco Market Street is excluded conservatively as a **model-scope choice**, not a statement of current law or pilot permissions. SFMTA announced a limited passenger loading pilot in 2025; eligibility and operating conditions are outside this frozen model. Sources: [SFMTA pilot announcement](https://www.sfmta.com/vi/node/44275) and [loading evaluation](https://www.sfmta.com/ar/node/44269).

The captured source contains 2,264 restriction relations. The importer implements usable unconditional **node-via** `no_*` and `only_*` restrictions with applicable motorcar exceptions. Routing state includes the incoming directed edge; rules apply both within a route and to a supplied `viaEdge` from the preceding journey. Same-way `no_u_turn` blocks reversal without blocking straight continuation. Multiple permitted target edges in an only-rule form a union. If a required only-turn points to an excluded or pruned edge, its source edge remains restricted and routing fails closed for that turn. See [OSM turn restriction relations](https://wiki.openstreetmap.org/wiki/Relation:restriction).

The raw-source exclusion audit records:

- 562 via-way or missing-via relations: not implemented.
- 144 time-conditional, on-red or otherwise unsupported restriction kinds: not implemented.
- 1 motorcar-excepted relation: correctly inapplicable to this profile.
- 9 malformed member sets: not implemented.
- 624 relations outside the access-filtered usable graph: no applicable transition.

Unsupported relation IDs are included in the download metadata; full raw members can be reproduced from the saved queries. No completeness claim follows from the implemented subset. Lane-specific turning rules, conditional permissions, barriers/access on non-signal nodes, temporary construction, live signal states, vehicle dimensions and vehicle-class operating limits are not fully modeled. When a permanent general restriction exists alongside a conditional exception, the permanent restriction is applied conservatively; the model does not infer the exception's timing.

## Sourced values and modeled fallback values

Each edge exposes `speed_source` and `lanes_source`. Numeric source maxspeed values, including mph→km/h conversion, are distinguished from a modeled highway-class fallback. Directional source lane counts are distinguished from a modeled split of total lanes, deduction of mapped PSV lanes, or fallback. Lane count is a queue-model input; actual usable capacity, commercial AV eligibility and lane-changing behavior are not established by that value.

OSM traffic-signal presence sets the directed edge's exit `signal` flag. Signal cycles, offsets, green time and discharge rate are synthetic inputs owned by the queue model. A missing signal tag does not establish that no real signal exists. The network performs no live source lookup and makes no speed-limit or signal-timing guarantee.

## Router and validation

`findStreetRoute(fromNode, toNode, {edgeCost, blockedEdges, viaEdge})` returns directed edge IDs, exact summed stored lengths and modeled free-flow seconds. Its default Dijkstra cost is length/speed; custom costs must be finite and nonnegative. The router uses incoming-edge state and deterministic edge-ID tie breaking, and applies imported turn restrictions before accepting transitions. A valid same-node route has zero length. Invalid nodes, incompatible incoming context and disconnected routes return unavailable with null values; no invented fallback geometry is produced.

Validation covers all ordered anchor pairs, explicit one-way/-1 extraction, source access precedence, real and fixture no/only turns, incoming-edge continuation, closures and alternate paths, zero-cost cycles, deterministic ordering, bounded geometry, exact endpoints, all hotspot samples, crooked Lombard geometry, source/fallback provenance, source attribution and immutable complete download. The runtime contains no external requests, time dependence, randomness or package dependencies.
