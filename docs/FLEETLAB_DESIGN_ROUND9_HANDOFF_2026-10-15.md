# FleetLab Round 9 handoff — October 15, 2026

## Scope and decisions

Round 9 audit §7 P0/P1 only: sourced industry context, the owner's approved founder story, Home wording and source-link conventions. No new lessons, model logic, fixtures, numerical studies, media assets or budget ceilings. P2 remains queued.

The supplied audit is a design brief, not evidence of its industry claims. Its §9 instruction to exclude uncertain claims takes precedence over reproducing all ten proposed notes. Each shipped claim was checked against public reporting or a primary source. Company statements are attributed to the company. These notes are editorial context, never calibration data or FleetLab simulation evidence.

| Item | Status | Decision |
|---|---|---|
| P0-1 external citation arrows | Done | OpenStreetMap and the official ODbL page use ↗. The original ODbL file was a local download, so it remains separately available as “local license copy ↓”. |
| P1-1 From the field | Could not implement all ten as written; component and seven supported topics implemented | Eight placements: rebalancing, dispatch, software delivery, plus Fleet day depot-count, staffing-readiness, upload, airport-preparation and cleaning. Every note has the explicit public-reporting label, a dated ↗ source and at most two body sentences. Three unsupported topics are held below. |
| P1-2 founder story | Done | Owner answered “Approve verbatim without the career sentence.” The two approved paragraphs appear directly below the About introduction, before section 01. No career sentence or biography additions. |
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

Presentation changes: `apps/fleetlab-city/hosted/visitor.mjs`, `visitor.css`, `map-sources.html`. Behavioral regression coverage: `apps/fleetlab-city/test/visitor-design.test.mjs`.

New tests first failed for the absent component, then passed: sourced evidence separation/idempotency/no run, and lesson transitions/removal for unsupported or generic frames. Independent code review found no actionable findings; that review did not independently revalidate sources or visual layout.

Local evidence: `build/fleetlab-city/validation/design-round9-20261015/`.

- Browser: all eight note placements checked at 1280×900 and 390×900; one note per placement, no horizontal overflow, 16 px body text. Real preset selection removed the previous lesson's note and retained the initial no-run state.
- About: one founder block, exact approved paragraphs, career sentence absent; desktop and phone screenshots saved.
- These are viewport checks, not physical Pixel or human-comprehension qualification.
- Teaching Node: 2,418 pass, 8 skipped, 1 TODO. Hosted Node: 101 pass. City Python: 345 pass. Hermes Python: 1,661 pass, 56 skipped. Total: 4,525 passing tests. Ruff and Git whitespace checks pass. Doctor: 17 PASS, 1 dirty-tree WARN, 1 optional display NOT_AVAILABLE.
- Package, deployment and live-readback results will be recorded after completion.

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

The first City test invocation used pytest, which is not installed in that project's environment; it ran no tests. The existing unittest suite is the accepted check. Removed only the obsolete, reproducible Round 7 temporary release to create build headroom; retained its manifests/receipt, the current Round 8 release and canonical scientific inputs.

## Release authority and remaining boundaries

The user's prior explicit GitHub/live publication authorization persists for this FleetLab website work and overrides the historical Phase 6 local-only Git rule for this release. Website publication is not permission to deploy a vehicle, policy or operational system. SF map/source, physical-device and human-comprehension qualification remain separate and open. Synthetic study status is unchanged.

## Recommendation, top risks and next 3 actions

Recommendation: ship the verified content subset; keep the three unsupported topics unpublished.

Top risks: readers could confuse industry reporting with simulation evidence, so labels, sources and model distinctions remain adjacent. Public facts age; keep their dates and reassess before updating. No human or real-device qualification is implied.

Next 3 actions:
1. Review the live Home, About and From the field notes with a first-time visitor.
2. Supply stronger primary evidence if the three held topics should be reconsidered.
3. Review the separate P2 proposal before building world cards, founder video, replay preview, mobile controls, charts, map overlays or D-06.
