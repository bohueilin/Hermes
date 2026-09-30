# City Explorer redistribution preparation

29 September 2026. Local review record for the SF power/notebook build. No public City Explorer release or blanket license clearance is claimed.

## Sources and proposed treatment

| Material | Observed source / inventory | Treatment before publication |
|---|---|---|
| SF roads, municipal boundary, road identifiers and routing-derived geometry | Captured OSM snapshot 2026-09-29T06:06:17Z; source SHA-256 `8744a2e1fc36719f0ba0b9040664bd62b4d9df2719e65c2d14007c214e6a31e7` | Attribute OSM contributors and identify ODbL 1.0. Treat machine-readable road exports as OSM-derived data; do not label them solely as original artwork. |
| District polygons | Captured DataSF Supervisor Districts 2022, dataset `f2zs-jevy`; SHA-256 `086ad7af9684db480f15e6e8f19f52bac792cb8ec9e39c92ead2b3e835b41276`; recorded metadata CC0 1.0 | Retain DataSF provenance and captured metadata; distinguish district shapes from city/service boundaries. |
| Map renderer | Vendored MapLibre GL JS 6.11.2 | Retain BSD-3-Clause license at `vendor/LICENSE.txt`. No public OSM raster-tile service is used by this viewer. |
| Vehicle illustrations and interface | Project-authored vector assets in `apps/fleetlab-city/web/assets/`; system font stacks | Preserve original-art disclosure. Ojai/Zoox references remain illustrative concepts, without operator logos, measured specifications or endorsement. |
| Demand, depots, energy and experiment outputs | Synthetic generated inputs and recorded fleet model | Label operational assumptions synthetic. OSM-derived coordinates and route geometry retain their source context. A simulation result does not establish an operator outcome or road safety. |

## Why attribution alone is not the complete publication record

OSMF's guidance calls for readable attribution near interactive maps and license information with distributed databases. Existing atlas/replay markup includes a visible OSM copyright link, and the package includes `ATTRIBUTION.txt`. Legibility and presence must still be checked in the actual final desktop/mobile package. [OSMF attribution guidance](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines).

For a public derived database or a work based on one, the source-offer question is separate from credit text. Our proposed conservative approach is to offer the full corresponding derived map database, or complete machine-readable alterations and reproduction method, under the applicable ODbL terms. Do not assume that the currently exported road GeoJSON covers every relevant routing transformation or restriction record. [OSMF Produced Work guidance](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline), [OSMF licence FAQ](https://osmfoundation.org/wiki/Licence_and_Legal_FAQ).

## Export inventory to bind to the release

The current viewer exports recorded source/routing roads, candidate roads, municipal/district geometry, qualification and gap records, source metadata and OSM-derived vehicle routes. The power study adds synthetic summary data and six declared configurations of recorded routes for one predetermined seed. The final release manifest must identify the exact files and hashes; its attribution text is not a substitute for that inventory.

Before a public switch, prepare an accessible source-offer location or archive containing the corresponding map database/alterations, license notice, source snapshots or reproducible capture identity, transformation configuration/code version, and additional contents needed to reproduce the derived map. Review file limits and avoid publishing workstation paths or unrelated private material. Check that each actual exported database is covered and that the offer is reachable from the final package. This preparation has not yet published that offer.

## Current release disposition

- Local source/attribution inventory: recorded.
- Existing atlas/replay attribution links and vendor license: present in inspected source.
- Final release-bound inventory and visual attribution inspection: pending final package.
- Public derived-database/source offer: not published; publication preparation remains open.
- Public switch: not performed, consistent with the approved review-build scope.
