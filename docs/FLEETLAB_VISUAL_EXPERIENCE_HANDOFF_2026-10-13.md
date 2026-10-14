# FleetLab — visual experience implementation handoff

Date: October 13, 2026 (America/Los_Angeles). Scope: public educational website.

## Outcome and recommendation

Argon's design report was evaluated against the rendered site and actual teaching models. The selected visual and learning-path improvements are **built, tested, pushed and published**. See [finding-by-finding audit decisions](FLEETLAB_ARGON_VISUAL_AUDIT_DECISIONS_2026-10-13.md) for adopted, corrected and deferred ideas. Argon only accessed the static shell; its visual/performance claims were treated as hypotheses.

Recommendation: use the new Home → first Depot flow lesson path for the next visitor review. The warm visual identity, original 3D film, existing Home content, Fleet day, Street lab, catalog, NF03, NF04, Delivery order and City Explorer remain available. No Austin, new city, new simulation model or map requalification was introduced.

## What changed and why

- **Home:** a deeper green frame gives the existing concept film a clearer focal point. Three illustrated learning paths route to depot readiness, fleet service and model limits; selecting them does not run a model.
- **Teaching visuals:** four expandable HTML diagrams explain energy/data readiness, the fleet cycle, street queues and matched-input policy comparison. Native disclosures start collapsed. The main Depot Compare action remains before explanatory material.
- **Appearance:** cream/sage surfaces, original decorative SVG line art, restrained accent rules, more deliberate card/section spacing and responsive single-column layouts on narrow screens.
- **Scientific clarity:** charging and upload can overlap in the first Depot lesson, and its local step follows upload. Readiness requires both paths. A/B arms have equal visual treatment; pairing can reduce noise, not eliminate uncertainty. Every diagram is labeled “Concept diagram · not simulation output.”
- **Delivery:** one exact module was added to the integration ownership allowlist. A regression test verifies its reviewed bytes survive integration; unknown/missing-file rejection remains enabled. No new media asset, dependency, external service or animation system was added.
- **Offline:** the static teaching diagrams and paths are included in the newly checked single-file edition. Unlike the preceding Delivery order wave, this release intentionally updates offline HTML. Hosted-only film, City content and standalone hosted studies remain excluded there.

## Actual release identities

| Item | Observed value |
|---|---|
| Live site | https://fleetlab.pages.dev/#/overview |
| New primer | https://fleetlab.pages.dev/#/depot-flow-lab?lesson=two-vehicles — open “See how readiness fits together” |
| Immutable production | https://c1da5337.fleetlab.pages.dev |
| Application source commit | `0a5f5719765b389be9fd4e05a4671b5d6c25dfe4` |
| Visual implementation commit | `1f5bcbd1ec23aea4dd3142e65feed0afce0725bb` |
| Packaging correction / released commit | `0a5f5719765b389be9fd4e05a4671b5d6c25dfe4` |
| Repository / branch | `bohueilin/Hermes` / `codex/fleetlab-city-sf` |
| Production deployment | `c1da5337-1ff7-40df-ad1a-5f33fb73d1e5` |
| Preview deployment | `286fdadb-09f4-4239-b9bf-0e836f028ab0` |
| Preview full served-byte readback | 10,070 / 10,070 match; 20 / 20 header checks |
| Stable production full served-byte readback | 10,070 / 10,070 match; 20 / 20 header checks |
| Production readback completed (UTC) | `2026-10-14T06:05:03.771200+00:00` |
| Immutable production / prior production smoke | 32 / 32 and 29 / 29 match |
| Retained prior whole-site production | `c8bfa50a-5ad8-44c7-a742-f5ceddd1aa41`, https://c8bfa50a.fleetlab.pages.dev |
| City current / rollback | `c56bda6b509105c5` / `e3318a76588a7403` |
| Integration manifest SHA-256 | `639312c5422f0474256806bd8b0a3c4fdf6b9859d4b9bde7841ad49a81820dbb` |

Preview and production used the same checked generation with no rebuild between uploads. All 9,908 City/source-offer files (1,613,222,668 bytes) are byte-identical to the prior release. The [publication receipt](releases/fleetlab-current.json) records actual digests and the 32-file smoke inventory. These readbacks establish byte consistency at observation time, not authenticity, browser-session generation pinning or vehicle deployment authority. A later documentation-only commit contains this handoff; it is not a new application deployment.

## Verification results

| Check | Result |
|---|---|
| Full teaching Node suite | 2,337 passed; 8 existing skips; 1 existing TODO; zero failures |
| Final focused Home/Depot UI tests after the small copy clarification | 48 passed |
| Focused accessibility/UI checks | 95 passed; 1 existing TODO |
| City Node suite | 72 passed |
| City Python suite after packaging correction | 341 passed |
| Hermes regression | 1,662 passed; 55 existing skips |
| Ruff / Git whitespace checks | Passed |
| Clean managed-checkout doctor | 18 PASS; 1 optional NOT_AVAILABLE |
| NF04 published identities | All 16 checked runs exact |
| Delivery order identities | 8 complete studies / 192 serial records and 8 equal-sharing records exact |
| Offline + hosted distribution, exact-source package, integrated proof, upload guard | Passed; existing hard caps unchanged |
| Deployment / MapLibre dependency audit | Zero known vulnerabilities in the dated checks; 38 deployment package signatures and 22 attestations verified |

Browser observations: rendered desktop Home, catalog and all four primers; 320/390/768 px responsive layouts without observed page overflow; native keyboard disclosure toggling/focus; no unintended model start from learning links; a completed first-lesson three-rule comparison; integrated preview/live discovery and diagram rendering; no observed preview console warnings/errors. Live Home and primer screenshots are retained with the private release evidence.

These checks do **not** establish physical Pixel completion, native screen-reader compatibility, actual 200% browser zoom, OS reduced-motion/Save-Data behavior, fresh Lighthouse/FCP values, or uncoached human comprehension. Those already-open observations remain open. The existing automated motion/restricted-path tests still pass. This wave adds no motion.

## Budget accounting

| Counter | Final bytes | Existing hard limit |
|---|---:|---:|
| Legacy teaching text | 2,612,012 | 2,621,440 |
| Offline HTML | 2,562,865 | 2,571,440 |
| Receipt metadata | 32,158 | 32,768 |
| Teaching original source/tools | 3,009,134 | 3,145,728 |
| Compressed / extracted source archive | 910,701 / 3,323,887 | 4,194,304 each |
| Final integrated emitted text | 2,888,059 | 3,145,728 |
| NF03 / NF04 / Delivery order integrated closures | 474,619 / 137,522 / 141,446 | 524,288 each |
| Complete non-City generation | 7,474,242 | 14,360,576 |

The whole staged site is 1,620,696,910 bytes / 10,071 files; one `_headers` control file is not served as an asset. Offline grew 13,028 bytes from the prior release. Remaining headroom is only 8,575 bytes offline, 9,428 bytes legacy text and 610 bytes metadata. No hard cap was raised. Packaging needs a deliberate next-phase decision before more substantial teaching or visual payload.

## Negative results and repairs

- An initial Home arrangement disturbed the existing phone reading order; it was corrected before release. The added learning section now follows the preserved hero DOM rather than using CSS reordering.
- Initial assertions exposed disclosure target sizing, a selector collision, narrow SVG sizing and the intentionally changed Depot root shape. The final implementation uses the target token, a specific metadata class, responsive SVG width and the updated structural expectation; the full suite then passed.
- The first integrated build failed because the new concept module was not declared in the exact integration file list. A regression failed for that same reason, the single reviewed path was declared, then all 341 City Python tests and the final integrated proof passed. The failed attempt is retained privately; the guard was not broadened.
- Doctor initially reported environment/dirty-checkout warnings. A clean managed release checkout with the project environment produced 18 PASS / one optional unavailable. Six owner-provided untracked design files were left untouched in the original checkout. The extra managed checkout served packaging cleanliness only.

## Remaining qualification and top risks + mitigations

1. **Concept artwork mistaken for result evidence:** retain captions, neutral A/B diagrams and scoped first-lesson wording. No generated SF map or fictional count is used as evidence.
2. **Open device, accessibility and visitor observations:** obtain physical-phone navigation/rotation/background checks, native accessibility/preferences and uncoached comprehension before claiming those qualifications. Narrow desktop viewport checks are not substitutes.
3. **SF source/map qualification:** unchanged **HOLD / BLOCKED_MAP_QUALIFICATION**, **NOT_AUTHENTICATED**, operational deployment permission **NONE**. Website publication does not close those gates.
4. **Tight packaging headroom:** keep exact-source ownership and complete metadata; design packaging changes before adding another large asset or lesson.

## Reproduction and evidence

Run from the application commit, using Python 3.11 and the existing City scientific environment where required:

```sh
node --test playground/fleetlab/test/*.test.mjs
node --test apps/fleetlab-city/test/*.test.mjs
python -m unittest discover -s apps/fleetlab-city/tests
PYTHONPATH=src FLEET_PLAYGROUND_BASE=bca4ccd python -m pytest -q
python -m ruff check .
PYTHONPATH=src conda run -n hermes-dev python -m hermes doctor
node playground/fleetlab/tools/software-delivery-study.mjs --check
node playground/fleetlab/tools/delivery-order-study.mjs --check
```

Private evidence is retained under `build/fleetlab-city/validation/argon-visuals-20261013/`: full readbacks, header checks, smoke inventories, preservation proof, build recipe, test logs and screenshots. Final checked package is under `build/fleetlab-city/argon-visuals-20261013/reviewed/`. Follow the existing Cloudflare runbook for rollback/publication; no retention deletion or rollback occurred.

## Next 3 actions

1. Review the live Home → Depot primer → Compare path and collect one uncoached explanation of the readiness bottleneck.
2. Complete the open physical-device/native accessibility and independent SF observations, keeping each qualification distinct.
3. Decide the next bounded Network Flows question and package ownership/headroom before committing to additional simulation or media payload.
