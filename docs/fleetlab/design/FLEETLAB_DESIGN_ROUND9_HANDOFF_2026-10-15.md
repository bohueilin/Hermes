# FleetLab Round 9 handoff — October 15, 2026

## Scope and decisions

Round 9 audit §7 P0/P1 only: sourced industry context, the owner's approved founder story, Home wording and source-link conventions. No new lessons, model logic, fixtures, numerical studies, media assets or budget ceilings. P2 remains queued.

The supplied audit is a design brief, not evidence of its industry claims. Its §9 instruction to exclude uncertain claims takes precedence over reproducing all ten proposed notes. Each shipped claim was checked against public reporting or a primary source. Company statements are attributed to the company. These notes are editorial context, never calibration data or FleetLab simulation evidence.

| Item | Status | Decision |
|---|---|---|
| P0-1 external citation arrows | Done | OpenStreetMap and the official ODbL page use ↗. The original ODbL file was a local download, so it remains separately available as “local license copy ↓”. |
| P1-1 From the field | Could not implement all ten as written; component and seven supported topics implemented | Eight placements: rebalancing, dispatch, software delivery, plus Fleet day depot-count, staffing-readiness, upload, airport-preparation and cleaning. Every note has the explicit public-reporting label, a dated ↗ source and at most two body sentences. Three unsupported topics are held below. |
| P1-2 founder story | Done; first paragraph updated by owner on October 15 | Owner initially approved the two-paragraph block without the career sentence, then supplied replacement wording for paragraph one. The owner-provided replacement appears directly below the About introduction, before section 01. Paragraph two and the absence of the career sentence are unchanged. |
| P1-3 Home value proposition | Done | Added the exact specified clause naming Waymo, Tesla and Zoox. Existing headline, animation, film and learning paths retained. |

Invented industry facts, numerical inputs and results: **none**. Supported notes are deliberately narrower paraphrases, not verbatim publication of unsupported audit text. On Fleet day, the note follows the active lesson introduction before controls; lessons do not each have a dedicated concept image. Notes update when the lesson changes and disappear for generic presets or unsupported topics. This uses the existing hosted presentation layer; offline teaching models remain unchanged.

## Finding-by-finding source decisions

| Proposed topic | Decision and source |
|---|---|
| Rebalancing | Narrowed: 43–45% applies from mid-2025 through December 2025, not the entire 86.3-million-mile data window. Includes pickup travel and repositioning. Removed “the industry's central optimization problem.” [MIT-authored Findings paper](https://doi.org/10.32866/001c.161870). |
| Dispatch | Narrowed to Reuters' repeated service checks in April 2026, not a distribution of actual rider waits. Removed the editorial algorithm-versus-availability claim. [Reuters, May 12, 2026, syndicated](https://www.investing.com/news/stock-market-news/teslas-robotaxi-rollout-features-texassized-wait-times-4679470). |
| Charging | Held. The 8–10 MW and 95% figures are vendor assertions, not established universal depot statistics. The audit itself excludes uncertain vendor claims. [Voltera interview](https://technologymagazine.com/news/the-unseen-race-to-power-autonomous-vehicle-fleets). No replacement numbers invented. |
| Depot count | Retained one company-attributed fact: Lyft's announced 80,000-square-foot Nashville AV depot. Removed the bundled Waymo/Avis claim and industry-wide conclusion. [Lyft, October 2, 2026](https://www.lyft.com/blog/posts/flexdrive-nashville-av-depot). |
| Staffing readiness | Retained Waymo's February 2026 statement about approximately 70 on-duty remote-assistance agents and 3,000 vehicles. Explicitly separates that job from modeled depot cleaning. Removed Cruise ratio comparison and the unverified SB 1246 mandate. [Waymo](https://waymo.com/blog/shorts/advice-not-control-the-role-of-remote-assistance/). |
| Software delivery / upload | Retained the NTT/NTT DOCOMO remote-video test, with an explicit distinction from depot transfers. Removed the claim that the modeled upload is legally mandated or establishes safety infrastructure. [NTT Technical Review, February 2025](https://www.ntt-review.jp/archive/ntttechnical.php?contents=ntr202502ra1.html). |
| Airport preparation | Retained the airport's announcement of Zoox service. Removed exclusivity, baggage-claim and comparative walking-time claims: the airport specifies garage Level Zero pickup locations. [Harry Reid International Airport, September 15, 2026](https://www.harryreidairport.com/newsroom/news-articles/las-has-a-new-way-to-ride-with-zoox). |
| Cleaning | One-sentence attributed statement; wider claim removed. [CBS News, November 9, 2023](https://www.cbsnews.com/sanfrancisco/news/cruise-contract-workers-laid-off-after-robotaxi-service-halted/). |
| Region launch | Held. The [official DVSA application service](https://aps.data.dvsa.gov.uk/) does not establish that zero permits had been issued. No legal-status claim or substitute fact published. |
| Capacity / data | Held. No adequate primary support located for the supplied Singapore/Taiwan combined claim about mapping and depot uploads. No substitute claim published. |

## Implementation and validation

Presentation changes: `apps/fleetlab-city/hosted/visitor.mjs`, `visitor.css`, `map-sources.html`, `site-transform.mjs`. Behavioral regression coverage: `apps/fleetlab-city/test/visitor-design.test.mjs` and `hosted-brand.test.mjs`.

New tests first failed for the absent component, then passed: sourced evidence separation/idempotency/no run, and lesson transitions/removal for unsupported or generic frames. Independent code review found no actionable findings; that review did not independently revalidate sources or visual layout.

Local evidence: `build/fleetlab-city/validation/design-round9-20261015/`.

- Browser: all eight note placements checked at 1280×900 and 390×900; one note per placement, no horizontal overflow, 16 px body text. Real preset selection removed the previous lesson's note and retained the initial no-run state.
- About: one founder block, exact approved paragraphs, career sentence absent; desktop and phone screenshots saved.
- These are viewport checks, not physical Pixel or human-comprehension qualification.
- Teaching Node: 2,418 pass, 8 skipped, 1 TODO. Hosted Node: 102 pass. City Python: 345 pass. Hermes Python: 1,661 pass, 56 skipped. Total: 4,526 passing tests. Ruff and Git whitespace checks pass. Doctor: 17 PASS, 1 dirty-tree WARN, 1 optional display NOT_AVAILABLE.
- After the frozen-source-page fix: all 102 hosted tests, 345 City tests and 7 package-proof tests were rerun and passed. The independent reviewer also checked the correction.
- Package proof, integrated budgets and the independent source-bound upload guard pass for 10,139 staged files. Final preview and stable production readback: **10,138/10,138** on each. Headers: **71/71** on each. Immutable production and prior production smoke: **102/102** on each.

Commands used include:

```sh
node --test playground/fleetlab/test/*.test.mjs
node --test apps/fleetlab-city/test/*.test.mjs
build/fleetlab-city/venv/bin/python -m unittest discover -s apps/fleetlab-city/tests
PYTHONPATH="$PWD/src" conda run -n hermes-dev python -m pytest -q
conda run -n hermes-dev python -m ruff check .
PYTHONPATH="$PWD/src" conda run -n hermes-dev python -m hermes doctor
git diff --check
```

The first preview (`e89fe25d`) exposed a P0 publication-path issue: the source page is copied from a frozen source offer, so changing the current template alone did not update it. Added a failing frozen-HTML test, then applied the citation-only correction in the source-bound hosted transform. Downloads and scientific data stay unchanged. This first preview was not promoted to production; the corrected candidate is rebuilt and checked separately.

The first City test invocation used pytest, which is not installed in that project's environment; it ran no tests. The existing unittest suite is the accepted check. Removed only the obsolete, reproducible Round 7 temporary release to create build headroom; retained its manifests/receipt, the current Round 8 release and canonical scientific inputs.

## Package budgets

| Measure | Bytes | Limit | Headroom |
|---|---:|---:|---:|
| Original teaching source + tools | 3,138,195 | 3,153,920 | 15,725 |
| Offline edition | 2,562,044 | 2,571,440 | 9,396 |
| Package metadata | 37,473 | 40,960 | 3,487 |
| Integrated emitted text | 3,102,933 | 3,145,728 | 42,795 |
| Integrated NF-03 dependency closure | 523,255 | 524,288 | 1,033 |

Captured teaching + integration original-source growth increased by 5,683 bytes. Runtime teaching source, offline bytes and media bytes are unchanged. No budget was increased. The 1,033-byte shared-code headroom is a constraint for the next round; trim or explicitly review packaging before adding more shared components.

## Publication observations

The first stable-host readback began during the production-alias transition and matched 9,663/10,138 files; 475 paths were mismatched (including new city-generation paths still returning 404). The first header check matched 70/71. Both negative records are retained as `production-readback-initial-propagation.*` and `production-headers-initial-propagation.*`. Direct probes then matched the new presentation module, publication record and city entrypoint. A fresh **complete** readback then matched **10,138/10,138**, with **71/71** headers; no partial results were stitched together and no gate was weakened.

The existing stable-host browser tab retained old shared presentation assets under the site's existing `max-age=600` policy, including after ordinary reload. Browser validation therefore also uses the immutable production URL, which shows the approved biography, Home copy, field note and source links. This is a cache/rollout limitation, not evidence that the old tab has updated. No cache-policy redesign is included in this content round. Open the immutable release link to inspect the exact new build immediately; an existing tab may need reloading after its cache expires.

## Release authority and remaining boundaries

The user's prior explicit GitHub/live publication authorization persists for this FleetLab website work and overrides the historical Phase 6 local-only Git rule for this release. Website publication is not permission to deploy a vehicle, policy or operational system. SF map/source, physical-device and human-comprehension qualification remain separate and open. Synthetic study status is unchanged.

## Final release

- Live: https://fleetlab.pages.dev/#/home
- Exact production build: https://37c0b185.fleetlab.pages.dev/#/approach
- Source commit: `32952a5d3dd3a0b633ab5edf2fb6d4efb6a6374a`; pushed to `github/codex/fleetlab-city-sf`.
- Production deployment: `37c0b185-b0da-439d-8079-2e1e420d64f0`.
- Verified preview: `25559f7c-9997-4c1d-8c96-76d31232bf52`.
- Prior production for rollback: `37ae8cf5-401b-4243-bb9a-f71fd045b83f`.
- Current city presentation: `city-explorer/releases/9cb607fc240201bb`. Scientific base remains `c56bda6b509105c5`.
- Served payload: 10,139 staged files, 1,626,097,385 bytes. `_headers` is hosting configuration, leaving 10,138 served files.
- Stable-host complete readback accepted at `2026-10-15T21:09:06.254270+00:00`.
- Receipt: `docs/releases/fleetlab-current.json`; records source identity, fingerprints, hosting checks and the complete-scan retry history.
- Production browser evidence: `production-browser.json`, `about-production.png`, `sources-production.png`. Viewport layouts and source decisions are documented above. Existing stable-host browser cache behavior is explicitly recorded under Publication observations.
- Owner's unrelated untracked assets/documents were preserved. The release checkout is temporary; no unrelated files were staged.

## Owner's founder-copy update — October 15, 2026

The owner replaced the first “Why I built this” paragraph verbatim with the 19+ year Cisco, Amazon Alexa, Riot Games and Meta narrative in `apps/fleetlab-city/hosted/visitor.mjs`. The second paragraph remains unchanged. This copy update changes no model, numerical result, lesson, asset or budget ceiling.

- Source commit: `adf19b102b8736b24c03af43f43a7031cb9d39d9`; pushed to `github/codex/fleetlab-city-sf`.
- Live About page: https://fleetlab.pages.dev/#/approach; exact production build: https://1e821956.fleetlab.pages.dev/#/approach.
- Production deployment: `1e821956-9836-44a5-88aa-5ee7f5171682`; verified preview: `f0726fbe-b0ac-4dd7-8913-dcc732032072`. The prior production deployment `37c0b185-b0da-439d-8079-2e1e420d64f0` remains the rollback point.
- The focused hosted design test passed 11/11. The source-bound package and upload guard passed with 10,139 staged files. Preview and stable production each matched 10,138/10,138 served files; hosting headers matched 71/71 on each. Immutable production and prior production smoke each matched 102/102.
- The first preview readback had one transient transport failure on an unchanged archived file; the direct hash check and fresh full scan passed. The first stable-host scan began during alias propagation and saw 114 temporary 404s in the newly generated City Explorer release; a fresh full scan passed. Both failed scans remain in `build/fleetlab-city/validation/founder-copy-20261015/`.
- Browser checks on desktop and 390 px phone width show the complete paragraph with no clipped text or horizontal overflow. Browser screenshots are in the same validation directory.
- The current publication receipt is `docs/releases/fleetlab-current.json`. The earlier Round 9 release data above remains a historical record, not the current production identity.

## Recommendation, top risks and next 3 actions

Recommendation: ship the verified content subset; keep the three unsupported topics unpublished.

Top risks: readers could confuse industry reporting with simulation evidence, so labels, sources and model distinctions remain adjacent. Public facts age; keep their dates and reassess before updating. No human or real-device qualification is implied.

Next 3 actions:
1. Review the live Home, About and From the field notes with a first-time visitor.
2. Supply stronger primary evidence if the three held topics should be reconsidered.
3. Review the separate P2 proposal before building world cards, founder video, replay preview, mobile controls, charts, map overlays or D-06.
