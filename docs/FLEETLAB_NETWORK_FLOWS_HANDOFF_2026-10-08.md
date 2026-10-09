# FleetLab Network Flows — NF-01 implementation handoff

**Date:** October 8th, 2026 (America/Los_Angeles). **Owner:** Bo-Huei Lin.

**Status:** First Depot flow lab lesson implemented and validated locally. Public deployment has not occurred in this work. This document describes the educational website, not authority to deploy a vehicle, fleet policy or operational system.

## What was built

**Depot flow lab → Two vehicles, one uplink** is an additional destination at `#/depot-flow-lab?lesson=two-vehicles`. It explains why a vehicle at its battery target can still miss its departure deadline: data transfer and required post-upload work also determine readiness.

The page includes two vehicle input cards, editable link capacity/upload size/charger power, an optional guess, one action to run all three rules, simultaneous outcome tables, individual earliest-readiness bounds, static upload timelines, recorded wait holders, ordered task histories, exact-event stepping, independent Named checks and a JSON export. Nothing runs merely by opening the page. There are no random draws or seeds in this lesson.

The three upload rules are:

1. **First come, first served:** nonpreemptive, arrival then stable ID; A goes first in this fixture.
2. **Equal uplink share:** equal rates among eligible uploads, immediately redistributing released capacity; no deadline information.
3. **Departure deadline first:** nonpreemptive, earliest departure deadline, then arrival and ID.

All rules receive the same workload, capacities, charging behavior, local-step behavior and prospective horizon. The UI does not choose a winner. Counts lead; there are no population percentages or fleet-wide inference from two invented visits.

## ChatGPT feedback decisions

The supplied review did not inspect our repository or website. Its mathematical examples and design concerns were evaluated against the implementation; it is not independent human qualification.

| Feedback | Decision and implementation |
|---|---|
| Faulty allocation must terminate | Accepted. Negative, nonfinite, excess, unknown-recipient, no-progress and unsupported-precision allocations stop the arm with `policy_error`. Earlier intervals and diagnostics remain inspectable; comparison is withheld. Tests cover time zero and mid-service. |
| Explicit numerical contract | Accepted. Bounded integer seconds, useful bytes, bytes/s, joules and joules/s. Unsupported graph/precision, negative values and excessive values fail closed. Zero-work chains settle before deadline assessment. |
| Independent verifier | Accepted. A separate module reconstructs accepted service, checks capacities, declared policy behavior and dependencies, derives readiness and outcomes, and compares event inventory and totals. It imports the input contract, not the simulator or its settlement/metric helpers. |
| Distinct statuses | Accepted. Execution status, policy status, model validity and comparison eligibility are separate. A valid partial ledger never rescues a policy error or cancellation. Authenticity and authority remain separate. |
| Individual ideal lower bound | Accepted. The page computes the earliest possible readiness if a vehicle alone receives the full link and charger. Exceeding a deadline proves individual impossibility in this model. Fitting inside it does not establish joint feasibility. |
| Size/urgency confound | Accepted. B is both smaller and earlier due in all first-lesson settings. The page explicitly limits the conclusion; shortest-job and crossed size/urgency cases belong in NF-02. |
| Last finished versus capacity value | Accepted. Task histories distinguish the upload→local-step path from independent charging. Last completion does not establish the value of extra capacity; that requires a matched intervention. |
| Work classes, destination/acknowledgment, backlog | Accepted for the next protocol, not silently added to NF-01. Define departure-blocking, data-deadline and background work before a cohort study. |
| Fairness by visit/logical job | Accepted for the next protocol. Include invariance when one logical upload is split into multiple flows. NF-01 has one upload per visit. |
| Next focused milestone | Retained: NF-02 + NF-03 + one size-uncertainty stress, asking scheduling versus bandwidth versus charging. Not executed in this implementation. |
| Solver guidance | Retained as future formulation guidance. No solver installed; no solver-version or optimality claim adopted from the attachment. |
| Presentation | Accepted. Existing warm ivory/forest palette, readable text, static lanes, semantic tables, optional guess, progressive detail and a concise simulation boundary. The Overview concept film remains. |

## Model and tested arithmetic

The default fixture is `nf01-two-vehicles/2`: A uploads 75 decimal GB, needs 6 kWh and is due at minute 15; B uploads 7.5 GB, already meets its battery target and is due at minute 5. Both arrive at zero. Each has a two-minute post-upload step. Resources are one 1 Gbps effective payload link, one 60 kW charge port and independent local-step slots. Upload and charging overlap. The original 10 kWh fixture `/1` remains a regression case.

| Setting | Horizon | FIFO ready A/B | Equal share ready A/B | Deadline first ready A/B |
|---|---:|---:|---:|---:|
| Default | 15 min | 12 / 13 min | 13 / 4 min | 13 / 3 min |
| B upload 15 GB | 15 min | 12 / 14 min | 14 / 6 min | 14 / 4 min |
| Uplink 0.5 Gbps | 25 min | 22 / 24 min | 24 / 6 min | 24 / 4 min |
| Charger 20 kW | 20 min | 18 / 13 min | 18 / 4 min | 18 / 3 min |
| B upload 45 GB | 20 min | 12 / 18 min | 18 / 14 min | 18 / 8 min |

These are now executable results checked against literal expectations, not only proposal arithmetic. All 12 selectable combinations × 3 rules complete within their declared horizons; the maximum is 35 minutes. The 45 GB case deliberately exposes conflicting objectives: FIFO misses one deadline with 13 total late minutes; deadline priority misses two with 6 late minutes.

Completion exactly at the deadline is on time. Outcomes partition all started visits into on time, late, unfinished with deadline reached, and unfinished with deadline pending. A truncated FIFO run at minute 11 has A pending, B unfinished with deadline reached, and a six-minute lower bound on lateness. Unobserved completion times stay unavailable.

The convenience horizon rule applies only to this bounded healthy-resource lesson. A later infrastructure study must freeze one common horizon across treatments. A completed simulation can contain censored work; cancellation is a different execution status.

## Implementation and integration

- `playground/fleetlab/src/model/depot-flow-contract.js`: bounded input schema, fixture, rule identities, separate version fields and trust fields.
- `depot-flow.js`: event-driven allocations, fixed dependency settlement, deterministic charging and cancellable comparison steps.
- `depot-flow-verify.js`: independent read-only reconstruction, metrics and provenance.
- `playground/fleetlab/src/ui/depot-flow-lab.js`: page-local lifecycle and projection of verified results. Old successful results keep their old input labels when the controls change or a new attempt fails. Superseded callbacks cannot replace the active result. Input changes retain keyboard focus.
- Routes, Studio, Learning catalog, teaching frames and Overview receive additive entries. Fleet day links to the lesson from upload, software, charging and deadline-charging contexts. There are now 60 catalog lessons. The hosted navigation has nine destinations including City Explorer; Explore opens before the row crowds.
- `apps/fleetlab-city/tools/integrate-site.py --flow-update`: an explicit module allowlist applies the new teaching page while preserving all City data, source offers and rollback release. It checks copied bytes and rechecks the client distribution before finalizing the package.

No SF scientific arm, map qualification result, recorded experiment, vehicle profile, threshold, legacy simulator, solver, runtime backend, telemetry, account or new city was added. SF qualification remains **HOLD**.

### Narrow legacy contract adjustment

The old teaching package prohibited every literal from the Hermes evidence-label tuple. NF-01's reviewed export needs an explicit scope field. A single scope literal is therefore allowed only in the new model-contract module and its packed representation. Duplicates, other labels, legacy summaries and other modules remain prohibited. Negative tests cover this exception. See Architecture section 46. This does not make a teaching run a Hermes decision record.

### Review findings and resolutions

One fresh read-only code review identified two important defects; no critical finding was reported.

1. **Inherited allocation names:** the verifier originally used ordinary object lookup for recipient membership, allowing names such as `constructor` to pass. Fixed with own-property membership. Mutations for `constructor`, `toString` and JSON `__proto__` now produce invalid records and withhold comparison.
2. **Client mutation during packaging:** validated files could change while the City package was being prepared. The builder now compares every copied client payload with its validated digest and rechecks the full client inventory before final output. A mutation-during-prepare regression rejects the package and leaves no finalized output.

Additional implementation checks caught policy mislabeling and focus loss when input controls were recreated. The verifier now reconstructs declared allocation rules, and control nodes remain stable across setting changes.

## Validation and honest limits

| Gate | Observed result |
|---|---|
| Full teaching Node suite | 1,975 passed; 8 existing skips; 1 existing TODO; 0 failures |
| Focused NF-01 model/UI suite | 17 passed, covering fixtures, 36 runs, bounds, equality, zero work, censoring, invalid inputs, allocation failures, corruption, lifecycle, route reset and keyboard focus |
| City Python suite | 321 passed |
| City/hosted Node suite | 63 passed |
| Full Hermes suite using this checkout's source and the required boundary base | 1,662 passed; 55 skipped |
| Ruff and whitespace checks | Passed |
| Hosted and offline distribution checks | Passed: CSP, inventories, URLs, tokens, copy and labels |
| Offline size | 2,470,731 bytes, below the existing 2.5 MiB cap |
| Browser reflow | No document overflow in the new page at 320, 375, 412, 768, 1024, 1450 and 1600 px requested widths |
| Browser behavior | Default and 45 GB outcomes, old-result labeling, phone Explore, Overview film/entry and retained City Explorer navigation observed |
| Physical Pixel | `adb devices` returned no connected device during this turn; no fresh physical-device pass claimed |
| Human/assistive technology qualification | Not performed. Real screen-reader speech, actual 200% browser zoom, visitor comprehension and SF map/source observations remain separate |
| Hermes doctor | 16 PASS, 2 WARN (active environment identification and dirty working tree at check), 1 optional display NOT_AVAILABLE |

Negative runs are retained in local validation logs. Initial expected failures established the new feature tests. The broader suite initially exposed outdated seven-link/59-lesson assumptions and the old raw-label contract. One Python attempt used a small environment without pytest; another resolved a different editable checkout and failed import provenance. The final full run explicitly set this checkout's `PYTHONPATH` and passed. These were environment/test-contract failures, not SF scientific campaign attempts.

Representative commands (run from repository root with the configured Python 3.11 environment):

```sh
node --test playground/fleetlab/test/*.test.mjs
node --test apps/fleetlab-city/test/*.test.mjs
python -m unittest discover -s apps/fleetlab-city/tests -q
PYTHONPATH="$PWD/src" FLEET_PLAYGROUND_BASE=bca4ccd PYTHONDONTWRITEBYTECODE=1 python -m pytest -q
python -m ruff check .
PYTHONPATH="$PWD/src" python -m hermes doctor
git diff --check
node playground/fleetlab/tools/pack.mjs --out dist/network-flows-20261008/fleetlab-offline.html
node playground/fleetlab/tools/check-dist.mjs dist/network-flows-20261008/fleetlab-offline.html
node playground/fleetlab/tools/pack.mjs --site dist/network-flows-20261008/teaching-site
node playground/fleetlab/tools/check-dist.mjs --site dist/network-flows-20261008/teaching-site
```

## Research grounding and next study

The existing October 8 proposal remains the full 17-source research ledger and eight-experiment roadmap. The page cites two directly relevant sources without borrowing their performance results:

- [Chowdhury, Zhong and Stoica, Efficient Coflow Scheduling with Varys, SIGCOMM 2014](https://www.mosharaf.com/wp-content/uploads/varys-sigcomm14.pdf): motivates application-level completion objectives. Vehicle data/energy dependencies differ from the paper's coupled network model.
- [Lee et al., ACN-Sim, arXiv:2012.02809](https://arxiv.org/abs/2012.02809): a possible later charging-fidelity adapter. Its data and charging assumptions require evaluation before applying them to a depot question.

The next milestone is a proposed study, not an approved or executed scientific protocol:

1. Construct 12–24 visits crossing small/large known upload sizes with early/late deadlines. Include a known-size comparator, then one explicitly separate size-uncertainty stress. Freeze inputs and one horizon before running treatments.
2. Compare improved scheduling, one added bandwidth treatment and one added charging-capacity treatment on identical visits and resource assumptions. Keep missed mandatory departures and total lateness visible together. Explain masked benefits with paired counterfactuals.
3. Define departure-blocking work, independent data deadlines and background uploads; destination/acknowledgment; residual backlog; fairness entitlement per visit/logical job and flow-splitting invariance. Add compute/task-resource contention only for a named question.

No optimality claim should precede a formulation. A future solver reference must declare the model, tolerances, incumbent, bound and gap; an integer nonpreemptive reference is not automatically the optimum of a fluid-sharing model.

## Recommendation

Review the integrated NF-01 preview as one complete mechanism lesson. Retain SF qualification HOLD and use NF-02/03 to study capacity value after the next workload/protocol review.

## Top risks + mitigations

- **Overgeneralizing two vehicles:** explicit synthetic boundaries, size/urgency caveat and no automatic winner.
- **Mistaking internal consistency for authenticity or deployment authority:** distinct record fields and concise plain-language disclosure.
- **Regressing existing content at publication:** strict update allowlist, complete City preservation comparison, integrated package only, preview/production readback before declaring it live.
- **Unobserved human accessibility/usability:** keep those gates open; the browser and code checks are not participant observations.

## Next 3 actions

1. Inspect the integrated local preview and the comparison/counterexample on a phone or desktop.
2. Decide publication of this new Network Flows addition; if authorized, commit/push through the existing privacy guard, publish the integrated package, and verify all served bytes/headers. Never deploy the teaching-only folder over FleetLab.
3. Review the NF-02/03 workload and objective contract before launching that next study. No Austin or new city is included.
