# Round 4 — targeted visitor fixes

Source: FLEETLAB_DESIGN_AUDIT_ROUND4_2026-10-14.md, §6 P1; owner implementation request governs over the audit's historical review-only note. Baseline: 479f664. Existing isolated branch: codex/fleetlab-city-sf.

## Constraints and decisions

- P1 only; no new lessons, numerical model/verifier changes or P2 charts. Owner clarified: include D05 opportunity-cost diagram only; all other P2 work deferred.
- The decimal problem reproduces in native accessibility values; DOM input strings are already correct. Use decimal text controls for fractional settings, preserving numeric parsing and model validation. No model rounding.
- Initial delivery-order values are present in DOM and native accessibility: 2/4, 178 s, 138 s, 378 s. Preserve them and add a local pre-comparison hint; explain all 4! = 24 orders. Pending edits never replace accepted results.
- Reuse one shared teaching-page glossary and navigation/footer helper for all four focus pages; preserve route-specific onward links and full trust disclosures.
- Replace the shared concept image with supplied text-free D04; its existing catalog placement shares the same asset. Retain placement/captions and update alt/dimensions to match two concept vehicles.
- Respect existing source, runtime, media, metadata and offline budgets; no implicit amendments. Historical protected-page fences are superseded only for these P1 presentation changes.
- Standing owner authorization covers repo push and website publication. No hardware or operational deployment authority.

## Task 1: Shared artwork and lesson vocabulary/chrome

Use the current brand manifest and source capture paths. Add shared glossary, standard Home / Explore / About & limits header, and common non-affiliation footer copy to capacity, dispatch, software-delivery and delivery-order. Link first dispatch state mentions. Preserve specialized footer links and synthetic boundaries. Validate DOM construction, repeated invocation, all four mounted pages, asset hashes and packaging ownership.

## Task 2: Accessible numbers and initial-result guidance

Reproduce fractional fields in native AX; fix presentation without model rounding. Validate default/custom/invalid values, model update timing and precision. Preserve published delivery-order metrics; add explicit Compare hint and 24-permutations copy. Validate pending-versus-accepted behavior with existing tests.

## Task 3: Integrated validation and release

Run teaching, hosted and City tests plus required repository gates; build complete hosted/offline packages with unchanged limits. Fresh reviewer checks entire patch, especially numeric domain, state identity, shared imports and trust preservation. Verify desktop/phone UI. Commit, build a source-bound integrated stage, verify it, publish preview then production under existing authorization. Verify immutable and stable live readback and security headers; update handoff and publication receipt.

## Review focus

Decimal field parsing and rejection; no altered simulator inputs or computed metrics; default summary versus accepted-state labeling; glossary first-use anchors and consistent header/footer on all four pages; shared-module ownership in source and runtime packages; no diluted evidence fences; scoped asset replacement without media/player interference.

Owner clarification: add D05 after dispatch chapter-one copy, shown only in that chapter, with supplied alt and exact concept caption. Four diagrams total 510,436 bytes within the unchanged 512 KiB envelope; the declared inventory count becomes four to include this expressly requested fourth file.
