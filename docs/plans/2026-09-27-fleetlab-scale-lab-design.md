# FleetLab Scale lab: design for owner review

Date: 2026-09-27. Status: design, revised after three reviews, built locally in seven commits, read by an
independent review after the build, fixed in an eighth commit, and deployed. The eight local commits are on branch
`claude/fleetlab-scale-lab`, from `2caeac6` to `c08f60d`. On the owner's instruction of 2026-09-27 the lead deployed
`c08f60d` to the Cloudflare Pages project `fleetlab` as Production deployment
`19e17ac6-d617-4789-9260-ca259c53e076`, at the stable address https://fleetlab.pages.dev/ and the immutable address
https://19e17ac6.fleetlab.pages.dev/. That one deployment published two waves: the teaching frames under `c79eccf`,
which had been local only, and the Scale lab. Nothing is pushed: no remote branch holds `c08f60d`. After the
deployment one more commit, `1aeaace`, landed on the branch: a Fleet day heading fix outside this wave, not
deployed and not pushed [R]. This document and the other records of the wave are in one documents commit on top of
`1aeaace`, which changes no site input. Section 9.4
states the deployment, and the release record, `docs/FLEETLAB_SCALE_LAB_RELEASE_2026-09-27.md`, holds its receipts.
Every measurement in this document was taken on local files, except those tagged [D]. Every decision of section 12
is assumed at the lead's recommendation, not ratified. The owner has ratified no design decision.

FleetLab is an independent, synthetic teaching simulator. It is not affiliated with any operator, vehicle maker,
regulator or utility. Every result is NOT_EVIDENCE, simulation only, decision authority NONE.

Every input of the three labs below is a teaching assumption, with one exception that the page names. Labs A and B
use a fictional market as counts. Lab C runs on nine places of the shipped Fleet day road map, which is frozen public
map geometry of a real region. It takes road distances from that map and nothing else. No lab describes any fleet,
depot, staff group, service, market or past event, in those places or anywhere.

Paths are relative to `playground/fleetlab/` unless they start with `docs/` or `test/`.

Tags: **[M]** measured during design on a working copy kept outside the repository (Node 22.22.0, one laptop).
**[W]** measured by the lead in the integrated worktree at `319b4a9`, before the independent review (Node
22.22.0). **[F]** measured by the lead on the final tree, the working files of `c08f60d` (Node 22.22.0, one
laptop). **[C]** counted or run on the same final files while this document was brought in line with `c08f60d`.
**[D]** read by the lead on the deployed site after the deployment, as the release record gives it.
**[S]** stated by the designer of a lab and held by that lab's pinned test. **[R]** read in source or in a commit
message. **[E]** estimate. **[P]** proposed. Where a checkpoint tagged [M] was measured again in the worktree, the
worktree value stands beside it with the tag [W]. The working copy held 17 source, test and pin files. Each
equalled its committed version at `319b4a9` byte for byte, which was checked while this document was drafted.
Commit `c08f60d` changed 15 files of the tree and added 2, so the working copy no longer equals the tree. A value
tagged [M] or [S] is a value of the design stage. Where the fixes of `c08f60d` moved it, the value of the final
tree stands in its place with the tag [F] or [C]. The committed tests and pins at `c08f60d` are the record a
reader can run. Section 13 says how.

The roles named in this document (the lead, a lab designer, a fact-checker, a reviewer, a verifier) are stages of
one assisted workflow run for one owner. The independent review of section 15 is a stage of that workflow too. No
independent human review has taken place yet.

---

## 0. One page

| Item | State |
|---|---|
| What is added | One route, `#/scale-lab`, that holds three labs behind one generic view: density ladder, fleet intake, response reserve. Three catalog lessons. One Overview card, one catalog article, one link on the Fleet day page |
| Base | Branch `claude/fleetlab-scale-lab`. The design stage started at `c79eccf`. The build is seven local commits on top of it: the shell with three stub labs, `2caeac6`; three amendment commits, `05113ab`, `953ebce` and `9fdb160`; the response reserve lab, `27f6014`; the fleet intake lab, `1a81ae8`; the density ladder lab, `319b4a9`. An eighth local commit, `c08f60d`, holds the fixes of the independent review. Nothing is pushed: no remote branch holds `c08f60d`. The remote branch `feat/fleetlab-playground` is at `790573e`, an ancestor of `c08f60d` and 16 commits behind it, so a push of `c08f60d` to it would be a fast-forward. Nobody has authorized that push [C]. After the deployment one more local commit, `1aeaace`, a Fleet day fix outside this wave, landed on the branch. It is not deployed and not pushed [R]. The documents commit on top of `1aeaace` holds this document and the other records of the wave and is the branch head; it changes no site input |
| Release | Deployed on the owner's instruction of 2026-09-27: Cloudflare Pages project `fleetlab`, Direct Upload with Wrangler 4.135.0, Production deployment `19e17ac6-d617-4789-9260-ca259c53e076`, source `c08f60d`. 98 of 98 public files match the local package by SHA-256 and size on the stable and the immutable address. All three labs pressed on the hosted site and recorded their default labels [D]. The deployment published the teaching frames of `c79eccf` and the Scale lab together. Previous Production and rollback target: `dd4bfa44-7226-4502-9d66-01bb1790f2b6`. Section 9.4, and the receipts in `docs/FLEETLAB_SCALE_LAB_RELEASE_2026-09-27.md` |
| Labs | Three final lab modules are committed with their tests and pins. All three passed together in one tree on the working copy, with the shell test [M]. They pass together on the final tree, inside the full suite [F]. Model versions are 1.0.0 of each lab. This is the first version of each |
| Reviews of the design | Three reviews: feasibility, honesty and privacy, teaching value. 3 blockers, 25 important findings, 33 minor. Section 14 gives the disposition of each |
| Independent review after the build | Seven lenses read the seven build commits. Two verifiers checked each critical or important finding, one by running code and one by reading. 13 findings were confirmed by both, none was refuted, and 25 minor findings were listed. The 13 are 9 distinct defects. None moved a verdict number. All 9 are fixed in `c08f60d`. Section 15 |
| Package growth | **+89,468 bytes** on a baseline of 2,318,855 bytes: offline package 2,408,323 bytes, package check OK [F]. The package as built at `319b4a9` measured +85,046 bytes [W]. The fixes of the independent review add 4,422 bytes. Target 81,920 bytes: passed by 7,548 bytes. Hard stop 92,160 bytes: 2,692 bytes left. Decision 3, assumed at the lead's recommendation, not ratified |
| Tests run on the working copy, design stage | Shell test 22 of 22. Lab tests 11, 14 and 14 of their own. All 61 passed with the performance flag. 37 existing test files, 27 of which reach a changed file: 773 tests, 771 pass, 1 skipped by flag, 1 existing todo, 0 fail. The existing performance gates with the flag: 9 of 9. Package checks: 0 problems [M] |
| Gates run on the final tree, `c08f60d` | The full serial Node suite with the performance flag: 1,968 tests, 1,967 pass, 0 fail, 0 cancelled, 0 skipped, 1 existing todo, in 281.9 s. The four Scale test files with the flag: 34, 20, 17 and 21 tests, 92 together, all pass. Python parity and boundary tests: 89 pass in 5.12 s. `ruff check`: all checks passed. `git diff --check`: clean. Offline package 2,408,323 bytes, package check OK. Hosted site 99 files, 3,349,602 bytes, package check OK [F] |
| Browser acceptance on the native modules, after the fixes | The pane was hidden, so no painted frame was seen. Every reading is measured layout or time. No throttle. Pane of 1024 by 768 px, press to recorded result, three presses each: density ladder 966 to 1,034 ms with the first chart after 51 to 70 ms; fleet intake 111 to 115 ms; response reserve 477 to 491 ms. Focus lands on the Result heading. One enabled primary button. No console error. At 375 by 812 px after the default press of each lab the page is 375 px wide and does not scroll sideways, and Run sits at y 721 to 774 px in the sticky bar at arrival [F]. On the hosted site, one press each: density ladder 1,044 ms, fleet intake 102 ms, response reserve 513 ms, no console error [D] |
| No result recorded | The staged checks and the staged privacy scan of the documents commit, which is made; this document is part of that commit and holds no result of them. The tab order |
| Not measured or not run | A pane of 1440 by 900 px, a painted frame, a look by a person with a visible pane, a throttled phone profile, a physical phone, a screen reader, Safari or Firefox. A security scan of the range, the broad Python suite of the repository, and a full serial run at `1aeaace` with zero failures. The lesson links were swept in a real browser after the deployment, with the pane hidden, section 9.4 [D] |
| Found in integration and in the reviews of the design | A missing guardrail still gave a recommendation to advance. A shipped control that failed did not void the press in two labs. Lab B named a governing ratio that did not govern. Lab C said that nothing on it was real. Sections 7.6 and 14 |
| Found by the independent review | A readout that named the wrong side of a strip the page does not draw. A page that scrolled sideways on a phone after a press. Bars drawn over lines. Two lines drawn alike. One table row overstated about six times. Floating point residue printed as a result. A caption that claimed a sum the printed numbers did not make. Road distances with no visible map credit. One value printed two ways on pages that existed before this wave. Section 15 |
| Known open items | Eight, stated in section 15.6 |
| Decisions for the owner | 25, in section 12. The build proceeded to local commits on the lead's recommendations. Every decision is assumed at the lead's recommendation, not ratified. The deployment followed the owner's instruction of 2026-09-27. The push waits for the owner's word |

---

## 1. Purpose and thesis

### 1.1 Purpose

FleetLab teaches fleet operations with three shipped models: Fleet day (agent level, at most 120 cars), Street lab,
and the four-area paired instrument. None of them shows what changes when a fleet grows by a factor of five to ten.
The Scale lab adds that, as mechanisms a reader can run in a browser, each ending in a paired test with guardrails
and a record that says what it is not.

### 1.2 Thesis: mechanisms, not news

Scaling a commercial robotaxi fleet is hard because the things that grow do not grow in the same way or on the same
clock. The page says it as one question, above the heading of every lab:

> Three labs, one question: which capacity meets its load first as a fleet scales, and how early the fix has to start.

| Mechanism | Plain statement | Lab |
|---|---|---|
| Density with diminishing returns | More cars in one area shorten pickups, and most of the gain arrives early | C |
| The limit moves from street to depot | With the depot fixed, car time moves from pickup driving to depot queues | C |
| Lead-time mismatch | Vehicles arrive in weeks. Site power, ports, stalls and staff arrive in lumps after months | B |
| A release gate builds a stock | Vehicles held at a gate leave as a wave when it opens | B |
| The binding gate moves | Relieving the slowest gate sends the wait to the next one | B |
| One fleet has several counts | Delivered, validated, released, accepted and in rider service are different populations | B |
| Pooling dividend | For independent requests a larger shared pool waits less at the same busy share | A |
| Correlated bursts defeat pooling | One event makes many vehicles ask for the same scarce thing in the same hours. The backlog per vehicle then does not shrink with fleet size | A |
| Nonlinear delay near saturation | Two mechanisms, both nonlinear. On an ordinary day the wait rises steeply as the busy share nears 1. In the event the backlog is zero under capacity and grows with the square of the overload, so the first added unit of capacity removes far more than the last | A |
| Removal at source counts only in time | A directive that removes the batch helps only while the batch is still waiting | A |

The labs teach these shapes. They do not report events, estimate any operator's numbers, or say what any fleet
should do. Each lab says what a synthetic model cannot know. That list sits in a closed disclosure at the foot of
the page, under the heading "What this model cannot know".

### 1.3 One story, three clocks

The labs appear in the order of the story. Each is one clock of the same question, and each points to another in
its list of unknowns.

| Order | Lab | Clock | Load over capacity | Hands over to |
|---|---|---|---|---|
| 1 | Density ladder | Hours | Depot work over depot capacity. Street time over car time | Fleet intake: when the capacity that relieves a depot arrives |
| 2 | Fleet intake | Weeks to months | Vehicles at the depot door over places ready | Density ladder: what a depot past its capacity does inside one day |
| 3 | Response reserve | One day | Event work over what the pool can answer | Both: how vehicles reach rider service and what a depot can take |

The three fleets are not on one scale (120 cars, 624 vehicles, 6,000 vehicles). No number of one lab is set beside a
number of another. The link is made in words.

### 1.4 What the first press is

In every lab the first press is a demonstration. Its reading cannot change anywhere in the readable region,
because the region was chosen so that the mechanism shows. The page says so under the verdict, in the list "Set by
the inputs, not found by the run". Each lab then gives the reader one place where the reading does move.

| Lab | Default press [M] | Why it is set by the inputs | Where the reader sees the reading move |
|---|---|---|---|
| A | Improved at 152 of 160 settings of the page grid | The reserve is sized to bring event load to capacity. A directive removes the ask at its source | Table "Landing in time": both levers at five landing times, each beside its rates-only value |
| B | First arm improved and advanced at 351 of 351 accepted setups | The gain is the room times the vehicles that were waiting | Table "Lead-time mismatch": five order weeks with their gain and idle weeks. The second arm is held at 183 of 351 |
| C | Capacity improved at 25 of 25 settings | The control depot stands at about 2.4 times its capacity by hand | The column "Depot load by hand, control" beside trips per car, and the two siting comparisons, whose readings the inputs do not give |

---

## 2. Public evidence base

These facts set orders of magnitude and anchor two public definitions. They appear in repository documents only,
never on the page (D6). "The operator" means the operator with the largest public record. It is not named on any
FleetLab page or in this document. A source is named by its publisher and its date.

How the rows were checked. Each source was opened by the fact-check stage of the research on 2026-09-26. That
stage ran after the search budget of the research was spent: it opened the cited sources and could not search for
newer or contradicting items. Every source was then found by search and opened again on 2026-09-27, before this
document was written for publication. The second pass read the text of each page and each filing. It did not read
a chart or an image, and it did not search for newer or contradicting figures. "No newer figure was found" is
therefore weaker than it sounds. The last column says what the second pass found. 17 of the 18 rows were
confirmed on an opened page or filing of the source itself. Row 16c was confirmed in bibliographic records,
because the publisher's page refused the request.

| # | Statement, in the wording to use | Source | Date of source | Reopened on 2026-09-27 |
|---|---|---|---|---|
| 1 | Paid rides per week: 50,000 (May 2024), more than 250,000 (stated on 2025-05-05, no month given), 500,000 (late March 2026), and still "averaging 500,000" on 2026-09-24 | TechCrunch ridership chart; operator blog on manufacturing; TechCrunch on fleet data | 2026-03-27; 2025-05-05; 2026-09-24 | Confirmed, with one fix. The draft dated the 250,000 figure to April 2025. The text of the ridership article holds no 250,000 figure, and its chart image was not read. The operator blog says more than 250,000 and names no month, so the month is withdrawn |
| 2 | Roughly 4,000 robotaxis in 15 US cities, about 80 percent of the fleet in California and Texas | TechCrunch on fleet data | 2026-09-24 | Confirmed |
| 3 | Texas registered vehicles rose 49 percent in three weeks to 1,102. These are registrations, not vehicles in service | TechCrunch on fleet data | 2026-09-24 | Confirmed. The article counts vehicles registered in the state. The caution about vehicles in service is this document's own |
| 4 | About 70 remote assistance agents on duty worldwide at any one time, at four sites, for a fleet of over 3,000 vehicles (operator statement) | Operator letter to a US senator on remote assistance | 2026-02-17 | Confirmed |
| 5 | All seven companies asked by a Senate office refused to disclose how often their remote operators intervene | Senate office remote assistance investigation report | 2026-03-31 | Confirmed, wording fixed. The draft said declined. The report says refused |
| 6 | On 2025-12-20 in San Francisco: 829 vehicles operating in the outage area; 1,593 stops of two minutes or more; over 96 percent resolved without manual retrieval. These are the operator's figures as two filings repeat them | City transport agency reply comments and taxi workers' alliance reply comments, CPUC R.25-08-013 | 2026-02-13 | Confirmed. Both filings carry that date. The alliance filing counts stops of two minutes or more and says over 96 percent. The city filing counts stops of more than two minutes and says 96 percent |
| 7 | The city asked that emergency-plan requirements scale with fleet size and service footprint because systemic risk increases with vehicle volume | City transport agency reply comments, CPUC R.25-08-013 | 2026-02-13 | Confirmed |
| 8 | California rules made final on 2026-04-28 require a dedicated emergency line on which calls are picked up within 30 seconds, starting 2026-07-01, and fleets to leave an identified area within two minutes of an emergency geofencing directive | California DMV release on new regulations; California Assembly Transportation Committee background paper | 2026-04-28; 2026-06-08 | Confirmed, wording fixed. The draft said published and gave no start date. The committee paper gives the emergency line and its start date. The release gives the two minutes |
| 9 | The state utility regulator requires stoppage reporting at 30-second and two-minute thresholds with staff dispatch and arrival times | CPUC Decision 24-11-002 | 2024-11-07 | Confirmed. The decision carries that date and was issued on 2024-11-12 |
| 10 | The state regulator's energization targets: an average target of 182 calendar days for each of four kinds of request; maximum timelines of 684, 1,021 and 3,242 calendar days for a new or upgraded circuit, a substation upgrade and a new substation, for the three large utilities, as timelines to plan for and begin execution | CPUC energization fact sheet, D.24-09-020 | 2024-09-12 | Confirmed, wording made exact. The fact sheet names the approval date and the proceeding, R.24-01-018. The decision number was confirmed on a page of the regulator |
| 11 | A depot developer's executive said that siting, permitting, construction and energization often take 18 to 36 months (vendor statement) | The Driverless Digest, urban autonomy summit highlights | 2026-02-04 | Confirmed |
| 12 | Power transformer lead time 128 weeks and switchgear 44 weeks, as averages of a survey of the second quarter of 2025 | POWER magazine on transformers | 2026-01-02 | Confirmed |
| 13 | One state authorized up to 1,000 vehicles for the operator in the first 12 months, with operations to begin within 120 days of permit issuance | Nevada Transportation Authority release | 2026-08-21 | Confirmed. The authority met on 2026-08-20 |
| 14 | California, August 2023 to December 2025: 13,790,147 trips, 86,269,177 vehicle miles, about 53.6 percent of miles with a passenger; empty miles per trip fell from about 5.1 to about 2.8 (one researcher's analysis of regulator filings) | Findings, article 161870, DOI 10.32866/001c.161870. The title of the article names the operator and is not given here | 2026-05-19 | Confirmed |
| 15 | California empty share of miles fell from 51.5 percent (January 2024) to 44.3 percent (September 2025); about two thirds of empty miles are in the unassigned period | The Driverless Digest on regulator data | 2025-11-19 | Confirmed |
| 16a | With batch arrivals, safety staffing is square-root in the arrival rate of batches and linear in the batch size | "How to Staff When Customers Arrive in Batches", preprint arXiv 1907.12650 | first circulated 2019-07-30, fourth version 2023-05-29 | Confirmed in the text of the fourth version. The listing shows no journal reference |
| 16b | Square-root staffing for independent arrivals. Worked queueing numbers in this design are stated as mathematics | "Economies-of-scale in resource sharing systems: tutorial and partial review of the QED heavy-traffic regime", preprint arXiv 1706.05397 | first version 2017-06-16, revised 2019-07-28 | Confirmed. The title is that of the listing. The first page of the revised version words it differently |
| 16c | Spatial capacity needs safety capacity in proportion to load to the power two thirds. The abstract only was read | "Spatial Capacity Planning", Operations Research 70(2), pages 1271 to 1291 | 2022 | Confirmed in two bibliographic records, one of which prints the abstract. The publisher's own page was not reopened on 2026-09-27: it refused the request. Online first on 2021-05-17, in print in March 2022 |

Rules for use.

1. Give the source and the date with every statement. Attribute operator statements to the operator. Rows 16a to
   16c carry the identifiers that the research recorded and their full titles, which were confirmed when the
   sources were opened again on 2026-09-27. Papers are cited by title, venue and year, without author names, while
   decision 22 is open. Decision 22 is not ratified. Row 14 gives the journal, the article number and the
   identifier, because the title of that article names the operator.
2. No fleet size or count of a lab is set to a current public count. Lab B has a test that holds its default page
   away from a list of public counts [S]. Lab A's first rung, 2,000 vehicles, is a round rung of a ladder of 1, 3
   and 10 and coincides with an older public count. It carries no meaning, and the levers act at 6,000.
3. Two inputs are set to a public value, and they are the only ones. Rows 8 and 9 anchor two definitions that Lab
   A uses as teaching assumptions: a responder call is late after 30 seconds, and a long stop is 120 seconds or
   more. The 30 seconds come from an answer requirement and the 120 seconds from a reporting threshold, which are
   two different rules. The page calls both a teaching assumption and names no rule. No reading of the lab says
   that a fleet meets or misses a rule.
4. The research for this design found no public source that explains a gap between delivered vehicles and vehicles
   in service. Lab B says under "What this model cannot know" that it cannot say whether such a gap exists in any
   operating fleet, or why.
5. Rows 2 and 3 move fast. Every source was opened again on 2026-09-27, the day this document was written for
   publication. Every row is true of its date only, and a later reader opens the sources again.
6. Rows 4 and 6 stand two lines apart and are never joined. No public source gives the staffing of that day. No
   ratio is formed from them, and no lab input is derived from either.

---

## 3. Package decisions D1 to D11

These were taken by the lead before the lab designs. The design stays inside them. The owner has ratified none of
them. Wherever this document names one of D1 to D11, it is assumed at the lead's recommendation, not ratified. Two
need a word from the owner: D4, because the fixes of the reviews pass the target, and D8, which Lab A meets by a
declared reading. They are decisions 3 and 4 of section 12, each assumed at the lead's recommendation, not
ratified.

| Id | Decision | How the design meets it |
|---|---|---|
| D1 | One new route, path `scale-lab`, reachable by a bare link. Entry points: a fourth Overview card, a catalog entry, one ordinary link near the top of Fleet day. Header navigation stays at 6 links | Landed in `2caeac6`. The shell test asserts 6 header links, the three entry points and five refused link forms [R] |
| D2 | Three labs, one visible at a time: `response-reserve`, `fleet-intake`, `density-ladder` | One registry, one chooser, one generic view. Lab C calls `simulateBayAreaOperations(config, {capture: false})` and edits no engine file |
| D3 | No edit to an existing file under `src/core`, `src/model`, `src/instrument`, `src/legacy`, `src/runtime`, `src/data`. New page-only files under `src/model` are allowed | Four new files under `src/model`. None is reachable from `src/runtime/worker.js`, which a test asserts. `test/boundaries.test.mjs` passes 19 of 19 [M] |
| D4 | Target 81,920 bytes of growth, hard stop 92,160 bytes. Lab C is cut first if the package cannot fit | +89,468 bytes on the final tree [F]. All three labs fit under the hard stop with 2,692 bytes left. The target is passed by 7,548 bytes. The fixes of the three design reviews add 4,149 bytes [M] and the fixes of the independent review add 4,422 bytes [F], together 8,571 bytes, which is more than the target is passed by. Section 8 and decision 3, assumed at the lead's recommendation, not ratified |
| D5 | Copy rules bind all shipped text | The shell test scans every lab before and after a run. The package check scans every literal of every new module. 0 problems. 13 page dumps scanned line by line: 0 hits [M]. On the final tree both package checks read OK [F] |
| D6 | Provenance on every result. Every unsourced input labelled as a teaching assumption. Sources in repository documents only | The provenance line is the first line of every result. Every input row carries one of five source prefixes. The fifth, "Fleet day map", marks the one input that is not an assumption. The page text holds no address. Since `c08f60d` the density ladder page carries one link element, the map credit, with the same attribution address that the Fleet day figure and the Street lab figure carry [R]. No source of section 2 is on any page |
| D7 | Decisions use the existing paired instrument. No second verdict engine | `src/model/scale-contract.js` is the only caller of `pairedMetricSteps`. No lab calls the instrument |
| D8 | Keyed draws from `src/core/keyed.js`. No clock, no `Math.random`, no page globals in `src/model` | Labs B and C draw only keyed values. Lab A takes one keyed draw per simulated minute and expands it with a local stream that is a pure function of that draw. Section 4.3 gives the measured cost of both keyed alternatives and the precedent in the shipped engines. Decision 4, assumed at the lead's recommendation, not ratified |
| D9 | Main thread with cooperative yields. First result painted within about 1 second on a desktop. At most 120 engine runs per press for Lab C, 8-hour runs, `capture: false` | In Node: first partial chart after 34 ms (A) and 30 ms (C); whole press 459 ms (A), 71 ms (B), 1,153 ms (C); Lab C uses 113, 103 or 113 engine runs [M]. Before the revision the labs measured a desktop browser pane: first chart in the document after 42 to 69 ms (A) and 31 to 66 ms (C) [S]. The pane was hidden, so no painted frame was inspected. In the browser on the final tree, on a pane of 1024 by 768 px with no throttle and the pane hidden, press to recorded result over three presses each: 477 to 491 ms (A), 111 to 115 ms (B), 966 to 1,034 ms (C) with the first chart after 51 to 70 ms [F]. The design expected every Node figure to be a lower bound for a browser [E]. The browser readings are above the Node figures for Labs A and B and under the Node figure for Lab C, so a Node figure is a guide and not a bound. No painted frame, no physical phone and no throttle were measured |
| D10 | No setup sharing through links. Nothing runs on load or navigation | No model is registered in the setup codec, so a setup link is refused. A test counts zero engine calls while the view mounts and while controls change [S] |
| D11 | Operating points are derived, not exposed | Each lab has three controls, names its governing ratio in the inputs table, derives the rest by a sizing rule, refuses setups outside its readable region, and prints which results follow from the inputs. In every lab the quantity named as the governing ratio is the quantity that the refusal tests |

---

## 4. Lab A: response reserve under a correlated event

Id `response-reserve`. Version `scale-response-1.0.0`. Title "Response reserve for an area-wide event".
One file, `src/model/scale-response.js`.

### 4.1 Decision question

One area-wide event makes many vehicles ask for help in the same hours. What does a reserve sized by rule, or a
directive, do to stopped vehicle-minutes at one fleet size, and how late can it land?

The ladder by fleet size is read beside that question. It is not decided by the press: fleet size is a condition,
and a condition is never an arm.

### 4.2 Laws and where the reader sees them [M]

| Law | Where | Reading at the default, shipped seeds |
|---|---|---|
| Pooling dividend on independent load | Table "Pooling and a correlated event" | Ordinary wait 20.22, 4.11 and 0.23 s with 2, 6 and 20 agents, each busy 65 percent. Queue formula: 21.95, 3.73, 0.21 |
| A correlated burst defeats pooling | The chart and the same table | Event day 18,908, 17,738 and 17,032 stopped vehicle-minutes per 1,000 vehicles at one staffing ratio. Rates only: 17,231 at every size. The reserve by rule is 1, 2 and 6 agents, so it scales with the fleet and not with its root. The lean pool (2, 5, 14 agents) is busy 0.65, 0.78 and 0.93 of an ordinary day and reads 18,908, 43,418 and 100,820 on the event day |
| Delay is nonlinear near saturation | Table "Capacity near saturation" | Reserve of 0 to 6 agents: 17,738; 9,441; 4,746; 2,546; 2,112; 1,937; 1,845 |
| Removal at source counts only in time | Table "Landing in time", the verdict, the landing note | Landing after 15, 60, 120, 180 and 240 min. Reserve: 2,141; 6,184; 11,071; 14,624; 16,828. Directive: 953; 2,119; 5,797; 11,989; 17,693. No lever: 17,738 |

No page sentence states an order of the three 12-seed ladder means, because seed sets move a mean at the smallest
fleet from 17,618 to 19,577 [S]. The page says the flat ladder follows from the inputs. The chart draws the ladder
and its rates-only line alone. The lean pool is in the table, because on one axis it flattened the ladder.

Since `c08f60d` the chart names its categories by short numbers, "2,000", "6,000" and "20,000", under the head
"Fleet size, vehicles". The summary of the chart names the unit and the fleet size of every number. A chart drawn
while the press computes carries a sentence of its own, which says at how many of the 3 fleet sizes the event day
has run [R].

### 4.3 Model in brief

- A count-based, event-driven queue in continuous time. Vehicles are counts. One day is 86,400 s and runs until
  every request of the day is answered or released.
- One request tape per seed and fleet size. It never depends on staffing, event load or a lever, so both arms of a
  pair answer the same requests with the same answer times.
- The event changes timing only. A derived share of the same requests is moved into one 180-minute event that
  starts at minute 480. Count, classes and answer times stay equal, and an invariant checks it.
- Two request classes. Vehicle requests stop their vehicle until answered or released. Responder calls are 1
  percent of the tape, are made to the same pool by a first responder, are answered first, and are late when the
  answer starts more than 30 s after the call.
- A directive removes vehicle requests only. Responder calls that were moved into the event stay in the pool and
  are answered. Since `c08f60d` the row "Requests" of the inputs table and the declared change both say so.
- Minutes to clear after the event read 0 for a day on which nothing waits at the instant the event ends. A lever
  that removes nothing returns the no-lever value itself by rates only, so its change is an exact 0.
- Draws. One keyed draw per simulated minute seeds a local stream, and a day replays exactly, which a test pins.

The measured reason for the draws [M]. One ladder holds 3,144,960 random numbers.

| Way to draw | Microseconds per draw | One ladder |
|---|---:|---:|
| One keyed draw per random number, `u32` | 0.81 to 0.83 | about 2.6 s |
| The cached prefix hasher already in `src/core/keyed.js`, `keyedU64Source` | 0.33 to 0.35 | about 1.1 s |
| The same, using both halves of each 64-bit value | not measured | about 0.6 s [E] |
| One keyed draw per simulated minute, then a local stream, as designed | | 64 to 70 ms [S] |

The shipped engines already draw from a local stream seeded by the declared seed (`bay-operations.js`, line 51;
`street-simulation.js`, line 14) [R]. Lab C inherits that through the engine. The reading of D8 for Lab A is the
site's practice, not a new departure.

### 4.4 Governing ratio and derived operating point

| Item | Rule | Default |
|---|---|---|
| Governing ratio: event load | Work offered to the pool inside the event over what the pool can answer. The reader chooses it | 1.30 |
| Second ratio: burst depth | Rates-only backlog at the smallest fleet over the chance spread of its event requests. Refused under 4 | 7.1 |
| Staffing rule | 1 agent per 1,000 vehicles, busy 65 percent of an ordinary day, mean answer 30 s | 2, 6, 20 agents |
| Requests reaching the pool | Agents times busy share over answer time | 78 per 1,000 vehicle-hours |
| Share of requests moved | Follows from event load, busy share and event length | 14.3 percent |
| Reserve staff | The smallest reserve that brings event load to capacity at 6,000 vehicles | 2 agents |
| Lean pool | The smallest pool whose ordinary wait by the queue formula does not pass the wait at the smallest fleet | 2, 5, 14 agents |
| Margin | 5 percent of the rates-only value of the day the comparison starts from | 861.558 stopped vehicle-minutes per 1,000 vehicles |

Controls: event load; lever (reserve staff or a directive); minutes until the lever lands (15 to 240). The control
for event load runs from 1.2 to 1.6 and declares a step of 0.1. The readable region is set by the burst depth: a
typed load is read from a depth of 4, which is near 1.17, to 1.6, and the refusal says so. Since `c08f60d` a typed
load is read on steps of 0.01, so that the load shown is the load used: 1.17 and 1.35 run, and 1.334 is refused
with the reason "event load takes steps of 0.01, so that the load shown is the load used" [C]. The control still
declares a step of 0.1 while typed steps of 0.01 are accepted, which is an open item of section 15.6. No refusal
can be reached from the three controls inside their ranges: 160 of 160 grid settings run [M], and 160 again on the
final tree [C].

### 4.5 Arms, metrics, guardrails, controls

| Item | Content |
|---|---|
| Main comparison | The no-lever event day at 6,000 vehicles against the chosen lever landing after the chosen delay |
| Primary | `stopped vehicle-minutes per 1,000 vehicles`, lower is better, margin 5 percent of the rates-only value |
| Guardrail | `late responder call fraction`, lower is better, allowance 0.05 on the change against the no-lever day |
| Null control | A reserve of zero agents through the lever's own code path. Declared reading: every paired difference exactly 0 |
| Ample pool control | Reserve staff on a burst at 0.8 of capacity at 20,000 vehicles, margin 5 percent of its own ordinary-day value (46.663). Declared reading: within its margin |
| Guardrail control | One shared line, where responder calls wait in turn. Declared reading: within the margin on the primary and held by the guardrail |
| What is never an arm | The event against an ordinary day. A condition is a table column, so no recommendation is printed on something that is not a lever |
| A control that does not read as declared | Voids the press. Section 7.3, ruling 7 |

Default record [M], with every value of the primary in stopped vehicle-minutes per 1,000 vehicles: improved, mean
change -12,992.0, 95 percent interval -13,394.8 to -12,545.8, margin 861.558, every guardrail within its allowance.
Null control 0. Ample pool -5.8 against a margin of 46.663. Shared line -150.8 on the primary and a guardrail harm of
0.324 against an allowance of 0.05, both as a change in the late responder call fraction, so it is held. No verdict
number moved in the revision: labels, digests, means and intervals equal those of the reviewed design [M].

What `c08f60d` moved [R]. The label of the default press did not move: `scale-spec:443de567`. The declared change
of a directive now reads "A directive removes the ask of every vehicle request moved into the event, from 180 min
after the event starts.", with the chosen delay in the place of 180. The declared change is part of the frozen
test, so the label and the digest of every directive setup moved, and the interval is drawn again under the new
digest. Two directive setups are pinned. No mean of either moved.

| Pinned directive setup | Label before | Label at `c08f60d` | Mean change | 95 percent interval before | 95 percent interval at `c08f60d` |
|---|---|---|---:|---|---|
| Event load 1.3, directive after 180 min | `scale-spec:42aa34d4` | `scale-spec:16d331de` | -5,748.9 | -6,198.5 to -5,266.7 | -6,185.9 to -5,266.5 |
| Event load 1.2, directive after 240 min | `scale-spec:6905c5e1` | `scale-spec:2f4598cb` | 0 | 0 to 0 | 0 to 0 |

Every value of the table is in stopped vehicle-minutes per 1,000 vehicles. Both outcomes stand as they were:
improved for the first setup and within the margin for the second.

### 4.6 What follows from the inputs, and the analytic checks

The first note of every press gives the rates-only value of the tested arm and of the change, and names the fleet
size and the unit of both. At the default, in stopped vehicle-minutes per 1,000 vehicles: 4,676 and -12,555 by
rates only, against 4,746 and -12,992 simulated [M]. Since `c08f60d` the note says that the direction of the main
result follows from the inputs only on a press that read improved. On any other press it reads "The main result
reads no reduction past the margin, so no direction is said to follow from the inputs" [R]. The default note
begins "By rates only at 6,000 vehicles, in stopped vehicle-minutes per 1,000 vehicles, the tested arm reads 4,676
and the change -12,555." [C].

| Result | Follows from the inputs | The page says so | What the run adds |
|---|---|---|---|
| Ordinary wait 20.2, 4.1, 0.23 s | Yes. Queue formula at one busy share | Cross-check rows 1 to 3 | Chance at small pools |
| Flat event-day ladder | Yes. Equal event share and staffing ratio | Note 4 and the rates-only line | The chance part |
| Reserve by rule 1, 2, 6 | Yes. Sizing rule | Its own column | Nothing |
| Main change, direction and most of its size | Yes, on a press that reads improved | Note 1, with both rates-only values | The interval, the ordinary wait and the guardrail |
| Both levers by landing time | Yes, within the ratios below | The rates-only columns of "Landing in time" | Chance |
| A late directive reads little or nothing | Yes. Span times load | The landing note | Whether a few requests are still waiting |
| The shared line is held | Yes, from the share of responder calls | Note 8 | The size of the harm |

Rates only against simulated, over the whole page grid [M]. The rates-only value is a closed form: the backlog runs
through segments of constant net load, and a directive releases the waiting requests that were moved into the
event and removes the later ones.

| Measure over 160 settings | Result |
|---|---|
| A lever adds stopped minutes, by rates only or simulated | never |
| Settings whose simulated change passes the margin | 154 |
| Rates-only change over simulated change at those settings | 0.74 to 1.00 |
| Rates-only value of the tested arm over simulated | 0.75 to 1.00. It is lowest where a lever lands early and what is left is chance and the ordinary wait |

The cross-check table has six rows, each with its tolerance printed as a percent: mean wait on an ordinary day at
each fleet size and the share of long stops (queue formula), most vehicles waiting and minutes to clear (rates
only). Calibration over 20 seed sets and 5 event loads [S]. The row on agent busy share was cut: it restated the
staffing input, and the first four rows catch the same fault. A request rate 10 percent high puts all six rows
outside their tolerance [M]. The caption says the table checks the arithmetic, not any fleet.

### 4.7 Measured robustness

| Study | Result |
|---|---|
| Every setting of the page grid, 160 presses, shipped seeds, through the control rule of the shell [M] | 160 run, 0 refused, 0 invalid, 0 voided. Reserve: 77 improved, 2 within the margin, 1 not decided. Directive: 75, 3 and 2. Every control read as declared at 160 of 160. Every cross-check row inside its tolerance. Both columns of "Landing in time" never fall with a later landing |
| The same grid on design and held-out seeds [S] | Every law rule and every control rule 160 of 160 in all three sets |
| One rule on late directives [S] | 3 of 4 and 2 of 4. The rule asked for an exact zero and chance left a few requests waiting. It is reported as failed, and the note says "little or nothing left to remove" |
| Eight deliberate faults [M] | Each is caught by the flag named for it. The null control, the ample pool control, the guardrail control and the answer-order invariant are each the only thing that catches one fault |
| Detection limit [S] | A lever side effect under 5 percent of the ordinary-day value is not flagged. The page says so |
| Interval coverage, 200 disjoint sets of 12 seeds [S] | 90.0 to 93.5 percent against a label of 95 percent. The page calls the label nominal |

Compute [M]: 459 ms per press in Node, first partial chart after 34 ms, longest block 5.7 ms, 364 simulated days,
645 steps of the generator, which are 644 yields and the return. The record was 29,391 characters. On the final
tree the default press has the same 645 steps and its record is 29,596 characters [C]. In the browser on the
final tree: 477 to 491 ms from press to recorded result over three presses, on a pane of 1024 by 768 px with no
throttle and the pane hidden [F]. At `319b4a9` one press read 520 ms [W].

### 4.8 What it cannot claim

Any real request rate, answer time, staffing ratio or call volume. That any staffing ratio or reserve is adequate.
That a lever works in practice or can be issued in any given time. That it describes any operator, city or past
event. That any fleet meets or misses any rule. Anything about driving, traffic, riders or what a late responder
call leads to. That the flat event-day ladder was discovered. That the direction of the main result was
discovered. That the cross-check makes the model valid for a real fleet. At the smallest pool 6.1 percent of
responder calls are late on an ordinary day [S]. The lab reads its levers at 6,000 vehicles, where that level is 0.

---

## 5. Lab B: from delivered to in service

Id `fleet-intake`. Version `scale-intake-1.0.0`. Title "From delivered to in service".
One file, `src/model/scale-intake.js`.

### 5.1 Decision question

How many weeks ahead of the delivery calendar must the slowest depot resource be ordered so that vehicles in rider
service keep pace with vehicles delivered, and which gate keeps delivered vehicles waiting once it is?

The lab does not say that depots or power explain any real gap. It asks which gate binds under typed lead times.
The answer to "how many weeks" is a curve, and the page shows five points of it in every press.

### 5.2 Laws and where the reader sees them [M]

| Law | Where | Reading at the default, shipped seeds |
|---|---|---|
| Lead-time mismatch | The paired verdict, and table "Lead-time mismatch" | Site power ordered 24 weeks ahead: +0.1847 of plan, interval 0.1722 to 0.1965. Ordered 0, 12, 24, 36 and 48 weeks ahead: gain 0, 0.1084, 0.1847, 0.2161, 0.2183 and idle weeks 0, 1.20, 5.60, 14.47, 26.25 |
| A release gate builds a stock that leaves as a wave | Row "Waiting: the release gate", the hand check of the release stock, the chart | Stock in the opening week 369.5 vehicles against 372.0 by hand |
| The binding gate moves | Table "The gate that binds" | At `c08f60d` [C]: waiting on site power 20,106, 4,944 and 948 vehicle-weeks under the control and the two arms. Waiting on ports 0, 4,534 and 6,662. Waiting on depot induction 290, 321 and 386. Before the fix of section 15.3 the same rows read 18,577, 4,132 and 687 for site power and 0, 3,763 and 5,382 for ports [M]. The pins of `319b4a9` held 1,819.5, 1,904.5 and 1,927.5 for depot induction [R] |
| One fleet has several counts | Table "One fleet, several counts" | End of week 26: 624 delivered, 600 integrated, 573 validated, 573 released, 96 accepted at a depot, 94 in rider service |

### 5.3 Model in brief

- Weekly counts of one fleet over a fixed horizon of 104 weeks. No map and no engine call.
- Stocks: awaiting integration, awaiting validation, in rework, at the release gate, at the depot door, in rider
  service, out of service. Conservation is checked every week of every run.
- Depot capacity opens in tranches of 96 places, one every 4 weeks. A tranche is ready when the last of four
  resources arrives: site power, ports, stalls, staff. Each has its own lead time, drawn evenly from a range.
- Waiting at the depot door is booked by week. Since `c08f60d` the stock of a week is split: depot door stock up to
  the free places waits on depot induction, and the rest waits on the resource that the next tranche waits for.
  When no tranche is still to come, the whole stock waits on depot induction. Before the fix the whole stock of a
  week was booked to depot induction whenever a place was left over. The split moves rows of one descriptive
  table and no measure of the declared test.
- The release gate opens in week 16, drawn per seed from weeks 12 to 20. It is a fixed teaching assumption and no
  longer a control: over its whole range the gain of the first arm reads 0.1847 at weeks 12 to 18 and 0.1846 at
  week 20, so it did not move the declared test [M].
- An availability drain removes 12 per 1,000 vehicles in rider service a week, with a return time of 1 to 8 weeks.
- Every draw of a seed sits on one tape that never sees an arm. The weekly update makes no keyed draw.
- The plan is 55,848 vehicle-weeks: a planned vehicle counts from 2 weeks after its delivery week, with no gate
  and no removal. With every gate open the model meets the plan exactly, and a test holds it.

### 5.4 Governing ratio and derived operating point

| Item | Rule | Default |
|---|---|---|
| Governing ratio: room over the tranche interval | Weeks between the slowest depot resource and the next gate, over the weeks between tranches. The lab reads from 2.0 | 6.00 |
| Room | Site power lead time minus ports lead time, in weeks | 24 weeks |
| Site power over ports | A descriptive value in the same row. It does not govern | 2.00 |
| Range of a lead time | The reader types the middle. The range runs a quarter either side | 36 to 60, 18 to 30 weeks |
| Weeks ahead, first arm | The room | 24 |
| Weeks ahead, second arm | End of the site power range minus the next gate | 36 |
| Margin | 0.02 of plan | 1,117 vehicle-weeks |

Why the ratio changed. The reviewed design named site power over ports as the governing ratio. Over the 429 pairs
of lead times a reader can type, two values of that ratio were each both accepted and refused, and equal room gave
equal gain at different ratios. The room over the tranche interval separates exactly: no value of it is both
accepted and refused, and a test asserts it [M].

Controls: the other arm (two derived doses); site power lead time; ports lead time. One refusal besides a value
outside its range: room under 2.0 tranche intervals. 351 of 429 typed pairs run [M]. The floor was measured: 8
weeks is the first room at which the lowest lower bound of the interval is at least twice the margin on four seed
sets [S]. Since `c08f60d` the refusal counts "1 week" and "2 weeks" by their number, and a pair that leaves no room
has its own sentence, which no longer calls ports the next gate when ports is the slower of the two [R]. A typed
site power lead time of 26 weeks beside ports at 24 weeks is refused in a printed sentence of 232 characters that
names two ways back, and Run reads as unavailable [F].

### 5.5 Arms, metrics, guardrails, controls

| Item | Content |
|---|---|
| Main comparison | Ordering with the delivery calendar against ordering site power ahead by the chosen dose |
| Primary | `in-service fraction of plan`, higher is better, margin 0.02 |
| Guardrail of an order arm | `idle weeks per ordered place`, lower is better, allowance 13 weeks |
| Null control | A second simulation under its own arm id. The whole run must equal the control run as canonical JSON. Declared to read zero on every measure |
| Non-binding order control | Site power with a lead time of 0 weeks in both arms, then ordered ahead in one. Declared to read zero on the main measure. Idle weeks +24 |
| Non-binding deliveries control | Deliveries 1.5 times as fast while vehicles wait at the depot door. Declared to read zero on the main measure. Its own guardrail, `weeks not in service per delivered vehicle` with allowance 2, reads +4.33 |
| Order inside a press | The three controls run first. No arm is read before all three have passed. A control that moves stops the press |

Every control title now carries its declared reading. Two of the three controls read "Held because a guardrail
went past its allowance", which is their declared reading and not a failure.

Default records [M]: first arm improved and advanced, +0.1847 of plan, with idle weeks per ordered place +5.60
against an allowance of 13 weeks. Second arm improved and held, +0.2161 of plan, with idle weeks per ordered place
+14.47 against the same allowance. A gain cannot buy back a guardrail. No verdict number moved in the revision.

### 5.6 The weeks ahead table and the hand checks

The table "Lead-time mismatch" runs five order weeks on the tapes of the paired seeds: the control, half the room,
the first arm, the second arm, and the whole lead time. Its third and fourth rows equal the two arms to the last
digit, and a test asserts it. It shows where the gain flattens and where any allowance would cut the curve. At the
default the idle allowance of 13 is passed between 34 and 35 weeks ahead [M, from the review].

Two hand checks, each with its tolerance in natural units. The gain of the other arm at the middle of every range
(0.2206 by hand, 0.2208 simulated). The stock at the release gate in its opening week (372.0 and 369.5). A check
outside its tolerance is reported and does not void the run. The exact controls are what void a press. The third
hand check of the reviewed design was cut: its tolerance was 18 percent of its value, so it passed a removal rate
10 percent high.

### 5.7 Measured robustness

| Study | Result |
|---|---|
| Every setup a reader can type, both arms, 858 typed and 702 accepted, shipped seeds [M] | 0 threw, 0 invalid. Every arm improved. First arm advanced at 351 of 351, largest idle harm 7.17. Second arm advanced at 168 and held at 183. Lowest lower interval end 0.0409, which is 2.05 margins. Every control exactly zero on the primary at 702 of 702. Both hand checks inside their tolerance at 702 of 702 |
| The weeks ahead table over the same 702 presses [M] | Weeks, gain and idle weeks rise row by row in 702 of 702. The gain per added week of the last step is under half of the first in 702 of 702 |
| Four sweeps of 240 points over the control box of the reviewed design, each on its own 12 seeds [S] | Accepted points 181, 186, 181, 182. The four laws and the idle trade together at every accepted point. That box held the release week as a third control. The revised region is its slice at week 16 |
| The same with all 15 fixed assumptions moved as well [S] | 180 of 180, 188 of 188, 190 of 190, 183 of 183 |
| With the refusals lifted over a wider box [S] | 57 of 240. The refusals are what make the lab readable |
| Six injected pairing defects [M] | The press stopped 12 of 12 times before any arm was read |

Seeds. Seeds 3001 to 3012 were tuning seeds for this lab. The shipped seeds 7001 to 7012 are not called held out.
The idle allowance of 13 weeks and the default lead time of 48 weeks were chosen with sight of outcomes, so that
the two arms read one advance and one hold. The page heading "Declared test, set before the run" is true of a
press and not of the design. The model notes say so in plain words.

Compute [M]: 71 ms per press, longest block 1.5 ms, 184 model runs, 257 steps of the generator, which are 256
yields and the return. The record was 33,720 characters. On the final tree the default press has the same 257
steps, and its record is 33,961 characters for the first arm and 34,099 for the second, as the pins hold [C].
In the browser on the final tree: 111 to 115 ms from press to recorded result over three presses, on the same
pane with no throttle [F]. At `319b4a9` one press read 99 ms [W].

What `c08f60d` moved in this lab [R]. The labels of both default presses did not move: `scale-spec:1aa8c833` for
the first arm and `scale-spec:a0b5e327` for the second. No mean, interval or guardrail reading moved. Three rows
of the table "The gate that binds" moved, as section 5.2 gives them. The caption of that table now says how the
depot door stock is split and ends "The rows sum to the total before each is rounded to a whole vehicle-week."
The note on the deliveries control now says where the added waiting sits: "Line rates stay, so two fifths of it
sits at integration and the rest at validation and rework, the release gate and the depot door." The chart draws
its three lines with three marks, as section 7.4 says.

### 5.8 What it cannot claim

Whether any real fleet has fewer vehicles in rider service than delivered, or why. Any real lead time, release
date, stage time, pass share, removal rate or repair time. How long any regulator, utility or supplier takes. That
24 or 36 weeks is the right time to order capacity anywhere. That 13 idle weeks is a standard. Which gate binds in
any real market. Anything about driving behavior or money.

---

## 6. Lab C: density ladder on the Fleet day engine

Id `density-ladder`. Version `scale-density-1.0.0`. Title "Density ladder: one depot cell, five fleet sizes".
One file, `src/model/scale-density.js`, a composer over the unedited Fleet day engine.

### 6.1 Decision question

One depot cell takes five times the cars and five times the requests. At which fleet size does a depot pass its
capacity, what does the fleet lose past it, and at equal total capacity does siting matter?

The capacity comparison shows that a limit was passed. It does not show how small a depot would have served the
same trips, and the page says so.

### 6.2 Laws and where the reader sees them [M]

| Law | Where | Reading at the default, shipped seeds |
|---|---|---|
| Density shortens pickups, with diminishing returns | Table "Density and the depot limit", depot scaled in step | Pickup distance 6.03, 3.75, 3.73, 3.63, 3.64 km at 24 to 120 cars. One step carries the gain. The floor from the second rung follows from the visit rule and the two sites, and a note says so |
| The limit moves from the street to the depot | The chart, and the column "Depot load by hand, control" beside trips per car | Depot load by hand 0.47, 0.95, 1.42, 1.90, 2.37 with the depot fixed. Trips per 100 car-hours 115.2, 106.7, 82.6, 66.3, 54.6. Depot queue 0.010, 0.136, 0.336, 0.473, 0.563 of car time against pickup driving 0.193, 0.209, 0.177, 0.135, 0.115 |
| Capacity and siting are different decisions | Two siting comparisons at equal total capacity | Five sites: pickups 1.53 km against 3.64, trips within the margin. One site at the cell edge: pickups 8.57 km, held by three guardrails |

The column "Tested over its reference" of the reviewed design is gone, and with it the fourth law. Both sides of
that ratio were results of the same run, so it checked nothing, and the list of section 6.8 forbade the reading it
invited.

### 6.3 Model in brief

- Rungs of 24, 48, 72, 96 and 120 cars in one cell of nine neighbouring places, at equal requests per car.
- What is real and what is not. The road distances between the nine places come from the shipped Fleet day road
  table, which is frozen public map geometry of a real region. The inputs table says so in its own row, with the
  source prefix "Fleet day map", the name of the map project and the words "under its open licence". The car is
  the default car of Fleet day (84 kWh, 0.24 kWh per km), which the site already calls an assumption. Everything
  else is invented. No fleet, depot or service in those places is described.
- The map credit. The inputs row sits inside a closed disclosure, and a refused setup empties the inputs table.
  So since `c08f60d` the page shows a credit line outside every disclosure, in every state, a refused setup among
  them: the attribution link "© OpenStreetMap contributors", the licence name "ODbL", and the sentence "Road
  distances in this lab come from the frozen Fleet day road table. Distances only; no service in those places is
  described." The inputs row stays as the detail. Section 7.3 gives the two fields of the contract that carry it.
- Every engine run is 8 hours from 19:00, outside both engine rush windows, with `capture: false`. Minutes 240 to
  480 are measured. The first four hours are a settling period.
- Trips between depot visits are held at 2, not the Fleet day default of 3. With 3 the first rung was not level in
  the measured hours (trips per 100 car-hours rose by 8.5 between the two halves, interval 3.1 to 13.9). With 2 it
  is level within the seed spread [S].
- The engine seed is one keyed draw per declared seed. The lab draws nothing else.
- The lab holds a hand rule on the road table. It sizes the depot before any run and makes no engine call in
  `derive`.

### 6.4 Governing ratios and derived operating point

| Item | Rule | Default |
|---|---|---|
| Governing ratio: street load at the first rung | Share of car time that riders, depot legs and depot work would take if every request were served. Band 0.64 to 0.72 | 0.68 |
| Governing ratio: depot load at the first rung | Depot work asked over capacity at the busier site. Band 0.40 to 0.60 | 0.50 |
| Requests per car-hour | Street load over busy hours per trip by hand | 1.172 |
| Each base site | Work at the busier site over depot load, in whole units and steps of 10 kW | 170 kW, 4 ports, 3 cleaning, 2 software and 2 upload bays |
| Depot load by hand, fixed depot, by rung | After whole units | 0.47, 0.95, 1.42, 1.90, 2.37 |
| Refusal ceiling | A tested plan whose busier site would stand past 0.9 of its capacity by hand at 120 cars. Since `c08f60d` the hand load itself is held against the ceiling, not its text at two decimals | refused |

How a load and a ratio print since `c08f60d` [R] [C]. A depot load by hand prints at two decimals, and at one
more decimal at a time while its text would read as equal to, or across, a threshold that the load is not on. The
threshold is capacity, 1, for the control plan and the ceiling, 0.9, for the tested plan. A typed street load of
0.674 with a depot load of 0.505 puts the control at 1.000178 of its capacity at 48 cars, and the page prints
"1.0002", not "1.00". A siting plan at a street load of 0.679 and a depot load of 0.6 stands at 0.905 by hand and
is refused with "0.905" in its reason. Before the fix it was accepted and printed as 0.90. The inputs table prints
each governing ratio at the decimals it holds, two at least, so that the input printed is the input the sizing
rule used. A typed ratio of more than 12 decimals is echoed whole, because it is the reader's own input. That is
an open item of section 15.6. None of this can be reached from the steps of the controls: it takes a typed value.

Growth rules: depot fixed; both sites scaled in step; sites added as 2, 2, 3, 4, 5 at equal total capacity; one
site of equal capacity. Total power, ports and every bay stage of a siting plan equal the in-step totals exactly at
every rung, and a test asserts it.

### 6.5 Arms, metrics, guardrails, controls

| Item | Content |
|---|---|
| Comparisons, one per press | Capacity: in step against fixed. Sites added: against in step. One site: against in step. The paired test is read at 120 cars. The ladder by rung is descriptive |
| Primary | `completed trips per 100 car-hours in hours 5 to 8`, higher is better, margin 3 |
| Guardrails | `prompt pickup fraction of requests in hours 5 to 8` (allowance 0.02); `unfinished depot visits per 100 cars at the end` (5); `stored energy at the end, kilowatt-hours per car` (2) |
| Null control | The control plan against itself, with the engine run again for the second arm. Declared to read zero on every measure. It is titled a replay: it exposes hidden state and order dependence and cannot expose a deterministic error |
| Non-binding control | The in-step depot against the same depot doubled again. Declared to stay within the margin with no guardrail past its allowance. The record carries whether it did |
| Checks that void a press | Soundness of every run, equal external demand across arms, every declared measure present, replay of the first seed, and either control not reading as declared |

Default records [M], in completed trips per 100 car-hours in hours 5 to 8: capacity improved, +62.6, interval
+60.6 to +64.4, margin 3. Sites added within the margin, +0.2. One site worse beyond the margin, -7.1, with three
guardrails past their allowances. No verdict number moved in the revision, and none moved in `c08f60d`: the label
of the default press is `scale-spec:b4c7f5da` before and after, and the only lines of the density pins that moved
are 25 record lengths, in characters [R].

The prompt pickup guardrail counts requests made at least 15 min before the measured window ends, so that every
counted request has its 15 min. That cut was part of the lab from the start. Since `c08f60d` the row "Held fixed"
of the inputs table says so: "prompt pickup within 15 min, counted over requests made at least 15 min before the
window ends" [R].

In the two siting comparisons the primary is capped by requests per car, so it cannot register a closer pickup.
The first note of those presses therefore prints the pickup distance of both arms at 120 cars, and with sites
added it says why the primary cannot show the change.

Thresholds were fixed as smallest changes of interest before the first run of the final design stage and were not
changed afterwards [S].

### 6.6 Analytic check shown to the reader

Busy minutes per trip by hand against simulated, with a declared tolerance of 0.95 to 1.05: 33.66 and 33.73 at the
default, ratio 1.002 [M]. Its caption says what it covers: the trip, depot leg and depot work times of the inputs,
and no law of the ladder.

What the check is not. Its hand value takes the recorded pickup distance as an input, and the head of the column
says so. From the inputs alone, with the pickup allowance, the ratio reads 0.969 in step, 0.941 with sites added
and 1.010 with one site [M, from the review]. So with sites added the check is inside its tolerance only because a
result of the run is one of its inputs. The model notes do not count its 600 of 600 [S] as evidence for any law.

### 6.7 Measured robustness

| Study | Result |
|---|---|
| Every setting of the reader grid, 75 typed and 72 accepted, shipped seeds, through the control rule of the shell [M] | 0 invalid, 0 voided. Capacity improved at 25 of 25. Sites added within the margin at 22 of 22, with closer pickups at 22 of 22. One site held at 25 of 25 (15 worse, 5 not decided, 5 within the margin), with longer pickups at 25 of 25. Null control exactly zero at 72 of 72. Non-binding control as declared at 72 of 72. At most 113 engine runs |
| Depot load by hand against trips per car, capacity comparison, 25 settings [M] | At every rung whose load by hand is past 1 the fixed depot serves fewer trips per car than the in-step depot, by more than the margin: 85 of 85. At the 15 rungs past the first whose load is 1 or under, the loss runs from 0 to 17 trips per 100 car-hours, so the limit is approached and not met at once. Counted again while the documents were checked, that range is -0.3 to 17.0 |
| 200 keyed points inside the bands, fresh seed sets [S] | Density dividend 99.5 percent, diminishing returns 98.0 percent, car time moves to the depot 100 percent, decision 100 percent, both controls 100 percent |
| 200 points across wider ranges [S] | 89 of 200. The bands are what make the lab readable, and they are checked before any run |
| Window dependence, 30 seeds, 12-hour runs [S] | The sign never changed. The size of the capacity change runs from +54 to +68 across windows at the default. The window is part of the name of the primary |
| Three injected engine defects [M] | Each gives an invalid record with its reason and no controls |

Compute [M]: 1,153 ms per press in Node, first partial chart after 30 ms, longest block 17.0 ms, 113 engine runs.
One engine run is one block and cannot be sliced. The 8 ms slice does not hold for it and the design does not
claim it does. A flagged test now gates the first chart at 1,000 ms and the press at 3,000 ms. In the browser on
the final tree: 966 to 1,034 ms from press to recorded result over three presses, with the first chart after 51
to 70 ms, on the same pane with no throttle [F]. At `319b4a9` one press read 1,060 ms with the first chart at 59
ms, measured while the full suite ran on the same machine [W].

The chart since `c08f60d` [R]. The queue bars are drawn before both pickup lines and their points, so a filled bar
covers no line. Before the fix the bars hid the points of both lines from 48 cars on. The categories are the
short numbers "24" to "120" under the head "Fleet size, cars", and all five labels are drawn at 375 by 812 px [F].
The site count of a tested siting plan is carried by the table and by the summary of the chart.

### 6.8 What it cannot claim

That 120 cars stand for a city or a fleet of thousands. That pickups follow any law of density in this model, or
that such a law was confirmed or refuted. That adding, enlarging or merging sites is right for any real network.
That the size of any change would hold in another window. That the capacity comparison found its direction: the
control depot stands at about 2.4 times its capacity by construction. That capacity has to match the fleet: the
press compares a depot in step with one far past its capacity and cannot say how small a depot would have done.
That a siting plan could have read improved. Anything about what capacity takes to buy, staff or permit, or about
any fleet, depot or service in the nine places.

---

## 7. The shell

### 7.1 Route

| Field | Value |
|---|---|
| Page id | `scale` |
| Bare link | `#/scale-lab`. It opens the first lab of the story, the density ladder |
| Lesson links | `#/scale-lab?lesson=density-ladder`, `...=fleet-intake`, `...=response-reserve` |
| Arrival | A lesson link selects the lab, resets its inputs to the defaults, clears its result and runs nothing |
| Going back | The browser's Back button to a lesson address is an arrival by a lesson link. It discards the recorded result and the edited setup. A lesson link has the same meaning on Fleet day. The rule is in `src/ui/studio.js`. It is a known open item of section 15.6 |
| Leaving | Navigation cancels a running press. The last recorded result stays for a return by the bare link |
| A lab change during a press | Since `c08f60d` the press that is no longer the current job is ignored: the new lab shows its own idle state, and the old press writes no progress and no cancel sentence [R] |
| Refused links | A lesson of another page, an unknown lesson, a shared setup, an unknown parameter. Each shows the existing error page |

### 7.2 Generic view

One file, `src/ui/scale-lab.js`. It holds no lab-specific branch. Document order, which is also the keyboard
order: eyebrow; the thesis line; chooser of three links; the teaching frame with the heading; model and version;
Run, Cancel, progress and status; the alert region; the assumption sentence; the credit line of a lab that has
one; one closed disclosure with the controls, the inputs table, the changed setting and the declared test; the
result; "What this model cannot know"; the glossary.

The result, in order: provenance line; generated reading with its next test; verdict readout; "Set by the inputs,
not found by the run"; controls; chart with its table twin; lab tables; exact values.

The verdict readout of this page draws no strip. The view passes `plotted: false` to the shared readout, so the
caption names the measure and the declared direction only, and the sentence a reader sees states the interval as
printed: "Across 10 paired seeds: the completed trips per 100 car-hours in hours 5 to 8 interval runs from +60.6 to
+64.4, so the outcome is IMPROVED." [C]. Section 15.3 gives the defect this fixes.

| Rule | How it is held |
|---|---|
| At most 130 words from the heading to Run | Asserted for every lab. The thesis line sits above the heading and outside the count |
| Run precedes the setup, and the default setup is ready to run | Asserted |
| One enabled primary button in every state | Asserted before and after a run. One enabled primary button in the browser on the final tree [F] |
| What follows from the inputs is read before the chart and the tables | Asserted, with a negative control |
| A partial chart never sits under an earlier reading | The result area is cleared when a press starts |
| Focus moves to the Result heading after a run, and the page scrolls it to the top | Asserted. In the browser on the final tree focus lands on the Result heading [F] |
| Nothing moves | No transition, animation or tooltip on any `scale-` class. The two pinned reduced-motion blocks are untouched |
| Phone | Run sits in a sticky bar at the bottom until its own place scrolls in. At 375 by 812 px Run sits at y 721 to 774 px in the sticky bar at arrival [F]. That is a desktop browser at the size of a phone, not a phone |
| The page never scrolls sideways | The check at `319b4a9` read no sideways overflow [W]. The independent review found that every lab is 375 px wide before a press, and that after the default press the page was 522 px wide for the response reserve and 406 px for the density ladder, on a screen of 375 px. Since `c08f60d` the readout has one column that may shrink, so the guardrail table scrolls inside its own region. After the default press of each lab the scroll width equals the client width, 375 px, for all three labs [F]. A test holds the style rule. No test of the suite holds the layout itself, because the suite runs on a stand-in for the browser that computes no layout |
| One progress meter per press | Since `c08f60d` the meter only rises through the phases of a press and is full when the press ends. Asserted |
| A result is marked as from another setup only when it is | Since `c08f60d` the view compares the setup on the page with the setup the result used. A control changed back to the value the result used removes the mark. Asserted |
| An error while a result is drawn reaches the reader | Since `c08f60d` the alert reads "The lab could not show its result:" with the reason, the status reads "No result was recorded from this press.", and the previous result stays. Asserted |
| No number of more than 12 decimals outside the exact record | Asserted after the default press of every lab, and read in the browser on the final tree [F] |

The assumption sentence reads: "Every input on this page is a teaching assumption unless its source row says
otherwise. No value is a measurement of any fleet." The caption of the inputs table reads: "Inputs and where each
comes from. A sizing rule works on teaching assumptions".

### 7.3 Lab contract

A lab is one frozen descriptor, `LAB`, exported by one page-only file under `src/model`. The view knows a lab only
through it.

| Field | Meaning |
|---|---|
| `id`, `version`, `short`, `title`, `geography` | Identity. The id is the lesson id, the catalog id and the chooser value |
| `seeds` | The declared paired seeds, 2 to 40 whole numbers |
| `frame` | Five entries: what and why, how we simulate, what to look for, the ops takeaway, the kind |
| `limits`, `unknowns` | One sentence of limits, and 3 to 6 sentences for "What this model cannot know" |
| `controls`, `defaults` | 1 to 4 control descriptors and a function that returns fresh default values |
| `derive(config)` | Pure, cheap, never throws, on `null` by name. Returns a setup with frozen declared tests and the rows of the inputs table, or a refusal with a reason of at most 192 characters |
| `steps(setup)` | A synchronous generator. It yields progress and partial charts and returns the result |
| `map` | Optional, new in `c08f60d`. True for a lab that reads the Fleet day road map. The view then shows the attribution link and the licence name. Only the density ladder sets it |
| `credit` | Optional, new in `c08f60d`. One sentence of at most 160 characters that follows the copy rules. The view shows it after the attribution, outside every disclosure, in every state. A lab with neither field shows no credit line. Only the density ladder sets it |

The view asks for two things that the shared interface modules give only on request, both new in `c08f60d`. It
passes `plotted: false` to the verdict readout, because it draws no strip. It sets `sided: true` in its reading
tools, which asks for numbers that keep their side of a threshold. No other page passes either. Section 7.6 and
decisions 7, 24 and 25 give the rule.

The full contract, with every shape, is stated once in section 1 of the implementation plan, which is published
beside this design. The differences resolved between the shell text and the three lab descriptors, in short:

| # | Difference | Ruling |
|---|---|---|
| 1 | The shell text says a lab file exports one constant. Lab A exports 10 more names and Lab B one more, all for tests | A lab exports `LAB` and may export test-only names. The registry imports `LAB` only |
| 2 | All three labs give `steps` a second parameter as a test seam | Allowed. The view calls `steps(setup)` with one argument |
| 3 | The shell text names two control kinds. Lab A ships a third, `'guardrail'` | The allowed names are `'null'`, `'non-binding'` and `'guardrail'`. Every lab ships a null control |
| 4 | Lab A adds `as_declared` to each control result | Part of the contract. A control whose declared reading is more than an exact zero carries `as_declared`. Lab C now sets it on its non-binding control |
| 5 | The shell import table does not list `bay-area.js` for Lab C | Allowed. `model` may import `model`, and the boundary test passes |
| 6 | The shell left open when controls run | Closed. Every lab runs every shipped control in every press |
| 7 | A failed check ended three different ways, and a failed control did not void the press in Labs A and C | One rule, held by the shell for every lab. A press that cannot be read never returns a valid result. A shipped control has failed when it is invalid, when it is marked `as_declared: false`, or when it is a null control and any paired difference of the primary or of a guardrail is other than 0. The record then keeps its provenance and its runs and loses its reading, controls, chart, tables and notes. The page prints "Invalid run: the null control did not read as declared, so there is no comparison. No result can be read." Lab B keeps its throw, which stops the press before any arm is simulated |
| 8 | Refusal wording and length differ by lab | One printed form and one cap of 240 characters. At the design stage the longest reason was 192 characters in Lab A and 186 in Lab B. On the final tree, over every value on a step of a control and two steps past each end, the longest reason is 192 characters in Lab A, 184 in Lab B and 167 in Lab C, which print as 240, 232 and 215 characters [C] |
| 9 | Two labs said on the page that the interval label is nominal and one did not | The shell says it once, in the declared test, for every lab. The two labs no longer repeat it |
| 10 | Every input row had to carry one of four source prefixes | Five. "Fleet day map" marks an input taken from the shipped road table |

### 7.4 Chart primitive

`ladderChart(options)` in `src/ui/charts.js`: one builder for a category axis with up to three series of bars or
lines, one measure axis, a table twin, a summary sentence, stated limits and named gaps for absent values. A week
axis is a ladder whose categories are weeks, so Lab B uses the same builder with 52 categories. Colours come from
tokens. There is no dash pattern and no motion. The existing chart tests pass unchanged, 45 of 45 [M]. The chart
limits now read: the limits sentence of the lab, then "The shape is a property of this model and its assumed
inputs."

Three rules of the builder are new in `c08f60d` [R]. Each is held by a test of the shell test file.

| Rule | What it replaces |
|---|---|
| Every bar series is drawn before every line series and its points. The legend, the mark styles and the table keep the order the lab gave | Series were drawn in the given order, so a filled bar given last covered the lines |
| The three line marks differ by shape and not by ink alone: filled round points with the legend swatch `line`, ring points with the swatch `line-ring`, square points with the swatch `line-square`. Each swatch carries the marker of its points. No dash pattern | The first and the third line shared one stroke and one plain swatch |
| Category labels thin by the widest label, taken as 0.6 em a character at the label size of 12 px, plus 8 px between two. Labels that all fit are all drawn. A label that would pass the right margin is left to the table | Labels thinned by a gap sized for clock labels, whatever their width |

The labs keep their categories short, 12 characters at most, which a test asserts for every shipped lab.

### 7.5 Entry points

| Place | Content |
|---|---|
| Overview | A fourth decision card, number 04, category FLEET SCALING, title "What changes as the fleet scales?". Its text names the three labs in the order of the story. The grid becomes two by two |
| Catalog | Three lesson cards drawn by the existing card code, a fourth model article, a model filter option "Scale lab", a family filter option "Scaling the fleet", and a third link in "Start here", which opens the density ladder |
| Fleet day | One ordinary link inside the intro, after the Run line: "Fleet day stops at 120 cars. For what changes as a fleet scales, open the Scale lab." It opens the lab that continues Fleet day |
| Header | Unchanged, 6 links |

In the browser on the final tree the entry points are present: the fourth Overview card, with the grid reading two
by two, the Fleet day link, the fourth catalog article and the "Start here" link to the density ladder [F].

The entry points change pages that existed before this wave: the Overview, the catalog and Fleet day. So does the
glossary, which gains two entries and changes one, on every page that shows it. Section 7.6 says which text of
the older pages this wave changes and which it does not.

### 7.6 Amendments from integration and review

Ten changes to shell-owned and shared interface files, each prototyped and tested on the working copy [M]. None
edits a protected file. No existing test changes. They landed as three commits, so that a declined decision was one
small revert when they landed: the contract rules in `05113ab`, the reading rules in `953ebce`, and copy, order and
structure in `9fdb160` [R]. Since `c08f60d` a revert of any of them may need a merge by hand, section 12. The full suite has 0 failures with them on the final tree [F]. The implementation plan names the
commit and the edit behind each.

Commit `c08f60d` revised amendments 4 and 5 after the independent review. The table gives each amendment as it
stands at `c08f60d`. Where the fix commit changed one, the row says what it was.

| # | Amendment | Files | Commit | Why |
|---|---|---|---|---|
| 1 | A declared guardrail that is missing from any run voids the press | `src/model/scale-contract.js` | contract rules | Measured on the committed contract: a missing guardrail gave VALID, IMPROVED and ADVANCE_TO_NEXT_TEST with the guardrail marked not evaluable. That breaks D7. The instrument is protected, so the shared contract checks first |
| 2 | A shipped control that does not read as declared voids the press | `src/model/scale-contract.js`, `src/ui/scale-lab.js` | contract rules | Measured in the review: with a reserve of zero agents that added 25 stopped minutes, and with an engine whose repeat runs differed, the page still printed a recommendation to advance |
| 3 | A refusal prints in the absence form: "Not available: outside what this lab can read: reason." | `src/ui/scale-lab.js` | reading rules | D5 gives absence one form |
| 4 | On a page that asks for it, a number never reads as equal to, or across, the threshold it is read against, and never as zero when it is not. Only the Scale lab asks. A page that does not ask prints the text it printed at `c79eccf`, byte for byte | `src/ui/experiment.js`, `src/ui/teaching-frames.js`, `src/ui/scale-lab.js` | reading rules, revised in `c08f60d` | Measured on the committed builders: a harm of 13.04 against an allowance of 13 printed "+13.0" beside REGRESSED. As built in `953ebce` the rule acted on every page, in the card rows and in the reading line. The independent review found that it had not reached the chart summaries, the hidden summary or the walkthrough chip of the four-area pages, so one value could print two ways on one card. Since `c08f60d` the rule is opt-in. Section 15.3, defect 9 |
| 5 | Next tests and reasons that this page can honour | `src/ui/teaching-frames.js`, `src/ui/experiment.js`, `src/ui/scale-lab.js` | reading rules, extended in `c08f60d` | The shared sentences name a rider draw, cars that riders needed, another seed set and more paired seeds. The page has no rider in two labs and holds its seeds fixed in all three. The independent review found two more: a held press told the reader to relieve a guardrail as its own change and to declare two changes, and the page offers neither. Since `c08f60d` every next test of the page names only what the page offers |
| 6 | The declared test says the 95 percent interval is a bootstrap label, nominal at this seed count | `src/ui/scale-lab.js` | reading rules | Measured coverage is 90.0 to 93.5 percent at 12 seeds. One place for every lab |
| 7 | Four copy corrections: "its governing ratios" in the catalog article; a glossary entry for the governing ratio that means something; "support pool" for "support desk"; paired seeds share "the same random draws, and the same riders where a model has riders" | `src/ui/simulation-catalog.js`, `src/ui/teaching-frames.js`, `src/ui/studio.js` | copy, order and structure | Lab C has two governing ratios and Lab B's is a lag over an interval. Lab A says pool. Labs A and B have no riders |
| 8 | What follows from the inputs is printed under the verdict, before the chart and the tables | `src/ui/scale-lab.js` | copy, order and structure | A verdict that follows from a sizing rule was read four tables before the sentence that says so |
| 9 | The thesis line above the heading, and the labs in the order of the story | `src/ui/scale-lab.js`, `src/ui/scale-labs.js`, `src/ui/simulation-catalog.js`, `src/ui/studio.js` | copy, order and structure | Nothing on the page joined the three labs |
| 10 | The assumption sentence allows a sourced row; the chart limits and the caption of the inputs table say that a sizing rule works on assumptions; the identity disclosure is titled "Model and version"; an invalid record has its own status sentence | `src/ui/scale-lab.js` | copy, order and structure | The reviewed sentence said that every input is an assumption, which Lab C's road table is not. Two disclosures shared one title |

Exact strings of amendments 5 and 7, read in the modules at `c08f60d` [R].

| Place | Text |
|---|---|
| Next test, improved | Move one input toward the edge of its range and run again, then read the measures no guardrail covered. |
| Next test, within the margin | Check whether this change reached the limit that binds, then test the one that does. |
| Next test, not decided | Test a larger step of the same setting. This page holds its paired seeds fixed. |
| Next test, held by a guardrail, new in `c08f60d` | Choose a setting that keeps {guardrail} inside its allowance, then run again. The name of the guardrail stands in the place of the braces |
| Next test, main result worse, new in `c08f60d` | Read the tables for what this change took time from, then run another setting. |
| Next test, invalid run, new in `c08f60d` | Change one input, or open this lesson again, and run again. |
| Reading line, last sentence of a result that is not decided | No direction is read. Before `c08f60d` it read: The interval crosses the margin at these paired seeds, so no direction is read. The shorter sentence keeps the line inside 240 characters with its interval |
| Verdict card, reason under a result that is not decided | the interval crosses the margin; test a larger step, as this page holds its paired seeds fixed |
| Glossary, governing ratio | Governing ratio: load over capacity, or a lag over the interval between arrivals, that decides whether a mechanism shows. The lab derives the other inputs. |
| Glossary, paired seeds | Paired seeds: both runs share the same random draws, and the same riders where a model has riders, so a difference comes from the one changed setting. |

Every reading line of the page fits 240 characters and keeps its interval. A line that is still too long drops
its guardrail sentence first, and the guardrail table carries it. A test builds all four outcomes for every lab,
with and without a harmed guardrail, and asserts both [R].

What this wave changes on pages that existed before it, and what it does not.

| Text of an older page | Changed by this wave | Held by |
|---|---|---|
| Number text of the verdict card, the verdict readout and the reading line, on every surface | No. Since `c08f60d` amendment 4 is opt-in and only the Scale lab opts in | `test/scale-lab.legacy-text.pins.json`: 900 pairs of number text and 19 verdict views, computed once from the two interface modules as they were at `c79eccf`. `test/helpers/legacy-text.mjs` holds the inputs |
| Next tests and reasons of the shared card | No. The Scale view hands in its own and the shared card keeps its own | The same pins, which hold the reading lines of the 19 views |
| The glossary entry for paired seeds, and the two new entries for the null control and the governing ratio | Yes, on every page that shows the glossary. Amendment 7 and section 10 | `test/teaching-frames.test.mjs` |
| The Overview, the catalog and the Fleet day intro | Yes: the entry points of section 7.5, and "Four ways to learn" on the Overview | The shell test and the pinned counts of section 10 |

So the statement that holds is narrow: side-preserving numbers change no text on any page that existed before
this wave. The wave does change other text of older pages, by the entry points and the glossary, and every such
change was part of the design. Extending the side-preserving rule to every surface of the four-area pages is a
proposal for a later wave, not part of this one [P]. Until then a four-area card can print a value that rounds
onto its threshold beside a status that says it is past it, as it did before this wave. The pinned text holds one
such case: an interval end of -30.04 s against a margin of 30 s prints "-30.0 s" beside IMPROVED [R].

37 existing test files, 27 of which reach a changed file, passed unedited at the design stage [M]. The full suite
of the final tree, which holds them, has 0 failures [F].

---

## 8. Byte ledger

Baseline offline package 2,318,855 bytes. Target growth 81,920 bytes. Hard stop 92,160 bytes. The target and the
hard stop are lines that the lead set. The owner has approved neither. Every number in the tables of this section
is a count of bytes of the offline package, measured with the repository's own packer.

The state of the final tree [F]. Offline package 2,408,323 bytes, package check OK. Growth +89,468 bytes over the
baseline. The target is passed by 7,548 bytes. 2,692 bytes are left under the hard stop.

| Part | Allocation | Reviewed design [M] | Built at `319b4a9` [M] [W] | Final tree, `c08f60d` [C] | Note |
|---|---:|---:|---:|---:|---|
| Shell, with the ten amendments and the fixes | 25,600 | 25,167 | 26,280 | 29,003 | View 13,290; contract 4,727; chart +4,910; styles +1,717; experiment +1,688; studio +1,099; frames +635; catalog +498; registry 393; routes +46 |
| Lab A `response-reserve` | 20,480 | 20,433 | 21,838 | 22,647 | Hard limit 24,576. 1,929 left |
| Lab B `fleet-intake` | 19,456 | 19,417 | 19,964 | 20,379 | Hard limit 23,552. 3,173 left |
| Lab C `density-ladder` | 13,312 | 15,880 | 16,964 | 17,439 | Own hard limit 17,408. Passed by 31 |
| **Total growth** | **81,920** | **80,897** | **85,046** | **89,468** | **7,548 over the target, 2,692 under the hard stop** |

The four allocations sum to 78,848 bytes. The total of that column is the target, 81,920 bytes, so 3,072 bytes of
the target were assigned to no part. The three other columns sum to their totals.

How the last column was taken. The lead measured the total of the final tree [F]. The parts were counted while
this document was brought in line with `c08f60d`: the packer built the offline page in memory from three trees,
`c79eccf`, `319b4a9` and the final files, and each module was counted between its markers [C]. The three totals
read 2,318,855, 2,403,901 and 2,408,323 bytes, which are the baseline and the two measured totals. The parts at
`319b4a9` counted this way equal the column of the design stage to the byte.

Lab C stands 31 bytes past its own hard limit of 17,408 bytes on the final tree. That limit was the lead's line
for one lab, inside the package hard stop, which holds. No test gates it. It is stated here because the design
named the limit. It is part of decision 3, assumed at the lead's recommendation, not ratified.

What the fixes add, by part, in bytes.

| Part | Fixes of the three design reviews [M] | Fixes of the independent review, `c08f60d` [C] |
|---|---:|---:|
| Shell | 1,113 | 2,723: experiment 1,185; view 807; chart 592; frames 73; styles 66 |
| Lab A | 1,405 | 809 |
| Lab B | 547 | 415 |
| Lab C | 1,084 | 475 |
| **Together** | **4,149** | **4,422** |

Checkpoints, in the order of work. The first seven were measured on the working copy [M] and measured again in the
worktree after each commit [W]. Every worktree value equals the working copy value. The last was measured on the
final tree [F]. All values are bytes of the offline package.

| After | Commit | Working copy [M] | Worktree [W] or final tree [F] | Growth |
|---|---|---:|---:|---:|
| Baseline | `c79eccf` | 2,318,855 | 2,318,855 [C] | 0 |
| Shell with three stubs | `2caeac6` | 2,357,617 | 2,357,617 | +38,762 |
| Contract rules, stubs still in place | `05113ab` | 2,358,553 | 2,358,553 | +39,698 |
| Reading rules | `953ebce` | 2,359,746 | 2,359,746 | +40,891 |
| Copy, order and structure | `9fdb160` | 2,360,022 | 2,360,022 | +41,167 |
| Lab A replaces its stub | `27f6014` | 2,376,259 | 2,376,259 | +57,404 |
| Lab B replaces its stub | `1a81ae8` | 2,391,500 | 2,391,500 | +72,645 |
| Lab C replaces its stub | `319b4a9` | 2,403,901 | 2,403,901 | +85,046 |
| Fixes of the independent review | `c08f60d` | not applicable | 2,408,323 [F] | +89,468 |

Against the target and the hard stop.

| Line | Bytes | At `319b4a9` | On the final tree |
|---|---:|---|---|
| Package target | 81,920 | Passed by 3,126 | Passed by 7,548 |
| Package hard stop | 92,160 | 7,114 left | 2,692 left |
| Offline cap | 2,621,440 | 217,539 left | 213,117 left |
| Reserved for other work | 135,904 | Untouched | Untouched |
| Unassigned under the offline cap | | 81,635 | 77,213. It was 166,681 before this wave |

The hosted site is 99 files and 3,349,602 bytes on the final tree, package check OK [F]. At the design stage the
hosted text payload was 2,228,997 bytes against the offline cap, so the offline file is the binding limit, and
the hosted folder held 97 text files and 2 media files [M]. The text payload was not measured again.

The choice for the owner, decision 3, assumed at the lead's recommendation, not ratified. The package
passes the target and stays under the hard stop. The lead's rule for that band is a recorded decision. The eight
commits hold the first option. The owner can still choose the second.

| Option | Growth | What it means |
|---|---:|---|
| Grant 7,548 bytes from the band between target and hard stop. Recommended | 89,468 | Every fix of the design reviews and of the independent review ships. 2,692 bytes stay under the hard stop. A later change of more than that needs a trim first or a new line from the owner |
| Return under the target | at most 81,920 | 7,548 bytes have to go. Every trim of the list below frees 1,981 bytes as measured at the design stage. The rest would come from the rates-only note and its arithmetic in Lab A and from fixes of the independent review. That takes back what the reviews asked for |

Trims, if a later change needs bytes. Each was measured alone on a copy that still ran, at the design stage [M].
They were not measured again on the final tree. They remove cross-check rows, reference columns and wording. They
are taken in this order.

| Order | Trim | Saves |
|---|---|---:|
| 1 | Lab C: the second declared reading shortened to "declared to stay within the margin" | 37 |
| 2 | Shell: the status sentence of an invalid record | 76 |
| 3 | Lab A: the clause that says who makes a responder call | 44 |
| 4 | Lab A: the two seed band columns | 122 |
| 5 | Labs B and C: the declared readings in five control titles | 239 |
| 6 | Lab C: the hand check table | 382 |
| 7 | Lab B: the hand check of the release stock | 267 |
| 8 | Lab B: row "First week at 90 percent" | 327 |
| 9 | Lab A: the table "Landing in time" | 487 |

Never trimmed: a null control, a refusal reason, a governing ratio row, `limits`, an entry of `unknowns`, a note
under "Set by the inputs, not found by the run", the row of the road table, the map credit, any of amendments 1
to 4, or any fix of section 15.3. If the package would pass the hard stop, Lab C is cut whole (D4), by the five
steps in section 6 of the implementation plan. Without the module of Lab C the growth of the final tree is about
72,000 bytes [E].

---

## 9. Test and gate plan

### 9.1 Tests of this package

The column "At `319b4a9`" is the count of the build. The column "At `c08f60d`" is the count of the final tree [F].

| File | At `319b4a9` | At `c08f60d` | What it holds |
|---|---:|---:|---|
| `test/scale-lab.test.mjs` | 22 | 34 | The contract for every lab, refusals, reproducibility, provenance, the one instrument, fail-closed contract, yield order, absent cells, copy before and after a run, the thesis line, the order of the result, Run and Cancel, a lab that throws, a lab that never ends, the route and entry points, the chart, styles, page-only modules and the packed copy scan, a failed control, run budget and control names, side-preserving numbers, a result that is not decided, printed refusals, the interval sentence, and Run pressed inside the packed page. New in `c08f60d`: the text of older pages against its pins, sided numbers on request, three line marks, bars before lines, label thinning, the readout that cannot widen the page, the map credit in every state, reading lines inside 240 characters with their interval, next tests the page offers, the mark of a changed setup, one meter per press, and an error while a result is drawn |
| `test/scale-response.test.mjs` | 11 | 20 | Queue formula, tape and event, lever semantics, readable region, pins of five setups, laws on shipped and held-out seeds, the landing table, eight deliberate faults, press accounting, copy, rates only for a lever arm by hand and over the page grid, timing by flag. New in `c08f60d`: minutes to clear of an empty queue, a directive that removes nothing, the declared change and the inputs row of a directive, an event load off its step, the first note, units in the chart summary, the sentence of a partial chart, short chart categories |
| `test/scale-intake.test.mjs` | 14 | 17 | Pins, conservation and the gap identity, plan definition, tape and pairing, six injected defects, fail closed on a replay that differs, controls, laws and the weeks ahead table, hand checks, the refusal region of 429 pairs and the rule that the governing ratio governs, copy, the counts the default page stays away from, a pinned robustness sample, timing by flag. New in `c08f60d`: the weekly split of the depot door stock, the note on the deliveries control against the recorded rows, the rows against their total before and after rounding |
| `test/scale-density.test.mjs` | 14 | 21 | Typed assumptions and the hand rule, a pure `derive`, no run before Run, run budget and declared fields, pins, laws and the depot load column, controls, arm swap, three defects, conservation against captured frames, names and copy and the road table row, reader grid by flag, shape robustness by flag, timing by flag. New in `c08f60d`: the map field and the credit sentence, a hand load on its true side of capacity and of the ceiling, the ceiling held by the hand load itself, governing ratios at the decimals they hold, the cohort of the prompt pickup guardrail, short chart categories |
| Together | 61 | 92 | |

Two files are new in `c08f60d` and hold no test of their own: `test/scale-lab.legacy-text.pins.json` and
`test/helpers/legacy-text.mjs`. The shell test reads both.

At the build, 61 tests: without the performance flag 55 ran and 6 were skipped, and with it all 61 passed in about
103 s [M]. On the final tree, 92 tests: with the flag the four files read 34 of 34, 20 of 20, 17 of 17 and 21 of
21 [F]. Run once more while this document was brought in line: 92 tests, 92 pass, 0 fail, 0 skipped, in 125.0 s
[C]. They also ran inside the full suite with the flag, which has 0 failures and 0 skipped tests [F]. Each lab's
laws are pinned on its declared seeds, so a direction in generated copy is backed by a pin. Six new assertions of
the design stage were checked with a negative control: each fails when the code it guards is taken out [M]. The
commit message of `c08f60d` states that each fix of the independent review stands behind a test that failed
first [R]. This document did not repeat those failing runs.

### 9.2 Gates, run once in the worktree after integration

The column "Expected" is the design. The column "At `319b4a9`" is what ran on the build, before the independent
review [W]. The last column is what ran on the final tree, the working files of `c08f60d`, and what has no
recorded result [F].

| # | Gate | Expected | At `319b4a9` | On the final tree, `c08f60d` |
|---|---|---|---|---|
| 1 | Full serial Node suite with the performance flag | At `c79eccf` the suite had 1,876 tests. At `2caeac6` it had 1,892, the 16 more being shell tests [R]. The seven build commits bring 61 new tests in all, those 16 included, and the fix commit brings 31 more | 1,937 tests, 1,936 pass, 0 fail, 0 skipped, 1 existing todo, in 265.7 s | Ran. 1,968 tests, 1,967 pass, 0 fail, 0 cancelled, 0 skipped, 1 existing todo, in 281.9 s |
| 2 | Pack the offline page and the site, then run both checks, and the pack test | 0 problems | Offline package 2,403,901 bytes. Package check 0 problems | Ran. Offline package 2,408,323 bytes, package check OK. Hosted site 99 files, 3,349,602 bytes, package check OK. The pack tests are files of the suite and ran inside gate 1 |
| 3 | Python parity and boundary tests, `ruff` | 89 pass, as at `2caeac6` [R] | 89 pass. The lead recorded no `ruff` result at that commit | Ran. 89 pass in 5.12 s. `ruff check`: all checks passed. The eight commits change no Python file [R] |
| 4 | `git diff --check`, staged diff checks, staged privacy scan with the patterns added for this wave | clean | `git diff --check` over the seven commits was clean | `git diff --check`: clean. No result of the staged checks or of the staged scan is recorded here. They belong to the commit of the documents |
| 5 | Browser check at 1440 by 900 px and 375 by 812 px with the final frames and painted frames | Run inside the first desktop screen; focus on the Result heading; no sideways overflow; tab order equal to document order | Ran in part. It read no sideways overflow, which the independent review then found to be true before a press and false after one | Ran in part, on the native modules after the fixes. The table below gives every reading. Not measured: a pane of 1440 by 900 px and a painted frame. Not recorded: the tab order |
| 6 | Phone acceptance at 375 by 812 px with 4 and 6 times throttling | Press to painted result and longest task recorded for each lab. Not measurable in the design stage | Not run | Not run. No throttled phone profile and no physical phone were measured |

Browser acceptance on the native modules after the fixes [F]. The pane was hidden, so no painted frame was seen,
and every reading is measured layout or time. No throttle. No physical phone.

| Check | Size of the pane | Reading |
|---|---|---|
| Press to recorded result, density ladder, three presses | 1024 by 768 px | 966 to 1,034 ms, with the first chart after 51 to 70 ms |
| Press to recorded result, fleet intake, three presses | 1024 by 768 px | 111 to 115 ms |
| Press to recorded result, response reserve, three presses | 1024 by 768 px | 477 to 491 ms |
| Focus after a press | 1024 by 768 px | On the Result heading |
| Primary buttons | 1024 by 768 px | One enabled |
| Console | 1024 by 768 px | No error |
| Width of the page after the default press of each lab | 375 by 812 px | The scroll width equals the client width, 375 px, for all three labs |
| Run at arrival | 375 by 812 px | In the sticky bar, at y 721 to 774 px |
| Rung labels of the charts | 375 by 812 px | All five of the density ladder and all three of the response reserve are drawn |
| Map credit | 375 by 812 px | On the density ladder page and on no other |
| Readout | 375 by 812 px | No "left of the band" and no "left is better" |
| Decimals | 375 by 812 px | No number on the page has more than 12 decimals |
| A refused setup | 1024 by 768 px, as the release record gives it | A typed site power lead time of 26 weeks in the fleet intake is refused with a reason of 232 characters, and Run reads as unavailable |
| Entry points | 1024 by 768 px, as the release record gives it | The fourth Overview card, with the grid reading two by two. The Fleet day link. The fourth catalog article. The "Start here" link to the density ladder |

Not measured: a pane of 1440 by 900 px, a painted frame, a throttled phone profile, a physical phone, a screen
reader, Safari or Firefox.

The rule of the design was: no package is built for release and nothing is deployed before gates 1 to 6 have
passed on the integrated tree, and no commit before the one that lands Lab C can be released, because until then
the route is open and a stub answers. The rule was the lead's. The owner has not ratified it. On the final tree
gates 1, 2 and 3 have passed. Gate 4 has run in part: `git diff --check` is clean, and the staged checks belong to
the commit of the documents. Gate 5 has run in part. Gate 6 has not run. So the rule as the design wrote it was
not met. The owner gave the word to deploy on 2026-09-27, and the lead deployed `c08f60d` that day with gates 5 and
6 not passed. The deployment followed the owner's instruction, not the rule of the design. The second half of the
rule holds: the deployed commit is the one that lands Lab C and its fixes, so no stub answered on the public page.
This document claims no gate that did not run. Section 9.4 states the deployment.

### 9.3 What the gates cannot see

Layout, paint and phone timing need a browser. Whether a lab computes at import needs a reviewer, because every
lab is imported on every page load. The list of modules that the package check scans for copy is kept by hand, and
the shell test closes that gap for `scale-` files only. Pins compare doubles that come through `Math.log`,
`Math.exp` and `**`, as the shipped engines do, so a change of Node version can move them. One pins file,
`test/scale-response.pins.json`, records the Node version, v22.22.0. The two other pins files hold no version
field [R].

The independent review showed what this means in practice. The suite had 1,937 tests and 0 failures at `319b4a9`,
and none of them caught any of the 9 defects of section 15.3. One of the 9 is layout, which the suite cannot see,
because it runs on a stand-in for the browser that computes no layout and paints nothing. For that one the suite
holds the style rule, and the width of the page was measured in a browser. The other 8 were text, numbers and
drawing order that a test could have held and that no test did. The tests of `c08f60d` now hold them. The suite
still cannot see a painted frame, and no painted frame of this page has been inspected at any stage.

### 9.4 Deployment

The lead deployed on the owner's instruction of 2026-09-27. That instruction was to finish, deploy, test and
validate, and to write a handoff. It names no push. The release record,
`docs/FLEETLAB_SCALE_LAB_RELEASE_2026-09-27.md`, holds the receipts: the upload, the deployment list, the file by
file readback and the hosted smoke. This section states the result [D].

| Item | State |
|---|---|
| Host | Cloudflare Pages project `fleetlab`, Direct Upload, Production. Upload tool Wrangler 4.135.0 |
| Deployment | `19e17ac6-d617-4789-9260-ca259c53e076` |
| Addresses | Stable https://fleetlab.pages.dev/. Immutable https://19e17ac6.fleetlab.pages.dev/ |
| Source | `c08f60d`, on branch `claude/fleetlab-scale-lab`, which is local only. The Pages branch label reads `feat/fleetlab-playground` |
| What it published | Every change between the previous Production source `b99ab04` and `c08f60d`, 17 commits [C]. Two waves reach the page: the teaching frames of `c79eccf`, recorded as local only until this deployment, and the Scale lab. The release record lists every commit of the range and its public effect |
| Package | 99 files with `_headers`, 3,349,602 bytes. Hosted inventory SHA-256 `5c071dc69e353f6118ab43078c12d2470c9d709cf2ac7c501fe4fb807c669da3`, over rows of path, file SHA-256 and size, sorted by path, separated by NUL characters, each ended by a newline. Offline file SHA-256 `4828cded63f5c23f99a8d13cc32716f587717f57847dd79bdba59215786800b5` |
| Readback | 98 of 98 public files match the local package by SHA-256 and size, on the stable and on the immutable address |
| Response headers | A content security policy with `connect-src 'none'` and `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, a same-origin opener policy, and cache control public with a maximum age of 600 s |
| Hosted smoke | All three labs pressed. They recorded `scale-spec:b4c7f5da` (density ladder), `scale-spec:1aa8c833` (fleet intake) and `scale-spec:443de567` (response reserve), the labels of the default presses in the pins. One press each: 1,044 ms, 102 ms and 513 ms. Fleet day seed 42 read 95 completed, 176 unserved, 4 waiting and 9 in progress of 284 requests. A teaching-frame lesson opened by its link. No console error |
| Rollback target | `dd4bfa44-7226-4502-9d66-01bb1790f2b6`, the previous Production, source `b99ab04`. A rollback is an owner action in the Pages dashboard and rewrites no history |
| Push | Not done and not authorized. A reader who follows the site to the public repository will not find `c08f60d` there |

The documents of this wave are committed after the deployment. They change no site file: the site is built only
from `src`, `styles.css`, `index.html`, `media` and the tools under `playground/fleetlab/`. So committing them leaves
the deployed site byte for byte what `c08f60d` builds. One site commit does stand between the deployed source and
the documents: `1aeaace`, a Fleet day heading fix outside this wave, changes `src/ui/studio.js` [R]. A site built
from the branch head therefore differs from the deployed site in that one file, and 27 bytes in each package [C].
It is not deployed, and deploying it is a new release on the owner's word. The documents commit on top of
`1aeaace` is made and is the branch head; its site inputs equal those of `1aeaace`.

Two sweeps of the lesson links ran after the deployment. The lead opened every lesson link of the catalog (59)
and the 9 page routes on the stable address in the in-app browser (Chromium engine) with the pane hidden, so no
frame was painted, by changing the address hash with no reload between them: 0 error pages, 59 lessons by page
(Fleet day 18, Street lab 6, Four-area experiments 29, Four-area workspace 3, Scale lab 3), 6 header links, no
console error, and exactly one lesson whose main heading did not match its document title [D]. An inventory stage
visited the modules downloaded from the live site on the fake DOM, 10 route visits, 59 lesson visits and 4
deliberately bad links, with 0 error pages from a good link, 0 network attempts, 0 engine run calls and 0 storage
accesses, and saw the same defect: after another Fleet day lesson, `#/fleet-day?lesson=region-launch` keeps that
lesson's title in the main heading. It came in with the teaching frames of `c79eccf`; D1 sets no heading per
lesson. `1aeaace` fixes it. Two full serial runs with the performance flag at `1aeaace` each read 1,969 tests,
1,967 pass, 1 existing todo and 1 timing failure that passed its one isolated rerun: 9.34 ms against 8 ms in the
response reserve on a loaded machine, and 11.34 ms against 8 ms in a four-area runtime test on an otherwise idle
machine. A full run at `1aeaace` with zero failures is not recorded.

---

## 10. Pinned counts that move

Landed in `2caeac6` [R]. Each was a deliberate edit, and no other line of these tests changed.

| File | Before | After |
|---|---|---|
| `test/navigation.test.mjs` | 56 lessons | 59 |
| `test/simulation-catalog.test.mjs` | presets plus operational plus street | the same sum plus 3 |
| `test/teaching-frames.test.mjs` | 56 frames; 18 glossary entries; 21 surface frames | 59; 20; 21 unchanged |
| `test/studio.test.mjs` | 8 page ids; setup capture for three targets | 9 page ids; adds the scale view. Header links stay at 6 |
| `test/copy-surfaces.test.mjs` | five routes scanned | adds `#/scale-lab` |
| Six copies of the lesson-to-page mapping | three targets | each gains the `scale` branch first |
| `test/teaching-frames.grounding.json` | 76 entries | 79 |
| `tools/check-dist.mjs`, the list of modules scanned for copy | 25 names | 34 names, three of them reserved |

Not moved by the eight commits. They move with the documents, after `c08f60d`.

| Item | Before | After |
|---|---|---|
| `README.md`, three places | 56 lessons | 59 in two places, one of them with "three Scale lab lessons" added. The third place now says that the catalog of this source tree holds 59 lessons. One new section, "Scale lab" |
| `ARCHITECTURE.md` | no Scale lab section | one new item, item 45 of its section 12, with the D8 reading for Lab A |
| The lesson snapshot kept outside the tree | digest of 56 lesson records | declared again for 59 |
| The one lesson reserved for the next model | would have been lesson 57 | becomes lesson 60 |

The amendments and the fixes of the design reviews move no pin of any existing test. No existing test pins the
order of the labs. `test/scale-lab.test.mjs` is new in this wave. It went from 16 tests at `2caeac6` to 22 at
`319b4a9` and to 34 at `c08f60d` [R].

Commit `c08f60d` edits no test and no pin that existed before this wave [R]. Among the pins of this wave it moved
these, each by a deliberate edit.

| Pins file | What moved in `c08f60d` | What did not |
|---|---|---|
| `test/scale-response.pins.json` | The label and the digest of the two pinned directive setups, and the two interval ends of the first. Section 4.5 | Every mean. The default press, `scale-spec:443de567`. The two other pinned setups |
| `test/scale-intake.pins.json` | Three rows of the table "The gate that binds" in both arms, its caption, the note on the deliveries control, the SHA-256 and the length of both recorded results, and the name of the key that lists the counts the default page stays away from | Both labels, `scale-spec:1aa8c833` and `scale-spec:a0b5e327`. Every mean, interval and guardrail reading |
| `test/scale-density.pins.json` | 25 record lengths, in characters | The label of the default press, `scale-spec:b4c7f5da`. Every value |
| `test/scale-lab.legacy-text.pins.json` | New. 900 pairs of number text and 19 verdict views of the older pages | |

---

## 11. Scope rulings

These rulings are the lead's. The owner has ruled on none of them. The requests declined here are decision 16 of
section 12, assumed at the lead's recommendation, not ratified.

| Ruling | In or out | Reason |
|---|---|---|
| Setup sharing through links | Out | D10 |
| A result download | Out | Bytes, and "Exact values" holds the whole record |
| A change to the header navigation | Out | D1 |
| Any edit to a protected file | Out | D3. Lab C composes over the public engine function |
| A second verdict engine | Out | D7 |
| Money, fares, energy prices | Out | D5, and no lab needs them |
| A fleet past 120 cars on the Fleet day engine | Out | The engine stops there. Lab C says so first among its unknowns |
| Fleets of thousands | In, for Lab A only, as counts | An aggregate model is honest about what it is |
| A combined arm in Lab A, or an arm read against another arm | Out | One main comparison a press. The reader compares two presses |
| Lab A: the table of landing times | In | Law 4 is a curve over delay, and one press showed one point of it |
| Lab A: backlog and longest wait at the landing minute | Out for now | 574 bytes [S] |
| Lab A: the lean pool as a third lever, read at 20,000 vehicles against the staffing ratio | Out for this wave. Decision 21, assumed at the lead's recommendation, not ratified | It needs its own declared test, a guardrail on the ordinary wait and a sweep |
| The deliveries lever in Lab B as a third arm | Out, kept as a control | Its reading is the same at every accepted setup, and as a control it closes a pairing hole |
| Lab B: the release week as a control | Out | It did not move the declared test. It stays as a fixed assumption, so the release stock and its hand check stay |
| Lab C: a fourth comparison, in step against a depot doubled once and then held | Out for this wave. Decision 21, assumed at the lead's recommendation, not ratified | A first look read within the margin at a depot load of 0.40 and improved at 0.50 to 0.60, and mixed at 0.45 [M, from the review]. Capacity is lumpy near the threshold, so the comparison needs its own sweep and pins kept away from those setups |
| Lab C: pickup distance as the primary of the two siting comparisons | Out. Decision 21, assumed at the lead's recommendation, not ratified | Its margin would be declared after the results were seen. The pickup distance of both arms is printed in the reading instead |
| Lab A's fixed inputs as controls | Out for this wave | Each would need its own sweep |
| A shared helper for invalid results, or an invariant callback in the shared runner | Out for this wave | Each lab has a tested fail-closed path, and the control rule is one function of the shared contract |
| A three-digit fallback for tiny values in the shared number formatter | Out | The site's rule is the exact double, and existing tests pin it. At `319b4a9` two default presses of the Scale lab printed a raw double. Since `c08f60d` the Scale lab prints a value that would round to zero at two significant digits, through its own request, decision 25, so no Scale lab press prints a raw double. Older pages keep the exact double, an open item of section 15.6 |
| The direction sentence of the shared verdict strip for a measure where higher is better | Out for the pages that draw the strip | Existing builder, not introduced by this wave. The Scale lab draws no strip, and since `c08f60d` its readout names no side of one, decision 24. On older pages the sentence is unchanged. No viewing by the owner is recorded |
| The stale mark naming the changed control | Out for this wave | The mark already says the result used the previous setup |
| Side-preserving numbers in the shared verdict readout and reading line | In, for the Scale lab only | An honesty fix under a standing house rule. Since `c08f60d` a page asks for it and only the Scale lab asks, so no older page prints different text. It moves no existing pin. Extending it to every surface of the four-area pages is a later wave [P] |

---

## 12. Owner decisions

How the build proceeded. The owner's request for this run was to finish. No message of the workflow is the
owner's consent to a decision. The build therefore proceeded to local commits on the lead's recommendations, and
every decision below is recorded as **assumed at the lead's recommendation, not ratified**. The owner has ruled
on none of them. Each amendment group is its own commit and each lab is its own commit. Since `c08f60d` the reverse
patch of no earlier commit of the wave applies cleanly [C], so a declined decision is undone by revert commits,
newest first, with a merge by hand where a patch does not apply and a rerun of the four Scale test files. Where
`c08f60d` also touched a decision, the row names the hunks that go back with it. Push and
deployment were not part of the build. The owner then gave the word to deploy on 2026-09-27, and `c08f60d` was
deployed that day, section 9.4. That word is recorded as the owner's instruction to deploy. It ratifies no decision
of this table. Nothing is pushed.

One decision is held on its cautious side while it is open. Decision 22 asks whether citations carry the names of
authors. The lead recommended that they do. Until the owner rules, this document cites papers by title, venue and
year and holds no personal name.

The ids S1 to S15 are the ids that the design stage gave to the defaults of the shell.

| # | Decision | Lead's recommendation | If declined | State on 2026-09-27 |
|---|---|---|---|---|
| 1 | Ratify the shell as committed in `2caeac6`, which took every shell default: the existing "VERDICT" title with the chip "Teaching run, not a decision record" (S1); the sticky Run bar on phones (S2); a ninth family "Scaling the fleet" (S4); two glossary entries (S5); two-by-two grids on the Overview and in the catalog (S6); frames kept in the lab files (S8); the new shared contract file under `src/model` (S9); leaving the page cancels a press (S11); declared directions shown before a run in one marked span (S12); no download and no setup link (S13); metric names as display phrases (S14); the page scrolls the Result heading to the top after a run (S15) | Ratify all. S6 and S12 change the look or the wording of existing surfaces and deserve a look in the browser first | Revert commits for the eight commits, newest first, or a new branch cut from `c79eccf`, then a new deployment or a rollback in the Pages dashboard. Never a hard reset and never a rewrite of history | Assumed at the lead's recommendation, not ratified. Built in `2caeac6`. Deployed with `c08f60d` |
| 2 | The lesson count moves from 56 to 59 (S3). The lesson reserved for the next model becomes lesson 60. The lesson snapshot kept outside the tree is declared again | Approve | The pin edits of section 10 go back with decision 1 | Assumed at the lead's recommendation, not ratified. The pins moved in `2caeac6` |
| 3 | The byte ledger of section 8: growth 89,468 bytes, which is 7,548 bytes over the target and 2,692 bytes under the hard stop. Lab C stands 31 bytes past its own limit of 17,408 bytes | Grant the 7,548 bytes. Keep the remaining 2,692 bytes as the room of this wave: a later change of more than that takes a trim first or a new line from the owner | The trims of section 8 in their order, then the rates-only note of Lab A and fixes of the independent review | Assumed at the lead's recommendation, not ratified. The eight commits hold 89,468 bytes of growth [F]. The seven build commits held 85,046 [W], and the fixes of `c08f60d` add 4,422 [C] |
| 4 | The reading of D8 for Lab A: one keyed draw per simulated minute, expanded by a local stream that is a pure function of that draw | Accept, and write the rule into `ARCHITECTURE.md`. The cheapest keyed alternative costs about 1.1 s per ladder against 64 to 70 ms, and the shipped engines already draw from a local stream | Lab A draws through the cached prefix hasher. Every pin of Lab A is recorded again, and its press takes about 1 s longer | Assumed at the lead's recommendation, not ratified. Built in `27f6014`. `ARCHITECTURE.md` holds no Scale lab section in any of the eight commits. Item 45 of its section 12 states the rule and landed with the documents commit on top of `1aeaace` |
| 5 | Amendment 1: a missing declared guardrail voids the press | Approve | Revert the contract rules commit | Assumed at the lead's recommendation, not ratified. Built in `05113ab` |
| 6 | Amendment 3: the refusal sentence in the absence form, and a cap of 240 characters on every printed refusal | Approve | One string of the view and one test line | Assumed at the lead's recommendation, not ratified. Built in `953ebce` |
| 7 | Amendment 4: side-preserving numbers, on request. `metricValueText` and `valueWithMinutes` take `against`, which defaults to `null` and then gives the text of `c79eccf` byte for byte. `runLine` passes it only when the page's reading tools set `sided`. Only the Scale lab asks. It touches `src/ui/experiment.js` and `src/ui/teaching-frames.js`, which also draw the four-area pages, and no text of those pages changes | Approve as opt-in. No existing test moves. Extending the rule to every surface of the four-area pages is a later wave with its own pins [P] | Revert the reading rules commit and the hunks of `c08f60d` that carry `against`, `sidedText` and `sided`. The Scale lab then prints numbers as the older pages do | Assumed at the lead's recommendation, not ratified. Built in `953ebce` for every page. Made opt-in in `c08f60d`, section 15.3, defect 9. `test/scale-lab.legacy-text.pins.json` holds the text of the older pages |
| 8 | Amendment 5: next tests and reasons that the page can honour | Approve | Six strings of the view | Assumed at the lead's recommendation, not ratified. Built in `953ebce`. Extended in `c08f60d` with the next tests of a held press, a worse main result and an invalid run, section 7.6 |
| 9 | Amendment 6: the interval sentence in the declared test | Approve | One sentence of the view | Assumed at the lead's recommendation, not ratified. Built in `953ebce` |
| 10 | Amendment 7: four copy corrections, one of which changes a glossary entry that every page shows | Approve | The strings go back one by one | Assumed at the lead's recommendation, not ratified. Built in `9fdb160` |
| 11 | Lab A: pools of 2, 6 and 20 agents at 2,000, 6,000 and 20,000 vehicles; 12 seeds; three controls in every press, one of them named `'guardrail'`; the lean pool kept in the table and out of the chart; the table of landing times; the rates-only note; the source cell that names no rule | Approve | Revert the commit of Lab A and its hunks in `c08f60d` | Assumed at the lead's recommendation, not ratified. Built in `27f6014`. Since `c08f60d` the declared change of a directive names every vehicle request moved into the event, which moved the labels of the two pinned directive setups and no mean, section 4.5 |
| 12 | Lab B: the room over the tranche interval as the governing ratio; the release week as a fixed assumption; the weeks ahead table; two hand checks; an idle allowance of 13 weeks; a default site power lead time of 48 weeks, which gives one advance and one hold; the deliveries lever as a control; a failed exactness check stops the press | Approve | Revert the commit of Lab B and its hunks in `c08f60d` | Assumed at the lead's recommendation, not ratified. Built in `1a81ae8`. Since `c08f60d` the depot door stock is split each week, section 5.3 |
| 13 | Lab C: trips between depot visits held at 2; the depot load column in place of the reference ratio; the chart shows car time; the ceiling of 0.9; the first arm of each control reuses the ladder runs, which keeps a press at 113 engine runs; the engine's car-mix key appears as an identifier in code and never as text | Approve | Revert the commit of Lab C and its hunks in `c08f60d` | Assumed at the lead's recommendation, not ratified. Built in `319b4a9`. Since `c08f60d` the chart names its rungs by number and draws its bars before its lines, section 6.7 |
| 14 | Repository documents: this design and its plan under `docs/plans/`, one model notes document for the three labs, one dated release record, one handoff for the Scale lab, and the source of truth file updated in place | Approve | A revert commit of the documents commit | Assumed at the lead's recommendation, not ratified. The documents are in one documents commit on top of `1aeaace` and in none of the eight commits. They change no site file, so the site inputs of that commit equal those of `1aeaace` and the deployed site stays what `c08f60d` builds |
| 15 | Push and deployment, and their scope. The branch carries the teaching-frame wave under the Scale lab: `c79eccf` is 47 commits ahead of `main` and on no remote branch, and its own release record gave that wave no deployment authority. A deploy from this branch publishes both | The owner gives one explicit word that covers both waves, after gates 1 to 6. The push is a separate word | Deployment: a rollback to `dd4bfa44-7226-4502-9d66-01bb1790f2b6` in the Pages dashboard. Push: nothing to undo | Deployment: done on the owner's instruction of 2026-09-27, before gates 5 and 6 had passed. One deployment, `19e17ac6-d617-4789-9260-ca259c53e076`, published both waves, section 9.4. Push: not done. It waits for the owner's word. `c08f60d` is 55 commits ahead of `main` and on no remote branch [C] |
| 16 | Requests declined in section 11 | Let them stand. Any of them can be reopened in a later wave | Not applicable | Assumed at the lead's recommendation, not ratified. The requests stay declined |
| 17 | Amendment 2: a shipped control that does not read as declared voids the press | Approve. Without it a page can recommend advancing while its null control has failed | Revert the contract rules commit | Assumed at the lead's recommendation, not ratified. Built in `05113ab` |
| 18 | Amendments 8 and 10: what follows from the inputs under the verdict; the assumption sentence; the captions; the titles | Approve | The strings and one moved line go back | Assumed at the lead's recommendation, not ratified. Built in `9fdb160` |
| 19 | Amendment 9: the thesis line, and the labs in the order of the story. The bare link and the Fleet day link then open the density ladder, which is the slowest lab to run | Approve. Nothing runs on arrival | One line of the registry, one id in the catalog, two sentences of the Overview | Assumed at the lead's recommendation, not ratified. Built in `9fdb160` |
| 20 | The road table row of Lab C names the map project and its open licence on the Scale lab page. The map pages of the site carry the full notice | Approve, and confirm that the row is enough for the licence | The row names "frozen public map geometry" only | Assumed at the lead's recommendation, not ratified. Built in `319b4a9`. The independent review found the row alone was not a visible credit, so since `c08f60d` a credit line stands outside every disclosure as well, decision 23 |
| 21 | Three options that the teaching review raised and this wave declines: the lagging depot comparison in Lab C, pickup distance as a siting primary, and the lean pool as a lever in Lab A | Decline for this wave. Each needs a sweep, and one needs a margin declared after results were seen | Not applicable | Assumed at the lead's recommendation, not ratified. None of the three is built |
| 22 | Whether the citations of section 2 carry the names of the authors of the cited papers. The draft of this design carried seven such names, in rows 14, 16a and 16c, and no other personal name | Approve as citations | The rows give the title, the venue and the year, or the identifier only | Not ratified, and held on its cautious side while it is open: this document cites by title, venue and year and holds no personal name |
| 23 | Two optional fields of the lab contract, `LAB.map` and `LAB.credit`. A lab that reads the Fleet day road map sets `map`, and the view then shows the attribution link "© OpenStreetMap contributors" and the licence name "ODbL". `credit` is one sentence of at most 160 characters, shown after them. The line stands outside every disclosure, in every state, a refused setup among them. Only the density ladder sets either field | Approve, and confirm that the credit line with the inputs row is enough for the licence | The credit line goes. The inputs row alone names the licence, inside a closed disclosure, and a refused setup shows no credit at all | Assumed at the lead's recommendation, not ratified. Built in `c08f60d`, section 15.3, defect 8 |
| 24 | The option `plotted` of the shared verdict readout, `renderVerdictReadout`. It defaults to true, which is the readout of every older page. The Scale lab draws no strip and passes false: the caption names the measure and the declared direction only, the sentence a reader sees states the interval as printed, and the harms of the guardrail table keep their side of their allowances | Approve | The Scale lab prints a sentence about the side of a strip it does not draw, which reads false for a measure where higher is better, or it draws a strip at a cost in bytes that no line of section 8 holds | Assumed at the lead's recommendation, not ratified. Built in `c08f60d`, section 15.3, defect 1 |
| 25 | Short numbers in the Scale lab. A table cell, a note or a chart value that would round to zero at its decimals prints at two significant digits, never as its raw double, and never with more than 12 decimals. Older pages keep the site's rule, the exact double | Approve for the Scale lab. A site-wide rule is a later wave with its own pins [P] | Cells print the exact double, as they did at `319b4a9` | Assumed at the lead's recommendation, not ratified. Built in `c08f60d`, section 15.3, defect 6 |

---

## 13. How to reproduce

The package has landed in eight local commits, so the tests and pins that a reader runs are in the repository at
`c08f60d`. The branch is not pushed. Until the owner pushes it, those tests and pins are in one local repository,
and a reader of the public repository cannot run them. The model notes and the implementation plan land with the
documents, after `c08f60d`. The measurements tagged [M] and [S] were taken during design on a working copy that is
not published. The measurements tagged [W] were taken by the lead in the worktree at `319b4a9`, and those tagged
[F] and [C] on the final tree. The committed tests and pins are the record.

| What | How |
|---|---|
| The contract, the view and the copy rules | `node --test playground/fleetlab/test/scale-lab.test.mjs` |
| Lab A: laws, controls, faults, pins, rates only | `node --test playground/fleetlab/test/scale-response.test.mjs`, with `test/scale-response.pins.json` |
| Lab B: laws, controls, defects, refusal region, pins | `node --test playground/fleetlab/test/scale-intake.test.mjs`, with `test/scale-intake.pins.json` |
| Lab C: hand rule, run budget, laws, controls, pins | `node --test playground/fleetlab/test/scale-density.test.mjs`, with `test/scale-density.pins.json` |
| The flagged tests: timing, the page grids, the packed page | The same four commands with `FLEET_PLAYGROUND_PERF=1` and `--test-concurrency=1`, on an idle machine |
| The text of the older pages | The shell test reads `test/scale-lab.legacy-text.pins.json`, 900 pairs of number text and 19 verdict views, with the inputs in `test/helpers/legacy-text.mjs` |
| Bytes | Pack the offline page outside the tree and read its size. The release record archives each checkpoint. At `c08f60d` the size is 2,408,323 bytes [F]. At `319b4a9` it was 2,403,901 bytes [W] |
| The whole suite | The full serial Node suite with `FLEET_PLAYGROUND_PERF=1` and `--test-concurrency=1`. At `c08f60d` it reads 1,968 tests, 1,967 pass, 0 fail, 0 cancelled, 0 skipped, 1 existing todo [F]. At `319b4a9` it read 1,937 tests, 1,936 pass, 0 fail, 1 existing todo [W] |
| The deployed site | The release record gives the path, SHA-256 and size of each public file, and the digest of the hosted inventory. Pack the site from `c08f60d` and compare |
| Seed records, robustness tables, interval coverage, rejected arms, what was chosen with sight of outcomes | `docs/FLEETLAB_SCALE_LAB.md`, the model notes |
| The build order and the lab contract | The implementation plan, published beside this design |

---

## 14. Review findings and dispositions

Three reviews read the design, the plan and the working material of the design stage. Each returned "proceed
after fixes". Every blocker and every important finding is fixed or answered below. "Fixed" means changed in the
working copy and measured, or changed in the documents where the finding is about a document. Every such change
to code and tests is in the seven commits: the working copy equals the committed files at `319b4a9` byte for byte.
Commit `c08f60d` changed some of those files again after the independent review. Where it superseded a
disposition below, the row says so, and section 15 gives the reason.

### 14.1 Feasibility review: 1 blocker, 7 important, 12 minor

| Id | Finding | Disposition | What changed, and the evidence |
|---|---|---|---|
| B1 | The only copy of the build source was in a temporary folder | Fixed | The build source is committed. The shell, the amendments, the three lab modules, their tests and their pins are in the seven commits from `2caeac6` to `319b4a9`. Nothing is pushed, so the copy is in one local repository |
| I1 | A shipped control that failed did not void the press in Labs A and C | Fixed | Amendment 2 and ruling 7 of section 7.3. One function of the shared contract, called by the view. One shell test on a press built from the contract alone, with a null control bent by a billionth in one guardrail, a control marked as not declared, and an invalid control. Two negative controls fail as they must [M]. 0 of 934 presses of the three reader regions are voided [M]. Cost 495 bytes in the contract and part of 498 bytes in the view. Landed in `05113ab` |
| I2 | The first build commit could not land from the patches | Fixed | Three patches for three commits and one for the run budget test, none with a hunk of a lab. A dry run from the committed shell applies all four, passes 17, 20, 21 and 22 shell tests in turn, and ends equal to the working copy byte for byte [M]. The three commits landed as `05113ab`, `953ebce` and `9fdb160`, and the run budget test landed with Lab C in `319b4a9` [R] |
| I3 | The worktree is one commit ahead of the base, and the plan had no way back | Fixed | The build started from `2caeac6`. Decision 1, assumed at the lead's recommendation, not ratified, names the way back. Section 9.2 says that no commit before Lab C lands can be released |
| I4 | A release from this branch also releases the teaching-frame wave | Fixed | Decision 15, assumed at the lead's recommendation, not ratified, states the scope and asks for one word that covers both waves, after gates 1 to 6. The owner gave the word to deploy on 2026-09-27, and one deployment published both waves before gates 5 and 6 had passed, section 9.4 |
| I5 | Five blocking decisions were open, and the workflow cannot close them | Fixed | Section 12 states the reading: local commits on the lead's recommendations, every decision marked as assumed at the lead's recommendation, not ratified, one commit per amendment group and per lab |
| I6 | The side-preserving number fixed the verdict card and not the reading line of a four-area page | Fixed at `319b4a9`, then superseded in `c08f60d` | At `319b4a9` the reading line passed its own margin, and the same four-area result printed "+0.02004" in both places [M]. The independent review then found three more surfaces of the four-area card that the rule had not reached. Since `c08f60d` the rule is opt-in and only the Scale lab asks, so a four-area page prints the text of `c79eccf` on every surface, held by `test/scale-lab.legacy-text.pins.json`. Section 15.3, defect 9. The Scale view still has no wrapper of its own |
| I7 | The reason for the reading of D8 left out the cheapest keyed draw and the precedent | Fixed | Section 4.3. Measured again: 0.81 to 0.83 and 0.33 to 0.35 microseconds per draw [M] |
| M1 | Lab C `derive(null)` threw | Fixed | One character. The lab test asserts four kinds of nothing |
| M2 | Lab A accepts a typed load of 1.17 to 1.19 | Fixed in the document | Section 4.4 states the readable region as the refusal does. The lab test holds that 1.17 runs |
| M3 | No test gated Lab C's wall clock | Fixed | A flagged test |
| M4 | No test pressed Run inside the packed page | Fixed | A flagged shell test. The packed record equals the native record for all three labs [M] |
| M5 | Raw doubles on two default presses | Not changed at `319b4a9`. Fixed for the Scale lab in `c08f60d` | Since `c08f60d` a value that would round to zero prints at two significant digits on the Scale lab page, decision 25, and a lever that removes nothing returns the no-lever value exactly. The shared formatter is unchanged, so older pages keep the exact double. Section 11 |
| M6 | The grounding file names test files that do not exist yet | Closes itself when the labs land | |
| M7 | The rule on public counts was not one rule | Fixed in the document | Rule 2 of section 2 |
| M8 | Timing gates have little room, and pins compare doubles | Kept as designed | The rerun rule of the plan stands. Section 9.3 |
| M9 | Node timing is not browser timing | Fixed in the document, then corrected by measurement | D9 called every Node figure a lower bound. The browser acceptance at `319b4a9` reads under the Node figure for Lab C [W], and D9 now says that a Node figure is a guide and not a bound |
| M10 | Copy that repeats; two disclosures with one title; an invalid record with the status of a valid one | Fixed | Labs A and C no longer repeat the interval sentence. Amendment 10 |
| M11 | Two plan sentences did not hold | Fixed in the plan | |
| M12 | Layout risks that only a browser shows | Moved to the browser check of the plan | |

### 14.2 Honesty and privacy review: 1 blocker, 8 important, 14 minor

| Id | Finding | Disposition | What changed, and the evidence |
|---|---|---|---|
| B1 | Lab C said that nothing on it describes a real place, and it runs on the road geometry of nine real places | Fixed | The limits sentence, a row of the inputs table with the fifth source prefix, the assumption sentence of the shell, the chart limits, the first paragraph of this document and section 6.3. The lab test asserts that the withdrawn sentence is gone and that one row carries the prefix. A negative control fails as it must [M] |
| I1 | Lab A called both thresholds public reporting thresholds | Fixed | The clause is gone. The source cell reads "Teaching assumption". Rule 3 of section 2 says which rule each value comes from |
| I2 | Lab B's first unknown presupposed a fact about real fleets | Fixed | "Whether any operating fleet has a gap ..., or why." |
| I3 | The verdict sat at the top and "Set by the inputs" at the bottom | Fixed | Amendment 8, asserted with a negative control [M] |
| I4 | The design said Lab A's fleets were chosen away from public counts | Fixed | Rule 2 of section 2 |
| I5 | The trim list cut what the same section said is never cut | Fixed | Section 8. No trim removes an unknown or a note. Every trim was measured again [M] |
| I6 | The design named private files and rested on evidence a reader cannot open | Fixed | Section 13 is "How to reproduce". No file of the working copy is named. The plan adds the patterns of this wave to the staged scan, and the working notes of the design stage are not published |
| I7 | Section 2 broke its own first rule in two places and dropped a limit of the fact check | Fixed | Rows 16a to 16c, rule 4, rule 6 and the paragraph on how the rows were checked |
| I8 | Roles of an assisted workflow read as people | Fixed | The sentence under the tags |
| 1 | The glossary says paired seeds share the same riders | Fixed | Amendment 7 |
| 2 | Labs B and C printed a control's reading without its declared reading | Fixed | Five control titles. 239 bytes |
| 3 | "Responder call" was never defined | Fixed | One clause in the row "Requests" |
| 4, 5 | A raw double in a reading line; the direction sentence of the verdict strip | Not changed at `319b4a9`. Fixed for the Scale lab in `c08f60d` | The Scale lab prints short numbers, decision 25, and its readout names no side of a strip, decision 24. Older pages are unchanged. Section 11 |
| 6, 7 | "A factor of ten or a hundred"; where the unknowns sit | Fixed | Sections 1.1 and 1.2 |
| 8, 9 | The late fraction at the smallest pool; thresholds chosen with sight of outcomes | Fixed in the documents | Sections 4.8 and 5.7, and the model notes |
| 10 | Outputs of a sizing rule can read as estimates | Fixed | The caption of the inputs table |
| 11 | Two items of the never-claim lists had no page sentence | Fixed | One clause each in an unknown of Labs B and C |
| 12 | The engine's car-mix key is a product name | Not changed. Part of decision 13, assumed at the lead's recommendation, not ratified | An identifier the engine requires. It is in no page text and no record, and a test scans for it |
| 13 | Map data under an open licence, with no notice on the Scale lab page | Fixed, with decision 20, assumed at the lead's recommendation, not ratified | The road table row names the map project and its licence |
| 14 | One personal name in the design | Open, with decision 22, which is not ratified | While the decision is open this document cites by title, venue and year and holds no personal name |

### 14.3 Teaching value review: 1 blocker, 10 important, 7 minor

| Id | Finding | Disposition | What changed, and the evidence |
|---|---|---|---|
| B1 | Lab B labelled as its governing ratio a ratio that does not govern | Fixed | Section 5.4. The row, the refusal and the glossary entry. A test walks the 429 typed pairs and asserts that no value of the ratio is both accepted and refused [M] |
| I1 | The default press of every lab is a demonstration | Fixed | Section 1.4, and a note under the verdict in every lab |
| I2 | The size of Lab A's main change is rates-only arithmetic, and the page did not say so | Fixed | Section 4.6. A closed form, a note in every press, a hand value in the lab test, and the whole page grid by flag [M] |
| I3 | The decision record of Lab A is not a scaling decision | Fixed at its smallest size | The question of section 4.1, the column "Reserve by rule" and the busy share of the lean pool. The lean pool as a lever is decision 21, assumed at the lead's recommendation, not ratified |
| I4 | Law 4 could not be seen in one press | Fixed | The table "Landing in time". 120 more simulated days a press, 459 ms [M] |
| I5 | The answer to Lab B's question is a curve that the page did not show, and one control was inert | Fixed | Sections 5.3 and 5.6. The release week is a fixed assumption, the third hand check is gone, and the weeks ahead table runs in every press |
| I6 | The capacity comparison cannot answer its question | Fixed in part. One sentence rejected | The question and the column are changed. The proposed sentence "Trips per car hold while the load by hand stays under 1" is rejected: the default table itself reads 106.7 trips at a load of 0.95 against 117.2 in step, and over the 25 settings the loss under a load of 1 runs from 0 to 17 [M]. The note says what the press shows instead. The lagging depot comparison is decision 21, assumed at the lead's recommendation, not ratified |
| I7 | The analytic check covers neither law and takes a recorded result as an input | Fixed | Section 6.6. The caption, the floor note with the recorded range, the column cut, and what the model notes may count |
| I8 | In both siting comparisons the primary cannot register the effect | Fixed by the smaller change | The pickup distance of both arms is in the reading. With one site the primary does register the change, so the sentence about the cap is printed with sites added only. A changed primary is decision 21, assumed at the lead's recommendation, not ratified |
| I9 | No law named on the page, no thesis, no lab that points to another | Fixed | Amendment 9, a topic at the head of seven captions, one pointer in the unknowns of each lab. The order of the story moves no existing test [M] |
| I10 | The next test told the reader to do what the page does not offer | Fixed | Amendment 5, in the next test, the reading line and the verdict card, asserted on a result that is not decided. The independent review found two more next tests that named what the page does not offer, and `c08f60d` replaced them, section 7.6 |
| M1 | The busy share row restated the staffing input | Fixed | Cut. A rate 10 percent high still puts every row outside [M] |
| M2 | Hand check 3 was weak, and no hand check was shown to catch a model fault | Fixed in part | Check 3 is cut. An injected model fault would need a new seam in the weekly update, which the lab does not have. It is left for a later wave |
| M3 | Law 3 is named after one mechanism and shown by another | Fixed | Section 1.2 names both. The busy share of the lean pool shows the steady-state form |
| M4 | The lean pool flattened the ladder in the chart | Fixed | Section 4.2 |
| M5 | The allowance and the default were chosen so that the arms give one advance and one hold | Fixed in the documents | Section 5.7 and the model notes |
| M6 | The fourth law of Lab C was carried by a column that checks nothing | Fixed | Cut |
| M7 | The null controls cannot show what the instrument reads on chance alone | No change to the page | The model notes say that no shipped control estimates a false alarm rate |

---

## 15. Independent review after the build

### 15.1 Method

The review ran after the seven build commits, as a stage of the same assisted workflow as the build. It read the
range `c79eccf..319b4a9` through seven lenses, one of them on packaging and security. Each finding that a lens
rated critical or important went to two verifiers: one checked it by running code, and one by reading. A finding
counts as confirmed here when both verifiers confirmed it. The 25 minor findings were listed. This document records
no second verification of them. The lead wrote the fixes in `c08f60d`. Its commit message states that each fix
stands behind a test that failed first [R]. This document did not repeat those failing runs, and it records no
reading of `c08f60d` by the independent review.

### 15.2 Counts

| Count | Value |
|---|---|
| Lenses | 7 |
| Critical or important findings confirmed by both verifiers | 13 |
| Findings refuted | 0 |
| Minor findings listed | 25 |
| Distinct defects among the 13 confirmed findings | 9. Several findings are one defect seen through different lenses |
| Defects that moved a verdict number | 0 |
| Defects fixed in `c08f60d` | 9 of 9 |
| Tests of the suite at `319b4a9` that caught any of the 9 | 0 of 1,937 |
| Tests added in `c08f60d` | 31: 12 in the shell test, 9 in the response reserve test, 3 in the fleet intake test, 7 in the density ladder test. The suite went from 1,937 to 1,968 tests |

### 15.3 The nine distinct defects

| # | Defect | Where a visitor met it | Fix in `c08f60d` | Test that holds it |
|---|---|---|---|---|
| 1 | A readout that draws no strip said "lies left of the band" and "left is better" over printed numbers that were all to the right of the band | The verdict readout of the density ladder and of the fleet intake, whose measures are higher is better | `renderVerdictReadout` takes the option `plotted`, default true. The Scale lab passes false: the caption names the measure and the declared direction only, and the visible outcome sentence states the interval as printed. Decision 24 | Shell test "Run records one result with provenance, a generated line, the verdict, a chart with its table and closed exact values", extended in `c08f60d` |
| 2 | At 375 px the page scrolled sideways after a press: 522 px wide for the response reserve and 406 px for the density ladder | A screen of phone width, after the default press | `.scale-lab .fl-readout { grid-template-columns: minmax(0, 1fr); }`, so the guardrail table scrolls inside its own region. The shared rule of the other pages is unchanged | Shell test "C13: the verdict readout cannot widen the Scale lab page" holds the style rule. The suite computes no layout, so the width was measured in a browser: 375 px for all three labs after a press [F] |
| 3 | The queue bars of the density ladder chart were drawn over both lines and hid their points from 48 cars on | The density ladder chart | Every bar series is drawn before every line series and its points. The legend, the mark styles and the table keep the order the lab gave | Shell test "C12: a ladder draws every bar before every line and point, and keeps legend order, mark style and table order" |
| 4 | Two of the three lines of the fleet intake chart were drawn alike | The fleet intake chart | The three line marks differ by shape: filled points with the swatch `line`, ring points with `line-ring`, square points with `line-square`. No dash pattern | Shell test "C6: a three-line ladder gives every series its own legend swatch and its own drawing, with no dash and no colour alone" |
| 5 | The whole depot door stock of a week was booked to depot induction whenever a place was left over. Under the control the row read 1,819.5 vehicle-weeks where the split gives 290, about six times too much | The table "The gate that binds" of the fleet intake | The stock of each week is split: up to the free places it waits on depot induction, and the rest waits on the resource that holds the next tranche. Under the control and the two arms the rows now read, in vehicle-weeks: depot induction 290, 321 and 386; site power 20,106, 4,944 and 948; ports 0, 4,534 and 6,662. No measure of the declared test moved | Fleet intake test "each week the depot door stock is split: depot induction holds what a place was left for, the resource that holds the next tranche holds the rest", with `test/scale-intake.pins.json` |
| 6 | Floating point residue printed as a result, and a minutes-to-clear value of 17 digits | The notes and tables of the response reserve | A lever that removes nothing returns the no-lever value exactly, so its change is an exact 0. Minutes to clear read 0 on a day on which nothing waits at the end of the event. A value that would round to zero prints at two significant digits. Decision 25 | Response reserve tests "C1: a queue that is empty when the event ends clears in 0 min, and no early directive prints a long decimal" and "C2, C11: a directive that lands after the last moved request is answered reads the no-lever value itself". Shell test "contract 2: sided numbers keep their side, stay short and are asked for; the Scale lab asks" |
| 7 | A caption claimed that the rounded rows sum to the total | The caption of "The gate that binds" | The caption ends "The rows sum to the total before each is rounded to a whole vehicle-week." | Fleet intake test "the vehicle-weeks rows sum to the total before rounding, and as printed they stay within the number of rows of it, as the caption says" |
| 8 | No visible map credit. The inputs row that names the map sits in a closed disclosure, and a refused setup empties the inputs table | The density ladder page | `LAB.map` and `LAB.credit`. Outside every disclosure and in every state, the page shows the attribution link "© OpenStreetMap contributors", the licence name "ODbL" and the sentence "Road distances in this lab come from the frozen Fleet day road table. Distances only; no service in those places is described." Decision 23 | Shell test "C9: a lab that reads the road map shows the map credit on the page in every state, and a lab that does not shows none". Density ladder test "the lab says that it reads the Fleet day road map and carries its credit sentence, with the inputs row kept as the detail" |
| 9 | Side-preserving numbers of `953ebce` reached the card rows and the reading line of the four-area pages, and not their chart summaries, hidden summary or walkthrough chip, so one value could print two ways on one card | The four-area verdict card, near a threshold | The rule is opt-in. `metricValueText` and `valueWithMinutes` take `against`, which defaults to `null` and then gives the text of `c79eccf` byte for byte. `runLine` passes it only when `tools.sided`. Only the Scale lab opts in, so no page that existed before this wave prints different text. Decision 7 | Shell test "C8: pages that existed before the Scale lab print what they printed before it, on every surface", against `test/scale-lab.legacy-text.pins.json`, 900 pairs of number text and 19 verdict views, with the inputs in `test/helpers/legacy-text.mjs`. Shell test "contract 2" as in row 6 |

Of the nine, defect 2 is layout, which the suite cannot compute. The other eight are text, numbers and drawing
order that a test could have held and that no test held before `c08f60d`. Section 9.3 draws the lesson.

The same commit also holds smaller changes that answer minor findings. Each is described where it acts. This
document does not count how many of the 25 minor findings they answer.

| Change in `c08f60d` | Section |
|---|---|
| Next tests of a held press, a worse main result and an invalid run name only what the page offers. Every reading line fits 240 characters and keeps its interval | 7.6 |
| A lab change during a press ignores the old press. One progress meter per press, which only rises. The mark of a changed setup compares the setup on the page with the setup the result used. An error while a result is drawn reaches the alert region | 7.1, 7.2 |
| Category labels thin by the widest label, and labels that all fit are all drawn | 7.4 |
| Response reserve: the inputs row and the declared change of a directive name vehicle requests; an event load off its step of 0.01 is refused; the first note claims a direction only on a press that read improved; every number of the chart summary names its unit and fleet size; a chart drawn while the press computes carries a sentence of its own; the categories are short numbers | 4.2, 4.3, 4.4, 4.5, 4.6 |
| Fleet intake: the refusal counts weeks by number and has its own sentence for a pair that leaves no room; the note on the deliveries control says where the added waiting sits | 5.4, 5.7 |
| Density ladder: a load by hand keeps its side of capacity and of the ceiling; the ceiling is held by the hand load itself; each governing ratio prints at the decimals it holds; the inputs name the cohort of the prompt pickup guardrail; the rungs are named by number | 6.4, 6.5, 6.7 |

### 15.4 What the lead changed after the fix pass

The release record states that each of these four stands behind a test that failed first [R].

1. A test that read the history of the repository and wrote files to the system temporary folder was replaced by
   the pinned text test of defect 9. It reads committed pins and touches neither.
2. The second chart line got ring points, so that no two lines differ by ink alone.
3. The density ladder names its rungs by number, "24" to "120", under the head "Fleet size, cars", and a chart
   draws every label when they all fit.
4. The declared change of a directive now reads "every vehicle request moved into the event". The declared change
   is part of the frozen test, so the labels, the digests and the interval ends of the two pinned directive setups
   moved, to `scale-spec:16d331de` and `scale-spec:2f4598cb`. No mean moved. Section 4.5.

The labels of the default presses did not move: `scale-spec:b4c7f5da` (density ladder), `scale-spec:1aa8c833`
(fleet intake, first arm) and `scale-spec:443de567` (response reserve). The second arm of the fleet intake keeps
`scale-spec:a0b5e327`. Every lab keeps its version 1.0.0.

### 15.5 What the review could not see

| Limit | What follows |
|---|---|
| It ran as a stage of the same assisted workflow as the build | No independent human review has taken place |
| It read `c79eccf..319b4a9` | It did not read `c08f60d`, the commit of its own fixes. It did not read the teaching-frame wave under `c79eccf`, which the deployment also published |
| Every browser reading was taken with the pane hidden | No painted frame of this page has been seen at any stage, by the review or by the lead |
| No pane of 1440 by 900 px, no throttle, no physical phone, no screen reader, no Safari or Firefox | None of these was measured before or after the fixes |
| One lens on packaging and security | No security scan of the range was run |
| The suite runs on a stand-in for the browser that computes no layout | The suite holds defect 2 by its style rule only. Section 9.3 |
| A timing harness shapes its own reading | A harness that watched the whole page for changes made the fixed build look 4 to 8 times slower than the commit before it. A harness that watched only the status line showed no difference. The first reading was the harness, not the page |
| Scope of the checks after the fixes | The broad Python suite of the repository was not run. Only the two playground Python files ran, 89 tests. After the deployment two sweeps of the lesson links ran: the lead's sweep of all 59 lesson links and the 9 page routes in a real browser on the stable address with the pane hidden, so no frame was painted, and a sweep on the fake DOM with the modules downloaded from the live site. Both saw one Fleet day defect older than this wave, fixed in `1aeaace` and not deployed |

### 15.6 Known open items

1. Going back with the browser to a lesson address discards the recorded result and the edited setup. A lesson
   link means the same on Fleet day. The rule is in `src/ui/studio.js`.
2. A typed governing ratio of more than 12 decimals is echoed whole in the inputs table of the density ladder,
   because it is the reader's own input.
3. Where 12 decimals still read on a threshold, `sidedText` moves the last decimal one step toward the value's own
   side, so the printed number is off by less than 1e-12.
4. The event load control of the response reserve declares a step of 0.1 and accepts typed steps of 0.01.
5. The first table of the fleet intake, "One fleet, several counts", can print a row one off from the sum of its
   two parts after each is rounded. Its caption makes no sum claim.
6. Older pages still print a long raw number for a tiny value. That is the rule of the site, held by existing
   tests. Only the Scale lab prints two significant digits, decision 25.
7. `playground/fleetlab/README.md` carries facts older than this wave, among them the former address of the site
   and an older release line, and wording that predates this wave. They are left for the owner, because the
   repository is public.
8. The lesson snapshot that the teaching-frame wave keeps outside the tree still counts 56 lessons. It is to be
   declared again for 59, section 10.

---

## Recommendation

The package is built as revised, with all three labs, in seven local commits, and the nine defects that the
independent review confirmed are fixed in an eighth, `c08f60d`. On the owner's instruction `c08f60d` is deployed,
and its 98 public files read back equal to the local package. What remains is for the owner. Look at the three
labs in a visible browser at desktop and at phone size first, because no painted frame has been seen at any stage;
the previous Production is one rollback away. Grant the 7,548 bytes past the target: the package stays 2,692 bytes
under the hard stop, and the alternative takes back what the reviews asked for. Rule on the decisions of section
12. Every one of them is assumed at the lead's recommendation, not ratified. Decide on the push separately: the
deployed source is on no remote branch, and a push of `c08f60d` to `feat/fleetlab-playground` would be a
fast-forward. Treat `1aeaace`, the Fleet day fix made after the deployment, as its own small release on the owner's
word. Gates 1, 2 and 3 have passed. Gates 4 and 5 have run in part. Gate 6 has not run.

## Top risks + mitigations

| Risk | Mitigation |
|---|---|
| No person has seen the pages: no painted frame, no phone | The owner's look in a visible browser at desktop and phone size is the first next action. The previous Production, `dd4bfa44-7226-4502-9d66-01bb1790f2b6`, is one rollback away in the Pages dashboard |
| The deployed source is not public | The status line, section 0 and section 9.4 say so. The push is the owner's action, and it would be a fast-forward of `feat/fleetlab-playground` |
| The build source is lost at a restart | Closed by the build. The source is in eight local commits, and the deployed package reads back equal to what `c08f60d` builds. Nothing is pushed, so the source is in one local repository until the owner gives the word |
| A lab is read as a statement about a real operator, place or past event | Counts in a fictional market for two labs. Lab C says which input is real and that no fleet, depot or service in those places is described. No name of an operator on the page. Sources in documents only |
| A verdict that follows from a sizing rule is read as a finding | Every lab prints "Set by the inputs, not found by the run" directly under the verdict. Lab A prints the rates-only value of its main change |
| A page recommends advancing while a control has failed or a guardrail was never evaluated | Amendments 1 and 2, each with a test and a negative control. Both landed in `05113ab` |
| The deployment published the teaching-frame wave with the Scale lab | Done on the owner's instruction. Decision 15, assumed at the lead's recommendation, not ratified, records the scope, and the release record lists every commit the deployment published and its public effect |
| The build proceeded on decisions the owner has not seen | Every decision is marked as assumed at the lead's recommendation, not ratified. One commit per amendment group and per lab, and each row of section 12 names the hunks of `c08f60d` that go back with it |
| The package passes the target | Decision 3, assumed at the lead's recommendation, not ratified. 2,692 bytes stay under the hard stop. A later change of more than that needs a trim first or a new line from the owner. Trims are measured and ordered |
| A green suite missed nine defects | Section 15. 31 tests of `c08f60d` now hold them. The suite still sees no paint and no layout, so a browser check with a visible pane stays a separate gate |
| Phone timing is unmeasured. Lab C is estimated at 4 to 13 s per press on a slow phone, with 100 to 300 ms blocks [E] | A chart after every rung, Cancel, and a yield after every engine run. The 966 to 1,034 ms of the desktop pane [F] and the 1,044 ms on the hosted site [D] say nothing about a phone. The phone gate, gate 6, has not run |
| The 95 percent label overstates coverage at 10 to 12 seeds | The declared test says so before any run. No pin rests on an interval end near a margin |
| Some gates have no recorded result | On the final tree the full suite, the pack tests, the Python parity and boundary tests and `ruff` passed [F]. The staged checks belong to the commit of the documents. The browser check at 1440 by 900 px with painted frames and the tab order, and the phone gate, have no recorded result. The deployment went ahead before them on the owner's instruction, section 9.2 |
| A change to a Fleet day default changes Lab C | Lab C's first test compares its typed constants with the engine defaults and fails by name |
| Public facts go stale | Every row of section 2 carries its date. Every source was opened again on 2026-09-27. Rows 2 and 3 move fast and are true of their date only |

## Next 3 actions

1. The owner opens https://fleetlab.pages.dev/#/scale-lab in a visible browser at desktop and at phone size,
   presses Run on each lab, and rolls back to `dd4bfa44-7226-4502-9d66-01bb1790f2b6` if anything reads wrong. The
   lead then runs what is still open of gates 5 and 6: a pane of 1440 by 900 px with the tab order and painted
   frames, and the phone acceptance with 4 and 6 times throttling.
2. The owner rules on the decisions of section 12, first on decision 3, the bytes past the target, and on the
   push that decision 15 leaves open. Until then every decision stays assumed at the lead's recommendation, not
   ratified, and `claude/fleetlab-scale-lab` stays local.
3. On the owner's word, the lead deploys `1aeaace` from the documents commit on top of it, whose site inputs equal
   those of `1aeaace`, as its own small release: a full serial run whose only failures, if any, are timing tests
   that pass their one isolated rerun, both package checks, and a readback of every public file on both addresses,
   with `19e17ac6` as the rollback target. Nothing is pushed or deployed again without the owner's word.
