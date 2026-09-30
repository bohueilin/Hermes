# San Francisco administrative scope — implementation and handoff

30 September 2026. **The reporting contract is implemented; SF acceptance remains HOLD.**
The live FleetLab release remains production `e37b4a7b`, including the temporal
atlas, original recordings, Overview animation and all original sections.
This local administrative proposal changes no routing graph, request or published map.

## What this resolves

The district problem was partly a source-footprint mismatch: the public DataSF
layer trims water areas, while the official final-map application retains a
larger district footprint. A separate administrative report now measures that
difference across the complete captured source inventory. It cannot silently
turn a new reporting boundary into a smaller fleet service area.

The implementation keeps three concepts distinct: municipal geometry used by
the existing importer, proposed administrative districts, and the complete frozen
scenario population. Each source segment is clipped before projection to
EPSG:32610. Repeated source segments retain their multiplicity. Roads shared by
two districts count once in the conserved partition; per-district memberships
explicitly disclose that they are not additive. No road is snapped or assigned
to its nearest district. Positive residuals remain accounted for even below
one millimeter.

The earlier whole-line diagnostic and this segmentwise implementation produce
the same material SF remainder. Segmentwise processing also handles backtracking
lines that a geometric union could collapse. It is a reporting measurement;
the historical graph's spherical length denominator remains unchanged.

## Actual measured outcome

| Item | Result |
|---|---:|
| Source inventory, all rows | 69,027 |
| Eligible source rows, including context outside municipality | 22,202 |
| Ineligible rows retained in identity/accounting | 46,825 |
| Frozen eligible graph denominator | 2,172,216.6215587733 m |
| Projected eligible portions inside original municipality | 2,157,301.7120086886 m |
| Exclusive proposed-district membership | 2,156,859.785713509 m |
| Shared-boundary portions in this captured SF data | 0 m |
| Remaining outside proposed districts | 441.92629517921876 m across 49 source ways |
| Projected captured road context outside original municipality | 244,889.6850262249 m |
| Largest per-district unsupported fraction among covered portions | 2.48091%, District 5 |
| Complete frozen input population retained | 220 nodes; 1,200 requests; 100 initial vehicles |
| Changed node membership | 5 nodes: four inside→outside, one outside→inside |
| Historical records touching those changed nodes | 60 requests; 4 initial vehicles |
| Requests changing whether both endpoints are inside | 55 |
| Nodes outside proposed union, including previously outside nodes | 11, touching 124 requests |
| New administrative review obligations | 56; zero actual observations |

All 49 remaining road portions have included routing status in the current
candidate. That is not an inconsistency: administrative attribution and modeled
route support answer different questions. Their unresolved attribution is retained;
this report does not permit a routing qualification or city-acceptance claim.
The 56 obligations cover 49 road differences, five changed nodes, source terms
and the adoption decision. They are additional to the existing 2,160 temporal
map-review obligations, not a substitute or a claim of 56 completed inspections.

## Reproducibility and validation

Implementation:
`apps/fleetlab-city/citylib/administrative_scope_v1.py`;
CLI: `apps/fleetlab-city/tools/administrative-scope.py`.
The CLI requires externally selected candidate, raw district, provenance and
input-tape identities. It refuses overlapping report/input paths and existing
outputs, checks inputs and tool sources again after computation, and writes a
separate immutable proposal. Validation recomputes every report member in a
fresh process. This is independent recapture/recomputation with the same
implementation, not a second independent geometry implementation or human review.

Evidence directory:
`build/fleetlab-city/research/administrative-scope-20260930/`.
`proposal-r2/` contains policy, source geometry/provenance, complete road accounting,
full population impact, requirements and a report with separate trust states.
`proposal-r1/` and its original process reports remain retained.
`inspection-worksheet-r1.csv` contains blank observation fields. Its rows are
derived from the frozen requirements; it is a convenience worksheet, not evidence.
The r1 and r2 proposal manifests are identical; r2 binds the corrected writer
and validator through its separate measured process reports.

- Candidate bundle: `8a927cba063febeb9edaf99f4ab0e0c05f9a8fe349fd192da9afcbc46355f198`.
- Full district raw source: `085cde730a5bd725d6c87234a5326c1d22c4a0f20a9147c24c24c9b822fb3c26`.
- Existing engineering input raw bytes: `88979b8934aae13caac48b3875f3fa61013f0dda9ba48723df25a19dc3040247`.
- Proposal manifest: `e12253efc6d9bc4868e646fe1ed8ff857be63d7dbbf3aa1fb9a8a523d497c79a`.
- Report digest: `85864c8a97ec2b3477877ed022208e779e116af7b4b1d5c4555193087358244b`.

The final full build took 32.439 seconds at 1,609,072,640 peak bytes. Fresh-process
recomputation took 31.083 seconds at 1,662,337,024 bytes. Both stayed below 4 GB
and retained identical input/source hashes. Final validation also checks the
proposal directory identity, complete inventory and all member hashes after
recomputation. No fleet simulation was run.
Tests cover conserved/shared/outer geometry, repeated segments, tiny residuals,
malformed source inventories, preserved request impacts, altered source/tape
identities, forged gates, immutable outputs and CLI capture/recomputation.
Final regression gates: 312 City Python tests; 54 City Node tests; 1,661 root
Python passes / 56 skips; Ruff and whitespace checks pass. Doctor reports 16
PASS, two environment/worktree WARNs and one optional NOT_AVAILABLE.

A fresh reviewer found three important filesystem-boundary defects. Six
regressions reproduced them before correction: parent-traversal aliases could
write into protected inputs or the proposal; late member changes could evade
validation; a concurrent empty destination could be replaced. The corrected
implementation rejects traversal, checks directory/member identities and hashes,
and publishes using an atomic no-replace system call. All 19 focused tests and
the full City suite pass after these fixes. The macOS primitive was checked
against the installed SDK and exercised here; the Linux branch was not executed
on this Mac. No minor findings were deferred.

The reviewer inspected the measured full-map reports; the author performed the
full-map recomputations. Source licensing/adoption, prior routing/fleet code and
real-world suitability were outside this bounded review and remain subject to
their separately stated evidence limits.

## Source and acceptance decisions still open

Fresh downloads of both current and 2022 DataSF geometry confirmed the trimmed
footprint. Searching all 120 returned official ArcGIS catalog matches found
licensed trimmed layers, but did not establish a redistribution grant for the
separate full final-map layer. Its item, application and web-map license fields
remain empty. The full geometry remains a local research input. See the
[source reconciliation](FLEETLAB_SF_DISTRICT_RECONCILIATION_2026-09-30.md) for
the official source chain and the distinction from the City's default data policy.

Source terms are **NOT_ESTABLISHED**, administrative adoption is **PROPOSED**,
authenticity is **NOT_AUTHENTICATED**, authority is **NONE**, and scope is
**SIMULATION_ONLY**. A source license does not itself settle the remaining
OSM/administrative boundary differences or supply independent inspections.

The latest `adb devices -l` check again returned no connected device. Physical
phone validation and actual visitor answers remain unrecorded. The one-time
power-study retry is already consumed; the stopped study and its 143 NOT_RUN
arms remain unchanged. All twelve frozen scientific source files still match
their approved checkpoint. No new public deployment was necessary for this
local reporting increment; the previously validated site remains live.
At 17:25 UTC, the homepage, City Explorer entry and current versioned viewer
were fetched from their public directory URLs and matched the retained stage
byte-for-byte (3/3). An earlier `urllib` attempt using explicit `index.html`
URLs returned HTTP 403; it is recorded separately and is not counted as a pass.
This small live check does not replace the prior complete 10,001-file release
readback. See `live-entry-smoke.json` in the local evidence directory.

**Recommendation:** use this complete exception list for a source/adoption
decision and actual review. Retain the published temporal map's HOLD label.

**Top risks + mitigations:** never translate fewer boundary gaps into a city
acceptance claim, shrink demand to make coverage pass, or copy a neighboring
dataset's license. Exact input identities, explicit exceptions and separate
review obligations keep those decisions visible.

**Next 3 actions:** resolve full-source terms and the 49 boundary exceptions;
record actual independent map/device/visitor observations; finish the separately
measured power-study repair and SF acceptance before advancing Austin.
