# FleetLab Scale lab: model notes for the three labs

Written 2026-09-27 for branch `claude/fleetlab-scale-lab`. These notes describe commit `c08f60d`. They were first
drafted against commit `319b4a9`, the last of the seven build commits, and were brought in line with `c08f60d` after
the independent review of section 15. Open `#/scale-lab` in the Playground. The route holds three labs behind one
generic view, in the order of their story: **density ladder**, **fleet intake**, **response reserve**. Nothing runs
on load or on navigation. The reader presses **Run the paired test**.

Commit `c08f60d` is deployed. On 2026-09-27, on the owner's instruction, it became the Production deployment of the
Pages project `fleetlab`: stable address https://fleetlab.pages.dev/, immutable address
https://19e17ac6.fleetlab.pages.dev/. Section 16 gives the deployment and its readback in short. The release record,
`docs/FLEETLAB_SCALE_LAB_RELEASE_2026-09-27.md`, holds the full account. Nothing was pushed. Branch
`claude/fleetlab-scale-lab` exists only on the local machine, so a reader who follows the site to the public
repository will not find `c08f60d` there. Two kinds of reading in these notes were taken on the hosted site, and
their source says so.

FleetLab is an independent, synthetic teaching simulator. It is not affiliated with any operator, vehicle maker,
regulator or utility. Every result of these labs is `NOT_EVIDENCE`, simulation only, decision authority `NONE`.
Every input of the labs is a teaching assumption unless its source row says otherwise. One input is not an
assumption: the road distances of the density ladder, which come from the shipped Fleet day road table. Two fixed
inputs of the response reserve lab take the value of a public definition, and section 12.3 names both.

The owner has not ratified the design decisions of this wave. Wherever these notes mention a decision, it is
**assumed at the lead's recommendation, not ratified**.

The roles named here (the lead, a lab designer, a reviewer, a verifier) are stages of one assisted design workflow
run for one owner on one laptop. The review of section 15 is independent of the build stage: its readers wrote none
of the code they read. It is not a human review. No independent human review has taken place.

Related documents of this wave: the design, `docs/plans/2026-09-27-fleetlab-scale-lab-design.md`, the
implementation plan, `docs/plans/2026-09-27-fleetlab-scale-lab-plan.md`, and the Scale lab item of
`playground/fleetlab/ARCHITECTURE.md`. The status entry of this wave belongs in section 7.5 of
`HERMES_SOURCE_OF_TRUTH.md`. The notice for the map data is `docs/FLEETLAB_BAY_AREA_MAP_DATA.md`. The release record
is `docs/FLEETLAB_SCALE_LAB_RELEASE_2026-09-27.md`.

---

## 1. How to read these notes

### 1.1 Where a number comes from

Every number carries one of these sources. Test files and pins files are in `playground/fleetlab/test/`.

| Source, as written in these notes | Meaning |
|---|---|
| held by test `scale-lab.test.mjs` | A committed test of the shared contract and the generic view asserts it |
| held by test `scale-density.test.mjs` | A committed test of the density ladder asserts it, against `scale-density.pins.json` where a value is pinned |
| held by test `scale-intake.test.mjs` | The same for fleet intake, against `scale-intake.pins.json` |
| held by test `scale-response.test.mjs` | The same for response reserve, against `scale-response.pins.json` |
| measured during design | Measured on a working copy while the labs were designed and reviewed, before the independent review of section 15. Node 22.22.0, one laptop. A reader cannot rerun it from the repository unless a test also holds it |
| measured on the integrated tree | Measured by the lead at commit `319b4a9`, after the three labs had landed and before the review fixes |
| measured on the final tree | Measured by the lead on the working files of commit `c08f60d`, after the review fixes. Node 22.22.0, one laptop |
| measured for these notes | Measured at commit `c08f60d` while these notes were brought in line with it. The lab modules ran in Node through `LAB.derive` and `LAB.steps`, from files equal to that commit. The tests, the packages and the timings ran on an exact copy of the commit's `playground/fleetlab` folder, taken with `git archive`. A value quoted from commit `319b4a9` was read the same way from a copy of that commit. Node 22.22.0, the same laptop, which carried other work at the time |
| measured on the hosted site | Measured by the lead on https://fleetlab.pages.dev/ after the deployment of section 16, as the release record states |
| read in source for these notes | Read in the committed source at commit `c08f60d` |
| estimate | Not measured |

A test marked "with the flag" runs only with `FLEET_PLAYGROUND_PERF=1`.

A figure marked "measured during design" was taken before the review fixes. The fixes changed no engine call, no
primary measure, no guardrail, no margin, no allowance and no seed. They changed two refusal rules for typed values,
two descriptive readings (the depot door rows of the fleet intake table "The gate that binds" and the minutes to
clear of response reserve), the text of several cells, captions and notes, and the words of one declared change.
Where a fix could move a design figure, the row says whether the figure was measured again.

### 1.2 Words used in every lab

| Word | Meaning |
|---|---|
| Press | One use of Run. It holds one main paired test and every shipped control of the lab |
| Arm | One side of a paired test. The control arm is the baseline. The other arm is the tested arm |
| Paired seeds | Both arms share the same random draws, so a difference comes from the one changed setting |
| Primary measure | The one measure the verdict is read on, with its margin |
| Margin | The smallest change of interest. A change is read only when the whole interval lies past it |
| Guardrail | A second measure with an allowance on harm. A harmed guardrail cannot be bought back by the primary measure |
| Governing ratio | Load over capacity, or a lag over the interval between arrivals, that decides whether a mechanism shows. The lab derives the other inputs |
| Refusal | `derive` returns no setup and nothing runs. The page prints "Not available: outside what this lab can read: reason." and Run is disabled |
| Sided text | A printed number that keeps its side of a threshold. Section 2 gives the rule |
| Rates only | Arithmetic on rates with no chance in it. A closed form, not a run |

Outcome words of the instrument and what the page prints for each:

| Outcome | Page reading | Recommendation that can follow |
|---|---|---|
| `IMPROVED` | Improved beyond the margin | `ADVANCE_TO_NEXT_TEST`, or `HOLD` when a guardrail went past its allowance |
| `UNCHANGED` | Within the margin | `NO_RECOMMENDATION`, or `HOLD` when a guardrail went past its allowance |
| `REGRESSED` | Worse beyond the margin | `HOLD` |
| `INCONCLUSIVE` | Interval crosses the margin, not decided | `RUN_MORE_EXPERIMENTS`, or `HOLD` when a guardrail went past its allowance |

A recommendation word is a word of the teaching instrument. It is never permission to act.

---

## 2. What the three labs share

Source for this section: held by test `scale-lab.test.mjs`, 34 tests. The file held 22 tests at commit `319b4a9`.
The review fixes added 12.

| Rule | Value |
|---|---|
| Module | Each lab is one page-only file under `playground/fleetlab/src/model/` that exports one frozen descriptor, `LAB`. No lab is reachable from the worker |
| Before a run | `derive(config)` is pure and cheap and never throws. It returns the inputs table and the frozen declared tests, or a refusal with its reason. The printed refusal is at most 240 characters, for every refusal a reader can reach or type |
| Verdict | Every verdict comes from the existing paired instrument, through `src/model/scale-contract.js`. No lab calls the instrument and there is no second verdict engine |
| Interval | 2,000 bootstrap resamples. The declared test says before any run: "The 95% interval is a bootstrap label, nominal at this seed count." |
| Replay | The first seed's control arm runs twice in every paired test. A difference gives `REPLICATION_MISMATCH` and no reading |
| Controls | Every shipped control runs in every press. One of them is a null control |
| Missing guardrail | A declared guardrail that is missing from any run voids the press: `INVALID_EXPERIMENT`, no outcome, no recommendation |
| Failed control | A shipped control that does not read as declared voids the press. A null control has failed when any paired difference of the primary or of a guardrail is other than 0 |
| Absent value | A value that is not a finite number is left out, never written as zero |
| Numbers | A number never reads as equal to, or across, the threshold it is read against, and never as zero when it is not zero. The rule is sided text, below |
| Verdict readout | The Scale lab draws no strip under the verdict. Its readout names the measure and the declared direction only, and its visible outcome sentence states the interval as printed |
| Reading line | At most 240 characters, and it keeps its interval. A line that is still too long drops its guardrail sentence first |
| Next test | A next-test sentence names only what the page offers: no second declared change and no seed set the reader cannot choose |
| Map credit | A lab that reads the Fleet day road map shows the map credit and the licence name on the page in every state, a refused setup among them. A lab that reads no map shows none |
| Record | At most 65,536 characters of JSON. It carries `NOT_EVIDENCE`, `NONE`, the frozen test, its digest and its label. The digest is identity, not authentication |
| Engine budget | A lab that calls the Fleet day engine reports its engine runs, from 1 to 120 a press |
| One press | One progress meter a press, which only rises. A press that is no longer the current job is ignored. An error while a recorded result is drawn reaches the alert, records nothing and keeps the previous result |
| Changed setup | A result is marked as from another setup only while the setup on the page differs from the one the result used. A control changed back to that value removes the mark |

Sided text. The function `sidedText` of `src/ui/experiment.js` prints a number at its declared decimals and adds one
decimal at a time while the text would read as equal to, or across, a threshold that the value is not equal to or
across. A value that would round to zero starts at two significant digits. The text holds at most 12 decimals, groups
thousands and is never the raw double. The rule is opt-in. The two shared text functions take the thresholds as an
option whose default asks for nothing, and the reading line passes them only for a page that asks. Only the Scale
lab asks. Section 15.3 says what that means for the pages that existed before.

| Value | Thresholds | Printed | Source |
|---|---|---|---|
| Interval end 0.02004 of plan on a made-up result, margin 0.02. Three decimals would print the margin itself | -0.02 and 0.02 | +0.02004 | held by test `scale-lab.test.mjs` |
| Guardrail harm of 13.039 idle weeks on the same made-up result, allowance 13. One decimal would print the allowance itself | 13 | +13.04 | held by test `scale-lab.test.mjs` |
| Guardrail harm 0.00003417 of the default press of response reserve | 0.05 | +0.000034 | measured for these notes |
| Change of 0.0417 trips per 100 car-hours in the non-binding control of the density ladder | -3 and 3 | +0.042 | measured for these notes |

What follows from the inputs is printed under the verdict of every press, under the heading "Set by the inputs,
not found by the run", before the chart and the tables.

In every lab the first press is a demonstration. Its reading cannot change anywhere in the readable region, because
the region was chosen so that the mechanism shows. Each lab gives the reader one place where a reading does move.
Source: measured during design, and measured again for these notes at commit `c08f60d` in the region sweeps of
section 7.1. Every count of the table below came out the same.

| Lab | Default press | Why it is set by the inputs | Where a reading moves |
|---|---|---|---|
| Density ladder | Capacity improved at 25 of 25 settings of the reader grid | The control depot stands at about 2.4 times its capacity by hand | The column "Depot load by hand, control" beside trips per car, and the two siting comparisons |
| Fleet intake | First arm improved and advanced at 351 of 351 accepted setups | The gain is the room times the vehicles that were waiting | The table "Lead-time mismatch". The second arm is held at 183 of 351 accepted setups |
| Response reserve | Improved at 152 of 160 settings of the page grid | The reserve is sized to bring event load to capacity. A directive removes the ask at its source | The table "Landing in time": both levers at five landing times |

The three fleets are not on one scale: 120 cars, 624 vehicles and 6,000 vehicles. No number of one lab is set
beside a number of another.

---

## 3. Density ladder

Id `density-ladder`. Version `scale-density-1.0.0`. Title "Density ladder: one depot cell, five fleet sizes".
File `src/model/scale-density.js`.

### 3.1 The question

One depot cell takes five times the cars and five times the requests. At which fleet size does a depot pass its
capacity, what does the fleet lose past it, and at equal total capacity does siting matter?

The capacity comparison shows that a limit was passed. It does not show how small a depot would have served the
same trips. The page says so in the first note of that press.

### 3.2 What the model is and is not

| Element | What it is |
|---|---|
| Kind | A composer over the unedited Fleet day engine, called as `simulateBayAreaOperations(config, {capture: false})`. The lab edits no engine file |
| Entities | The engine's own: cars, requests, depot sites with four serial stages, depot visits |
| Cell | Nine neighbouring places of the Fleet day road map: places 3 to 11 of the Fleet day place list in its own order. No airport place. The module holds no place name |
| Rungs | 24, 48, 72, 96 and 120 cars, at equal requests per car |
| Clock | Every engine run is 8 hours from 19:00, outside both engine rush windows. Minutes 240 to 480 are measured and are called hours 5 to 8. Minutes 0 to 240 are a settling period |
| Draws | The engine seed is one keyed draw per declared seed. The lab draws nothing else |
| Run configuration | The Fleet day default with only the declared fields replaced. Every other field stays at its Fleet day default |

Source: held by test `scale-density.test.mjs`.

| What it is not | Why |
|---|---|
| A city, a market or a fleet of thousands | The engine stops at 120 cars. The ladder is a factor of five inside one depot cell |
| A second day, or another window | One window of 8 hours from a fresh start. Another window gives another size of effect, section 10.2 |
| A model of how riders respond | Requests per car are equal at every rung, so density shows as pickup distance and idle car time, not as added trips |
| A model of where cars or sites would be moved | Idle cars wait where a trip or a depot visit ends and use the nearest site. The engine spaces the sites |
| A model of lead time or money | The lab has neither. Lead times are the subject of the fleet intake lab |
| A description of the nine places | Road distances only. No fleet, depot or service in those places is described |

### 3.3 Inputs

Source: the inputs table that the lab returns at commit `c08f60d`, measured for these notes. Held by test
`scale-density.test.mjs`: the typed constants against the engine defaults, the sizing rule on four setups, the
fields of the engine configuration that the lab replaces, the refusals, the decimals of the two ratios, the side
of every printed load and the words on the prompt pickup window. A change to a Fleet day default therefore fails a
test by name.

| Input | Unit | Default | Range | Who sets it |
|---|---|---|---|---|
| Comparison | choice | capacity | capacity, sites added, one site | The reader |
| Street load at the first rung | fraction of car time | 0.68 | 0.64 to 0.72, step 0.02. Any number inside the band is accepted. The table prints it at the decimals it holds, two at least: 0.68, 0.674 | The reader. Governing ratio |
| Depot load at the first rung | fraction of capacity at the busier site | 0.50 | 0.40 to 0.60, step 0.05. Any number inside the band is accepted. Printed at the decimals it holds, two at least: 0.50, 0.505 | The reader. Governing ratio |
| Requests per car-hour | requests per car-hour | 1.172 | follows from street load | Sizing rule: street load over busy hours per trip by hand |
| Base site power | kW per site | 170 | follows from depot load, in steps of 10 kW | Sizing rule: work at the busier site over depot load |
| Base site ports | ports per site | 4 | follows from site power | Sizing rule |
| Base site bays | bays per site | 3 cleaning, 2 software, 2 upload | follows from depot load, whole bays | Sizing rule |
| Depot load by hand, control plan by rung | fraction of capacity at the busier site | 0.47, 0.95, 1.42, 1.90, 2.37 | follows. Printed on its side of 1 | Sizing rule, after whole units |
| Depot load by hand, tested plan at 120 cars | fraction of capacity at the busier site | 0.47 | refused past 0.9. Printed on its side of 0.9 | Sizing rule, after whole units |
| Road distances between the nine places | km | the Fleet day road table | fixed | Fleet day map: frozen OpenStreetMap road geometry of a real region, under its open licence. Distances only. The page also carries the credit line given under this table |
| Places in the cell | places | 9 | fixed | Fixed teaching assumption |
| Run length and measured window | hours | 8 from 19:00, hours 5 to 8 measured | fixed | Fixed teaching assumption. The Fleet day default start is 7:00 |
| Requests over the run | multiplier | flat, peak multiplier 1, traffic multiplier 1, clear weather | fixed | Fixed teaching assumption. The Fleet day default peak multiplier is 1.6 |
| Road speed | km per hour | 38 | fixed | Fixed teaching assumption, the Fleet day default |
| Rider patience | min | 12 | fixed | Fixed teaching assumption, the Fleet day default |
| Prompt pickup target | min | 15 | fixed | Fixed teaching assumption |
| Prompt pickup window | min of the run | requests made in minutes 240 to 464 | fixed | Fixed teaching assumption. A request made in the last 15 minutes of the window has no full 15 minutes to be picked up in, so it is not counted. The inputs row "Held fixed" says so |
| Car battery and energy use | kWh, kWh per km | 84 and 0.24 | fixed | Fixed teaching assumption, the default car of Fleet day |
| Boarding | min | 2 | fixed | Fixed teaching assumption, the Fleet day default |
| Start charge and charge target | percent of battery | 85 and 85 | fixed | Fixed teaching assumption. The Fleet day default start charge is 65. Cars start charged to the target, so site power can be sized by hand |
| Reserve charge | percent of battery | 15 | fixed | Fixed teaching assumption, the Fleet day default |
| Trips between depot visits | trips | 2 | fixed | Fixed teaching assumption. The Fleet day default is 3 |
| Depot work per visit | min | cleaning 8, software 12 on every second visit, upload 6, one ready minute | fixed | Fixed teaching assumption, the Fleet day defaults |
| Port power | kW per port | 50 | fixed | Fixed teaching assumption, the Fleet day default |
| Pickup allowance in the sizing rule | empty km per rider km | 1 | fixed | Fixed teaching assumption. An allowance, not a result |
| Refusal ceiling | fraction of capacity by hand | 0.9 | fixed | Fixed teaching assumption |
| Paired seeds | seeds | 10, from 31001 to 31010 | fixed | Fixed teaching assumption |

The map credit. The page of this lab carries one credit line in its introduction, under the sentence on teaching
assumptions, in every state, a refused setup among them: "© OpenStreetMap contributors · ODbL. Road distances in
this lab come from the frozen Fleet day road table. Distances only; no service in those places is described." The
first words link to the OpenStreetMap copyright page. The two other labs read no map and show no credit. Before the
review fixes the page named the map only in the source cell of the inputs row "Road distances", inside the setup
disclosure, and showed no licence name. Source: held by test `scale-lab.test.mjs`, which reads the line in every
state of the view, and by test `scale-density.test.mjs`, which holds the sentence. Section 12.2 says what the line
does not settle.

Why trips between depot visits is 2. Every car starts idle, charged and with no trips since its last visit, so
depot visits arrive in waves. With 3 trips between visits the first rung was not level in the measured hours:
trips per 100 car-hours rose by 8.5 between the two halves of the window, interval 3.1 to 13.9, over 30 seeds. With
2 it is level within the seed spread. The cost is more depot visits per car and a higher floor under pickups.
Source: measured during design.

How a hand load is printed. A depot load by hand is printed at two decimals and gains one decimal at a time while
its text would read as equal to, or across, a threshold that the load is not on. The threshold is capacity, 1, for
the control plan by rung, for the table column "Depot load by hand, control" and for the first note of a capacity
press. It is the refusal ceiling, 0.9, for the tested plan at 120 cars and for the refusal reason. Source: held by
test `scale-density.test.mjs`, which reads every setting typed to three decimals at most that has a load within
0.006 of a threshold, and with the flag every such setting of the three comparisons.

| Setting | Load by hand | Two decimals would print | The page prints | Source |
|---|---:|---:|---:|---|
| Capacity, street load 0.674, depot load 0.505: the control plan at 48 cars | 1.000178 | 1.00 | 1.0002 | held by test `scale-density.test.mjs` |
| Sites added, street load 0.72, depot load 0.60: the tested plan at 120 cars | 0.8957 | 0.90 | 0.896 | held by test `scale-density.test.mjs` |
| Sites added, street load 0.679, depot load 0.60: refused | 0.905, past the ceiling | 0.90 | 0.905 in the refusal reason | held by test `scale-density.test.mjs` |

At the default no load is that close to a threshold, so the default page prints two decimals throughout. On the
grid of three decimals six decimals keep every load on its side. A load closer to its threshold than six decimals
is printed as text with up to 17 decimals. Source: held by test `scale-density.test.mjs`.

### 3.4 Governing ratios and the hand rule

Two ratios govern. **Depot load** is depot work asked over depot capacity at the busier site, if every request
were served. **Street load** is the share of car time that riders, depot legs and depot work would take if every
request were served, before any pickup driving.

The hand rule is arithmetic on the road table and the fixed values. It makes no engine call. Source for the first
four rows and for requests per car-hour: held by test `scale-density.test.mjs`, which builds a second copy of the
rule on the engine's own site places. The three other rows follow from them by the rule. They were measured
during design and worked again by hand for these notes.

| Quantity by hand | Value |
|---|---:|
| Mean rider trip | 7.588 km |
| Mean ride | 12.492 min |
| Depot leg, two sites | 5.624 km, 9.250 min |
| Share of visits at the busier of two sites | 0.6645 |
| Energy per visit, with the pickup allowance: 0.24 times (2 times (trip plus empty km) plus depot leg) | 8.63 kWh |
| Busy minutes per trip, with the pickup allowance | 34.80 min |
| Requests per car-hour at street load 0.68: 0.68 times 60 over 34.80 | 1.1725 |
| Visits per hour at the busier site, 24 cars: 24 times 1.1725 over 2, times 0.6645 | 9.35 |

Sizing at the default. Site power is 9.35 visits an hour times 8.63 kWh over 0.50, taken up to the next 10 kW,
which is 170 kW. Ports are 170 over 50, taken up to a whole port, which is 4. Cleaning bays are 9.35 times 8
minutes over 60 over 0.50, taken up to a whole bay, which is 3. Software and upload bays take 6 minutes a visit
each and come to 2.

The declared depot load is 0.50. After whole units and steps of 10 kW the busier site stands at 0.47 by hand.

Growth rules. Every rule is the base depot at the first rung, so both arms of every comparison share the first
rung. Step s is fleet over 24, from 1 to 5.

| Rule | Sites by rung | Per-site factor by rung | Total capacity in base sites |
|---|---|---|---|
| Fixed | 2, 2, 2, 2, 2 | 1, 1, 1, 1, 1 | 2 |
| In step | 2, 2, 2, 2, 2 | 1, 2, 3, 4, 5 | 2 s |
| Doubled again | 2 | 10 at 120 cars | 4 s, used at 120 cars only |
| Sites added | 2, 2, 3, 4, 5 | 1, 2, 2, 2, 2 | 2 s |
| One site | 2, 1, 1, 1, 1 | 1, 4, 6, 8, 10 | 2 s |

Total power, ports and every bay stage of a siting plan equal the in-step totals exactly at every rung. Source:
held by test `scale-density.test.mjs`.

Depot load by hand at 120 cars at the default: fixed 2.37, in step 0.47, five sites 0.82, one site 0.41. Source:
measured during design.

### 3.5 Readable region and refusals

`derive` refuses before any run and never throws. Source: held by test `scale-density.test.mjs`.

| Condition | Reason, as the lab returns it |
|---|---|
| The comparison is not one of the three | the comparison is one of the three listed plans |
| Street load is not a number from 0.64 to 0.72 | street load at the first rung takes a number from 0.64 to 0.72; outside that range the lab has no tested reading |
| Depot load is not a number from 0.4 to 0.6 | depot load at the first rung takes a number from 0.4 to 0.6; outside that range the lab has no tested reading |
| The busier site of the tested plan, by hand at 120 cars, is above 0.9 | by hand the busier site of the tested plan would stand at 0.91 of its capacity at 120 cars, past the 0.9 this lab allows, so siting would mix with a capacity shortfall |

The ceiling is held by the hand load itself and not by its rounded text. Before the review fixes the rule compared
the load rounded to two decimals, so a typed setup with a load between 0.9 and 0.905 ran and printed 0.90. Such a
setup is now refused, and its reason prints the load on its side of the ceiling: 0.905 at street load 0.679 and
depot load 0.60, and 0.904 at street load 0.678 and depot load 0.58. Source: held by test
`scale-density.test.mjs`.

Inside the bands only the sites added comparison is ever refused, and only by the ceiling. A reader reaches that
refusal with depot load 0.60 at street load 0.64, 0.68 or 0.70, where the reason prints 1.03, 0.91 and 0.93. Of 75
settings of the reader grid (3 comparisons by 5 street loads by 5 depot loads) 72 run and 3 are refused. The change
of the ceiling rule moved no setting of that grid. Source: measured during design, and measured again for these
notes at commit `c08f60d`.

Why the bands. Across wider ranges (street load 0.50 to 0.85, depot load 0.25 to 0.80) every claim a reader can
reach showed together at 89 of 200 sampled points. Inside the bands it showed at 195 of 200. The bands are what
make the lab readable, and they are checked before any run. Source: measured during design.

### 3.6 Arms and shipped controls

One comparison a press. The paired test is read at 120 cars. The ladder by rung is descriptive.

| Comparison | Control arm | Tested arm |
|---|---|---|
| Capacity, the default | Both sites as sized for 24 cars (fixed) | Both sites scaled in step |
| Sites added | Both sites scaled in step | Sites added at equal capacity: 2, 2, 3, 4, 5 sites |
| One site | Both sites scaled in step | One site of equal capacity at the cell edge |

| Shipped control | Arms | Declared reading |
|---|---|---|
| Null control, a replay of the control plan | The control plan against itself, with the engine run again for the second arm | Zero on every measure |
| Non-binding control, the in-step depot doubled | In step against the same depot doubled again | Within the margin, with no guardrail past its allowance |

Checks that void a press: soundness of every run (no minute claims more cars than the fleet holds, energy balance
error at most 1e-6 kWh, requests reconcile), equal external demand across arms, every declared measure present,
replay of the first seed, and either control not reading as declared. Source: held by test
`scale-density.test.mjs` for the three injected engine defects, and held by test `scale-lab.test.mjs` for the
control rule.

Engine runs a press. Source: held by test `scale-density.test.mjs`, which counts engine calls from outside the
module.

| Part | Capacity | Sites added | One site |
|---|---:|---:|---:|
| Ladder. The first rung is shared. Sites added also shares the second | 90 | 80 | 90 |
| Replay check of the main comparison | 1 | 1 | 1 |
| Null control: 10 engine runs of the second arm and 1 replay | 11 | 11 | 11 |
| Non-binding control: 10 runs of the doubled depot and 1 replay | 11 | 11 | 11 |
| **Total engine runs** | **113** | **103** | **113** |

The first arm of each control takes the ladder runs of the press. The second arm and every replay run the engine
again. With both arms run again a press would take 123 engine runs, past the limit of 120.

### 3.7 Primary measure and guardrails

Source for names, directions and thresholds: held by test `scale-density.test.mjs`. Source for the reasons:
measured during design. Each threshold was fixed as a smallest change of interest before the first run of the
final design stage and was not changed afterwards.

| Role | Name | Direction | Threshold | Why this number |
|---|---|---|---:|---|
| Primary | `completed trips per 100 car-hours in hours 5 to 8` | higher is better | margin 3 trips per 100 car-hours | Two points of requests, converted at the demand per car of this cell (0.02 times 110 to 124 is 2.2 to 2.5), taken to the next whole trip |
| Guardrail | `prompt pickup fraction of requests in hours 5 to 8` | higher is better | allowance 0.02 | Two points of requests. A request is prompt when it is picked up within 15 minutes. The fraction is counted over requests made at least 15 minutes before the window ends |
| Guardrail | `unfinished depot visits per 100 cars at the end` | lower is better | allowance 5 visits per 100 cars | One car in twenty ending the window inside a visit that another plan would have finished |
| Guardrail | `stored energy at the end, kilowatt-hours per car` | higher is better | allowance 2 kWh per car | About 8 km of driving, one rider trip. It guards a gain borrowed from the battery |

The window is part of the name of the primary, so every reading carries it. The primary counts trips that finish
inside the window over car-hours, with cars at depots kept in the denominator.

The prompt pickup guardrail leaves out the requests made in minutes 465 to 479 of the run, the last 15 minutes of
the window. The measure did not change in the review fixes. Its name stays, so the frozen test and its digest stay.
What changed is that the inputs row "Held fixed" now states the cut: "prompt pickup within 15 min, counted over
requests made at least 15 min before the window ends". Source: held by test `scale-density.test.mjs`.

In the two siting comparisons the primary is capped by requests per car, so it cannot register a closer pickup.
The first note of those presses prints the pickup distance of both arms at 120 cars. A comparison whose control
is the in-step depot can read within the margin or worse and cannot read improved, because that control already
serves the requests it is given.

### 3.8 Hand checks

| Check | By hand | Simulated | Ratio | Tolerance |
|---|---:|---:|---:|---|
| Busy minutes per trip, tested plan at 120 cars, capacity comparison | 33.66 min | 33.73 min | 1.002 | 0.95 to 1.05 |
| The same, sites added | 29.33 min | 29.25 min | 0.997 | 0.95 to 1.05 |
| The same, one site | 40.30 min | 40.42 min | 1.003 | 0.95 to 1.05 |

Source: held by test `scale-density.test.mjs`.

This check covers the trip, depot leg and depot work times of the inputs. It covers no law of the ladder. Its hand
value takes the recorded pickup distance as an input. Section 9.3 says what that means.

The second hand reading is the column "Depot load by hand, control", which sits beside trips per car in the first
table: 0.47, 0.95, 1.42, 1.90, 2.37. It is arithmetic on inputs and is shown before any run.

### 3.9 Pinned reference values of the default press

Default `{plan: 'capacity', street: 0.68, depot: 0.5}`, seeds 31001 to 31010. Source: held by test
`scale-density.test.mjs` against `scale-density.pins.json`. One press of the default run through Node for these
notes at commit `c08f60d` gave the same label, means and interval ends. The review fixes moved no label, mean,
interval end or guardrail harm of this lab. They moved the record sizes, because the chart categories became
shorter.

| Item | Value |
|---|---|
| Label of the main test | `scale-spec:b4c7f5da` |
| Control mean | 54.58 completed trips per 100 car-hours in hours 5 to 8 |
| Tested mean | 117.19 |
| Mean paired change | +62.60, exact double 62.604166666666664 |
| 95 percent interval, nominal | +60.65 to +64.38 |
| Per seed | Control 50.21 to 58.75. Tested 115.42 to 120.83 |
| Guardrail harms | Prompt pickup fraction -0.810. Unfinished depot visits -38.92 per 100 cars. Stored energy -4.05 kWh per car. A negative harm is a change in the good direction. All three within allowance |
| Outcome and recommendation | `IMPROVED`, `ADVANCE_TO_NEXT_TEST` |
| Null control | Label `scale-spec:965c6883`. Every paired difference of every measure exactly 0 |
| Non-binding control | Label `scale-spec:4cf24bf4`. 117.19 to 117.23, change +0.04, interval -0.08 to +0.17, `UNCHANGED`, as declared |
| Engine runs | 113 |
| Record | 31,665 characters. It was 31,683 before the review fixes |

By rung, capacity comparison, mean of the 10 paired seeds. The first eight columns are the page table "Density and
the depot limit". The last three are the values of the chart:

| Fleet | Depot load by hand, control | Pickup km, control | Pickup km, tested | Idle share, control | Idle share, tested | Trips per 100 car-hours, control | Trips per 100 car-hours, tested | Pickup driving share, control | Pickup driving share, tested | Depot queue share, control |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 24 cars | 0.47 | 6.03 | 6.03 | 0.122 | 0.122 | 115.2 | 115.2 | 0.193 | 0.193 | 0.010 |
| 48 cars | 0.95 | 7.25 | 3.75 | 0.017 | 0.209 | 106.7 | 117.2 | 0.209 | 0.121 | 0.136 |
| 72 cars | 1.42 | 7.91 | 3.73 | 0.000 | 0.221 | 82.6 | 116.0 | 0.177 | 0.118 | 0.336 |
| 96 cars | 1.90 | 7.66 | 3.63 | 0.000 | 0.223 | 66.3 | 116.5 | 0.135 | 0.116 | 0.473 |
| 120 cars | 2.37 | 7.88 | 3.64 | 0.000 | 0.224 | 54.6 | 117.2 | 0.115 | 0.117 | 0.563 |

Shares are fractions of car time in hours 5 to 8.

The chart "Car time by fleet rung, hours 5 to 8". Source: held by test `scale-density.test.mjs` for the categories
and the summary, and by test `scale-lab.test.mjs` for the drawing order and the labels.

| Part | At commit `c08f60d` |
|---|---|
| Categories | "24", "48", "72", "96", "120", under the head "Fleet size, cars". Before the review fixes a category was the rung label of the table, up to 24 characters. The review listed that those labels ran into each other at the width of a phone for the two siting comparisons. One reader saw that and no second reader checked it |
| Rung labels of the table and the summary | "24 cars" to "120 cars". A tested plan with another site count says so: "72 cars, 3 sites tested", "48 cars, 1 site tested" |
| Series | Two lines, pickup driving of the control plan and of the tested plan, and one bar series, the depot queue |
| Drawing order | Every bar is drawn before every line and its points, so a filled bar covers no line. Before the review fixes the queue bars were drawn last and hid the points of both lines from 48 cars on |
| Labels | Labels that all fit are all drawn. All five rung labels are drawn at a drawing width of 296 px |
| Summary at the default | "Across 10 paired seeds: at 120 cars, pickup driving takes 0.115 of car time in the control plan and 0.117 in the tested plan, and the depot queue shown takes 0.563." |

The two other comparisons at the default, from the same pins:

| Item | Sites added | One site |
|---|---|---|
| Label | `scale-spec:d9387e05` | `scale-spec:4eb5ad2f` |
| Control mean to tested mean | 117.19 to 117.42 | 117.19 to 110.08 |
| Mean paired change | +0.23 | -7.10 |
| 95 percent interval, nominal | -0.29 to +0.75 | -8.77 to -5.56 |
| Guardrail harms: prompt, unfinished, energy | -0.105, -8.42, -0.99. All within allowance | +0.625, +12.00, +2.97. All three past allowance |
| Outcome and recommendation | `UNCHANGED`, `NO_RECOMMENDATION` | `REGRESSED`, `HOLD` |
| Pickup distance at 120 cars, control and tested | 3.64 km and 1.53 km | 3.64 km and 8.57 km |
| Engine runs | 103 | 113 |
| Record | 31,388 characters. It was 31,438 | 31,386 characters. It was 31,449 |

Over the 72 accepted settings of the reader grid the record holds 30,884 to 31,756 characters. Source: measured for
these notes.

### 3.10 Compute per press

| Measure | Value | Source |
|---|---|---|
| Engine runs | 113, 103 or 113 | held by test `scale-density.test.mjs` |
| Whole press in Node, default press | 1,224 ms, median of 5 presses that ran from 1,127 to 1,243 ms | measured for these notes, with other work on the machine. It was 1,153 ms, measured during design |
| First partial chart in Node | 32 ms, median of 5 | measured for these notes. It was 30 ms, measured during design |
| Longest block in Node | 17.3 ms, median of 5. One engine run is one block and cannot be sliced | measured for these notes. It was 17.0 ms, measured during design |
| Steps of the generator | 180 at the default and with one site, which are 179 yields and the return. 170 with sites added | measured for these notes |
| Timing gate | First chart within 1,000 ms and the press within 3,000 ms | held by test `scale-density.test.mjs`, with the flag |
| Browser after the review fixes, pane of 1024 by 768 px, no throttle, three presses | Press to recorded result 966 to 1,034 ms. First chart after 51 to 70 ms | measured on the final tree. The pane was hidden, so the reading is time and no painted frame was seen |
| Hosted site, the same pane, one press | Press to recorded result 1,044 ms. Label `scale-spec:b4c7f5da` | measured on the hosted site |
| Browser before the review fixes, the same pane, one press | Press to recorded result 1,060 ms, first chart at 59 ms, with the full test suite running at the same time | measured on the integrated tree |
| Phone | 4 to 13 s a press, with blocks of 100 to 300 ms | estimate. Not measured |
| Size of the module in the offline package, with its marker line | 17,439 bytes. It was 16,964 bytes at commit `319b4a9` | measured for these notes, on both commits by one method |

The 8 ms slice of the two other labs does not hold for this lab, and no document claims it does.

### 3.11 What this lab must never be read as claiming

- That a real fleet, depot, city or operator behaves this way, or that any number here is a measurement.
- That 120 cars stand for a city, a market or a fleet of thousands.
- That pickups follow any law of density in this model, or that such a law was confirmed or refuted.
- That adding, enlarging or merging sites is right for any real network.
- That the size of any change would hold in another window, day or week.
- That depot power, ports or bays are the limiting resource in any real depot. Which stage queues and at which
  rung follow from the sizing rule.
- That the capacity comparison found its direction. The control depot stands at about 2.4 times its capacity by
  construction.
- That capacity has to match the fleet. The press compares a depot in step with one far past its capacity and
  cannot say how small a depot would have done.
- That a siting plan could have read improved.
- Anything about what capacity takes to buy, staff or permit, or when it would arrive.
- Anything about any fleet, depot or service in the nine places.
- That the interval is a 95 percent interval in the strict sense. It comes from 10 paired seeds.

---

## 4. Fleet intake

Id `fleet-intake`. Version `scale-intake-1.0.0`. Title "From delivered to in service".
File `src/model/scale-intake.js`.

### 4.1 The question

How many weeks ahead of the delivery calendar must the slowest depot resource be ordered so that vehicles in rider
service keep pace with vehicles delivered, and which gate keeps delivered vehicles waiting once it is?

The answer to "how many weeks" is a curve. The page shows five points of it in every press. The lab does not say
that depots or power explain any real gap. It asks which gate binds under typed lead times.

### 4.2 What the model is and is not

| Element | What it is |
|---|---|
| Kind | Weekly counts of one fleet over a fixed horizon of 104 weeks. State is a handful of whole numbers. No map and no engine call |
| Stocks | Awaiting integration, awaiting validation, in rework, at the release gate, at the depot door, in rider service, out of service |
| Conservation | Delivered equals the sum of the seven stocks. It is checked every week of every run |
| Depot capacity | Tranches of 96 places, one every 4 weeks. A tranche is ready when the last of four resources arrives: site power, ports, stalls, staff |
| Release gate | Opens in week 16, drawn per seed from weeks 12 to 20. The whole stock at the gate then moves to the depot door |
| Availability drain | 12 per 1,000 vehicles in rider service leave a week and return after 1 to 8 weeks. A removed vehicle keeps its place |
| Draws | Every draw of a seed sits on one tape that never sees an arm: 337 keyed draws a tape. The weekly update makes no keyed draw |
| Plan | 55,848 vehicle-weeks. A planned vehicle counts from 2 weeks after its delivery week, with no gate and no removal |

Source: held by test `scale-intake.test.mjs`. With every gate open and no removal the model meets the plan
exactly, and the same test holds it.

| What it is not | Why |
|---|---|
| An account of any real gap between delivered and in-service vehicles | A model that can make a gap has not found its cause |
| A model of vehicles, sites or a grid | A place is a count. Idle capacity is counted in weeks |
| A statement on which resource is slowest anywhere | Site power is the slowest depot resource here because the setup says so |
| A model of correlated delay | Each lead time is drawn on its own, evenly across its range |
| A model of a bridge | There is no temporary power, no tranche that opens in part and no repair shop with a limit |
| A statement about any approval | The release week is a teaching assumption and says nothing about any approval |
| A model of money, kilowatts or staff rosters | None is an input |

### 4.3 Inputs

Source: held by test `scale-intake.test.mjs`, which pins the inputs table of both arms, the controls and the
paired seeds.

| Input | Unit | Default | Range | Who sets it |
|---|---|---|---|---|
| The other arm | choice | middle | middle, end | The reader |
| Site power lead time, middle of its range | weeks | 48 | 24 to 56, whole weeks | The reader |
| Ports lead time, middle of its range | weeks | 24 | 16 to 28, whole weeks | The reader |
| Width of a lead time range | weeks | a quarter either side of the middle | site power 36 to 60, ports 18 to 30 | Fixed teaching assumption |
| Stalls lead time | weeks | 9 to 15, middle 12 | fixed | Fixed teaching assumption |
| Staff lead time | weeks | 6 to 10, middle 8 | fixed | Fixed teaching assumption |
| Release gate opens | week | 16, drawn from 12 to 20 | fixed. A typed release week is ignored | Fixed teaching assumption |
| Deliveries | vehicles a week | 24 for 26 weeks, 624 in all | fixed | Fixed teaching assumption |
| Horizon | weeks | 104 | fixed | Fixed teaching assumption |
| Integration, validation and depot induction | vehicles a week | 30, 32 and 60 | fixed | Fixed teaching assumption |
| First-pass share of validation | fraction | 0.95 | fixed | Fixed teaching assumption |
| Rework time | weeks | 2 | fixed | Fixed teaching assumption |
| Unscheduled removals | per 1,000 vehicles in rider service a week | 12 | fixed | Fixed teaching assumption |
| Return time | weeks | 1 to 8, 2.4 on average | fixed | Fixed teaching assumption |
| Depot tranche | places | 96. One tranche ready in week 1, 6 on order, one every 4 weeks | follows from deliveries | Sizing rule: the deliveries of one tranche interval |
| Room | weeks | 24 | follows | Sizing rule: site power lead time minus ports lead time |
| Room over the tranche interval | ratio | 6.00 | read from 2.0 | Governing ratio |
| Site power over ports | ratio | 2.00 | descriptive | It does not govern |
| Weeks ahead, first arm | weeks | 24 | follows | Sizing rule: the room |
| Weeks ahead, second arm | weeks | 36 | follows | Sizing rule: the end of the site power range minus the next gate |
| Plan | vehicle-weeks | 55,848 over 104 weeks | fixed | Fixed teaching assumption |
| Margin | fraction of plan | 0.02, which is 1,117 vehicle-weeks | fixed | Fixed teaching assumption |
| Idle allowance of an order arm | idle weeks per ordered place | 13 | fixed | Fixed teaching assumption. Chosen with sight of outcomes, section 9.1 |
| Allowance of the deliveries control | weeks not in service per delivered vehicle | 2 | fixed | Fixed teaching assumption |
| Pace of the deliveries control | multiple of deliveries | 1.5, which is 36 vehicles a week for 17 weeks and the last 12 vehicles in week 18 | fixed | Fixed teaching assumption |
| Paired seeds | seeds | 12, from 7001 to 7012 | fixed | Fixed teaching assumption |

The default site power lead time of 48 weeks was also chosen with sight of outcomes. Section 9.1.

### 4.4 Governing ratio, readable region and refusals

The governing ratio is the room over the tranche interval: the weeks between the slowest depot resource and the
next gate, over the 4 weeks between tranches. It is `(site power - ports) / 4`. The lab reads from 2.0, which is 8
weeks of room.

Why this ratio. An earlier design named site power over ports. Over the 429 pairs of lead times a reader can type,
two values of that ratio were each both accepted and refused, and equal room gave equal gain at different ratios.
Source for that finding: measured during design. The room over the tranche interval separates exactly. Source:
held by test `scale-intake.test.mjs`, which walks the 429 pairs and asserts that no value of the ratio is both
accepted and refused, and that the row of the inputs table holds the quantity the refusal tests.

| Condition | Reason, as the lab returns it |
|---|---|
| The arm is not one of the two | the other arm must be one of the two listed arms |
| A lead time is not whole, or is outside its range | site power lead time, middle of its range must be a whole number from 24 to 56. The same form for ports, from 16 to 28 |
| The room is 2 to 7 weeks | site power (31) and ports, the next gate (24), leave 7 weeks of room, 1.75 tranche intervals. The lab reads from 2.0: set site power to 32 weeks or past it, or ports to 23 or before it |
| The room is 1 week | site power (24) and ports, the next gate (23), leave 1 week of room, 0.25 tranche intervals. The lab reads from 2.0: set site power to 31 weeks or past it, or ports to 16 or before it |
| There is no room: site power arrives with ports or before it | site power (24) leaves no room past ports (24). The lab reads from 8 weeks of room: set site power to 32 weeks or past it, or ports to 16 or before it |

The rule of the refusal did not change in the review fixes. Its words did. Before them a room of one week read
"1 weeks", and a setup with ports slower than site power printed a room under zero and called ports the next gate.
The reason now names ports as the next gate only when site power arrives after it. Each reason names two remedies,
both are values the controls offer, and both run. Source: held by test `scale-intake.test.mjs`.

| Count | Value | Source |
|---|---:|---|
| Pairs of lead times a reader can type | 429 | held by test `scale-intake.test.mjs` |
| Pairs accepted | 351 | held by test `scale-intake.test.mjs` |
| Pairs refused | 78: 57 with a room of 2 to 7 weeks, 6 with a room of 1 week, 15 with no room | measured for these notes |
| Longest refusal reason | 184 characters, which the page prints in 232 characters. It was 186 before the review fixes | held by test `scale-intake.test.mjs` for the 184. The 232 was measured for these notes and on the final tree |
| Typed presses with both arms | 858, of which 702 accepted and 156 refused | measured during design, and again for these notes at commit `c08f60d` |

Where the floor of 8 weeks comes from. The floor was chosen on the tuning seeds. After the design was frozen it
was measured with the refusals lifted, 8 setups per room on four seed sets (seeds starting at 3001, 7001, 8001
and 9001). Source: measured during design.

| Room, weeks | First arm reads improved, of 8, on each of the four seed sets | Lowest lower interval end over the 32 runs, fraction of plan |
|---:|---|---:|
| 2 | 0, 0, 0, 0 | 0.0067 |
| 3 | 0, 0, 0, 0 | 0.0111 |
| 4 | 5, 0, 3, 1 | 0.0157 |
| 5 | 8, 8, 8, 8 | 0.0217 |
| 6 | 8, 8, 8, 8 | 0.0280 |
| 7 | 8, 8, 8, 8 | 0.0343 |
| 8 | 8, 8, 8, 8 | 0.0409 |
| 9 | 8, 8, 8, 8 | 0.0482 |

The floor is the first room at which the lowest lower interval end is at least twice the margin on all four seed
sets.

### 4.5 Arms and shipped controls

| Arm | The one change | At the default |
|---|---|---|
| Control | Every depot resource of tranche k is ordered in week 1 + 4k. The order calendar follows the delivery calendar | 0 weeks ahead |
| First arm, `middle` | Site power ordered ahead by the room | 24 weeks ahead |
| Second arm, `end` | Site power ordered ahead by the end of its lead range minus the next gate | 36 weeks ahead |

The control is a reference line, not a practice. Every gain follows from how late it orders.

| Shipped control | Arms | Declared reading | Reading at the default |
|---|---|---|---|
| Null control | A second simulation under its own arm id against the control | Zero on every measure. The whole run must equal the control run as canonical JSON | 0 on every seed |
| Non-binding order control | Site power with a lead time of 0 weeks in both arms, then ordered ahead by the room in one | Zero on the main measure | Primary 0. Idle weeks +24, so `HOLD` |
| Non-binding deliveries control | Deliveries 1.5 times as fast while vehicles wait at the depot door | Zero on the main measure | Primary 0. Weeks not in service per delivered vehicle +4.33 against 2, so `HOLD` |

Two of the three controls read "Held because a guardrail went past its allowance". That is their declared reading
and not a failure. The added waiting of the deliveries control is arithmetic on the delivery plan: 2,700 over 624.

Order inside a press: the three controls, then the paired runs, then the hand checks. No arm is read before all
three controls have passed. A control that moves throws and stops the press before any arm is simulated. The page
then prints "The lab could not run", records nothing and keeps the previous result.

Six injected pairing defects, each on both arms, stopped the press 12 of 12 times. The margin alone would have
passed the first defect: with the removal draw keyed by the arm name the null control gave 12 of 12 differences
other than zero, all inside the margin of 0.02. The exact rule is what catches it. Source: held by test
`scale-intake.test.mjs`.

### 4.6 Primary measure and guardrails

Source for names, directions and thresholds: held by test `scale-intake.test.mjs`.

| Role | Name | Direction | Threshold | Why this number |
|---|---|---|---:|---|
| Primary | `in-service fraction of plan` | higher is better | margin 0.02 of plan | The value the site already uses for a fraction. It is 1,117 vehicle-weeks of the fixed plan |
| Guardrail of an order arm, of the null control and of the order control | `idle weeks per ordered place` | lower is better | allowance 13 weeks | One quarter of a year. Chosen with sight of outcomes, section 9.1 |
| Guardrail of the deliveries control | `weeks not in service per delivered vehicle` | lower is better | allowance 2 weeks | The two process weeks again |

A guardrail is declared only where the lever can move it. Under an order arm the second measure can only fall, so
there it is a descriptive value. The plan has no gate and no removal, so no arm reaches it. The largest value of
the primary in any sweep was 0.915. Source: measured during design.

### 4.7 Hand checks

Two hand checks, each with its tolerance in natural units. A check outside its tolerance is reported and does not
void the run. The exact controls are what void a press. Source: held by test `scale-intake.test.mjs`.

| Check | Rule at the default | By hand | Simulated | Tolerance |
|---|---|---:|---:|---|
| Gain of the other arm at the middle of every range | 24 weeks of room times (624 planned vehicles minus 96 places ready in week 1) times (1 minus 0.0279 out of service), over 55,848 plan vehicle-weeks | 0.2206 of plan | 0.2208 of plan | 2 percent of the hand value |
| Stock at the release gate in its opening week | 24 vehicles a week times (release week as drawn minus 2 process weeks), mean of seeds | 372.0 vehicles | 369.5 vehicles | One week of deliveries, 24 vehicles |

The first check compares the hand value with a companion pair of runs in which every lead time and the release
week sit at the middle of their range. With the ranges as drawn the gain is 0.1847 for the first arm and 0.2161
for the second. Spread takes some of the gain away: a tranche that lands late loses service and one that lands
early gains none.

A third hand check, on the out-of-service fraction, was cut. Its tolerance was 18 percent of its value, so it
passed a removal rate 10 percent high. Source: measured during design.

No hand check of this lab was shown to catch a model fault. An injected model fault would need a seam in the
weekly update, which the lab does not have. That is left for a later wave.

### 4.8 Pinned reference values of the default press

Default `{arm: 'middle', power: 48, ports: 24}`, seeds 7001 to 7012. The pins hold both arms at the default lead
times. Source: held by test `scale-intake.test.mjs` against `scale-intake.pins.json`, which also pins the SHA-256
of the whole result of each arm. One press of each arm run through Node for these notes at commit `c08f60d` gave
the same labels, means and interval ends. The review fixes moved no label, digest, mean, interval end or guardrail
harm of this lab. They moved the depot door rows of the table "The gate that binds", its caption, the sixth note,
the record sizes and therefore the SHA-256 of the whole result of each arm.

| Item | First arm, the default press | Second arm |
|---|---|---|
| Label | `scale-spec:1aa8c833` | `scale-spec:a0b5e327` |
| Weeks ahead | 24 | 36 |
| Control mean, fraction of plan | 0.5696 | 0.5696 |
| Tested mean | 0.7542 | 0.7857 |
| Mean paired change | +0.1847, exact double 0.1846649238409015 | +0.2161, exact double 0.21607458339301913 |
| 95 percent interval, nominal | 0.1722 to 0.1965 | 0.1961 to 0.2355 |
| Per seed | 0.1361 to 0.2158 | 0.1361 to 0.2762 |
| Guardrail harm, idle weeks per ordered place | +5.60 against 13, within | +14.47 against 13, past |
| Descriptive, weeks not in service per delivered vehicle | 40.52 to 24.00 | 40.52 to 21.18 |
| Outcome and recommendation | `IMPROVED`, `ADVANCE_TO_NEXT_TEST` | `IMPROVED`, `HOLD` |
| Record | 33,961 characters. It was 33,720 | 34,099 characters. It was 33,856 |

Over the 702 accepted presses the record holds 33,593 to 34,309 characters. Source: measured for these notes.

A gain cannot buy back a guardrail. The second arm gains more and is held.

Controls, the same in both presses:

| Control | Label | Primary change | Guardrail harm | Reads |
|---|---|---:|---:|---|
| Null | `scale-spec:494f724a` | 0 on every seed | 0 | `UNCHANGED`, `NO_RECOMMENDATION` |
| Non-binding order | `scale-spec:fc0d0072` | 0 on every seed | 24 idle weeks against 13 | `UNCHANGED`, `HOLD` |
| Non-binding deliveries | `scale-spec:7bad40d3` | 0 on every seed | 4.33 weeks against 2 | `UNCHANGED`, `HOLD` |

Table "Lead-time mismatch", site power ordered 0 to 48 weeks ahead, mean of 12 paired seeds:

| Weeks ahead | Gain, fraction of plan | Idle weeks per ordered place, past the control | Against the allowance of 13 |
|---:|---:|---:|---|
| 0 | 0.0000 | 0.00 | inside it |
| 12 | 0.1084 | 1.20 | inside it |
| 24 | 0.1847 | 5.60 | inside it |
| 36 | 0.2161 | 14.47 | past it |
| 48 | 0.2183 | 26.25 | past it |

The third and fourth rows equal the two arms to the last digit. The rows are descriptive: no paired test is read
on them.

Table "One fleet, several counts", end of week 26, mean of 12 paired seeds, in vehicles:

| Count | Control | First arm | Second arm |
|---|---:|---:|---:|
| Delivered | 624 | 624 | 624 |
| Integrated | 600 | 600 | 600 |
| Validated | 573.3 | 573.3 | 573.3 |
| Released | 573.3 | 573.3 | 573.3 |
| Accepted at a depot | 96 | 120 | 165 |
| In rider service | 93.5 | 117.2 | 161.4 |
| Out of service | 2.5 | 2.8 | 3.6 |
| First week at 90 percent, the first week with 562 vehicles in rider service | week 68.5 | week 46.9 | week 44.1 |

The page prints these means as whole vehicles: 573, 94 and 2 in the control column, for example. After rounding,
"Accepted at a depot" can stand one vehicle off the sum of "In rider service" and "Out of service". At the default
the three printed rows agree in every column. With site power 30 and ports 16 the control column prints 101, 98
and 2. The caption of this table makes no claim about a sum. Over the 702 accepted presses the page prints 1,053
distinct columns, 351 of the control and 702 of an order arm. In 43 of them "Accepted at a depot" stands one vehicle
off the sum of the two rows below it, and in none by more. Source: measured for these notes.

Table "The gate that binds", where delivered vehicle-weeks went over 104 weeks, mean of 12 paired seeds, as the
page prints it at commit `c08f60d`:

| Vehicle-weeks | Control | First arm | Second arm |
|---|---:|---:|---:|
| Waiting: integration | 0 | 0 | 0 |
| Waiting: validation and rework | 67 | 67 | 67 |
| Waiting: the release gate | 2,707 | 2,707 | 2,707 |
| Waiting: depot induction | 290 | 321 | 386 |
| Waiting: site power | 20,106 | 4,944 | 948 |
| Waiting: ports | 0 | 4,534 | 6,662 |
| Waiting: stalls | 0 | 0 | 0 |
| Waiting: staff | 0 | 0 | 0 |
| Inside the process weeks | 1,248 | 1,248 | 1,248 |
| Out of service | 868 | 1,152 | 1,201 |
| In rider service | 31,810 | 42,123 | 43,877 |
| Total: delivered vehicle-weeks | 57,096 | 57,096 | 57,096 |

The three depot door rows before and after the review fixes, as exact means. Source: held by test
`scale-intake.test.mjs` against `scale-intake.pins.json` for the values after, to four decimals. The values before
were read from the module of commit `319b4a9` for these notes.

| Depot door row | Control, before | Control, after | First arm, before | First arm, after | Second arm, before | Second arm, after |
|---|---:|---:|---:|---:|---:|---:|
| Waiting: depot induction | 1,819.5 | 290 | 1,904.5 | 321 | 1,927.5 | 386 |
| Waiting: site power | 18,576.67 | 20,106.17 | 4,131.75 | 4,943.67 | 686.92 | 947.92 |
| Waiting: ports | 0 | 0 | 3,762.92 | 4,534.5 | 5,381.75 | 6,662.25 |
| The three rows together | 20,396.17 | 20,396.17 | 9,799.17 | 9,799.17 | 7,996.17 | 7,996.17 |

How the depot door stock is booked. Each week the stock at the depot door is split. The part for which a place is
left free waits on depot induction, because only the induction rate of 60 vehicles a week holds it. The rest waits
on the resource that holds the next tranche. When no tranche is still to come, the whole stock waits on depot
induction. Before the review fixes the whole stock of a week was booked to depot induction whenever a place was
left over. At the default that overstated the row 6.3 times in the control, 5.9 times in the first arm and 5.0
times in the second arm, and it understated site power and ports by the same vehicle-weeks. The fix moves
vehicle-weeks between the depot door rows only. Their sum, every other row, the total, the primary measure and both
guardrails are as they were. Source: held by test `scale-intake.test.mjs`, which rebuilds the depot door rows from
the weekly counts of 1,344 runs.

The caption of the table, at the default press of the first arm: "The gate that binds. Where delivered
vehicle-weeks went over 104 weeks, mean of 12 paired seeds. Waiting is stock past the 2 process weeks. Each week,
depot door stock up to the free places waits on depot induction, the rest on the resource the next tranche waits
for. Most depot door waiting: site power under the control; site power in the other arm. The rows sum to the total
before each is rounded to a whole vehicle-week." In the press of the second arm the caption names ports for the
other arm.

The wait that leaves site power arrives at ports. The rows sum to the total before each is rounded to a whole
vehicle-week. At the default the printed whole numbers of every column also add to the printed total. That does not
hold at every setup. With site power 40 and ports 24, second arm, the printed rows of the other arm add to 57,097
against a printed total of 57,096. Source: held by test `scale-intake.test.mjs`. Over the 1,053 distinct columns
of the 702 accepted presses, the printed rows of 195 columns add to a number other than the printed total, by at
most 2 vehicle-weeks. Source: measured for these notes.

The sixth note of every press reads: "The deliveries control reads the same in every accepted setup: rider service
is as it was while vehicles wait at the depot door, and the added waiting is arithmetic on the delivery plan. Line
rates stay, so two fifths of it sits at integration and the rest at validation and rework, the release gate and the
depot door." The deliveries control adds 2,700 vehicle-weeks of waiting on every seed, of which 1,080 sit at
integration. Before the review fixes the note said that the extra vehicles wait at integration. Source: held by
test `scale-intake.test.mjs`.

The chart draws one replay, seed 7001, not the mean of seeds. At the end of week 26 it shows 624 vehicles
delivered and 91 in rider service under the control. At the end of week 52 it shows 248 in rider service under
the control and 607 in the first arm. In the press of the second arm the last number is 606.

The chart has three lines: delivered, in rider service under the control, and in rider service in the other arm.
The three line marks differ by shape and not by ink alone. The first line has filled points. The second has ring
points and a legend swatch with a ring. The third has square points and a legend swatch with a square. No line is
dashed. Before the review fixes the first and the third line had the same stroke and the same legend swatch, and
only their point markers differed. Source: held by test `scale-lab.test.mjs`.

### 4.9 Compute per press

| Measure | Value | Source |
|---|---|---|
| Model runs | 184: four pairs of 12 seeds with one replay each, 24 companion runs, and 60 runs of the weeks ahead table | measured during design, and read again in source for these notes: 100, 24 and 60 runs |
| Engine runs | 0. The module imports `src/core/keyed.js` and the shared contract and no engine file | read in source for these notes |
| Whole press in Node | 79 ms, median of 5 presses that ran from 72 to 101 ms | measured for these notes, with other work on the machine. It was 71 ms, measured during design |
| Longest block in Node | 1.7 ms, median of 5 | measured for these notes. It was 1.5 ms, measured during design |
| Steps of the generator | 257, which are 256 yields and the return | measured for these notes |
| Timing gate | Largest gap between two yields at most 8 ms and the press within 3,000 ms | held by test `scale-intake.test.mjs`, with the flag |
| Browser after the review fixes, pane of 1024 by 768 px, no throttle, three presses | Press to recorded result 111 to 115 ms | measured on the final tree. The pane was hidden, so the reading is time and no painted frame was seen |
| Hosted site, the same pane, one press | Press to recorded result 102 ms. Label `scale-spec:1aa8c833` | measured on the hosted site |
| Browser before the review fixes, the same pane, one press | Press to recorded result 99 ms | measured on the integrated tree |
| Phone | 0.4 to 0.8 s a press | estimate. Not measured |
| Size of the module in the offline package, with its marker line | 20,379 bytes. It was 19,964 bytes at commit `319b4a9` | measured for these notes, on both commits by one method |

The lab yields no partial chart. The cost does not move with the setup, because the fleet, the horizon and the
tape length are fixed.

### 4.10 What this lab must never be read as claiming

- Whether any real fleet has fewer vehicles in rider service than delivered, or why.
- Any real lead time, release date, stage time, pass share, removal rate or repair time.
- How long any regulator, utility or supplier takes.
- That 24 or 36 weeks, or any number of weeks, is the right time to order capacity anywhere.
- That 13 idle weeks or 2 weeks of waiting is a standard. They are rules of this lab.
- That faster deliveries never help. They do not help here while vehicles wait at the depot door.
- That site power is the slowest depot resource in general.
- Which gate binds in any real market or depot, or in what order.
- Anything about driving behavior, or that validation time measures it.
- Anything about money.
- That the heading "Declared test, set before the run" describes the design. It is true of a press. Section 9.1.

---

## 5. Response reserve

Id `response-reserve`. Version `scale-response-1.0.0`. Title "Response reserve for an area-wide event".
File `src/model/scale-response.js`.

### 5.1 The question

One area-wide event makes many vehicles ask for help in the same hours. What does a reserve sized by rule, or a
directive, do to stopped vehicle-minutes at one fleet size, and how late can it land?

The ladder by fleet size is read beside that question. The press does not decide it. Fleet size is a condition,
and a condition is never an arm.

### 5.2 What the model is and is not

| Element | What it is |
|---|---|
| Kind | A count-based, event-driven queue in continuous time. Vehicles are counts. No map and no engine call |
| Day | 86,400 s. The day starts empty and runs until every request of the day is answered or released |
| Request tape | One per seed and fleet size. It never depends on staffing, event load or a lever, so both arms of a pair answer the same requests with the same answer times |
| Event | It changes timing only. A derived share of the same requests is moved into one event of 180 minutes that starts at minute 480. Count, classes and answer times stay equal, and an invariant checks it |
| Request classes | Vehicle requests stop their vehicle until answered or released. Responder calls are 1 percent of the tape, are made to the same pool by a first responder, are answered first, and are late when the answer starts more than 30 s after the call |
| Levers | Add capacity (reserve staff join the pool). Remove work (a directive removes the ask of every vehicle request moved into the event. Responder calls stay in the pool and are answered). A third kind, reorder work (one shared line), is a shipped control |
| Minutes to clear | The minutes from the end of the event to the first instant at which no vehicle waits. A day on which nothing waits at the end of the event reads 0 |
| Draws | One keyed draw per simulated minute seeds a local stream. Section 11 |

Source: held by test `scale-response.test.mjs`.

| What it is not | Why |
|---|---|
| A model of driving, traffic or riders | A stopped vehicle here blocks nothing |
| A model of what a vehicle does after release | The page prints that reading as not available, with its reason, in every press |
| A model of staff | No field crews, shifts, breaks, sites, skill tiers or wrong answers. No answer in progress is interrupted |
| A model of time of day | Requests arrive at a flat rate outside the event |
| An estimate of any staffing ratio | Pools are set small so that an ordinary wait can be read |
| A description of any past event | The event is invented and takes the same share of requests at every fleet size |

### 5.3 Inputs

Source: the inputs table that the lab returns at commit `c08f60d`, measured for these notes. Held by test
`scale-response.test.mjs`: the rates-only values at event load 1.30, the lean pools, the reserve by rule, both
margins, the readable region, the four refusals and the row on requests.

| Input | Unit | Default | Range | Who sets it |
|---|---|---|---|---|
| Event load | times capacity | 1.30 | The control declares a step of 0.1 from 1.2 to 1.6. A typed load is accepted in steps of 0.01 from 1.17 to 1.60, which is 44 values. The load shown is the load used. Section 14.5 lists the two steps as open | The reader. Governing ratio |
| Lever | choice | reserve staff join the pool | reserve, directive | The reader |
| Lever lands after | min after the event starts | 45 | 15 to 240, whole minutes, step 15 | The reader |
| Reserve staff | agents | 2 | 2, 2, 3, 3, 4 at event loads 1.2 to 1.6 | Sizing rule: the smallest reserve that brings event load to capacity at 6,000 vehicles |
| Share of requests moved into the event | percent of the day's requests | 14.3 | follows | Sizing rule: follows from event load, busy share and event length |
| Burst depth | ratio | 7.1 | refused under 4 | Sizing rule: rates-only backlog at the smallest fleet over the chance spread of its event requests |
| Requests reaching the pool | per 1,000 vehicle-hours | 78 | follows | Sizing rule: agents times busy share over answer time |
| Fleet sizes and pools | vehicles and agents | 2 agents at 2,000, 6 at 6,000, 20 at 20,000. Levers act at 6,000 | fixed | Fixed teaching assumption |
| Staffing ratio | agents per 1,000 vehicles | 1 | fixed | Fixed teaching assumption |
| Agent busy share on an ordinary day | percent | 65 | fixed | Fixed teaching assumption |
| Mean answer time | s | 30, both classes | fixed | Fixed teaching assumption |
| Share of requests that are responder calls | percent | 1 | fixed | Fixed teaching assumption. The inputs row "Requests" ends: "A directive removes vehicle requests only. Responder calls stay in the pool." |
| Event | min | 180 from minute 480 of the day | fixed | Fixed teaching assumption |
| Responder call target | s | 30 | fixed | Fixed teaching assumption. Its value equals a public definition, section 12.3 |
| Long stop | s | 120 | fixed | Fixed teaching assumption. Its value equals a public definition, section 12.3 |
| Lean pool | agents | 2, 5, 14 at the three fleet sizes | fixed rule | Fixed teaching assumption: the smallest pool whose ordinary wait by the queue formula does not pass the wait at the smallest fleet |
| Burst of the ample pool control | times capacity | 0.8, at 20,000 vehicles | fixed | Fixed teaching assumption |
| Margin | stopped vehicle-minutes per 1,000 vehicles | 861.558 | 5 percent of the rates-only value of the day the comparison starts from | Fixed teaching assumption, computed from the inputs before any run |
| Margin of the ample pool control | stopped vehicle-minutes per 1,000 vehicles | 46.663 | 5 percent of its own ordinary-day value | Fixed teaching assumption |
| Allowance | change in late responder call fraction | 0.05 | fixed | Fixed teaching assumption |
| Paired seeds | seeds | 12, from 3001 to 3012 | fixed | Fixed teaching assumption |

### 5.4 Governing ratio, readable region and refusals

The governing ratio is **event load**: work offered to the pool inside the event over what the pool can answer.
A second ratio sets the floor of the readable region. **Burst depth** is the rates-only backlog at the smallest
fleet over the chance spread of its event requests. Short of a depth of 4 chance hides the event.

Rates-only arithmetic at event load 1.30, per 1,000 vehicles. Source: held by test `scale-response.test.mjs`.

| Quantity | Rule | Value |
|---|---|---:|
| Share of requests moved | (load over busy share, minus 1) over (1,440 over event length, minus 1) | 0.1429 |
| Capacity | agents times 60 over answer time | 2 answers a minute |
| Most vehicles waiting | overload times event length times capacity | 108.0 vehicles |
| Minutes to clear after the event | overload times event length over (1 minus the busy share outside the event) | 121.9 min |
| Answer minutes of vehicle requests | 0.99 times 1,440 times agents times busy share | 926.64 min |
| Stopped vehicle-minutes, no lever | backlog area plus answer minutes | 17,231.2 |
| Burst depth | | 7.06 |

The rates-only value of the no-lever day holds no fleet size. The flat ladder by fleet size therefore follows
from the inputs, and the page says so.

| Condition | Reason, as the lab returns it |
|---|---|
| The event load, taken to two decimals, is past 1.6, or its burst depth is under 4, or the load is not a number | event load is read from a burst depth of 4 at the smallest fleet, near 1.17 times capacity, to 1.6 times capacity. Short of that depth chance hides the event, and past 1.6 no shape was checked |
| The event load is off a step of 0.01 | event load takes steps of 0.01, so that the load shown is the load used |
| The lever is not one of the two | choose one of the two listed levers |
| The delay is not a whole number from 15 to 240 | a lever lands 15 to 240 whole minutes after the event starts |

The conditions are tested in the order of the table. A typed load is first taken to two decimals and read against
the region, and then refused if it is off its step.

| Typed event load | Reading | Source |
|---|---|---|
| 1.16 | Refused by the region | held by test `scale-response.test.mjs` |
| 1.161 and 1.164 | Refused by the region | held by test `scale-response.test.mjs` |
| 1.166, 1.167 and 1.169 | Refused by the step | held by test `scale-response.test.mjs` |
| 1.17, 1.25, 1.33, 1.34 and 1.6 | Accepted, and printed as typed at two decimals | held by test `scale-response.test.mjs` |
| 1.334, 1.2001, 1.3301, 1.596 and 1.604 | Refused by the step | held by test `scale-response.test.mjs` |
| 1.606 and 1.61 | Refused by the region | held by test `scale-response.test.mjs` |
| Every load from 1.100 to 1.700 in steps of 0.001 | 44 accepted, from 1.17 to 1.60. 396 refused by the step. 161 refused by the region | measured for these notes |

Before the review fixes a load typed to three decimals was accepted and used, while the page printed it at two. A
typed 1.334 printed 1.33 and sized a reserve of 3 agents, and typed loads from 1.161 to 1.164 ran and printed 1.16,
which the refusal reason places outside the region. Source: read in the module of commit `319b4a9` for these notes.

No refusal can be reached from the three controls inside their ranges: 160 of 160 settings of the page grid (5
event loads by 2 levers by 16 delays) are accepted. Source: held by test `scale-response.test.mjs`.

A late lever is never refused. The instrument reads what it reads.

### 5.5 Arms and shipped controls

| Comparison | Control arm | Tested arm | Margin |
|---|---|---|---:|
| Main, lever is reserve | Event day at 6,000 vehicles, no lever | Reserve of the sized number of agents after the chosen delay | 5 percent of rates only |
| Main, lever is directive | The same | Directive after the chosen delay | The same |

| Shipped control | Arms | Declared reading |
|---|---|---|
| Null control | A reserve of zero agents through the lever's own code path, against no lever | Every paired difference exactly 0 |
| Ample pool control | Reserve staff on a burst at 0.8 of capacity at 20,000 vehicles, against the same day with no lever. Margin 46.663 | Within its margin |
| Guardrail control | One shared line, where responder calls wait in turn, against the responder line first | Within the margin on the primary, and held by the guardrail |

The responder line first is the standing rule in every arm. No condition goes through the instrument: the event
against an ordinary day is a table column, so no recommendation is printed on something that is not a lever. No
arm is read against another arm. The reader compares two presses.

Eight deliberate faults are each caught by the flag named for them. Source: held by test
`scale-response.test.mjs`.

| Fault | Flag that catches it |
|---|---|
| A zero-size lever shifts the answer draws | Null control |
| Reserve agents also shorten answers | Ample pool control, which then reads improved |
| The burst adds copies instead of moving requests | Equal request count invariant. The press is invalid |
| Requests answered out of arrival order | Answer order invariant. The press is invalid |
| Request rate 10 percent high | Cross-check: 6 of 6 rows outside tolerance |
| Answer time with half the spread | Cross-check: 4 of 6 rows outside tolerance |
| Answer time 10 percent short | Cross-check: 6 of 6 rows outside tolerance |
| The shared line changes nothing | Guardrail control |

The null control, the ample pool control, the guardrail control and the answer order invariant are each the only
thing that catches one fault. **Detection limit**: a lever side effect under 5 percent of the ordinary-day value is
not flagged. Reserve agents that shorten answers by 3 percent pass the ample pool control. The page says so, and
the same test holds it.

### 5.6 Primary measure and guardrail

Source for names, directions and thresholds: held by test `scale-response.test.mjs`. Source for the reasons:
measured during design.

| Role | Name | Direction | Threshold | Why this number |
|---|---|---|---:|---|
| Primary | `stopped vehicle-minutes per 1,000 vehicles` | lower is better | margin 861.558 at the default | 5 percent of the rates-only value of the no-lever event day. A change smaller than one twentieth of the event's stopped minutes would not alter a staffing choice, and the paired interval at 12 seeds is several times narrower |
| Guardrail | `late responder call fraction` | lower is better | allowance 0.05 on the change against the no-lever day | One call in twenty. It is a fraction of calls, so it does not move with a staffing input. It was set before any run of the final model |

On seeds that took no part in the choice (3001 to 3012 and 4001 to 4012) the largest guardrail harm of the two
levers was 0.0016 and the smallest harm of the shared line was 0.266. That is a factor of 30 and of 5 on each side
of 0.05. Source: measured during design.

The guardrail is an allowance on a change inside a teaching model. The fraction itself is a level. No reading of
the lab says that any fleet meets or misses any rule.

The count of stops of at least two minutes is a descriptive column, not a second guardrail.

### 5.7 Hand checks

The first note of every press gives the rates-only value of the tested arm and of the change. It names the fleet
size and the unit of both numbers. At the default it reads: "By rates only at 6,000 vehicles, in stopped
vehicle-minutes per 1,000 vehicles, the tested arm reads 4,676 and the change -12,555. The reserve is sized to
bring event load to capacity, so the direction of the main result follows from the inputs. The run adds chance,
the ordinary wait and the late responder call fraction." Source: held by test `scale-response.test.mjs`.

The note claims a direction from the inputs only on a press that read improved. On any other press its second
sentence reads: "The main result reads no reduction past the margin, so no direction is said to follow from the
inputs." Before the review fixes the note claimed the direction on every press. Source: held by test
`scale-response.test.mjs`, on four presses with three outcomes.

A lever that removes nothing returns the no-lever value exactly. A directive that lands after the last request
moved into the event has been answered has nothing left to remove. By rates only that request is answered 180
minutes times the event load after the event starts, which is 234 minutes at the default and 216 minutes at event
load 1.2. The rates-only value of such a directive is the no-lever value itself, so the note prints a change of 0.
Before the review fixes the two values came from two orders of arithmetic and differed in the last digits. At
event load 1.2 with a directive after 225 minutes the note printed a change of -0.0000000000018189894035458565,
and a typed load could print the same residue with a positive sign. Source: held by test
`scale-response.test.mjs`, which reads every load from 1.161 to 1.600 in steps of 0.001 at every whole delay from
15 to 240 minutes and finds every rates-only change of a directive either 0 or at least 0.5 in size. The printed
residue was read from the module of commit `319b4a9` for these notes.

By hand at the default, per 1,000 vehicles: the backlog grows at 0.6 vehicles a minute for 45 minutes, to 27. With
the reserve it then moves at 2 times (1.3 minus 4 over 3) a minute for the 135 minutes to the end of the event,
to 18. It then drains at 2 times (4 over 3 minus 0.65 times 6 over 7) a minute, which takes 11.6 minutes. The
backlog area is 3,749.4 vehicle-minutes. With the answer minutes of 926.64 the tested arm reads 4,676.0. Source:
held by test `scale-response.test.mjs`, to a relative 1e-6.

| At the default | Rates only | Simulated |
|---|---:|---:|
| Tested arm, stopped vehicle-minutes per 1,000 vehicles | 4,676.0 | 4,745.8 |
| Change against the no-lever day | -12,555.2 | -12,992.0 |

The cross-check table has six rows. Each prints its tolerance as a percent of the calculated value. Its caption
says that it checks the arithmetic, not any fleet. Source: held by test `scale-response.test.mjs`.

| Check | Calculated | Simulated | Tolerance, percent of calculated |
|---|---:|---:|---:|
| Mean wait on an ordinary day, queue formula, at 2,000 vehicles | 21.95 s | 20.22 s | 14 |
| The same at 6,000 vehicles | 3.73 s | 4.11 s | 13 |
| The same at 20,000 vehicles | 0.21 s | 0.23 s | 24 |
| Stops of at least two minutes on an ordinary day, percent of stops, queue formula, at 6,000 vehicles | 2.27 | 2.46 | 15 |
| Most vehicles waiting at once on the event day, rates only, at 6,000 vehicles | 108.0 | 110.6 | 20 |
| Minutes to clear after the event, rates only, at 6,000 vehicles | 121.9 | 128.1 | 20 |

Queue formula by hand, 2 agents at 65 percent busy: the share of requests that wait is 2 times 0.65 squared over
1.65, which is 0.5121. The mean wait is 0.5121 times 30 over 0.7, which is 21.948 s.

At small pools the tolerance is wide because chance is wide. The third row accepts a gap of 24 percent.

### 5.8 Pinned reference values of the default press

Default `{load: 1.3, lever: 'reserve', delay: 45}`, reserve by rule 2 agents, seeds 3001 to 3012. Source: held by
test `scale-response.test.mjs` against `scale-response.pins.json`. Means and changes are compared exactly.
Interval ends are compared to a relative 1e-9, because one browser build differed from Node in the last digits of
one end. One press of the default run through Node for these notes at commit `c08f60d` gave the same label, means
and interval ends. The review fixes moved no label, mean or interval end of the default press or of any press with
the reserve lever. They moved the label, the digest and the interval ends of every press with the directive lever,
and no mean, because the words of the declared change are part of the frozen test.

| Comparison | Label | Control mean | Tested mean | Mean change | 95 percent interval, nominal | Margin | Guardrail harm | Reads |
|---|---|---:|---:|---:|---|---:|---:|---|
| Main | `scale-spec:443de567` | 17,737.9 | 4,745.8 | -12,992.0 | -13,394.8 to -12,545.8 | 861.558 | 0.00003, within | `IMPROVED`, `ADVANCE_TO_NEXT_TEST` |
| Null control | `scale-spec:3fbf35ea` | 17,737.9 | 17,737.9 | 0 | 0 to 0 | 861.558 | 0 | `UNCHANGED`, `NO_RECOMMENDATION` |
| Ample pool control | `scale-spec:b98f9b28` | 940.0 | 934.2 | -5.8 | -6.4 to -5.2 | 46.663 | 0 | `UNCHANGED`, `NO_RECOMMENDATION` |
| Guardrail control | `scale-spec:7b210b97` | 17,737.9 | 17,587.0 | -150.8 | -172.1 to -128.8 | 861.558 | 0.324, past 0.05 | `UNCHANGED`, `HOLD` |

Means are stopped vehicle-minutes per 1,000 vehicles. The exact double of the main change is
-12992.038053000475. The late responder call fraction, as a level: 0.0015 with no lever, 0.0015 with the reserve,
0.3255 on one shared line. The exact guardrail harm of the main comparison is 0.00003417167851284857. The page
prints it as +0.000034. Before the review fixes it printed every digit of the double.

The chart "Event day by fleet size, one staffing ratio". Source: held by test `scale-response.test.mjs`.

| Part | At commit `c08f60d` |
|---|---|
| Categories | "2,000", "6,000", "20,000", under the head "Fleet size, vehicles". Before the review fixes a category read "2,000 vehicles" under the head "Fleet size" |
| Series | One bar series, the event day, and one line, rates only |
| Labels | All three rung labels are drawn at a drawing width of 296 px |
| Summary of the recorded chart | "Across 12 paired seeds, in stopped vehicle-minutes per 1,000 vehicles: event day 18,908, 17,738 and 17,032 at 2,000, 6,000 and 20,000 vehicles with one staffing ratio, and 17,231 by rates only at every size. The lean pool is in the table." |
| Summary while the press computes | "Computing across 12 paired seeds: event day has run at 1 of 3 fleet sizes.", then 2 and 3. Before the review fixes the partial chart carried the sentence of the recorded chart with gaps in it |

Table "Pooling and a correlated event", by fleet size, mean of 12 paired seeds:

| Vehicles | Agents | Ordinary wait | By the queue formula | Event day | Second lowest seed | Second highest seed | Rates only | Added by a burst at 0.8 of capacity | Reserve by rule, agents | Lean pool, agents | Lean pool busy share on an ordinary day | Lean pool event load | Lean pool event day |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2,000 | 2 | 20.22 s | 21.95 s | 18,908 | 10,672 | 24,249 | 17,231 | 82.0 | 1 | 2 | 0.65 | 1.30 | 18,908 |
| 6,000 | 6 | 4.11 s | 3.73 s | 17,738 | 15,470 | 19,608 | 17,231 | 40.5 | 2 | 5 | 0.78 | 1.56 | 43,418 |
| 20,000 | 20 | 0.23 s | 0.21 s | 17,032 | 15,273 | 18,800 | 17,231 | 5.0 | 6 | 14 | 0.93 | 1.86 | 100,820 |

The caption of the table ends: "Event-day columns, the two seed columns, rates only and the burst column are
stopped vehicle-minutes per 1,000 vehicles." No page sentence states an order of the three 12-seed event-day
means, because seed sets move a mean at the smallest fleet from 17,618 to 19,577. Source for that range: measured
during design.

Table "Capacity near saturation", reserve of 0 to 6 agents at 6,000 vehicles, landing after 45 minutes:

| Reserve agents | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Event load once they arrive | 1.30 | 1.11 | 0.98 | 0.87 | 0.78 | 0.71 | 0.65 |
| Stopped vehicle-minutes per 1,000 vehicles | 17,738 | 9,441 | 4,746 | 2,546 | 2,112 | 1,937 | 1,845 |

The event load once the reserve arrives is printed at two decimals and gains decimals while its text would read
1.00 for a load that is not 1. No load of the default press is that close. Source: held by test
`scale-response.test.mjs`, at typed event loads 1.17, 1.34 and 1.5.

Table "Landing in time", stopped vehicle-minutes per 1,000 vehicles at 6,000 vehicles:

| Lever lands after | Reserve staff join the pool | By rates only | A directive removes the ask | By rates only |
|---|---:|---:|---:|---:|
| No lever | 17,738 | 17,231 | 17,738 | 17,231 |
| 15 min | 2,141 | 1,602 | 953 | 879 |
| 60 min | 6,184 | 6,099 | 2,119 | 2,043 |
| 120 min | 11,071 | 10,936 | 5,797 | 5,720 |
| 180 min | 14,624 | 14,403 | 11,989 | 11,825 |
| 240 min | 16,828 | 16,502 | 17,693 | 17,231 |

Table of arms at 6,000 vehicles:

| Arm | Stopped vehicle-minutes per 1,000 vehicles | Stops of at least two minutes per 1,000 vehicles | Most vehicles waiting at once per 1,000 vehicles | Minutes to clear after the event | Late responder call fraction |
|---|---:|---:|---:|---:|---:|
| No lever | 17,738 | 617 | 110.6 | 128 | 0.002 |
| Reserve staff join the pool | 4,746 | 487 | 32.2 | 13 | 0.002 |
| One shared line | 17,587 | 617 | 109.6 | 128 | 0.325 |

Minutes to clear after the event. A day on which nothing waits at the end of the event reads 0. Before the review
fixes such a day read the gap to the next simulated event, a small number over zero. The cell is the mean of the 12
days, the empty ones as 0, and a mean under half a minute is printed at two significant digits. The three cells of
the default press did not move: 128, 13 and 128 minutes. Source: held by test `scale-response.test.mjs`.

| Press | Days of 12 on which nothing waits at the end of the event | The page prints, at commit `c08f60d` | The page printed, at commit `319b4a9` | Source |
|---|---:|---:|---:|---|
| Event load 1.3, directive after 15 min | 11. On the twelfth, seed 3006, vehicles wait for 0.316 min, so the mean is 0.026 min | 0.026 | 0.09638108345766845 | held by test `scale-response.test.mjs` for the days and the mean. Both printed values were measured for these notes |

Four more pinned setups, main comparison:

| Setup | Reserve by rule, agents | Label | Mean change | 95 percent interval, nominal | Margin | Reads |
|---|---:|---|---:|---|---:|---|
| Directive after 180 min | 2 | `scale-spec:16d331de` | -5,748.9 | -6,185.9 to -5,266.5 | 861.558 | `IMPROVED`, `ADVANCE_TO_NEXT_TEST` |
| Event load 1.6, reserve after 120 min | 4 | `scale-spec:ee3e401b` | -22,961.7 | -23,942.1 to -21,912.6 | 2,219.038 | `IMPROVED`, `ADVANCE_TO_NEXT_TEST` |
| Event load 1.2, directive after 240 min | 2 | `scale-spec:2f4598cb` | 0 | 0 to 0 | 521.532 | `UNCHANGED`, `NO_RECOMMENDATION` |
| Reserve after 240 min | 2 | `scale-spec:aa3ca7e3` | -909.5 | -1,064.6 to -761.5 | 861.558 | `INCONCLUSIVE`, `RUN_MORE_EXPERIMENTS` |

The declared change of a directive. At commit `c08f60d` it reads: "A directive removes the ask of every vehicle
request moved into the event, from 180 min after the event starts." At commit `319b4a9` it said "every request".
The model removes vehicle requests only, and the words now say so. The words are part of the frozen test, so the
digest and the label of every directive press moved, and with the digest the key of the bootstrap resamples.

| Pinned directive setup | Label before | Label after | Mean change, before and after | Interval before | Interval after |
|---|---|---|---:|---|---|
| Directive after 180 min | `scale-spec:42aa34d4` | `scale-spec:16d331de` | -5,748.9 | -6,198.5 to -5,266.7 | -6,185.9 to -5,266.5 |
| Event load 1.2, directive after 240 min | `scale-spec:6905c5e1` | `scale-spec:2f4598cb` | 0 | 0 to 0 | 0 to 0 |

Both outcomes and both recommendations are as they were. Source: held by test `scale-response.test.mjs` against
`scale-response.pins.json`. The labels before were read from the module of commit `319b4a9` for these notes.

The reading "not decided" of the last row of the four is where the rates-only change, -729.5, sits inside the
margin and chance carries the simulated mean past it. That reading also follows from where the margin was set.

Engine pins: the tape at 6,000 vehicles for seed 3001 holds 11,158 requests, of which 99 are responder calls. Its
event at load 1.30 moves 1,549 requests.

### 5.9 Compute per press

| Measure | Value | Source |
|---|---|---|
| Simulated days | 364 at the default: 30 days a seed for 12 seeds, and 4 replays | held by test `scale-response.test.mjs` |
| Simulated days over the page grid | 352, 364 or 376 with the replays: 29 days a seed at 50 settings, 30 at 55 and 31 at 55. An arm of the tables that equals the main arm runs once | measured for these notes |
| Tapes built | 52 at the default, of which 4 are fresh tapes for the replays | held by test `scale-response.test.mjs` |
| Engine runs | 0. The module imports `src/core/keyed.js` and the shared contract and no engine file | read in source for these notes |
| Whole press in Node | 457 ms, median of 5 presses that ran from 455 to 512 ms | measured for these notes, with other work on the machine. It was 459 ms, measured during design |
| First partial chart in Node | 34 ms, median of 5, after 24 simulated days | measured for these notes. The count of 24 days is held by test `scale-response.test.mjs` |
| Longest block in Node | 5.9 ms, median of 5 | measured for these notes. It was 5.7 ms, measured during design |
| Steps of the generator | 645 at the default, which are 644 yields and the return. 633 at the four other pinned setups and 657 with a directive after 225 min at event load 1.2 | measured for these notes |
| Timing gate | First chart within 1,000 ms, the press within 3,000 ms, longest block at most 8 ms | held by test `scale-response.test.mjs`, with the flag |
| Browser after the review fixes, pane of 1024 by 768 px, no throttle, three presses | Press to recorded result 477 to 491 ms | measured on the final tree. The pane was hidden, so the reading is time and no painted frame was seen |
| Hosted site, the same pane, one press | Press to recorded result 513 ms. Label `scale-spec:443de567` | measured on the hosted site |
| Browser before the review fixes, the same pane, one press | Press to recorded result 520 ms | measured on the integrated tree |
| Phone | 1.8 to 2.9 s a press | estimate. Not measured |
| Record | 29,596 characters at the default. Over the 160 settings of the page grid 29,183 to 29,708, the largest at event load 1.6 with a directive after 30 min. Before the review fixes the default held 29,391 | measured for these notes |
| Size of the module in the offline package, with its marker line | 22,647 bytes. It was 21,838 bytes at commit `319b4a9` | measured for these notes, on both commits by one method |

One simulated day costs about the same at every setting of the grid, because the pools fix the request count: 3,744,
11,232 and 37,440 requests a day by rates at the three fleet sizes. A press differs from another only by one day a
seed either way.

### 5.10 What this lab must never be read as claiming

- Any real request rate, answer time, staffing ratio or call volume, or how often a vehicle asks for help.
- That any staffing ratio or reserve is adequate for any fleet, or that the reserve by rule is a recommendation.
- That a lever works in practice, or that one lever is the right choice. The order of levers follows two delays.
- That a directive can be issued in any given time, or that a vehicle proceeding under one would be right to.
- That it describes any operator, city or past event.
- That any fleet meets or misses any rule. The page names none.
- Anything about driving, traffic, riders or what a late responder call leads to.
- That the flat event-day ladder was discovered. It follows from the declared event share and staffing rule.
- That the direction of the main result was discovered. It follows from the sizing rule of the reserve and from
  what a directive is.
- That the cross-check makes the model valid for a real fleet. It checks the arithmetic of the queue.
- That twelve seeds give a confidence level about the world, or that the interval covers 95 percent.

---

## 6. Seed records

These notes call no shipped seed set held out. Source for this section: measured during design, as the record of
each lab's design states it. The pins file of fleet intake also records its tuning seeds, 3001 to 3012, in the
field `tuning_seeds`. No test reads that field, so it is a record and not a check. Source: read in the pins file
for these notes.

Each lab keys its draws with its own prefix. Equal seed numbers in two labs therefore do not give equal draws.
Seeds 3001 to 3012 are the shipped seeds of response reserve and the tuning seeds of fleet intake, and the two
uses share no draw.

### 6.1 Density ladder

In the lab test a seed set n holds the 10 seeds n times 1,000 plus 1 to n times 1,000 plus 10. In that
convention the shipped seeds 31001 to 31010 are set 31.

| Seed sets | Use | What was chosen on them |
|---|---|---|
| 11, 12, 13 | Tuning grids and a probe of the visit wave, on earlier frames of the model | Two trips between visits. The bands 0.64 to 0.72 and 0.40 to 0.60. The observation behind the ceiling |
| none | Fixed before the first run of the final design stage | Margin 3. Allowances 0.02, 5 and 2. Prompt target 15 min. Hand tolerance 0.95 to 1.05. Ceiling 0.9 |
| 101 to 300, 401 to 600, 701 to 820 | Evaluation sweeps: inside the bands, across wider ranges, with held assumptions varied | Nothing |
| 321 to 323 | The level check and the window table | Nothing |
| 311 to 315, and sets 101, 134, 167, 200, 233, 262 and 266 of the sweep inside the bands | The 12 shape pins of the lab test: 5 setups on sets 311 to 315 and 7 points of that sweep. Read in the pins file for these notes | Nothing |
| 31, the shipped seeds 31001 to 31010 | The pins and every default number | Nothing before the freeze. First run after the region and every threshold were in the file |

The tuning runs passed the declared seed to the engine as it is. The final model passes a keyed engine seed. No
choice was made again after that change.

The design review then ran on the shipped seeds. It replaced one table column, added notes and rejected one
proposed sentence with evidence from those seeds. It changed no declared test, margin, allowance or refusal rule,
and no verdict number moved. The shipped seeds are therefore not called held out.

### 6.2 Fleet intake

| Seeds | Use | What they have seen |
|---|---|---|
| 3001 to 3012 | Tuning | Everything. Every design value was chosen on them: the allowance of 13 weeks, the default site power lead time of 48 weeks, the control ranges, the room floor, the hand check tolerances, the move of the deliveries lever to a control |
| 7001 to 7012 | Shipped. The pins and every default number | Not unseen. The default was run on them from the first build on. The first numbers of this model on them were read after every numeric design value had been chosen and before the deliveries lever became a control. No numeric design value changed afterwards |
| 8001 to 8012, 9001 to 9012 | Fresh points of a fresh sample, run once after the design was frozen | No run of this model before the freeze |
| 5001 to 5012, 6001 to 6012 | The default only, once, after the freeze | The same |

The shipped seeds 7001 to 7012 are not called held out.

### 6.3 Response reserve

| Seeds | Use |
|---|---|
| 1001 to 1012 | Design time. The allowance, the burst depth floor and the tolerance rules were tuned on it. The design sweep and the fault study ran on it |
| 2001 to 2012 | Design time. An earlier draft printed a default record on it |
| 3001 to 3012 | Shipped. First run after the model and every rule were frozen |
| 4001 to 4012 | Confirmation. Never used for a choice. The lab test reads the laws on it in every run |
| 7001 to 7096, 10001 to 12400, sets 11 to 30 | Probes: the ladder with 96 seeds, interval coverage, tolerance calibration |

The design review then ran on the shipped seeds. It added the table "Landing in time", the rates-only note and
two columns, cut one cross-check row and one chart series. It changed no declared test, margin, allowance or
refusal rule, and no verdict number moved. The shipped seeds are therefore not called held out. The record of the
design calls the set 4001 to 4012 held out. These notes call it a confirmation set, because a committed test now
reads it on every run.

### 6.4 The independent review after the build

The independent review of section 15 ran on the shipped seeds of all three labs. Its fixes changed no seed, no
margin, no allowance, no primary measure and no guardrail. They changed one declared test in its words, the change
of a directive, and two refusal rules for typed values: the ceiling of the density ladder and the step of the
event load. No threshold was chosen again. The review is one more reason why no shipped seed set is called held
out.

---

## 7. Robustness sweeps and region sweeps

Source for every count in this section: measured during design, unless a row names a test. The counts of
sections 7.2, 7.3 and 7.4 were taken before the review fixes and were not taken again. The fixes changed no engine
call, no primary measure, no guardrail and no margin, and the pinned shape tests and the pinned sample of those
sections pass at commit `c08f60d`. The counts of section 7.1 were taken again.

### 7.1 Region sweeps: every setting a reader can reach

Each sweep ran every setting through the real press and the control rule of the shared contract, on the shipped
seeds. Source for section 7.1: measured during design, and measured again for these notes at commit `c08f60d`
with one sweep a lab: 72, 702 and 160 presses. Every count of the three tables below came out as it was during
design. The second sweep read each count from the recorded result, not from the page.

| Count | Density ladder | Fleet intake | Response reserve |
|---|---:|---:|---:|
| Settings typed | 75 | 858 | 160 |
| Accepted | 72 | 702 | 160 |
| Refused | 3 | 156 | 0 |
| Threw | 0 | 0 | 0 |
| Invalid | 0 | 0 | 0 |
| Voided by a control | 0 | 0 | 0 |
| Null control exactly zero | 72 of 72 | 702 of 702 | 160 of 160 |
| Other controls as declared | 72 of 72 | 702 of 702 | 160 of 160 |

Together 0 of 934 accepted presses were voided.

| Lab | Readings of the main test |
|---|---|
| Density ladder, capacity | Improved and advanced at 25 of 25 |
| Density ladder, sites added | Within the margin at 22 of 22, with closer pickups at 120 cars at 22 of 22 |
| Density ladder, one site | Held at 25 of 25: 15 worse beyond the margin, 5 not decided, 5 within the margin. Longer pickups at 25 of 25 |
| Fleet intake, first arm | Improved and advanced at 351 of 351. Largest idle harm 7.17 weeks |
| Fleet intake, second arm | Improved at 351 of 351. Advanced at 168 and held at 183, which is 52.1 percent |
| Response reserve, reserve | 77 improved, 2 within the margin, 1 not decided, of 80 |
| Response reserve, directive | 75 improved, 3 within the margin, 2 not decided, of 80 |

Further counts of the same sweeps:

| Lab | Count |
|---|---|
| Density ladder | At every rung whose depot load by hand is past 1 the fixed depot serves fewer trips per car than the in-step depot, by more than the margin: 85 of 85 rungs |
| Density ladder | At the 15 rungs past the first whose load is 1 or under, the loss runs from 0 to 17 trips per 100 car-hours. Counted again in the check of these notes, it runs from -0.3 to 17.0: at one rung the fixed depot serves 0.3 trips per 100 car-hours more than the in-step depot. So the limit is approached and not met at once |
| Density ladder | In-step pickup distance: 4.8 to 7.0 km at the first rung. From the second rung on it stays between 3.5 and 4.4 km |
| Density ladder | At most 113 engine runs a press |
| Fleet intake | Lowest lower interval end 0.0409 of plan, which is 2.05 margins |
| Fleet intake | Both hand checks inside their tolerance at 702 of 702 |
| Fleet intake | In the weeks ahead table, weeks, gain and idle weeks rise row by row at 702 of 702. The gain per added week of the last step is under half of the first at 702 of 702 |
| Fleet intake | At 4 of 702 presses the idle harm sits within 0.05 weeks of the allowance |
| Response reserve | No lever adds stopped minutes, by rates only or simulated, at 160 of 160 |
| Response reserve | The simulated change passes the margin at 154 settings. There the rates-only change is 0.74 to 1.00 of the simulated change. Held by test `scale-response.test.mjs`, with the flag: the count of 154, and the ratio inside 0.70 to 1.05 |
| Response reserve | Both columns of "Landing in time" never fall with a later landing and never pass the no-lever day, at 160 of 160 |
| Response reserve | Every cross-check row inside its tolerance at 160 of 160 |

### 7.2 Density ladder: shape robustness

Keyed samples, one fresh seed set per point, 10 paired seeds, every comparison at every point, drawn after the
region was fixed.

| Claim | Inside the bands, 200 points | Wider ranges, 200 points | Bands with held assumptions varied, 120 points |
|---|---:|---:|---:|
| Density dividend: in step, pickups at 120 cars at least 20 percent under pickups at 24 cars | 99.5 percent | 64.5 percent | 97.5 percent |
| Diminishing returns | 98.0 percent | 50.5 percent | 87.5 percent |
| Car time moves to the depot, depot fixed | 100 percent | 98.5 percent | 100 percent |
| Decision: in step against fixed reads improved, no guardrail past | 100 percent | 97.5 percent | 100 percent |
| Null control exactly zero | 100 percent | 100 percent | 100 percent |
| Non-binding control within the margin | 100 percent | 100 percent | 100 percent |
| Sites added, where the hand rule permits it | 192 of 192 | 95 of 115 | 101 of 101 |
| One site held with at least one guardrail past | 100 percent | 100 percent | 100 percent |
| **Every claim a reader can reach, together** | **195 of 200** | **89 of 200** | **87.5 percent** |
| Hand check inside 0.95 to 1.05, three plans | 600 of 600 | 599 of 600 | 360 of 360 |
| First rung level in the measured hours | 85.5 percent | 87.5 percent | 83.3 percent |

The five misses inside the bands: four of diminishing returns in interval form, with the direction held in all
four, and one of the density dividend, a reduction of 17 percent. Sizes inside the bands: density reduction 17 to
54 percent, capacity change +45.2 to +71.2 trips per 100 car-hours.

The count of 600 of 600 for the hand check is no evidence for any law. Section 9.3.

The "held assumptions varied" sweep also drew road speed 32 to 44 km per hour, rider patience 8 to 16 min, energy
use 0.20 to 0.30 kWh per km, cleaning 6 to 10 min, upload 4 to 8 min and the pickup allowance 0.5 to 1.5.

Shape pins. Twelve setups of the capacity comparison run on seed sets on which nothing was chosen: five setups on
sets 311 to 315, and seven points of the sweep inside the bands, on sets 101, 134, 167, 200, 233, 262 and 266.
Eleven show every claim. One, on set 262, misses the density dividend, with pickups at 0.83 of the first rung, a
reduction of 17 percent, and is pinned as a miss.
Source: held by test `scale-density.test.mjs`, with the flag. The same file, with the flag, holds a reader grid of
27 pinned presses, of which 25 run and 2 are refused.

### 7.3 Fleet intake: shape robustness

Four sweeps of 240 points over the control box of an earlier design, each on its own 12 seeds. That box held the
release week as a third control. The shipped region is its slice at week 16.

| Sweep | Seeds start at | Points | Refused | Accepted | All laws and the idle trade together | Second arm advanced, held |
|---|---:|---:|---:|---:|---:|---|
| Controls only | 3001, tuning | 240 | 59 | 181 | 181 | 83, 98 |
| Controls only | 7001, shipped | 240 | 54 | 186 | 186 | 90, 96 |
| Controls only, fresh points | 8001 | 240 | 59 | 181 | 181 | 92, 89 |
| Controls only, fresh points | 9001 | 240 | 58 | 182 | 182 | 106, 76 |
| All 15 fixed assumptions moved as well | 3001 | 240 | 60 | 180 | 180 | 124, 56 |
| The same | 7001 | 240 | 52 | 188 | 188 | 124, 64 |
| The same, fresh points | 8001 | 240 | 50 | 190 | 190 | 128, 62 |
| The same, fresh points | 9001 | 240 | 57 | 183 | 183 | 126, 57 |
| Refusals lifted, wider box | 7001 | 240 | 0 | 240 | 57 | twelve patterns |

With the refusals lifted every law showed together at 57 of 240 points. The refusals are what make the lab
readable. Across the eight sweeps with refusals the null control was exactly zero and both non-binding controls
were exactly zero on the primary at 1,471 of 1,471 accepted points. No invariant failed in 364,808 runs.

The default on six seed sets:

| Seeds | Control, fraction of plan | First arm, 24 weeks ahead | Second arm, 36 weeks ahead |
|---|---:|---|---|
| 7001 to 7012, shipped | 0.570 | +0.185, idle +5.60, advance | +0.216, idle +14.47, hold |
| 3001 to 3012, tuning | 0.579 | +0.186, idle +5.46, advance | +0.215, idle +14.58, hold |
| 8001 to 8012 | 0.574 | +0.189, idle +5.15, advance | +0.219, idle +14.16, hold |
| 9001 to 9012 | 0.571 | +0.189, idle +5.09, advance | +0.221, idle +13.92, hold |
| 5001 to 5012 | 0.575 | +0.191, idle +4.99, advance | +0.220, idle +14.03, hold |
| 6001 to 6012 | 0.566 | +0.188, idle +5.24, advance | +0.222, idle +13.90, hold |

The idle weeks of the second arm sit 0.9 to 1.6 weeks past the allowance at the default.

A pinned sample of 12 accepted setups keeps every law, every control and every hand check. Source: held by test
`scale-intake.test.mjs`, in the normal suite.

### 7.4 Response reserve: shape robustness

Every setting of the page grid, 160 presses a seed set. The rules were written before any sweep of the final model
ran. No rule was changed afterwards.

| Rule | Design seeds 1001 to 1012 | Shipped seeds 3001 to 3012 | Confirmation seeds 4001 to 4012 |
|---|---:|---:|---:|
| Null control: every paired difference 0 | 160 of 160 | 160 of 160 | 160 of 160 |
| Pooling: the ordinary wait falls at each step | 160 | 160 | 160 |
| Burst: event day at the largest fleet at least 0.8 of the smallest | 160 | 160 | 160 |
| A burst under capacity adds at the largest fleet at most a third of what it adds at the smallest | 160 | 160 | 160 |
| Lean pool: event day at the largest fleet at least twice the same-ratio one | 160 | 160 | 160 |
| Saturation: the first agent removes at least 3 times what the last removes | 160 | 160 | 160 |
| A lever inside 0.6 of its clock reads improved | 113 of 113 | 113 of 113 | 113 of 113 |
| A late lever does not read improved, and a late directive changes nothing at all | 4 of 4 | 3 of 4 | 2 of 4 |
| The lever's guardrail within allowance | 160 | 160 | 160 |
| Guardrail control within the margin and held | 160 | 160 | 160 |
| Ample pool control within its margin | 160 | 160 | 160 |

The three misses of the late rule are reported as failed. A directive at 240 min (load 1.3, two sets) and at 225
min (load 1.2, one set) changed the primary by 0.1 to 0.3 percent and read within the margin. The rule asked for
an exact zero, and chance left a few requests waiting. No late lever read improved. The page note says "little or
nothing left to remove".

The ladder with 96 seeds a fleet size, seeds 7001 to 7096, stopped vehicle-minutes per 1,000 vehicles:

| Event load | 2,000 vehicles | 6,000 vehicles | 20,000 vehicles | Rates only | Fall, smallest to largest |
|---:|---:|---:|---:|---:|---:|
| 1.3 | 18,644, standard error 461 | 17,509, standard error 265 | 17,418, standard error 151 | 17,231 | 6.6 percent |
| 1.6 | 45,916, standard error 752 | 44,262, standard error 406 | 44,592, standard error 245 | 44,381 | 2.9 percent |

Over the same seeds the ordinary wait falls from 22.10 s to 0.22 s, which is 99 percent.

The cross-check tolerances were calibrated on 20 seed sets by 5 event loads when the table had seven rows: 700 of
700 rows inside. One row was cut afterwards. The count was not taken again for six rows.

---

## 8. What the interval and the controls can and cannot show

### 8.1 Interval coverage

The page prints "95% interval". Measured coverage of the instrument's interval in the response reserve model, over
200 disjoint sets of 12 seeds, with truth taken as the mean over all 2,400 pairs. Source: measured during design.

| Comparison | True mean change | Coverage at 12 seeds | Coverage at 24 seeds, 100 sets |
|---|---:|---:|---:|
| Reserve after 45 min | -12,661 | 91.0 percent | 93 percent |
| Directive after 45 min | -15,815 | 90.0 percent | 89 percent |
| Reserve after 225 min | -1,211 | 91.5 percent | 89 percent |
| One shared line | -165 | 93.5 percent | 93 percent |

Coverage is 90.0 to 93.5 percent at 12 seeds against a label of 95 percent. Twenty-four seeds bought nothing
measurable and would double the press. For 10 paired seeds a separate measurement on normal data read 90.7
percent. The declared test of every lab therefore calls the label nominal, and no pin rests on an interval end
near a margin.

### 8.2 No shipped control estimates a false alarm rate

Both arms of every null control share every draw. Common draws remove chance from the difference. A null control
therefore reads exactly zero on every seed, with an interval of 0.0 to 0.0. It tests pairing and hidden state: a
draw that depends on the arm, a state that leaks from one run into the next, an order dependence.

It cannot show how often the instrument would read a change beyond the margin on chance alone. No shipped control
of any of the three labs estimates that rate. The coverage study of section 8.1 is the nearest measurement in the
record, and it is not on the page.

### 8.3 A replay control cannot expose a deterministic error

The null control of the density ladder is a replay. The engine runs the same configuration again for the second
arm. A replay exposes hidden state and order dependence. An error that the engine repeats in the same way on
every run reads zero in a replay and passes. The title of the control says that it is a replay.

The same limit holds for the null controls of the two other labs. An error that both arms repeat reads zero.
What catches such an error in this package is outside the null controls: the hand rule of the density ladder
against a second copy built on the engine's site places, the conservation check against captured frames, the
identities and the plan definition of fleet intake, and the queue formula and the answer order invariant of
response reserve.

---

## 9. What was chosen with sight of outcomes

### 9.1 Fleet intake: the idle allowance and the default lead time

The idle allowance of 13 weeks and the default site power lead time of 48 weeks were chosen with sight of
outcomes, on the tuning seeds, so that the two arms read one advance and one hold. Source: measured during design.

| Choice | What was seen |
|---|---|
| Idle allowance 13 weeks | An allowance of 8 weeks was tried first. The two arms then read advance and hold at 179 of 181 accepted points, which is one pattern. With 13 weeks they read advance and advance at 83 points and advance and hold at 98 |
| Default site power lead time 48 weeks | It gives one advance and one hold at the default. A default of 40 weeks gives two advances |

At the default the idle allowance of 13 weeks is passed between 34 and 35 weeks ahead.

The page heading "Declared test, set before the run" is true of a press and not of the design. Both choices are
part of a decision that is assumed at the lead's recommendation, not ratified.

### 9.2 Response reserve: late responder calls at the smallest pool

At the smallest pool, 2 agents for 2,000 vehicles, 6.1 percent of responder calls are late on an ordinary day.
Two agents are both busy often enough, and no answer in progress is interrupted. The page does not show this
reading. The lab reads its levers and its guardrail at 6,000 vehicles, where that level on an ordinary day is 0.
Source: measured during design.

The guardrail is an allowance on a change. A level of 6.1 percent at the smallest pool is a property of pools
that were set small so that an ordinary wait can be read. It is not an estimate of any service.

### 9.3 Density ladder: the hand check takes a recorded result as an input

The hand value of busy minutes per trip uses the recorded pickup distance of the tested plan at 120 cars. The head
of its column says so. From the inputs alone, with the pickup allowance in place of the recorded distance,
simulated over by hand reads:

| Plan | From the inputs alone | With the recorded pickup distance |
|---|---:|---:|
| In step | 0.969 | 1.002 |
| Sites added | 0.941, outside the tolerance of 0.95 to 1.05 | 0.997 |
| One site | 1.010 | 1.003 |

With sites added the check is inside its tolerance only because a result of the run is one of its inputs. The
check covers the trip, depot leg and depot work times of the inputs. It can expose a wrong trip length, a wrong
visit frequency, a wrong depot work or charging time, a window cut in the wrong place or a wrong site layout. It
cannot expose anything about dispatch, density or queues. Its 600 of 600 in the band sweep is no evidence for any
law. Source: measured during design.

### 9.4 Other values that followed sight of outcomes

| Lab | Value | What was seen |
|---|---|---|
| Density ladder | Trips between depot visits, 2 | A probe of the visit wave on seed sets 11 to 13. The level check of section 3.3 measured it again on 30 other seeds |
| Density ladder | The bands of the two ratios | Tuning grids on seed sets 11 to 13 |
| Fleet intake | The room floor of 8 weeks | Chosen on the tuning seeds. The floor study of section 4.4 ran on four seed sets after the design was frozen |
| Fleet intake | The deliveries lever as a control | A defect probe on the tuning seeds |
| Response reserve | The wording "little or nothing left to remove" | Two seed sets showed that "removes nothing" was too strong |
| All three | Tables, notes and captions added in the design review | The review ran on the shipped seeds |

---

## 10. Rejected arms, checks and guardrails

Source for this section: measured during design. None of these ships. The three options named in sections 10.1
and 10.3 as declined for this wave are part of a decision that is assumed at the lead's recommendation, not
ratified.

### 10.1 Density ladder

| Rejected | Why |
|---|---|
| Depot fixed with visits half as often | Held by stored energy in 58 percent of setups. Measured on an earlier frame of the model and not measured again |
| Site power alone scaled | The reading depends on how whole bays round. Earlier frame, not measured again |
| Sites added compared with the fixed depot | It repeats the first comparison and cannot separate siting from capacity. Earlier frame, not measured again |
| Mean wait of served riders as a guardrail | It is conditional on being served, so a plan that serves the long-waiting requests looks worse. Earlier frame, not measured again |
| Completed requests over all requests as the primary | It counted 4.4 to 7.9 percent of requests that could not finish before the end |
| A reference curve by the inverse square root of idle cars, with its column | Both sides of the ratio were results of the same run, so it checked nothing |
| A closed form for the nearest of the idle cars | It was 4 to 41 times off at 120 cars with the depot in step |
| Both arms of each control run again | 123 engine runs a press, past the limit of 120 |
| The sentence "Trips per car hold while the load by hand stays under 1" | The default table reads 106.7 trips at a load of 0.95 against 117.2 in step |
| Pickup distance as the primary of the two siting comparisons. Declined for this wave | Its margin would be declared after the results were seen |
| A fourth comparison: in step against a depot doubled once and then held. Declined for this wave | Section 10.2 |

### 10.2 Density ladder: the window table and the first look at the lagging depot

Every size belongs to its window. Thirty seeds, 12-hour runs, 120 cars, default setup, paired t interval. Changes
are in completed trips per 100 car-hours.

| Measured minutes | Capacity: fixed to in step | Change, with interval | Sites added against in step | One site against in step |
|---|---|---:|---:|---:|
| 120 to 480 | 62.2 to 116.3 | +54.1 (52.9 to 55.3) | +0.69 | -8.77 |
| 180 to 480 | 57.1 to 117.3 | +60.2 (58.8 to 61.6) | +0.08 | -9.62 |
| **240 to 480, the declared window** | 54.5 to 117.7 | **+63.2 (61.6 to 64.8)** | -0.23 | -9.14 |
| 300 to 480 | 53.2 to 117.1 | +63.9 (62.2 to 65.6) | +0.34 | -8.37 |
| 240 to 600 | 52.9 to 117.2 | +64.3 (63.1 to 65.6) | -0.22 | -7.93 |
| 240 to 720 | 51.4 to 117.1 | +65.7 (64.6 to 66.8) | +0.03 | -8.21 |
| 480 to 720 | 48.4 to 116.5 | +68.1 (66.5 to 69.7) | +0.28 | -7.28 |

The sign never changed. The size of the capacity change runs from +54 to +68 across windows at the default. Over
the four hours after the measured window the pickup distance at the first rung still eases by 0.3 to 0.6 km, so
the size of the density dividend also belongs to the window.

The first look at the lagging depot. The change is in step less a depot that was doubled once and then held, at
120 cars, on the shipped seeds. The word is a reading of a paired t interval against the margin of 3, not the
instrument's word.

| Depot load at the first rung | Hand load of the held depot | Street load 0.64 | Street load 0.68 | Street load 0.72 |
|---:|---|---|---|---|
| 0.40 | 0.96 to 1.00 | +0.06, within | +0.02, within | -0.62, within |
| 0.45 | 1.12 | +5.75, improved | +1.35, not decided | +11.29, improved |
| 0.50 | 1.19 to 1.24 | +5.63, improved | +14.79, improved | +22.85, improved |
| 0.55 | 1.34 to 1.36 | +10.73, improved | +17.94, improved | +26.50, improved |
| 0.60 | 1.42 to 1.47 | +31.40, improved | +22.75, improved | +30.98, improved |

The reading changes as the hand load passes 1. It is not smooth near the threshold. Whole bays and steps of 10 kW
make capacity lumpy, and at a street load of 0.64 two lower interval ends are 3.5 and 4.1 against the margin of 3.
The comparison needs its own sweep and pins kept away from those setups before it can ship. This first look is
one pass on one seed set. It is a lead, not a finding.

### 10.3 Response reserve

| Rejected | Why |
|---|---|
| The event against an ordinary day as an arm | A condition is not a lever. The page would print a recommendation on it |
| A combined arm, or an arm read against another arm | One main comparison a press |
| A directive in the ample pool control | On the absorbed burst its change was -37.1 against a margin of 46.663, which is 80 percent of the margin, because a directive removes work wherever it lands. That is not a non-binding setting. The control always runs the reserve |
| The count of stops of at least two minutes as a second guardrail | It never bound in 246 and 562 setups of two earlier designs |
| 24 paired seeds | Coverage did not move. The press took 884 ms and the record 40,916 characters |
| The busy share row of the cross-check | It restated the staffing input |
| The lean pool in the chart | On one axis it flattened the ladder. It stays in the table |
| The lean pool as a third lever, read at 20,000 vehicles. Declined for this wave | It needs its own declared test, a guardrail on the ordinary wait and a sweep |
| Backlog and longest wait at the landing minute | 574 bytes |

### 10.4 Fleet intake

| Rejected | Why |
|---|---|
| The deliveries lever as a third arm | Its reading is the same at every accepted setup. As an arm it left a hole: a removal draw keyed by the delivery pace passed the two other controls. As a control with the exact rule it closes that hole |
| The release week as a control | It did not move the declared test. Over its whole range the gain of the first arm reads 0.1847 at weeks 12 to 18 and 0.1846 at week 20 |
| Site power over ports as the governing ratio | Section 4.4 |
| A ratio floor of 1.5 | It refused readable setups, for example a ratio of 1.36 with 10 weeks of room |
| An idle allowance of 8 weeks | Section 9.1 |
| Guardrails on the largest door stock and on the out-of-service share | The lever could not move them |
| A third hand check, on the out-of-service fraction | Section 4.7 |
| A ladder of three treatment arms in one press | One select and one comparison a press |

---

## 11. The keyed-draw rule in the response reserve lab

The package rule asks for keyed draws from `src/core/keyed.js`, with no clock and no `Math.random` in
`src/model`. The fleet intake lab and the density ladder draw only keyed values. The response reserve lab takes
one keyed draw per simulated minute and expands it with a local stream that is a pure function of that draw. A
day replays exactly. Source: held by test `scale-response.test.mjs`, which pins one tape and rebuilds it.

This reading of the rule is a decision that is assumed at the lead's recommendation, not ratified.

The measured cost of the alternatives. One ladder of the lab holds 3,144,960 random numbers. Source: measured
during design.

| Way to draw | Microseconds per draw | One ladder |
|---|---:|---:|
| One keyed draw per random number | 0.81 to 0.83 | about 2.6 s |
| The cached prefix hasher already in `src/core/keyed.js` | 0.33 to 0.35 | about 1.1 s |
| The same, using both halves of each 64-bit value | not measured | about 0.6 s, an estimate |
| One keyed draw per simulated minute, then a local stream, as shipped | | 64 to 70 ms |

Two earlier measurements of one keyed draw per random number read 0.87 to 0.90 and 0.88 to 1.06 microseconds.
Against the cached prefix hasher, the cheapest keyed alternative that was measured, the local stream is about 16
times faster. Against the estimate of 0.6 s it is about 9 times faster.

Precedent. The shipped engines already draw from a local stream seeded by the declared seed:
`src/model/bay-operations.js` and `src/model/street-simulation.js`. The density ladder inherits that through the
engine. The reading is the site's practice, not a new departure.

If the owner declines the reading, the lab draws through the cached prefix hasher, every pin of the lab is
recorded again, and its press takes about 1 s longer.

---

## 12. Names and public values

### 12.1 The engine's car-mix key

The Fleet day engine selects the mix of car types through a configuration key. The name of that key holds a
product name of a real vehicle. The density ladder sets the key to 0 so that one car type runs, the default car
of Fleet day. The alternative, the default mix of two car types, would double the hand rule.

The key is an identifier the engine requires. It appears in the module as an identifier in code. It is in no page
text and in no record. Source: held by test `scale-density.test.mjs`, which scans every string literal of the
module and the recorded JSON of every comparison.

### 12.2 The road table

The road distances of the density ladder come from the shipped Fleet day road table, which is frozen
OpenStreetMap road geometry of a real region under its open licence. The lab takes distances and nothing else.
The inputs table says so in its own row, with the source prefix "Fleet day map". Since the review fixes the page also
shows the credit line of section 3.3 in every state: the OpenStreetMap credit, linked to its copyright page, the
licence name ODbL and one sentence on what the lab takes from the map. The full notice is
`docs/FLEETLAB_BAY_AREA_MAP_DATA.md`. Whether the row and the credit line are enough for the licence is a decision
that is assumed at the lead's recommendation, not ratified.

### 12.3 Two public definitions in the response reserve lab

Two fixed inputs are set to a public value. They are the only ones in the three labs.

| Input | Value | Public definition it equals | Publisher and date |
|---|---|---|---|
| Responder call target | 30 s | An answer requirement: two-way communication with response inside 30 seconds | California Department of Motor Vehicles, release on new regulations, 2026-04-28 |
| Long stop | 120 s | A reporting threshold: stoppage events of two minutes or more are reported at incident level | California Public Utilities Commission, Decision 24-11-002, decided 2024-11-07 |

The two values come from two different rules. The page calls both a teaching assumption and names no rule. No
reading of the lab says that a fleet meets or misses a rule. Both sources were opened again on 2026-09-27 while
these notes were written, and both read as stated.

### 12.4 Public counts

No fleet size or count of a lab is set to a current public count.

The default page of fleet intake stays away from four publicly reported vehicle counts: 300, 2,000, 3,200 and
4,000. No count on that page is within a tenth of any of them. Source: held by test `scale-intake.test.mjs`.

The first rung of response reserve, 2,000 vehicles, is a round rung of a ladder of 1, 3 and 10. It coincides with
an older public count. It carries no meaning, and the levers act at 6,000 vehicles. Changing it would move every
pin of the lab.

---

## 13. Reproduce

Run from the repository root with Node.js 22 and Python 3.11. The measured version is Node 22.22.0. The pins
compare doubles that come through `Math.log`, `Math.exp` and `**`, so a change of Node version can move them. A
pin that fails after a change of version is reported, never fixed by writing the pins again without a reason.

### 13.1 Open the labs

```bash
python -m http.server 8765 --bind 127.0.0.1 --directory playground/fleetlab
```

Open `http://127.0.0.1:8765/#/scale-lab`. Choose another port if this one is occupied. The preview stays on
loopback. Lesson links: `#/scale-lab?lesson=density-ladder`, `#/scale-lab?lesson=fleet-intake`,
`#/scale-lab?lesson=response-reserve`.

### 13.2 The four test files

```bash
node --test playground/fleetlab/test/scale-lab.test.mjs
node --test playground/fleetlab/test/scale-density.test.mjs
node --test playground/fleetlab/test/scale-intake.test.mjs
node --test playground/fleetlab/test/scale-response.test.mjs
```

The same four with the flagged tests, serially, on an idle machine:

```bash
FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 \
  playground/fleetlab/test/scale-lab.test.mjs \
  playground/fleetlab/test/scale-density.test.mjs \
  playground/fleetlab/test/scale-intake.test.mjs \
  playground/fleetlab/test/scale-response.test.mjs
```

| Run | Result | Source |
|---|---|---|
| Four files without the flag | 92 tests: 86 pass, 6 skipped by the flag, 0 fail. 31.6 s, with other work on the machine | measured for these notes |
| Four files with the flag, serial | 92 tests: 92 pass, 0 fail. 121.7 s | measured for these notes |
| The same, by file | `scale-lab` 34, `scale-density` 21, `scale-intake` 17, `scale-response` 20. All pass | measured on the final tree, and for these notes |
| The same four files at commit `319b4a9` | 61 tests: 22, 14, 14 and 11 in the same order. The review fixes added 12, 7, 3 and 9, which are 31 | measured for these notes, on an exact copy of that commit |
| Four files with the flag at the design stage | 61 of 61 in about 103 s | measured during design |

Section 15.2 names the test that holds each fix of the review.

### 13.3 One press through Node

```bash
node --input-type=module -e "
import {LAB} from './playground/fleetlab/src/model/scale-density.js';
const d = LAB.derive(LAB.defaults());
const g = LAB.steps(d.setup); let s; do { s = g.next(); } while (!s.done);
const r = s.value, p = r.analysis.primary;
console.log(r.label, r.analysis.outcome, r.analysis.recommendation, p.mean_delta, p.ci_low, p.ci_high);
"
```

Replace the module by `scale-intake.js` or `scale-response.js` for the two other labs. The three lines printed
for these notes:

```text
scale-spec:b4c7f5da IMPROVED ADVANCE_TO_NEXT_TEST 62.604166666666664 60.645833333333336 64.375
scale-spec:1aa8c833 IMPROVED ADVANCE_TO_NEXT_TEST 0.1846649238409015 0.17220252590364324 0.19649763644177054
scale-spec:443de567 IMPROVED ADVANCE_TO_NEXT_TEST -12992.038053000475 -13394.778992875907 -12545.804281982228
```

### 13.4 The full gates

```bash
FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 "playground/fleetlab/test/*.test.mjs"
FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 \
  python -m pytest -q -p no:cacheprovider \
  tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py
python -m ruff check .
git diff --check
```

| Gate | Result | Source |
|---|---|---|
| Full serial Node suite with the flag | 1,968 tests: 1,967 pass, 0 fail, 0 cancelled, 0 skipped, 1 existing todo. 281.9 s | measured on the final tree |
| The same before the review fixes | 1,937 tests: 1,936 pass, 0 fail, 0 skipped, 1 existing todo. 265.7 s | measured on the integrated tree |
| Python parity and boundary tests | 89 pass | measured on the final tree, and on the integrated tree |
| `ruff` | All checks passed | measured on the final tree |
| `git diff --check` | Clean | measured on the final tree. Run it again on the staged diff before a commit |

The 31 tests the full suite gained are the 31 the four Scale files gained. The existing todo is the browser-only
layout check at 400 px, and it is not counted as passed. The full suite, the Python tests and `ruff` were not run
again for these notes: their results above are the lead's, on the final tree.

Run the flagged tests serially on an idle machine. A timing test that fails under load is run again alone before
it is believed.

### 13.5 Pack and check

Write outside the repository. `<outside>` is any folder outside the tree.

```bash
node playground/fleetlab/tools/pack.mjs --out <outside>/fleetlab-playground.html
node playground/fleetlab/tools/check-dist.mjs <outside>/fleetlab-playground.html
node playground/fleetlab/tools/pack.mjs --site <outside>/site
node playground/fleetlab/tools/check-dist.mjs --site <outside>/site
```

The site inventory is one row a file, for all 99 files with `_headers` among them: path, file SHA-256 and size,
separated by NUL characters, each row ended by a newline, rows sorted by path. Its SHA-256 is taken over the rows:

```bash
cd <outside>/site && find . -type f | sed 's#^\./##' | LC_ALL=C sort | while read -r f; do
  printf '%s\0%s\0%s\n' "$f" "$(shasum -a 256 "$f" | cut -d' ' -f1)" "$(wc -c < "$f" | tr -d ' ')"
done | shasum -a 256
```

| Check | Result | Source |
|---|---|---|
| Offline package | 2,408,323 bytes, 0 problems. SHA-256 `4828cded63f5c23f99a8d13cc32716f587717f57847dd79bdba59215786800b5` | measured on the final tree, and for these notes |
| Site | 99 files with `_headers`, 3,349,602 bytes in all, 0 problems | measured on the final tree, and for these notes |
| Site inventory | SHA-256 `5c071dc69e353f6118ab43078c12d2470c9d709cf2ac7c501fe4fb807c669da3`. It equals the inventory of the hosted files in the release record | measured for these notes |
| Offline package at `319b4a9`, before the review fixes | 2,403,901 bytes | measured on the integrated tree, and for these notes |
| Offline cap | 2,621,440 bytes, so 213,117 bytes remain. 135,904 of them are reserved for other work, which leaves 77,213 unassigned. It was 166,681 before this wave | measured on the final tree |

For these notes the packer ran on a copy of the commit taken with `git archive`. The packer finds the repository
root by its `.git`, so the copy needs one: an empty file named `.git` at the copy's root is enough. The checker
reads the label tuple from the repository, so it ran from the checkout on the packed files.

---

## 14. Measured, estimated and not done

### 14.1 Package growth

The baseline offline package is 2,318,855 bytes. The target growth of this wave is 81,920 bytes and the hard stop
is 92,160 bytes. Both lines were set by the lead. Granting the bytes past the target is a decision that is assumed
at the lead's recommendation, not ratified. Source: measured by the lead at each commit, on the integrated tree and
then on the final tree. The rows of `319b4a9` and `c08f60d` were measured again for these notes.

| After | Commit | Offline package, bytes | Growth, bytes |
|---|---|---:|---:|
| Baseline | `c79eccf` | 2,318,855 | 0 |
| The shell with three stub labs | `2caeac6` | 2,357,617 | +38,762 |
| Amendment: a press is void on a missing guardrail or a failed control | `05113ab` | 2,358,553 | +39,698 |
| Amendment: readings stay on their side of a threshold | `953ebce` | 2,359,746 | +40,891 |
| Amendment: the labs in the order of their story | `9fdb160` | 2,360,022 | +41,167 |
| Response reserve | `27f6014` | 2,376,259 | +57,404 |
| Fleet intake | `1a81ae8` | 2,391,500 | +72,645 |
| Density ladder | `319b4a9` | 2,403,901 | +85,046 |
| The fixes of the independent review | `c08f60d` | 2,408,323 | +89,468 |

The growth passes the target by 7,548 bytes and stays 2,692 bytes under the hard stop. The review fixes cost 4,422
bytes. At commit `319b4a9` the growth passed the target by 3,126 bytes and stayed 7,114 bytes under the hard stop.
Sections 3.10, 4.9 and 5.9 give the size of each lab module inside the package.

### 14.2 Browser acceptance

Source: measured on the final tree by the lead, on the native modules, in a hidden pane with no throttle, unless a
row says otherwise. The pane was hidden, so every reading is layout or time and no painted frame was seen. No
physical phone was used.

| Check | Density ladder | Fleet intake | Response reserve |
|---|---|---|---|
| Press to recorded result at 1024 by 768 px, three presses | 966 to 1,034 ms, first chart after 51 to 70 ms | 111 to 115 ms | 477 to 491 ms |
| The same on the hosted site, one press. Source: measured on the hosted site | 1,044 ms | 102 ms | 513 ms |
| Focus after Run | On the Result heading | On the Result heading | On the Result heading |
| Primary buttons | One | One | One |
| Console | No error | No error | No error |
| At 375 by 812 px after a press | Scroll width equals client width, 375 px. Run in the sticky bar at y 721 to 774 px. All five rung labels drawn. The map credit shown | Scroll width 375 px. Run in the sticky bar. No map credit | Scroll width 375 px. Run in the sticky bar. All three rung labels drawn. No map credit |
| Text after a press | No "left of the band". No visible number with more than 12 decimals | The same | The same |

Before the review fixes, on the integrated tree, one press each: 1,060 ms with the full test suite running at the
same time and the first chart at 59 ms, 99 ms, and 520 ms. That reading found no sideways overflow at 375 by
812 px. It did not hold after a press: the review measured a page 406 px wide after a press of the density ladder
and 522 px wide after a press of response reserve, on a screen 375 px wide. Section 15.2.

A timing harness that watched the whole page for changes made the fixed build look 4 to 8 times slower than the
commit before it. A harness that watched only the status line showed no difference. The first reading came from
the harness, not from the page. Source: measured on the final tree.

### 14.3 Estimated

| Item | Estimate |
|---|---|
| A press on a slow phone | Density ladder 4 to 13 s. Fleet intake 0.4 to 0.8 s. Response reserve 1.8 to 2.9 s |
| A block of one engine run on a slow phone | 100 to 300 ms |
| Keyed draws using both halves of each 64-bit value | About 0.6 s a ladder |

### 14.4 Not done

- No push and no pull request. The deployed source is on no remote branch.
- No painted frame was seen. Every browser reading was taken in a hidden pane.
- No phone was measured, physical or throttled, and no measurement at 1440 by 900 px was taken.
- No screen reader, Safari or Firefox was tried.
- No security scan of this range was run. The review had one packaging and security lens.
- The broad Python suite of the repository was not run. Only the two playground files ran.
- No person looked at a lesson page with a visible pane. After the deployment the lead swept every lesson link in
  a real browser, but with the pane hidden: all 59 lesson links and the 9 page routes on the stable address, in the
  in-app browser (Chromium engine), by changing the address hash with no reload. It read 0 error pages, no console
  error and one lesson whose main heading did not match its document title. A second sweep visited all 59 lesson
  links on the fake page model with the modules downloaded from the live site and saw the same defect. It is a Fleet
  day defect older than this wave, which `1aeaace` fixes and which is not deployed, section 16.
- No sweep of any declined comparison was run. The first look of section 10.2 is one pass on one seed set.
- The rejected arms of the density ladder were measured on an earlier frame of the model and not measured again.
- The calibration count of the cross-check was not taken again after one row was cut.
- The interval coverage was measured in the response reserve model only. The figure for 10 seeds is from normal
  data, not from the density ladder.
- No hand check of fleet intake was shown to catch a model fault.
- No control that estimates a false alarm rate exists.
- No independent human review has taken place.

### 14.5 Known open items

Each item is known, small and left for a later change. None moves a verdict number.

| Item | Where |
|---|---|
| Going back to a lesson address discards the recorded result and the edited setup | `src/ui/studio.js` |
| A typed governing ratio of more than 12 decimals is echoed whole in the inputs table of the density ladder | `src/model/scale-density.js` |
| A hand load of the density ladder that sits closer to its threshold than six decimals prints as text with up to 17 decimals by the lab's own rule, while the shared sided text stops at 12. Only a ratio typed to more than three decimals can reach it, section 3.3 | `src/model/scale-density.js` |
| Where 12 decimals still read on a threshold, `sidedText` moves the last decimal one step toward the value's own side, so the text is off by less than 1e-12 | `src/ui/experiment.js` |
| The event load control of response reserve declares a step of 0.1 and accepts typed steps of 0.01 | `src/model/scale-response.js` |
| The fleet intake table "One fleet, several counts" can print a row one vehicle off from its two parts after rounding: 43 of 1,053 distinct columns, section 4.8. Its caption makes no sum claim | `src/model/scale-intake.js` |
| Pages older than the Scale lab still print a long raw number for a tiny value. That is the rule of the site, held by existing tests. Only the Scale lab prints two significant digits | `src/ui/experiment.js` |
| `playground/fleetlab/README.md` carries older facts that predate this wave, among them the former address of the site. Left for the owner | `playground/fleetlab/README.md` |
| The lesson snapshot that the teaching-frame wave keeps outside the tree still counts 56 lessons. The site now has 59 | Outside the tree |

---

## 15. The independent review after the build

### 15.1 How it ran

After the seven build commits, `2caeac6` to `319b4a9`, an independent review read the range `c79eccf..319b4a9`
through seven lenses. Two verifiers checked each critical or important finding, one by running code and one by
reading it. 13 findings were confirmed by both verifiers and none was refuted. 25 minor findings were listed.
Several confirmed findings are one defect seen through different lenses, which leaves 9 distinct defects.

No defect moved a verdict number. Every one was reachable by a visitor, and none of the 1,937 tests of the
integrated tree (1,936 passing, 1 existing todo) had caught any of them. Commit `c08f60d` fixes all nine, each behind a test that failed first.
The readers wrote none of the code they read. They are stages of the same assisted workflow as the build, so this
is not a human review.

### 15.2 The nine defects and their fixes

| No. | Defect at `319b4a9` | Where a visitor met it | Fix in `c08f60d` | Held by |
|---:|---|---|---|---|
| 1 | The verdict readout said the interval "lies left of the band" and that "left is better", over printed numbers that were all to the right. The Scale lab draws no strip, so there was no band to be left of | The default press of the density ladder and of fleet intake | `renderVerdictReadout` takes an option `plotted`, true by default. The Scale lab passes false. Its caption then names the measure and the declared direction only, and the visible outcome sentence states the interval as printed | test `scale-lab.test.mjs` |
| 2 | After a press the page scrolled sideways on a screen 375 px wide: 406 px of page on the density ladder, 522 px on response reserve | A phone | `.scale-lab .fl-readout { grid-template-columns: minmax(0, 1fr); }`, so the guardrail table of the verdict readout scrolls inside its own region | test `scale-lab.test.mjs` for the rule. Scroll width 375 px for all three labs, measured on the final tree |
| 3 | The depot queue bars were drawn over both lines and hid their points from 48 cars on | The density ladder chart | Every bar series is drawn before every line series and its points. Legend, mark style and table keep their order | test `scale-lab.test.mjs` |
| 4 | Two of the three chart lines were drawn alike: the same stroke and the same legend swatch, with only their point markers different | The fleet intake chart | The three line marks differ by shape: filled points with a plain line swatch, ring points with a ring swatch, square points with a square swatch | test `scale-lab.test.mjs` |
| 5 | Depot induction was booked the whole depot door stock of any week with a place left over, 6.3 times too much in the control at the default | The fleet intake table "The gate that binds" | The stock of each week is split: up to the free places on depot induction, the rest on the resource that holds the next tranche. At the default the control reads depot induction 290 and site power 20,106 vehicle-weeks | test `scale-intake.test.mjs` against `scale-intake.pins.json` |
| 6 | Floating point residue printed as a result, sometimes with the wrong sign, and minutes to clear printed with 17 decimals | The first note and the arms table of response reserve | A lever that removes nothing returns the no-lever value exactly. Minutes to clear read 0 on a day with nothing waiting at the end of the event. A cell under half a unit of its last decimal prints at two significant digits | test `scale-response.test.mjs` |
| 7 | A caption said that the rows sum to the total, which the rounded rows do not always do | The fleet intake table "The gate that binds" | The caption says "before each is rounded to a whole vehicle-week" | test `scale-intake.test.mjs` |
| 8 | No visible credit of the road map and no licence name | The density ladder | The lab declares `LAB.map` and `LAB.credit`. The page shows the credit link, the licence name ODbL and the credit sentence in every state, section 3.3 | tests `scale-lab.test.mjs` and `scale-density.test.mjs` |
| 9 | The side-preserving numbers of `953ebce` reached only some surfaces of the four-area verdict card, so one value could print two ways on a page that existed before | The four-area card, in edge cases | The rule is opt-in. `metricValueText` and `valueWithMinutes` take `against`, null by default, which gives the text of `c79eccf` byte for byte. `runLine` passes it only when `tools.sided`. Only the Scale lab opts in | test `scale-lab.test.mjs` with `scale-lab.legacy-text.pins.json` |

### 15.3 Pages that existed before the Scale lab

After `c08f60d` no page that existed before this wave prints different text. The test `scale-lab.test.mjs` holds
that against `test/scale-lab.legacy-text.pins.json`, which holds 900 pairs of number text and 19 verdict views. A
pair is the text of `metricValueText` and of `valueWithMinutes` for one measure, one value and one set of options.
A view is the digest of a verdict readout drawn three ways, of a verdict card and of six reading lines. The pins
were computed once from the verdict card module and the teaching frames module as they were at `c79eccf`, before
the Scale lab. The inputs are in `test/helpers/legacy-text.mjs`. Section 2 gives the sided text rule that only the
Scale lab asks for.

### 15.4 What the review changed in each lab

| Lab | What changed | What did not move |
|---|---|---|
| All three | The readout names the declared direction only and states the interval as printed. Every number of the tables, the notes and the readout goes through `sidedText`: a tiny value prints at two significant digits and never as its raw double, and the numbers of the readout keep their side of the margin and of each allowance. The guardrail table of the verdict readout scrolls inside its own region. The shared ladder chart draws bars before lines, and every category label when all fit | No label, digest, mean, interval end, outcome or recommendation of a default press. Every version string stays `1.0.0` |
| Density ladder | The map credit. Chart categories "24" to "120" under the head "Fleet size, cars". A hand load printed on its true side of 1 and of the ceiling. The ceiling rule compares the load itself, so a typed setup whose tested hand load lies above 0.9 and under 0.905 is now refused. The inputs row "Held fixed" states the prompt pickup window. Each governing ratio printed at the decimals it holds | Labels, means, interval ends and guardrail harms of all three comparisons. The 75 settings of the reader grid read as before: 72 run, 3 refused. Records 31,665, 31,388 and 31,386 characters, which were 31,683, 31,438 and 31,449 |
| Fleet intake | The depot door rows of "The gate that binds", its caption and the sixth note. The chart lines differ by shape. The refusal says "1 week" and names ports as the next gate only when site power arrives after it | Labels, digests, means, interval ends and guardrail harms of both arms and all three controls. The sum of the depot door rows, every other row and the total. Records 33,961 and 34,099 characters, which were 33,720 and 33,856. The SHA-256 of the whole result of each arm moved with them |
| Response reserve | Minutes to clear. A lever that removes nothing reads the no-lever value exactly. The first note names its fleet size and unit, and claims a direction only on a press that read improved. A typed event load off a step of 0.01 is refused. The declared change of a directive. Chart categories "2,000", "6,000", "20,000" under the head "Fleet size, vehicles", and a sentence of its own while the press computes. The inputs row "Requests" says that a directive leaves responder calls in the pool | Labels, means and interval ends of every press with the reserve lever. Every mean of every press. The default record is 29,596 characters, which was 29,391 |

### 15.5 Changes the lead made after the fix pass

Each was made in `c08f60d`, behind a test that failed first.

1. A comparison test first read the repository history and wrote files to the system temporary folder. The pinned
   text test of section 15.3 replaced it. It reads committed pins and touches neither.
2. The second chart line got ring points, so that no two lines differ by ink alone.
3. The density ladder names its rungs by number, "24" to "120", under the head "Fleet size, cars", and a chart
   draws every label when they all fit. The table and the summary keep the longer rung labels.
4. The declared change of a directive now reads "every vehicle request moved into the event", which is what the
   model removes. The words are part of the frozen test, so the labels, the digests and the interval ends of the
   two pinned directive setups moved, and no mean: `scale-spec:42aa34d4` became `scale-spec:16d331de`, and
   `scale-spec:6905c5e1` became `scale-spec:2f4598cb`. Section 5.8 gives both intervals. The labels of the three
   default presses did not move.

---

## 16. Deployment

On 2026-09-27, on the owner's instruction, commit `c08f60d` was uploaded to the Pages project `fleetlab` by Direct
Upload with Wrangler 4.135.0 and became its Production deployment. The release record,
`docs/FLEETLAB_SCALE_LAB_RELEASE_2026-09-27.md`, holds the full account. Source for this section: the release
record. The package size and the inventory digest were also measured for these notes, section 13.5.

| Item | Value |
|---|---|
| Stable address | https://fleetlab.pages.dev/ |
| Immutable address | https://19e17ac6.fleetlab.pages.dev/ |
| Deployment | `19e17ac6-d617-4789-9260-ca259c53e076`, Production |
| Deployed source | `c08f60d8830df877fac2c7321bb47d75a5ae56ad` |
| Pages branch label | `feat/fleetlab-playground` |
| Previous Production, the rollback target | `dd4bfa44-7226-4502-9d66-01bb1790f2b6`, source `b99ab04` |
| Hosted package | 99 files with `_headers`, 3,349,602 bytes. Inventory SHA-256 `5c071dc69e353f6118ab43078c12d2470c9d709cf2ac7c501fe4fb807c669da3` |
| Public readback | 98 of 98 public files match the local package by SHA-256 and size, on both addresses |
| Response headers | Content security policy with `connect-src 'none'` and `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, same-origin opener policy, `Cache-Control: public, max-age=600` |
| Hosted smoke | All three labs pressed, labels `scale-spec:b4c7f5da`, `scale-spec:1aa8c833` and `scale-spec:443de567`. Fleet day seed 42 read 95 completed, 176 unserved, 4 waiting and 9 in progress of 284 requests. A teaching-frame lesson opened by its link. No console error |

The deployment published two waves at once. The teaching frames of the previous wave were built on `c79eccf` and
recorded as local only until this deployment. The Scale lab of these notes followed on top of them.

Push state. Nothing was pushed. Branch `claude/fleetlab-scale-lab` exists only on the local machine. The remote
branch `feat/fleetlab-playground` stands at `790573e`, an ancestor of `c08f60d`, so a push of `c08f60d` to it would
be a fast-forward. Nobody has authorized that push. Until it happens, a reader who follows the site to the public
repository will not find the deployed source there.

These notes and the other documents of this wave are committed after the deployment. They change no file of the
site, which is built only from `src`, `styles.css`, `index.html`, `media` and the tools under `playground/fleetlab`,
so committing them changes nothing the site is built from. A commit that changes a site file after `c08f60d` is not
deployed until the owner deploys it. When these notes were finished, one such commit stood on the branch:
`1aeaace`, which resets the Fleet day heading when a launch lesson opens. It touches `src/ui/studio.js` and its
test, and no file of the Scale lab. The hosted site is `c08f60d` and does not include it. Two full serial runs with
the performance flag at `1aeaace` each read 1,969 tests, 1,967 pass, 1 existing todo and 1 timing failure that
passed its one isolated rerun: the response reserve timing test at 9.34 ms against 8 ms on a loaded machine, then a
four-area runtime timing test at 11.34 ms against 8 ms on an otherwise idle machine. A full run at `1aeaace` with
zero failures is not recorded. These notes and the other records are committed in one documents commit on top of
`1aeaace`, so the site inputs of that commit equal those of `1aeaace`.

---

## Recommendation

Read each lab as a demonstration of one mechanism under declared assumptions. Read the default press as set by
the inputs, and look for the finding in the place where a reading moves: the depot load column and the siting
comparisons, the table "Lead-time mismatch", and the table "Landing in time". Treat the pins and the four test
files as the record a reader can run. Treat every figure marked "measured during design" as a record that a
reader cannot rerun from the repository. Keep every decision named in these notes as assumed at the lead's
recommendation, not ratified, until the owner rules. Do not set a number of one lab beside a number of another,
and do not read any number as a statement about any fleet. The deployed page is commit `c08f60d`, and these notes
describe it. Keep the deployment live, and decide the push separately, because the deployed source is not yet in
the public repository.

## Top risks + mitigations

| Risk | Mitigation |
|---|---|
| A lab is read as a statement about a real operator, place or past event | Two labs are counts in a fictional market. The density ladder says which input is real and that no fleet, depot or service in those places is described. Sections 3.11, 4.10 and 5.10 list what each lab must never be read as claiming |
| A verdict that follows from a sizing rule is read as a finding | Every press prints "Set by the inputs, not found by the run" under the verdict. Section 2 says why each default press is a demonstration |
| The 95 percent label overstates coverage at 10 to 12 seeds | The declared test calls the label nominal before any run. Section 8.1 gives the measured coverage. No pin rests on an interval end near a margin |
| An exact zero of a null control is read as a false alarm rate, or as proof that the model is right | Sections 8.2 and 8.3 |
| Thresholds chosen with sight of outcomes are read as set before the design | Section 9 names each one. The seed records of section 6 call no shipped seed set held out |
| The hand check of the density ladder is read as evidence for a law | Section 9.3. Its caption on the page says what it covers |
| A pin moves with a change of Node version or of a Fleet day default | The first test of the density ladder compares its typed constants with the engine defaults and fails by name. The version is recorded. A moved pin is reported, never rewritten without a reason |
| A timing test fails in a full run, as one did in each of two runs at `1aeaace`, once on a loaded machine and once on an otherwise idle one | Flagged tests run serially on an idle machine. A failure is run again alone before it is believed, and both failures at `1aeaace` passed that rerun |
| Phone timing is unmeasured, and no painted frame was seen | Section 14.3 gives estimates only. A chart after every rung, a yield after every engine run and Cancel are in place. A visible look and a phone acceptance are the first and second actions below |
| The deployed source is not in the public repository | Section 16 says so. The push is the owner's action, and a push of `c08f60d` to the remote branch would be a fast-forward |
| A deployed page reads wrong | The rollback target of section 16 is recorded. Rollback is an owner action in the Pages dashboard and rewrites no history |
| A later fix changes a text these notes quote | Section 15 names what the review moved. A pin that moves is reported, and these notes are brought in line with the new commit before it is deployed |
| A public value goes stale | Section 12.3 gives publisher and date. Both sources were opened again on 2026-09-27 |
| A decision is read as ratified | Every mention says assumed at the lead's recommendation, not ratified |

## Next 3 actions

1. The owner opens https://fleetlab.pages.dev/#/scale-lab in a visible browser at desktop and phone size, presses
   Run on each lab, and rolls back to `dd4bfa44-7226-4502-9d66-01bb1790f2b6` if anything reads wrong. The owner
   then says whether to push `claude/fleetlab-scale-lab`.
2. The owner rules on the decisions these notes name: the bytes past the target, the reading of the keyed-draw
   rule, the idle allowance of 13 weeks with the default of 48 weeks, the road table row and the credit line with
   their licence, and the three declined options. Until then each stays assumed at the lead's recommendation, not
   ratified.
3. Measure each lab at 375 by 812 px with 4 and 6 times throttling, and at 1440 by 900 px with no throttle, in a
   visible pane: press to painted result, first chart and longest task. Record the numbers in place of the
   estimates of section 14.3. Before any declined comparison ships, run its own sweep with every threshold declared
   first and with pins kept away from the lumpy setups of section 10.2.
