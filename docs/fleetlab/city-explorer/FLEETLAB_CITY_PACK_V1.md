# FleetLab city pack v1

September 29, 2026. Status: **unqualified local review pack**. This subsystem is independent of the Hermes evidence workbench and legacy FleetLab. It does not produce Hermes evidence bundles.

## Contract and provenance

The schema is `fleetlab.city-pack/1.0.0`; its structural definition is in `apps/fleetlab-city/schemas/city-pack-v1.schema.json`. Semantic qualification is separate from JSON validation.

The immutable bundle contains `manifest.json`, `graph.json`, `coverage.json`, `geometry.json`, `roads.geo.json`, `source-inventory.json`, and `import-config.json`. The manifest binds file bytes and SHA-256 digests; it is internally checkable, not authenticated. Scope is SIMULATION_ONLY, teaching status NOT_EVIDENCE, decision authority NONE.

| Source | Frozen identity | Rights/provenance |
|---|---|---|
| OpenStreetMap | Overpass snapshot `2026-09-29T06:06:17Z`; municipal relation 111968; query and hash in `config/sf-v1.json` | OSM contributors, ODbL 1.0; attribution required; publication of derived databases needs corresponding source/share-alike review |
| Official districts | DataSF Supervisor Districts (2022), `f2zs-jevy`, 11 polygons | Source metadata records CC0 1.0; retain attribution and source metadata |
| Operational facilities | Two geometric-rule-selected supported graph endpoints | Fictional; no operator facility, land availability or observed demand claim |
| Display/vehicle | Project-authored SVG; MapLibre GL JS 6.11.2, BSD-3-Clause | Generic illustration; no operator marks, vehicle specification or physical realism claim |

OSM source SHA-256: `8744a2e1fc36719f0ba0b9040664bd62b4d9df2719e65c2d14007c214e6a31e7`.
District source SHA-256: `086ad7af9684db480f15e6e8f19f52bac792cb8ec9e39c92ead2b3e835b41276`.
Original pack content digest: `5c604fa0c0af9355dd6851ec5f6f7cac16a00b3c296c08de318f468ac1d7e536`.

Retained snapshots, query, timestamps and source metadata live in `build/fleetlab-city/sources/`. A fresh live query is a new snapshot, not reproduction of this one. The importer refuses a mismatching source hash. Do not overwrite existing packs.

## Scope and accounting

The denominator is every highway-tagged way in the complete captured response, including recursive restriction/boundary dependencies. The response includes the SF municipality, islands and maritime boundary, plus a separately declared mainland routing buffer. Inventory records explicitly distinguish municipality, buffer and outside-buffer features. Nonmotor/private/restricted roads remain counted with exclusions. Source scope does not mean all features permit a passenger car.

| Disposition | Source ways |
|---|---:|
| Included | 21,528 |
| Excluded with reason | 46,957 |
| Unsupported | 542 |
| Total, before filtering | **69,027** |

Unsupported eligible road length is **1.9361676679344592%**. The overall ≤2% gate passes. Frozen ≤5% class gates fail for primary, trunk and living-street roads. Approximately **13,159 m** of municipal road length falls outside DataSF's trimmed district polygons and remains **UNASSIGNED**. That blocks district qualification; a synthetic label does not repair the official coverage gap.

The complete machine ledger includes counts and lengths by class/district. The 200 stratified source-ID checks and 100 automated OD routing checks are distinct from independent semantic map inspection, which is **NOT_RUN**. No failed class was deleted and no threshold was relaxed. City-wide operational recommendations remain blocked.

## Routing versus rendering

Canonical topology uses shared OSM node IDs. Geometry crossing does not create a junction. Directed edges preserve one-way direction and supported node-via turn restrictions; immediate U-turns are disallowed. Conditional/via-way or malformed restrictions conservatively block affected source ways. Restrictions that cannot be mapped are unsupported, never treated as permission.

Speeds are assumed free-flow class values, not posted limits, signal timing or congestion. Distances use a declared spherical geodesic (radius 6,371,008.8 m). Source/display coordinates are EPSG:4326; district intersection uses EPSG:32610. Round-trip checks establish numerical transformation accuracy only, not map positional accuracy. Left/right driving metadata exists; Japan traffic semantics have not been qualified.

The pure A* edge-state router and prepared SciPy 1.16.3 Dijkstra router agree on the 100 selected supported-graph OD checks, including unreachable results. The endpoint pool is synthetic and zone-balanced; no real demand distribution is inferred. Prepared-route tables have a 2 GB allocation guard.

Display GeoJSON is a projection of the inventory. Source roads, supported routing and scenario endpoints are separate layers. No basemap provider, buildings, terrain, sensors or 3D physics is present. The initial camera and flat fallback emphasize mainland SF; the source inventory remains the authoritative scope record. Changing a display layer does not change routes or results.

## Versioning and remaining work

The six v1 schemas reject unknown major versions; structural validation is not semantic verification. Migration must create a new immutable artifact with parent identity and converter version. Generated artifacts are ignored by Git and must travel with the source snapshots to reproduce the exact pack.

Required next qualification: independently inspect topology and restrictions; resolve the unsupported class distribution without hiding roads; reconcile official district coverage; qualify critical OD routes. Austin reuse and an early Tokyo ward import are follow-on work. Las Vegas follows an approved pickup model. MetaDrive scenes are justified by a driving-policy question; MuJoCo is appropriate only for a contact/actuator question. Neither is required to answer this operational depot question.
