# FleetLab visitor experience — October 14, 2026

## Status and purpose

Local implementation of the owner's request to make FleetLab easier to understand as an independent learning and passion project. Input: Muse's `CODEX_IMPLEMENTATION_PROMPT.md`. This document supplements the earlier October 14 artwork release handoff; that published generation remains the live baseline. No remote push or publication is part of this local preview checkpoint.

The intended first-visit understanding is: **FleetLab explores the operational work between autonomous rides. Pick a question, change one assumption, and inspect who benefits, who waits, and what the model does not establish.**

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

## Recommendation

Review the local Home and Explore experience before publication. Judge whether a first-time visitor can explain the project's purpose and choose a useful first question without a verbal introduction.

## Top risks + mitigations

1. Attractive illustration mistaken for evidence: keep concept labels and model boundaries; exact original scientific assets are verified during integration.
2. A library category mistaken for a separate model: keep the original lesson's lab, assumptions and result behavior intact; the family is navigation only.
3. Automated checks mistaken for comprehension testing: request a short first-visit read from a person; this preview does not close SF human/map/device prerequisites.

## Next 3 actions

1. Open the local preview and review Home, Explore and the City welcome on desktop and phone.
2. If this design is accepted, publish the source-bound integrated candidate using the existing deployment guard; preserve the current live receipt until deployment succeeds.
3. Gather visitor feedback on purpose, first action and takeaway. Add video loops only after the actual files and their content have been reviewed.
