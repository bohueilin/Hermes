# FleetLab Scale lab: implementation plan and build record

Date: 2026-09-27. This file is the implementation plan of the Scale lab, kept as the record of how the build was
done. Its companion is the design for owner review, `docs/plans/2026-09-27-fleetlab-scale-lab-design.md`. Read
that first. The release record is `docs/FLEETLAB_SCALE_LAB_RELEASE_2026-09-27.md`.

Status at the time of writing. Eight local commits hold the wave: the shell, three amendments, three labs and the
fixes of an independent review, item R1. The last of them is `c08f60d`. On the owner's instruction of 2026-09-27
the site was built from `c08f60d` and deployed to Production of the Pages project `fleetlab` as deployment
`19e17ac6-d617-4789-9260-ca259c53e076`, item I3.11. After the deployment one more commit, `1aeaace`, landed on the
branch: a Fleet day fix outside this wave, found by two sweeps of the lesson links on the live site, one in a real
browser with the pane hidden and one on the fake DOM, and not deployed. The documents commit on top of `1aeaace`
holds this record and the other records of the wave; it changes no site input. Nothing was pushed: neither
`c08f60d`, nor `1aeaace`, nor the documents commit is on a remote branch. This record was first written at
`319b4a9`, the seventh commit, and was brought in line with `c08f60d` and the deployment afterwards. Numbers that
belong to `319b4a9` keep their commit name.

FleetLab is an independent, synthetic teaching simulator. It is not affiliated with any operator, vehicle maker,
regulator or utility. Every result is NOT_EVIDENCE, simulation only, decision authority NONE. Every input of the
three labs is a teaching assumption unless its source row says otherwise. The one sourced input is the road
distances of Lab C, which come from the shipped Fleet day road map.

The owner has not ratified any decision of the design. Wherever this record names a decision, that decision is
assumed at the lead's recommendation, not ratified.

Tags.

| Tag | Meaning |
|---|---|
| **[M]** | Measured during design on a working copy kept outside the repository (Node 22.22.0, one laptop) |
| **[W]** | Measured by the lead in the worktree, at the commit named |
| **[V]** | Measured in the worktree at `319b4a9` while this record was written, with the command shown (Node 22.22.0) |
| **[F]** | Measured on the files of `c08f60d`, or on a working tree whose Scale lab files equal them, while this record was brought in line, with the command shown (Node 22.22.0, one laptop, one run unless stated) |
| **[P]** | Measured by the lead against the public site after the deployment of `c08f60d` |
| **[S]** | Stated by the designer of a lab and held by that lab's pinned test |
| **[R]** | Read in source or in a commit message |
| **[E]** | Estimate |

The roles named in this plan (the lead, an engineer) are stages of one assisted workflow run for one owner. The
independent review of item R1 was run as separate stages of the same workflow. No independent human review has
taken place yet.

The working plan also held a table of locations on one machine and a first item that copied working files to a
durable place. Both concerned one machine only and are not part of this record. Every measurement that the working
plan kept in a working file is given here as a number, or as the committed test that holds it.

---

## 0. Where things are, and the rules of work

All file paths in work items are relative to `playground/fleetlab/` unless they start with `docs/` or name a root
file.

### 0.1 State of the worktree

| Fact | Value |
|---|---|
| Branch | `claude/fleetlab-scale-lab` |
| Last commit of the wave | `c08f60d8830df877fac2c7321bb47d75a5ae56ad`, "fix: resolve the findings of the independent Scale lab review" [R]. It is the deployed source |
| HEAD at the time of writing | `1aeaacecb25e17853f852d7bbd7141ff75d9cb69`, "fix: reset the Fleet day heading when a launch lesson opens" [R]. It changes `src/ui/studio.js` and `test/studio.test.mjs` only. Its message says the defect is older than the Scale lab, that it was found by a sweep of all 59 lesson links on the live site, and that the commit is not deployed. The offline package of `1aeaace` is 2,408,350 bytes, 27 more than `c08f60d` [F: `git archive 1aeaace`, packed outside the tree]. The documents commit on top of `1aeaace`, which holds this record, is now the branch head; a record cannot state the hash of the commit that holds it |
| Base | `c79eccf`, the commit the design stage started from. It is the head of the teaching-frame wave |
| Commits of this wave | 8, all local, listed in the table below. `git log c79eccf..c08f60d` shows them |
| Files changed from `c79eccf` to `c08f60d` | 29 files, 16,032 lines added and 67 removed, of which 13,275 lines are the four pins files [F: `git diff --shortstat` and `git diff --numstat`]. At `319b4a9` it was 27 files, 10,914 lines added and 47 removed, 8,888 of them in three pins files [V] |
| Status | The eight commits of the wave, `1aeaace` and the documents commit on top of `1aeaace` are made. The documents commit holds the documents of items I3.5 and I3.10 |
| Deployed | Yes, from `c08f60d`, on the owner's instruction of 2026-09-27. Deployment `19e17ac6-d617-4789-9260-ca259c53e076` is Production of the Pages project `fleetlab`, item I3.11 [P] |
| Pushed | No. No remote branch holds `c79eccf`, `c08f60d`, `1aeaace` or the documents commit on top of `1aeaace`. The local copy of the remote branch `feat/fleetlab-playground` stands at `790573e`, an ancestor of all four, so a push of `c08f60d` or of `1aeaace` to it would be a fast-forward. Nobody has authorized that push [F, read from the local copies of the remote branches, with no fetch] |
| Distance from `main` | `c79eccf` is 47 commits ahead of the local `main`, `319b4a9` 54, `c08f60d` 55 and `1aeaace` 56 [F: `git rev-list --count main..<commit>`] |
| Not in the eight commits | The README counts, the architecture section, the model notes, the design and this record, the release record, the handoff, the source of truth entry, and the corrected status paragraph of the deployment guide. They are in the documents commit on top of `1aeaace`, item I3.5. None of them is a site file, so that commit leaves the deployed site byte for byte as it is, and its site inputs equal those of `1aeaace` |
| What no commit before `319b4a9` may be used for | A release. From `2caeac6` to `1a81ae8` the route is open and at least one stub returns a valid verdict with a recommendation. `319b4a9` is the first commit that holds three real labs. `c08f60d` is the commit that was deployed |

The eight commits.

| Order | Commit | Item | Message |
|---|---|---|---|
| 1 | `2caeac6` | S1.1 to S1.6 | feat: add Scale lab shell with route, generic view and ladder chart |
| 2 | `05113ab` | S1.7a | feat: void a Scale lab press on a missing guardrail or a failed control |
| 3 | `953ebce` | S1.7b | feat: keep Scale lab readings on their side of a threshold and inside what the page offers |
| 4 | `9fdb160` | S1.7c | feat: put the Scale labs in the order of their story and say what follows from the inputs |
| 5 | `27f6014` | L-A, I3.1 | feat: add the response reserve lab |
| 6 | `1a81ae8` | L-B, I3.2 | feat: add the fleet intake lab |
| 7 | `319b4a9` | L-C, I3.3 | feat: add the density ladder lab |
| 8 | `c08f60d` | R1 | fix: resolve the findings of the independent Scale lab review |

The task text for this wave describes stage 1 as the shell with stub labs and stage 3 as registration. In the
worktree the stubs were registered when the shell landed, so registration was done at `2caeac6`. Stage 3 below
verifies it with the real labs and does the work that remained.

### 0.2 Rules of work

| Rule | Detail |
|---|---|
| Git | Work only on `claude/fleetlab-scale-lab` or a branch cut from it. Stage by explicit path. Never push, open a pull request, change a remote, force, reset hard, clean or rewrite history |
| Commits | Only after the gates of the item pass. Review `git status --short`, `git diff --cached --check` and `git diff --cached --stat` first. Run the staged privacy scan with the patterns of item I3.5. End the message with the attribution line the session states |
| Protected files | No edit to any existing file under `src/core`, `src/model`, `src/instrument`, `src/legacy`, `src/runtime`, `src/data`. Held: under those folders the diff from `c79eccf` to `319b4a9` holds only the four new `scale-` files of `src/model` [V], and so does the diff from `c79eccf` to `c08f60d` [F] |
| Existing tests | No edit after the shell. The pin edits landed in `2caeac6`. Held: from `2caeac6` to `319b4a9` the only test files that change are the four `scale-` test files and the three pins files [V]. From `2caeac6` to `c08f60d` they are the same files plus two new ones of item R1, `test/scale-lab.legacy-text.pins.json` and its helper `test/helpers/legacy-text.mjs` [F] |
| Tests first | For an amendment the test edits come first and fail for the right reason before the source edits land. The table of negative controls in item S1.7 says what each failure reads. For a lab, the test and the pins land in the same commit as the module: against a stub a lab test fails at import, which proves nothing |
| Bytes | Measure after every item with the packer writing outside the repository. Stop and report if a checkpoint is passed |
| Output outside the tree | The packer writes outside the repository. `test/packed.test.mjs` writes `dist/` inside the repository, which git ignores |
| Copy | D5 of the design binds every shipped string. Fictional markets and generic names only |
| Release | Not part of this plan as written. The plan held that nothing is deployed before gates 1 to 6 of the design have passed, and that push and deployment need the owner's explicit word, naming both waves that the branch carries. On 2026-09-27 the owner instructed the lead to finish, deploy, test and validate. That instruction covered the deployment of `c08f60d`, which published both waves, and named no push. Gates 5 and 6 had not passed when it was deployed, item I3.8 |

---

## 1. The lab contract, stated once

This is the contract every lab meets and the generic view relies on. It is the committed contract of `2caeac6`
with the clarifications and the code changes listed in section 1.9, and the additions of `c08f60d` listed in
section 1.10. All three lab modules at `c08f60d` conform to it: `test/scale-lab.test.mjs` passes 34 of 34 tests with
the performance flag, inside the full suite [W] and in a serial run of the four Scale test files [F]. At `319b4a9`
the same file held 22 tests and passed 22 of 22 [W].

### 1.1 Module

| Rule | Value |
|---|---|
| File | `src/model/scale-response.js`, `src/model/scale-intake.js`, `src/model/scale-density.js`. A second file `src/model/scale-<lab>-engine.js` is reserved in the list of modules scanned for copy and is not used by any lab |
| Imports | `../core/*` and `./*` only. Lab A: `keyed.js`, `scale-contract.js`. Lab B: the same. Lab C: `keyed.js`, `bay-area.js`, `bay-operations.js`, `scale-contract.js` |
| Page-only | Not reachable from `src/runtime/worker.js` |
| Top level | Declares only. Arithmetic on constants is allowed. No keyed draw, no run and no table build at import |
| Forbidden | A clock, `Math.random`, a timer, `window`, `document`, `globalThis`, a default export, a dynamic import |
| Exports | `LAB`, required and frozen. Test-only named exports are allowed. The registry imports `LAB` only |

### 1.2 `LAB`

```js
export const LAB = Object.freeze({
  id,          // 'response-reserve' | 'fleet-intake' | 'density-ladder'
  version,     // 'scale-response-1.0.0' | 'scale-intake-1.0.0' | 'scale-density-1.0.0'
  short,       // chooser label
  title,       // heading and catalog title
  geography,   // place text of the model identity line
  seeds,       // frozen array of 2 to 40 distinct whole numbers
  frame,       // [what_why, how, look_for, ops_takeaway, kind], kind 'decision' | 'condition'
  limits,      // one sentence
  unknowns,    // 3 to 6 sentences. One of them points to another lab
  controls,    // 1 to 4 control descriptors
  defaults,    // () => a fresh plain object with one value per control key
  derive,      // (config) => Derivation
  steps,       // function* (setup, seam) => yields Progress, returns Result
  map,         // optional, added in c08f60d: true for a lab that reads the Fleet day road map
  credit,      // optional, added in c08f60d: one sentence that says what the lab takes from the map
});
```

Map credit. When `map` is true the view shows, under the assumption sentence and in every state, a refused setup
among them: a link to the copyright page of OpenStreetMap that reads "© OpenStreetMap contributors", the licence
name ODbL, and the `credit` sentence. A lab with neither field shows no credit line. Only the density ladder sets
them: `map: true` and the credit "Road distances in this lab come from the frozen Fleet day road table. Distances
only; no service in those places is described." [F]. Shell test "C9" holds the rule.

Frame caps: `what_why` at most 160 characters, `how` at most 220, `look_for` plus `ops_takeaway` at most 240, and
the takeaway begins "An ops team would" followed by one of test, check, measure, compare, log, size, map, write,
give. No digit and no direction word in the third part. At most 130 words from the heading to Run on the mounted
view.

Control descriptor: `{key, label, unit, options: [[value, text], ...]}` for a select, or
`{key, label, unit, min, max, step}` for a number field. The view never clamps. The registry order is the chooser
order and the order of the story: density ladder, fleet intake, response reserve.

### 1.3 `derive(config)`

```js
Derivation =
  | { ok: true,
      setup,   // what steps() receives. setup.main is the frozen main test. Control tests sit under keys the lab names
      rows }   // [[label, Cell, source], ...] for the inputs table
  | { ok: false, reason }
```

| Rule | Value |
|---|---|
| Behaviour | Pure, cheap, never throws on any value a control can produce, nor on `null`, `undefined`, a string or a missing key. No engine call |
| `setup.main` | From `freezeScale`. `spec.control` is `null`. `spec.seeds` equals `LAB.seeds`. `spec.lab` equals `LAB.id`. `spec.model_version` equals `LAB.version`. At least one guardrail |
| `rows` | At least two. Each source begins with `You choose`, `Teaching assumption`, `Sizing rule`, `Governing ratio` or `Fleet day map`. At least one row is a governing ratio, and the quantity in it is the quantity that the refusal tests. Setup arithmetic and declarations only, never an outcome |
| `reason` | A clause of 11 to 192 characters. It names an input by its label. It holds no `undefined`, `NaN`, `null` or underscore, no banned word, no verdict word and no direction word |
| Printed refusal | `Not available: outside what this lab can read: <reason>.` It is at most 240 characters |

### 1.4 `steps(setup, seam)`

A synchronous generator. The view calls it with one argument. The second parameter is a test seam and is optional.

```js
Progress = undefined | { done, total, label, partial }
  // label: a short phase name that starts with a capital
  // partial: { chart: ChartData }, optional. The view paints it at once

Result = {
  format: 'fleetlab-scale-lab', format_version: 1,
  lab, version,
  evidence_status: 'NOT_EVIDENCE', decision_authority: 'NONE',
  spec, digest, label,             // label is 'scale-spec:' plus the first 8 hex characters of the digest
  replications, per_seed,          // per_seed: [{seed, baseline: {name: value}, candidate: {name: value}}]
  validity, reason,                // 'VALID' | 'INVALID_EXPERIMENT'
  analysis,                        // the exact return value of pairedMetricSteps, or null
  descriptive,                     // true when there is one seed
  controls,                        // at least one. Each is a Result with a title. One has spec.control 'null'
  chart,                           // ChartData, optional
  tables,                          // [{caption, heads: [text], rows: [[Cell]]}], optional. A caption that carries a law opens with its topic
  notes,                           // [Text]: which results follow from the inputs. Printed under the verdict
  work                             // {engine_runs}: required for a lab that calls the Fleet day engine, at most 120
}
```

| Rule | Value |
|---|---|
| Control names | `spec.control` is `null` for the main test and one of `'null'`, `'non-binding'`, `'guardrail'` for a shipped control |
| Control result | A Result plus `title`, which carries the declared reading in words. `as_declared`, a boolean, is set by the lab on every control whose declared reading is more than an exact zero |
| When controls run | Every shipped control runs in every press. The order inside a press is the lab's |
| Yields | No gap between two yields passes 8 ms on the reference laptop for labs A and B. Lab C yields after every engine run, and one engine run is one block |
| Size | The result as JSON is at most 65,536 characters |

### 1.5 A press that cannot be read

A press never gives a valid record when a check failed. It ends in one of three ways.

| Way | Shape | Used by |
|---|---|---|
| Invalid result from the lab or the contract | `validity: 'INVALID_EXPERIMENT'`, `reason` a sentence fragment, `analysis` `null` or the instrument's invalid object, and none of `controls`, `chart`, `tables`, `notes`. `work` may stay | The shared contract (replay mismatch, absent primary, missing guardrail). Lab A (a broken invariant of a simulated day). Lab C (soundness, pairing, availability) |
| A failed control | The view passes every result through `readable` of the shared contract before it records it. A shipped control has failed when its validity is not `VALID`, when it is marked `as_declared: false`, or when it is a null control and any paired difference of the primary or of a guardrail is other than 0. The record then reads as the row above, with the reason `the <first words of the control title> did not read as declared, so there is no comparison` | Every lab, through the shell |
| Throw | A `RangeError` whose message is a sentence. The view prints "The lab could not run: message", records nothing and keeps the previous result | Lab B, when an exactness check of a control or an invariant fails while runs are in progress, so that no later arm is simulated |

The page prints an invalid record through the existing reading line: "Invalid run: reason. No result can be
read." Its status reads "Recorded as invalid. This press has no reading."

### 1.6 Values

```js
Cell = string | number | { v, d, u } | { absent: reason }
  // {v, d, u}: value, decimals 0 to 6, unit words. A nonzero value never reads as zero
  // since c08f60d the view prints a number cell through sidedText (section 1.10): a value that would
  // round to zero at its decimals prints at two significant digits, never as its raw double
  // anything else reads 'not available: no recorded value'
Text = string | { t: 'template with {slots}', v: { slot: Cell } }
ChartData = { title, category, axis: { d, u }, categories, series, summary, seed }
  // series: 1 to 3 of {id, label, mark: 'bar' | 'line', values}; a value is a finite number or {absent: reason}
  // seed present: a one-seed picture. seed absent: a picture across the paired seeds
```

A lab cannot import `src/ui`, so it returns numbers with a unit hint and the view formats them.

### 1.7 Metric names

A metric name is a display phrase and the instrument key at once. It matches `^[a-z][a-z0-9 ,-]*$`. It does not
end in `_s`. A share between 0 and 1 holds the word `fraction`. It holds no verdict word and no direction word.

### 1.8 The shared paired contract, `src/model/scale-contract.js`

```js
freezeScale({ lab, version, change, baseline, candidate, seeds, primary, guardrails = [],
              descriptives = [], resamples = 2000, control = null })
  -> Object.freeze({ spec, digest, label })
scalePairSteps(frozen, measure, label = 'Paired runs')
  -> generator, yields Progress, returns Result without chart, tables, notes and controls
scaleJson(value) -> canonical JSON: sorted keys, finite numbers only
readable(result) -> the result itself, or an invalid copy of it when a shipped control has failed
```

| Behaviour | Value |
|---|---|
| Replay | The first seed's baseline arm runs twice. A difference gives `REPLICATION_MISMATCH` from the instrument |
| Absent value | A value that is not a finite number is left out of the map, never written as zero |
| Absent primary | The instrument reads `NOT_COMPARABLE` |
| Missing guardrail | The result is `INVALID_EXPERIMENT` with the reason `a required measure was not available in a run, so there is no comparison` and `analysis: null`. The instrument is not called |
| Failed control | Section 1.5, second row. `readable` returns the same object when every control read as declared, so a test can compare by identity |
| Digest | Checked again when the run starts. A changed spec throws |

### 1.9 Differences resolved

Every ruling of this table that rests on a decision of the design is
assumed at the lead's recommendation, not ratified.

| # | Shell text or code | Lab descriptor | Ruling | Code change |
|---|---|---|---|---|
| 1 | "exports one frozen constant named LAB" | Lab A also exports `FLEETS`, `RULE`, `closedForm`, `leanPool`, `rates`, `leverRates`, `buildTape`, `applyEvent`, `simulateDay`, `deriveResponse`. Lab B also exports `INTERNALS` | Section 1.1, last row | none |
| 2 | `steps(setup)` | Lab A `steps(setup, engine)`, Lab B `steps(setup, hooks)`, Lab C `steps(setup, simulate)` | Section 1.4, first paragraph | none |
| 3 | `control` is `null`, `'null'` or `'non-binding'` | Lab A's third control is `'guardrail'` | Section 1.4, control names | a shell test, no package bytes |
| 4 | A control result is a Result with `title` | Lab A adds `as_declared`. Lab C now adds it to its non-binding control | Section 1.4, control result | Lab C |
| 5 | The import table lists `keyed.js`, `scale-contract.js` and, for Lab C, `bay-operations.js` | Lab C also imports `bay-area.js` for the hand rule | Section 1.1, imports | none |
| 6 | The shell left open when controls run | Lab C runs both controls in every press | Section 1.4, when controls run | none |
| 7 | A missing guardrail reads `NOT_EVALUABLE` and the result stays valid. Measured: VALID, IMPROVED, ADVANCE_TO_NEXT_TEST | Lab C checks availability itself. Lab A leaves the late fraction out of a day with no call. Lab B's measures always exist | Section 1.8, missing guardrail. Lab C's own check stays and is a second line of defence | `scale-contract.js` |
| 8 | A failed check: the shell names a throw and an invalid instrument verdict | Lab A hands the instrument empty maps and replaces the reason. Lab B throws. Lab C returns an invalid record with `analysis: null` | Section 1.5. All three are kept as built | none |
| 9 | A failed control | Lab A marked the control and kept a valid main result. Lab C did not check its controls at run time. Lab B threw | Section 1.5, second row. One rule in the shell | `scale-contract.js`, `scale-lab.js` |
| 10 | "This setup is outside what the lab can read: reason." with no cap | Lab A's longest reason is 192 characters and Lab B's 186, 184 since `c08f60d` | Section 1.3: the absence form, a reason of at most 192 characters, a printed refusal of at most 240 | `scale-lab.js` |
| 11 | The reading line and the verdict readout print a value at fixed decimals | Labs B and C measured "+13.0" beside an allowance of 13 with REGRESSED, and "+0.020" beside a margin of 0.02 | A number is printed with the fewest decimals, up to 6, that keep it on its true side of its threshold, then as the exact double. The reading line passes its own margin, on every page. Revised in `c08f60d`: the rule is opt-in and only the Scale lab opts in; it gains decimals up to 12 and never prints the raw double. Section 1.10 | `experiment.js`, `teaching-frames.js` |
| 12 | The next-test sentences name "another rider draw", "cars riders needed", another seed set and more paired seeds | Labs A and B have no rider and no car. Every lab holds its seeds fixed | The view passes its own sentences through three optional tools: `next`, `more` and `undecided`. In `c08f60d` the view also gives its own sentences for a guardrail past its allowance, for a primary that is not read and for an invalid press, and `more` becomes "No direction is read." | `teaching-frames.js`, `experiment.js`, `scale-lab.js` |
| 13 | The shell says nothing about interval coverage | Labs A and C said on the page that the label is nominal. Lab B did not | The declared test says it once for every lab. Labs A and C no longer repeat it | `scale-lab.js`, labs A and C |
| 14 | Catalog article "from one ratio"; glossary "the one ratio of load to capacity"; Overview "support desk"; glossary "share the same riders" | Lab C has two governing ratios. Lab B's is a lag over an interval. Lab A says pool. Labs A and B have no riders | Four copy corrections, item S1.7c | three interface files |
| 15 | The shell planned a test that every press of Lab C reports at most 120 engine runs | Lab C reports `work.engine_runs` and counts engine calls from outside in its own test | The shell test asserts the reported count. Lab C's test asserts the counted calls, the 8-hour duration and `capture: false` | a shell test, item I3.3 |
| 16 | D8: keyed draws | Lab A takes one keyed draw per simulated minute and expands it with a local stream | Decision 4 of the design, assumed at the lead's recommendation, not ratified | none |
| 17 | The lab id is the key prefix of keyed draws in labs A and C | Lab B keys its draws with `'scale-intake'`, not its id | Kept. A change would move every pin of Lab B | none |
| 18 | Every input row carries one of four source prefixes | Lab C takes its road distances from the shipped map | A fifth prefix, `Fleet day map` | a shell test, Lab C |
| 19 | The registry order was A, B, C | The story runs C, B, A | Section 1.2. The order of landing stays A, B, C, so that Lab C is the last to land and the first to be cut | `scale-labs.js`, the catalog, the Overview |

Requests declined for this wave: a shared helper for invalid results; an invariant callback in `scalePairSteps`; a
three-digit fallback in the shared number formatter; the stale mark naming the changed control; backlog and
longest wait at the landing minute in Lab A; the three options of decision 21 of the design. Each of these is
assumed at the lead's recommendation, not ratified.

### 1.10 Reading tools added in `c08f60d`

Item R1 added these to the contract. Each is assumed at the lead's recommendation, not ratified. Read in source at
`c08f60d` [R].

| Name | File | Rule |
|---|---|---|
| `sidedText(value, digits, {withSign, against})` | `src/ui/experiment.js`, exported | The text of a number read against the thresholds in `against`. It gains one decimal at a time while the text would read as equal to, or across, a threshold that the value is not equal to or across. A value that would round to zero at `digits` starts at two significant digits. At most 12 decimals, thousands grouped, never the raw double. Where 12 decimals still read on or across a threshold, the last decimal moves one step toward the value's own side, so the text is off by less than 1e-12 |
| `against` of `metricValueText` and `valueWithMinutes` | `src/ui/experiment.js` | Defaults to `null`, which gives the text of `c79eccf` byte for byte. An array of thresholds opts in to `sidedText`. `valueWithMinutes` sides its minutes against the thresholds divided by 60 |
| `plotted` of `renderVerdictReadout` | `src/ui/experiment.js` | Defaults to `true`, the readout of before. With `plotted: false` the page draws no strip: the caption names the measure and its declared direction only, the visible outcome sentence states the interval as printed, the primary numbers are sided against the margin on both sides, and guardrail harms are sided against their allowances |
| `tools.sided` of `runLine` | `src/ui/teaching-frames.js` | When true, the value of the primary is sided against `[-margin, margin]`, and a line over 240 characters drops its guardrail sentence before it drops its interval. Without it `runLine` passes no threshold, as at `c79eccf` |
| `LAB.map`, `LAB.credit` | the lab module | Section 1.2, map credit |
| The Scale lab view | `src/ui/scale-lab.js` | Its reading tools carry `sided: true`. It calls `renderVerdictReadout(view, {plotted: false})`. Its cells print through `sidedText`. It is the only page that opts in |

Held by shell tests "C8" (every page that existed before the Scale lab prints what it printed before, on every
surface, against 900 pinned pairs of number text and 19 pinned verdict views in
`test/scale-lab.legacy-text.pins.json`, whose inputs are in `test/helpers/legacy-text.mjs`) and "contract 2"
(sided numbers keep their side, stay short and are asked for; the Scale lab asks) [R].

---

## 2. Stage 0: decisions, and how the build proceeded without them

The owner asked for this run to finish. No message of the workflow is the owner's consent. The build proceeded to
local commits on the lead's recommendations. Every decision of section 12 of the design is recorded in the design
as **assumed at the lead's recommendation, not ratified**, and the table below repeats that state for the
decisions that a commit holds. The handoff and the source of truth entry record it in the same words. Both are
in the documents commit on top of `1aeaace`, items I3.5 and I3.10. The owner has ruled on none of the
decisions at the time of writing. The owner's instruction of 2026-09-27 to finish, deploy, test and validate led to
the deployment of item I3.11. It is not a ruling on any decision of the table.

| Decision of the design | State | Held by commit | Undone by |
|---|---|---|---|
| 1. The shell as committed | Assumed at the lead's recommendation, not ratified | `2caeac6` | A revert commit of `2caeac6`, or a new branch cut from `c79eccf`. Never a hard reset |
| 2. Lesson count 56 to 59 | Assumed at the lead's recommendation, not ratified | `2caeac6`, and the documents commit | With decision 1 |
| 3. Bytes past the target | Assumed at the lead's recommendation, not ratified | Every commit. The growth stood at 85,046 bytes at `319b4a9` and stands at 89,468 bytes at `c08f60d`, 7,548 past the target | The trims of section 8 of the design, in order |
| 4. The reading of D8 for Lab A | Assumed at the lead's recommendation, not ratified | `27f6014` | Lab A redrawn through the cached prefix hasher, pins recorded again |
| 5 and 17. Missing guardrail, failed control | Assumed at the lead's recommendation, not ratified | `05113ab` | A revert of `05113ab` |
| 6, 7, 8, 9. Refusal form, side-preserving numbers, next tests, interval sentence | Assumed at the lead's recommendation, not ratified | `953ebce`. Side-preserving numbers and the next-test sentences revised by `c08f60d`, sections 1.9 and 1.10 | A revert of `953ebce` and of the matching parts of `c08f60d`, or the named strings |
| 10, 18, 19. Copy corrections, page structure, story order | Assumed at the lead's recommendation, not ratified | `9fdb160` | A revert of `9fdb160`, or the named strings |
| 11. Lab A | Assumed at the lead's recommendation, not ratified | `27f6014` | A revert of that commit |
| 12. Lab B | Assumed at the lead's recommendation, not ratified | `1a81ae8` | A revert of that commit |
| 13. Lab C | Assumed at the lead's recommendation, not ratified | `319b4a9` | A revert of that commit |
| 14. Repository documents | Assumed at the lead's recommendation, not ratified | The documents commit on top of `1aeaace` | A revert commit of the documents commit |
| 15. Push and deployment | Assumed at the lead's recommendation, not ratified. Deployment: done on the owner's instruction of 2026-09-27, which named no push. Push: not done, not authorized | Deployment `19e17ac6`, source `c08f60d`. No push | A rollback to deployment `dd4bfa44`, source `b99ab04`, in the Pages dashboard, the owner's action. It rewrites no history |
| 20. The map project named in the road table row | Assumed at the lead's recommendation, not ratified | `319b4a9`, and the credit line of `c08f60d` | One string of Lab C and its test line, and `LAB.map` and `LAB.credit` |
| No number. The fixes of the independent review and the lead's four follow-up changes, item R1 | Assumed at the lead's recommendation, not ratified | `c08f60d` | A revert of `c08f60d`, which brings the nine defects of item R1 back |

A revert of `05113ab` or `953ebce` after a lab has landed needs the shell test rerun, because later tests rest on
those rules. Since `c08f60d`, the reverse patch of every earlier commit of this wave no longer applies cleanly to the
tree, and the reverse patch of `c08f60d` does [F: `git show <commit> | git apply -R --check`, which changes
nothing]. So a revert of any commit before `c08f60d` may need a merge by hand, and the four Scale test files are
rerun after it. No revert was tried.

---

## 3. Stage 1: the shell with stub labs. One engineer

Items S1.1 to S1.6 landed in `2caeac6` as one commit. They are listed so that the record is complete and each can
be verified. Their byte lines are the measured module sizes of that commit [M], summed in the order of the items. A
module counts in the package only once the page imports it, which happens at S1.4, so the first packer reading that
means anything is the checkpoint of S1.5. Items S1.7a, S1.7b and S1.7c landed after it as three commits.

### S1.1 Route, shared contract, stubs, registry. Landed in `2caeac6`

| Field | Content |
|---|---|
| State | Landed in `2caeac6` |
| Files | `src/ui/routes.js` (edit, one line after line 10: `scale:{path:'scale-lab',title:'Scale lab'},`). New: `src/model/scale-contract.js`, `src/model/scale-response.js`, `src/model/scale-intake.js`, `src/model/scale-density.js` (stubs), `src/ui/scale-labs.js` |
| Interface | Section 1.8. `SCALE_LABS` is a frozen array of the three descriptors in chooser order |
| Tests first | `test/scale-lab.test.mjs` tests 1 to 4 and 16: contract, refusals, reproducibility and provenance, fail-closed contract, page-only modules |
| Acceptance | Each stub satisfied the contract at `2caeac6` [R: the commit message]. `test/boundaries.test.mjs` 19 of 19 [V at `319b4a9`] |
| Bytes | routes +46; contract 3,920; stubs 5,601, 4,723 and 4,563; registry 392. Running sum +19,245 |

### S1.2 Ladder chart. Landed in `2caeac6`

| Field | Content |
|---|---|
| State | Landed in `2caeac6` |
| Files | `src/ui/charts.js` (edit: one line in `limitsChip`, and the ladder section with the public wrapper `ladderChart`) |
| Interface | `ladderChart(options)` returns `{node, chartId, setCursor, showTable}`. Options: `chartId`, `title`, `chips`, `summary`, `limits`, `axisUnit`, `categoryLabel`, `gapLabel`, `categories` (2 to 60), `series` (1 to 3 of `{id, label, mark, values}`), `text`, `tick` |
| Tests first | Shell test 14 |
| Acceptance | `test/charts.test.mjs` 45 of 45, unedited [V at `319b4a9`] |
| Bytes | +4,318. Running sum +23,563 |

### S1.3 Generic view and styles. Landed in `2caeac6`

| Field | Content |
|---|---|
| State | Landed in `2caeac6` |
| Files | New: `src/ui/scale-lab.js`. Edit: `styles.css` (six `scale-` classes, two header lines, two grid rules) |
| Interface | `createScaleLab({labs = SCALE_LABS, hrefFor, onLab})` returns `{element, heading, run, cancel, setLesson, pause, getState, destroy}`. Exports `yieldToPage`, `cellText`, `fillText` |
| Tests first | Shell tests 5 to 12 and 15 |
| Acceptance | `test/a11y.test.mjs` 45 tests, 44 pass, 1 existing todo [V at `319b4a9`] |
| Bytes | view 11,531; styles +1,651. Running sum +36,745 |

### S1.4 Wiring, grounding and pins. Landed in `2caeac6`

| Field | Content |
|---|---|
| State | Landed in `2caeac6` |
| Files | Edit: `src/ui/teaching-frames.js`, `src/ui/simulation-catalog.js`, `src/ui/studio.js`, `test/teaching-frames.grounding.json`, and the pin edits in `test/navigation.test.mjs`, `test/simulation-catalog.test.mjs`, `test/teaching-frames.test.mjs`, `test/studio.test.mjs`, `test/copy-surfaces.test.mjs` |
| Interface | Frames reach `LESSON_FRAMES` as `[8, 3, 2, ...LAB.frame]`. Catalog records carry `target: 'scale'`. `lessonPage` gains the `scale` branch first, in six places |
| Tests first | The pin edits, then shell test 13 |
| Acceptance | navigation 4 of 4, studio 8 of 8, teaching-frames 10 of 10, copy-surfaces 7 of 7, simulation-catalog 4 of 4, d1-presentation 4 of 4 [V at `319b4a9`] |
| Bytes | frames +442; catalog +489; studio +1,086. Running sum +38,762 |

### S1.5 Packaging. Landed in `2caeac6`

| Field | Content |
|---|---|
| State | Landed in `2caeac6` |
| Files | `tools/check-dist.mjs` line 41: nine names added to the list of modules scanned for copy |
| Tests first | Shell test 16, second half: every `scale-` module reachable from the page is in that list |
| Acceptance | Both packages build. Both checks report 0 problems |
| Byte checkpoint | **2,357,617 bytes, growth +38,762** [M] [W] |

### S1.6 Gates and browser check of the shell. Landed in `2caeac6`

| Field | Content |
|---|---|
| State | Landed in `2caeac6` |
| Recorded | Full serial suite 1,892 tests, 1,891 pass, 1 existing todo. Python parity 89 pass. Both stand in the commit message of `2caeac6` [R] |
| Browser, prototype | Desktop 1440 by 900 px: Run at y 679 px. Phone 375 by 812 px: Run in a bar from y 710 to 812 px, no sideways overflow [M]. These were stub frames in a pane that was not visible |
| Repeated | In stage 3 with the final frames, item I3.8 |

### S1.7 Amendments. Landed as three commits, in this order, before any lab

Each amendment is one commit. No amendment commit changes a lab file [R: the file lists of `05113ab`, `953ebce`
and `9fdb160`]. At design the same three changes, then the labs, then the run budget test of item I3.3 were
applied in this order to a copy of `2caeac6` [M]. At `319b4a9` the 17 files of section 4 were byte for byte the
files that were measured at design, by SHA-256 [V]. `c08f60d` changed 13 of them, item R1. Section 4 gives the
digests at `c08f60d`.

| Item | Commit | Byte checkpoint |
|---|---|---|
| S1.7a Contract rules | `05113ab` | 2,358,553 bytes |
| S1.7b Reading rules | `953ebce` | 2,359,746 bytes |
| S1.7c Copy, order and structure | `9fdb160` | 2,360,022 bytes |

Common acceptance after each of the three changes.

| Check | Expected | Measured |
|---|---|---|
| `node --test test/boundaries.test.mjs test/teaching-frames.test.mjs test/copy-surfaces.test.mjs test/experiment-ui.test.mjs test/labels.test.mjs` | 242 of 242 | 242 of 242 on the stubs after each change [M]. 242 of 242 at `319b4a9` [V] |
| `node --test test/summary.test.mjs test/charts.test.mjs test/present.test.mjs test/app.test.mjs test/studio.test.mjs test/navigation.test.mjs test/simulation-catalog.test.mjs test/packed-parity.test.mjs test/a11y.test.mjs test/d1-presentation.test.mjs` | 212 tests, 211 pass, the 1 existing todo of a11y | The same on the stubs after each change [M]. The same at `319b4a9` [V] |
| The package check on a package built outside the tree | 0 problems | 0 problems after each change [M]. 0 problems at `319b4a9` [W] [V] |

The record of the worktree holds the byte checkpoint of each commit and the full suite at `319b4a9`. It holds no
separate run of the two test commands above in the worktree after each amendment commit.

Negative controls. Six new assertions were each checked at design by taking out the code they guard [M]. The
tests are numbered in the order of `test/scale-lab.test.mjs`.

| What was taken out | Test that failed | First message of the failure |
|---|---|---|
| The view records the press without the control rule | Shell test 17 | Cannot read properties of undefined (reading 'validity') |
| A null control is read by its outcome only | Shell test 17 | null control |
| The notes go back under the tables | Shell test 8 | density-ladder: what follows from the inputs is read under the verdict, before the chart and the tables |
| The next test names a seed set again | Shell test 8 | density-ladder: the next test is one this page can honour |
| The reading line loses its margin | Shell test 18 | the printed bound 3 stays inside the margin 3 |
| The source prefix of the road table is not allowed | Shell test 1 | density-ladder Road distances names its source |

#### S1.7a Contract rules. Landed in `05113ab`

| Part | File | Change |
|---|---|---|
| a | `src/model/scale-contract.js` | After `if(out.descriptive)return out;`: when the replay matched and the primary is present in every map, and a declared guardrail is missing from any baseline or candidate map, set `validity` to `INVALID_EXPERIMENT`, set `reason` to `a required measure was not available in a run, so there is no comparison`, and return with `analysis: null` |
| b | `src/model/scale-contract.js` | New export `readable(result)`, section 1.5 |
| c | `src/ui/scale-lab.js` | The view imports `readable`, records `readable(r)` and returns the record. The idle status of an invalid record reads "Recorded as invalid. This press has no reading." |

| Field | Content |
|---|---|
| State | Landed in `05113ab` |
| Tests first, in `test/scale-lab.test.mjs` | Edit test 4: the missing-guardrail case asserts `INVALID_EXPERIMENT`, `analysis` equal to `null`, and the reason. New test 17, "a shipped control that does not read as declared voids the press: no verdict, no recommendation, and the reason names the control": every lab's default press passes through `readable` unchanged; a press built on the shared contract alone is voided by a null control bent by a billionth in one guardrail, by a control marked `as_declared: false` and by an invalid control; on the page a voided press shows no verdict readout, no chart, no controls and the invalid status |
| Negative controls | With part c removed, and with the null rule of part b removed, test 17 fails [M] |
| Acceptance | Shell test 17 of 17 on the stubs [M] |
| Byte checkpoint | **2,358,553 bytes, growth +39,698** [M] [W] |
| Record of the missing guardrail | Shell test 4 holds the case of a guardrail that is absent from every run. At design three cases were measured, each `INVALID_EXPERIMENT` with no outcome and no recommendation: a guardrail missing in every run, missing in one candidate run, and `null` in one run [M] |
| Commit | `05113ab`, `feat: void a Scale lab press on a missing guardrail or a failed control` |

#### S1.7b Reading rules. Landed in `953ebce`

| Part | File | Change |
|---|---|---|
| a | `src/ui/experiment.js` | `metricValueText` and `valueWithMinutes` take an optional `against`, a list of thresholds. The text gains one decimal at a time, up to 6, while it would sit on or across a threshold that the value does not, then falls back to the exact double. `primaryRows` passes the margin on both sides. `guardrailSection` passes the allowance. With no threshold the text is unchanged. The reason under a result that is not decided is `view.undecided` when the view hands one in. Revised in `c08f60d`: as landed, parts a and b changed the four-area card on every page but reached only some of its surfaces, not the chart summaries or the walkthrough chip, so one value could print two ways. The rule is now opt-in, section 1.10 |
| b | `src/ui/teaching-frames.js` | In `runLine`: the value of the primary passes `against: [-margin, margin]` when the margin is greater than zero; the next-test sentences come from `tools.next` when given; the sentence of a result that is not decided comes from `tools.more` when given. Revised in `c08f60d`: the margin is passed only when `tools.sided` is true |
| c | `src/ui/scale-lab.js` | The refusal sentence becomes `Not available: outside what this lab can read: <reason>.` The seeds line of the declared test gains `The 95% interval is a bootstrap label, nominal at this seed count.` The view builds its reading with `resultView(frame, pairedProjection(r), TOOLS)`, where `TOOLS` is the site's teaching tools plus `next` and `more`. Control lines use the same tools. The verdict view carries `undecided` |

Exact strings.

| Place | Text |
|---|---|
| Next test, improved | Move one input toward the edge of its range and run again, then read the measures no guardrail covered. |
| Next test, within the margin | Check whether this change reached the limit that binds, then test the one that does. |
| Next test, not decided | Test a larger step of the same setting. This page holds its paired seeds fixed. |
| Reading line, not decided | The interval crosses the margin at these paired seeds, so no direction is read. Shortened in `c08f60d` to "No direction is read." so that a reading line fits 240 characters with its interval |
| Verdict card, reason, not decided | the interval crosses the margin; test a larger step, as this page holds its paired seeds fixed |

| Field | Content |
|---|---|
| State | Landed in `953ebce` |
| Tests first, in `test/scale-lab.test.mjs` | Edit test 12: the alert begins `Not available: outside what this lab can read: `. One line in test 8: the reading names no seed set, no added seeds and no rider. New test 18, whose title begins "a number never reads as equal to, or across, the threshold": a table of seven values through `metricValueText`; a fake lab whose change sits 0.002 inside the margin, whose printed bound must stay inside the margin; a fake lab whose interval crosses the margin, whose page must hold the two sentences above and no seed that the reader cannot add. New test 19, "every refusal a reader can reach or type prints in the absence form inside 240 characters". New test 20, "the declared test says before any run that the interval label is nominal at its seed count" |
| Negative controls | With the margin taken out of part b, test 18 fails with "the printed bound 3 stays inside the margin 3". With the old next test put back, test 8 fails [M] |
| Acceptance | Shell test 20 of 20 on the stubs [M]. A four-area result with an interval end of 0.02004 against a margin of 0.02 prints "+0.02004" in the reading line and in the card [M]. Shell test 18 holds the same value, 0.02004 against 0.02, in its table. Since `c08f60d` the four-area card prints the text of `c79eccf` again, and the value 0.02004 against 0.02 prints "+0.02004" only where a page opts in; shell tests 18 and "contract 2" hold it [R] |
| Byte checkpoint | **2,359,746 bytes, growth +40,891** [M] [W] |
| Commit | `953ebce`, `feat: keep Scale lab readings on their side of a threshold and inside what the page offers` |

#### S1.7c Copy, order and page structure. Landed in `9fdb160`

| Part | File | Change |
|---|---|---|
| a | `src/ui/scale-labs.js` | The registry order becomes density ladder, fleet intake, response reserve |
| b | `src/ui/simulation-catalog.js` | The last sentence of the article. "Start here" links to the density ladder |
| c | `src/ui/studio.js` | The Overview card and the scope sentence name the labs in the order of the story, with "support pool" |
| d | `src/ui/teaching-frames.js` | Two glossary entries: governing ratio, paired seeds |
| e | `src/ui/scale-lab.js` | The thesis line above the chooser. The assumption sentence. The chart limits sentence. The caption of the inputs table. The identity disclosure titled "Model and version". The section "Set by the inputs, not found by the run" moves from under the tables to under the verdict readout |

Exact strings.

| Place | Text |
|---|---|
| Thesis line | Three labs, one question: which capacity meets its load first as a fleet scales, and how early the fix has to start. |
| Assumption sentence | Every input on this page is a teaching assumption unless its source row says otherwise. No value is a measurement of any fleet. |
| Chart limits, second sentence | The shape is a property of this model and its assumed inputs. |
| Caption of the inputs table | Inputs and where each comes from. A sizing rule works on teaching assumptions |
| Catalog article, last sentence | Each derives its setup from its governing ratios and ends in a paired test with guardrails. |
| Glossary, governing ratio (155 characters) | Governing ratio: load over capacity, or a lag over the interval between arrivals, that decides whether a mechanism shows. The lab derives the other inputs. |
| Glossary, paired seeds (150 characters) | Paired seeds: both runs share the same random draws, and the same riders where a model has riders, so a difference comes from the one changed setting. |
| Overview card | Three labs on scaling a fleet: density and the depot limit at rungs of fleet and demand, the path from delivered vehicles to rider service, and a support pool under an area-wide event. |
| Overview scope sentence | Scale lab covers density at rungs, fleet intake and a support pool. |

| Field | Content |
|---|---|
| State | Landed in `9fdb160` |
| Tests first, in `test/scale-lab.test.mjs` | The source prefixes of test 1 gain `Fleet day map`. Test 7 asserts the assumption sentence, the caption, that no disclosure is titled "Exact values" before a run, and that the thesis line sits above the heading. Test 8 asserts that the section "Set by the inputs" sits between the verdict readout and the chart. Test 12 takes the first lab that has a number field. Test 13 expects the "Start here" link of the density ladder. New flagged test 21, "the packed page presses Run for every lab and records what the native module records" |
| Negative controls | With the notes back under the tables, test 8 fails. With another prefix on the road table row, test 1 fails once Lab C has landed [M] |
| Acceptance | Shell test 21: 20 pass and 1 skipped without the flag, 21 of 21 with it, on the stubs [M]. No existing test pins the order of the labs: the registration tests of item I3.4 pass unedited [M] [V] |
| Byte checkpoint | **2,360,022 bytes, growth +41,167** [M] [W] |
| Commit | `9fdb160`, `feat: put the Scale labs in the order of their story and say what follows from the inputs` |

---

## 4. Stage 2: the three labs

The plan gave each lab to one engineer, on a branch cut from the commit of S1.7c, touching only the three files of
the lab. The history of the branch holds the labs as three linear commits in the order A, B, C. Each commit
replaces the stub at the same path and adds the test and the pins of the lab. No lab commit edits a shared file,
with one planned exception: `319b4a9` also adds the run budget test of item I3.3 to `test/scale-lab.test.mjs` [R].
The route, the chooser, the frame, the catalog card, the grounding entry, the copy scan and the contract tests are
all driven by `LAB`. Later, `c08f60d` edited all nine lab files and four shared files, item R1.

SHA-256 of the lab files, the shared files and the shell test as committed at `c08f60d`, the deployed source [F:
`git show c08f60d:playground/fleetlab/<file> | shasum -a 256`]. `shasum -a 256` on the working file gives the same
value for every row but `src/ui/studio.js`, which `1aeaace` changed after the deployment; its working file reads
`377cc4a4aba7c2e2813d160d9984baa7388fefeb673abf9c31f22f6d35eeebb4` [F].
The last column says whether `c08f60d` changed the file. At `319b4a9` the first 17 rows equalled the files measured
at design [M] [V]; `git show 319b4a9:playground/fleetlab/<file> | shasum -a 256` gives those digests again, and the
commits are the record of them. The last four rows are the chart and style files and the two new test files that
item R1 touched.

| File | SHA-256 at `c08f60d` | Changed by `c08f60d` |
|---|---|---|
| `src/model/scale-response.js` | `9a0003748a15c7ef17d9528c0c8fb97da636f0fec4ec9acabdb6daa7a46b9998` | yes |
| `test/scale-response.test.mjs` | `0a909adf6314d4565ab6f232e28a90a45877907d410eda8d9f534e52921abebc` | yes |
| `test/scale-response.pins.json` | `0e080aeac5d9029d5072e39822644cf7ce81b204396381a1bd5b1bcda7f6a0f0` | yes |
| `src/model/scale-intake.js` | `1ce7ae1a2a2d13110b7f03d90fa0fb6ce049beb78089cbae9597fd688cce4492` | yes |
| `test/scale-intake.test.mjs` | `666a9fac5b971a34f34f9b44494a5788d5be2d5613aa3e9f76a72a5858155b36` | yes |
| `test/scale-intake.pins.json` | `c0c651131a77693b517fb4e5abb36cce76548f542e5634a56a4edad7f1e27621` | yes |
| `src/model/scale-density.js` | `d888d85dcc8944a753b763e6797eb3b74b62ba8b47284c8bc50867b037ca3f79` | yes |
| `test/scale-density.test.mjs` | `730d063811765e7cc7dd896cc2b9cd26c719396ffe29aa9f55571df0ebef5f3e` | yes |
| `test/scale-density.pins.json` | `5b4d69a745e05a758cceee5caed905d6176bb14ad40c9d9e5c1b862e14974093` | yes |
| `src/model/scale-contract.js` | `096b5b16457c92e1c80c15869afba1bb809d615f9712046ee0ff1c267a4e9ff1` | no |
| `src/ui/scale-lab.js` | `ed4db08f4afc67b11b8f7d2a56a3b517b95949fd37d1025a9b8cc095aff4d666` | yes |
| `src/ui/scale-labs.js` | `fd27e672a1dffdfb44020c4391b65deebfb165a364637e644cb3d86b4b7ed2e0` | no |
| `src/ui/experiment.js` | `251accaae3a040030086105c7543265128add34d13c829c8c59d538691273050` | yes |
| `src/ui/teaching-frames.js` | `16342b6d8bdcae3034474b5df155926ef761f9972949ce7f713506c13b1fbd08` | yes |
| `src/ui/simulation-catalog.js` | `4fd1a0c1cf03ebf7fb95e2bbeb5e6fd6c2d852c957cd66f2c71e8d9553393e43` | no |
| `src/ui/studio.js` | `2b6a10089d17a0ca41b0630905391d85da6f1d67aa7b80017c91c9bf54ca0bc1` | no |
| `test/scale-lab.test.mjs` | `b5c361bef1d07677da0161ad1a5169c320e1f1f151ddee9fdc031ecc4b1a6820` | yes |
| `src/ui/charts.js` | `3176340b8f2fa675247ef04e31e7d39f82c20cbe5babccb07771c22588a9a5be` | yes |
| `styles.css` | `e45ef71d72fcb0f0707966ff2763cf99641fc6ced51f736cde7a6aaf51fd491d` | yes |
| `test/helpers/legacy-text.mjs` | `1dada0b0cb0ead8a5b48237fa38a2d8610b3863796ba0e1f7ca6ec755eb81c11` | new |
| `test/scale-lab.legacy-text.pins.json` | `5186efa3aaea086dd8a8df6a59502ea358b50115fa9ce8344b3cbacfec032641` | new |

Where the prose of the design stage and a committed lab file differ, the committed file and its pins decide.
Section 14 of the design lists what the three reviews changed. No verdict number moved in that revision: every
label, digest, mean and interval of a main test or a control equals the reviewed design [M]. What moved in the pins
is tables, notes, captions and input rows. The independent review after the build, item R1, moved no mean and no
verdict either. What moved in the pins at `c08f60d`: in Lab B, for both arms, three depot door rows of the
vehicle-weeks table, its caption, one note, and the digest and size of the record, plus the name of one key; in Lab
C, the size of 25 pinned records, 18 to 63 characters shorter; in Lab A, the labels and digests of the two pinned
directive setups, `scale-spec:42aa34d4` to `scale-spec:16d331de` and `scale-spec:6905c5e1` to
`scale-spec:2f4598cb`, and the interval ends of the first, from -6,198.47 and -5,266.66 to -6,185.89 and -5,266.52
[F: `git diff 319b4a9 c08f60d` over the three lab pins files]. The labels of the three default presses did not move.

The programs that wrote the three pins files are not part of the repository. Run at design on the final modules,
each wrote the same bytes back [M]. If a module changes again, its pins are recorded again from the output of the
module, and the commit message gives the reason. `c08f60d` did so for all three lab pins files, and its message
gives the reasons. One pins file, `test/scale-response.pins.json`, records the Node version, v22.22.0. The other
three hold no Node version field [F]. One of them, `test/scale-lab.legacy-text.pins.json`, names what it was
computed from: the verdict card module and the teaching frames module as they were at `c79eccf`.

Common acceptance for every lab.

| Check | Command, run in `playground/fleetlab/` | Expected |
|---|---|---|
| Shell test | `node --test test/scale-lab.test.mjs` | all pass, 1 skipped by flag |
| Lab test | `node --test test/scale-<lab>.test.mjs` | all pass, flagged tests skipped |
| Lab test with the flag | `FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 test/scale-<lab>.test.mjs` | all pass |
| Frames, boundaries, copy | `node --test test/teaching-frames.test.mjs test/boundaries.test.mjs test/copy-surfaces.test.mjs` | 10, 19 and 7 pass |
| Packed page | build the offline page outside the tree, then the package check | 0 problems |
| Bytes | the packer, writing outside the tree | at or under the lab's line |

Measured at `319b4a9`.

| Test file | Tests | Without the flag [V] | With the flag, inside the full suite [W] |
|---|---:|---|---|
| `test/scale-lab.test.mjs` | 22 | 21 pass, 1 skipped | 22 pass |
| `test/scale-response.test.mjs` | 11 | 10 pass, 1 skipped | 11 pass |
| `test/scale-intake.test.mjs` | 14 | 13 pass, 1 skipped | 14 pass |
| `test/scale-density.test.mjs` | 14 | 11 pass, 3 skipped | 14 pass |
| The four files together | 61 | 55 pass, 6 skipped, 0 fail, 16.2 s | 61 pass. The full suite had 0 fail and 0 skipped |

At design the four files together with the flag passed 61 of 61 in about 103 s [M]. The lead took no separate
timing of the four files with the flag in the worktree at `319b4a9`. The model notes record one such run, taken
while they were written.

Measured at `c08f60d`. Item R1 added 31 tests to the four files.

| Test file | Tests | Without the flag [F] | With the flag, serial, the four files alone [F] | With the flag, inside the full suite [W] |
|---|---:|---|---|---|
| `test/scale-lab.test.mjs` | 34 | 33 pass, 1 skipped | 34 pass | 34 pass |
| `test/scale-response.test.mjs` | 20 | 19 pass, 1 skipped | 20 pass | 20 pass |
| `test/scale-intake.test.mjs` | 17 | 16 pass, 1 skipped | 17 pass | 17 pass |
| `test/scale-density.test.mjs` | 21 | 18 pass, 3 skipped | 21 pass | 21 pass |
| The four files together | 92 | 86 pass, 6 skipped, 0 fail, 31.8 s | 92 pass, 0 fail, 0 skipped, 127.8 s | 92 pass. The full suite had 0 fail and 0 skipped |

The commands: `node --test test/scale-lab.test.mjs test/scale-response.test.mjs test/scale-intake.test.mjs
test/scale-density.test.mjs`, then the same with `FLEET_PLAYGROUND_PERF=1` and `--test-concurrency=1`, run in
`playground/fleetlab/`.

### L-A Response reserve. Landed in `27f6014`

| Field | Content |
|---|---|
| State | Landed in `27f6014` |
| Files | `src/model/scale-response.js`, `test/scale-response.test.mjs`, `test/scale-response.pins.json` |
| Identity | id `response-reserve`; version `scale-response-1.0.0`; short "Response reserve"; title "Response reserve for an area-wide event"; geography "Fictional market, counts only, no map"; seeds 3001 to 3012 |
| Frame | what_why: "A support pool staffed for ordinary days meets one area-wide event: many vehicles ask for help at once and stay stopped until answered." how: "Counts, not cars. One pool, one staffing rule, three fleet sizes. The event moves a share of the same requests into three hours. One lever is read against no lever. Every rate is a teaching assumption." look_for: "Compare ordinary and event days across fleet sizes, the lever against no lever, and each control against its declared reading." ops_takeaway: "An ops team would size reserve staff and lever delay against event load in its own request records." kind `decision`. Lengths 135, 201, 126 plus 99 characters [V] |
| Controls | `{key:'load', label:'Event load', unit:'x capacity', min:1.2, max:1.6, step:0.1}`; `{key:'lever', label:'Lever', options:[['reserve','Reserve staff join the pool'],['directive','A directive removes the ask']]}`; `{key:'delay', label:'Lever lands after', unit:'min', min:15, max:240, step:15}`. Defaults `{load:1.3, lever:'reserve', delay:45}` |
| Readable region | Event load from a burst depth of 4, near 1.17, to 1.6. A typed 1.17 runs, and the lab test holds that. Since `c08f60d` a load off a step of 0.01 is refused with the reason "event load takes steps of 0.01, so that the load shown is the load used" [R] |
| Setup | `{load, delay, size, word, main, nullCheck, ample, guard}`. Four frozen tests. Control names `'null'`, `'non-binding'`, `'guardrail'` |
| Measures | Primary `stopped vehicle-minutes per 1,000 vehicles`, lower is better, margin 5 percent of the rates-only value (861.558 at the default). Guardrail `late responder call fraction`, lower is better, allowance 0.05 |
| Result | 3 controls with `title` and `as_declared`; 1 chart of 2 series by 3 fleet sizes with 4 partial charts; 5 tables (arms; "Pooling and a correlated event", 14 columns; "Capacity near saturation"; "Landing in time", no lever and five landing times for both levers, each beside its rates-only value; the cross-check, 6 rows); 9 notes, the first with the rates-only value of the tested arm and of the change; 6 unknowns; 16 input rows |
| Named exports | `FLEETS`, `RULE`, `closedForm`, `leanPool`, `rates`, `leverRates`, `buildTape`, `applyEvent`, `simulateDay`, `deriveResponse`, `LAB` |
| Changes made in review | The first refusal reason is 192 characters. The source cell of the two thresholds reads "Teaching assumption". The requests row says who makes a responder call. `leverRates` and the first note are new. The ladder table has two more columns. The landing table adds 10 arms a seed. The busy share row is cut. The lean series is out of the chart. The last unknown points to the other labs |
| Changes made in `c08f60d`, item R1 | Minutes to clear read 0 on a day with nothing waiting when the event ends. `leverRates` returns the no-lever value itself for a directive that has nothing left to remove, so its change is an exact zero. A cell under half a unit of its last decimal is handed over at two significant digits. The declared change of a directive reads "every vehicle request moved into the event". The requests row says that a directive removes vehicle requests only and responder calls stay in the pool. A load off a step of 0.01 is refused. The first note claims a direction from the inputs only on a press that read one. The chart names its unit and fleet sizes, its categories are "2,000", "6,000" and "20,000" under the head "Fleet size, vehicles", and a partial chart carries its own sentence. The capacity table prints a load near 1 with the decimals that keep its side [R] |
| Tests | Twenty [F]: 1 queue formula and rates; 2 tape and event; 3 lever semantics; 4 readable region; 5 pins of five setups; 6 laws on shipped and held-out seeds, with the landing table; 7 eight deliberate faults and the detection limit; 8 one press, counted; 9 copy; 10 rates only for a lever arm, by hand, by identity, and over the page grid by flag; 11 "C1" a queue empty at the event end clears in 0 min; 12 "C2, C11" a late directive reads the no-lever value itself; 13 "M1" the inputs say a directive leaves responder calls in the pool; 14 "M2" a load off a step of 0.01 is refused; 15 "M17" the first note; 16 "M20" units and fleet sizes of the chart summary, the first note and the burst column; 17 "M22" a partial chart carries a whole sentence; 18 "M8" short chart categories; 19 timing by flag; 20 "M1" the declared change of a directive. At `319b4a9` there were eleven, the eleventh the timing test |
| Pins that must hold | Default main label `scale-spec:443de567`, IMPROVED, ADVANCE_TO_NEXT_TEST, mean change -12992.038053000475, margin 861.558. Null `scale-spec:3fbf35ea`, change 0. Ample pool `scale-spec:b98f9b28`, UNCHANGED. Guardrail control `scale-spec:7b210b97`, UNCHANGED and HOLD. Rates only at the default 4,676.0 and -12,555.2. Directive setups `scale-spec:16d331de` (after 180 min, IMPROVED, mean change -5748.882794763326) and `scale-spec:2f4598cb` (event load 1.2, after 240 min, UNCHANGED, change 0). Interval bounds compare to a relative 1e-9, everything else exactly. `test/scale-response.pins.json` holds them [F] |
| Acceptance, beyond the common checks | Lab test 19 pass and 1 skipped [F], 20 of 20 with the flag [W] [F]. 160 of 160 settings of the page grid accepted, none invalid, none voided, every control as declared, largest record 29,708 characters at event load 1.6 with a directive after 30 min [F: every setting pressed once in Node]. At design the largest record was 29,509 characters [M]. Tests 4 and 10 of the lab test hold the page grid. 364 simulated days a press. Record at most 65,536 characters (29,596 at the default [F], 29,391 at `319b4a9`) |
| Compute | In Node at design: 459 ms per press, first partial chart after 34 ms, longest block 5.7 ms, 645 steps of the generator [M]. On `c08f60d`: 525 ms per press, first partial chart after 60 ms, longest block 5.6 ms, 644 yields and the return, 4 partial charts [F, one run on a laptop that was not idle]. The timing test asserts 8 ms and passed inside the full suite [W] and in the serial run of the four files [F]. In the browser: item I3.8 |
| Byte line | Allocation 20,480 bytes. Measured **21,838 bytes** at `319b4a9` [M], of which 1,405 bytes are review fixes. The worktree checkpoints give the same: 16,237 bytes net of a stub of 5,601 bytes [W]. `c08f60d` added 809 bytes to this module in the offline package [F: the package built with this one file taken back to `319b4a9`, against the package of `c08f60d`], so the line reads 22,647 bytes [E: a sum of the two methods]. Hard limit 24,576 bytes, 1,929 bytes away |

### L-B Fleet intake. Landed in `1a81ae8`

| Field | Content |
|---|---|
| State | Landed in `1a81ae8` |
| Files | `src/model/scale-intake.js`, `test/scale-intake.test.mjs`, `test/scale-intake.pins.json` |
| Identity | id `fleet-intake`; version `scale-intake-1.0.0`; short "Fleet intake"; title "From delivered to in service"; geography "Fictional market, weekly counts, no map"; seeds 7001 to 7012 |
| Frame | what_why: "A delivered vehicle is not yet a vehicle in rider service. Which gate keeps vehicles waiting, and when is the slowest depot resource ordered?" how: "Weekly counts, not cars on a map. Vehicles pass integration, validation, a release gate and depot intake, where places open in tranches. The lesson arm orders the slowest depot resource ahead of the control." look_for: "Read the counts of one fleet in one week, then the gate where vehicles waited under each arm." ops_takeaway: "An ops team would map every gate from delivery to rider service against its lead time and write the order week for the slowest one." kind `decision`. Lengths 141, 207, 93 plus 131 characters [V] |
| Controls | Three. `{key:'arm', label:'The other arm', options:[['middle','Order site power ahead for the middle of its lead range'],['end','Order site power ahead for the end of its lead range']]}`; `{key:'power', label:'Site power lead time, middle of its range', unit:'weeks', min:24, max:56, step:1}`; `{key:'ports', label:'Ports lead time, middle of its range', unit:'weeks', min:16, max:28, step:1}`. Defaults `{arm:'middle', power:48, ports:24}`. The release week is a fixed teaching assumption: week 16, drawn per seed from 12 to 20. A typed release week is ignored |
| Governing ratio | Row "Room over the tranche interval", `room / 4`, 6.00 at the default, read from 2.0. The same row gives site power over ports as a descriptive value |
| Setup | `{arm, mids, ranges, release, mid, ratio, room, ahead, other, main, checks}`. `checks` holds three frozen tests: `'null'`, `'non-binding'` (order), `'non-binding'` (deliveries, guardrail swapped) |
| Measures | Primary `in-service fraction of plan`, higher is better, margin 0.02. Guardrail of an order arm `idle weeks per ordered place`, lower is better, allowance 13. Guardrail of the deliveries control `weeks not in service per delivered vehicle`, lower is better, allowance 2 |
| Result | 3 controls whose titles carry their declared reading; 1 chart of 3 line series by 52 weeks with `seed: 7001`; 4 tables ("One fleet, several counts"; "The gate that binds"; "Lead-time mismatch", five order weeks; the gain and the release stock by hand, 2 rows); 8 notes; 6 unknowns; 13 input rows. No partial chart |
| Named exports | `LAB`, `INTERNALS` |
| Changes made in review | The governing ratio row is the room over the tranche interval. The release week is a fixed assumption and no longer a control. The table "Lead-time mismatch" is new, with 60 more model runs a press. The third hand check is cut. Two unknowns are reworded. Every control title carries its declared reading. Captions open with their topic, and the sixth unknown points to the density ladder |
| Changes made in `c08f60d`, item R1 | The depot door stock is split each week: what a free place could take waits on depot induction, the rest on the resource that holds the next tranche. Before, depot induction held the whole stock in any week with a place left over. The caption of "The gate that binds" says so, and says that the rows sum to the total before each is rounded to a whole vehicle-week. The note on the deliveries control says where the added waiting sits: two fifths at integration and the rest at validation and rework, the release gate and the depot door. A refusal with no room left past ports says so in its own words [R] |
| Tests | Seventeen [F]: 1 pins of both arms; 2 conservation and the gap identity; 3 the depot door stock split each week (new); 4 plan definition; 5 tape and pairing; 6 six injected defects; 7 fail closed on a replay that differs; 8 controls as declared; 9 the note on the deliveries control (new); 10 laws and the weeks ahead table; 11 the vehicle-weeks rows sum to the total before rounding, and as printed stay within the number of rows of it (new); 12 hand checks; 13 refusal region, and no value of the governing ratio both accepted and refused; 14 copy; 15 resemblance; 16 pinned robustness sample; 17 timing by flag. At `319b4a9` there were fourteen |
| Pins that must hold | First arm label `scale-spec:1aa8c833`, IMPROVED, ADVANCE_TO_NEXT_TEST, mean change 0.1846649238409015, guardrail harm 5.6024305555555545. Second arm `scale-spec:a0b5e327`, IMPROVED, HOLD, 0.21607458339301913, harm 14.472222222222223. Null `scale-spec:494f724a`. Order control `scale-spec:fc0d0072`, harm 24. Deliveries control `scale-spec:7bad40d3`, harm 4.3269230769230775. The depot door rows of the vehicle-weeks table, control then other arm: depot induction 290 and 321 in the first arm, 290 and 386 in the second; site power 20,106.17 and 4,943.67, then 20,106.17 and 947.92; ports 0 and 4,534.5, then 0 and 6,662.25. At `319b4a9` depot induction read 1,819.5 in the control. `test/scale-intake.pins.json` holds them [F]. The refusal triple is `[429, 351, 184]`: pairs typed, pairs accepted, longest reason in characters, held by test 13 of the lab test [R]. It was `[429, 351, 186]` at `319b4a9` |
| Acceptance, beyond the common checks | Lab test 16 pass and 1 skipped [F], 17 of 17 with the flag [W] [F]. 702 of 858 typed presses accepted, which is 351 of 429 pairs for each of the two arms; 156 refused, longest reason 184 characters, none thrown, none invalid, none voided, every control as declared [F: every typed pair pressed once in Node for both arms]. The same count was measured at design [M]. Test 13 of the lab test holds the region through the refusal triple. Record at most 65,536 characters: 33,961 and 34,099 characters at the default for the two arms [F]. Over the 702 accepted presses the largest record is 34,309 characters, at site power 34 weeks and ports 23 weeks in the first arm [F]. At `319b4a9` the largest was 34,093 characters |
| Compute | In Node at design: 71 ms per press, longest block 1.5 ms, 257 steps of the generator, 184 model runs [M]. On `c08f60d`: 95 ms per press, longest block 2.2 ms, 256 yields and the return, no partial chart [F, one run on a laptop that was not idle]. In the browser: item I3.8 |
| Byte line | Allocation 19,456 bytes. Measured **19,964 bytes** at `319b4a9` [M], of which 547 bytes are review fixes. The worktree checkpoints give the same: 15,241 bytes net of a stub of 4,723 bytes [W]. `c08f60d` added 415 bytes to this module in the offline package [F, by the method of Lab A], so the line reads 20,379 bytes [E]. Hard limit 23,552 bytes, 3,173 bytes away |

### L-C Density ladder. Landed in `319b4a9`

| Field | Content |
|---|---|
| State | Landed in `319b4a9` |
| Files | `src/model/scale-density.js`, `test/scale-density.test.mjs`, `test/scale-density.pins.json` |
| Never edits | `src/model/bay-operations.js`, `src/model/bay-area.js`. Held: neither file is in the diff from `c79eccf` to `319b4a9` [V], nor in the diff from `c79eccf` to `c08f60d` [F] |
| Identity | id `density-ladder`; version `scale-density-1.0.0`; short "Density ladder"; title "Density ladder: one depot cell, five fleet sizes"; geography "Nine neighbouring places of the Fleet day road map"; seeds 31001 to 31010 |
| Frame | what_why: "One depot cell takes five times the cars and the requests. At which fleet size does the depot pass its capacity, and does siting matter at equal capacity?" how: "The Fleet day engine runs rungs of 24 to 120 cars in one cell of nine places at equal requests per car. Two load ratios set demand and depot size. Hours 5 to 8 are measured." look_for: "Compare depot queue time with pickup driving at each rung, then depot load by hand with trips per car." ops_takeaway: "An ops team would compare depot load at each planned fleet size before ordering cars." kind `decision`. Lengths 154, 173, 102 plus 85 characters [V] |
| Limits | "One cell of nine places and at most 120 cars, not a city; every rate is invented; road distances are those of the Fleet day map; idle cars wait where they finish; one window of 8 hours from a fresh start, so another window length gives another size of effect; no fleet, depot or service in those places is described." |
| Controls | `{key:'plan', label:'Comparison', options:[['capacity','Both sites scaled in step, against both sites as sized for 24 cars'],['sites','Sites added at equal capacity, against both sites scaled in step'],['one','One site of equal capacity at the cell edge, against both sites scaled in step']]}`; `{key:'street', label:'Street load at the first rung', unit:'of car time', min:.64, max:.72, step:.02}`; `{key:'depot', label:'Depot load at the first rung', unit:'of capacity at the busier site', min:.4, max:.6, step:.05}`. Defaults `{plan:'capacity', street:.68, depot:.5}` |
| Setup | `{plan, street, depot, main, replay, spare}`. Control names `'null'` and `'non-binding'`. The non-binding control carries `as_declared` |
| Engine use | `simulateBayAreaOperations(config, {capture:false})`. Every config is `defaultBayAreaConfig()` with only the declared fields replaced. Test 4 of the lab test lists the 18 declared fields by name and holds every other field at its Fleet day default |
| Measures | Primary `completed trips per 100 car-hours in hours 5 to 8`, higher is better, margin 3. Guardrails `prompt pickup fraction of requests in hours 5 to 8` (higher, 0.02), `unfinished depot visits per 100 cars at the end` (lower, 5), `stored energy at the end, kilowatt-hours per car` (higher, 2) |
| Result | 2 controls whose titles carry their declared reading; 1 chart of 3 series by 5 rungs with a partial chart after each rung; 2 tables ("Density and the depot limit", with the column "Depot load by hand, control"; the hand check, whose caption says what it covers); 4 notes, of which the first depends on the comparison and the last prints the recorded range of the in-step pickup distance; 4 unknowns; 11 input rows, the last of them the road table with the prefix `Fleet day map`; and `work: {engine_runs}`. Since `c08f60d` the chart categories are "24", "48", "72", "96" and "120" under the head "Fleet size, cars", and the table and the summary carry the site count of the tested plan; `LAB.map` and `LAB.credit` are set [F] |
| Changes made in review | The limits sentence says which input is real and that no fleet, depot or service in those places is described. The inputs table has an eleventh row for the road table. The column "Depot load by hand, control" replaces a reference ratio, and one law that rested on that ratio is withdrawn. The caption of the hand check says what it covers. Two notes are new. The non-binding control carries `as_declared`. Both control titles carry their declared reading. `derive` no longer throws on `null`. Test 14 gates the wall clock |
| Changes made in `c08f60d`, item R1 | The page credits the road map and its licence in every state. A depot load by hand never prints as equal to, or across, capacity or the ceiling of 0.9 when it is not: it takes two decimals and one more at a time up to 17, and a load closer to its threshold than six decimals is printed as text. The ceiling is tested on the load itself, not on its rounded text, and a refusal prints the load past the ceiling. The inputs table prints each governing ratio at the decimals it holds, two at least. The "Held fixed" row says that prompt pickup is counted over requests made at least 15 min before the window ends. The rungs are named by number [R] |
| Tests | Twenty-one [F]: 1 typed assumptions and the hand rule; 2 a pure `derive`, on `null` by name; 3 no run before Run; 4 run budget and declared fields; 5 pins; 6 laws, the depot load column and the siting notes; 7 controls; 8 arm swap; 9 three defects; 10 conservation; 11 names, copy, the limits sentence and the road table row; 12 the Fleet day road map and its credit sentence; 13 a depot load by hand never prints as equal to, or across, capacity or the ceiling; 14 a load closer to its threshold than six decimals keeps its side; 15 the ceiling is held by the hand load itself; 16 each governing ratio printed at the decimals it holds; 17 the prompt pickup guardrail and its inputs row; 18 short chart categories; 19 reader grid by flag; 20 shape robustness by flag; 21 timing by flag. At `319b4a9` there were fourteen |
| Pins that must hold | Capacity label `scale-spec:b4c7f5da`, IMPROVED, ADVANCE_TO_NEXT_TEST, change 62.604166666666664, 113 engine runs. Sites added `scale-spec:d9387e05`, UNCHANGED, 103 runs. One site `scale-spec:4eb5ad2f`, REGRESSED, HOLD, 113 runs. Null control change 0 on every measure. Of the by-rung table only the third column moved in review: it holds 0.47, 0.95, 1.42, 1.90, 2.37 in the capacity comparison. `test/scale-density.pins.json` holds them [F]. `c08f60d` moved only the record sizes of this file |
| Acceptance, beyond the common checks | Lab test 18 pass and 3 skipped [F], 21 of 21 with the flag [W] [F]. 72 of 75 grid settings accepted, 3 refused, none invalid, none voided, both controls as declared at 72 of 72, at most 113 engine runs a press [M]. Test 19 of the lab test holds the reader grid by flag and passed inside the full suite [W] and in the serial run of the four files [F]. Engine calls counted from outside equal `work.engine_runs` and never pass 120. Zero engine calls while the view mounts, a lesson arrives or a control changes. Record at most 65,536 characters: 31,665 at the default [F], 31,683 at `319b4a9`. The 25 pinned records run from 30,952 to 31,756 characters [F] |
| Compute | In Node at design: 1,153 ms per press, first partial chart after 30 ms, longest block 17.0 ms, 180 steps of the generator [M]. On `c08f60d`: 1,257 ms per press, first partial chart after 76 ms, longest block 18.5 ms, 179 yields and the return, 5 partial charts, 113 engine runs [F, one run on a laptop that was not idle]. The timing test asserts 1,000 ms to the first chart and 3,000 ms a press and passed inside the full suite [W] and in the serial run of the four files [F]. In the browser: item I3.8 |
| Byte line | Allocation 13,312 bytes. The lab stood 3,652 bytes over its allocation at `319b4a9`, which the lead allowed inside the lab's own hard limit. The owner has not ruled on that allowance. It is part of decision 3 of the design, assumed at the lead's recommendation, not ratified. Measured **16,964 bytes** at `319b4a9` [M], of which 1,084 bytes are review fixes. The worktree checkpoints give the same: 12,401 bytes net of a stub of 4,563 bytes [W]. `c08f60d` added 475 bytes to this module in the offline package [F, by the method of Lab A], so the line reads 17,439 bytes [E]. **That is 31 bytes past the lab's hard limit of 17,408 bytes.** The commit message of `c08f60d` and the release record state no per-lab line. The package as a whole stays 2,692 bytes under its hard stop. It belongs to decision 3 for the owner |

---

## 5. Stage 3: integration. The lead

State of the items of this stage at the time of writing.

| Item | State |
|---|---|
| I3.1 Lab A replaces its stub | Landed in `27f6014` |
| I3.2 Lab B replaces its stub | Landed in `1a81ae8` |
| I3.3 Lab C replaces its stub, run budget test | Landed in `319b4a9` |
| I3.4 Registration check | Run at `319b4a9`, passed. No commit of its own |
| I3.5 Documents | Written and committed in the documents commit on top of `1aeaace` |
| I3.6 Packaging checks | Run at `319b4a9` and again at `c08f60d`, passed |
| I3.7 Full gates | Run at `319b4a9` and again at `c08f60d`, passed |
| I3.8 Browser acceptance | Run in part at `319b4a9`, and again in part at `c08f60d`, locally and on the hosted site. No painted frame, no 1440 by 900 px, no throttle, no physical phone |
| R1 Independent review and its fixes | Landed in `c08f60d`, the eighth commit |
| I3.9 Commits | Seven commits made after the shell, which with the shell are the eight commits of this wave. One more, the documents commit on top of `1aeaace`, is made |
| I3.10 Release record and handoff | Written: `docs/FLEETLAB_SCALE_LAB_RELEASE_2026-09-27.md`, `docs/FLEETLAB_SCALE_LAB_HANDOFF_2026-09-27.md` and a new top section of `CODEX_HANDOFF.md`. Committed in the documents commit on top of `1aeaace` |
| I3.11 Push and deployment | Deployment done on the owner's instruction of 2026-09-27: deployment `19e17ac6`, source `c08f60d`, 98 of 98 public files read back. Push not done, not authorized |

### I3.1 Lab A replaces its stub. Landed in `27f6014`

| Field | Content |
|---|---|
| State | Landed in `27f6014` |
| Files | The three files of L-A |
| Acceptance | The common checks of section 4. Shell test 20 pass and 1 skipped at this step [M] |
| Byte checkpoint | **2,376,259 bytes, growth +57,404** [M] [W] |
| Commit | `27f6014`, `feat: add the response reserve lab` |

### I3.2 Lab B replaces its stub. Landed in `1a81ae8`

| Field | Content |
|---|---|
| State | Landed in `1a81ae8` |
| Files | The three files of L-B |
| Acceptance | The common checks. Shell test and both lab tests pass together |
| Byte checkpoint | **2,391,500 bytes, growth +72,645 bytes** [M] [W]. Lab C adds 12,401 bytes net of its stub. The rule of the plan: if the growth after Lab B is over 79,759 bytes, the package would pass the hard stop with Lab C, so stop and report before I3.3. The growth was 72,645 bytes, so the rule did not fire |
| Commit | `1a81ae8`, `feat: add the fleet intake lab` |

### I3.3 Lab C replaces its stub, and the run budget test lands. Landed in `319b4a9`

| Field | Content |
|---|---|
| State | Landed in `319b4a9` |
| Files | The three files of L-C. `test/scale-lab.test.mjs` gains one test, 12 lines [R] |
| Tests first | Shell test 22, "every press stays inside its run budget and names its controls from the allowed set": for every lab, the main test has `control` equal to `null`; one shipped control is a null control; every control name is in the allowed set; no valid record holds a guardrail that was not evaluated; a reported `work.engine_runs` is a whole number from 1 to 120; `density-ladder` reports it. On the stubs this test fails, which is why it lands here |
| Acceptance | Shell test 22: 21 pass and 1 skipped [V], 22 of 22 with the flag [W]. The four Scale test files together: section 4 |
| Byte checkpoint | **2,403,901 bytes, growth +85,046 bytes** [M] [W] [V]. Target 81,920 bytes, passed by 3,126 bytes. Hard stop 92,160 bytes, 7,114 bytes away. A copy of `319b4a9` made with `git archive` packs to the same 2,403,901 bytes [F] |
| Commit | `319b4a9`, `feat: add the density ladder lab`. This is the first commit that holds three real labs. As written, a release still needed gates 1 to 6 of the design and the owner's word |

### I3.4 Registration check with the real labs. Run at `319b4a9`

Everything below landed in `2caeac6` or in `9fdb160`. This item verifies it with the final descriptors and fixes
nothing unless a check fails. No check failed, so the item has no commit of its own.

| Surface | Check |
|---|---|
| Registry | `SCALE_LABS` holds three labs in the order C, B, A |
| Catalog | 59 records. Three with `model` "Scale lab", `target` "scale", seeds 10, 12 and 12, and the lab's own `limits` |
| Frames | 59 lesson frames. The three Scale frames carry family "Scaling the fleet", model "Scale lab", evidence "paired" |
| Entry points | The Overview card, the catalog article and its two filters, the "Start here" link to the density ladder, the Fleet day link |
| Styles | Every `scale-` class the view sets is defined and listed in the stylesheet header |
| Copy scan | Every `scale-` module reachable from the page is named in the list of the package check. None is reachable from the worker |
| Pinned counts | The table of section 10 of the design |
| Command | `node --test test/scale-lab.test.mjs test/navigation.test.mjs test/simulation-catalog.test.mjs test/teaching-frames.test.mjs test/studio.test.mjs test/copy-surfaces.test.mjs test/a11y.test.mjs test/d1-presentation.test.mjs` |
| Expected | 104 tests: 102 pass, 1 skipped by flag, 1 existing todo [M] |
| Measured | 104 tests: 102 pass, 1 skipped by flag, 1 existing todo, 0 fail [V]. Not run again as one command at `c08f60d`: the full suite there holds every file of the command, item R1 |

### I3.5 Documents. Committed in the documents commit

These files landed together in the documents commit on top of `1aeaace`. None of
them is a site file: the site is built only from `src`, `styles.css`, `index.html`, `media` and the tools, so the
documents commit leaves the deployed site byte for byte as it is.

| File | Change |
|---|---|
| `playground/fleetlab/README.md` | Three places where the count of 56 lessons stood: two now read 59, one of them with "three Scale lab lessons" added, and the third says that the catalog of this source tree holds 59 lessons. One new section, "Scale lab" |
| `playground/fleetlab/ARCHITECTURE.md` | One new item, item 45 of section 12, "Scale lab": the route, the generic view, the lab contract of section 1, the shared paired contract with its two void rules, the rule that labs are page-only, how a long run yields, the run budget of Lab C, side-preserving numbers, and the reading of D8 for Lab A with the measured cost of both keyed alternatives |
| `docs/plans/2026-09-27-fleetlab-scale-lab-design.md` | The design, with every source of its section 2 opened again first and the titles of rows 16a to 16c added |
| This record | The plan, with every measurement given as a number or as the committed test that holds it |
| `docs/FLEETLAB_SCALE_LAB.md` | Model notes for the three labs. The list below |
| `HERMES_SOURCE_OF_TRUTH.md` | One dated entry in section 7.5, newest first, with every number measured and the command that produced it, and every decision marked as assumed at the lead's recommendation, not ratified. Correct the stale header rows in the same edit. No sibling status file |
| `docs/FLEETLAB_SCALE_LAB_RELEASE_2026-09-27.md`, `docs/FLEETLAB_SCALE_LAB_HANDOFF_2026-09-27.md`, the new top section of `CODEX_HANDOFF.md` | Item I3.10 |
| `docs/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md` | The status paragraph, corrected by the lead: the Scale lab Production `19e17ac6` from `c08f60d` is current, D1 `dd4bfa44` is the rollback target, the project holds three Production deployments, and `1aeaace` is committed and not deployed. The rollback heading is left for the owner |
| The lesson snapshot kept outside the tree | Declared again for 59 lesson records. It is not a file of the repository. Not done: it still counts 56 lessons |

What the model notes hold.

| Item | Source |
|---|---|
| The seed records: which seeds tuned what, and that the shipped seeds of Lab B are not called held out | The design stage |
| The robustness tables and the region sweeps of the revision | Sections 4.7, 5.7 and 6.7 of the design |
| The interval coverage, 90.0 to 93.5 percent at 12 seeds | Lab A |
| That no shipped control estimates a false alarm rate: common draws remove chance, so a null control reads exactly zero and tests pairing and hidden state | Section 14.3 of the design |
| That a replay control cannot expose a deterministic error | Lab C |
| What was chosen with sight of outcomes: Lab B's idle allowance of 13 weeks and default of 48 weeks, so that the two arms read one advance and one hold | Lab B |
| That at the smallest pool 6.1 percent of responder calls are late on an ordinary day | Lab A |
| That Lab C's hand check takes a recorded result as an input, reads 0.941 from the inputs alone with sites added, and is no evidence for any law | Section 14.3 of the design |
| Lab C's rejected arms and window table, and the first look at the lagging depot comparison | Lab C, section 14.3 of the design |
| The list of public counts that Lab B's default page stays away from, with the statement that Lab A's first rung coincides with an older one and carries no meaning | Rule 2 of section 2 of the design |
| That the engine's car-mix key is an identifier the engine requires | Lab C |

Privacy. No document names an operator on a page surface. No document holds an absolute home path, an email
address or a token. For this wave the staged scan gains patterns, because the repository's own pattern covers none
of them. The working material of the design stage is never published.

Scan patterns added for this wave. The added patterns cover two groups: the names of the working files and
working folders of the design stage, and words of personal framing that the rules of the repository exclude. The
list itself is not printed in this record, so that the record holds no match of its own scan.

### I3.6 Packaging checks. Run at `319b4a9` and at `c08f60d`

Run from the repository root, writing outside the tree.

```
node playground/fleetlab/tools/pack.mjs --out <outside>/fleetlab-playground.html
node playground/fleetlab/tools/check-dist.mjs <outside>/fleetlab-playground.html
node playground/fleetlab/tools/pack.mjs --site <outside>/site
node playground/fleetlab/tools/check-dist.mjs --site <outside>/site
```

| Check | Expected | Measured at `319b4a9` |
|---|---|---|
| Offline page | 2,403,901 bytes, 0 problems | 2,403,901 bytes, 0 problems [W] [V] |
| Hosted folder | Text payload 2,228,997 bytes, 0 problems, 99 files | 99 files and 3,341,614 bytes in all, 0 problems. Its 97 text files hold 2,228,997 bytes. The other 2 files are media [V] |
| `node --test playground/fleetlab/test/pack.test.mjs` | 41 of 41 [E]. Two of its tests need the repository root, so the file read 39 of 41 on a copy at design | 41 of 41, run from the repository root [V] |
| Run pressed inside the packed page | Shell test 21, by flag. The packed record equals the native record for all three labs [M] | Shell test 21 passed inside the full suite with the flag [W] |

Measured at `c08f60d`, the deployed source.

| Check | Measured at `c08f60d` |
|---|---|
| Offline page | 2,408,323 bytes, 0 problems, SHA-256 `4828cded63f5c23f99a8d13cc32716f587717f57847dd79bdba59215786800b5` [W] [F] |
| Hosted folder | 99 files and 3,349,602 bytes in all, 0 problems [W] [F]. Its 97 text files hold 2,236,985 bytes. The other 2 files are media, unchanged. The 98 public files, all but `_headers`, hold 3,349,192 bytes [F] |
| Files that differ from the hosted folder of `319b4a9` | 8: the three lab modules, `src/ui/charts.js`, `src/ui/experiment.js`, `src/ui/scale-lab.js`, `src/ui/teaching-frames.js` and `styles.css` [F: both folders built outside the tree and compared file by file] |
| Pack test | Passed inside the full suite with the flag [W]. Not run again on its own |
| Run pressed inside the packed page | Shell test 21 passed inside the full suite with the flag [W] and in the serial run of the four Scale files [F] |

### I3.7 Full gates. Run at `319b4a9` and at `c08f60d`

```
FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 "playground/fleetlab/test/*.test.mjs"
FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -p no:cacheprovider tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py
python -m ruff check .
git diff --check
```

| Gate | Expected | Measured at `319b4a9` |
|---|---|---|
| Node suite, serial, with the performance flag | 1,937 tests, 1,936 pass, 1 existing todo, 0 fail [E]: 1,892 in the commit message of `2caeac6`, less its 16 shell tests, plus 61 | 1,937 tests, 1,936 pass, 0 fail, 0 skipped, 1 existing todo, 265.7 s [W]. The estimate held |
| Python parity and boundary tests | 89 pass | 89 pass [W]. 89 pass in 5.7 s [V] |
| `ruff` | clean | All checks passed, ruff 0.16.2, run with `--no-cache` [V]. The seven commits change no Python file |
| `git diff --check` | clean | `git diff --check c79eccf 319b4a9` prints nothing [V]. This record holds no output of the staged checks of the seven commits |
| Parity values that must not move | Fleet day seed 42: 95 completed, 176 unserved, 4 waiting, 9 in progress of 284 requests | Held by two Node tests, `test/d1-model-parity.test.mjs` and `test/d1-presentation.test.mjs` [R]. Both passed inside the full suite [W] |
| Machine | Idle, serial. Two existing 8 ms tests have failed under load and passed on an isolated rerun. The same rule applies to the flagged lab tests. Lab A asserts 8 ms and measured 5.7 ms at design | No test failed in the full suite, so no rerun was needed |
| Node version | 22.22.0. The pins compare doubles that come through `Math.log`, `Math.exp` and `**`. Record the version in the release record. A failure of a pin after a change of version is reported, never fixed by writing the pins again without a reason | 22.22.0 [W] [V] |

The 1 existing todo is a test of `test/a11y.test.mjs` for horizontal page scroll at 400 px. It needs a browser and
is older than this wave. It is not counted as passed.

The same gates at `c08f60d`, the deployed source.

| Gate | Expected | Measured at `c08f60d` |
|---|---|---|
| Node suite, serial, with the performance flag | 1,968 tests [E]: 1,937 at `319b4a9` plus the 31 tests of item R1 | 1,968 tests, 1,967 pass, 0 fail, 0 cancelled, 0 skipped, 1 existing todo, 281.9 s [W]. The estimate held. Not run again whole while this record was brought in line; the four Scale files were, section 4 [F] |
| Python parity and boundary tests | 89 pass | 89 pass [W]. 89 pass in 5.2 s [F] |
| `ruff` | clean | All checks passed [W]. All checks passed, ruff 0.16.2, run with `--no-cache` [F]. The eight commits change no Python file |
| `git diff --check` | clean | `git diff --check c79eccf c08f60d` prints nothing [F] |
| Parity values that must not move | Fleet day seed 42: 95 completed, 176 unserved, 4 waiting, 9 in progress of 284 requests | Held by `test/d1-model-parity.test.mjs` and `test/d1-presentation.test.mjs` inside the full suite [W], and read on the hosted site [P] |
| Node version | 22.22.0 | 22.22.0 [W] [F] |

The full suite took 281.9 s at `c08f60d` against 265.7 s at `319b4a9`, with 31 more tests. The two runs were not
taken under the same conditions, so no cause of the difference is claimed.

The full suite at `1aeaace`, outside the wave, ran twice with the performance flag [W]. Each run read 1,969 tests,
1,967 pass, 1 fail and 1 existing todo. In the first, while other work loaded the machine (342.8 s), the response
reserve test "timing on the reference laptop" read a longest block of 9.34 ms against 8 ms. In the second, on an
otherwise idle machine (292.9 s), the four-area runtime test "run_window and run_pair gaps on the reference
preset" in `test/runtime.test.mjs`, which this wave did not change, read a largest run_window gap of 11.34 ms
against 8 ms. Each passed its one isolated rerun, the second at 5.73 ms (run_window) and 5.52 ms (run_pair). No run
at `1aeaace` failed a test other than a timing test. A full run at `1aeaace` with zero failures is not recorded.
Also at `1aeaace`: Python parity and boundary tests 89 pass, `ruff` all checks passed, `git diff --check` clean,
both package checks OK [W].

### I3.8 Browser acceptance. Run in part, at `319b4a9` and again at `c08f60d`

At `319b4a9`, what the lead measured, on the native modules.

| Measure | Viewport | Result [W] |
|---|---|---|
| Density ladder, press to recorded result | Desktop pane of about 1024 by 768 px, no throttle | 1,060 ms, with the first chart at 59 ms. The full suite was running on the same machine at the same time |
| Fleet intake, press to recorded result | The same pane | 99 ms |
| Response reserve, press to recorded result | The same pane | 520 ms |
| Focus after Run | The same pane | Focus lands on the Result heading |
| Console | The same pane | No console error |
| Place of Run on a phone | 375 by 812 px | Run sits at y 721 to 774 px inside the sticky bar, for all three labs |
| Sideways overflow on a phone | 375 by 812 px | None, for all three labs |

The design expected every Node figure to be a lower bound for a browser, as an estimate. On this desktop the
density ladder read 1,060 ms against 1,153 ms in Node at design, so for that lab the browser figure is under the
Node figure. The two were not taken under the same conditions. No phone and no throttle was measured. The record
does not say whether the pane was visible, so no painted frame is claimed. The record does not say whether the
phone width was read after a press. After a press at 375 px the independent review found the page 522 px wide on the response reserve and
406 px wide on the density ladder, defect 2 of item R1.

At `c08f60d`, what the lead measured on the native modules [W], and on the hosted site after the deployment [P].
The pane was hidden, so no frame was painted. No throttle was applied and no physical phone was used.

| Measure | Viewport | Result |
|---|---|---|
| Press to recorded result, three presses each | Pane of 1024 by 768 px, no throttle | Density ladder 966 to 1,034 ms, first chart after 51 to 70 ms. Fleet intake 111 to 115 ms. Response reserve 477 to 491 ms [W] |
| Press to recorded result on the hosted site, one press each | 1024 by 768 px | Density ladder 1,044 ms, fleet intake 102 ms, response reserve 513 ms [P] |
| Focus after Run, primary buttons | 1024 by 768 px | Focus on the Result heading. One enabled primary button [W] |
| Console | both | No console error [W] [P] |
| Sideways overflow after a press | 375 by 812 px | None. Scroll width equals client width, 375 px, for all three labs [W] |
| Place of Run | 375 by 812 px | In the sticky bar, y 721 to 774 px [W] |
| Chart labels | 375 by 812 px | Every rung label drawn: five on the density ladder, three on the response reserve [W] |
| Map credit | both | On the density ladder page and on no other [W] |
| Readout words and long numbers | both | No "left of the band". No visible number with more than 12 decimals [W] |
| Refusal | 1024 by 768 px | A typed site power lead time of 26 weeks is refused in 232 characters with a way back, and Run reads as unavailable [R: the release record] |
| Entry points | 1024 by 768 px | The fourth Overview card in a two by two grid, the Fleet day link, the fourth catalog article, the Start here link [R: the release record] |

One lesson of the measurement belongs in the record. A timing harness that watched the whole page for changes made
`c08f60d` look 4 to 8 times slower than `319b4a9`. A harness that watched only the status line showed no difference.
The first reading came from the harness, not from the page [W].

The planned checks, each with its state at `c08f60d`.

| Check | Planned viewport | Planned record for each lab | State |
|---|---|---|---|
| Layout | 1440 by 900 px | y of Run, inside the first screen, with the thesis line above the heading. Focus on the Result heading after Run. Tab order equal to document order | In part, at another size. Focus was measured at 1024 by 768 px at both commits. The y of Run on a desktop, the place of the thesis line and the tab order have no record. Nothing was measured at 1440 by 900 px |
| Layout | 375 by 812 px | Run inside the sticky bar at arrival. No sideways overflow. No element wider than the screen outside a scroll region | Measured at `c08f60d`: Run at y 721 to 774 px in the sticky bar, and no sideways overflow after a press. No list of element widths was recorded |
| Timing | 1440 by 900 px, no throttle | Press to recorded result, first chart in the document, longest task | In part, at another size. Press to recorded result for all three labs, three presses each, and the first chart of the density ladder. The longest task has no record |
| Timing | 375 by 812 px, 4 and 6 times throttle | The same three numbers. Estimates to compare with: Lab A 1.8 to 2.9 s, Lab B 0.4 to 0.8 s, Lab C 4 to 13 s [E] | Not run. The estimates stay estimates |
| Refusal | both | One typed refusal per lab prints in the alert region and Run reads as unavailable | Fleet intake only, at 1024 by 768 px [R]. The other two labs have no record in a browser. Shell tests 12 and 19 hold the behaviour in Node |
| Grids | 1440 by 900 px | The Overview cards and the catalog model articles read two by two | In part, at another size: the Overview cards read two by two at 1024 by 768 px [R]. The catalog articles have no layout record |
| Wide tables | 375 by 812 px | Lab A's ladder table has 14 columns and scrolls inside its own region. The region takes focus | In part: no sideways page scroll after a press. Whether the region takes focus has no record |
| Category labels | 375 by 812 px | Lab C's labels grow to "120 cars, 5 sites tested". Five of them share about 250 px | Changed by item R1: the chart names the rungs "24" to "120" and the table carries the site count. All five labels are drawn at 375 px [W] |
| Partial chart | both | A partial chart with absent values draws its hatches and keeps its tab stops in order | No record in a browser. Lab A test "M22" holds the sentence of a partial chart in Node |
| Shown to the owner | 1440 by 900 px | The two raw doubles on default presses (a guardrail harm in Lab A, the non-binding control line of Lab C). The direction sentence of the verdict strip for a measure where higher is better. Both are existing behaviour of shared builders | Not done. Since `c08f60d` the Scale lab prints neither raw double and its readout names the declared direction only, item R1. The owner has not been shown the pages |
| Observers | both | Each chart adds a resize observer that is never disconnected, up to six a press. The pattern is the site's own. Note the count after ten presses | No record |

The pane must be visible, so that frames are painted. The design stage and both browser rounds of the build
measured a hidden pane only. No screen reader, Safari or Firefox was used.

After the deployment two sweeps of the lesson links ran on the live site. The lead opened every lesson link of the
catalog (59) and the 9 page routes on the stable address in the in-app browser (Chromium engine) with the pane
hidden, so no frame was painted, by changing the address hash with no reload between them: 0 error pages, 59
lessons by page (Fleet day 18, Street lab 6, Four-area experiments 29, Four-area workspace 3, Scale lab 3), 6
header links, no console error, and exactly one lesson whose main heading did not match its document title [P]. An
inventory stage visited the modules downloaded from the live site on the fake DOM: 10 route visits, 59 lesson
visits and 4 deliberately bad links, 0 error pages from a good link, 0 network attempts, 0 engine run calls and 0
storage accesses. It saw the same defect: after another Fleet day lesson, `#/fleet-day?lesson=region-launch`
keeps that lesson's title in the main heading. The lead confirmed it on the live site after a reload and from
three starting pages and reproduced it on the fake DOM at `c79eccf` and at `c08f60d`; D1 sets no heading per
lesson, so the defect came in with the teaching frames. `1aeaace` fixes it and is not deployed. What stays not done
is a look by a person with a visible pane.

### R1 Independent review and its fixes. Landed in `c08f60d`

After the gates of `319b4a9`, an independent review read `c79eccf..319b4a9` through seven lenses. Each critical or
important finding was checked by two verifiers, one by running code and one by reading. 13 findings were confirmed
by both and none was refuted; 25 minor findings were listed. Several confirmed findings are one defect seen through
different lenses, which leaves 9 distinct defects. None moved a verdict number. None of the 1,937 tests at
`319b4a9` (1,936 passing, 1 existing todo) had caught any of them. All nine were fixed test-first in `c08f60d` [R: the commit message and the
release record]. Test titles added in this commit carry the numbers of the review's list: C1 to C13 for the
confirmed findings and M1 to M25 for the minor ones. Some minor findings were fixed in the same commit.

| # | Defect | Fix in `c08f60d` | Tests that hold it |
|---|---|---|---|
| 1 | A readout with no strip said "lies left of the band" and "left is better" over printed numbers that were all to the right | `renderVerdictReadout` takes `plotted`, default true. With `plotted: false` the caption names the measure and its declared direction only, and the visible outcome sentence states the interval as printed. The Scale lab passes `plotted: false` | Shell tests 8 ("Run records one result") and "contract 2" |
| 2 | At 375 px the page scrolled sideways after a press: 522 px wide on the response reserve, 406 px on the density ladder | `.scale-lab .fl-readout { grid-template-columns: minmax(0, 1fr); }` in `styles.css` | Shell test "C13: the verdict readout cannot widen the Scale lab page" |
| 3 | The density ladder drew its bars over both lines | Every bar series is drawn before every line series and its points. Legend, mark style and table keep the given order | Shell test "C12" |
| 4 | Fleet intake drew two of its three chart lines alike | The three line marks differ by shape: filled points with the swatch `line`, ring points with `line-ring`, square points with `line-square` | Shell test "C6: a three-line ladder gives every series its own legend swatch and its own drawing, with no dash and no colour alone" |
| 5 | Fleet intake booked the whole depot door stock to depot induction in any week with a place left over | The stock is split between the induction rate and the resource that holds the next tranche. Depot induction in the control now reads 290 vehicle-weeks and site power 20,106.17, against 1,819.5 and 18,576.67 before | Intake tests 1 (pins) and 3 ("each week the depot door stock is split") |
| 6 | Response reserve printed floating point residue, sometimes with the wrong sign, and a minutes-to-clear of 17 digits | A lever that removes nothing returns the no-lever value exactly. Minutes to clear read 0 on a day with nothing waiting at the event end. A tiny cell prints at two significant digits | Response tests "C1" and "C2, C11" |
| 7 | A caption claimed that rounded rows sum to the total | The caption says the rows sum "before each is rounded to a whole vehicle-week" | Intake test 11 ("the vehicle-weeks rows sum to the total before rounding") |
| 8 | The density ladder showed no visible map credit | `LAB.map` and `LAB.credit`. The attribution link and the licence name ODbL, with the credit sentence, in every state | Shell test "C9" and density test 12 |
| 9 | Side-preserving numbers of `953ebce` reached only some surfaces of the four-area card, so one value could print two ways | Opt-in. `metricValueText` and `valueWithMinutes` take `against`, default `null`, which gives the text of `c79eccf` byte for byte. `runLine` passes it only when `tools.sided` is true. Only the Scale lab opts in. Section 1.10 | Shell tests "C8" and "contract 2", with `test/scale-lab.legacy-text.pins.json`: 900 pairs of number text and 19 verdict views |

The lead's four follow-up changes after the fix pass, inside the same commit.

| # | Change | Effect |
|---|---|---|
| 1 | A test that read the repository history and wrote temporary files was replaced by the pinned text test "C8" | The suite reads committed pins and touches neither the history nor the temporary folder |
| 2 | The second chart line got ring points | No two lines of a ladder differ by ink alone |
| 3 | The density ladder names its rungs by number, "24" to "120", under the head "Fleet size, cars", and a chart draws every label when they all fit | Record size of Lab C 18 to 63 characters shorter. Shell test "M8" and density test 18 |
| 4 | The declared change of a directive reads "every vehicle request moved into the event" | The labels and digests of both pinned directive setups of Lab A moved, now `scale-spec:16d331de` and `scale-spec:2f4598cb`, and the interval ends of the first, whose change is not zero. No mean moved. Default press labels did not move. Response test 20 |

The version string of each lab stays 1.0.0: `scale-response-1.0.0`, `scale-intake-1.0.0`, `scale-density-1.0.0` [F].

Tests that failed first. The commit message states that each fix sat behind a test that failed first [R]. The red
run itself is not archived. As a check of the same claim, the four Scale test files of `c08f60d` were run without the
flag against a copy of `319b4a9` made with `git archive` [F].

| Test file | Tests | Pass | Fail | Skipped by flag |
|---|---:|---:|---:|---:|
| `test/scale-lab.test.mjs` | 34 | 18 | 15 | 1 |
| `test/scale-response.test.mjs` | 20 | 8 | 11 | 1 |
| `test/scale-intake.test.mjs` | 17 | 11 | 5 | 1 |
| `test/scale-density.test.mjs` | 21 | 10 | 8 | 3 |
| Together | 92 | 47 | 39 | 6 |

Every test named in the two tables above is among the 39 that fail on `319b4a9`. The 39 also hold the pin tests of
the three labs that `c08f60d` recorded again, and the tests of the minor findings.

| Field | Content |
|---|---|
| State | Landed in `c08f60d` |
| Files | 17: `src/model/scale-density.js`, `src/model/scale-intake.js`, `src/model/scale-response.js`, `src/ui/charts.js`, `src/ui/experiment.js`, `src/ui/scale-lab.js`, `src/ui/teaching-frames.js`, `styles.css`, the four Scale test files, the three lab pins files, and the two new files `test/scale-lab.legacy-text.pins.json` and `test/helpers/legacy-text.mjs`. 5,268 lines added and 170 removed, of which 4,387 are the new pins file [F: `git show --stat c08f60d`] |
| Protected files | None touched. No file under `src/core`, `src/instrument`, `src/legacy`, `src/runtime` or `src/data`, and under `src/model` only the three lab modules [F] |
| Acceptance | Full serial suite with the flag: 1,968 tests, 1,967 pass, 0 fail, 1 existing todo, 281.9 s [W]. The four Scale files: 92 of 92 with the flag [W] [F]. Python 89 pass, `ruff` clean, `git diff --check` clean [W] [F] |
| Byte checkpoint | **2,408,323 bytes, growth +89,468 bytes** [W] [F]. The commit added 4,422 bytes. Target 81,920 bytes, passed by 7,548. Hard stop 92,160 bytes, 2,692 left |
| Where the 4,422 bytes went | Response reserve 809, fleet intake 415, density ladder 475, `src/ui/scale-lab.js` 807, `src/ui/experiment.js` 1,185, `src/ui/charts.js` 592, `src/ui/teaching-frames.js` 73, `styles.css` 66. Sum 4,422 [F: the offline package of a `git archive` copy of `c08f60d`, built again with one file taken back to `319b4a9`; each number is the difference in bytes. `experiment.js` cannot be taken back alone, because the view of `c08f60d` imports `sidedText` from it: the pair of the two files gives 1,992, less 807 for `scale-lab.js` alone] |
| Commit | `c08f60d`, `fix: resolve the findings of the independent Scale lab review` |

### State of the six gates of the design

Section 9.2 of the design names six gates. As written, no package is built for release before all six have passed.
The site was deployed from `c08f60d` on the owner's instruction with gates 5 and 6 not passed, item I3.11.

| # | Gate | State at `319b4a9` | State at `c08f60d`, the deployed source |
|---|---|---|---|
| 1 | Full serial Node suite with the performance flag | Passed [W] | Passed: 1,968 tests, 1,967 pass, 1 existing todo [W] |
| 2 | Pack the offline page and the site, both checks, and the pack test | Passed. Offline page [W] [V]. Hosted folder and pack test [V] | Passed. Both packages and both checks [W] [F]. Pack test inside the full suite [W] |
| 3 | Python parity and boundary tests, `ruff` | Passed. Python [W] [V]. `ruff` [V] | Passed [W] [F] |
| 4 | `git diff --check`, staged diff checks, staged privacy scan with the patterns added for this wave | In part. `git diff --check` over the seven commits is clean [V] | In part. `git diff --check` over the eight commits is clean [F]. The release record states a clean staged scan of each of the eight commits of the wave [R]. The staged checks and the staged privacy scan of the documents commit belong to that commit, which is made; this record is part of it and holds no result of them |
| 5 | Browser check at 1440 by 900 px and 375 by 812 px with the final frames and painted frames | Not passed. Run in part at about 1024 by 768 px and at 375 by 812 px | Not passed. Run in part at 1024 by 768 px and at 375 by 812 px in a hidden pane, and on the hosted site, item I3.8. No painted frame, nothing at 1440 by 900 px |
| 6 | Phone acceptance at 375 by 812 px with 4 and 6 times throttling | Not run | Not run |

### I3.9 Commits

| Order | Commit | Message | Holds |
|---|---|---|---|
| 1 | `05113ab` | `feat: void a Scale lab press on a missing guardrail or a failed control` | S1.7a |
| 2 | `953ebce` | `feat: keep Scale lab readings on their side of a threshold and inside what the page offers` | S1.7b |
| 3 | `9fdb160` | `feat: put the Scale labs in the order of their story and say what follows from the inputs` | S1.7c |
| 4 | `27f6014` | `feat: add the response reserve lab` | I3.1 |
| 5 | `1a81ae8` | `feat: add the fleet intake lab` | I3.2 |
| 6 | `319b4a9` | `feat: add the density ladder lab` | I3.3 |
| 7 | `c08f60d` | `fix: resolve the findings of the independent Scale lab review` | R1 |
| Outside the wave | `1aeaace` | `fix: reset the Fleet day heading when a launch lesson opens` | A Fleet day fix made after the deployment. Not deployed |
| 8 | The documents commit on top of `1aeaace`, made | Planned as `docs: record the Scale lab design, model notes and counts` | I3.5 and I3.10, with the source of truth entry in the same commit as the work it records |

The table counts the commits after the shell, `2caeac6`. Rows 1 to 7 with the shell are the eight commits of this
wave. Row 8 is the documents commit, made on top of `1aeaace` after the deployment. It changes no site file, so it
leaves the deployed site as it is and its site inputs equal those of `1aeaace`. `1aeaace` does change one site file, so a site built from HEAD now differs from
the deployed site in `src/ui/studio.js`. Each commit follows the rules of section 0.2. No generated package, cache or
working file is staged. This record is part of the documents commit, so it cannot state the hash of that commit.

### I3.10 Release record and handoff. Committed in the documents commit

| File | Content |
|---|---|
| `docs/FLEETLAB_SCALE_LAB_RELEASE_2026-09-27.md` | Modelled on the D1 record: release identity, what the deployment publishes, every gate with its command and result, the byte ledger as archived checkpoints, the review and its fixes, the browser evidence, publication and readback, what was not done, known open items |
| `docs/FLEETLAB_SCALE_LAB_HANDOFF_2026-09-27.md` | The Scale lab handoff |
| `CODEX_HANDOFF.md` | A new top section: branch and HEAD; what landed, commit by commit; the commands to reproduce the gates; every decision of section 12 of the design with its state, which is assumed at the lead's recommendation, not ratified, unless the owner has ruled; the deployment; the next work |
| `HERMES_SOURCE_OF_TRUTH.md` | Updated in I3.5: a new entry at the head of section 7.5 and updated header rows. The handoff points to it and does not repeat it |

What the handoff was to state plainly, and what now holds.

| Point | State at the time of writing |
|---|---|
| 1. Nothing was pushed or deployed, and both need the owner's word | Changed. The owner's instruction of 2026-09-27 covered the deployment. Nothing was pushed, and a push still needs the owner's word |
| 2. The branch carries two waves, and a deploy publishes both | Happened. The deployment published the teaching frames of the teaching-frame wave, built on `c79eccf` and recorded as local only until then, together with the Scale lab. The release record lists both |
| 3. Which gates of section 9.2 of the design have run on the integrated tree | The table above gives the state at `319b4a9` and at `c08f60d` |
| 4. Every decision is assumed at the lead's recommendation, not ratified, unless the owner has ruled | Holds. The owner has ruled on none |

### I3.11 Push and deployment. Deployment done, push not done

On the owner's instruction of 2026-09-27 the lead deployed the site built from `c08f60d` by the standing procedure:
direct upload with the pinned tool version, a readback of every public file hash, a check of the response headers,
and a check of the hosted parity numbers [P]. In the smoke, one teaching-frame lesson was opened by its link. Two sweeps
of all 59 lesson links on the live site followed, one in a real browser with the pane hidden [P] and one on the fake
DOM, item I3.8; both found one Fleet day defect older than the Scale lab, fixed in `1aeaace`, which is not
deployed [R: the message of `1aeaace`].

| Item | Value |
|---|---|
| Pages project | `fleetlab`, Direct Upload, Production |
| Deployment | `19e17ac6-d617-4789-9260-ca259c53e076` |
| Addresses | Stable `https://fleetlab.pages.dev/`, immutable `https://19e17ac6.fleetlab.pages.dev/` |
| Deployed source | `c08f60d8830df877fac2c7321bb47d75a5ae56ad`. Pages branch label `feat/fleetlab-playground` |
| Upload tool | Wrangler 4.135.0 |
| Shipped inputs against the commit | `git diff --quiet HEAD` over `src`, `styles.css`, `index.html`, `media` and `tools` reported no difference at upload, when HEAD was `c08f60d` [R: the release record] |
| Package | 99 files with `_headers`, 3,349,602 bytes |
| Readback | 98 of 98 public files match the local package by SHA-256 and size, on both addresses [P] |
| Hosted inventory SHA-256 | `5c071dc69e353f6118ab43078c12d2470c9d709cf2ac7c501fe4fb807c669da3` [P], over one row for each of the 99 files of the package, `_headers` included: path, file SHA-256 in lower-case hex and size in bytes, separated by NUL, each row ended by a newline, rows sorted by path. Reproduced on a package built from `c08f60d` outside the tree [F]. Over the 98 public files alone the same rows give another digest |
| Response headers | Content security policy with `connect-src 'none'` and `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, same-origin opener policy, `cache-control: public, max-age=600` [P] |
| Hosted smoke | All three labs pressed: `scale-spec:b4c7f5da`, `scale-spec:1aa8c833`, `scale-spec:443de567`. Fleet day seed 42: 95 completed, 176 unserved, 4 waiting, 9 in progress of 284. A teaching-frame lesson opened by its link. No console error [P] |
| Previous Production, the rollback target | `dd4bfa44-7226-4502-9d66-01bb1790f2b6`, the D1 release, source `b99ab04`. A rollback is the owner's action in the Pages dashboard and rewrites no history |
| Push | Not done, not authorized. The local copy of the remote branch `feat/fleetlab-playground` stands at `790573e`, an ancestor of `c08f60d`, so a push would be a fast-forward. Until then a reader who follows the site to the public repository will not find `c08f60d` there |
| After the deployment | `1aeaace` fixes the Fleet day heading after a launch lesson. It is on no remote branch and not deployed. Deploying it is a new release by the same procedure and needs the owner's word |

---

## 6. If the bytes do not fit

The package passes the target and stays under the hard stop: +89,468 bytes at `c08f60d` against 81,920 bytes and
92,160 bytes [W] [F]. It was +85,046 bytes at `319b4a9` [M] [W]. The lead's recommendation is to grant the
difference, decision 3 of the design. That decision is assumed at the lead's recommendation, not ratified. This
section is the procedure for the other cases.

One line inside the package is passed. On the estimate of item R1, Lab C stands at 17,439 bytes against its own
hard limit of 17,408 bytes, 31 bytes past it [E]. The plan names no procedure for a lab past its own hard limit
while the package stays under its hard stop. The owner can grant the 31 bytes as part of decision 3, or ask for a
trim of at least 31 bytes in `src/model/scale-density.js` with its pins recorded again. Neither was done.

| Growth | Action |
|---|---|
| At or under 81,920 bytes | None |
| Over 81,920 and at or under 92,160 bytes | Record the owner's decision and the number. If the owner declines the grant, apply the trims of section 8 of the design in order, then remove the rates-only note of Lab A with its arithmetic, and record the pins of the trimmed labs again |
| Over 92,160 bytes | Cut Lab C whole |

Cutting Lab C:

| Step | Edit |
|---|---|
| 1 | Remove its import and its entry from `src/ui/scale-labs.js`. Delete `src/model/scale-density.js` and its two test files |
| 2 | Remove its entry from `test/teaching-frames.grounding.json` |
| 3 | The count pins become 58 and plus 2. The shell test expects two labs. The run budget test drops its `density-ladder` line. Shell test "C9" has no lab with a map left and keeps only its second half, that a lab without a map shows no credit. "Start here" links to fleet intake |
| 4 | The Overview card, the Overview scope sentence, the thesis line and the catalog article say two labs and drop the density clause. The unknowns of labs A and B drop their pointer to the density ladder |
| 5 | README counts become 58 |
| 6 | Since the site is deployed, a cut is a new release: the same deployment procedure, item I3.11 |

Without Lab C the growth would be about 72,000 bytes on the numbers of item R1 [E]: 89,468 less 17,439. It was about
68,100 at `319b4a9`. No trim and no cut was applied in this build.

---

## 7. Byte checkpoints in one table

Every number in this table is a count of bytes. The third column is the size of the offline package, built with
the repository's own packer writing outside the tree. The growth is counted from the baseline. The last column
gives the measured size of a part against its allocation.

| After item | Commit | Offline package | Growth | Line |
|---|---|---:|---:|---|
| Baseline | `c79eccf` | 2,318,855 | 0 | |
| S1.1 to S1.6 | `2caeac6` | 2,357,617 | +38,762 | shell 23,875 of 25,600, stubs 14,887 |
| S1.7a | `05113ab` | 2,358,553 | +39,698 | |
| S1.7b | `953ebce` | 2,359,746 | +40,891 | |
| S1.7c | `9fdb160` | 2,360,022 | +41,167 | shell 26,280 of 25,600 |
| I3.1, Lab A | `27f6014` | 2,376,259 | +57,404 | Lab A 21,838 of 20,480 |
| I3.2, Lab B | `1a81ae8` | 2,391,500 | +72,645 | Lab B 19,964 of 19,456 |
| I3.3, Lab C | `319b4a9` | 2,403,901 | +85,046 | Lab C 16,964 of 13,312 |
| R1, review fixes | `c08f60d` | **2,408,323** | **+89,468** | +4,422 in the commit: Lab A +809, Lab B +415, Lab C +475, shared files +2,723. Lines after it [E]: shell 29,003 of 25,600; Lab A 22,647 of 20,480; Lab B 20,379 of 19,456; Lab C 17,439 of 13,312, 31 past its hard limit of 17,408 |
| Target | | | 81,920 | passed by 7,548. It was passed by 3,126 at `319b4a9` |
| Hard stop | | | 92,160 | 2,692 left. It was 7,114 at `319b4a9` |

The deployed offline page of `c08f60d` has SHA-256 `4828cded63f5c23f99a8d13cc32716f587717f57847dd79bdba59215786800b5`
[W] [F]. The hosted package is 99 files and 3,349,602 bytes [W] [F]. `1aeaace`, outside the wave and not deployed,
adds 27 bytes: its offline package is 2,408,350 bytes, growth +89,495, 2,665 bytes under the hard stop [F].

The whole offline file has its own cap, which this wave did not change [R: the release record]. The numbers left
are arithmetic on the checkpoints [F].

| Line | Bytes | At `c08f60d` |
|---|---:|---|
| Offline cap | 2,621,440 | 213,117 left |
| Reserved for other work, inside the cap | 135,904 | Untouched |
| Unassigned after this wave | 77,213 | It was 166,681 at the baseline `c79eccf` |

Every row from `2caeac6` on was measured in the worktree after its commit [W], and the commit message of each of
the eight commits states the same number [R]. The rows to `319b4a9` were also measured at design on a working copy
built in the same order [M]. The two sets of measurements agree in every row. The row of `319b4a9` was measured
once more while this record was first written [V], and again on a `git archive` copy of that commit while it was
brought in line [F]. The row of `c08f60d` was measured again on the working tree while its site files equalled that
commit, before `1aeaace` landed [F]. The split of the 4,422 bytes of `c08f60d` is measured [F]; the lines after it add that split to the lines
of `319b4a9`, which were measured by another method, so they are estimates [E]. A byte claim in a release record is
an archived checkpoint, never an estimate.

---

## 8. Known open items and what was not done

Open items of the deployed build, each known at the time of writing and none fixed.

| # | Item | Where |
|---|---|---|
| 1 | Going back to a lesson address discards the recorded result and the edited setup. A lesson link means the same on Fleet day | `src/ui/studio.js` |
| 2 | A typed governing ratio of more than 12 decimals is echoed whole in the inputs table | Density ladder |
| 3 | Where 12 decimals still read on a threshold, `sidedText` moves the last decimal one step toward the value's own side, so the text is off by less than 1e-12 | `src/ui/experiment.js` |
| 4 | The event load control declares a step of 0.1 and accepts typed steps of 0.01 | Response reserve |
| 5 | Table 1, "One fleet, several counts", can print a row one off from its two parts after rounding. Its caption makes no sum claim | Fleet intake |
| 6 | Pages older than the Scale lab still print a long raw number for a tiny value. That is the rule of the site, held by existing tests. Only the Scale lab prints two significant digits | Four-area card on other pages |
| 7 | `playground/fleetlab/README.md` carries facts and wording older than this wave: the former address `fleetlab-playground.pages.dev`, an older release line and a byline. Left for the owner | README |
| 8 | The lesson snapshot kept outside the tree by the teaching-frame wave still counts 56 lessons | Outside the repository |
| 9 | Lab C stands 31 bytes past its own hard limit on the estimate of item R1 | Section 6 |

Not done at the time of writing: a push; a pull request or a merge to `main`; a painted frame; any check at 1440 by
900 px; a throttled phone profile or a physical phone; a screen reader, Safari or Firefox; a security scan of this
range (the review had one packaging and security lens); the broad Python suite of the repository (only the two
playground files ran); a look by a person with a visible pane; a full serial run at `1aeaace` with zero failures; a
deployment of `1aeaace`; an owner ruling on any decision. The lesson links were swept after the deployment in a real
browser with the pane hidden and on the fake DOM, item I3.8.

## Recommendation

Keep the eight commits as built, and keep deployment `19e17ac6` live unless the owner's first look in a visible
browser finds something that reads wrong; the rollback target is `dd4bfa44`. The commits landed in the order of this
plan: the shell, then the three amendment commits before any lab, because those change the shared contract and the
sentences that lab tests read, then the labs in the order A, B, C with a byte measurement after each, then the fixes
of the independent review in one commit behind tests that fail on `319b4a9`. The committed files carry the digests of
section 4, so the pins decide any later difference.

The documents commit on top of `1aeaace` is made. It changes no site file. Treat gates 1 to 3 of the design as
passed at `c08f60d`, gate 4 as run in part (its staged checks belong to the documents commit, and this record, part
of that commit, holds no result of them), and gates 5 and 6 as not passed, although the site is live on the owner's
instruction. Decide
the push separately: the deployed source is on no remote branch. Treat `1aeaace` as its own small release when the
owner wants it live. Record every decision as assumed at the lead's
recommendation, not ratified, until the owner rules, and put decision 3 first, with the 31 bytes of Lab C.

## Top risks + mitigations

| Risk | State | Mitigation |
|---|---|---|
| The lab files are lost before they land | Closed | The labs are committed in `27f6014`, `1a81ae8` and `319b4a9`, and fixed in `c08f60d`. The commits are the durable copy, and section 4 gives the digest of every file at `c08f60d` |
| A lab commit edits a shared file and two lines of work collide | Closed | Every lab surface is driven by `LAB`. Each lab commit holds the three files of its lab. The one shared edit, the run budget test, was planned for `319b4a9`. The shared edits of `c08f60d` came after every lab had landed |
| A lab is rebuilt from prose and its pins move | Open for later changes | The pins file lands with the module. A moved pin is a failed test. The digests of section 4 name the files that were deployed |
| An amendment is applied to the wrong base | Closed | The three amendment commits sit directly on `2caeac6` [V] |
| The amendments change the text of an existing surface | Closed for numbers, open for one glossary entry | Since `c08f60d` side-preserving numbers are opt-in and only the Scale lab opts in. Shell test "C8" holds 900 pinned pairs of number text and 19 verdict views of the pages that existed before [F]. One glossary entry of `9fdb160` still changes on every page. The owner has not seen it in a browser |
| A timing test fails in a full run | Open, and seen twice at `1aeaace` | The flagged tests run serially on an idle machine, and a failure is rerun in isolation before it is believed. None failed in the full suite at `c08f60d` [W] or in the serial run of the four Scale files [F]. In the first full run of `1aeaace` the timing test of the response reserve read a longest block of 9.34 ms against 8 ms while other work loaded the machine, and passed on its one isolated rerun [R: the message of `1aeaace`]. In the second, on an otherwise idle machine, a four-area runtime timing test read 11.34 ms against 8 ms and passed its one isolated rerun at 5.73 ms and 5.52 ms [W] |
| A timing harness misreads the page | Open | A harness that watched the whole page made `c08f60d` look 4 to 8 times slower. Time the status line, and read two harnesses before believing a slowdown |
| Bytes drift further past the target | Open | Measure after every item. 2,692 bytes stay under the package hard stop. Lab C is 31 bytes past its own hard limit [E]. Trims are ordered and measured |
| Browser and phone behaviour is read as accepted | Open, and now public | The site is live with gates 5 and 6 of the design not passed. Item I3.8 says row by row what was measured and what has no record. Every browser reading was taken in a hidden pane. Phone timing under throttle stays an estimate. The owner's look in a visible browser comes first, with the rollback target `dd4bfa44` at hand |
| The deployed source is not public | Open until a push | The deployment published `c08f60d`, which is on no remote branch. The release record and item I3.11 say so. A push of `c08f60d` to `feat/fleetlab-playground` would be a fast-forward, and it needs the owner's word |
| A deploy publishes more than the owner meant | Recorded | The deployment published two waves at once: the teaching frames of the teaching-frame wave and the Scale lab. The release record lists both waves and their commits, so the owner can see what went live |
| The build is read as ratified | Open | Every decision is marked as assumed at the lead's recommendation, not ratified. The deployment is not a ratification. Each amendment group, each lab and the review fixes are one commit each |
| A declined decision is undone by one revert | Open | Since `c08f60d` the reverse patch of every earlier commit of the wave no longer applies cleanly [F]. A revert may need a merge by hand and a rerun of the four Scale test files, then a new deployment |
| Machine paths or private file names leak into a public document | Open for every later commit | This record holds no location on any machine and names no working file. The staged scan gains the patterns of item I3.5 |

## Next 3 actions

1. The owner opens `https://fleetlab.pages.dev/#/scale-lab` in a visible browser at desktop and phone size, presses
   Run on each lab, and rolls back to `dd4bfa44` if anything reads wrong. The lead then completes item I3.8: the
   checks at 1440 by 900 px with painted frames, the phone checks at 375 by 812 px with 4 and 6 times throttle, and
   every row that has no record, so that gates 5 and 6 can pass.
2. The owner rules on the decisions of section 12 of the design, first on decision 3 with the 31 bytes of Lab C,
   says whether to push `claude/fleetlab-scale-lab`, and says whether to deploy `1aeaace`. Until the owner rules,
   every decision stands as assumed at the lead's recommendation, not ratified, and nothing is pushed.
3. On the owner's word, the lead deploys `1aeaace` from the documents commit on top of it, whose site inputs equal
   those of `1aeaace`, as its own small release: a full serial run whose only failures, if any, are timing tests
   that pass their one isolated rerun, both package checks, and a readback of every public file on both addresses,
   with `19e17ac6` as the rollback target.
