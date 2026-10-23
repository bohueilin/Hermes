# FleetLab — SF completion, model lessons and next-city handoff

For a presentation, use the [SF executive walkthrough](FLEETLAB_SF_EXECUTIVE_WALKTHROUGH_2026-10-05.md): a ten-minute route through the original site, paired experiment, fleet summary, replay and evidence limits.

**October 4 accepted scope:** [SF acceptance closure](FLEETLAB_SF_ACCEPTANCE_2026-10-04.md) is the current milestone. Static release and Git updates are authorized; Austin and new scientific execution are deferred. See the [current release record](FLEETLAB_SF_CLARITY_RELEASE_2026-10-04.md). Older proposal language below is historical, not approval.

**Current handoff — October 4, 2026:** [complete project record and resource/runtime
decision review](FLEETLAB_HANDOFF_2026-10-04.md). It supersedes older next-action
recommendations, including treating 4 GB as immutable for every future revision.
The site remains published; SF acceptance is HOLD; r3 and its budget are unapproved.
The record below preserves the September 30 engineering and publication history.

Updated 30 September 2026. San Francisco acceptance remains **HOLD**. This update adds
tested software and a concrete review workflow; it does not declare SF complete
or unlock Austin and Las Vegas. Original FleetLab sections, recordings, lesson
catalog and offline artifact are preserved.

The temporal atlas update is live at [FleetLab City Explorer](https://fleetlab.pages.dev/city-explorer/#atlas). Implementation commit: `cce2d723c225662b2808e57ef9ce8ced3b518c3a`; production deployment: `e37b4a7b-c60d-4a42-b705-ec6c0bf730e2`. See [the current publication record](FLEETLAB_TEMPORAL_PUBLICATION_2026-09-30.md) for validation and rollback. Packaged notes retain their pre-publication bytes; this local handoff records subsequent publication.

The third atlas choice exposes the complete temporal candidate and its review worksheet. The original recorded map, earlier static candidate, notebook/replay, Model lab and all root FleetLab sections remain. The source offer includes complete databases and the unchanged engineering recording. The failed verifier report is publicly projected with only its private traceback omitted, explicit original hash and limitations; original local bytes are unchanged.

Current software gates: 293 City Python, 54 City JavaScript and 1,661 root Python passes / 56 skips; Ruff and whitespace checks pass. Responsive checks cover 390, 1024 and 1280 CSS pixels. These do not satisfy physical-device or human acceptance. The Pixel remains absent from ADB.

## 30 September engineering continuation

[Static fleet integration and its measured validation](FLEETLAB_SF_CONTINUITY_VALIDATION_2026-09-30.md)
are now implemented locally: 29 new integration tests, 223 City Python passes,
and 400 fixed SF route searches with retained return history. 380 found routes;
20 reported no modeled continuation; both algorithms agreed. Routing peak memory
was 1,535,672,320 bytes. This is not a new fleet study or a new deployment.
The subsequent [temporal integration checkpoint](FLEETLAB_TEMPORAL_INTEGRATION_V3.md)
adds a source-bound importer, time-dependent routing, fleet execution and an
independent temporal verifier. The local candidate accounts for all 69,027 source
ways and reduces unsupported eligible length from 1.322% to 0.987%; all road-class
fractions now meet the unchanged 5% threshold. It also newly blocks 141 ways whose
access details were unsupported. District coverage and human review remain open.
The fixed routing check now completes all 300 OD contexts with both algorithms
and retained return history: 1,098 routes and 84 no-continuation results across
1,182 searches, with no unsupported searches or cost/status disagreement.
The earlier 248/300 state-budget failure remains preserved. Feature-specific
time bounds and reviewed bounded caches improve search performance; a reviewed
cycle regression prevents dropping a valid later arrival. The temporal resource checkpoint City suite
had 262 passes. [Full fleet resource qualification](FLEETLAB_SF_TEMPORAL_RESOURCE_2026-09-30.md)
now completes the fixed 100-vehicle, 1,200-request, eight-hour case: execution
peaked at 2.170 GB and independent verification at 2.061 GB, both within 30 minutes.
The original invalid verifier report is preserved; two reproduced arithmetic
defects were corrected and the same unchanged recording now verifies with zero
findings. No further simulation was needed for that correction. This candidate
is now selectable in the public atlas, without replacing recorded results. All 12 frozen power-study source
files remain unchanged. Austin is now the next requested city after SF acceptance;
San Mateo preparation remains background.

[The connector contract](FLEETLAB_DEPOT_CONNECTOR_CONTRACT_V1.md) now has a separate
model 4 fleet entrypoint and independent verifier. Twelve focused fixtures cover
actual source-edge circulation, accounted cost, preserved state through depot
service, partial traversal, stale reviews, active closures and prohibited reversals.
Independent review found a fabricated same-endpoint loop could evade the connector
check; the reproduced regression now rejects it. No SF connector was enabled and
no private-yard geometry or maneuver feasibility is claimed. Frozen v1 remains
unchanged; v2/v3 reject new connector declarations explicitly.

[Versioned temporal packaging](FLEETLAB_TEMPORAL_CANDIDATE_BUNDLE_V1.md) is now
implemented and measured. The complete map bundle preserves the exact graph from
the completed engineering case. Final validation plus a fresh review workspace
peaked at 3.256 GB and took 19.637 seconds. Its current 2,160 obligations include
200 source-way and 100 OD samples; zero human observations are recorded. The old
v2 review package still reproduces byte-for-byte. The new bundle and worksheet
are now in the public viewer and complete source offer. The prior packaging
checkpoint had 286 City Python tests, 1,661 root passes / 56 skips and 49 City Node tests.
Independent review findings were reproduced and fixed before this checkpoint.

[New district research](FLEETLAB_SF_DISTRICT_RECONCILIATION_2026-09-30.md) located the
official final redistricting map before water-area trimming. Full-inventory
comparison leaves 49 boundary differences / 441.926 m; it also identifies five
pool nodes whose municipal membership would change. Source redistribution,
explicit boundary policy and new review obligations must be resolved before
adoption. No road or demand node has been silently reassigned or excluded.

## Retained Model lab and review workflow from the preceding release

City Explorer gains **Model lab**, alongside Start here, City atlas, Decision
notebook and Replay studio. Twelve anonymous arithmetic cases compare 100, 200,
400 and 800 grid kW against 20, 40 and 80 battery kW of vehicle acceptance. Eight
active ports, 50 grid kW per port and 90% efficiency are explicit assumptions.
The lesson separates battery energy, grid energy, losses, recharge time and the
limiting resource. It is a single service-block calculation, not a new SF fleet
experiment, calibrated vehicle class or operator comparison.

Three direction fixtures separate body orientation, forward/reverse choices and
declared permission. A prohibited exit remains unavailable even for a symmetric
vehicle. Rectangles and supplied dwell costs are illustrative; no swept path,
steering, collision, accessibility clearance or safety outcome is computed.

The atlas now provides a frozen review package: 829 original queue entries,
200 class-stratified source ways and 100 OD pairs, totaling 1,129 obligations.
Some entries concern the same source feature; they are not 1,129 independent
observations. The worksheet contains no fabricated reviewer answers.

The review validator checks exact candidate/source/requirements identities,
embedded captured evidence, append-only manifest history, an independently
retained checkpoint, complete conflict references and frozen resolver roles.
Automated observations cannot fill the human sample. Claimed reviewer identities
remain unauthenticated. Passing this validator alone cannot qualify a map.

## Power study: retained incomplete evaluation

The memory revision `sf-power-headroom-v1-r2` preserves the original scientific
controls, six A/A+B/B × 200/400 kW configurations, 4 GB memory and 2 GB routing-table
limits. All 28 input tapes were frozen before execution. Its protocol digest is
`9a738e81dec4c14b1b6e2a000cb1c4cf4833a005445e1b3e1e9caddb57ceaa3a`.

All 24 new preflight arms completed, were internally consistent and had no hard
violations. Execution peak memory was 2,344,648,704 bytes. Fresh preflight analysis
was COMPLETE. The first launcher accidentally analyzed preflight twice in one
process and hit the resource stop before creating an evaluation arm. That failure
is retained separately.

The owner explicitly approved one fresh-process retry without the redundant
analysis. It completed the first scheduled arm, then stopped at **4,046,569,472
bytes**, above the unchanged **4,000,000,000-byte** limit. The remaining **143 of
144** arms were not run. The website reports execution status, with the primary
estimate unavailable. It does not pool preflight results, extrapolate one arm,
replace seeds or advertise a completed power study.

No further execution is authorized under this frozen stop rule. A future repair
must first qualify the entire execution and packaging memory path, preserve the
observed arm and failures, then declare a reviewed protocol amendment and any
additional compute before execution. Prefer separating verification and execution
lifetimes at process boundaries; do not merely increase the memory threshold.

## SF completion checklist — actual disposition

| Work | Implemented / observed | Still required |
|---|---|---|
| Cross-leg continuity | Versioned engines retain history through stops and fractional final edges; the fixed full-fleet engineering case completes and independently verifies within resource limits | Connector model 4 now has explicit source-edge circulation and independent verification fixtures. No SF connector has been declared or qualified; one diagnostic case is not map acceptance or a complete scientific evaluation. |
| Conditional semantics | Local temporal importer/router and independently verified full-fleet case evaluate daily, weekday and overnight conditions at actual traversal times; original sf-v1/sf-v2 remain unchanged | Complete candidate, viewer projection and corresponding source offer are now published. Unsupported grammar stays blocked; district and independent review remain open. |
| Priority source review | All 26 priority ways reconciled automatically; captured Lombard fixtures and supported access windows integrated in the new candidate; all class fractions below 5% | Actual independent source review against the candidate-specific requirements, district scope and unresolved malformed/missing source topology. No human observations supplied. |
| District scope | Versioned administrative proposal now accounts for all source roads, preserves the exact graph and 220-node/1,200-request/100-vehicle tape, and reproduces the 49 differences / 441.926 m; 56 new obligations remain unreviewed | Resolve full-source redistribution terms and remaining OSM/administrative boundary differences, then record adoption. Original published gaps and map qualification remain unchanged. See [the report](FLEETLAB_SF_ADMINISTRATIVE_REPORT_2026-09-30.md). |
| Reviewer workflow | Runtime validator and separate frozen sample/worksheet for each candidate; current temporal workspace is r2 | Actual 200-feature and 100-OD inspection, exception resolutions and independently recorded observations against the corresponding candidate. Human observations supplied: zero. |
| Power experiment | 24 preflight arms, complete preflight analysis; one evaluation arm retained | Resolve the new resource stop under an explicit amendment before completing the 24 six-arm blocks. No primary result available. |
| Devices/accessibility | Desktop automated checks; Pixel authorization and unlocked state observed | Physical touch/zoom/playback, landscape, enlarged text and screen-reader session. Other phone apps regained foreground during attempted checks, and the final ADB listing contained no connected device; no physical pass claimed. |
| Comprehension | Five-visitor worksheet and independent scoring rubric prepared | Five actual visitors' answers, second scoring and revisions based on observed confusion. AI reviews are not participants. |
| Vehicle inputs | Anonymous energy/charge calculator; primary-source and rights register | Compatible measured usable energy, battery-side consumption, charge curves, accessibility/service dwell and dimensions before named classes. |
| Curb/depot maneuvers | Static direction/permission teaching fixtures | Current site geometry, permitted maneuvers, motion primitives and independently checked swept paths before maneuver results. |

## Source findings and data boundaries

The captured conditional Lombard subset affects 18 ways and is now covered by
source fixtures in the local temporal candidate. Its actual trunk unsupported
fraction is 3.10660%, including stricter access accounting across the full source;
the earlier 2.89244% figure was a subset-only arithmetic estimate. Two living
streets now have modeled daily access windows. The 07:00–15:00 shift crosses rule
boundaries, so route evaluation uses actual traversal times, not shift start.
The candidate still lacks district coverage and independent map qualification.

[DataSF Curbs and Islands](https://data.sf.gov/api/views/emxt-b6yg.json) has PDDL
metadata but is historical drawing-derived geometry that may differ from built
conditions. It is context, not a current as-built site survey. Inspected SFMTA
ArcGIS loading inventories did not provide a clear blanket redistribution license.

[Zoox's December 2020 launch release](https://www.globenewswire.com/news-release/2020/12/14/2144364/0/en/Zoox-Reveals-First-Look-at-Autonomous-Purpose-Built-Robotaxi.html)
gives dated manufacturer claims including 3.63 m length and 133 kWh battery. These
do not establish current-generation usable capacity, charging acceptance or duty
cycle. [Waymo's Ojai introduction](https://community.waymo.com/blog/2026/05/welcoming-riders-in-the-ojai/)
supports rider/accessibility design questions, not invented numeric parameters.
The recorded SF capacity field does not control charging or dispatch dynamics;
the verifier nevertheless uses it as an upper energy bound.

## Expansion decision — Austin next after SF

The current goal selects **Austin** next after SF acceptance. Earlier research
prepared **San Mateo municipality**, not San Mateo County or an operator service
area, as a bounded source/transfer probe; it remains in the California backlog. The county
municipal layer contains a distinct SAN MATEO incorporated feature (OBJECTID 24,
UNINCORPORATED 0, EPSG:2227). Rights and current boundary version must be resolved
before redistribution; no city geometry or fleet results are imported here.

The first transferable question should preserve an explicit generic fleet and
compare one depot decision under a new frozen geography/demand contract. Airport
curbs and neighboring municipalities require separate scope. Austin requires its own source, scope and experiment gates; Las Vegas follows
as separately qualified work. Japan likewise needs one bounded city/ward probe,
left-driving semantics and a local source contract.

## What is unfinished, and who can unblock it

**Engineering work remains:** resolve source/district scope and its versioned adoption policy.
The temporal bundle, viewer and complete source offer are integrated and published.
The explicit connector contract and fleet fixtures are implemented; site-specific
SF connectors remain undeclared. Temporal import/routing, static fleet continuity
and partial-edge verification are implemented and tested. Source policy, calibrated
inputs and the separate stopped-study execution repair remain engineering work. This release does not finish the
entire SF checklist.

**Independent evidence remains:** the frozen map sample needs actual inspection
and recorded findings; five visitors need to answer the comprehension worksheet,
with a second scorer. The Pixel needs to be reconnected and stay on the browser
long enough to observe touch, zoom, playback, landscape, enlarged text and
screen-reader behavior. Browser viewport checks cannot fill these requirements.

**The stopped study needs a concrete repair first:** preserve its existing arm,
protocol, source identities and failure records. Qualify a process-isolated
execution/verification design without silently resuming evaluation. Present the
measured memory evidence and exact amendment before requesting any further
scientific execution. The approved one-time retry has been consumed.

That read-only resource probe is now complete: full frozen capture, all 48,400
pool route pairs, and fresh verification/serialization of the stopped arm and
largest retained preflight record peaked at 2,736,013,312 bytes, with all 167
protected evidence files and twelve scientific source files unchanged. No engine
ran. The [process-isolation proposal](FLEETLAB_POWER_PROCESS_ISOLATION_PROPOSAL_2026-09-30.md)
specifies a new 24-preflight/144-evaluation revision with fresh seed blocks and
an explicit campaign ceiling. Its design/budget decision is pending; the worker
implementation, future execution memory and new results are not yet verified.

For the separate map-source question, an
[unsent clarification draft](FLEETLAB_SF_SOURCE_CLARIFICATION_DRAFT_2026-09-30.md)
identifies the exact full-layer service, missing reuse terms and administrative
source-version questions. No source owner has been contacted by this agent.

Named Ojai/Zoox fleet parameters and real maneuver claims also require compatible
measured inputs and appropriate validation. Public design references alone do
not fill those fields. Anonymous teaching examples remain useful while that
information is unavailable.

## Recommendation

Use the original recorded SF study, new temporal atlas and Model lab to explain
how assumptions, constraints and evidence shape a decision. Finish district
reconciliation and real review before claiming city acceptance.

## Top risks + mitigations

Do not treat one verified engineering case as a completed paired study or city acceptance. Keep stopped
studies incomplete. Keep manufacturer facts separate from calibration, and
source coverage separate from road permission. Preserve prior immutable maps,
traces, failures and viewer bundles so every change stays reviewable.

## Next 3 actions

1. Complete independent map and visitor sessions using the published worksheets;
   record actual observations against the frozen identities.
2. Resolve district adoption and qualify the distinct scientific-study execution
   path before proposing a power amendment; retain all existing results unchanged.
3. Record the SF acceptance decision, then begin Austin with its own source,
   scope and experiment contracts; retain other California cities and Las Vegas
   as subsequent work.
