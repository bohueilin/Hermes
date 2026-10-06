# San Francisco map sources and engineering limits

This is a road-network learning model, not a navigation product. Buildings,
terrain, perception, physical contact and real driving control are outside scope.
Depots and operating parameters are fictional. The map is not qualified for
operator decisions or public-road use.

## Sources and reproducibility

Road geometry and source identities come from OpenStreetMap, with ODbL 1.0
attribution. The captured DataSF 2022 supervisor-district layer (`f2zs-jevy`)
is recorded as CC0 1.0. Dates, digests, coverage and limitations are available
in the [catalogue](../data/catalog.json). The complete published database offer,
licenses and attribution are available in [Map data & licenses](/city-explorer/sources/).
MapLibre provides the map rendering; it is not the source of road qualification.

## District reconciliation

The DataSF layer describes boundaries trimmed around water. This leaves gaps
on some bridges and boundary roads when intersected with the captured OSM map.
The original 108 gap records total 13,161.4277896 metres. An official full-map
source reduces the uncovered length in that old gap set to 360.7603490 metres.
A broader full-inventory comparison finds 49 remaining records and
441.9262952 metres uncovered. These are different populations; neither result
is a qualification pass.

The source chain starts at [DataSF metadata](https://data.sf.gov/api/views/f2zs-jevy),
then the [official final-map application](https://sfgov.maps.arcgis.com/apps/webappviewer/index.html?id=57159538a9a3422a9d22ef75d66565b6),
its web map `2eadd28e56a749b3a0e05e17eb0439b9`, and the layer titled
“Final Map April 28 2022” (item `6c8455aa3abb4c33a8c78001d25ccf5b`).
The full-map redistribution grant remains unresolved; that geometry has not
been adopted into the public pack. No road is silently snapped or discarded.

The full administrative union contains 209 of 220 frozen pool nodes, compared
with 212 in the original municipality. Five nodes change membership, touching
60 requests and four initial vehicle placements; 55 requests change whether
both endpoints are inside. No recording, request denominator or route was changed.
These scope choices need explicit review before any new city recommendation.

## Time-aware candidate

The candidate preserves vehicle progress across travel, service and charging
boundaries. Conditional access is interpreted at model-local time; unsupported
syntax remains blocked. One synthetic engineering checkpoint verified after
two arithmetic reconstruction defects were corrected. The original recording
was not rerun to erase those failures. That check is not a depot comparison.

Read the [candidate summary](../data/temporal-summary.json) and
[human source checklist](../data/temporal-human-review.json). They retain exact
identities, engineering scope and unresolved obligations. A source-ID match or
numerical verifier result does not establish real-world road semantics.

The downloadable inspection worksheets are blank templates. Completed observations,
reviewer details and private working notes are deliberately not website assets.
