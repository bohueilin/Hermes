# FleetLab R3 implementation and review decisions

Date: October 14, 2026. Scope: synthetic educational website. This handoff supersedes the R1 handoff only for the current lesson/release; previous evidence remains historical.

**Live and verified:** [R3 dispatch lesson](https://fleetlab.pages.dev/network-flows/dispatch/). Source `7c80f9e0ead07a7183b178b3e69c3237c049af68` is pushed to `bohueilin/Hermes` on `codex/fleetlab-city-sf`.

- Production `769ad332-b726-496a-bb4e-201ec44c8518`: [immutable release](https://769ad332.fleetlab.pages.dev).
- Preview `62ef3431-4c36-4e5f-bd31-b2635987b5f9`: [verified preview](https://62ef3431.fleetlab.pages.dev).
- Preview and stable production each matched **10,130/10,130 served files** and **65/65 header checks**. Production immutable smoke matched **94/94**; prior R1 immutable production matched **82/82**.
- Readback completed `2026-10-15T03:07:44.855710+00:00` (October 14 in America/Los_Angeles).
- Prior immutable release [186cb2a5](https://186cb2a5.fleetlab.pages.dev) remains reachable.
- SF qualification remains **HOLD**; authenticity **NOT_AUTHENTICATED**; operational deployment permission **NONE**.


## What visitors can learn

**Which car takes the next request?** compares greedy assignment and exact joint matching of current requests. It demonstrates opportunity cost, a locally optimal decision's limits, and the distinction between a pending choice and accepted evidence.

The hosted route is `/network-flows/dispatch/`. Entry points are the existing learning catalog and the onward link from rebalancing. Existing overview animation, Fleet day, Street lab, City Explorer, delivery lessons, artwork, logo and analytics remain. No new top-level tab, city or cinematic asset was added.

Six chapters introduce the question, feasible pairings, greedy decisions, joint matching, later arrivals and manual assignment. Counted vehicle symbols, request cards, feasible edges, a selected vehicle's complete event trace and a disclosed ledger all consume checked records. Whole-observation cards stay fixed when the replay clock or policy view changes. Playback starts explicitly; fixture changes do not autoplay. Manual pairing is a pending batch until accepted; empty batches wait 30 seconds, and invalid batches retain the last accepted state with feedback beside the controls.

### Executed synthetic fixtures

| Workload | Greedy pickups | Joint pickups | Empty approach, greedy / joint | Served median, greedy / joint | Served p95, greedy / joint |
|---|---:|---:|---:|---:|---:|
| Default, 4 cars / 8 requests | 6/8 | 8/8 | 4 / 3 km | 90 / 30 s | 90 / 90 s |
| Later arrivals, 2 cars / 4 requests | 3/4 | 2/4 | 1 / 1 km | 30 / 60 s | 90 / 90 s |
| Neutral disclosure, 4 cars / 4 requests | 4/4 | 4/4 | 0 / 0 km | 30 / 30 s | 30 / 30 s |

All picked-up trips complete within the 1,200-second observation in these fixtures. The engine separately preserves unfinished trips for supported inputs that extend beyond the horizon. These are executed model results, not operator data or general performance estimates.

## Finding-by-finding decisions

| Feedback | Decision and implemented evidence |
|---|---|
| R1 policies vary in information and reserve rules | Agree. Explain the complete policy comparison rather than attributing the result to forecasting alone. R1 numerical engine and pinned records unchanged. |
| R1 Zone B comparison uses different served populations | Correct the review: both policies serve the same 38 Zone B requests. Percentiles alone still do not establish individual regression. Show matched request `r-04-B-05`, whose accepted-record wait rises from 60 to 258 seconds. |
| Separate manual and completed boundary states | Agree. `PRE_DISPATCH`, `POST_BOUNDARY`, and `OBSERVATION_END` are explicit and digest-bound. Deadline-boundary pending/expired distinctions are tested. |
| Close zero-duration events before dispatch | Agree. Deterministic stage/vehicle ordering closes zero passenger trips before dispatch. Horizon completions count; horizon dispatch is forbidden. |
| Policy names and redundant objective | Agree. Greedy assignment versus Joint matching: current requests. Objective: maximum current assignments, minimum approach meters, canonical pair-list tie. No future-demand oracle. |
| Favorable default and adverse counterexample | Agree. Execute both cases and disclose the tie case. Default does not get a fabricated mixed-result caption. |
| Nonanticipation | Agree. Future-input changes preserve earlier event/decision prefixes, while full-workload digests change. |
| Package feasibility | Agree. All existing limits retained. Identical R1/R3 packaging checks share a helper while ownership, full source inventories and independent scientific verifiers remain distinct. Offline bytes remain identical. |
| R2 timing, zero allocations, release and full manual schedule | Amended proposal only: process off-grid events without extra allocation decisions; zero means unplugged; target completion differs from physical release; manual plans start at zero. Analytical energy upper bound/witness requirements are documented, not presented as executed results. |
| R7 reservation, cursor, partial chunks and bounds | Amended proposal only: cloud reservation precedes peer reservation; full cursor lifecycle; whole-chunk limitation; bounded sparse trace; explicit unseeded partition case. Added peer resources are not represented as equal-capacity scheduling gains. |
| Readable visitor path | One question, two policies, selected vehicle, six chapters and disclosed technical evidence. No navigation expansion or invented cinematic output. |

## Evidence and acceptance architecture

Contract `fleetlab.dispatch/1.1.0`: 1–4 vehicles, 0–8 requests, integer coordinates in a 4-km square, 30-second times, horizon at most 1,200 seconds. Travel is Manhattan, x then y, at one minute/km; pickup service lasts 30 seconds. Unsupported off-grid inputs are rejected rather than approximated.

The producer advances exact 500-meter steps. The independent checker reconstructs analytic job milestones, enumerates matching choices by vehicle rather than by request, and recalculates events, snapshot coverage, distances, populations and metrics. Shared helpers are input validation, canonical serialization and SHA-256 only. Worker results are independently checked again at session acceptance. Job ID, fixture input, policy, endpoint and complete manual action tape must match; foreign and stale responses cannot replace accepted results.

Records are limited to 256 KiB, 256 events, 41 ledger rows, 40 decisions and 40 pre-decision rows. JSON-value validation rejects nonfinite numbers, undefined/unsupported values, sparse/extended arrays and excessive nesting before canonical comparison. Whole-record identity includes complete workload, phase, endpoint and feasible-edge sets. Internal consistency is not independent authenticity. Operational deployment permission remains NONE.

## Validation and review

Release measurements and final command counts are recorded below.

Focused tests include analytical default/counterexample/neutral fixtures, zero-length trip reuse, exact deadlines, endpoint clipping, full conservation, empty workloads, nonanticipation, 160 deterministic varied workloads across both policies, rehashed record tampering, foreign workloads, malformed JSON values, stale responses, invalid/duplicate manual batches, reset, fixture acceptance, route source restoration and package inventory tampering.

A fresh-context AI code review found a canonical-JSON alias bug: `NaN` and infinity could compare equal to null. A failing regression reproduced it; bounded JSON validation now rejects it. The review also identified neutral-fixture guidance that wrongly claimed unequal rider options; a failing UI regression preceded its correction. No deferred review finding remains.

Browser checks cover desktop, 390px and 320px viewports, counted vehicles, default/counterexample/neutral results, explicit play/pause, manual invalid/valid batches, empty wait/reset, local error feedback and zero horizontal overflow. A narrow dropdown issue was reproduced and fixed. These are browser viewport checks, not physical Pixel qualification or independent human-comprehension review.

Negative validation evidence is retained privately: initial package overage, two legacy fixture inventory assumptions, wrong shared editable Python import, two Python formatting violations, nonfinite evidence acceptance, neutral narration and narrow viewport overflow. Each is distinguished from the final passing results.

## Rulings and limitations

- Current user build/deploy authorization supersedes historic Phase 6 remote restrictions for this educational website only. It grants no physical-system authority.
- Use the explicitly amended 30-second/integer-coordinate domain; reject unsupported inputs. This prevents silently approximate model behavior.
- Preserve checked PRE snapshots and feasible edges rather than reconstructing timing or matching logic in the UI; this adds bounded record data.
- Correct R1's population inference using matched records; accepting the review literally would misstate the evidence.
- Share identical packaging byte/provenance checks to meet the unchanged cap; do not merge the independent scientific engines/checkers or move source into uncounted ownership.
- Treat false neutral teaching copy as important despite the reviewer's minor grade; general guidance remains accurate in all three examples.
- Parent browser/release checks cover the reviewer's untested UI/publication scope. R2/R7 outcomes, physical devices, independent human review and real-world performance remain unestablished.

The original-source envelope is nearly full. Adding R2/R7 requires an explicit packaging design and measured budget decision first; this release makes no new budget request. Presentation choice: wait and distance comparisons use paired numeric cards; the pickup comparison also has meter bars. No model inputs were invented beyond the authorized contract and accepted analytical amendments. No R2/R7 runtime or new-city work was started.

## Recommendation

Use R3 to explain opportunity cost and the limits of current-batch optimization. Review the amended R2/R7 contracts and a sustainable source-package plan before their implementation.

## Top risks + mitigations

- A local optimum mistaken for fleet-wide superiority: retain the public counterexample, neutral case and information boundary.
- Plausible visuals mistaken for accepted evidence: bind UI to checked records and explicit phases; pending edits never change accepted outcomes.
- Source growth eroding reproducibility: enforce existing counters and plan modular packaging before another lesson.
- Simulation mistaken for SF readiness: SF qualification remains HOLD; map/source, physical-device and human-comprehension reviews stay separate.

## Next 3 actions

1. Ask an independent visitor to explain r-002's assignment, why a car waits, and why the counterexample reverses the comparison.
2. Review R2's amended timing/release contract and analytical charging-bound witnesses.
3. Approve a measured packaging plan before implementing R2, then separately freeze R7; keep all SF qualification gates visible.

## Final source and package evidence

Source `7c80f9e0ead07a7183b178b3e69c3237c049af68`, branch `codex/fleetlab-city-sf`, repository `bohueilin/Hermes`. Source and fixes were pushed successfully. The clean release worktree reproduced and verified 10,131 staged files.

| Counter | Bytes | Ceiling | Remaining |
|---|---:|---:|---:|
| Captured original source + tools | 3,145,617 | 3,145,728 | 111 |
| Integrated emitted text | 3,081,918 | 3,145,728 | 63,810 |
| Package metadata | 36,964 | 40,960 | 3,996 |
| R3 complete integrated route closure | 98,827 | 524,288 | 425,461 |
| Offline edition | 2,563,278 | 2,571,440 | 8,162 |
| Source offer compressed | 969,108 | 4,194,304 | 3,225,196 |
| Source offer extracted | 3,529,719 | 4,194,304 | 664,585 |

Original teaching-source growth versus R1: **51,760 B** (the 44 KiB working target was exceeded; the unchanged 3 MiB hard limit passes). Separately, test-tree net growth is **19,571 B** and the complete implementation/fix commit range grows tracked repository files by **91,660 B** across 35 paths, including tests and contract/plan documents. Subsequent publication receipts and handoff-only edits are outside that implementation range. Existing ownership counters remain unchanged in meaning.

Offline SHA-256: `532986f1a67923735d9692ca106337697e7e50885d254ca23e6597ee6a524f8a`, identical to R1. No new media bytes. R3 route includes branding and its existing single Google tag; analytics property receipt is not observed.

Final automated results:

- Teaching Node: **2,405 passed, 8 skipped, 1 todo, 0 failed**; 32 focused dispatch tests.
- City Node: **94 passed**; City Python: **344 passed**.
- Hermes Python: **1,661 passed, 56 skipped** with this checkout explicitly on `PYTHONPATH`. The first run exposed a shared environment editable import of another worktree; no product failure was concealed.
- Ruff and diff checks pass. Doctor: **17 PASS, 1 WARN** for the intentional dirty worktree/owner files, **1 optional NOT_AVAILABLE**.
- Offline/site `check-dist`, source-bound package reproduction, exact source restore and upload guard pass.

The largest executed public fixture record is 113,781 bytes (default joint), below the 262,144-byte limit. All six automatic fixture/policy records were independently reconstructed, and their input/record digests are retained in private `accepted-fixtures.json`.

## Review packet and reproducibility

- [R3 approved contract](FLEETLAB_R3_DISPATCH_MODEL_CONTRACT_2026-10-14.md): frozen model, phases, domain and package limits.
- [R2 charging proposal](FLEETLAB_R2_CHARGING_MODEL_CONTRACT_2026-10-14.md): amended, awaiting its own implementation decision.
- [R7 sharing proposal](FLEETLAB_R7_OTA_SHARING_MODEL_CONTRACT_2026-10-14.md): amended, awaiting its own implementation decision.
- [Implementation plan](superpowers/plans/2026-10-14-r3-dispatch.md) and [current publication receipt](releases/fleetlab-current.json).

Private validation directory: `build/fleetlab-city/validation/r3-build-20261014/`. It retains commands, complete test logs, negative cases, reviewer findings, browser observations, accepted fixture digests, growth accounting, build proof and network readbacks. Generated evidence is intentionally not committed.

Representative verification commands:

```sh
node --test playground/fleetlab/test/*.test.mjs
node --test apps/fleetlab-city/test/*.test.mjs
build/fleetlab-city/venv/bin/python -m unittest discover -s apps/fleetlab-city/tests
PYTHONPATH="$PWD/src" conda run -n hermes-dev python -m pytest -q
conda run -n hermes-dev python -m ruff check .
PYTHONPATH="$PWD/src" conda run -n hermes-dev python -m hermes doctor
git diff --check
```

The private `build-release.sh` records the exact source-bound pack, offline check, teaching source-offer generation, hosted-brand transformation, additive integration, package proof and upload guard. Preview and production use the same staged bytes; the committed receipt binds readback evidence and the source commit.
