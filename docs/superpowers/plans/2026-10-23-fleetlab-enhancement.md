# FleetLab enhancement implementation plan

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development. Preserve unrelated work and record decisions below.

**Goal:** Implement the approved presentation round within the explicitly approved budgets and report remaining limits.

**Architecture:** Keep hosted presentation in the existing brand/visitor layer; use existing static integration and source ownership checks. No model, fixture, result, evidence, or numerical study changes.

**Tech Stack:** Existing JavaScript DOM modules, CSS, Python static integration, Node tests, ffmpeg for supplied video compression.

**Spec:** `FLEETLAB_ENHANCEMENT_ROUND_2026-10-23.md`, read in full; companion audit §5.

## Approved media continuation

Owner approved “room for the media” after the explicit proposal: new 8-file / 4 MiB media group, 17 MiB aggregate non-City ceiling, 544 KiB capacity text closure; every other limit unchanged. This overrides the earlier no-ceiling-change constraint only for those named limits. Owner subsequently selected “Use A2; hold V1 for a rerender.” Use A2 as Fleet day hero and keep V1 excluded. Original media placements remain authorized.

- [x] 6. Bind seven eligible files (A1–A4, V2/V3 and V2 poster), exact hashes, approved budgets and source/upload ownership. Complete A2/A3 social-image metadata.
- [x] 7. Place exact-captioned media in Home/About, Fleet day, notebook, capacity and deadhead explanation; V1 excluded. Add shared poster-first viewport/global/reduced-motion controller.
- [x] 8. Focused red/green tests, full applicable gates, fresh review, rebuilt local preview, desktop/390px motion/placement checks; update report/handoff with superseding budget approval.

Ruling: hold V1, not all media — the owner approved allocations and explicitly chose A2 with V1 held for rerender. No further placement decision is pending. No commit or deployment is authorized.

## Global constraints

- Exact supplied copy, captions and alt text; preserve existing honesty language.
- No push, commit, deployment, new lesson/model/fixture/study or budget ceiling increase beyond the three explicitly approved above.
- Assets that cannot fit are deferred; local review mockups are excluded from the shippable package.
- Videos: poster first, lazy, 24 fps, audio stripped, at most 1,200,000 bytes, viewport/global/reduced-motion governed.
- Existing linked worktree `codex/fleetlab-city-sf`, initial HEAD `6c1e3900dbc30426eb3e5a70cc42599849075f69`. Preserve initial runtime/deployment edits and supplied files.

## Review focus

- SPA remount restores neither the H mark nor ambiguous active navigation.
- Static metadata describes actual destinations; hash fragments cannot create server-side social metadata.
- No artwork escapes file-count or byte ceilings through reclassification.
- Phone layouts stay within 390px; retained evidence qualifications remain readable.
- Legacy aliases reach working destinations; all hub questions point to existing lessons.

## Initial delivery tasks (before media approval)

- [x] 1. Measured before/after budgets. All seven product placements deferred because every artwork group has zero file slots. Compressed all three films below 1,200,000 bytes without audio. Captured V1 in an excluded local review placement.
- [x] 2. No film is eligible for product placement. Existing global control verified with the V1 review overlay; no unused production controller added. Seamless trims could not be established without losing the full sequences and are explicitly reported.
- [x] 3. Founder-first hero, exact tour, hub, logo lifecycle, text metadata and sitemap implemented. E-4 image requirements explicitly deferred.
- [x] 4. D-1–D-8 fixed or verified. D-4 is already correct in current public/local Home and About, so no speculative change. D-7 covers the table and replay narrative.
- [x] 5. Local development preview built from frozen inputs, with production accounting and explicit unbound metadata. Source-bound release deferred because source remains uncommitted; guards unchanged. Full relevant gates, independent review, desktop and 390px checks complete. Detailed §6 report saved.

## Initial decision ledger (superseded where noted by approved continuation)

- Current explicit FleetLab scope supersedes historical Phase 6 workbench task/branch requirements. No Hermes review-core change is requested.
- Supplied assets are at repository root rather than `assets/`; preserve originals and use those exact files.
- All four artwork group file-count ceilings are occupied before work. No new group/count is authorized. Defer new production artwork unless an existing approved slot is legitimately available; do not reclassify it to evade limits.
- FL-V1 owner review may use an excluded local mockup, labeled as such. It is not proof of a package that can ship within current ceilings.
- Initial focused hosted baseline: 23 tests passed. Initial tree is dirty from unrelated runtime/deployment work; no resets or commits.
- Production source-bound packaging rejects uncommitted source by design. Use the excluded development preview for review; do not label it upload-ready or claim exact-commit release validation.
- All scientific City files remain byte-identical. D-7's frozen-viewer compatibility correction is presentation-only; the future source formatter is corrected separately.
- Independent review found a second singular-grammar surface in replay. A failing regression reproduced it; the correction passed regression and browser checks.
- Final capacity closure is 524,076 / 524,288 bytes (212 free). Leading-whitespace reduction was checked for token/line/comment equivalence; no ceiling increase.
- Final gates: Hermes 1,661 pass / 56 skip; hosted Node 119 pass; teaching Node 2,433 pass / 8 skip / 1 existing TODO; City integration 34 pass; capacity-site 10 pass; Ruff and diff-check pass. Activated doctor: 17 PASS, dirty-tree WARN, optional display NOT_AVAILABLE.
- Owner recommendation: HOLD FL-V1 for transition ghosting, doubled moon and dark endpoint. Full report: `docs/FLEETLAB_ENHANCEMENT_REPORT_2026-10-23.md`.

## Approved continuation outcome

- Seven installed files (A1–A4, V2/V3, V2 poster), all hash-bound and counted. V1 held by owner decision. Exact media copy and all existing qualifications retained.
- Media has 1,508,882 bytes and one slot free; aggregate has 2,225,415 free; NF-03 closure has 19,755 free; unchanged emitted-text cap has 4,239 free.
- Final gates: Hermes 1,661 pass / 56 skip; hosted Node 139 pass; teaching Node 2,433 pass / 8 skip / 1 existing TODO; City integration 35 pass; Ruff/diff-check pass; doctor 17 PASS / dirty-tree WARN / optional display NOT_AVAILABLE.
- Independent review found no actionable media defect. Seven pages verified at 390px without page overflow, V2/V3 lazy loading and global pause verified, all eight presentation files match source/build/served hashes. OS reduced motion covered by tests, not an emulated browser screenshot.
- Report and handoff updated to final approved state. No staging, commit, push or publication.

## Live publication authorization — October 23

Owner explicitly requested: deploy these updates to the live site, retaining A2 as Fleet day hero and holding V1 for rerender; update the Markdown report for sharing with Muse and Fable. This supersedes prior no-commit/no-publication constraints only for this reviewed website release. Exact-source local commits and preview/production publication are authorized release steps. No Git push or PR is necessary. Original user media and private source/audit instructions remain local; only the source-owned media copies and sanitized delivery report enter the release commit.

- [x] Commit reviewed source, build exact-source package, and pass all existing upload guards and approved budgets. Final-code checkpoint `4b31ecc` passes; documentation checkpoint is rebuilt before owner handoff.
- [ ] Verify Cloudflare preview, publish same package to stable site, verify live bytes/headers and 390px layouts.
- [ ] Update shared report and committed release receipt with production identity, URLs, checks and residual limitations.

Release reconciliation: live `/publication.json` names source `2d01b25`, which was not an ancestor of the initial enhancement branch. A fresh 103-file readback against the current receipt at `02621fe` passed. Merge the existing live security implementation before publication; do not regress it. Its token interface requires owner-side injection outside the agent session and interactive production confirmation. The October 23 npm audit is not clean: the pinned uploader bundles affected Undici 7.29.1; retain this tool-only residual, with no unreviewed CLI patch or downgrade.

Final source qualification: `4b31ecc` passes teaching 2,453 / hosted 232 / City 370 / Hermes 1,664 / named-base boundary 91 tests (skip/TODO details in report), Ruff and clean doctor. All 776 source/test hashes stayed unchanged. Header-path and guarded-media compatibility findings are fixed without widening security allowlists or adding a route dependency. The shareable report records A2 approved / V1 held, final-code budgets, the current unchanged live release, and exact owner-operated preview/production commands. The final source-bound package is retained at ignored `dist/fleetlab-enhancement-20261023/`; only generated identity/compression metadata can vary with the documentation checkpoint. Publication remains pending the existing owner-operated token interface; no token was retrieved or remote upload attempted. Current production receipt remains intact.
