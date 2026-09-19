# FleetLab Bay Area map data

The Bay Area view uses a frozen, attributed OpenStreetMap extract. It contains real representative place coordinates and road geometry connecting all 18 requested anchors. It is a compact operational teaching map, not a navigation service, municipality coverage map, operator geofence, airport pickup authorization, or source of live traffic.

## Attribution and license

**© OpenStreetMap contributors.** The derived database in `playground/fleetlab/src/data/bay-area-map.js` is distributed under **Open Database License 1.0 (ODbL)**. Preserve this notice, the in-view attribution and the availability of the derived database when distributing the map. The database license does not relabel the surrounding application code.

Sources: [OpenStreetMap copyright and license](https://www.openstreetmap.org/copyright), [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), [Overpass query language reference](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL), [Overpass endpoint](https://overpass-api.de/api/interpreter).

## Source and coverage

Retrieved September 19, 2026 UTC. The road response reports OSM database time `2026-09-19T02:37:34Z`; the public `retrieved` field records this frozen source snapshot timestamp. Separate place, coastline and road-name responses were collected in the same extraction session. They are not claimed to be an atomically authenticated database snapshot.

Road/coast query bounds: south 37.25, west −122.55, north 37.84, east −121.80. Roads select OSM `motorway`, `trunk`, `primary`, `secondary` and their link classes. Minor streets, private access, complete city polygons, road restrictions, terrain and buildings are absent. The place lookup uses a slightly wider bounded search; all 18 retained coordinates lie inside the road bounds.

The roads response contains 51,408 ways, from which 209,324 graph nodes fall within the extract. The largest undirected connected component contains 209,245 nodes. All representative places snap to that component. An unrelated 79-node component is excluded. The delivered corpus retains the union of shortest geometric paths between the 18 road anchors: 153 unordered pairs, 174 shared chains, 918 retained road vertices and provenance for 3,678 source ways. It includes 282 clipped coastline fragments. Those are lines, not water polygons; gaps or artificial closures must not be presented as sourced shoreline.

The named representative points are OSM place nodes. SFO and SJC are the bounding-box centers returned for their OSM airport ways, not terminal pickup points. San Mateo uses city node `1696924414`; another place node named San Mateo was deliberately excluded. Each exported place includes its exact upstream node/way URL.

| Place | Latitude | Longitude | Road-anchor offset, km |
| --- | ---: | ---: | ---: |
| San Francisco | 37.7879363 | −122.4075201 | 0.051918 |
| SFO Airport | 37.6217756 | −122.3789591 | 0.683440 |
| Daly City | 37.6904826 | −122.4726700 | 0.145898 |
| Colma | 37.6766864 | −122.4583500 | 0.008880 |
| Broadmoor | 37.6921166 | −122.4826042 | 0.781148 |
| Brisbane | 37.6871650 | −122.4027940 | 0.013218 |
| South San Francisco | 37.6535403 | −122.4168664 | 0.017174 |
| San Bruno | 37.6248536 | −122.4145986 | 0.043889 |
| Millbrae | 37.5989580 | −122.4009410 | 0.611833 |
| Burlingame | 37.5780965 | −122.3473099 | 0.249265 |
| San Mateo | 37.5629997 | −122.3253265 | 0.034673 |
| Menlo Park | 37.4519671 | −122.1779920 | 0.087310 |
| Palo Alto | 37.4443293 | −122.1598465 | 0.304121 |
| Los Altos | 37.3790629 | −122.1165780 | 0.200570 |
| Mountain View | 37.3893889 | −122.0832101 | 0.120707 |
| Sunnyvale | 37.3688301 | −122.0363490 | 0.020243 |
| San Jose | 37.3361663 | −121.8905910 | 0.001838 |
| SJC Airport | 37.3632145 | −121.9281466 | 0.413165 |

## Projection and routing policy

`projectBayArea(lon, lat)` returns `{x,y}` in kilometers, east and north respectively. The equirectangular projection uses origin (−122.55, 37.25), standard parallel 37.55° and mean Earth radius 6371.0088 km. Map bounds expose geographic limits plus `min_x`, `min_y`, `max_x`, `max_y`. This is a local drawing and distance approximation, not survey geometry.

Routes use actual consecutive OSM node connections before derivation. The graph is **undirected**: one-way streets, turn restrictions, access controls and road-user eligibility are intentionally unsupported. Reverse requests reuse exactly reversed geometry and the same distance. This is not a legal or drivable route recommendation.

Offline extraction computes Dijkstra shortest paths between all anchors, unions their edges, and collapses degree-two chains while retaining branches and anchors. Each chain retains all contributing OSM way identifiers. Douglas–Peucker simplification uses an 8-meter tolerance for roads and a 25-meter tolerance for coastline fragments. Every retained point comes from the source response. Simplification can replace small source bends with documented chords; no disconnected graph components are joined. Chain display names list up to three contributing source road names; `sources` contains the complete way provenance.

Returned distance is the sum of the projected, simplified route segments. It excludes access from the representative point to the snapped road anchor. There are no invented straight access lines and no provider travel-time estimates. As examples, the frozen corpus gives approximately 77.891 km San Francisco→San Jose, 22.292 km San Francisco→SFO, and 21.731 km Los Altos→SJC. These are illustrative corpus distances under the restrictions above, not recommended journeys.

## Public facade

Import from `playground/fleetlab/src/model/bay-area.js`:

- `BAY_AREA_PLACES`: `{id,label,lat,lon,x,y,kind,source,road_anchor}`. `road_anchor` has `{node_id,lat,lon,x,y,distance_km}`. Representative place and road anchor remain distinct.
- `BAY_AREA_MAP`: `{source,attribution,license,retrieved,bounds,roads,coastlines,limitations}`. A road has `{id,name,kind,source,sources,points}`. Coordinates in `points` and coastline lines are `[x,y]` kilometers.
- `bayAreaPlace(id)`: known immutable place or null.
- `bayAreaRoute(fromId,toId)`: `{id,from,to,distance_km,points,source,available,limitations}`. Unknown/disconnected anchors yield `available:false`, `distance_km:null`, and no points. Same-anchor routes have one point and zero distance. Each returned route gets fresh coordinate arrays; caller edits cannot mutate later results.
- `projectBayArea(lon,lat)`: finite geographic input only.

The runtime reads only the checked-in compact database. It does not fetch tiles, coordinates, routes, imagery or credentials. Congestion, weather, fleet performance, depots and operating rules belong to separately labeled simulation assumptions.

## Reproduction and refresh

The checked-in derived database itself is the distributed adapted OSM database. `tools/map-data/manifest.json` records its SHA-256, extraction counts and source-response SHA-256 values. The source download cache lives under ignored `artifacts/bay-area-map/`; raw responses are not placed in the browser package.

From repository root:

```sh
# Network refresh: live OSM responses may differ from the frozen data.
python tools/map-data/extract.py --fetch
# Derive topology and selected source-way list.
python tools/map-data/extract.py --derive
# Fetch labels only for retained source ways, then derive final data.
python tools/map-data/extract.py --labels
python tools/map-data/extract.py --derive
# Validate the public offline contract.
node --test playground/fleetlab/test/bay-area.test.mjs
```

The checked-in `places-query.txt`, `roads-query.txt`, `coast-query.txt` and `labels-query.txt` preserve the bounded upstream queries. Derivation from the same cached responses is deterministic. Refresh queries intentionally request the current provider database; matching an older frozen SHA requires the original cached responses, not a later live refresh. No fetch is needed to use the distributed dataset.

Each download is capped at 30,000,000 bytes and rejects Overpass error remarks. An initial full-tag road/coast response exceeded that cap and was abandoned; geometry-only road output succeeded at 27,523,250 bytes. Place, coast and retained-way-label responses were 31,902; 1,396,425; and 1,884,000 bytes. The final compact JavaScript database is 176,375 bytes, below its 300 KB budget.

## Validation scope

Focused tests exercise all 18 unique source coordinates, known SF/San Jose spatial ordering and separation, all 324 ordered anchor pairs, continuity of every route segment against the delivered road corpus, route distance accounting, explicit reversal policy, unknown-place handling, offline determinism, mutation isolation, map attribution and coastline availability. This validates the delivered geometry contract, not OSM ground truth, legal access, safety, real traffic or operating permission.

## Distribution in the playground

The map displays linked OpenStreetMap attribution and ODbL identification. **Download attributed map data** serializes the complete compact source database, including original coordinates, source IDs, shared road chains, route indexes, coastline fragments and license. The download works locally without a data service and is available in the static site and offline HTML. It is a copy, not a mutation of the frozen runtime geometry.
