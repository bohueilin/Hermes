# FleetLab SF map qualification — research and implemented candidate

29 September 2026. This is a qualification improvement, not a claim of a complete navigable or operationally validated city. Original SF v1 experiment outputs remain frozen. SF v2 is a separate map candidate and is blocked from fleet execution.

## What changed and why

OpenStreetMap restrictions can span an ordered chain of ways. The earlier bounded profile conservatively blocked whole approach ways when it could not represent these. [OSM's relation specification](https://wiki.openstreetmap.org/wiki/Relation:restriction), [OSRM's graph representation](https://github.com/Project-OSRM/osrm-backend/wiki/Graph-representation) and [GraphHopper's turn-restriction documentation](https://github.com/graphhopper/graphhopper/blob/master/docs/core/turn-restrictions.md) support carrying incoming-edge or path state rather than treating routing as a node-only problem.

The new opt-in `edge-sequence/2.0.0` profile compiles uniquely connected, simple ordered chains into exact directed edge sequences. A* and prepared Dijkstra carry bounded prefix history; an independent path inspector compares sequences directly. Conditional, malformed, ambiguous or unrecognized forms stay blocked. There are explicit schema bounds, and the runner rejects both direct candidate execution and supplying a candidate router behind a v1 pack. No threshold was relaxed.

| Measure | Recorded SF v1 | Candidate SF v2 |
|---|---:|---:|
| Source roads accounted for | 69,027 | 69,027 |
| Unsupported eligible length | 1.936% | 1.322% |
| Primary class unsupported | 10.944% | 1.461% |
| Trunk class unsupported | 34.060% | 9.373% |
| Living-street class unsupported | 21.595% | 21.595% |
| Unsupported source road records | 542 | 332 |

411 roads are restored; stricter source parsing newly blocks 201 roads. This includes conditional-only restriction records that the old parser omitted. The candidate accounts for all 2,490 source restriction records and supports 431 compiled sequence rules. Restored access is a property of this declared parser/profile, not confirmation of current legal driving access.

The original v1 graph, coverage, source inventory, road display and geometry reproduce exactly under the preserved default profile. Its seed-1001 baseline also reproduces its exact run digest after execution-guard hardening. The old limitations are retained in the historical records; improved candidate coverage does not retroactively qualify old experiment results.

## District research: changing the endpoint does not resolve the gaps

Three official sources were fetched and frozen locally under `build/fleetlab-city/research/districts/`. We compared the exact projected SF v2 gap geometries against each layer in EPSG:32610.

| Official DataSF layer | Area of polygon union | Remaining candidate gap length |
|---|---:|---:|
| [2022 districts, f2zs-jevy](https://data.sfgov.org/d/f2zs-jevy) | 370.038441 km² | 13,161.427790 m |
| [Current districts, cqbw-m5m3](https://data.sfgov.org/d/cqbw-m5m3) | 370.038441 km² | 13,161.391342 m |
| [Trimmed current districts, hcgx-vtsb](https://data.sfgov.org/d/hcgx-vtsb) | 122.174125 km² | 13,161.426433 m |

The 2022 source metadata explicitly describes trimming around physical boundaries. The separately named trimmed-current layer removes additional non-contiguous territories. The current layer differs by only about 0.036 m over these gaps. It cannot resolve the issue by itself.

The candidate now exposes 108 exact gap geometries totaling 13.161 km. The earlier coverage report counts 101 gaps totaling about 13.159 km because it omits sub-metre missing fragments; both definitions are preserved. The largest uncovered road pieces are Bay Bridge mainline segments, around 2.69 km each. The UI sorts gaps by length, draws the selected gap, links the OSM way, and provides the full JSON review queue. Nearby district distances are diagnostic only and never become assignments.

To close this gate, obtain official jurisdiction/district mapping for these segments or approve an explicit analysis scope and denominator policy for roads outside district polygons. A scope change must receive a new pack/scenario version and newly verified experiments. Do not silently remove roads or use nearest-district attribution to manufacture a passing result.

## Useful tools and what they would actually solve

| Tool | Useful next application | Boundary |
|---|---|---|
| [GeoLibre](https://github.com/opengeos/GeoLibre) | A GIS review workbench for the exported roads, district polygons and gap geometries; compare layers and inspect candidate source records. | Uses MapLibre among its rendering options. Adding it as a runtime dependency would not resolve restriction semantics or source completeness. Keep it optional for authoring/review. |
| [SUMO](https://eclipse.dev/sumo/docs/) | Interacting traffic and queue propagation when the operational question requires congestion. | Requires a qualified restriction conversion and controller; the current FleetLab traffic audition is separate and not qualified. |
| [MetaDrive](https://metadrive-simulator.readthedocs.io/en/latest/) | Driving-scenario experiments where heading, surrounding traffic and policy behavior matter. | Needs a qualified scenario adapter and redistributable source data. Do not infer that an arbitrary SF graph is a validated driving scene. |
| [MuJoCo](https://mujoco.readthedocs.io/en/stable/overview.html) | Contact, actuator or physical-system experiments—for example a specific depot interaction. | Not the next dependency for a city-wide depot-placement decision. Vehicle dynamics need their own model and validation. |
| World-model rendering | Scenario ideation and visual inspection, provided rights/access and generation assumptions are documented. | Visual plausibility is not evidence of traffic, vehicle or safety validity. No world-model service was added. |

These are model-selection recommendations from documented capabilities, not tested integrations. No new paid service or hosting resource was created.

## Remaining qualification work

Trunk roads still exceed the 5% class threshold; 24 exceptions include conditional/malformed/unknown forms and unsupported via-way cases. Two living-street records remain unsupported, including Maiden Lane and Bridgeview Paseo. Human source review is not complete. Restriction history across distinct fleet legs also needs a contract: ending one trip cannot erase an applicable incoming turn obligation. The candidate runner is blocked until this is specified and verified.

Recommendation: use v2 to review source semantics and geometry while keeping the v1 experiment explicitly diagnostic.

Top risks + mitigations: misleading map completeness → visible per-class/district gates; mislabeling old results → separate candidate identity and execution rejection; unsupported operator realism → sourced reference gallery and separate future-model requirements.

Next 3 actions: review the prioritized source queue; settle district and cross-leg policies; rerun the frozen paired experiment only after the resulting pack passes its declared gates.
