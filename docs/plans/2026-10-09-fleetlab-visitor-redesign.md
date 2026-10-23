# FleetLab visitor redesign (slices A to C) implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the first visit answer "What is this? What can I try? What did I learn?" by rebuilding Home, a three-link shell, a question-led Explore page and an About & limits page, polishing the Depot flow lab result page, and closing the three reported presentation defects, without changing any scientific output.

**Architecture:** The studio shell (`playground/fleetlab/src/ui/studio.js`) owns the header, Home, About and routing; the catalog module owns Explore; hosted-only entries are inserted by `apps/fleetlab-city/hosted/integration.mjs`. All routes, the 61 catalog identities, the model and verifier modules, the fixtures and the exports stay byte-identical. Presentation only.

**Tech stack:** vanilla ES modules, the `el()` DOM helper, `styles.css` tokens, `node --test` with the fake DOM, `pack.mjs` and `check-dist.mjs` for both editions.

**Source of the design:** `docs/FLEETLAB_WEBSITE_REDESIGN_PROPOSAL_2026-10-09_V2.md` (sections 1 to 6, 8). Baseline: branch `codex/fleetlab-city-sf` at `1df2e36`; worktree `Hermes-redesign`, branch `claude/fleetlab-visitor-redesign`.

**Baseline measured in this worktree (2026-10-09):** teaching Node suite 2,041 tests (2,032 pass, 8 skipped, 1 todo); City Node 63 pass; offline edition 2,543,663 bytes of 2,621,440; hosted code 2,372,649 bytes; `check-dist` OK for both editions. Byte rule for this work: the offline edition must stay at least 50,000 bytes under the cap (so net growth at most 27,777 bytes); aim for a net reduction.

---

## Hard rules for every task

- Never edit `src/model/**`, `src/runtime/**`, `src/instrument/**`, `src/core/**`, `tools/pack.mjs`, `tools/media.mjs`, fixtures, or `docs/releases/**`.
- Routes and their paths in `src/ui/routes.js` stay. Only the three display titles change (overview "Home", catalog "Explore", approach "About & limits"). `ROUTES.depots.title` stays "Four-area experiments".
- Copy rules enforced by `tools/check-dist.mjs`: no em or en dashes anywhere in interface copy (use commas, colons, "to"); none of the banned words predict/prediction/forecast/live/real-time/monitoring; no external URLs; no `fetch(` or `import(`.
- Every interactive control at least 44 by 44 px, visible focus (the existing 3px accent ring), no color-only state, no new fonts, no new dependencies, no autoplay, no scroll-triggered motion.
- Tokens only: `--ground #fafbf7`, `--panel #ffffff`, `--panel-alt #eef4ef`, `--ink #183c37`, `--muted #526762`, `--accent #166653`, `--accent-soft #e0f0e6`, `--rule #dce5dd`, `--rule-strong #9fb6ad`, `--cond #8d631f` (amber), `--hold #a84432`, `--studio-mint #e2f1e6`, `--studio-lilac #eeedf7`, `--studio-peach #faeee2`. No new hex values in the studio blocks except where a token does not exist (then define the token once in the warm `:root` at `styles.css` line 1480).
- Type: body 16px/1.6; lede 18px/1.6 at most 60ch; H1 `clamp(40px,5vw,64px)` weight 550 letter-spacing -.045em line-height 1.05; H2 `clamp(28px,3vw,40px)` letter-spacing -.03em; eyebrow 11px letter-spacing .14em uppercase; meta lines 14px. Radii 18px cards, 26px buttons. No shadows; 1px `--rule` hairlines.
- One primary action per view (`.studio-button-primary`, ink background, accent on hover). Everything else is a quiet button or a text link.
- Run focused tests after every task, then the full suite before every commit. Commit with explicit paths, never `git add -A`.

---

## Task 1: Shell, Home and About & limits

**Files:**
- Modify: `playground/fleetlab/src/ui/studio.js` (functions `overview`, `approach`, `mountStudio` nav and footer)
- Modify: `playground/fleetlab/src/ui/routes.js` (three titles only)
- Modify: `playground/fleetlab/styles.css` (studio header, overview, approach, footer blocks; see "CSS to delete" below)
- Modify: `apps/fleetlab-city/hosted/integration.mjs` and `integration.css` (Home card, quick link, footer; drop the lab guide and the nav insertion)
- Modify tests: `playground/fleetlab/test/studio.test.mjs`, `apps/fleetlab-city/test/hosted-integration.test.mjs`, `playground/fleetlab/test/scale-lab.test.mjs` (lines 288 and 291 only)

**Step 1: Write the failing tests** (replace the assertions that encode the old navigation; keep every other assertion)

In `studio.test.mjs`:
- "workspace main, native navigation..." : `assert.equal(x.studio.element.querySelectorAll('.studio-header nav a').length,3)`; header link texts are exactly `['Home','Explore','About & limits']`.
- "compact navigation exposes its state...": click `nav.querySelector('[data-nav="catalog"]')` instead of scale; assert `data-page` is `catalog`; the toggle text is `Menu` when closed and `Close` when open.
- "welcome actions...": `.hero-actions a[href="#/depot-flow-lab?lesson=two-vehicles"]` is the primary (`classList` contains `studio-button-primary`); `.hero-actions a[href="#/catalog"]` exists; clicking the primary shows the flows page with `flows.getState().result === null`; the start-point cards contain `a[href="#/fleet-day"]` and `a[href="#/street-lab"]`; clicking fleet day shows operations idle.
- "welcome names the teaching boundary": unchanged (keep the `.welcome-boundary` strong/span inside `.studio-film-hero`).
- "overview does not execute a simulation and a depot stage explains its boundary": unchanged in substance; the depot scene now lives on About, and `document.querySelector('[data-stage="service"]')` still finds it.
- New test "quick lab links carry data-nav ids and open their pages idle": `[data-nav="simulation"]`, `[data-nav="streets"]`, `[data-nav="depots"]`, `[data-nav="scale"]`, `[data-nav="flows"]`, `[data-nav="tour"]` all exist inside `.lab-links`; the depots link text equals the depots page h1 and `document.title` prefix after `navigate('depots')`.
- New test "About & limits keeps the model boundary and the depot stages": after `navigate('approach')`, the main text matches `/not.*digital twin/i`, `/Outside the model/`, and contains `[data-stage="arrive"]`.

In `hosted-integration.test.mjs`: the nav keeps exactly its original children (no City link in the header); `.lab-links a[href="/city-explorer/"]` exists once with text `City Explorer`; `.studio-overview .city-entry-feature` exists once and contains three `a.city-entry-action` with hrefs `/city-explorer/#compare`, `/city-explorer/#replay`, `/city-explorer/#limits`; drop the `.lab-guide` assertions; keep the trust legend, catalog section, offline edition and contact assertions.

In `scale-lab.test.mjs` line 288: replace `studio.element.querySelector('.decision-grid').children[3].textContent` with `studio.element.querySelector('.lab-links [data-nav="scale"]').textContent`; line 291: replace the `.decision-card a[href="#/scale-lab"]` assertion with `.lab-links a[href="#/scale-lab"]`.

**Step 2: Run** `node --test playground/fleetlab/test/studio.test.mjs apps/fleetlab-city/test/hosted-integration.test.mjs playground/fleetlab/test/scale-lab.test.mjs` and confirm the new assertions fail.

**Step 3: Implement**

`routes.js`: titles `overview:'Home'`, `catalog:'Explore'`, `approach:'About & limits'`.

`studio.js` `mountStudio`:
- `navItems=[['overview','Home'],['catalog','Explore'],['approach','About & limits']]`.
- Menu toggle text `Menu` / `Close` (same attributes as today).
- Add `labLinks(navigate)` returning `nav.lab-links` with `aria-label="Labs"` and links (each with `data-nav`): Fleet day (simulation), Street lab (streets), Four-area experiments (depots), Scale lab (scale), Depot flow lab (flows), Guided walkthrough (tour). It is rendered once on the Explore page (Task 2 mounts it; for this task export it on the studio handle as `labLinks` and append it to the catalog element after the intro, so the test passes now) and the `aria-current` loop in `renderPage` covers `navLinks` plus these links.
- Footer nav: Explore, About & limits, Guided walkthrough.

`overview(navigate, film)` returns:

```js
el("main",{class:"studio-overview",id:"studio-overview"},[
  el("section",{class:"studio-film-hero"},[
    el("div",{class:"film-copy"},[
      eyebrow("INTERACTIVE FLEET SIMULATIONS"),
      el("h1",{},"See what keeps a fleet moving."),
      el("p",{class:"film-lede"},"Try small simulations of trips, charging and depot work. Change one decision, follow what happens, and see the trade-offs."),
      el("div",{class:"hero-actions"},[lessonLink("Try a 3-minute experiment  →","flows","two-vehicles",navigate,true),pageLink("Explore all lessons","catalog",navigate)]),
      el("p",{class:"hero-duration"},"About three minutes · No account needed · Nothing runs until you press Run"),
      el("div",{class:"welcome-boundary"},[el("strong",{},"Synthetic teaching simulator"),el("span",{},"NOT_EVIDENCE · simulation only · decision authority NONE")]),
    ]),
    el("div",{class:"welcome-visual"},[ /* unchanged film block */ ]),
  ]),
  el("div",{class:"film-caption"},[ /* unchanged two paragraphs */ ]),
  el("section",{class:"start-points","aria-labelledby":"start-points-title"},[
    el("h2",{id:"start-points-title"},"Choose another starting point."),
    el("div",{class:"start-grid"},[
      startCard({label:"FLEET DAY · RUN A MODEL",title:"Can the fleet meet demand?",text:"Run a synthetic Bay Area day. Change the fleet or a depot, then read service, batteries and queues together.",cta:"Run a fleet day  →",page:"simulation"},navigate),
      startCard({label:"STREET LAB · RUN A MODEL",title:"Where do queues form?",text:"Directed San Francisco streets with block queues. Compare two route rules on the same riders.",cta:"Open the Street lab  →",page:"streets"},navigate),
    ]),
  ]),
  el("nav",{class:"home-browse","aria-label":"Browse"},[pageLink("Browse all topics  →","catalog",navigate),pageLink("Sources and limits  →","approach",navigate)]),
])
```

`lessonLink(text,page,lesson,navigate,primary)` builds `a` with `routeHref({page,lesson})` and `followLink` to `visit({page,lesson})` (expose `visit` to the helper by defining `lessonLink` inside `mountStudio` or passing `visit`). `startCard` renders `article.start-card` with `p.eyebrow`, `h3`, `p`, and the `pageLink` button.

`approach(navigate)` returns, in this order: intro (eyebrow `ABOUT & LIMITS`, h1 `What FleetLab models, and what it does not.`, lede `FleetLab is the browser learning playground inside Hermes, an independent simulation and evidence-review project. Every model here is synthetic, inspectable and bounded.`, the `NON_AFFILIATION` paragraph); section `01 / WHAT FLEETLAB MODELS` with h2 `Five small models, one operating cycle.`, the former scope paragraphs ("Find the right learning model" and "Outside the model" as h3 + p), then `createDepotScene()`; the former people grid section `02 / PEOPLE & DECISIONS`; the former hypothesis section `03 / HOW RESULTS ARE PRODUCED AND CHECKED` (h2 `Run computes. Checks reconstruct. Nothing here is authority.`) with the existing steps plus one new step `el("li",{},[el("strong",{},"Keep the record"),"Every lesson keeps its inputs, outcomes and named checks inspectable; NOT_EVIDENCE means a teaching run, not a qualified result."])`; the former roadmap section `04 / ROADMAP` keeping its five entries and adding one `["PLANNED","Depot flow lab, next lessons","Capacity decisions, competing data jobs, estimate error and custody are planned lessons, not available ones."]`; the former evaluation section `05 / HOW TO EVALUATE`; section `06 / SOURCES, CONTEXT AND CONTACT` with `p` "Fleet day also hosts separate contracts: staffing, charging, charger status, airport wave, launch rehearsal and the Austin power lab." and `p` "Each model has its own assumptions, so numbers from different models are not interchangeable."; the existing close. Keep the sentence containing "not a calibrated digital twin".

`integration.mjs`: do not insert into the header nav. Insert the SF card into `.start-grid` as the second child:

```js
const card=node('article',{class:'start-card city-entry-feature'},[
  node('p',{class:'eyebrow'},'SAN FRANCISCO · RECORDED STUDY · MAP QUALIFICATION OPEN'),
  node('h3',{},'Would a second depot help?'),
  node('p',{},'A recorded synthetic study on sourced streets. Compare depots, follow one vehicle, then read the map and its limits.'),
  node('div',{class:'city-entry-actions'},[action('Compare depots','#compare'),action('Follow a vehicle','#replay'),action('Map & limits','#limits')]),
]);
```
Append `node('a',{id:'city-explorer-entry',class:'studio-button',href:'/city-explorer/'},'City Explorer')` to `.lab-links`. Keep the trust legend, the `.city-entry-catalog` section after `.catalog-intro`, the footer offline edition and contact. Delete the `.lab-guide` block and the big `.city-entry-feature` layout; replace its CSS with card rules.

**CSS to delete** (dead or superseded once the sections are gone): `.studio-hero`, `.hero-copy*`, `.hero-summary`, `.hero-description`, `.studio-facts*`, `.decisions-section`, `.section-heading*` (check `grep -n section-heading src` first; delete only if unused), `.decision-grid`, `.decision-card*`, `.loop-section`, `.demo-heading`, `.decision-loop*`, `.loop-number`, `.scope-section*`, `.depot-introduction` (keep `.depot-scene*` rules, now used on About), the dark film-hero variant at lines 1323 to 1344 and 1401 that the light variant at 1505 to 1528 overrides (keep `.hero-film`, `.film-poster`, `.film-video`, `.film-scrim`, `.film-control`, `.film-status`, `.film-illustration-label`), the nav collapse rules that assumed nine links (`@media (max-width:1450px)` block near line 1749 and the hosted `@media (max-width:1279.98px)` nav grid in `integration.css`), `.lab-guide*`, and the blue `.studio-header nav a[aria-current]` / `:hover` rules at lines 692 and 693 that the warm rules at 1496 and 1497 override. Then add: `.start-points`, `.start-grid` (grid `repeat(auto-fit,minmax(280px,1fr))`, gap 20px), `.start-card` (panel, 1px rule, radius 18px, padding 28px, h3 24px/1.25 weight 550 letter-spacing -.03em, p 16px/1.6 muted, button at the bottom), `.city-entry-actions` (wrap, 8px gaps, quiet buttons), `.home-browse` (two quiet buttons, 48px top margin), `.lab-links` (wrapping row of quiet buttons, 8px gap, 44px tall; `aria-current` gets `--accent-soft` background), header: nav inline at 768px and wider, hidden below 768px unless `data-expanded="true"` (then a one-column list under the brand); the menu button visible only below 768px.

Measure the byte effect: run `node playground/fleetlab/tools/pack.mjs --out dist/redesign-work/fleetlab-offline.html` and compare with 2,543,663.

**Step 4: Run** the three test files, then `node --test 'playground/fleetlab/test/*.test.mjs'` and `node --test 'apps/fleetlab-city/test/*.test.mjs'`; expected all pass (2,041 and 63, plus the new tests).

**Step 5: Commit** `feat: three-link shell with a question-led Home and About & limits` (explicit paths).

---

## Task 2: Explore (the catalog)

**Files:**
- Modify: `playground/fleetlab/src/ui/simulation-catalog.js`, `playground/fleetlab/styles.css` (catalog block near 1063 to 1083 and 1607 to 1625), `apps/fleetlab-city/hosted/integration.mjs` (only if the catalog hook moves), `playground/fleetlab/src/ui/studio.js` (mount `labLinks` into the catalog element, remove the Task 1 temporary append)
- Modify tests: `playground/fleetlab/test/simulation-catalog.test.mjs`, `playground/fleetlab/test/scale-lab.test.mjs` (line 288 `.catalog-models` and line 292 `.catalog-start`), `playground/fleetlab/test/studio.test.mjs` (the Task 1 quick-links test now looks inside `.simulation-catalog .lab-links`)

**Step 1: Write the failing tests**
- `simulation-catalog.test.mjs`: new test "Explore leads with search, three topics and compact cards": the first `h1` text is `What would you like to understand?`; `[aria-label="Topic"]` has options `All topics, Depot readiness & data, Fleet service & capacity, Streets & cities`; selecting `Streets & cities` shows exactly the six `street-*` cards; selecting `Depot readiness & data` shows every card whose frame family is `Depot work and capacity` or `Energy and charging`; each `.catalog-card` has, in order, `h3` (the question), `p.catalog-outcome`, `p.catalog-meta` whose text matches `/^Run a model · About \d+ min · /`, then `a.studio-button` with text `Open lesson  →`, then `details` whose summary is `More about this lesson`; the `.catalog-collections` section has three `article` children in the fixed order above; every lesson id from `simulationCatalog()` still renders exactly once with `[data-simulation]`.
- Keep the existing search test (`Software-update` filters to one card and the click launches the setup).
- `scale-lab.test.mjs` line 288: replace `.catalog-models` children[3] with `.catalog-collections` children[0]; line 292: assert `studio.element.querySelector('.catalog-card[data-simulation="density-ladder"] a[href="#/scale-lab?lesson=density-ladder"]')`.

**Step 2: Run** `node --test playground/fleetlab/test/simulation-catalog.test.mjs playground/fleetlab/test/scale-lab.test.mjs` and confirm failure.

**Step 3: Implement** in `simulation-catalog.js`:

```js
export const COLLECTIONS=Object.freeze([
  {name:'Depot readiness & data',families:['Depot work and capacity','Energy and charging'],questions:'Why can a charged vehicle still wait? Which upload should go first? Would another bay or worker help?',labs:'Depot flow lab · Fleet day depot and charging lessons'},
  {name:'Fleet service & capacity',families:['Fleet size and supply','Demand, crowds and weather','Reading a run and a result','Launching a new area','Recall, release and depot choice','Scaling the fleet'],questions:'Can the fleet meet demand? What changes as a fleet grows? Does a policy help across repeats?',labs:'Fleet day · Four-area experiments · Scale lab'},
  {name:'Streets & cities',families:['Roads and streets'],questions:'Where do queues form? Can one block tie up the fleet?',labs:'Street lab · San Francisco City Explorer (hosted)'},
]);
export const collectionOf=frame=>COLLECTIONS.find(c=>c.families.includes(frame.family))?.name??'Fleet service & capacity';
const minutes=r=>r.frame.evidence==='paired'?5:3;
```

Page order inside `main.simulation-catalog`: `section.catalog-intro` (eyebrow `EXPLORE`, h1, lede `Every lesson answers one fleet question with a small synthetic model. Start from a question, a topic or a lab you already know.`), `div.catalog-search` (search input with placeholder `Search questions, topics or lab names…` and `aria-label="Search lessons"`; `select[aria-label="Topic"]`; `select[aria-label="Simulation model"]` with `All labs` plus the five model names; keep the existing family select out), `p.catalog-count[role=status]`, the studio's `nav.lab-links` (passed in as `labLinks` option; its heading `p.eyebrow` `JUMP TO A LAB`), `section.catalog-collections` (three `article`: h2 name, p questions, p labs, `button.studio-button` `Show these lessons` that sets the Topic select and re-renders), `div.catalog-grid` of cards, then the two closing paragraphs and `section.catalog-outside` (unchanged text).

Card:

```js
el('article',{class:'catalog-card','data-simulation':r.id},[
  el('span',{class:'catalog-card-id'},r.id),
  el('h3',{},r.frame.what_why),
  el('p',{class:'catalog-outcome'},r.frame.look_for),
  el('p',{class:'catalog-meta'},`Run a model · About ${minutes(r)} min · ${r.model}`),
  el('a',{href:hrefForLesson(r),class:'studio-button',on:{click:...same handler...}},'Open lesson  →'),
  el('details',{},[el('summary',{},'More about this lesson'),frameView(r.frame,{title:r.title,seeds:lessonSeeds(r),change:lessonChange(r),limits:r.limits})]),
])
```

`render()` filters by query (title, frame text, id, model name), topic (via `collectionOf`), and model. Count text: `${shown.length} of ${records.length} lessons`. Empty state: `No lesson matches. Clear the filters or try a resource word such as charging or queue.` plus a `button` `Clear filters`. The `.city-entry-catalog` hook in `integration.mjs` keeps inserting after `.catalog-intro`.

CSS: `.catalog-search` row wraps; input 48px tall, 16px; selects 48px; `.catalog-collections` grid `repeat(3,minmax(0,1fr))` at 1000px and wider, one column below; collection article: `--panel-alt` background, 1px rule, radius 18px, padding 24px, h2 22px; `.catalog-grid` `repeat(auto-fill,minmax(320px,1fr))` gap 20px; `.catalog-card` panel, 1px rule, radius 18px, padding 24px, `h3` 20px/1.3 weight 550, `.catalog-outcome` 16px/1.6 muted, `.catalog-meta` 14px muted, button quiet; `.catalog-card-id` 12px mono muted. Delete the old `.catalog-models*`, `.catalog-start*`, `.catalog-question`, `.catalog-card dl/dt/dd` rules and the duplicated old blue card rules at 1072 to 1083 where superseded.

**Step 4: Run** the catalog, scale-lab and studio tests, then both full suites.

**Step 5: Commit** `feat: question-led Explore page with topics and compact lesson cards`.

---

## Task 3: Depot flow lab result page polish (slice B)

**Files:**
- Modify: `playground/fleetlab/src/ui/depot-flow-lab.js`, `playground/fleetlab/src/ui/depot-flow-reading.js`, `playground/fleetlab/styles.css` (the `.depot-flow-lab` block only)
- Modify tests: `playground/fleetlab/test/depot-flow-ui.test.mjs` (button text, breadcrumb, chain)

Read `src/ui/depot-flow-view.js` `inspectState` first; it returns per-vehicle text and the task completion times. Do not change it.

**Step 1: Failing tests**
- the page has `nav.flow-breadcrumb[aria-label="Breadcrumb"]` with links `Explore` (`#/catalog`) and `Depot readiness & data` (`#/catalog`) and a current span with the lesson title;
- the run button text is `Compare the three rules` (NF-01) and `Compare the four rules` (NF-02), followed by `p.flow-run-help` `Runs the same workload under each rule.`;
- after a run and a seek to 180 s, the readout contains for each rule and vehicle a `.flow-chain` with four `span` steps labelled `Battery`, `Upload`, `Local step`, `Ready`, each carrying `data-state` in `done|active|waiting|not-applicable`; at 180 s under departure deadline first, Vehicle B's chain reads done, done, done, done; under first come, first served it reads not-applicable (already at target), waiting, waiting, waiting;
- leaving the page (`pause()`) clears the live region text; `getState().result` is unchanged by all of the above.

**Step 2: Run** `node --test playground/fleetlab/test/depot-flow-ui.test.mjs`; confirm failure.

**Step 3: Implement**
- `buildLesson()`: before the H1, add the breadcrumb nav; rename the run button and add the help line under the actions row.
- `renderReadout(t)`: for each row, after the text table row, render the chain from the same `inspectState` row: Battery is `not-applicable` when `energy_j===0`, `done` when the charge completion time is at or before `t`, otherwise `active` while charging; Upload `done` when upload completion at or before `t`, `active` when the accepted rate is above zero at `t`, else `waiting`; Local step `done`, `active` (running), `waiting` (needs upload); Ready `done` when `ready_s` at or before `t`, else `waiting`. Words come from a map, never color alone: `done` renders `✓ done`, `active` renders `in progress`, `waiting` renders `waiting`, `not-applicable` renders `already at target`. Put the chain in a `div.flow-chain[aria-label="Readiness chain"]` inside the readout, one per rule and vehicle, before the table.
- `pause()`: `live.node.textContent=''` after `player?.pause()`.
- CSS in the depot block: `.flow-breadcrumb` 14px muted, separators `/` as text; `.flow-run-help` 14px muted; `.flow-chain` flex, 8px gaps; `.flow-chain span` 14px, padding 6px 10px, radius 999px, 1px rule; `[data-state="done"]` `--accent-soft` background and `--ink`; `[data-state="active"]` `--ink` background and `#fff`; `[data-state="waiting"]` 2px dashed `--cond` outline; `[data-state="not-applicable"]` muted.

**Step 4: Run** the depot tests, then both full suites. Confirm `node playground/fleetlab/tools/pack.mjs --out ...` size and `check-dist`.

**Step 5: Commit** `feat: breadcrumb, compare action and readiness chain on the Depot flow lab`.

---

## Task 4: Reproduce and fix the three reported presentation defects (slice C)

**Files:** `playground/fleetlab/src/ui/street-lab.js`, `playground/fleetlab/src/ui/studio.js` (tour entry), `playground/fleetlab/src/ui/present.js` only if needed, tests `test/street-lab.test.mjs`, `test/studio.test.mjs`, `test/depot-flow-ui.test.mjs`.

For each defect: write the exact reproduction as a test first; record CONFIRMED or NOT REPRODUCED with the sequence; fix only confirmed defects with the smallest change.

1. **Street lab `null`.** Sequence from the review: default Bridge rush, press `Compare route policies`, select AV-01 (default), inspect the vehicle detail before and after the comparison and at minute 0. Assert no text node in `.street-lab` matches `/\bnull\b|undefined|NaN/`. Candidate sources: `fmt(car.progress*100,0)` when `progress` is null, `car.completed` undefined, `label(car.anchor)` when anchor is null (`label` already falls back). Fix in the renderer with a meaningful empty state (`not available: ...`), never in the model.
2. **Walkthrough initial label.** Sequence: `navigate('depots')` (loads UC-08a), then `navigate('tour')`. Assert the workspace intro and the presenter's visible scenario label agree before Prepare: either both name OPS-01 or the intro says which casebook question is loaded. Fix: on tour entry, when `present.prepared` is false, the intro sentence reads `This walkthrough prepares OPS-01 when you press Prepare. The workspace currently shows {current preset title}.` computed from `store.getState().presetId`, or load OPS-01 if that is safe for the existing "returning does not erase its scenario" test. Choose the smallest change that keeps every existing test.
3. **Stale lesson announcements.** Sequence: run NF-01, press Next event (the live region speaks), navigate to `overview`, navigate back. Assert the live region is empty after leaving and that nothing is announced on return until a user action. Task 3 already clears on `pause()`; add the test here and confirm.

**Commit** `fix: reproduce and close the street, walkthrough and announcement presentation defects` (or `docs:` if nothing reproduced, recording the result in the test names).

---

## Task 5: Verification

1. `node --test 'playground/fleetlab/test/*.test.mjs'` and `node --test 'apps/fleetlab-city/test/*.test.mjs'`: all pass, counts recorded.
2. Pack both editions into `dist/redesign-final/`; `check-dist` on both; record offline bytes, hosted code bytes (all files except `media/`), deltas against 2,543,663 and 2,372,649.
3. Python gates with the project's Python 3.11 environment (`hermes-dev`) from the worktree root: `PYTHONPATH="$PWD/src" FLEET_PLAYGROUND_BASE=bca4ccd PYTHONDONTWRITEBYTECODE=1 python -m pytest -q tests/unit/test_fleet_playground_boundaries.py` and `python -m unittest discover -s apps/fleetlab-city/tests -q`; `python -m ruff check .`; `git diff --check`.
4. Browser checks on the packed site through the Claude browser pane (serve `dist/redesign-final/teaching-site` locally with `python3 -m http.server`; keep any preview-server config out of the repository): at 375×812, 768×1024 and 1366×768 record for Home, Explore, About and NF-01: no horizontal overflow, header height, the first primary action's top, every control at least 44px, focus order of the first eight tab stops, and the computed colors of the primary button and body text.
5. Record every number for the built report.

---

## Task 6: Built report

Write `docs/FLEETLAB_WEBSITE_REDESIGN_BUILT_REPORT_2026-10-09.md` with: what changed (per page, with before/after structure), what was deliberately not changed (science, routes, City package), test and build evidence with exact numbers, defect reproduction results, browser measurements, design decisions and departures from the V2 proposal, remaining risks, rollback (`git revert` of the branch commits; the published release is untouched), and the exact commands to integrate and publish, which this work does not run.
