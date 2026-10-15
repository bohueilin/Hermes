# FleetLab targeted design fixes, round 3

**Goal:** Implement the owner's approved section-by-section brief without new lessons or changed model results.
**Spec:** owner-supplied `FLEETLAB_CODEX_DESIGN_FIXES_ROUND3.md`.
**Architecture:** Existing UI projections own wording, loading, controls and accepted-ledger bars. Existing hosted artwork integration owns the three supplied illustrations. No model or verifier changes.
**Tech stack:** Plain JavaScript, HTML/CSS, Node tests, existing source-bound static release pipeline.

## Constraints and review focus

- Preserve capacity and software-delivery lesson implementations; global wording changes exclude those protected lessons.
- Bars consume only accepted R1 metrics, preserve missing values and never change results.
- Disabled reasons must follow actual prerequisites and stale/busy states.
- Form formatting must not round machine inputs, exported setup or exact evidence.
- Canonicalization must preserve crossed-priorities, valid shared links and browser history.
- Hosted diagrams retain exact supplied alt text/caption; offline must not request unavailable images.
- Deferred: dispatch animation and delivery-order per-vehicle bars.
- Retain all package limits unless the owner explicitly accepts a measured amendment.

## Tasks

- [x] 0. Diagnose live videos before other work. Both H.264 files serve successfully; both players advance, pause/resume, use muted/loop/playsinline and posters. Reported failure not reproduced; no speculative media change.
- [x] 1. UI regression checks: disabled reasons, readable accessibility values, accepted zone bars including nulls, pending-order copy and canonical hash route.
- [x] 2. Implement §§1–8 in operations, depot flow, R1/R3, delivery-order and experiment UI. Keep numerical modules untouched.
- [x] 3. Add §§2/3/9 diagrams through hosted artwork manifest and visitor decoration; responsive placement and prominent existing lesson links.
- [x] 4. Run focused and full teaching tests, source/package gates, responsive browser checks, media and protected-lesson comparisons.
- [ ] 5. Fresh whole-change review, address material findings, update section-by-section handoff and integrate using the existing release workflow if all gates pass.

## Decisions / evidence

- P0: source paths are correct, both live videos decoded and advanced with no media error. Browser audit tooling may have caused the report; that cause is not established.
- Float report reproduced in native accessibility output only: DOM input values remain `1.6` and `0.02`. Preserve those exact model values and expose readable accessibility text.
- Existing linked worktree `codex/fleetlab-city-sf` reused. Baseline `5684f0568eda69dfa23bb27e0f80316715d40c69`; owner untracked files preserved.

- Owner approved source-only 8 KiB amendment (3,153,920 bytes); other pre-existing limits unchanged.
- Fresh review: inaccurate experiment preservation promise and stale accessible edit values reproduced and fixed; focused 47/47 pass.
- Final local gates: teaching 2,408 pass / 8 skip / 1 todo, city Node 95 pass, city Python 344 pass, Hermes 1,661 pass / 56 skip; no protected implementation or numerical source diff.
