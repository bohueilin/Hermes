# FleetLab Scale lab release record

Date: September 27, 2026. Status: built, reviewed, fixed, deployed and read back. Not pushed.

FleetLab is an independent, synthetic teaching simulator. It is not affiliated with any operator, vehicle maker,
regulator or utility. Every result is NOT_EVIDENCE, simulation only, decision authority NONE. Every input of the
three labs is a teaching assumption unless its source row says otherwise.

## Context for an independent reviewer

This release adds one route, `#/scale-lab`, with three labs that teach what changes as a fleet scales. It follows the
[design](plans/2026-09-27-fleetlab-scale-lab-design.md) and the [build record](plans/2026-09-27-fleetlab-scale-lab-plan.md).
The [model notes](FLEETLAB_SCALE_LAB.md) describe each lab.

| Lab | Question | What the model is |
|---|---|---|
| Density ladder | At which fleet size does one depot cell pass its capacity, and does siting matter at equal capacity? | The Fleet day engine at five fleet sizes from 24 to 120 cars, through its public function |
| Fleet intake | Which gate keeps delivered vehicles out of rider service, and when is the slowest depot resource ordered? | A weekly count model with gates, lead times and tranches. No map |
| Response reserve | How does a pooled support team staffed for ordinary days meet one area-wide event? | A count model of one queue at three fleet sizes. No map |

Authority. On September 27, 2026 the owner instructed the lead to finish, deploy, test and validate, and to write a
handoff.
That instruction covers the local commits and this deployment. It does not name a push, so nothing was pushed. Every
design decision was taken at the lead's recommendation and is not ratified by the owner.

## Release identity

| Item | Value |
|---|---|
| Stable address | https://fleetlab.pages.dev/ |
| Immutable address | https://19e17ac6.fleetlab.pages.dev/ |
| Pages project | `fleetlab`, Direct Upload, Production |
| Deployment | `19e17ac6-d617-4789-9260-ca259c53e076` |
| Pages branch label | `feat/fleetlab-playground` |
| Deployed source | `c08f60d8830df877fac2c7321bb47d75a5ae56ad` |
| Source branch | `claude/fleetlab-scale-lab`, local only |
| Branch after the deployment | `1aeaace`, one Fleet day fix past the deployed source (known open item 8). Not deployed. On top of it, the documents commit that holds this record and the other records of the wave. It changes no site input, so its site inputs equal those of `1aeaace` |
| Previous Production, the rollback target | `dd4bfa44-7226-4502-9d66-01bb1790f2b6`, source `b99ab04` |
| Upload tool | Wrangler 4.135.0, as the deployment guide pins it |

**The deployed source is on no remote branch.** A reader who follows the site to the public repository will not find
commit `c08f60d` there until the owner pushes the branch.

## What this release publishes

The branch was cut from `c79eccf`, the head of the teaching-frame wave, which was recorded as local only. So this
deployment publishes every change between the previous Production source `b99ab04` and `c08f60d`.

| Wave | Commits | Public effect |
|---|---|---|
| D1 release record and N2 design documents | `790573e` (the D1 release record, already on the remote), `4ba5626`, `62547a8`, `82df3b5` | None. Documents are not part of the site |
| Offline packer, comment removal | `8e04b49` | None on the hosted site. It changes the offline file only |
| Teaching frames for the 56 lessons | `caaf8f2` and its record commits `0497b9b`, `45efd43`, `c79eccf` | The three-part frame, generated run readings, the catalog filters and the Exact values disclosures are now public |
| Scale lab | `2caeac6` to `c08f60d`, eight commits | The new route, three lessons, the fourth Overview card, one link on Fleet day, the fourth catalog article |

The teaching-frame wave passed its local acceptance checks in its own [release record](FLEETLAB_T1_RELEASE_2026-09-26.md) with two
stated exceptions. Both are now public with it: the walkthrough holds 146 visible words before Prepare against a
target of 130, and the package passed its working target.

## Commits of the Scale lab

| Order | Commit | What it holds |
|---|---|---|
| 1 | `2caeac6` | The shell: route, one generic view, the shared paired contract, the ladder chart, three stub labs, the entry points, the pin edits |
| 2 | `05113ab` | A press is void when a declared guardrail is missing from a run or a shipped control does not read as declared |
| 3 | `953ebce` | Refusals in the absence form, the interval sentence, next tests the page can honour, and side-preserving numbers |
| 4 | `9fdb160` | The labs in the order of their story, the thesis line, and what follows from the inputs placed under the verdict |
| 5 | `27f6014` | The response reserve lab |
| 6 | `1a81ae8` | The fleet intake lab |
| 7 | `319b4a9` | The density ladder lab |
| 8 | `c08f60d` | The fixes of the independent review |

No existing file under `src/core`, `src/model`, `src/instrument`, `src/legacy`, `src/runtime` or `src/data` was
edited. Four new model files were added under `src/model`. They are page-only: none is reachable from the worker.

## Gates on the final tree

Node v22.22.0, one laptop, the machine otherwise idle during the timed suite.

| Gate | Command | Result |
|---|---|---|
| Full serial suite | `FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 playground/fleetlab/test/*.test.mjs` | **1,968 tests, 1,967 pass, 0 fail, 0 cancelled, 0 skipped, 1 existing todo**, 281.9 s |
| Scale tests with the flag | the four `test/scale-*.test.mjs` files | `scale-lab` 34, `scale-response` 20, `scale-intake` 17 and `scale-density` 21 tests pass: 92 of 92 |
| Python parity and boundaries | the two `tests/unit/test_fleet_playground_*.py` files, with `FLEET_PLAYGROUND_BASE=bca4ccd` and the checkout on `PYTHONPATH` | 89 pass |
| Lint | `python -m ruff check .` | All checks passed |
| Whitespace | `git diff --check` | Clean |
| Hosted package | `pack.mjs --site dist/site`, then `check-dist.mjs --site dist/site` | 99 files, 3,349,602 bytes, OK |
| Offline package | `pack.mjs --out dist/fleetlab-playground.html`, then `check-dist.mjs` | 2,408,323 bytes, OK |
| Parity values | Fleet day seed 42 | 95 completed, 176 unserved, 4 waiting, 9 in progress of 284, in the suite and on the hosted site |

The existing todo is the browser-only layout check at 400 px. It is not counted as passed.

## Byte ledger

Archived checkpoints, each measured in the worktree with the repository's packer. The baseline is 2,318,855 bytes.

| After | Offline bytes | Growth |
|---|---:|---:|
| Shell with stub labs, `2caeac6` | 2,357,617 | +38,762 |
| `05113ab` | 2,358,553 | +39,698 |
| `953ebce` | 2,359,746 | +40,891 |
| `9fdb160` | 2,360,022 | +41,167 |
| Response reserve, `27f6014` | 2,376,259 | +57,404 |
| Fleet intake, `1a81ae8` | 2,391,500 | +72,645 |
| Density ladder, `319b4a9` | 2,403,901 | +85,046 |
| Review fixes, `c08f60d` | **2,408,323** | **+89,468** |

| Line | Bytes | Against the final package |
|---|---:|---|
| Package target, set by the lead | 81,920 | Passed by 7,548 |
| Package hard stop, set by the lead | 92,160 | 2,692 left |
| Offline cap, unchanged | 2,621,440 | 213,117 left |
| Reserved for other work | 135,904 | Untouched |
| Unassigned after this release | 77,213 | It was 166,681 before |

The target and the hard stop were the lead's own lines. The owner approved neither. The review fixes cost 4,422
bytes, and the lead weighed them above the target.

## Independent review and its fixes

After the seven build commits an independent review read the change through seven lenses. Two verifiers checked each
serious finding, one by running code and one by reading. **13 findings were confirmed, none was refuted**, and 25
minor findings were listed. Several confirmed findings are one defect seen through different lenses, which leaves
nine distinct defects. None moved a verdict number. Every one was reachable by a visitor, and none of the 1,937
tests of the suite before the review (1,936 passing, 1 existing todo) had caught any of them.

| Defect | Where a visitor met it | Fix in `c08f60d` |
|---|---|---|
| The readout said "lies left of the band" over numbers that were all to the right | Default press of density ladder and fleet intake | A readout that draws no strip names the declared direction only and states the interval as printed |
| The page scrolled sideways after a press, 522 px on a 375 px screen | Response reserve and density ladder on a phone | The readout column may shrink to the screen (`.scale-lab .fl-readout { grid-template-columns: minmax(0, 1fr); }`), so the guardrail table of the readout scrolls inside its own region |
| Filled bars were drawn over both lines | Density ladder chart | Every bar is drawn before every line and point |
| Two of three lines were drawn alike | Fleet intake chart | The three line marks differ by shape: filled points, ring points, square points |
| Depot induction held the whole depot door stock in any week with a place left over | Fleet intake table "The gate that binds" | The stock is split between the induction rate and the resource that holds the next tranche |
| Floating point residue printed as a result, sometimes with the wrong sign | Response reserve note and arms table | A lever that removes nothing returns the no-lever value exactly |
| The caption said rounded rows sum to the total | Fleet intake | The caption says the rows sum before each is rounded |
| No visible map credit or licence | Density ladder | The page credits the road map and its licence in every state |
| Side-preserving numbers reached only some surfaces of existing pages | Four-area verdict card, in edge cases | The rule is opt-in and only the Scale lab opts in |

The last row matters for anyone who reviews existing pages. Commit `953ebce` had changed the four-area verdict card
so that a value near its threshold printed with more decimals. It did not change the chart summaries or the
walkthrough chip, so one value could print two ways. After `c08f60d` **no page that existed before this release
prints different text**. The test `test/scale-lab.test.mjs` holds that against `test/scale-lab.legacy-text.pins.json`: 900
pinned pairs of number text and 19 pinned verdict views, computed once from the two interface modules as they were
at `c79eccf`, before the Scale lab, with the inputs in `test/helpers/legacy-text.mjs`.

Four more changes were made by the lead after the fix pass, each behind a test that failed first:

1. The comparison test first read the repository history and wrote files to the system temporary folder. It now
   reads committed pins and touches neither.
2. The second chart line got ring points, so that no two lines differ by ink alone.
3. The density ladder names its rungs by number, and a chart draws every label when they all fit.
4. The declared change of a directive now reads "every vehicle request moved into the event", which is what the
   model removes. The declared change is part of the frozen test, so the labels, digests and interval ends of the two
   pinned directive setups moved, to `scale-spec:16d331de` and `scale-spec:2f4598cb`, and no mean moved. The default
   press labels did not move, and each lab keeps version 1.0.0.

## Browser evidence

All readings are measured layout or time. **The browser pane was hidden, so no painted frame was seen.** No throttle
was applied and no physical phone was used.

| Check | Size | Reading |
|---|---|---|
| Press to recorded result, three presses each | 1024 by 768 px | Density ladder 966 to 1,034 ms, first chart after 51 to 70 ms. Fleet intake 111 to 115 ms. Response reserve 477 to 491 ms |
| Hosted site, one press each | 1024 by 768 px | 1,044 ms, 102 ms and 513 ms |
| Focus after Run | both | The Result heading |
| Primary buttons | both | One enabled |
| Sideways overflow after a press | 375 by 812 px | None. Scroll width equals client width, 375 px, for all three labs |
| Run at arrival | 375 by 812 px | In the sticky bar, y 721 to 774 px |
| Chart labels | 375 by 812 px | All five rungs of the density ladder and all three of the response reserve are drawn |
| Map credit | both | On the density ladder page, and on no other |
| Refusal | 1024 by 768 px | A typed site power lead time of 26 weeks is refused in 232 characters with a way back, and Run reads as unavailable |
| Nothing runs on arrival | both | "not available: nothing has run yet" before every press |
| Console | both | No error and no warning |
| Entry points | 1024 by 768 px | The fourth Overview card in a two by two grid, the Fleet day link, the fourth catalog article, the Start here link |

One lesson from this release belongs in the record. A timing harness that watched the whole page for changes made
the fixed build look four to eight times slower than the commit before it. A harness that watched only the status
line showed no difference. The first reading was the harness, not the page.

## Sweeps of the lesson links after the deployment

Two sweeps ran on the live site after the upload. Neither painted a frame.

| Sweep | How | Reading |
|---|---|---|
| In a real browser, by the lead | The stable address in the in-app browser (Chromium engine) with the pane hidden. Every lesson link of the catalog (59) and the 9 page routes, opened by changing the address hash, with no reload between them | 0 error pages. 59 lessons by page: Fleet day 18, Street lab 6, Four-area experiments 29, Four-area workspace 3, Scale lab 3. 6 header links. No console error. Exactly one lesson whose main heading did not match its document title: known open item 8 |
| On the fake DOM, by an inventory stage | The modules downloaded from the live site. 10 route visits, 59 lesson visits and 4 deliberately bad links | 0 error pages from a good link, 0 network attempts, 0 engine run calls, 0 storage accesses. The same heading defect |

The lead confirmed the defect on the live site after a reload and from three starting pages, found that a fresh load
is right, and reproduced it on the fake DOM at `c79eccf` and at `c08f60d` with identical results.

## Publication and readback

| Step | Result |
|---|---|
| Shipped inputs against the commit | `git diff --quiet HEAD` over `src`, `styles.css`, `index.html`, `media` and `tools` reported no difference. HEAD was `c08f60d` at the upload |
| Upload | 98 files and `_headers`. 25 were new and 73 were already held by the host |
| Deployment list | Production, source `c08f60d`, as the first row |
| Public files, stable address | **98 of 98 match** the local package by SHA-256 and size |
| Public files, immutable address | 98 of 98 match |
| Response headers | Content security policy with `connect-src 'none'` and `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, same-origin opener policy, `Cache-Control: public, max-age=600`, as `_headers` declares |
| Hosted smoke | Three labs pressed, labels `scale-spec:b4c7f5da`, `scale-spec:1aa8c833` and `scale-spec:443de567`. Fleet day seed 42 read 95 completed, 176 unserved, 4 waiting and 9 in progress of 284 requests. A teaching-frame lesson opened by its link. No console error |

Package identifiers:

- Hosted inventory SHA-256 `5c071dc69e353f6118ab43078c12d2470c9d709cf2ac7c501fe4fb807c669da3`, over rows of path,
  file SHA-256 and size, sorted by path, separated by NUL characters, each ended by a newline.
- Offline file SHA-256 `4828cded63f5c23f99a8d13cc32716f587717f57847dd79bdba59215786800b5`.

The upload tool warned that the working directory held uncommitted changes. Those were the documents of this
release. They are not part of the site, as the first row of the table shows. They are now committed in one
documents commit on top of `1aeaace`, which changes no site input.

Rollback is a separate owner action in the Pages dashboard: open the deployments of project `fleetlab`, choose
`dd4bfa44-7226-4502-9d66-01bb1790f2b6`, roll back, then check the stable address. It rewrites no history.

## What was not done

| Item | State |
|---|---|
| Push to any remote | Not done. Not authorized |
| Pull request or merge to main | Not done |
| A painted frame, 1440 by 900 px, a throttled phone profile, a physical phone | Not measured |
| Screen reader, Safari, Firefox | Not tested |
| A look at the pages by a person with a visible pane | Not done. No painted frame of any page of this release has been seen. The sweep of all 59 lesson links in a real browser is done, but with the pane hidden, section "Sweeps of the lesson links after the deployment" |
| A full serial run at `1aeaace` with zero failures | Not recorded. Two runs each had one timing failure that passed its one isolated rerun, known open item 8 |
| A deployment of `1aeaace` | Not done. It needs the owner's word |
| The broad Python suite of the repository | Not run. Only the two playground files ran |
| A security scan of this range | Not run. The review had one packaging and security lens |
| Owner ratification of any design decision | Not given |
| The lesson snapshot kept outside the tree by the teaching-frame wave | Not declared again for 59 lessons |

## Known open items

1. Going back to a lesson address discards the recorded result and the edited setup. A lesson link means the same on
   Fleet day.
2. A typed governing ratio of more than 12 decimals is echoed whole in the density ladder inputs table.
3. Where 12 decimals still read on a threshold, the printed number moves its last decimal one step to the value's
   own side, so it is off by less than 1e-12.
4. The event load control of the response reserve declares a step of 0.1 and accepts typed steps of 0.01.
5. Table 1 of the fleet intake can print one row one off from its two parts after rounding. Its caption makes no sum
   claim.
6. The verdict readout on other pages still shows a long raw number for a tiny value. That is the rule of the site,
   held by existing tests. Only the Scale lab prints two significant digits.
7. `playground/fleetlab/README.md` carried facts and personal wording older than this release. Resolved on
   2026-09-28: it links the current address, names the current release and no longer carries the personal wording;
   the byline stays.
8. After another Fleet day lesson, the launch lesson link `#/fleet-day?lesson=region-launch` keeps the previous
   lesson's main heading while the document title names the launch lesson. A fresh load is right. The defect is older
   than the Scale lab: `c79eccf` behaves the same way, and D1 (`dd4bfa44`) sets no heading per lesson at all, so it
   came in with the teaching frames and became public with this deployment. Both sweeps after the deployment found
   it. Commit `1aeaace` fixes it on the branch behind a new test in `test/studio.test.mjs` that failed first. Two full
   serial runs with the performance flag at `1aeaace` each read 1,969 tests, 1,967 pass, 1 existing todo and 1 timing
   failure: the response reserve timing test at 9.34 ms against 8 ms while other work loaded the machine (342.8 s),
   then the four-area runtime test "run_window and run_pair gaps on the reference preset", which this wave did not
   change, at 11.34 ms against 8 ms on an otherwise idle machine (292.9 s). Each passed its one isolated rerun. That
   commit is not deployed and not pushed, so the live site still shows the defect.

## Privacy and scope

Staging used explicit paths. `artifacts/`, `dist/` and the design working files were never staged. The staged scan of
each of the eight commits of the wave found no home path, no personal name and no private file name. The staged scan of
the documents commit that holds this record belongs to that commit, and this record holds no result of it. No page names an operator. No telemetry, credential,
network service, dependency, map data or media file was added.

## Recommendation

Keep this release live and review it in a visible browser before sharing the link widely. The design decisions are
assumed, so read the decision table of the design and ratify or decline each one. Decide separately whether to push
the branch, because the deployed source is not yet public. Treat `1aeaace`, the fix of known open item 8, as its own
small release when the owner wants it live.

## Top risks + mitigations

| Risk | Mitigation |
|---|---|
| A lab is read as a statement about a real fleet | Fictional markets as counts, generic names, the assumption sentence on every lab, the limits and unknowns lists, no operator named on any page |
| An assumed rate is read as an estimate | Every input row names its source. The reader sets one governing ratio and the lab derives the rest. Setups outside the readable region are refused |
| The default press of each lab always reads the same verdict | The design says so. The section "Set by the inputs, not found by the run" sits directly under the verdict |
| The visual result was never seen by a person | Every browser reading here is measured. The owner's look at 1440 by 900 px and on a phone is the first action below |
| Deployed source that is not public | The release identity table says so. The push is the owner's action |
| The undeployed fix `1aeaace` is read as live | The release identity table and known open item 8 say it is not deployed. Deploying it needs the owner's word and a full readback |
| Package headroom is finite | 77,213 bytes stay unassigned. The reserved 135,904 bytes are untouched |

## Next 3 actions

1. The owner opens https://fleetlab.pages.dev/#/scale-lab in a visible browser at desktop and phone size, presses Run
   on each lab, and rolls back if anything reads wrong.
2. The owner ratifies or declines the decisions of the design, and says whether to push `claude/fleetlab-scale-lab`.
3. The next wave takes one item: a throttled phone measurement with a visible pane, the site-wide side-preserving
   number rule as its own change, or the next model that the byte reservation already names.
