# FleetLab Round 4 implementation handoff — October 14, 2026

## Scope and decisions

Implemented the five P1 items in `FLEETLAB_DESIGN_AUDIT_ROUND4_2026-10-14.md`. The owner additionally approved D05 only; all other P2 work remains deferred. These are presentation changes to existing lessons. No simulation model, fixture, numerical study, verifier, policy objective or safety/deployment authority changed.

The audit's review-only statement describes its author's activity. The owner's implementation instruction and standing GitHub/publication authorization govern this work. Existing owner inputs and unrelated untracked files are preserved.

## Per-item report

| Item | Status | Implementation and qualification |
|---|---|---|
| P1.1 Text-free artwork | Done | Supplied D04 replaces the shared delivery image, byte for byte, in the existing software-delivery and delivery-order artwork disclosures. The catalog uses that same asset and receives the replacement too. Placement and captions stay; alt text and dimensions now describe two concept vehicles. Original JPEG 318,541 bytes → supplied WebP 145,670 bytes. |
| P1.2 Shared COD/VOR vocabulary | Done | All four focus pages use one glossary component. Ready / idle remains separate; COD means Car on Drive; VOR means Vehicle Off-Road, unavailable for dispatch, off the drive network rather than off the pavement. Dispatch's first state mentions link to definitions. Teaching-label caveat remains explicit. |
| P1.3 Long decimal values | Done, root cause clarified | Native accessibility reported float32 expansions even though DOM values/model inputs were exactly 1.6 and 0.02. Fractional settings now use decimal text fields, preserving exact numeric conversion and existing model bounds/validation. Native AX now reports 1.6 and 0.02. No computed result or input precision was rounded away. Fractional fields no longer have native stepper arrows; integer controls retain them. |
| P1.4 Initial order outcomes and 24 orders | Done; blank cells not reproduced | Initial published values were present in both DOM and native AX: 2/4, 178 s total late, 138 s worst late, 378 s all ready. Kept those values; added a card-local instruction to Compare pending edits. Explained 4 × 3 × 2 × 1 = 24 permutations. Hint disappears after acceptance. Pending/accepted identity and no-autoplay behavior remain intact. |
| P1.5 Header/footer consistency | Done | Same Home / Explore / About & limits header on all four pages, including narrow screens. Same independent-project, synthetic-model, non-affiliation footer line. Existing onward links, source links, contact and full trust disclosures remain. |
| Owner-added D05 | Done | Dispatch chapter one receives the supplied opportunity-cost diagram with alt `Dispatching the car now strands the next rider.` and caption `Concept illustration · not simulation output`. It hides in other chapters and returns with chapter one. |

**Could not implement as written:** no P1 feature blocked. The literal blank-cell diagnosis did not reproduce; the requested hint alternative is implemented. The decimal fix addresses accessibility conversion rather than modifying model precision.

**Invented:** no numerical assumptions, results, simulation content or new lesson. The shared glossary title, exact hint wording and consistent footer reuse existing teaching concepts. No P2 counted visualization was added.

## Validation

- Focused regression tests first failed for decimal type, missing card hint and missing shared component, then passed.
- Full teaching suite: 2,412 passed, 8 skipped, 1 TODO, 0 failures (2,421 tests). D05 presentation delta: 14 focused tests passed; the exact release revision then passed the full teaching suite again (same totals) and all 96 hosted tests.
- Initial full teaching run found seven dispatch test-fixture failures: the fixture extracted only ID-bearing elements, omitting the actual header/navigation. Repaired the fixture and added glossary-target checks; eight dispatch tests passed, then the full teaching suite passed.
- City Python: 345 passed. Hermes: 1,661 passed, 56 skipped. Ruff passed. Doctor: 17 PASS, 1 expected dirty-checkout WARN, 1 optional NOT_AVAILABLE.
- Fresh independent code review: no remaining findings after fixture repair; reviewer independently ran 75 relevant tests and checked runtime ownership. D05 was authorized afterward and validated separately with focused tests and actual browser chapter transitions.
- Browser: all four focus pages at 390 px and 320 px show the same three navigation links, one glossary, identical footer trust copy and no horizontal document overflow. Desktop comparison still checks 24 orders and shows 2/4 versus 4/4, with 378 s all-ready in both. No autoplay introduced.
- Native accessibility clean defaults: Rush-hour demand 1.6; smallest meaningful difference 0.02. Decimal edit precision and invalid-input rejection covered in tests.
- D04/D05 visually inspected. D05 chapter transitions confirmed visible → hidden → visible. No physical Pixel or independent human validation claimed. The first header-check invocation used an older system Python without datetime.UTC; it produced no final result. Rerunning with the project Python completed all 69 checks successfully.

## Packaging and release

Final source-bound package verified for commit `5f3a3f1eb65b5a54d75fb66ee5b40d8a54416596`; 10,137 staged files. Final hosted Node suite: 96 passed. Live publication and all readback checks are complete. No byte-budget ceiling increased. The expressly requested fourth diagram updates the inventory count from three to four; their combined 510,436 bytes remain inside the existing 512 KiB limit. All other media inventory limits remain unchanged.

| Measure | Actual bytes | Ceiling bytes |
|---|---:|---:|
| Original teaching source and tools | 3,153,469 | 3,153,920 |
| Legacy emitted text | 2,618,052 | 2,621,440 |
| Integrated emitted text | 3,095,336 | 3,145,728 |
| Offline edition | 2,566,932 | 2,571,440 |
| Package metadata | 37,471 | 40,960 |
| Four concept diagrams | 510,436 | 524,288 |

Relative to baseline 479f664, test-tree growth is reported separately: +4,857 bytes; the complete committed runtime/documentation patch at 5f3a3f1 is −57,602 bytes overall, largely from the smaller artwork. These are separate counters from captured teaching-source growth.

Only 451 bytes of original-source headroom remain. No source was moved out of its true owner to evade a budget.

Initial smoke-receipt preparation omitted the custom 404 page’s expected HTTP 404 status, so two early smoke checks reported 99/100 despite matching body bytes. The expectation was corrected to match the established release contract; the initial negative receipts are retained. This required no site change.

## Verified publication

- Live: https://fleetlab.pages.dev
- Runtime source commit: `5f3a3f1eb65b5a54d75fb66ee5b40d8a54416596`, pushed to `github/codex/fleetlab-city-sf`.
- Production deployment: `12e199f4-be92-4c67-80c9-282ac2d667dd` — https://12e199f4.fleetlab.pages.dev
- Preview deployment: `f553a699-a05a-4926-b902-4afa3bf2ed61` — https://f553a699.fleetlab.pages.dev
- Preview and stable-production readback: **10,136/10,136 served files matched each**. Staged total: 10,137 including the hosting header file.
- Preview and stable-production headers: **69/69 each**. Immutable production smoke: **100/100**. Prior production smoke: **97/97** at https://94c48b5b.fleetlab.pages.dev.
- Final live verification: `2026-10-15T05:39:26.818037+00:00` (October 14 Pacific). No stable-alias propagation mismatch occurred; the earlier smoke status-expectation error is documented above.
- Live browser: clean 1.6 / 0.02 accessibility values; dispatch independently checked, D05 present in chapter one, COD anchor reached the definition; delivery-order initial published summary and checked 2/4 versus 4/4 results confirmed; no observed browser console errors.
- Exact fingerprints, source archive and release identities: `docs/releases/fleetlab-current.json`. Local logs/screenshots: `build/fleetlab-city/validation/design-round4-20261014/`.
- Documentation receipt commit follows the runtime commit; it does not change the deployed source identity.

## Remaining work

P2 is a separate round: capacity Gantt, dispatch policy comparison animation, software bandwidth/readiness charts, delivery-order individual lateness visualization, and the audit's secondary copy/loading refinements. D05 is now complete; existing rebalancing zone bars remain. Human review, physical-device qualification and SF map qualification remain separate and open. Website publication does not clear those gates.

Recommendation: retain this bounded presentation release and evaluate P2 independently.

Top risks + mitigations: source headroom is tight; keep enforced budgets and require review of future growth. Synthetic illustrations never stand in for counted simulation evidence.

Next 3 actions: collect visitor comprehension feedback; agree the next P2 scope; review package headroom before adding more teaching source.
