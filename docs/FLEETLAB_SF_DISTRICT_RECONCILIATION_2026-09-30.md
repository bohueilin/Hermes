# San Francisco district source reconciliation

30 September 2026. Research status: **source candidate found; not adopted**.
The existing SF packs and their 108 gaps / 13.161 km remain unchanged. This note
records a stronger source and the remaining reconciliation work without assigning
roads to their nearest district or shrinking the service area to the mainland.

## Finding

The [DataSF 2022 district metadata](https://data.sf.gov/api/views/f2zs-jevy)
explicitly describes trimming the redistricting boundaries around water. Its
linked final-map application retains the underlying redistricting map, including
water areas. That difference explains most of the road gaps, including bridges.
Selecting the current DataSF endpoint alone cannot fix this: its metadata says
it currently uses the same 2022 geometry.

The reproducible source chain is:

1. DataSF dataset `f2zs-jevy` → official
   [final-map application](https://sfgov.maps.arcgis.com/apps/webappviewer/index.html?id=57159538a9a3422a9d22ef75d66565b6).
2. Application data → web map `2eadd28e56a749b3a0e05e17eb0439b9`.
3. The web map's visible **Final Map April 28 2022** layer → item
   `6c8455aa3abb4c33a8c78001d25ccf5b`, owned by `sfgov_agofo`.
4. [Underlying feature layer](https://services.arcgis.com/Zs2aNLFN00jrS4gG/arcgis/rest/services/Proposed_Final_Map_04_25_22_SHP/FeatureServer/0)
   → 11 district polygons, queried in EPSG:4326 without geometry simplification.

The service's older internal name contains “Proposed”; the final-map application's
April 28 layer title supplies its published context. Do not infer final adoption
from the internal filename alone. All application, item, layer and geometry
responses are captured locally with request URLs and SHA-256 values.

## Measured reconciliation

Intersecting the existing 108 gap geometries with the full map in EPSG:32610
reduces their uncovered length from **13,161.4277896 m to 360.7603490 m**.
**41** original gap records retain more than one millimeter uncovered. This is
an automated source comparison, not a new qualification pass.

A subsequent **full-inventory** comparison found **49** remaining records and
**441.9262952 m** uncovered. It is the appropriate broader result: checking only
the previous gap set would miss newly exposed boundary differences. All 11 source
polygons are valid, with no pairwise area overlap above one square millimeter.
The candidate's largest covered-district unsupported fraction is 2.481%, below
the unchanged 5% limit; remaining boundary differences still prevent acceptance.

The full district union contains 209 of 220 frozen pool nodes, compared with 212
inside the original OSM municipality. Four nodes change from inside to outside,
and one changes from outside to inside. Eleven nodes lie outside the full source;
124 historical requests touch one of them. That is **not** a count of newly
excluded requests: some nodes were already outside the original municipal
boundary. No node, request, route or denominator has been changed here.
The five changed nodes touch 60 requests and four initial vehicle placements;
55 requests change whether both endpoints are inside the administrative union.
Those counts must accompany any future scope decision.

The remainder includes small mismatches along the southern municipal boundary
and bridge ends. The original road/municipal geometry comes from OSM, whereas
the district geometry follows the redistricting source. Neither snapping nor
dropping those portions is an established reconciliation rule.

Captured full-map GeoJSON SHA-256:
`085cde730a5bd725d6c87234a5326c1d22c4a0f20a9147c24c24c9b822fb3c26`.
Evidence root: `build/fleetlab-city/research/district-reconciliation-20260930/`.
See `captures.json`, `full-map-gap-diagnostic.json`,
`full-inventory-diagnostic.json` and `pool-boundary-impact.json` for identities,
every remaining source way and before/after pool membership. The full-inventory
diagnostic retains its runnable script alongside the captured inputs.

## Other sources checked

The [Charter's district descriptions](https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_charter/0-0-0-4173)
place the Golden Gate Bridge in District 2 and the SF portion of the Bay Bridge
in District 6. They also include the relevant islands and water areas. This
supports the direction of the reconciliation, but does not resolve exact OSM
segment intersections. The text was read through the web tool; a direct download
returned HTTP 403, so there is no local HTML capture or invented content digest.

[DataSF's active street centerlines](https://data.sf.gov/d/3psu-pn9h) supply CNN
identities and district attributes derived from centroid overlay. A captured
110-row active-freeway query has two null district values: CNN `14248000` and
`14249000`, the western Bay Bridge directions. This source cannot independently
resolve every gap by a simple join. The separate street-name query also returns
ordinary streets containing “bridge”; its 62 rows are not 62 highway bridges.

DataSF centerline metadata states PDDL. The full-map ArcGIS item's license and
attribution fields are empty. The City's [2019 data policy](https://media.api.sf.gov/documents/Data_Policy_APPROVED_1.17.2019_0.pdf)
defines PDDL as the default for Open Data, with possible dataset exceptions;
it is supporting policy context, not a captured dataset-specific license grant.
Resolve the full layer's redistribution terms before public source packaging.

## Integration decision and next work

Prefer an explicit versioned administrative-boundary contract using the full
official source once provenance and rights are resolved. Keep three distinct
geometries: administrative reporting area, captured road context, and scenario
service area. Preserve full inventory IDs, old denominators, original boundary
disagreements and affected-request counts in a before/after report. Changing a
reporting boundary must not silently change routes, demand or experimental scope.

Before adoption, compare the full inventory, check overlaps and coverage, quantify
all roads and pool nodes affected, and retain unresolved differences explicitly.
Generate new review obligations bound to the new pack rather than transferring
old human-review claims. No source change grants road permission, resolves human
review, or completes San Francisco acceptance.
