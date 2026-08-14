# Hermes Phase 6 Reviewer-Comprehension Design Iteration Handoff

This handoff records the completed Task 4 validation at the pre-documentation-commit checkpoint. It
is deliberately explicit about which evidence is observed, which manual gates remain open, and why
the documentation commit SHA cannot be reported until that commit exists.

## 1. Executive summary

- **Iteration:** Phase 6 reviewer comprehension, presentation-only over the existing evidence
  authority.
- **Current implementation verdict:** `GO` from the Task 3 automated adversarial audit; no P0/P1
  reproduced. A later browser DOM structural walkthrough found one first-mount Timeline
  presentation defect; it was fixed RED-first in `cbced6e`. A second P2 involving stale dynamic
  second-level heading (H2) permalinks after radio reruns was fixed in `0fe3459`; code/test and narrow browser DOM href
  closure are both `OBSERVED — PASS`.
- **Delivery verdict:** `CONDITIONAL GO` for reviewer comprehension: all automated, retained-
  artifact, immutability, repository, and **executed** structural DOM checks are observed and green.
  The required-unavailable rendered state lacks an approved fixture; pixel/manual visual,
  accessibility-audit, and human-comprehension evidence remains open.
- **Evidence authority:** unchanged. UI and CLI still consume the public verifier-owned review
  facade; no gate, verifier, threshold evaluator, comparison score, discovery authority, artifact
  writer, simulator, policy, approval, or deployment action was added.
- Automated correctness: `OBSERVED` — final Task 4 validation recorded 756 full tests, 756
  non-MetaDrive tests, and 506 focused Phase 6/workbench/review/CLI/artifact/documentation tests.
- Manual visual review: `NOT YET OBSERVED`.
- Accessibility audit: `NOT YET OBSERVED`.
- Human comprehension: `NOT YET OBSERVED`.
- No remote action occurred.

## 2. Starting branch and commit

- Branch created from: `feat/phase6-evidence-workbench`.
- Starting commit: `be57bb126d6339efe0d8184304620aab64a680a6` —
  `docs: finalize Phase 6 validation and handoff`.
- Reviewer-comprehension branch: `feat/phase6-reviewer-comprehension`.
- Starting tree had one user-owned untracked input:
  `Hermes_Phase6_Reviewer_Comprehension_Iteration_Master_Prompt.md`. It remains preserved,
  unmodified, and unstaged.

## 3. Ending branch and commit

- Ending branch: `feat/phase6-reviewer-comprehension`.
- Production/adversarial implementation HEAD before this documentation wave:
  `80439c5382cf5e0744cdcec7402633e4bcc81e1e`.
- Intermediate Browser-DOM Timeline parity fix:
  `cbced6e57670ae7aaf63f9ce875122ac7471e348`.
- Stable explicit H2-anchor fix/current pre-documentation HEAD:
  `0fe3459ac87b78a023bb477ebf1210b2a9d31792`.
- Intended final local documentation commit: `docs: record reviewer comprehension iteration`.
- Current validated code HEAD: `0fe3459ac87b78a023bb477ebf1210b2a9d31792` with the intended
  Task 4 documentation working tree.
- Documentation commit SHA: intentionally not embedded in this file because doing so would alter
  the commit it names. Report the content-derived SHA from post-commit `git log` in the delivery
  response/readback.
- Push, pull request, deployment, publication, and remote modification: none.

## 4. Independent-review findings addressed

The iteration implemented the ten reviewer-comprehension problem areas from the approved prompt:

| Finding | Disposition |
|---|---|
| Human comprehension unobserved | Added a 6–10 participant prospective protocol and fillable observation record; status remains `NOT YET OBSERVED` |
| Accessibility not manually validated | Added executable keyboard, screen-reader, focus/announcement, non-color/contrast, table, zoom/reflow, and inert-content checks; no conformance claim |
| Six peer screens fragmented reasoning | Replaced with primary `Review`, `Compare`, `Evidence limitations` and five ordered Review destinations |
| Trust frame cognitively flat | Added Tier 1 decision state and Tier 2 authority boundaries without merging any field |
| Exact selection error-prone | Improved blank manual entry, example, draft/submitted identity, explicit Verify, and recovery; no unsafe discovery |
| Summary too dense | Reordered Overview around artifact → gate → rationale → integrity/authority → unavailable required evidence → limitations → technical cue |
| Findings too dense | Added six deterministic groups and progressive detail while keeping failed required evidence visible |
| Unavailable evidence ambiguous | Added distinct required, optional, and not-applicable consequence copy; never missing-as-zero |
| Timeline lacked task defaults | Added four presentation-only presets and finding-to-first-supporting-event navigation |
| Mixed synthesis optional | Added mandatory ordered synthesis with mixed-trade-off/no-advancement language and no winner |

Task 3 attempted 15 adversarial attacks. It reproduced no P0/P1. CSS visual dominance, visible focus,
screen-reader behavior, contrast, 200% reflow, and human interpretation remain manual-only.

A subsequent browser DOM walkthrough reproduced one bounded presentation defect: on first Timeline
mount, the radio showed `Decision evidence` while the projected multiselect contained `All tracks`.
The RED test failed on that exact radio/projection mismatch. Commit `cbced6e` aligns first mount to
`All tracks`; the focused command passed 88 tests, an independent two-test check passed, and fresh
browser DOM inspection confirmed `All tracks` plus the exact 16-track multiselect. No gate,
envelope, count, track registry, or authority semantic changed.

The same walkthrough later found that Streamlit-generated dynamic H2 permalinks could become stale
after radio reruns. Commit `0fe3459` replaces that unstable behavior with explicit anchors for all
seven primary H2s: Select & Verify, Overview, Evidence, Timeline, Provenance, Compare, and Evidence
limitations. The targeted test failed first and passed after the fix; 83 focused tests and two
independent targeted tests passed, with Ruff and diff checks clean. The P2 is closed at the
code/test and DOM-structure boundaries. Fresh cross-section DOM observed Overview `#overview`,
Timeline `#timeline`, Compare `#compare`, and zero exception text.

## 5. Revised information architecture

```text
Hermes — Simulation Evidence Review
├── Review
│   ├── Select & Verify
│   ├── Overview
│   ├── Evidence
│   ├── Timeline
│   └── Provenance
├── Compare
└── Evidence limitations
```

The submitted locator remains visible across Review. The exact sequence is Select → Verify →
Overview → Evidence → Timeline → Provenance. Navigation changes presentation state only and cannot
alter the envelope, findings, counts, compatibility, or gate result.

## 6. Trust-strip hierarchy

```text
Tier 1 — Decision state
Gate verdict: PASS | CONDITIONAL | HOLD | INVALID_EVIDENCE
Evidence integrity: UNVERIFIED | INTERNALLY_CONSISTENT | INVALID_EVIDENCE

Tier 2 — Authority boundaries
Origin: NOT_AUTHENTICATED
Authorization: NOT_EVALUATED
Deployment permission: NONE
Scope: SIMULATION_ONLY
Authoritative status: NOT_DEFINED
```

These fields remain independent. The persistent sentence is:

> This is a simulation evidence decision, not an approval or deployment authorization.

A PASS is not labeled safe, trusted, authenticated, authoritative, approved, certified, road-ready,
deployable, or permission to control physical hardware.

## 7. Artifact-selection decision and rationale

No picker, directory list, or autocomplete was added. The public review facade accepts one known
lexical selection and has no descriptor-safe discovery API. UI-side filesystem enumeration would
bypass the no-follow capture boundary and add unreviewed discovery authority. It would also increase
selection volume and trigger the bounded-cache predecessor.

The implemented workflow therefore uses a blank root-relative text input, inert example, separate
draft/submitted values, selected-directory confirmation, explicit `Verify selected artifact`, and
recovery guidance. It never infers newest, latest, official, recommended, or authoritative status.
A future picker requires both a reviewed discovery contract and deterministic synchronized bounded
LRU first.

## 8. Findings grouping

Evidence uses this exact order:

1. `Failed required evidence`
2. `Required but unavailable`
3. `Soft failures and warnings`
4. `Passing required evidence`
5. `Optional evidence`
6. `Not applicable`

Collapsed rows expose label, status, requiredness, measured value/unit, short structured rule,
gate consequence, and first supporting event. Progressive detail retains finding/verifier identity,
exact canonical value, structured threshold, all sequences, sources, and audit text. The UI renders
core-provided semantics and does not evaluate thresholds. Failed required evidence cannot be hidden
by a detail-focus filter.

## 9. Timeline presets and event-jump behavior

The full 16-track contract remains available. Presentation presets are:

1. `Decision evidence`
2. `Action accountability`
3. `Fault behavior`
4. `All tracks`

An eligible finding exposes `Open first supporting event in Timeline`, which activates relevant
tracks and moves to the page containing the exact stored sequence. Missing support stays
unavailable; no event is invented. New Verify resets stale group, detail, drill-down, preset,
filter, page, and jump state. Task 3 byte-compared canonical envelopes, gate/findings/counts,
references, and ten source hashes across preset/filter/jump operations with no change.

The first Timeline mount now selects `All tracks` in both the radio and exact 16-track projection;
this parity was observed in browser DOM after `cbced6e`.

## 10. Comparison synthesis

Explicit blank baseline and candidate fields plus Compare are required. Each side is independently
verified. Compatible results render, in order:

1. `Gate outcome`
2. `Hard-failure change`
3. `What improved`
4. `What regressed`
5. `What was unchanged`
6. `What was not comparable`
7. `Evidence availability changes`
8. `Advancement interpretation`

The retained lead/cut-in synthesis states that time to collision (TTC) improved, route
completion/acceleration/jerk
regressed, the verdict did not improve, and the result is a mixed trade-off that does not establish
overall advancement. Intervention count stays descriptive. No winner, overall safety/composite
score, safer-candidate claim, recommendation, promotion, approval, or deployment conclusion exists.
Incompatibility returns before any delta, chart, or source-delta payload.

## 11. Accessibility improvements

Implemented structural support includes stable keyed controls, ordered navigation, textual/non-color
status, finding detail actions, synchronized Timeline tables, comparison tables alongside any dense
visual, typed gaps, and bounded inert artifact text with no raw HTML. Automated AppTest verified
control presence and transitions, not human operability or accessibility conformance.

The new manual package covers keyboard-only operation, screen-reader headings/control names/tables,
visible focus, focus order/restoration, validation and invalid-status announcements, non-color
status, measured contrast, table alternatives, 200% zoom/reflow, horizontal-scroll dependence, and
bounded inert strings. All manual outcomes remain `NOT YET OBSERVED`; no WCAG conformance is claimed.

Browser DOM retained-state walkthrough is separately `OBSERVED` for initial UNVERIFIED, PASS, HOLD,
INVALID quarantine/no stored-PASS leak, Timeline/action accountability, Provenance/limitations,
compatible mixed comparison, incompatible fail-closed comparison, and zero exception/leak text.
This is not a screenshot, CSS/pixel review, keyboard-focus result, screen-reader result, contrast
audit, reflow result, or human-comprehension observation.

Explicit stable anchors now exist for all seven primary H2s after `0fe3459`. Automated code/test
closure and the narrow browser DOM href recheck are `OBSERVED — PASS`: Overview `#overview`,
Timeline `#timeline`, Compare `#compare`, exception-text count 0. This does not alter any manual
visual or accessibility status.

## 12. Files changed

Reviewer-comprehension implementation commits changed:

```text
docs/PHASE6_UX_INFORMATION_ARCHITECTURE.md
docs/decision-log.md
src/hermes/workbench/app.py
tests/unit/test_workbench_projection.py
tests/integration/test_workbench_smoke.py
tests/unit/test_architecture_boundaries.py
```

This documentation wave creates/updates only the Task 4 allowlist:

```text
PHASE6_DESIGN_ITERATION_HANDOFF.md
docs/PHASE6_USABILITY_TEST_PLAN.md
docs/PHASE6_HUMAN_OBSERVATION_TEMPLATE.md
docs/PHASE6_VISUAL_REVIEW_CHECKLIST.md
PROJECT_BRIEF.md
README.md
BUILD_PLAN.md
CODEX_HANDOFF.md
PHASE6_ADVERSARIAL_REVIEW.md
docs/PHASE6_UX_INFORMATION_ARCHITECTURE.md
docs/PHASE6_DEMO_RUNBOOK.md
docs/decision-log.md
VALIDATION_MATRIX.md
tests/unit/test_reviewer_comprehension_docs.py
```

Source evidence, `third_party/metadrive`, review core, comparison core, gates, verifiers, runtime,
policies, adapters, and the user-owned master prompt are outside this wave.

## 13. Dependencies changed

None. The optional workbench dependency remains Streamlit `>=1.37,<2`; no cloud SDK, database,
telemetry, authentication, upload, signing, ML, or simulator dependency was added.

## 14. Commands executed

Task 1–3 recorded their exact commands in ignored execution reports. This documentation wave first
ran the RED contract:

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/unit/test_reviewer_comprehension_docs.py
# 8 failed: four required package documents did not exist
```

The concurrent browser-DOM fix recorded:

```text
RED: 1 failed — Decision evidence radio versus All tracks projection
GREEN: 1 passed
focused regression: 88 passed
independent targeted confirmation: 2 passed
Ruff and diff check: clean
fresh browser DOM: All tracks radio + exact 16-track multiselect parity
```

The stable-heading-anchor fix recorded:

```text
RED: 1 failed — stale dynamic H2 permalink after radio rerun
GREEN: 1 passed
focused regression: 83 passed
independent targeted confirmation: 2 passed
Ruff and diff check: clean
implementation: explicit anchors for all seven primary H2s
fresh browser DOM: Overview #overview; Timeline #timeline; Compare #compare; exception text 0
```

Final Task 4 validation then ran:

```bash
conda run -n hermes-dev python -m pip install -e ".[dev,workbench]"
conda run -n hermes-dev python -m pip install -e ".[dev]"
conda run -n hermes-dev python -m pytest -q
conda run -n hermes-dev python -m pytest -q -m "not metadrive"
conda run -n hermes-dev python -m pytest -q \
  tests/unit/test_review_models.py \
  tests/unit/test_review_capture.py \
  tests/unit/test_review_projection.py \
  tests/unit/test_review_facade.py \
  tests/unit/test_review_comparison.py \
  tests/unit/test_workbench_projection.py \
  tests/unit/test_workbench_launcher.py \
  tests/unit/test_architecture_boundaries.py \
  tests/integration/test_review_artifacts.py \
  tests/integration/test_workbench_smoke.py \
  tests/cli/test_review_cli.py \
  tests/unit/test_artifact_verification.py \
  tests/unit/test_reviewer_comprehension_docs.py
conda run -n hermes-dev python -m ruff check .
conda run -n hermes-dev python -m hermes doctor
git diff --check
git diff --cached --check
git diff --cached --stat
```

Both installs succeeded. The test, Ruff, doctor, diff, CLI, comparison, and hash results are recorded
below. Six `review-artifact` and three `review-compare` commands ran between two independent
100-file hash-map captures. No simulator or policy launched. Doctor performed only its documented
environment inspection, including an environment-only MetaDrive import.

## 15. Full test result

- Full suite: **756 passed**, exit 0 (`python -m pytest -q`).
- Focused matrix: **506 passed**, exit 0 (combined Phase 6/workbench/review/CLI/artifact/
  documentation selection).
- The document contract was TDD-driven: its initial RED was eight missing-package failures; the
  final contract selection passed eight tests without increasing the test count during finalization.

## 16. Non-MetaDrive test result

- Non-MetaDrive suite: **756 passed**, exit 0
  (`python -m pytest -q -m "not metadrive"`).
- No simulator or policy launched. MetaDrive was not launched; only doctor later imported it to
  inspect the installed environment.

## 17. Ruff result

- `python -m ruff check .`: `All checks passed!`, exit 0.
- `git diff --check` and `git diff --cached --check`: exit 0.
- The staged index was empty; cached stat/name checks emitted no staged change.

## 18. Doctor result

- `python -m hermes doctor`: **17 PASS, 1 WARN, 1 NOT_AVAILABLE, 0 FAIL**, exit 0.
- The WARN reported the intended 15-entry dirty documentation/input tree.
- Optional `DISPLAY` was `NOT_AVAILABLE`; this is not a pixel/manual visual or accessibility result.
- Doctor performed an environment-only MetaDrive import; it did not create an adapter, policy,
  engine, scenario, window, or simulation step.

## 19. Representative artifact results

Fresh JSON review commands produced:

| Selection | Gate / integrity | Exit | Events / findings / metrics / tracks | Bundle digest | Trace digest |
|---|---|---:|---|---|---|
| `handoff-phase5-demo` | `PASS` / `INTERNALLY_CONSISTENT` | 0 | 40 / 6 / 13 / 16 | `fd42b8399ba32853a587a63fee7aba9803c5918539b6053b1554937abcc13334` | `f515c16243d2b07c8a4b4ffd286edd5ff1c4ffa9486d3b28d034b40420ba234e` |
| `handoff-p1-conditional` | `CONDITIONAL` / `INTERNALLY_CONSISTENT` | 0 | 39 / 6 / 13 / 16 | `752ba4725930d62335c1469ceebee6f7517d24265f8c945f68e45d2e7cb41cb4` | `dfd8cc47423f8b93e70da1f5bcac00d21f363aec4a435da8ca9518b111704158` |
| `handoff-p1-collision` | `HOLD` / `INTERNALLY_CONSISTENT` | 0 | 13 / 6 / 13 / 16 | `723e814d0aea399dc2590dd0f1d5b09b20a03a28cadb49c062610894049ae27c` | `ecaa3b9222612044349b643c44406c2088cfb335b07f7bf4da56ac587bb76a24` |
| `phase1-tampered` | `INVALID_EVIDENCE` / `INVALID_EVIDENCE` | 30 | 0 / 0 / 0 / 0 | `831f22ed419e4b13ce5d0a1aa3bc1444b2ca523d60edb8d4c75eaa7491e1d61e` | `null` |
| `handoff-p2-metadrive` | `PASS` / `INTERNALLY_CONSISTENT` | 0 | 165 / 6 / 13 / 16 | `78b6b15f96b3e2c3aacdbd525031cd82b54ccf7f17e162b36cff9dfba436ab42` | `2b5009971c37c1eb65c9cc2830596689b5a25904a9b52b524d5bf77305848987` |
| `handoff-p4-fault` | `HOLD` / `INTERNALLY_CONSISTENT` | 0 | 20 / 7 / 19 / 16 | `83ba9b39b764fb3f09f9fc70f2adfb42415a73ef3b43b655c1a639d49761c43f` | `c365813d9ebda590299830a68d1683e3d8f413bc7b4b43da13ea77c5678552af` |

Every command retained origin `NOT_AUTHENTICATED`, authorization `NOT_EVALUATED`, deployment
permission `NONE`, scope `SIMULATION_ONLY`, and authority `NOT_DEFINED`.

## 20. Invalid-evidence quarantine result

Task 3 traversed all five Review paths for `phase1-tampered` and invalid/valid comparison orderings.
It found no accepted stored verdict, rationale, finding, metric, normal timeline, inventory,
accepted provenance, comparison partition, delta, chart, or source payload. Quarantine retained
only safe partial identity, diagnostics, and authority boundaries. Fresh Task 4 CLI review exited
30 with `gate.accepted_recomputation=false`,
`verification.stored_claims_quarantined=true`, null trace digest, and zero accepted findings,
metrics, events, or tracks.

## 21. Comparison results

Fresh Task 4 comparison commands produced:

| Pair | Status / exit | Gate and partition result |
|---|---|---|
| Lead baseline → shielded | `COMPATIBLE` / 0 | `CONDITIONAL` → `CONDITIONAL`; time to collision (TTC) improved; route completion, acceleration, and jerk regressed; collision, latency, and latency source unchanged; shield interventions not comparable; verdict/hard-failure/availability summaries unchanged; 0 availability deltas; 6 charts |
| Cut-in baseline → shielded | `COMPATIBLE` / 0 | `HOLD` → `HOLD`; same improvement/regression/unchanged/not-comparable partitions; 0 availability deltas; 6 charts |
| Lead baseline → cut-in shielded | `INCOMPATIBLE` / 40 | `CONDITIONAL` → `HOLD`; scenario digest, scenario name, and adapter-configuration digest differ; no deltas or charts |

Neither compatible result establishes a winner or overall advancement. Task 3 also verified
submitted sides remain pinned through draft edits and failed lexical requests.

## 22. Artifact-immutability result

Correction to the earlier Task 3 shorthand: that attack hashed two selected artifacts, each with
ten canonical bundle files; it did not hash all ten retained directories.

Final Task 4 hashing covered **100 canonical files across ten retained directories** before and
after all nine CLI operations. The exact file map was equal. Aggregate digests were computed from
relative path + NUL + file bytes:

| Directory | Before and after aggregate |
|---|---|
| `handoff-phase5-demo` | `50843d4322d163cd93a7afbcb0f8b671c487f067c648a93d2ad520695cfc98cb` |
| `handoff-p1-conditional` | `79cdb2a9f3f681dcc5f830fd47080cff71492a4cc314ef57e8639e1d46ce3dda` |
| `handoff-p1-collision` | `0e2821a31473a41a250cd49a632a4eb59e9eb8d724d429ff37f6f63b94a52a69` |
| `phase1-tampered` | `236449c09826cd978028bf702f933243bf17bd49aba19826267a109a52ab013d` |
| `handoff-p2-metadrive` | `ef6705c70b9ee321e7e2f93f049138d6660bd77ac743ecf4917c1b93cecea758` |
| `handoff-p4-fault` | `a854a9b433369b1a31046d7784dd5e2f21d8a9f0ddd9dad9b39bf81194850675` |
| `handoff-p3-lead-baseline` | `073368fefba60616a0a82c67c988854cac4a567ced84c5639efccfa599946525` |
| `handoff-p3-lead-shielded` | `1c093ffb7be3332fc21f8b461c1bbbf31a236e77947bbea04660492e1383a4c1` |
| `handoff-p3-cutin-baseline` | `dac885bf69bbc90f0e5536f64c4331bb65136860786505fb3d09e5a3f73e92ce` |
| `handoff-p3-cutin-shielded` | `ac363bba97d65ce56f179a2f24e1e4ca52d4f474609f62f29218aa50f50036eb` |

No artifact byte changed.

## 23. Screenshot and visual-review status

Manual visual review: `NOT YET OBSERVED`.

Browser DOM retained-state walkthrough: `OBSERVED`. It covered initial `UNVERIFIED`, nominal PASS,
collision HOLD, INVALID quarantine with no stored-PASS leak, Timeline action accountability,
Provenance, Evidence limitations, compatible mixed comparison, and incompatible fail-closed
comparison with no exception or accepted-claim leakage. Within that walkthrough, `cbced6e`
confirmed the `All tracks` radio and exact 16-track multiselect agree.

The stale-permalink P2 is closed in code/tests and narrow browser DOM at `0fe3459`: all seven
primary H2s have explicit anchors, with one RED/one GREEN, 83 focused, and two independent targeted
passes. Fresh cross-section DOM observed Overview `#overview`, Timeline `#timeline`, Compare
`#compare`, and exception-text count 0.

No pixel screenshot result is claimed. The in-app browser backend reported screenshot visibility
false and produced uniformly blank images, so those outputs are not visual evidence. The executable
checklist covers
initial UNVERIFIED, nominal PASS, collision HOLD, invalid quarantine, unavailable required evidence,
Timeline accountability, Provenance/limitations, compatible lead/cut-in, incompatible comparison,
four 200% zoom surfaces, and visible focus. There is no retained valid fixture known to expose all
required/optional/not-applicable unavailable states; that row must remain open rather than be
fabricated. Pixel/manual visual review, 200% visual reflow, CSS focus, screen-reader behavior,
contrast, accessibility audit, and human comprehension remain `NOT YET OBSERVED`.

## 24. Human-comprehension status

Human comprehension: `NOT YET OBSERVED`.

The usability plan targets 6–10 future participants across product, safety, simulation, and
engineering roles and defines Tasks 1–10 plus immediate authority/missing-evidence/comparison stop
conditions. The observation template is intentionally blank. Automated tests, source inspection,
and screenshots cannot promote this status.

## 25. Known limitations and residual risks

- Internal consistency and local hashes do not authenticate the evidence producer or origin.
- Stored review does not rerun the policy or simulator; candidate and simulator facts remain stored
  trace inputs.
- Repository/simulator/policy provenance is recorded and self-asserted, not signed.
- Simulation evidence does not establish real-world safety, road readiness, certification,
  compliance, authorization, or physical deployment permission.
- Same-host repeatability is not cross-platform bitwise determinism.
- The cut-in fixture is scripted kinematic replay with `behavior_realism_claim: false`.
- The workbench is local, loopback-only, single-user, and has no approval workflow.
- Accepted P2: process-local `_cache`/`_active` growth. The prior 43-selection probe reached 41
  cached entries, 43 active sessions, and about 251 MB peak RSS; restart recovers memory. A
  deterministic synchronized bounded LRU is required before discovery/autocomplete or material
  scale increase.
- A Task 3 presentation-only rehydration observation can broaden displayed Timeline references
  after navigation, while preserving every previous reference and canonical field; it remains P2.
- Stale dynamic H2 permalinks after radio reruns were a browser-observed P2 and are closed in
  code/tests and narrow browser DOM by explicit anchors at `0fe3459`. Overview `#overview`, Timeline
  `#timeline`, Compare `#compare`, and zero exception text are `OBSERVED — PASS`. This is not an
  accepted residual and does not change any manual observation status.
- Manual visual quality, screen-reader behavior, contrast, visible focus, 200% reflow, and human
  comprehension are still unobserved at this checkpoint.

## 26. Git status

At the final validated pre-documentation-commit checkpoint:

```text
branch: feat/phase6-reviewer-comprehension
HEAD: 0fe3459ac87b78a023bb477ebf1210b2a9d31792
status: 15 intended documentation/input entries; staged index empty
```

Only the Task 4 allowlist and preserved user-owned input differ. No artifact, generated evidence,
package metadata, cache, virtual environment, `third_party/metadrive`, implementation source, or
user-owned prompt is staged. `git diff --check` and cached checks are clean; the cached name/stat is
empty. `third_party/metadrive` is clean. No remote action occurred.

## 27. Local commits

| Commit | Message | Gate |
|---|---|---|
| `685b92df37e88a3232384fec4d57f5e9d8e5e089` | `docs: freeze reviewer comprehension design iteration` | repository-aware IA/trust/selection design freeze |
| `e2eab3421973fb3d9ca554bc6da3f8953e3442de` | `feat: improve Hermes reviewer comprehension` | implementation plus focused/full tests |
| `80439c5382cf5e0744cdcec7402633e4bcc81e1e` | `fix: harden reviewer submission state` | independent-review fixes; 746 full tests |
| `cbced6e57670ae7aaf63f9ce875122ac7471e348` | `fix: align timeline preset and projection` | browser-DOM finding; RED/GREEN, 88 scoped, two targeted, DOM parity |
| `0fe3459ac87b78a023bb477ebf1210b2a9d31792` | `fix: stabilize workbench heading anchors` | stale-permalink P2 closed; 83 focused, two targeted; DOM hrefs observed exact with zero exceptions |
| reported after commit | `docs: record reviewer comprehension iteration` | validation/package complete; content-derived SHA comes from post-commit readback |

All commits are local; no push or pull request occurred.

## 28. Workbench launch command

```bash
conda run -n hermes-dev hermes workbench \
  --artifact-root artifacts \
  --host 127.0.0.1 \
  --port 8501 \
  --no-browser
```

This binds to numeric loopback only, disables automatic browser launch and telemetry, and must not
launch a simulator, policy, upload, artifact write, approval, promotion, release, or deployment
action. The observed browser walkthrough used loopback only. The server then stopped cleanly via
Ctrl-C, the port 8501 listener was gone, and browser tabs were finalized.

## 29. Single best next action

Create and independently verify an approved renderable fixture for the critical Task 4
required/optional/not-applicable evidence states; then execute the pixel/manual, accessibility, and
6–10 participant protocols. Until every critical task has an executable verified fixture and actual
observations, keep 200% visual reflow, CSS focus, screen-reader, contrast, accessibility audit, and
human comprehension `NOT YET OBSERVED`.
