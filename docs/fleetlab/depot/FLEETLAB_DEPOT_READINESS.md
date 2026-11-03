# Fleet day: depot readiness M1

This is a local, opt-in extension of the existing JavaScript Fleet day engine. It is
not a new simulator or a UI for Python Hermes. Browser results remain
`NOT_EVIDENCE`, simulation-only, with decision authority `NONE`. It does not
represent an operator's depots, staff, vehicles or deployment permission.

## Run locally

Use Node **22.22.0** (observed runtime; Node 22+ is the existing tool requirement).
From the M1 worktree root:

```bash
node --test playground/fleetlab/test/*.test.mjs
node playground/fleetlab/tools/pack.mjs --site dist/site
node playground/fleetlab/tools/check-dist.mjs --site dist/site
node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html
python3 -m http.server 8766 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8766/site/`. The single-file edition is
`http://127.0.0.1:8766/fleetlab-playground.html`, or open the HTML directly.
No install, account, service or remote map request is needed. Building does not publish.

For development, serve `playground/fleetlab` instead of `dist`. Python parity and
boundary checks use the existing `hermes-dev` Python 3.11 environment:

```bash
FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 \
  python -m pytest -q tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py
python -m ruff check .
git diff --check
```

`bca4ccd` remains the actual website branch ancestor. Do not replace the editable
Python installation or regenerate historical fixtures to run these checks.

## Reproduce the intervention demonstration

1. Open **Fleet day**, select **Staffing: an empty bay needs a worker**, then
   **Run fleet day**. The preset resets settings. It declares 16 vehicles, one
   fictional depot, Menlo Park/Palo Alto anchors, four hours starting 00:00,
   45 requests/hour, seed 42, three cleaning bays and one qualified cleaning worker.
   Each visit requires cleaning; base cleaning is 18 minutes with existing vehicle
   profile multipliers. Both initial and target SOC are 85%. All other exact inputs
   are inspectable under **Exact recorded values and submitted settings**.
2. Pause, use **Clean**, select a queued car, or seek through the replay. Inspect
   **Required work remaining**, **Blocked reason**, the worker/bay reservation, and
   **Depot queues & resources at this minute**. The map and tables project the same
   submitted run. Replay does not execute the scheduler.
3. Read **What prevented depot readiness?**: queue and active task-minutes include
   unfinished on-site visits. Completed-only means are labeled. Open the work-order
   ledger to see required/not-applicable, not-reached, queued, active and completed
   tasks. Missing times and empty means read **Not available**.
4. Select **Compare staffing and bays**. The worker arm changes only workers per
   depot from 1 to 2. A separate arm changes only cleaning bays from 3 to 4 against
   the original one-worker baseline. Demand is pregenerated once and reused. All
   request states, terminal energy, unfinished work and named checks remain visible.
   The exact JSON download preserves machine values, configurations, visits and
   comparisons. The displayed extra-bay delta comes from the run, not a preset label.
5. Change any input. Prior results are marked stale and the comparison is cleared;
   run again before comparing. Try zero workers, or one bay with eight workers, to
   distinguish the constraints. Under **Cleaning policy**, the deliberately broken
   defer/skip/cancel options demonstrate the checks; they are not recommended policies.

No percentage improvement, recommendation, confidence interval or winner is produced.
This one-seed example demonstrates a mechanism under synthetic assumptions. Its
maximum-wait guardrail can fail even when completed service increases.

## Version and compatibility contract

| Surface | Contract |
|---|---|
| Historical Bay | `fleetlab-bay-operations-1.0.0`; omit `readiness` entirely |
| Opt-in configuration | `readiness.version = depot-readiness-1.0.0` |
| Extended producer | `fleetlab-bay-operations-1.0.0+depot-readiness-1.0.0` |
| Added metrics | `depot-readiness-metrics-1.0.0` under `result.readiness.metrics` |
| Work requirement rule | `serial-every-visit-clean-charge-upload-scheduled-software-1` |
| Comparison | `fleetlab-depot-readiness-comparison`, `format_version: 1`, one replication |

The old default config, result shape, charging semantics and metrics are retained.
Original `operations.js`, Street lab, regional engines/instrument and Python evidence
are independent. Two historical Bay scenarios have whole-result hashes pinned from
published source `f85a28f`; no prior fixture or expectation was replaced.

The new configuration also requires integer `cleaning_workers` (0–120), scheduler
`fifo`, `defer_cleaning`, `skip_cleaning` or `cancel_cleaning`, and integer
`max_task_wait_min` (1–1440). Unknown versions/fields are rejected. Capacity
comparisons add one worker/bay; at the existing maximum the affected arm reports
unavailable while the independent valid arm still runs. No treatment is clipped.

The comparison checks producer, added metric version, requirement rule, simulator
validity, exact non-treatment configuration and the exogenous request tuples. The
short existing demand signature is descriptive, not an authenticity proof. There
is no cross-model comparison or inference through the regional statistical instrument.
That instrument's completed/missing populations and version contracts are not a
validated mapping for these new Bay measurements.

## State and resource contract

At visit creation, stable vehicle/visit/stage IDs identify four task records.
Cleaning, charge-to-target and upload are mandatory. Software is mandatory on the
existing visit-ordinal schedule and otherwise `not_applicable`. Optional task
execution/cancellation is not implemented. Initial cars retain the historical
assumption of service-ready status; mandatory work applies to created depot visits.

`not_reached → queued → active → completed` follows the existing serial order.
Travel to the depot is separately recorded; it does not consume a cleaning resource.
A cleaning start atomically assigns one free bay and one qualified worker at that
site, with stable lowest-ID selection. No partial reservation is held while queued.
A matching simulated completion record releases both. Release from the depot
requires the expected task inventory and completed mandatory tasks, with elapsed
work matching recorded active minutes. Charging still requires the historical SOC
target check before completion. Zero-needed-energy charging retains the old
minute-step semantics; M1 does not revise the allocator.

At the horizon no new task starts and no extra energy/work interval is integrated.
Queued and active work remains unfinished, active reservations remain owned in the
terminal snapshot, and not-reached work remains required. Attempted skip/cancel
proposals are rejected before mutation, counted once per task/action, and leave the
vehicle queued. M1 deliberately has no successful mandatory cancellation transition.

All exogenous requests are generated before execution. Work duration is determined
by stage configuration and vehicle profile; software by stable visit ordinal. M1
adds no random draws. Different throughput may legitimately produce different visit
counts and dispatch histories under the same required-work rule.

## Added metric definitions

Producer for every row is the extended Bay engine; version is
`depot-readiness-metrics-1.0.0`. Observations use elapsed integer minutes `[0,H]`,
interval accounting uses `[0,H)`, and request intake uses `[0,H)`. Counts are exact;
UI decimal displays round to at most two places, exact JSON remains available, and
checks print exact values and thresholds. No quantiles or replacement denominators
are introduced. No metric alone produces a recommendation.

| Metric key(s) | Unit; population and aggregation | Missing/empty; direction |
|---|---|---|
| `required_tasks` | tasks; sum of mandatory tasks in **all started visits**, including inbound | 0 for no tasks; descriptive work mix |
| `completed_tasks`, `queued_tasks`, `active_tasks`, `not_reached_tasks` | tasks; disjoint terminal states of required tasks; sum equals required_tasks | 0 for empty; descriptive inventory |
| `unfinished_tasks` | tasks; queued + active + not reached, including inbound | 0 for empty; lower only conditional on comparable work mix |
| `oldest_unfinished_task_age_min` | min; max(H − visit creation) over unfinished required tasks, including predecessor/inbound delay | null when none; lower conditional on cohort |
| `queue_observed_min` | task-min; sum of queued elapsed intervals over **all on-site visits**, including unfinished | 0 when none; descriptive load, not a completed-only mean |
| `active_observed_min` | task-min; sum of active elapsed intervals over all on-site visits | 0 when none; descriptive work, not inherently better/lower |
| `onsite_observed_min` | visit-min; sum(min(completion,H) − site arrival) for all arrived visits | 0 when none; exactly queue + active for serial model |
| `blocked_minutes` | task-min by exclusive category: worker, bay, both, policy, other resource; sum equals queue time | 0 per absent category; diagnostic, not causal proof |
| `completed_visit_mean_onsite_min` | min; arithmetic mean site arrival → ready over completed visits | null when no completed visits; lower only with unfinished cohort shown |
| `completed_visit_mean_queue_min` | min; arithmetic mean summed queue time over completed visits | null when no completed visits; same caution |
| `completed_visit_mean_active_min` | min; arithmetic mean active work over completed visits | null when no completed visits; descriptive work mix |
| `ready_by_deadline`, `deadline_visits` | visits; completed by assigned H / all visits started by H | counts 0/0 when empty; no ratio manufactured; higher fraction conditional on cohort |
| `unfinished_visits`, `inbound_visits` | visits; not completed / not yet arrived at H; inbound is a subset | 0 when none; lower conditional on cohort |
| `max_task_queue_min` | min; maximum observed queue duration of any required task, completed or unfinished | null when no task reached a queue; lower is better for declared waiting guardrail |

The readiness deadline is explicitly H for every started visit, not a user-selected
SLA and not a fixed cohort of unique vehicles. `deadline_visits` may differ between
arms because throughput changes visits. Existing service totals count all requests:
created = completed + unserved (assignment patience expired) + waiting + assigned/
boarding/in-progress. Existing rider mean is request → pickup for **completed trips**,
excluding boarding. Existing end-of-day completion fraction is not a pickup SLA and
includes late requests. Street lab uses different pickup boundaries and populations.

## Checks and negative controls

- `SIMULATION_INVARIANTS`: resource counts, unique cleaning ownership, battery/reserve,
  site power, energy balance, request and on-site time accounting. Actual violations
  mean `INVALID_SIMULATION`; comparisons refuse those results. Impossible lifecycle
  mutations throw before an accepted result is produced.
- `MANDATORY_RELEASE`: no completed visit without the full required completion records.
- `MANDATORY_WORK_POLICY`: rejected mandatory skip/cancel proposals fail this policy
  check without falsely declaring a simulator-state violation.
- `REQUIRED_WORK_MAX_WAIT`: maximum queued time must be `<= max_task_wait_min` (default
  60 minutes). A deferred/starved required task can fail while simulator state is valid.
  Runs with no task reaching a queue are `NOT_AVAILABLE`, with a null measurement. This is an illustrative guardrail, not
  a calibrated service standard, and no attractive service delta offsets failure.

Tests include empty bays with zero/one worker, scarce bays with extra workers,
nonbinding extra bays, replay/capture neutrality, conservation, unfinished horizon
work, zero demand, rejected cancellation/skip, deliberately deferred work, false
completion/missing-task rejection, incompatible comparison, exact legacy outputs,
UI staleness and unchanged energy constraints. Historical tests are preserved.

## Decision record and scope

The current user request authorizes implementation of M1 after a gap assessment.
That supersedes the root AGENTS.md's older Phase 6 branch/read-only/design-freeze
workflow for this distinct browser task. Phase 6/Python evidence constraints remain
unchanged. The downloaded revision 2 brief is a design reference; its embedded
copy/paste instructions did not grant separate publishing authority.

The starting active worktree was the clean Phase 9 metric-contract branch, which
has no Playground. Work is isolated on `codex/fleetlab-depot-readiness-m1` from
website source-lineage head `6b376fb`, leaving existing worktrees untouched.
`6b376fb` differs from published source `f85a28f` only in three documentation files.
Remote readback matched the published Bay engine, operations UI, studio UI, paired
instrument and stylesheet. These sampled matches do not authenticate a deployment
ID; `ccb82b11` remains the September 19 release record. This M1 build is local only.

Deferred: concurrent tasks, configurable optional-work policies, staff calendars,
optimized charging/redistribution/taper, stale feeds/outages, airport forecasts,
region bring-up, physics, production APIs, real vehicles, cloud/backend integration
and deployment. No operator usability study, real-world calibration or performance
claim is implied. Current validation and measured demo results belong in the
existing `HERMES_SOURCE_OF_TRUTH.md`.
