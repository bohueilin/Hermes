# Visitor learning design implementation plan

> Execution: native in the existing dedicated FleetLab worktree. Use executing-plans and verification-before-completion. The user's request authorizes reversible implementation of the accepted Muse proposal.

**Goal:** Make FleetLab's independent learning purpose and first useful action clear to a visitor.
**Architecture:** Source-owned hosted presentation decorates the existing Home, Explore and City welcome. A small catalogue filter interface delegates filtering to the existing catalogue. Scientific models, hero art, film, Google tag scope and data remain unchanged.
**Stack:** Existing JavaScript/DOM/CSS, WebP, Node tests, Python staging.
**Spec:** Owner request and owner-supplied `CODEX_IMPLEMENTATION_PROMPT.md` (external design input; accepted with the decisions below).

## Decisions and constraints

- Accept the 19 supplied clay tiles, tonal surfaces, rounded corners, accessible HTML labels, responsive layouts and reduced-motion handling. Preserve original image bytes in a separate 2 MiB tile owner; preserve the existing 2 MiB brand owner and all other hard caps.
- Amend the proposed copy freeze: the owner explicitly asks for clearer language and purpose. Preserve scientific disclaimers and qualification boundaries; improve introductory language.
- Amend inferred slug classification: explicitly map all 61 catalogue lessons to nine question families. No data/model changes.
- Use one filtering implementation: search/model/family intersect; Clear filters resets all and synchronizes visual selection. No DOM-only filtering with misleading counts.
- Keep the approved hero art and original concept film. Missing video loops are deferred; no fabricated or unreviewed clips.
- Prefer always-visible content over scroll reveals; pointer hover movement only, disabled for reduced motion.
- This is a local implementation/preview request. Prior live release remains the production baseline until publication is explicitly requested.

## Review focus

1. Family plus text/model filters must show the true intersection and a recoverable empty state.
2. A new/unmapped catalogue ID must fail the mapping coverage test rather than silently disappear.
3. City links must retain existing router and view behavior, including direct/back navigation.
4. Small screens/keyboard/reduced motion must retain all content and usable controls.
5. Asset capture must reject modified/extra files, preserve original City scientific data and stay within explicit budgets.

## Task 1 — catalogue interface and presentation

- [ ] Write a failing functional test: dispatch `fleetlab:catalog-filter` with `['charging','shared-power']`; expect two lessons, then search `Battery` and expect one; Clear filters restores all 61 and emits the reset event.
- [ ] Add the optional catalogue event interface, with validated string-array or null input and existing render intersection.
- [ ] Add `hosted/visitor-families.mjs`: nine explicit non-overlapping ID arrays, title, question, tile and source-readable rationale. Test exact catalogue coverage.
- [ ] Add `hosted/visitor.mjs` and `visitor.css`: clear purpose and three-step learning invitation; illustrated Home cards/path; Explore family controls and topic navigation; City welcome ribbon linked to existing controls. Test selection, reset, idempotence and links using the existing fake DOM.
- [ ] Integrate after existing brand decoration. No observer-based catalogue filtering.

## Task 2 — assets and reproducible packaging

- [ ] Copy supplied tiles byte-for-byte to `apps/fleetlab-city/tile-media`; record byte count and SHA-256 in `hosted/tile-assets.json`.
- [ ] Extend hosted text inventory and exact media groups in `site-transform.mjs`, Python hosted preparation, package capture, source identity and upload guards. Retain independent 2 MiB/3-file brand and 2 MiB/19-file tile caps.
- [ ] Update packaging fixtures to include the new owned assets; run package, hosted and catalogue tests.
- [ ] Build a source-bound integrated preview from the retained original City generation and verify inventories, budgets, rollback and unmodified scientific payload.

## Task 3 — visual validation and handoff

- [ ] Inspect Home/Explore/City desktop and phone layouts, family/search/reset/empty states, animation, keyboard focus, direct navigation and reduced motion. Save screenshots.
- [ ] Run required regression/lint/doctor/diff gates, obtain an independent final implementation review, address significant findings.
- [ ] Record accepted/amended/deferred Muse decisions, checks, packaging totals, current publication status and preview link in an October 14 handoff. Leave owner inputs untouched.
