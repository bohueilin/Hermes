# FleetLab City Explorer integration release

## Atlas, fleet insights and owner contact enhancement

Owner requested these additions, final handoff updates and live publication.
The screenshot defect came from an absolute label anchored to a grid-stretched
map card. A dedicated map stage now contains the overlay, with controls and
attribution in normal flow; the card no longer inherits the sidebar height.
The hosted footer adds Bo-Huei Lin and `mailto:bohueilin@gmail.com`.

Replay now starts with a complete-fleet summary before individual vehicle stories.
It includes every vehicle, uses summed empty distance / summed distance, and
expresses queue time over all vehicle-hours. A trip-count distribution, median,
mean, range and charging-queue end count explain the spread. Missing/invalid
measurements produce unavailable output. Selection races and failures clear old
values. Generic vehicles are identities within one model, not different vehicle
types or independent statistical repeats.

Fresh checks: 35 City Node tests; 66 including established studio/routes;
122 City Python tests; Ruff and whitespace checks pass. All 24 fleet projections
agree with existing verified study metrics. The canonical clean build rechecks
the 34 original arms and passes file integrity, dependency and payload budgets.
Independent review found and resolved a missing packaging import, future-study
wording and a loader-fixture gap; final code review has no remaining findings.
The initial incomplete build was stopped and was never packaged or published.

Candidate combined stage: `build/fleetlab-city/launch-integration-v2/site`.
City release SHA-256: `0ab37cf658f68f19196197dd97d690f31a0feb82b7fa9c681eeac136caf901cd`.
9,937 staged files; 9,936 served files; 1,522,008,571 bytes. Initial compressed
City transfer: 1,870,418 bytes. Previous compatible City release `5f981b2f5ec0d9dd`
is retained. Map/experiment data is unchanged. The source offer was regenerated
for the packaging-code addition; all 58 archive members independently match,
manifest SHA-256 `17570ed71168c6876e565dbabef8916ab422642befbcd1dba0242cfde259e7d9`.

Local packaged Pages headers and payload checks pass. Desktop and 390/1024 CSS-px
checks show no overflow, label/control overlap or card blank space. Native email
link, repeat/layout switching and direct Play work. Physical Pixel is connected;
hosted preview, device and production results will be recorded below.

The user's website publication instruction supersedes the historical Phase 6
local-only rule for these static teaching pages. It does not alter Hermes
workbench boundaries, map qualification, study-execution approval or physical
deployment authority. Next-phase handoff: [FLEETLAB_NEXT_PHASE_BRIEF_V3.md](FLEETLAB_NEXT_PHASE_BRIEF_V3.md).

---

## Previous integration release (superseded after enhancement publication)

**LIVE AND VERIFIED:** <https://fleetlab.pages.dev/> ·
[San Francisco City Explorer](https://fleetlab.pages.dev/city-explorer/).
All 9,934 served production payloads match the checked local package.

29 September 2026 Pacific. Owner approved a new City Explorer tab, preservation of the established FleetLab site, validation and live publication. This record separates static website publication from scientific qualification and operational authority.

## Product and preservation

- Root Overview, its original concept film, Fleet day, Street lab, Four-area experiments, Scale lab, all 59 Learning catalog lessons, Product approach and guided walkthrough remain.
- City Explorer follows Fleet day in main navigation. The existing Explore menu contains it at narrow widths. Overview includes one San Francisco card; Learning catalog includes a separate recorded-study entry.
- `/city-explorer/` forwards query/hash to a versioned self-contained viewer. FleetLab branding and Back to FleetLab return to `/#/overview`; Start here remains City Explorer's internal home. No iframe, shared simulation state or root redirect.
- Only established hosted `index.html`, `boot.js` and `_headers` are intentionally changed. The other 96 files and the separate offline edition retain their exact bytes. City data loads only after navigating to City Explorer.
- The initial release contains the reviewed twelve-pair depot study and five sensitivities. The separate power-study evaluation remains held pending its execution amendment. No new power results are invented or published.

## Sources and evidence

`/city-explorer/sources/` offers the complete sf-v1 and sf-v2 map databases, captured OSM/DataSF sources, transformation code, configuration, notices and exact archive-member SHA-256 inventory. OSM-derived map data retains ODbL 1.0; DataSF district metadata records CC0; software retains Apache 2.0 and MapLibre retains its BSD notice. All 58 archive members were independently byte-verified. This records actual redistribution treatment, not a blanket legal certification.

Map qualification is still incomplete. Cross-leg route continuity, independent semantic review and participant usability validation are not resolved by publishing a learning website. Recorded outcomes remain diagnostic, synthetic and NOT_AUTHENTICATED; operational authority is NONE. The reviewer checked code/package integrity, not scientific claims outside the reviewed existing study.

## Validation recorded so far

- Fresh prelaunch public baseline: all 98 served files match preserved `dist/site`; effective baseline headers match.
- City Python suite: 122 pass; City plus focused established studio/route Node tests: 61 pass (including all 30 City tests). New packaging tests reject unexpected established-file mutation, changed bootstrap and altered source offer.
- Hosted DOM test mounts the real existing studio and verifies all 59 lesson cards, film node/content, old links and exactly one City entry/card/catalog addition.
- Existing hosted and offline distribution checks pass; offline 2,424,861 bytes. Root Ruff and diff whitespace checks pass.
- Independent final integration review: no Critical, Important or Minor findings. Browser/live checks remain the implementer's responsibility.
- Existing prior-turn evidence remains valid for unchanged code: 1,972 legacy Node tests pass, one TODO; 89 Hermes parity/boundary tests pass; all 34 original scientific arms reproduce exactly. Full Hermes baseline has two checkout-path byte-pin failures (1,660 pass/55 skipped); these were diagnosed and not weakened or relabeled green.
- Pixel is absent from `adb devices -l` during this integration. Responsive browser tests do not count as physical-device or human participant validation.

## Combined browser checks

Local Cloudflare Pages served the same combined tree with two parsed header rules. Root retains `connect-src none`; City receives one self-only CSP with the intended detach/replacement, not intersecting inherited policies. The Overview film renders/advances. All established navigation destinations remain accessible. Fleet day reproduces 95 completed + 176 unserved + 4 waiting + 9 in progress = 284 requests. Learning catalog retains all 59 cards plus a separately labeled City case.

At 390 CSS px, the document scroll width is 375 px (scrollbar excluded), with no horizontal overflow. Enter opens the existing Explore menu; every destination is at least 44 px high. City return links are 44 px high. Atlas zoom, 12 px attribution, native source download page, direct Play (07:00 → 08:09), and mobile flat-canvas replay (07:00 → 08:21) work. Stable entry preserves `?renderer=flat#replay`. Screenshots and observations are in `build/fleetlab-city/validation/integration/browser/`.

## Package and publication

Combined package: `build/fleetlab-city/launch-integration-v1/site`, 9,935 files, 1,521,993,264 bytes. City release SHA-256: `5f981b2f5ec0d9ddc4a5d9e691ad25b74e2bc27f6fe2a7b99dcf9d3a0fb684b1`. Prior City release: `920887f3fb0841b066f26a996d8c9c157fc47c1e9f2cff0b70837c069c80f0a2`. First-view gzip budget 1,867,147 B; largest individual file 22,272,149 B; largest replay pair gzip 9,869,801 B. All package checks pass. Publication and final production readback are complete; see the recorded deployment below. City `release.json` records its build's review scope; `review/integration-manifest.json` binds the intentional combined hosted inventory. The publication record below will identify the separate owner-authorized static website deployment.

## Rollback

Prior production: `f4018c2a-3127-4807-af90-3a4ae0f33faa`, source `e90764a`, immutable address <https://f4018c2a.fleetlab.pages.dev/>. Preserve its complete local `dist/site` and the offline edition. The combined release also retains the prior compatible City viewer in a versioned directory. Full-site rollback can restore that prior Pages production; City-only rollback can switch the stable entry to its staged prior viewer. Both are website reversals, not scientific evidence edits. A separate local rollback tree rewired the stable entry to v4 (`920887f3fb0841b0`); `?renderer=flat#replay` survived and Play advanced 07:00 → 08:12. The current release tree was never modified for that rehearsal.

## Decisions and limits

The owner's latest instruction overrides the earlier preparation-only publication boundary for this static FleetLab website. It does not change Hermes workbench restrictions or confer physical deployment authority. Hosted-only additions avoid changing old engine/offline bytes. Separate review-phase artifacts remain immutable, even where their build-time publication field reads NOT_PERFORMED. The source archive offer is complete and checked; no independent legal opinion is claimed.

## Upload transport diagnosis

Two normal Wrangler 4.135.0 preview uploads failed with `write EPIPE` /
connection resets while posting asset batches; the second reached 7,331 of
9,934 uploadable files. Neither created a deployment or changed production.
A task-local copy of the pinned tool reduces only its upload bucket from
40 MiB to 8 MiB and concurrency from three to one. Individual files still
respect the official 25 MiB ceiling. Authentication, API destinations, asset
hashing, manifest creation and website bytes are unchanged. The original
installed tool remains untouched. Exact before/after tool hashes and logs
are retained under `validation/integration/deploy-transport-patch.json`.

## Hosted preview observations

Preview: <https://b0325c67.fleetlab.pages.dev/>. The serial upload completed
9,934/9,934 files (9,838 newly uploaded; 96 reused) in 329.31 seconds, then
Cloudflare created the deployment. The hosted Overview film advances; the SF
card and City tab navigate correctly; Play advances 07:00 → 11:49; the
configuration switch shows A versus A+B; fare estimates remain unavailable
until supplied by the visitor; Back to FleetLab returns to the main site.

Effective root/City CSP and security headers pass. Requests for a 64-byte
range on replay JSON and the film return HTTP 200 with the complete correct
body, not 206. The previous production film behaves identically. City replay
uses whole-file reads and does not depend on ranges; the film also plays.
The local build's Range capability record does not describe Cloudflare's
observed behavior. No claim of hosted partial-content support is made.


## Final production result

- Production deployment: `b592d5a8-c89c-4b42-99ca-e6d256bd2408`.
- Immutable URL: <https://b592d5a8.fleetlab.pages.dev/>.
- Implementation source commit: `32360657e2e400663bb213848460ff895988662c`.
- Standard Wrangler 4.135.0 uploaded zero new files: all 9,934 assets were reused from the verified preview. Root headers were submitted with the same checked bytes.
- Full preview readback: 9,934/9,934 matching payloads; full production readback: 9,934/9,934 matching payloads. Effective root and City security headers pass.
- Integration-manifest SHA-256: `e67dad5932831347265ac7074bda8d29886f5b66111463043a011d7b1033a0d4`.
- Fresh production browser checks confirm the Overview film, City tab, welcome, loading of the selected trace, direct Play through 15:00 with the Replay end state, and Back to FleetLab. The prior compatible City viewer and full-site production rollback remain available.
- Publication envelope: `build/fleetlab-city/launch-integration-v1/review/publication.json`; complete logs and byte readback are under `build/fleetlab-city/validation/integration/`.

No further owner decision was required for this release. Next work remains SF
map continuity and semantic qualification, physical Pixel/participant validation,
and the separate power-study execution amendment. All 27 scientific/model/config
source files compared against the reviewed checkpoint remain unchanged. No main
power-study result or map qualification pass was implied by publication.
