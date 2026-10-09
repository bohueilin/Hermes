# FleetLab website redesign: built report and handoff

**Date:** October 9th, 2026 (America/Los_Angeles)
**Owner:** Bo-Huei Lin
**Built by:** Claude (Fable 5.1), from the V2 proposal `docs/FLEETLAB_WEBSITE_REDESIGN_PROPOSAL_2026-10-09_V2.md`, sections 1 to 6 and 8 (slices A, B and C)
**Status:** BUILT, TESTED AND VALIDATED LOCALLY. Not pushed, not integrated into a City release package, not published. The live site is unchanged (production c98eb10c). Publication remains an owner action under the existing runbook.

**Where the work is.** The `Hermes-redesign` git worktree (a sibling of the other Hermes worktrees), branch `claude/fleetlab-visitor-redesign`, cut from `codex/fleetlab-city-sf` at `1df2e36`. The implementation plan is `docs/plans/2026-10-09-fleetlab-visitor-redesign.md` in that worktree. Packed outputs for review are under `dist/redesign-final/` (git-ignored): `fleetlab-offline.html` and `teaching-site/`.

## 1. Summary

The first visit now answers the three questions the proposal set: what this is (one headline, one lede, one primary action), what to try (the two-vehicle experiment, then two more starting points), and where to go next (Explore and About & limits). The nine-link header became three links. The old overview's five sections of competing invitations are gone. Explore is question-led with search, three topics and compact cards. About & limits holds the model boundary, the depot illustration, the method, the roadmap and the cross-model caveat. The Depot flow lab gets a breadcrumb, a "Compare the three rules" action with its helper line, a "Change the setup" disclosure after the action, and a readiness chain per rule and vehicle at the inspected minute. The three presentation defects the review reported were reproduced and closed.

No scientific output changed: no file under `src/model`, `src/runtime`, `src/instrument` or `src/core` was touched, no fixture or export changed, every route and all 61 catalog identities remain, and the offline edition shrank.

| Measure | Baseline (1df2e36) | Built (HEAD) | Change |
|---|---|---|---|
| Teaching Node suite | 2,041 tests: 2,032 pass, 8 skipped, 1 todo, 0 fail | 2,055 tests: 2,046 pass, 8 skipped, 1 todo, 0 fail | +14 tests, 0 failures |
| City Node suite | 63 pass | 63 pass | unchanged |
| Playground boundary pytest | 41 pass | 41 pass | unchanged |
| Offline edition (cap 2,621,440) | 2,543,663 bytes | 2,533,188 bytes | 10,475 smaller; 88,252 under the cap (reserve rule: at least 50,000) |
| Hosted teaching code (all site files except `media/`) | 2,372,649 bytes | 2,362,259 bytes | 10,390 smaller |
| `check-dist` offline and site | OK | OK | policy, URLs, tokens, copy, labels, size |
| `styles.css` | 1,764 lines | 1,606 lines | dead and duplicated rules removed |
| `integration.css` (hosted) | 464 lines | 323 lines | lab guide and large SF block removed |

## 2. What changed, page by page

### Header and routing

- Three links: **Home** (`#/overview`), **Explore** (`#/catalog`), **About & limits** (`#/approach`). Below 768px a **Menu** button (`aria-controls="studio-navigation"`, `aria-expanded`) reveals them as a one-column list; its label reads Menu or Close.
- Every route path is unchanged. Only three display titles changed in `src/ui/routes.js` (Home, Explore, About & limits), so `document.title` reads, for example, "Explore · FleetLab by Hermes".
- The lab destinations (Fleet day, Street lab, Four-area experiments, Scale lab, Depot flow lab, Guided walkthrough) moved to a visible `nav.lab-links` row on Explore ("JUMP TO A LAB"). Each link keeps its `data-nav` id and `aria-current`, so the existing page-identity contract holds (for example, the Four-area experiments link text still equals that page's H1 and title).
- The hosted City Explorer link is appended to that row by `integration.mjs`, not to the header. The optional-legacy-nav tool in `apps/fleetlab-city/tools/prepare-launch.py` still finds its two markers in `studio.js` (`navItems.map(` and the brand line), which the review round restored after a first-round regression.

### Home (`#/overview`)

Before: film hero with two buttons, "Your first three minutes", the depot illustration, four fact tiles, five decision cards and a scope section (page height about 25,800px at 1366 wide in the hidden-pane layout; 9 sections).

After (desktop, 1366×768): hero (`INTERACTIVE FLEET SIMULATIONS`, H1 "See what keeps a fleet moving.", one lede, primary "Try a 3-minute experiment →" opening `#/depot-flow-lab?lesson=two-vehicles` without running anything, text-style "Explore all lessons", the duration line "About three minutes · No account needed · Nothing runs until you press Run", the unchanged boundary block "Synthetic teaching simulator / NOT_EVIDENCE · simulation only · decision authority NONE"), the film poster beside it with its "Concept illustration · not simulation output" label; the film caption; "Choose another starting point." with Fleet day and Street lab cards (hosted adds the San Francisco card between them: "Would a second depot help?" with Compare depots, Follow a vehicle and Map & limits linking to `/city-explorer/#compare`, `#replay` and `#limits`); then "Browse all topics →" and "About & limits →". Page height 1,460px. On phones the order is copy, primary action, start cards, film, caption, browse links (measured tops at 375 wide: 73, 387, 698, 1,432, 1,809, 2,054).

### Explore (`#/catalog`)

Order: eyebrow EXPLORE, H1 "What would you like to understand?", lede, a search row with visible labels (Search lessons, Topic, Simulation model), three topic cards (Depot readiness & data; Fleet service & capacity; Streets & cities) each with example questions, the labs that serve it and "Show these lessons", the JUMP TO A LAB row, a visually hidden "All lessons" heading, the count ("61 of 61 lessons"), and the cards. Each card: id, the lesson's question as `h3`, one-sentence outcome, meta "Run a model · About 3 min · Depot flow lab" (5 min for paired tests), "Open lesson →", and a "More about this lesson" disclosure holding the full teaching frame. Topic cards hide while any filter is active; the empty state offers "Clear filters" and keeps focus on the Topic control. The "Start here" strip and the five lab blurbs are gone; the two cross-model caveats and "What is still outside this playground?" remain.

### About & limits (`#/approach`)

Sections: 01 What FleetLab models (the former scope copy plus the interactive depot illustration, now here rather than on Home), 02 People and decisions, 03 How results are produced and checked (the worked example, with a new step "Keep the record" explaining NOT_EVIDENCE), 04 Roadmap (one added entry: the planned Depot flow lab lessons are planned, not available), 05 How to evaluate, 06 Reading across models (the "separate contracts" and "not interchangeable" caveats), and the closing walkthrough action. The sentence "This is not a calibrated digital twin" is kept; the non-affiliation line is kept.

### Depot flow lab (`#/depot-flow-lab`)

- Breadcrumb "Explore / Depot readiness & data / Two vehicles, one uplink" (`nav[aria-label="Breadcrumb"]`; Explore is the link).
- The action reads "Compare the three rules" (NF-02: "Compare the four rules") with the helper "Runs the same workload under each rule." The three setup selects moved into a closed "Change the setup" disclosure after the action, which "Next test to try" opens.
- At the inspected minute, one readiness chain per rule and vehicle (Battery, Upload, Local step, Ready) with the words "✓ done", "in progress", "waiting" or "already at target"; the chain follows the selected rule on NF-02.
- Leaving the page clears the polite live region.

### Defects reproduced and closed (slice C)

| Reported defect | Result | Cause and fix | Regression test |
|---|---|---|---|
| Street lab shows a literal "null" | CONFIRMED at base (default Bridge rush, Compare route policies, AV-01, minute 0; present in 1,105 of 1,441 frames for AV-01) | `street-lab.js` passed a `null` child to native `replaceChildren` for an optional paragraph; it now spreads an empty array instead (one line) | `test/street-lab.test.mjs`: the followed AV detail never prints null, undefined or NaN before, during or after a comparison |
| Walkthrough initial label mismatch | CONFIRMED at base (navigate to Four-area experiments, then the walkthrough: the intro names OPS-01 while the map shows UC-08a until Prepare) | `studio.js` tour entry now appends "This walkthrough prepares OPS-01 when you press Prepare. Until then the map shows {current setup}." using the same world rule as the map; no preset is loaded, so the visitor's depot setup survives | `test/studio.test.mjs` and `test/app.test.mjs` (two tests against the visible world line) |
| Stale Depot flow lab announcements | CONFIRMED at base; closed by the lesson's `pause()` clearing the live region on route exit | `depot-flow-lab.js` | `test/depot-flow-ui.test.mjs` and `test/studio.test.mjs` |

## 3. Design decisions

- **Personality:** calm, exact, candid. One accent (the ink-filled primary button, green on hover), hairline borders, no shadows or gradients on the new surfaces, 18px card radius, 26px button radius, an 8px spacing grid.
- **Type:** H1 `clamp(40px,5vw,64px)` at weight 550 and letter-spacing -.045em on Home, Explore, About and the Depot flow lab (measured 64px at 1366, 40px at 375); ledes 18px/1.6; studio reading copy 16px/1.6; meta and captions at least 14px; eyebrows 11px with .14em tracking. No new fonts: the offline cap and the content policy rule out web fonts.
- **Tokens only:** the studio, catalog and depot blocks now use the warm `:root` tokens; the second (blue) `:root` palette and its dead rules were folded in or deleted. One token was added, `--rule-control #71897a`, for control borders (3.78:1 on white, verified by a new test). Focus is the shared 3px accent ring on buttons, summaries and links.
- **One primary action per view:** Home (Try a 3-minute experiment), About (the closing walkthrough link), Depot flow lab (Compare). Explore has none by design; every card carries a quiet "Open lesson" link.
- **Preserved on purpose:** the film and its illustration label, the depot illustration (moved to About), the boundary block wording, the non-affiliation footer, the offline edition and contact, every lab page's own layout and copy, and all scientific modules, fixtures and exports.

## 4. Departures from the V2 proposal and the plan

- **Topic filter breadth.** "Streets & cities" shows 9 lessons, not only the six street cases, because the filter follows the lesson family "Roads and streets", which also holds bay-area, UC-05 and OPS-17. The test asserts the family rule.
- **Breadcrumb.** Only "Explore" is a link; "Depot readiness & data" is plain text, because a second link to the same page added nothing.
- **Explore filters.** Topic plus Lab (the existing "Simulation model" select) instead of Topic plus Experience type: every lesson in the catalog is "Run a model", so an experience-type filter would have one useful value. The experience type appears on each card's meta line instead.
- **Base body size.** The `body` element still computes to 14px on every page (the lab pages depend on it). Studio content is set explicitly: 16px reading copy, 18px ledes, 16px card text.
- **Lesson glossary on Explore.** Removed from the catalog page; it remains on every lesson page.
- **Depot illustration.** Moved from Home to About & limits rather than kept as optional Home media.
- **Menu label.** The phone toggle switches between Menu and Close (the plan's test requires it); the proposal's "Menu" is the closed label.
- **Two review findings skipped:** A11Y-08 (Clear filters focus target; superseded by the Topic focus) and A11Y-09 (card heading ids).

## 5. Evidence

### Automated gates (run from the worktree at HEAD)

```text
node --test 'playground/fleetlab/test/*.test.mjs'   -> tests 2055, pass 2046, fail 0, skipped 8, todo 1
node --test 'apps/fleetlab-city/test/*.test.mjs'    -> tests 63, pass 63, fail 0
pack --out  dist/redesign-final/fleetlab-offline.html -> 2,533,188 bytes; check-dist OK
pack --site dist/redesign-final/teaching-site        -> 109 files, 3,474,876 bytes; check-dist OK; code 2,362,259 bytes
PYTHONPATH="$PWD/src" FLEET_PLAYGROUND_BASE=bca4ccd python -m pytest -q tests/unit/test_fleet_playground_boundaries.py -> 41 passed
python -m unittest discover -s apps/fleetlab-city/tests -p test_integration.py -> OK (HEAD and baseline)
python -m unittest discover -s apps/fleetlab-city/tests -p test_launch.py      -> OK (HEAD and baseline)
python -m ruff check . -> All checks passed
git diff --check     -> clean
```

The full City Python discover reports `failures=4, errors=86` of 286 at HEAD and the same at the baseline: the `hermes-dev` environment has no `pyproj` or `scipy`, so six City modules cannot import. No Python file in the City suite changed between baseline and HEAD except the release allowlist in `integrate-site.py` (below), and the two modules that exercise it pass.

### Browser measurements (packed `teaching-site`, served locally, Chromium in the Claude browser pane)

At 375×812, 768×1024 and 1366×768, for Home, Explore, About & limits and the Depot flow lab: no horizontal overflow, no control under 44px on either side (zero-size ignored), no console errors. Header 73px (phone) and 77px (desktop). Home primary action top: 387 (375), 367 (768), 433 (1366). Depot flow lab "Compare" top: 2,650 (375), 1,781 (768), 967 (1366). About's single primary sits at the page close. Explore at 375 is one column; the first card starts at 1,801px when no filter is active and at about 915px once a topic is chosen. After pressing Compare on NF-01, the result heading reads "Equal uplink share and departure deadline first get both vehicles ready on time; first come, first served gets 1 of 2.", six readiness chains render, `document.getAnimations()` is 0 and focus is handled as before.

A hosted-style preview was staged locally by wiring `integration.mjs` and `integration.css` into a copy of the packed site, as `integrate-site.py` does. It shows three header links, the San Francisco card between Fleet day and Street lab with its three actions, City Explorer at the end of the lab links, the trust legend inside the boundary block, the catalog's recorded-study section and the footer's offline edition and contact, with no console errors. This preview is for inspection only; it is not a release package.

Screenshots were possible only while the browser pane was displayed: Home and About & limits at 1366×768 were captured (desktop); the other views were verified by DOM measurements and computed styles.

### Not done

- No visitor sessions, no screen-reader listening, no physical phone, no real 200% zoom. The proposal's section 10 task script still needs five people.
- No City release package was built (`integrate-site.py --flow-update` was not run), no Wrangler preview, no readback, no publication.
- The hosted City Explorer pages themselves were not changed; Home links into their existing hashes.

## 6. Risks and open items

- **Explore on phones is long before a filter is chosen** (first card at 1,801px). The topic cards are the intended entry; a visitor who scrolls past them still reaches the count and the cards. A sticky search row was not added because the site avoids sticky layers.
- **"Compare the three rules" sits below the first screen** on every width (the vehicle cards, rules and the readiness sentence come first by design). The proposal's optional sticky bar was left out; the formative study should watch whether first-time visitors find the action.
- **The 5-minute and 3-minute labels are editorial estimates**, as the proposal says; they are not measured durations.
- **Hosted publish tooling:** `FLOW_CHANGED` in `apps/fleetlab-city/tools/integrate-site.py` now includes `src/ui/street-lab.js` and the release label reads `visitor-redesign-2026-10-09`. The integration will reject any further undeclared teaching module change, which is the intended guard.
- **`display: contents`** is used only on phones to reorder the Home hero around the start cards. Tab order still follows the DOM (copy, film control, start cards). If a reader test finds this confusing, the DOM order can be changed instead.

## 7. Rollback

The branch is local and additive. To discard it: `git worktree remove ../Hermes-redesign` (from the main checkout) and `git branch -D claude/fleetlab-visitor-redesign`. Nothing on the live site, in `docs/releases/`, or in any published package depends on it. If it is merged and later needs reverting, `git revert` of its seven commits restores the October 9 release behavior; no data, schema or fixture migrates in either direction.

## 8. Integration and publication (owner's steps, not run here)

1. Review the branch (`git log --oneline 1df2e36..HEAD`; the seven commits are listed below) and merge or rebase it onto `codex/fleetlab-city-sf`.
2. Run the gates above from the repository root with the Python 3.11 environment, plus the full Hermes suite as the runbook requires (`PYTHONPATH="$PWD/src" FLEET_PLAYGROUND_BASE=bca4ccd PYTHONDONTWRITEBYTECODE=1 python -m pytest -q`).
3. Build both editions with `node playground/fleetlab/tools/pack.mjs --out <dir>/fleetlab-offline.html` and `--site <dir>/teaching-site`, then `check-dist` on both.
4. Integrate with `apps/fleetlab-city/tools/integrate-site.py --flow-update --client-update <teaching-site> --source-commit <reviewed commit>` and the preserved legacy, viewer, previous, offer, offline and readback inputs used on October 9 (the `build/fleetlab-city/network-flows-20261009/` package records them). Inspect `review/integration-manifest.json`; package only its `site/`.
5. Preview with the pinned Wrangler wrapper (`node apps/fleetlab-city/deploy/wrangler.mjs pages deploy SITE --project-name fleetlab --branch codex-city-explorer`), verify every byte with `tools/readback.py`, check headers, the real 404, phone width and normal navigation, then publish with `--branch feat/fleetlab-playground` and repeat the readback. Record deployment ids, the prior production id and the manifest, then update `docs/releases/fleetlab-current.json`.

## 9. Commits on `claude/fleetlab-visitor-redesign`

```text
712e33f feat: three-link shell with a question-led Home and About & limits
5b67f43 feat: question-led Explore page with topics and compact lesson cards
965ec77 feat: breadcrumb, compare action and readiness chain on the Depot flow lab
e210de8 fix: reproduce and close the street, walkthrough and announcement presentation defects
a2e4dcd fix: apply review findings to the visitor redesign
148812e fix: place the concept film after the starting points on phones
(next)   docs: add the visitor redesign plan, built report and release allowlist
```

Files changed against the baseline: `playground/fleetlab/src/ui/{studio,simulation-catalog,routes,street-lab,depot-flow-lab,depot-flow-reading}.js`, `playground/fleetlab/styles.css`, `apps/fleetlab-city/hosted/{integration.mjs,integration.css}`, `apps/fleetlab-city/tools/integrate-site.py`, and tests under `playground/fleetlab/test/` and `apps/fleetlab-city/test/`.

## 10. Method

The work followed the plan in `docs/plans/2026-10-09-fleetlab-visitor-redesign.md`: failing test first, minimal implementation, full suites, one commit per task. A read-only investigation reproduced the three defects against the base commit before any shell change. After the four build tasks, a verifier ran the gates and browser measurements, three reviewers (design, accessibility and copy, code) returned 30 findings, a fix round applied 27 of them and re-verified, and the lead reviewer re-ran every gate, measured the packed site at three widths, staged the hosted preview, and made the phone-order change by hand. AI review and automated checks are not human usability evidence.
