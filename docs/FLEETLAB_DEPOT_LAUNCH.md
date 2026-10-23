# Fleet day: configuration-driven launch rehearsal (M4)

This is a synthetic capacity lesson inside the existing static Playground. It adds a
versioned configuration and setup-action contract to the Bay lifecycle. It is not a new
engine, Python evidence backend, operational launch approval or a company expansion model.
All results are `NOT_EVIDENCE`, simulation-only, with deployment permission `NONE`.

## Run locally

From the repository root, with Node.js 22+:

```bash
node playground/fleetlab/tools/pack.mjs --site dist/site
node playground/fleetlab/tools/check-dist.mjs --site dist/site
node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html
python3 -m http.server 8766 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8766/site/`. Choose **Fleet day → Launch rehearsal**, or
**Learning catalog → Rehearse commissioning in Region B**. The panel owns its submitted
configuration independently of the regular Fleet day controls below it.

1. Choose Peninsula or fictional Region B. Review each site's resources, task owners and dependencies.
2. Keep fleet 24, demand 45/hour and seed 42. Set commissioning delay to 120 minutes.
3. Validate setup. Pending, owned commissioning is a visible warning and can be rehearsed;
   missing owners or invalid structure block execution.
4. Rehearse. Read service, every request disposition, queue versus active task-minutes,
   unfinished visits/tasks, terminal energy and infrastructure checks together.
5. Inspect a recorded shift minute in each arm. Unreserved is distinct from commissioned,
   healthy and planner eligible. Download the exact submitted configuration and records.
6. Change an input: the prior result and download disappear immediately. Revalidate and rerun.

For an exact console reproduction without opening the UI:

```bash
node --input-type=module <<'JS'
import {createLaunchConfig, compareCommissioning} from './playground/fleetlab/src/model/launch-rehearsal.js';
const result = compareCommissioning(createLaunchConfig('region_b'), 120);
console.log(JSON.stringify({spec:result.spec, validity:result.validity,
  baseline:result.baseline.launch.metrics, candidate:result.candidate.launch.metrics,
  deltas:result.comparison.deltas}, null, 2));
JS
```

Observed seed-42 Region B, four-hour window, minute-zero versus minute-120 commissioning:

| Measurement | Immediate | Delayed |
|---|---:|---:|
| All requests | 179 | 179 |
| Pickup within 10 minutes | 24 | 26 |
| Late pickup | 11 | 3 |
| Missed pickup | 139 | 145 |
| Pickup outcome still pending | 5 | 5 |
| Completed trips | 34 | 29 |
| Unfinished depot visits | 21 | 24 |
| Unfinished required tasks | 42 | 49 |
| All-visit queue task-minutes | 3,512 | 4,158 |
| All-visit active task-minutes | 1,333 | 793 |
| Terminal fleet energy, kWh | 1316.47584833507 | 1034.6920503338765 |

This is a mixed, descriptive result: the on-time pickup count increases while completions,
missed pickups and unfinished work worsen. No winner or confidence claim follows from one
seed. The useful next experiment isolates another constraint while keeping both arms'
non-treatment inputs fixed. Peninsula uses the same workflow and engine; its geography
and demand population are different, so its outcomes are not pooled with Region B.

## Version and population contract

| Surface | Explicit version |
|---|---|
| Launch extension/result | `depot-launch-1.0.0` |
| Region configuration | `region-config-1.0.0` |
| Depot configuration | `depot-config-1.0.0` |
| Mock commissioning action | `mock-commissioning-1.0.0` |
| Launch measurements | `depot-launch-metrics-1.0.0` |

`createLaunchConfig`, `validateLaunchConfig`, `compareCommissioning` and
`compareLaunchRuns` are typed-by-contract JavaScript exports with runtime validation and
JSDoc. No TypeScript/toolchain dependency was introduced. The composite model version
includes the existing readiness, charging and resource versions. When launch is absent,
existing Bay results and historical fixtures retain their semantics.

A region has stable identity, 2–18 bounded places, geometry provenance, a synthetic date
and timezone label. Peninsula uses existing frozen Bay anchors/routes. Region B uses an
explicit fictional kilometer plane and straight-line distances, with no OSM provenance.
One to six depots retain distinct identities, anchors, per-site power/worker/bay capacity,
owned acyclic setup tasks, compatible vehicle profiles and at most 72 named ports total.
At most 144 mock actions carry version, identity, sequence, effective minute, owner,
depot/resource/task references and the `commission` action.

Calendar opening/closing values are local minutes after midnight, opening inclusive and
closing exclusive. Elapsed commissioning times start at shift minute zero. The date and
timezone are labels; no conversion, DST or holiday calendar is modeled. Closing blocks new
work acquisition and charging power; active non-charging work finishes nonpreemptively.

Initial capacity precedes minute-zero actions. Terminal capacity includes actions accepted
through the terminal observation, which delivers no additional interval energy. Installed,
commissioned, healthy, unreserved, profile-compatible and calendar-open are distinct conditions.
Physical truth constrains execution even when planner knowledge is stale. Legacy aggregate
planned/uncommissioned/outage counts must remain zero in launch: explicit ports are authoritative.

Pickup means arrival before boarding/dwell. Every request created before the observation
end remains in the denominator. Recorded pickup times partition within-target and late;
unpicked requests are missed if already unserved or their target has elapsed, otherwise
pending. Completion is a separate event. Every unfinished visit and required task remains
counted, and queue/active totals include unfinished work. Zero-request fractions are unavailable
and cannot produce a comparable result. Setup counts are model measurements; operator manual
touches and first-pass validation remain unavailable pending a real usability study.

The paired adapter accepts only a uniform nonnegative commissioning shift. The UI's baseline
schedule is minute zero. It checks exact producers/versions/rules, fixed non-treatment config,
identical external requests, finite metrics and population/energy consistency. It replays only
setup transitions to verify action times and boundary capacity, without rerunning the fleet.
The M2/M3 adapter rejects launch configs. No regional/Python instrument is silently reused.

## Deliberate controls and checks

- Delay zero: identical runs and all deltas zero (both templates).
- Delay beyond the horizon: installed ports remain unavailable throughout service.
- Clear a commissioning owner: `TASK_OWNER` blocks setup.
- Uncheck a port's installation: `RESOURCE_NOT_INSTALLED` rejects its mock action;
  other valid actions may proceed, and the simulator state can remain valid.
- Uncheck health: commissioning does not repair the port and it cannot deliver energy.
- Dependency cycle, premature completed task or unsupported config: named structural checks fail.
- Duplicate/reordered/malformed actions: named action rejection; no extra capacity.
- Unsupported producer/version, null nested population, changed demand or action timeline:
  recorded-run comparison fails closed.

```bash
node --test playground/fleetlab/test/launch-rehearsal.test.mjs playground/fleetlab/test/launch-ui.test.mjs
FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 playground/fleetlab/test/*.test.mjs
FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 \
  python -m pytest -q tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py
python -m ruff check .
git diff --check
```

The existing source-of-truth file records actual release checks and publication state.
Direct `file://` browser acceptance of the offline HTML is blocked by browser policy;
its build, offline package policy and worker parity checks are still required.

## Learning and limits

The catalog now has 56 entries: 18 Fleet day lessons, six Street lab cases and 32 regional
examples. Each names its question, changed assumptions, observations, lesson and limits.
M1–M4 add a decision guide and measured result interpretation; selecting the deadline lesson
also selects the deadline comparison. Recorded model recommendations stay separate from
real-world deployment authority. Fleet day, Street lab, regional experiments and Python
Hermes evidence remain four distinct systems.

Serial required work, one cleaning skill, FIFO charging (including head-of-line compatibility
blocking), nearest-depot selection, constant acceptance caps, synthetic demand and minute
resolution limit interpretation. No optimal scheduling, charge taper, tariffs, worker shifts,
real status feed, physical commissioning, live airport access, physical driving or calibrated
regional expansion claim is implemented.
