# FleetLab visitor experience — October 14, 2026

## Status and purpose

**Published and verified — October 14, 2026.** The owner reviewed the local preview and explicitly authorized GitHub push, live deployment, live validation and this handoff. The visitor design is live at [FleetLab Home](https://fleetlab.pages.dev/#/overview), [Explore](https://fleetlab.pages.dev/#/catalog) and [City Explorer](https://fleetlab.pages.dev/city-explorer/).

This implements the owner's request to make FleetLab easier to understand as an independent learning and passion project. Input: Muse's `CODEX_IMPLEMENTATION_PROMPT.md`. This document supersedes the deployment identity in the earlier October 14 artwork release handoff, while preserving its open SF, device, human-review and account-control limitations.

The intended first-visit understanding is: **FleetLab explores the operational work between autonomous rides. Pick a question, change one assumption, and inspect who benefits, who waits, and what the model does not establish.**

## Release and repository checkpoint

- Local preview: [Home](http://127.0.0.1:8778/#/overview), [Explore](http://127.0.0.1:8778/#/catalog), [City Explorer](http://127.0.0.1:8778/city-explorer/).
- Implementation commit: `86f8a13f487ee2137ddaf400931048d3485b53ea` on `codex/fleetlab-city-sf`, pushed to `bohueilin/Hermes` through remote `github`.
- Verified candidate: `build/fleetlab-city/visitor-20261014/reviewed/integrated-release/site`.
- Published City generation: `0650beefa2c93838`, derived from the retained original `c56bda6b509105c5`. Previous production City generation: `0c493355ecacbd36`.
- Logs, readback evidence, build recipe and screenshots: `build/fleetlab-city/validation/visitor-design-20261014/` (private generated files, not committed).
- Preview runs on port 8778 to avoid the earlier development preview's cached City switch page on port 8777. Use the links above.

| Release identity | Observed value |
|---|---|
| Production deployment | `5924764c-7dc2-4336-a7d4-94fe3e39a991` |
| Immutable production | https://5924764c.fleetlab.pages.dev |
| Preview deployment | `4c5b4876-0ecd-40e1-aaa1-67b2a0c425b4` |
| Immutable preview | https://4c5b4876.fleetlab.pages.dev |
| Previous production deployment | `f6c88a3b-9ac5-4f8d-bb47-b5960968be6e` |
| Production full readback completed, UTC | `2026-10-14T19:27:32.219980+00:00` |

Preview and production used the same verified stage without rebuilding between uploads. A clean temporary release checkout at the application commit satisfied the deployment guard; the owner's untracked source images and notes were preserved. The publication receipt and this handoff are in a later documentation-only commit, not a different deployed application. Exact digests and sampled file identities are in [the updated release receipt](releases/fleetlab-current.json). Publication logs, byte/header checks and live screenshots are retained privately under `build/fleetlab-city/validation/visitor-deployment-20261014/`.

## What changed

- Home now introduces Bo-Huei's independent learning project, explains its motivation in ordinary language, and offers a three-minute first lesson above the large depot artwork.
- The approved depot image, transparent logo, shared-delivery artwork and original concept film remain. Playback still uses the existing controller. Existing simulation and qualification disclosures remain visible.
- Six supplied concept tiles illustrate the three Home destinations and three learning paths. They are navigation illustrations, not result visualizations or depictions of operator hardware.
- Explore adds nine illustrated question families. Every one of the 61 catalogue lessons has one explicit primary family. The teaching renderer still owns search, model selection, counts and results. Family filters intersect those controls; clearing restores all lessons and visual selection.
- The complete library opens when a family is selected or when a visitor chooses Browse all. The guided Network Flows sequence remains below it, ordered readiness → priorities → capacity → software delivery → delivery order. Its three hosted studies are separate from the 61-item library.
- City Explorer adds four illustrated entries: atlas, decision notebook, replay and model lab. They activate existing section controls. The recorded city data, map qualification status and interactive-model separation are preserved.
- About & limits explains why the project exists before introducing its model boundaries.

## Muse proposal decisions

| Suggestion | Decision and reason |
|---|---|
| Use 19 supplied clay tiles | Accepted, byte-for-byte original WebP copies. Original owner files remain untouched. |
| Freeze every existing word | Amended. The owner specifically asked for clearer purpose and communication; introductory copy changes, scientific limits do not. |
| Guess categories from slugs | Replaced with a reviewed, exhaustive lesson-ID mapping. Coverage tests detect new or missing lessons. |
| Horizontal question ribbon | Accepted with native scrolling, visible labels/counts, keyboard buttons and selected-state text/shape cues. |
| Put 61 cards immediately in front of every new visitor | Reduced initial density through an ordinary disclosure; selecting a topic opens its results. Search/model filters stay available inside it. |
| Numbered learning steps and City cards | Accepted; existing navigation and model ownership retained. |
| Hover/reveal effects | Small pointer-only hover movement accepted; scroll reveal omitted so content is never hidden waiting for an animation. Reduced-motion rules disable new movement. No tile shadows. |
| New video loops | Not included: the owner explicitly selected the 19 tiles and existing film. Rejected V03 capacity clip is not included. |
| Generic public-directory layout | Adapted to the repository's existing source-owned hosted pipeline and exact asset inventories. No new framework or hosting service. |

## Validation record

- Teaching Node suite: **2,338 passed, 8 skipped, 1 existing TODO**.
- City/hosted Node suite: **81 passed**, including explicit family coverage, combined filters/reset, idempotence, City delegation and film retention.
- City Python unittest suite: **342 passed**.
- Hermes: **1,662 passed, 55 skipped**, using this checkout's `PYTHONPATH=src` and existing boundary base `bca4ccd`.
- Ruff and `git diff --check`: pass.
- Doctor: **17 PASS, 1 WARN, 1 optional NOT_AVAILABLE**. WARN is the intentionally dirty working tree/owner untracked inputs; no simulator launch or hardware operation was attempted.
- Independent implementation review found no significant runtime or packaging defects. Its inaccurate Street-lab alt text observation was corrected to describe three pods queued on a curved clay street. CTA targeting and CSS specificity were checked and fixed before handoff.
- Browser checks: desktop 1440px, phone 390px and narrow 320px; no document-level horizontal overflow in the checked views. Topic/search/model intersection, empty result recovery, clear, keyboard activation and City routing were exercised. The ribbon's sideways scrolling is intentional.
- Reduced-motion protection is implemented in CSS; this checkpoint does not claim physical-device or human comprehension qualification.

Initial validation attempts caught a missing fake-DOM method (replaced with existing supported DOM primitives), two Python formatting violations (fixed), and an environment import pointing at another checkout (rerun successfully with explicit PYTHONPATH). An initial attempt to use pytest in the City environment found no pytest; the established unittest command passed. A development pack output under build/ was refused by the packer's location guard; subsequent builds use an allowed location. No gates were weakened.

## Assets, ownership and boundaries

- New tile owner: **19 files / 1,990,494 bytes**, independently capped at 2 MiB with an exact inventory and SHA-256 pins.
- Existing brand owner: **3 files / 1,714,931 bytes**, still independently capped at 2 MiB.
- Combined hosted artwork: **3,705,425 bytes**. Lazy loading changes request timing, not accounting.
- The teaching source/tool, legacy text, offline, metadata, integrated text, route-closure and complete-generation hard caps remain unchanged.
- The five hosted presentation text files are counted in integrated source and relevant final route closures. Tile manifests travel with the source offer. Binary pins bind the original bytes.
- Google tag `G-04EZ8EZWQ2` remains configured once per current page with collection disabled outside `fleetlab.pages.dev`. No new analytics events or tracking scope.
- No numerical model, evidence verifier, scenario, fleet experiment, map source, qualification decision or deployment authority changed. No Austin or new-city work.

## Final integrated validation

Source-bound package verification and upload-time reproduction both pass for **10,098 staged files**, of which **10,097 are served assets**; the remaining file is Cloudflare's `_headers` control file. The integrated manifest records **1,624,465,620 bytes**. The local HTTP readback matched all 22 media assets and seven runtime/receipt files. Film bytes are identical to the previous release. Relative to the original City viewer, only `index.html`, its gzip companion, `_headers` and `network.json` changed; all scientific payload files are identical.

| Publication check | Result |
|---|---|
| Fresh release-checkout visitor/catalog smoke tests | 12 pass |
| Locked deployment dependency audit | 0 known vulnerabilities; 38 signatures and 22 attestations verified |
| MapLibre dependency audit | 0 known vulnerabilities |
| Preview full byte/status readback | 10,097 / 10,097 match |
| Stable production full byte/status readback | 10,097 / 10,097 match |
| Preview and production response headers | 49 / 49 on each host |
| Immutable production smoke | 62 / 62 match |
| Previous immutable production smoke | 39 / 39 match |

Live browser checks confirmed the plain-language Home, first-lesson navigation, nine-topic Explore, family/search/model intersection, empty-result recovery, Clear filters, City navigation, illustrated atlas entry, rendered road map and recorded replay playback. Home and Explore were checked at 390 CSS pixels without document overflow. The original film played with ready state 4 and the Pause control visible; Home contained one Google tag loader. No console errors or warnings were observed in the checked interactions. These are automated browser observations, not physical Pixel or human comprehension qualification.

| Budget | Actual bytes | Existing limit |
|---|---:|---:|
| Raw teaching source + tools | 3,011,946 | 3,145,728 |
| Legacy emitted text | 2,612,515 | 2,621,440 |
| Offline edition | 2,563,278 | 2,571,440 |
| Package metadata | 32,189 | 32,768 |
| Integrated emitted text | 2,920,976 | 3,145,728 |
| NF03 final text closure | 503,725 | 524,288 |
| NF04 final text closure | 166,628 | 524,288 |
| Delivery order final text closure | 170,552 | 524,288 |
| Complete non-City generation | 11,230,620 | 14,360,576 |

The publication work is complete. SF's independent map/source, physical-device and visitor review remain open; visual polish does not close them. SF qualification stays **HOLD**, authenticity **NOT_AUTHENTICATED**, and operational deployment permission **NONE**.

**Negative observation retained:** Range requests for the film and compressed candidate-road data returned HTTP 200 with complete, matching files instead of HTTP 206 partial bodies. The previous immutable production behaved identically. The strict partial-response probes therefore failed; byte integrity, ordinary full-file loading and observed playback passed. Partial-transfer support is not established. The retained City rollback was included in the full byte and header checks; a new switch-over rollback rehearsal was not performed. Google Analytics property receipt remains **NOT_OBSERVED**; code installation does not establish receipt inside the owner's account.

Commands used:

```sh
node --test playground/fleetlab/test/*.test.mjs
node --test apps/fleetlab-city/test/*.test.mjs
build/fleetlab-city/venv/bin/python -m unittest discover -s apps/fleetlab-city/tests
PYTHONPATH=src FLEET_PLAYGROUND_BASE=bca4ccd conda run -n hermes-dev python -m pytest -q
conda run -n hermes-dev python -m ruff check .
PYTHONPATH=src conda run -n hermes-dev python -m hermes doctor
git diff --check
zsh build/fleetlab-city/validation/visitor-design-20261014/build-release.sh
```

The build recipe performs the site/offline build, check-dist, source-package reproduction, immutable City derivation, integrated package verification and final stage guard. A local commit attempt was blocked by the existing privacy hook because the design plan included a private absolute input path. The path was removed, the unchanged guard passed, and the commit succeeded; no bypass was used.

Publication used the pinned wrapper from the clean release checkout:

```sh
git push github codex/fleetlab-city-sf
npm ci --ignore-scripts
npm audit --omit=dev
npm audit signatures
node apps/fleetlab-city/deploy/wrangler.mjs pages deploy VERIFIED_SITE --project-name fleetlab --branch codex-city-explorer
node apps/fleetlab-city/deploy/wrangler.mjs pages deploy VERIFIED_SITE --project-name fleetlab --branch feat/fleetlab-playground
build/fleetlab-city/venv/bin/python apps/fleetlab-city/tools/readback.py --site VERIFIED_SITE --url https://fleetlab.pages.dev --output PRIVATE_READBACK
```

The three npm commands ran inside `apps/fleetlab-city/deploy`; MapLibre received its separate audit. `VERIFIED_SITE` is the candidate directory named above. `feat/fleetlab-playground` is Cloudflare's production alias, not the Git source branch. No force push, credential change, historical deployment deletion or source-input cleanup occurred.

## Recommendation

Use the live Home and Explore experience for the next presentation and design feedback. The requested release is complete; no further decision is needed for publication. For the next visitor review, test whether someone can explain the project's purpose and choose a useful first question without a verbal introduction.

## Top risks + mitigations

1. Attractive illustration mistaken for evidence: keep concept labels and model boundaries; exact original scientific assets are verified during integration.
2. A library category mistaken for a separate model: keep the original lesson's lab, assumptions and result behavior intact; the family is navigation only.
3. Automated checks mistaken for comprehension testing: request a short first-visit read from a person; this release does not close SF human/map/device prerequisites.
4. Tight packaging headroom: only 579 bytes remain in package metadata, 8,162 in offline output and 8,925 in legacy text. Define ownership and budget before a substantial new feature; do not hide payload from counters.

## Next 3 actions

1. Present the live Home → first lesson → Explore path, with the existing film available alongside it.
2. Gather visitor feedback on purpose, first action and takeaway; independently close SF map/source and physical-device review when evidence is available.
3. Choose the next bounded Network Flows question and its packaging budget. The owner can check Analytics Realtime separately; additional video loops need actual reviewed assets.
