# FleetLab SF acceptance record — 4 October 2026

**Static site: LIVE AND VERIFIED. SF acceptance: HOLD. Austin: NOT_STARTED.** This is the canonical acceptance
record for the October 4 milestone. Engineering completion and static website
publication are separate from source qualification, human evidence and owner
acceptance. See the [dated handoff](FLEETLAB_HANDOFF_2026-10-04.md) for the full
product history and [release record](FLEETLAB_SF_CLARITY_RELEASE_2026-10-04.md)
for the actual build, tests, deployment and Git identities.

## Scope and decisions

The owner approved architecture B: versioned city packs, a browser viewer and a
separate simulation runner. Overview and its animation, Fleet Day, Street Lab,
learning catalog, owner contact and offline edition are preserved. City Explorer
remains an additional tab, beginning with SF.

The accepted work prompt makes **SF educational/city-pack acceptance** the next
milestone. Original-v1 power/location study completion, calibrated named vehicle
classes, and physical curb/depot maneuvers are explicitly deferred. Deferral is
neither success nor erasure of stopped/adverse records. The final user instruction
also authorizes static deployment and remote Git updates, superseding those two
restrictions in the attached prompt and the generic Phase 6 rules for this
FleetLab release only. No Hermes physical deployment or new scientific campaign
is authorized. No r3 freeze, 251-arm budget or Austin work is authorized.

## Acceptance matrix

| Requirement | Status / evidence | Accountable role and availability | Next action / dependency |
|---|---|---|---|
| Presentation and regression readiness | PASS for the focused fixes; exact results in release record | Codex implementation and independent code review | Retain reproducible tests and immutable release; source/human gates remain separate |
| Historical evidence and teaching-site preservation | Checked in release record; no new full-SF arm | Codex release engineering | Compare every preserved payload, frozen science and offline digest before publication |
| Full district source identity and redistribution | HOLD; `NOT_ESTABLISHED` / `PROPOSED` | Source steward plus source-rights reviewer; **unassigned** | Obtain dataset-specific evidence, using the unsent clarification draft; no full-geometry publication meanwhile |
| Temporal map semantics | NOT_RUN; 2,160 obligations, zero human observations/resolutions | Capable independent source reviewer, then eligible independent resolver; **unassigned** | Inspect frozen 200-way / 100-OD sample and all exception reasons; preserve conflict history |
| Administrative policy and residuals | HOLD; 56 obligations, zero observations | Source steward, GIS reviewer and scope decision owner; participation **pending** | Resolve rights/adoption, 49 residual ways, five membership changes; no silent reassignment |
| Physical device / accessibility | NOT_RUN; current ADB listing empty | Physical device tester and accessibility tester; **unassigned** | Use release-bound worksheet on Pixel and desktop; emulation is separate evidence |
| Visitor comprehension | NOT_RUN; no P1–P5 responses | Five independent visitors and two scorers; **unassigned** | Uncoached responses, independent rubric scores, visible disagreements and follow-up |
| Educational SF acceptance | HOLD / decision not recorded | Product owner Bo-Huei; decision **pending** | Review the above evidence, remaining limitations and any revision; record an explicit decision |
| Austin | NOT_STARTED | Future owner decision | Only after agreed SF acceptance; not part of this release |

These roles identify responsibility, not a claim that anyone has agreed to
participate. A static-site launch cannot supply missing human evidence. No
automated or AI review is counted as a human source observation.

## Two presentation corrections

At EV-001 / seed 1001 / configuration A, the queue starts at elapsed 9,389 s
(09:36:29). The last 15-second pose is 09:36:15 and still records turnaround.
The previous heading used this older sampled state while the explanation used
the event interval; the slider rounded the event to 9,390 s. The viewer now
uses the existing activity interval at the exact cursor time for operational
state, while explicitly labeling position-sample time and sampled state.
Positions and energy stay held between recorded samples; gaps stop playback.
The activity explanation now includes seconds. A terminal snapshot uses its own
final state/site without borrowing the preceding interval. No event, pose or total changed.

The original comparison now puts its **+2 percentage-point practical threshold**
beside +1.11 pp and the paired interval (approximately +0.70 to +1.55 pp), explaining
that the whole interval is below it. Historical `fleetlab.city-comparison/1.0.0`
payloads lack a threshold field; the display maps that exact known schema to
the existing margin in `citylib/compare.py:decide`. Unknown schemas, incompatible
or malformed/missing primary evidence remain unavailable. This is descriptive
context, not a new decision rule. Map qualification remains a separate gate;
adverse sensitivities and the stopped power study's missing estimate remain.

## Source identity and recommended boundary policy

The local fuller proposal is
`build/fleetlab-city/research/administrative-scope-20260930/proposal-r2/`.
Manifest SHA-256:
`e12253efc6d9bc4868e646fe1ed8ff857be63d7dbbf3aa1fb9a8a523d497c79a`.
Raw district capture SHA-256:
`085cde730a5bd725d6c87234a5326c1d22c4a0f20a9147c24c24c9b822fb3c26`.

The source chain is DataSF `f2zs-jevy` → official app
`57159538a9a3422a9d22ef75d66565b6` → webmap
`2eadd28e56a749b3a0e05e17eb0439b9` → item
`6c8455aa3abb4c33a8c78001d25ccf5b` (captured owner `sfgov_agofo`) →
[Proposed_Final_Map_04_25_22_SHP/FeatureServer/0](https://services.arcgis.com/Zs2aNLFN00jrS4gG/arcgis/rest/services/Proposed_Final_Map_04_25_22_SHP/FeatureServer/0).
The capture date is September 30, 2026; exact UTC capture time was not retained.
The exact captured versions and metadata remain in the September 30 research
and proposal provenance. A later web response cannot replace their identities.

| Official source | What it establishes | What it leaves unresolved |
|---|---|---|
| [Task Force final report](https://media.api.sf.gov/documents/2021-2022_San_Francisco_Redistricting_Task_Force_-_Final_Report.pdf), Introduction, Work of the Task Force and Appendix A | Adoption on April 28, 2022; final-map context | Exact mapping from adopted decision to captured service bytes and present version |
| [DataSF terms](https://data.sf.gov/terms-of-use) | Portal data terms and possible dataset-specific conditions | Applicability and attribution for this separately hosted full ArcGIS layer |
| [City data policy, 2019](https://media.api.sf.gov/documents/Data_Policy_APPROVED_1.17.2019_0.pdf), §§2.0, 2.2.5 | Portal-linked Open Data definition, default PDDL policy with exceptions | A dataset-specific grant for the exact fuller geometry |
| Captured official ArcGIS chain | Provenance linking the official application and service | Empty license fields prove neither permission nor prohibition |

**Recommendation:** preserve the existing municipal scenario boundary, complete
input tape and graph denominators. Consider the fuller polygons as a **separate
administrative reporting overlay**, only after exact rights/version evidence and
policy review. Keep disputed/unassigned portions explicit. Do not replace the
service-area population with the district union or snap roads into districts.
Any future change to demand eligibility requires a new scenario version and
prospectively declared experiment, not edits to past results.

The proposal clips each original segment in EPSG:4326 before EPSG:32610
projection, retaining multiplicity. Snap tolerance is zero. Shared district
memberships are explicitly non-additive. Its 0.001 m display threshold does not
discard positive residuals. The **49 full-inventory residual ways / 441.926295 m**
are different from the old **108-gap** inventory against trimmed polygons; neither
list supersedes the other's historical meaning. Projected municipal length is
2,157,301.712 m; the original graph denominator is 2,172,216.622 m. They are
different measurements, not interchangeable estimates of improvement.

| Pool node | Original municipal membership → full district union |
|---|---|
| 1378125524 | Outside → inside district 10 |
| 373402111 | Inside → outside |
| 373402400 | Inside → outside |
| 65357336 | Inside → outside |
| 767854095 | Inside → outside |

The five changed nodes touch 60 requests and four initial vehicles (EV-028,
EV-029, EV-053, EV-056); 55 requests change the both-endpoints-inside predicate.
All 220 pool nodes, 1,200 requests and 100 initial vehicles remain present.
The proposed union's 11 outside pool nodes touch 124 requests **including
previously outside nodes**, not 124 newly affected requests. District reporting
could change without improving service; filtering these inputs would change
the experimental population and denominators.

The [source-owner draft](FLEETLAB_SF_SOURCE_CLARIFICATION_DRAFT_2026-09-30.md)
is refined and **UNSENT**. Needed answers: exact reuse/redistribution and required
attribution; authoritative adopted version corresponding to these bytes or a
licensed equivalent; intended administrative use of bridge/border context.
UI fixes, testing, frozen-source review preparation and public release using
already offered sources can proceed independently. Unresolved full geometry
remains local and is absent from the public source offer.

## Review batches and closure evidence

The frozen temporal workspace is
`build/fleetlab-city/reviews/sf-temporal-v3-review-r2/`.
Canonical requirements digest:
`4d43fb2d932b01da27d16055774dfe1b6de141ce342e1a74d9f0248b689c5ac8`.
Requirements **file** SHA-256 (different serialization identity):
`259ee01c8e49891e8617641b2d2adc8b4f7b969272663469e0c96fc958666b1d`.
Retained history checkpoint:
`b1f184bdf132ebd64074333a6036ce747ac33816b5f310822c6b34f90b548ffb`.
Candidate pack: `8a927cba063febeb9edaf99f4ab0e0c05f9a8fe349fd192da9afcbc46355f198`.
Graph: `426201012c7caae963fd71215b38967fbaa46ff18ce43376f729bbd212961de3`.
Checklist: `6ba7354f8b38aca5e3fd655d23c9c068439f06603c770ca02fa03f61ef37f82a`.
Sources: `5e53cd3ab0f955b3f7f89dd17b48ecd13f6f1720ba34ff7ef13fe363829d8e04`.

Assignment files are local, generated review aids at
`build/fleetlab-city/validation/sf-acceptance-20261004/review-batches/`:

- `README.md`: clickable batch directory; `index.json`: source identities and each CSV digest.
- `segment-01.csv` … `segment-08.csv`: 25 frozen ways each, 200 total; all original class strata retained.
- `od-01.csv` … `od-10.csv`: ten frozen OD cases each, 100 total.
- `exception-01.csv` … `exception-38.csv`: remaining 1,860 obligations, up to 50 per batch.
- Four `admin-*.csv` files: 49 residual ways, five membership changes, one source-terms and one adoption decision.

All 2,160 temporal IDs occur exactly once across the 56 temporal batches. Original
reasons, source links, independent-resolution requirements and permitted resolver
roles are retained. Each of the 56 administrative rows retains its complete frozen
obligation. There are 60 batches overall, all **UNASSIGNED / NOT_RUN**. Index SHA-256:
`5852cd4f72d2cdfdd9e041f38e76567648a41df0351b7ba63abae3c9d9ede490`.
The 13 protected review/proposal files were hash-checked unchanged when batching.

The source queue has 1,868 entries; sample/reason overlaps merge into obligations.
Adding queue and sample counts would overcount. Multiple reasons or district
memberships do not create independent observations. Administrative overlap with
a temporal way should share evidence references while retaining each obligation's
distinct decision. No conflict history was deleted or rewritten.

Reviewers need competence in OSM direction/access/restriction semantics, temporal
conditions and graph route continuity; administrative reviewers also need GIS
projection/boundary accounting experience. Inspect captured tags and revisions,
restriction member order and conditional meaning, unsupported handling, route
continuity across legs and time boundaries, and source-versus-assumption labels.
For each prescribed OD, inspect its specified endpoints and route/unavailability
against the frozen graph, without substituting easier endpoints. Resolve every
merged reason, not only the sample checkbox. Administrative review inspects each
of the 49 exact residual segments and five nodes against named geometry and
policy, including population effects.

Closure requires actual dated observations with captured supporting evidence,
claim IDs, candidate/source identities, reviewer method/role, interpretation and
residual uncertainty. Submit new append-only evidence through the installed
`map-review.py` workflow; use the [result contract](FLEETLAB_MAP_REVIEW_RESULT_CONTRACT_V1.md)
and runtime schema rather than editing frozen requirements. Use a new output
workspace and retain the expected history checkpoint. Contradictions remain open
until an eligible independent resolver references the complete conflict set.
Reviewer declarations remain `NOT_AUTHENTICATED`; the validator checks contract
consistency, not who performed an inspection. Batch completion alone never changes
qualification. The administrative proposal's separate rights/policy observations
must also be recorded and assessed; they are not silently accepted by the
temporal validator.

## Devices, visitors and acceptance decision

Use the [release-bound device worksheet](FLEETLAB_SF_DEVICE_ACCEPTANCE_2026-10-04.md)
and [five-visitor worksheet](FLEETLAB_SF_VALIDATION_SESSION.md). On October 4,
`adb devices -l` returned no attached device. Earlier user permission persists,
but actual Pixel availability was not established. Browser viewport checks are
engineering evidence only. No physical or participant pass is inferred.

Before acceptance, the owner reviews exact release identity, completed source/map
requirements, actual device/accessibility findings, uncoached visitor responses,
both scorer records and unresolved disagreements. Record the decision, scope,
evidence references, residual-risk owner and date. A HOLD lists remaining actions;
an educational acceptance must still avoid operator endorsement, road safety,
regulatory or physical deployment claims. Deferred future studies remain labeled.

**Recommendation:** use the improved site for transparent educational review;
keep SF acceptance HOLD until the matrix has actual evidence and an owner decision.

**Top risks + mitigations:** confusing engineering publication with acceptance
→ separate statuses; boundary changes that improve metrics by dropping demand
→ preserve tapes/denominators; duplicated review credit → stable obligations and
append-only conflicts; polished visuals implying operator validation → persistent
simulation/source limits.

**Next 3 actions:** assign source/map reviewers using the batches; collect physical
device and five-visitor evidence on the exact release; record the SF acceptance
decision before considering another city.
