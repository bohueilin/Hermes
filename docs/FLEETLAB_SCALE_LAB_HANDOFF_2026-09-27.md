# FleetLab Scale lab: handoff for the next reviewer or builder

Date: September 27, 2026; updated on September 28, 2026 with the owner's answers, the heading fix release and the
push. This file is self-contained. A reader with no access to the repository can review the
work from it. A reader with access can reproduce every gate from the commands in section 6.

FleetLab is an independent, synthetic teaching simulator. It is not affiliated with any operator, vehicle maker,
regulator or utility. Every result is NOT_EVIDENCE, simulation only, decision authority NONE.

## 1. Read this first

| Item | State |
|---|---|
| What was added | One route, `#/scale-lab`, with three labs on what changes as a fleet scales. Three new lessons, so the catalog holds 59 |
| Live | https://fleetlab.pages.dev/#/scale-lab. Since 2026-09-28, Production deployment `77922688-6d87-4d15-94bf-442beab31712` from `1aeaace`; the Scale lab release of 2026-09-27, `19e17ac6-d617-4789-9260-ca259c53e076` from `c08f60d`, is the rollback target |
| Deployed source | `1aeaacecb25e17853f852d7bbd7141ff75d9cb69` since 2026-09-28, one commit past the Scale lab source `c08f60d8830df877fac2c7321bb47d75a5ae56ad`, on branch `claude/fleetlab-scale-lab` |
| Branch head now | The records commit of 2026-09-28, on top of the privacy commit `0bc2f25`, the documents commit `44569f8` and `1aeaace`. None of the three changes a site input, so the site inputs of the branch head equal those of `1aeaace`. `1aeaace` fixes a Fleet day heading defect older than this wave (known open item 10). **Deployed on 2026-09-28** as `77922688`; no site input is undeployed |
| Pushed | **Yes, on 2026-09-28.** On the owner's word, right after the records commit of 2026-09-28, the lead pushed the branch head to github as a fast-forward of `feat/fleetlab-playground` from `790573e`. The Scale lab source, `1aeaace` and the documents commits are public there. No remote branch `claude/fleetlab-scale-lab` was created |
| Also published by this deployment | The teaching frames for the 56 older lessons, which had been local only |
| Tests | At `c08f60d`, the Scale lab release: 1,968 tests, 1,967 pass, 0 fail, 0 cancelled, 0 skipped, 1 existing todo. `1aeaace` adds one test, 1,969 in all. Two full serial runs at `1aeaace` each read 1,967 pass, 1 existing todo and 1 timing failure that passed its one isolated rerun (section 6). A full run at `1aeaace` with zero failures is not recorded |
| Public readback | 98 of 98 public files match the local package by SHA-256, at the Scale lab release of 2026-09-27 and again at the release of `1aeaace` on 2026-09-28, on both addresses each time |
| Owner decisions | **Ratified by the owner on 2026-09-28**, as recommended. Every design decision was taken at the lead's recommendation. Section 7 lists them |
| Not yet done | A look at the pages by the owner, or any person, with a visible pane. Every browser reading so far is measured, not seen. The sweep of all 59 lesson links in a real browser and the hosted checks of 2026-09-28 ran with the pane hidden, so they painted no frame. The owner chose the next builds on 2026-09-28: candidate 1 (acceptance in a visible browser) then candidate 2 (an operating view of one simulated period) |

Four documents hold the detail: the [release record](FLEETLAB_SCALE_LAB_RELEASE_2026-09-27.md), the
[design](plans/2026-09-27-fleetlab-scale-lab-design.md), the [build record](plans/2026-09-27-fleetlab-scale-lab-plan.md)
and the [model notes](FLEETLAB_SCALE_LAB.md).

## 2. Why this work exists

FleetLab taught one market on one day: fleet size against demand, bays against cleaning time, one street queue. That
is operations. It did not teach what changes when a fleet grows by a factor of five to ten. The research behind this
wave reduced that question to mechanisms:

| Mechanism | Plain statement | Lab |
|---|---|---|
| Density with diminishing returns | More cars in one area shorten pickups, and most of the gain arrives early | Density ladder |
| The bottleneck moves | Grow fleet and demand together and the limit moves from the street to the depot | Density ladder |
| Lead-time mismatch | Vehicles arrive in weeks. Site power, ports, stalls and staff arrive after their own lead times | Fleet intake |
| A gate builds a stock | Vehicles held behind a gate leave as a wave, and the wave is the load that tests the depot | Fleet intake |
| One fleet, several counts | Delivered, integrated, validated, released, accepted and in service are different numbers | Fleet intake |
| Pooling pays on independent load | One pooled team answers faster as the fleet grows at one staffing ratio | Response reserve |
| Correlation defeats pooling | One area-wide event makes many vehicles ask at once, and scale buys nothing on that day | Response reserve |
| A fix has to land in time | What removes the burst at its source helps only if it arrives before the queue has formed | Response reserve |

The page states the thesis in one line above every lab: "Three labs, one question: which capacity meets its load
first as a fleet scales, and how early the fix has to start."

Two findings of the research shaped the design more than any other:

1. **The engines that move single cars cannot show scale.** Fleet day stops at 120 cars. Two labs are therefore count
   models with no map, and say so. The third reruns the Fleet day engine at five sizes and calls itself a cell of at
   most 120 cars, not a city.
2. **A lesson is readable only in one band of its inputs.** With every input free, a prototype of the response queue
   showed its lesson in 15 to 19 percent of the sampled settings. With staffing derived from a sizing rule it showed
   in about 90 percent. So each lab has one governing ratio that the reader sets, derives the other inputs from it,
   and refuses a setup outside the band with a reason.

## 3. The three labs

### 3.1 Density ladder

| Field | Value |
|---|---|
| Lesson link | `#/scale-lab?lesson=density-ladder` |
| Model | The Fleet day engine, through its public function, at 24, 48, 72, 96 and 120 cars in one cell of nine places, at equal requests per car. 8 hours a run, hours 5 to 8 measured |
| Reader sets | The comparison (depot held fixed against grown in step; sites added; one site), street load at the first rung (0.64 to 0.72, default 0.68), depot load at the first rung (0.40 to 0.60, default 0.50) |
| Primary | Completed trips per 100 car-hours in hours 5 to 8, higher is better, margin 3 |
| Guardrails | Prompt pickup fraction (allowance 0.02), unfinished depot visits per 100 cars (5), stored energy per car in kilowatt-hours (2) |
| Controls in every press | A null control that is a replay by fresh engine runs. A non-binding control with the in-step depot doubled |
| Seeds | 10 paired seeds, 31001 to 31010 |
| Default press | Control 54.6, tested 117.2, change +62.6, 95% interval +60.6 to +64.4. Label `scale-spec:b4c7f5da` |
| Compute | 113 engine runs a press, never more than 120. About 1.0 s on a desktop. None before Run |

### 3.2 Fleet intake

| Field | Value |
|---|---|
| Lesson link | `#/scale-lab?lesson=fleet-intake` |
| Model | Weekly counts over 104 weeks. Vehicles pass integration, validation, a release gate and depot intake. Depot places open in tranches, and site power, ports, stalls and staff each have a lead time |
| Reader sets | The other arm (order site power ahead for the middle, or for the end, of its lead range), the site power lead time (24 to 56 weeks, default 48), the ports lead time (16 to 28 weeks, default 24) |
| Governing ratio | The room in weeks between the slowest depot resource and the next gate, over the tranche interval. 6.00 at the default. The lab reads from 2.0 |
| Primary | In-service fraction of plan, higher is better, margin 0.02 |
| Guardrail | Idle weeks per ordered place, allowance 13 |
| Controls in every press | A null control, a non-binding order control, a non-binding deliveries control |
| Seeds | 12 paired seeds, 7001 to 7012 |
| Default press | Control 0.570, other arm 0.754, change +0.185, 95% interval +0.172 to +0.196, idle weeks +5.6 of 13. Label `scale-spec:1aa8c833` |
| The other arm at the default | Ordering for the end of the range gains more and passes the idle allowance, so it is held. Label `scale-spec:a0b5e327` |
| Compute | About 0.1 s a press |

### 3.3 Response reserve

| Field | Value |
|---|---|
| Lesson link | `#/scale-lab?lesson=response-reserve` |
| Model | Counts only. One pooled support team at 2,000, 6,000 and 20,000 vehicles on one staffing rule, with 2, 6 and 20 agents. The event moves a share of the same requests into three hours, so both days hold the same work |
| Reader sets | Event load (1.2 to 1.6 times capacity, default 1.3), the lever (reserve staff join the pool, or a directive removes the ask), the minutes after which the lever lands (15 to 240, default 45) |
| Governing ratio | Event load: the work offered to the pool inside the event over what the pool can answer |
| Primary | Stopped vehicle-minutes per 1,000 vehicles, lower is better, margin 5 percent of the rates-only value (861.558 at the default) |
| Guardrail | Late responder call fraction, allowance 0.05 on the change |
| Controls in every press | A null control with a reserve of zero agents, an ample pool control, a guardrail control |
| Seeds | 12 paired seeds, 3001 to 3012 |
| Default press | No lever 17,737.9, reserve 4,745.8, change -12,992.0, 95% interval -13,394.8 to -12,545.8. Label `scale-spec:443de567` |
| Cross-check | The closed form of a queue with several servers, and the rates-only value of each arm, printed beside the simulated values |
| Compute | About 0.5 s a press |

Every default press reads an improvement. That is a consequence of how each readable band was chosen, and each lab
says so in the section "Set by the inputs, not found by the run", which sits directly under the verdict.

## 4. How it is built

| Part | File | Rule |
|---|---|---|
| Route | `src/ui/routes.js`, `src/ui/studio.js` | Page id `scale`, path `scale-lab`. The header navigation is unchanged at 6 links |
| Generic view | `src/ui/scale-lab.js` | One view for all labs, with no branch that names a lab |
| Registry | `src/ui/scale-labs.js` | The three labs in the order of their story |
| Shared paired contract | `src/model/scale-contract.js` | The only caller of the existing instrument. There is no second verdict engine |
| Labs | `src/model/scale-density.js`, `scale-intake.js`, `scale-response.js` | One frozen `LAB` descriptor each. Page-only. No work at import |
| Chart | `ladderChart` in `src/ui/charts.js` | One builder for fleet rungs and for a week axis, with a table twin |

A lab exports `LAB` with `id`, `version`, `short`, `title`, `geography`, `seeds`, `frame`, `limits`, `unknowns`,
`controls`, `defaults`, `derive`, `steps`, and optionally `map` and `credit`. `derive` is pure and refuses a setup
outside the readable band. `steps` is a generator that yields, so the page stays responsive and a press can be
canceled.

Two rules void a press, so that no verdict can sit beside a broken test:

1. A declared guardrail is missing from any run.
2. A shipped control does not read as declared.

No existing file under `src/core`, `src/model`, `src/instrument`, `src/legacy`, `src/runtime` or `src/data` was
edited. Pages that existed before this release print what they printed before. The test suite holds that with
pinned text of the earlier interface modules.

## 5. Where things are

| Thing | Place |
|---|---|
| Source and tests | `playground/fleetlab/src`, `playground/fleetlab/test` |
| The four Scale test files | `test/scale-lab.test.mjs`, `test/scale-density.test.mjs`, `test/scale-intake.test.mjs`, `test/scale-response.test.mjs` |
| Pinned reference values | `test/scale-density.pins.json`, `test/scale-intake.pins.json`, `test/scale-response.pins.json`, `test/scale-lab.legacy-text.pins.json` |
| Architecture note | `playground/fleetlab/ARCHITECTURE.md`, item 45 |
| Status of record | `HERMES_SOURCE_OF_TRUTH.md`, section 7.5 |
| Publishing steps | `docs/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md` |
| Generated logs and packages | Under `artifacts/` and `dist/`, which git ignores. They are not published |

## 6. How to reproduce

Node 22 or later. No install step and no package file. From the repository root:

```bash
FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 playground/fleetlab/test/*.test.mjs
```

```bash
node --test playground/fleetlab/test/scale-lab.test.mjs playground/fleetlab/test/scale-density.test.mjs playground/fleetlab/test/scale-intake.test.mjs playground/fleetlab/test/scale-response.test.mjs
```

```bash
node playground/fleetlab/tools/pack.mjs --site dist/site
```

```bash
node playground/fleetlab/tools/check-dist.mjs --site dist/site
```

```bash
node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html
```

```bash
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html
```

```bash
python -m http.server 8771 --bind 127.0.0.1 --directory playground/fleetlab
```

Expected: 1,968 tests with 1,967 passing and one existing todo; 92 Scale tests with the flag; a hosted package of
99 files and 3,349,602 bytes; an offline file of 2,408,323 bytes; both package checks OK. The timed tests need an
idle machine. One isolated rerun is the recorded practice when a timing test fails under load. These are the values
of `c08f60d`. At `1aeaace`, whose site inputs the branch head keeps, the suite holds 1,969 tests, and both packages
are 27 bytes larger: 99 files and 3,349,629 bytes hosted, 2,408,350 bytes offline. Two full serial runs at `1aeaace`
each read 1,967 pass, 1 existing todo and 1 timing failure. In the first, while other work loaded the machine, the
response reserve timing test read 9.34 ms against 8 ms. In the second, on an otherwise idle machine, the four-area
runtime test "run_window and run_pair gaps on the reference preset", which this wave did not change, read 11.34 ms
against 8 ms. Each passed its one isolated rerun. A full run at `1aeaace` with zero failures is not recorded.

The Python parity and boundary tests need the project's Python 3.11 environment, with the checkout on `PYTHONPATH`
and `FLEET_PLAYGROUND_BASE=bca4ccd`. They read 89 passed.

## 7. Decisions of the owner, ratified on 2026-09-28

Every row was taken at the lead's recommendation. All were ratified by the owner on 2026-09-28, as recommended,
with the other decisions of the design. None was declined, so no revert follows. Each amendment and each lab is its
own commit, but since `c08f60d` the reverse patch of no earlier commit of the wave applies cleanly. A decision the
owner declines later is undone by revert commits, newest first, with a merge by hand where a patch does not apply
and a rerun of the four Scale test files, then a new deployment or a rollback.

| # | Decision | What was done |
|---|---|---|
| 1 | The package byte line | Target 81,920 and hard stop 92,160 bytes of growth. Measured +89,468: over the target by 7,548 and under the hard stop by 2,692 |
| 2 | Lesson count | 56 to 59. The lesson reserved for the next model becomes lesson 60 |
| 3 | One route and no new header link | The header keeps 6 links. Entry is by the Overview card, the Fleet day link and the catalog |
| 4 | Overview and catalog grids | Two by two, because four cards in three columns leave one alone |
| 5 | Sticky Run bar on phones | On, so that Run is on screen at arrival |
| 6 | A ninth question family, "Scaling the fleet", and two glossary entries | Added |
| 7 | Side-preserving and short numbers | Opt-in, and only the Scale lab opts in. No older page changes |
| 8 | Keyed draws in the response reserve | One keyed draw for each simulated minute, then a local stream that is a pure function of that draw |
| 9 | Trips between depot visits in the density ladder | Held at 2, not the Fleet day default of 3, so that the first rung is level in the measured hours |
| 10 | Fleet intake idle allowance of 13 weeks and default lead time of 48 weeks | Chosen with sight of outcomes, so that the two arms read one advance and one hold. The model notes say so |
| 11 | Map credit on the density ladder | The attribution link and licence name, shown in every state |
| 12 | Deployment scope | One deployment published the teaching frames and the Scale lab together |
| 13 | Push | Done on 2026-09-28 on the owner's word: a fast-forward of `feat/fleetlab-playground` |

## 8. What the independent review found

Seven lenses read the seven build commits. Two verifiers checked each serious finding. 13 findings were confirmed
and none refuted. They came to nine distinct defects, all fixed in `c08f60d`, each behind a test that failed first.
None moved a verdict number. The [release record](FLEETLAB_SCALE_LAB_RELEASE_2026-09-27.md) lists them.

The lesson for whoever continues: **a green suite was not enough.** None of the 1,937 tests of the suite before the
review (1,936 passing, 1 existing todo) caught any of the nine. The fake DOM cannot see layout, so the sideways scroll on a phone and the bars painted over
the lines were invisible to it. A review that runs the real page found them.

## 9. Known open items

| # | Item | Size |
|---|---|---|
| 1 | No person has looked at the pages in a visible browser. No painted frame, no 1440 by 900 px, no throttled phone profile, no physical phone | Process gate |
| 2 | Going back to a lesson address discards the recorded result and the edited setup | Small, in `src/ui/studio.js` |
| 3 | The verdict readout on older pages still prints a long raw number for a tiny value | A site rule held by existing tests. Its change is a wave of its own |
| 4 | A typed governing ratio of more than 12 decimals is echoed whole in the density ladder inputs table | Small |
| 5 | The event load control declares a step of 0.1 and accepts typed steps of 0.01 | Small |
| 6 | Table 1 of the fleet intake can print one row one off from its two parts after rounding | Small |
| 7 | `playground/fleetlab/README.md` held facts and personal wording older than this release | Resolved on 2026-09-28: the README links https://fleetlab.pages.dev/, names the current release and carries no personal framing; the byline stays |
| 8 | The lesson snapshot that the teaching-frame wave kept outside the tree still counts 56 | Declare it again for 59 |
| 9 | One stash entry and one untracked owner note exist in sibling worktrees from before this wave | Untouched |
| 10 | After another Fleet day lesson, the launch lesson link keeps the previous lesson's main heading. The defect is older than this wave and was live until 2026-09-28: it came in with the teaching frames of `c79eccf`. Two sweeps after the deployment found it: the lead's sweep of all 59 lesson links in a real browser on the live site with the pane hidden, and a sweep on the fake DOM with the modules of the live site | Fixed in `1aeaace` behind a new test in `test/studio.test.mjs`; fixed and live since `77922688` (2026-09-28), and pushed |
| 11 | Where 12 decimals still read on a threshold, `sidedText` moves the last decimal one step toward the value's own side, so the printed number is off by less than 1e-12 | Small, in `src/ui/experiment.js` |

## 10. Rules of work for whoever continues

| Rule | Detail |
|---|---|
| Git | Work on `claude/fleetlab-scale-lab` or a branch cut from it. Stage by explicit path. Never push, open a pull request, force, reset hard, clean or rewrite history without the owner's word |
| Publishing | The Pages project uses Direct Upload. A push does not publish. A deployment needs the owner's word each time |
| Protected files | No edit to an existing file under `src/core`, `src/model`, `src/instrument`, `src/legacy`, `src/runtime`, `src/data` unless the wave says so first |
| Bytes | The offline file may not pass 2,621,440 bytes. 77,186 bytes are unassigned at `1aeaace` (77,213 bytes at `c08f60d`) and 135,904 bytes are reserved. Measure after every item |
| Copy | No word of this list on any page: predict, forecast, live, real-time, monitoring, cost, revenue, score, winner. No dash. No operator or personal name. No web address in text. No result number and no direction word before a run. Absence reads "not available: reason" |
| Honesty | Every unsourced input is labelled a teaching assumption. Every lab says what it cannot know. No claim about any real fleet |
| Status | Update `HERMES_SOURCE_OF_TRUTH.md` in place. Add no sibling status file |
| Tests first | A fix lands behind a test that failed for the right reason |

## 11. Candidate next work

Ranked by what a reader would learn, not by size. Take one.

| # | Candidate | Question it answers | Smallest slice | Bytes |
|---|---|---|---|---|
| 1 | Acceptance in a visible browser | Do the three labs read well to a person at desktop and phone size, and how long does a press take on a slow phone? | Open each lab with the pane visible, press Run, record the painted result and the press time at 4 and 6 times slowdown | 0 |
| 2 | An operating view of one simulated period | In-service vehicles against plan, with the shortfall split by cause, read from the same result as the experiment | One page that replays the fleet intake record. It must be called a replay of a simulated period | About 20,000 |
| 3 | Side-preserving numbers on every page | Does any older page print a value as equal to a threshold it has passed? | One change across the verdict card, the chart summaries and the walkthrough chip, with its own pins | About 1,500 |
| 4 | More than one demand draw | Does a verdict of the four-area casebook hold on another rider draw? | The item the teaching-frame record already queued | Small |
| 5 | The curb and staging model | The design exists and its bytes are reserved | As its own design says | Reserved |
| 6 | Withdrawing a road class fleet-wide | How many more cars does each area need to hold its wait allowance? | A new axis form over the four-area routes. It edits protected files | About 25,000 |

Candidate 2 is the largest gap. The site shows simulation in depth and shows tooling hardly at all. On 2026-09-28
the owner chose candidate 1, then candidate 2.

## 12. A prompt to give with this file

> Review the FleetLab Scale lab as a rigorous simulation and product reviewer. Work from the handoff, and open the
> site or the repository only if you can do so in fact. Separate what was shipped, what was measured, what was
> assumed and what was not done.
>
> First assess each lab: does the model teach its mechanism with the smallest machinery that produces it, is the
> governing ratio the quantity that governs, do the controls have the power to expose a broken model, and does the
> page say which results follow from the inputs? Name any sentence a reader could take as a claim about a real fleet.
>
> Then assess the process: nine distinct defects, confirmed as 13 findings, were found after a green suite. Say which
> further classes of defect the present tests still cannot see, and what check would see each.
>
> Then choose one candidate from section 11, or propose a better one. Give the user problem, the smallest useful
> scope, what is left out, the measure and its guardrails, the acceptance criteria, the byte line and the risks. Do
> not combine candidates into a roadmap.
>
> Keep the scope to simulation. Do not infer calibration, real performance, affiliation or permission to change any
> fleet. Do not assume that a backend, an account, a data feed or a new simulator is needed. Do not push or deploy.
>
> End with three sections: Recommendation, Top risks + mitigations, Next 3 actions.

## Recommendation

Keep `77922688` live: it fixes known open item 10 and reads back byte for byte, and its source is public. The owner
ratified the decisions of section 7 on 2026-09-28 and chose the next builds. First, the owner looks at the three labs
in a visible browser before sharing the link. Then the next builder takes candidate 1, because it costs nothing and
nobody has yet seen the pages, and then candidate 2, with its acceptance criteria written first.

## Top risks + mitigations

| Risk | Mitigation |
|---|---|
| The pages were never seen by a person | The owner's look, then candidate 1. The previous Production, `19e17ac6`, is one rollback away |
| A lab is read as a statement about a real fleet | Counts and fictional markets, generic names, the assumption sentence, the limits and unknowns lists |
| The ratified decisions are read as covering other open rows | Section 7 covers only this wave's rows; the open rows of other work stay in the top section of `CODEX_HANDOFF.md` |
| The operating view reads as a tool that watches a real fleet | Every number a field of the recorded result; the page calls itself a replay of a simulated period |
| The next wave spends the reserved bytes | The ledger names 77,213 unassigned bytes at `c08f60d`, 77,186 bytes after `1aeaace`, and 135,904 bytes reserved |

## Next 3 actions

1. The owner opens https://fleetlab.pages.dev/#/scale-lab at desktop and phone size with the pane visible and
   presses Run on each lab.
2. Codex, the next builder, runs candidate 1, acceptance in a visible browser, with its acceptance criteria written
   first.
3. Codex builds candidate 2, an operating view of one simulated period, with its acceptance criteria
   written first and its own byte line.
