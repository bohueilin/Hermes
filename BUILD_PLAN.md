# Hermes — Phase 6 Comprehensive Build Plan and Reviewer-Comprehension Iteration

## 1. Executive intent

Hermes has completed the deterministic evidence, MetaDrive, shield, fault, comparison,
developer-hardening, and Phase 6 evidence-review foundations. Phase 6 makes those artifacts
reviewable without weakening evidence integrity.

Delivered Phase 6 wave:

> **A local, read-only Evidence Review Workbench built on one immutable review contract and the existing stored-verification core.**

This plan was executed in gated order: design freeze, review core/CLI, local workbench,
adversarial hardening, and final documentation/handoff. A later presentation-only
reviewer-comprehension iteration preserves the same facade/envelopes while improving reviewer
reasoning, navigation, evidence grouping, Timeline defaults, and comparison synthesis.

## 2. Historical baseline and implementation checkpoint

The historical design-review baseline was:

| Item | Observed value |
|---|---|
| Repository | `/Users/bohueilin/Documents/GitHub/Hermes` |
| Completed branch | `feat/unattended-evidence-core` |
| Completed HEAD | `9e257a0cf0ddbdbf601b8a01deebe4de52de9763` |
| Recommended Phase 6 branch | `feat/phase6-evidence-workbench` |
| Python | 3.11.15 |
| Conda | `hermes-dev` |
| Tests | 273 passing |
| Ruff | passing |
| Doctor | 18 PASS, 1 optional NOT_AVAILABLE |
| MetaDrive | 0.4.3 at pinned clean source commit |
| Remote activity | none |

The completed implementation/adversarial checkpoint is:

| Item | Observed value |
|---|---|
| Branch | `feat/phase6-evidence-workbench` |
| Checkpoint HEAD | `90fb7d891a233fea9fe5de915060873851da1d70` |
| Python | 3.11.15 in `hermes-dev` |
| Complete tests | 720 passing |
| Non-MetaDrive tests | 720 passing |
| Focused Phase 6 adversarial matrix | 488 passing |
| Ruff / diff check | passing |
| Adversarial decision | GO; no open P0/P1 |
| Remote activity | none |

The later reviewer-comprehension implementation checkpoint is:

| Item | Observed value |
|---|---|
| Branch | `feat/phase6-reviewer-comprehension` |
| Starting HEAD | `be57bb126d6339efe0d8184304620aab64a680a6` |
| Design commit | `685b92df37e88a3232384fec4d57f5e9d8e5e089` |
| Implementation commit | `e2eab3421973fb3d9ca554bc6da3f8953e3442de` |
| Submission-state hardening | `80439c5382cf5e0744cdcec7402633e4bcc81e1e` |
| Browser-DOM Timeline parity fix | `cbced6e57670ae7aaf63f9ce875122ac7471e348` |
| Stable explicit H2-anchor fix / current pre-doc HEAD | `0fe3459ac87b78a023bb477ebf1210b2a9d31792` |
| Complete tests at Task 3 audit | 746 passing |
| Final full / non-MetaDrive tests | 756 / 756 passing |
| Final focused 13-file Phase 6 matrix | 506 passing |
| Final installs / Ruff / diff and cached checks | both extras installed; passing; staged index empty |
| Final doctor | 17 PASS, one intended 15-entry dirty-tree WARN, one optional DISPLAY NOT_AVAILABLE, 0 FAIL |
| Final review/compare CLI and artifact immutability | six reviews + three comparisons matched contracts; 100 canonical files unchanged |
| Automated adversarial audit | GO; A01–A15 passed; no P0/P1 reproduced |
| Browser-DOM fix verification | RED/GREEN; 88 scoped + 2 independent targeted passed; DOM parity observed |
| Stable-anchor verification | RED/GREEN; 83 focused + 2 targeted passed; exact DOM hrefs and zero exceptions observed |
| Manual visual / accessibility / human comprehension | `NOT YET OBSERVED` |
| Remote activity | none |

## 3. Phase 6 decision

### Decision

**GO** for the local, read-only workbench within the frozen Phase 6 boundary.

Design freeze, implementation, adversarial review, and regression gates completed. Independent
reviewers returned GO after reproduced P1 defects were closed. One accepted P2 remains: unbounded
process-lifetime cache/session growth after repeated explicit local selections.

### Conditions met

- It is a one-way consumer of stored verification and comparison.
- It is local-only.
- It is read-only.
- It exposes trust dimensions independently.
- It never implies `PASS` equals safety or deployment approval.
- It labels all current evidence `NOT_AUTHENTICATED`.
- It does not implement signing, approval, or scenario execution in the same wave.

## 4. Why Phase 6 precedes alternatives

### Before authenticity implementation

A local read-only viewer can safely expose unauthenticated evidence when it cannot authorize consequential action and when `NOT_AUTHENTICATED` is mandatory. The viewer also clarifies which provenance and decision surfaces a future signature must bind.

Authenticity must precede multi-user review, official approval, promotion actions, or externally trusted evidence—not this constrained local viewer.

### Before scenario expansion

Hermes already demonstrates all verdict classes, real simulator integration, shield trade-offs, and fault evidence. More scenarios would add volume before reviewer comprehension and evidence sufficiency are solved.

### Before a learned policy

A learned policy adds training nondeterminism, model provenance, reward hacking, hidden-set leakage, and overfitting risk. Hermes should first prove reviewers can understand evidence and trade-offs.

## 5. Canonical contract reconciliation

### 5.1 Completed-run bundle

Phase 6 uses one canonical ten-file inventory:

```text
manifest.json
execution-context.json
scenario.resolved.yaml
gate-config.resolved.yaml
events.jsonl
metrics.json
findings.json
verdict.json
trace.sha256
bundle.sha256
```

### 5.2 Documentation reconciliation

The Phase 6 finalization reconciles:

- `AGENTS.md`;
- `PROJECT_BRIEF.md`;
- `README.md`;
- `BUILD_PLAN.md`;
- architecture and traceability docs;
- schema docs;
- review-envelope docs.

The older seven-file inventory is not a completed-run contract and no workbench-specific contract
exists.

## 6. Trust vocabulary

### 6.1 Independent states

```text
Gate verdict
Evidence integrity
Evidence authenticity
Authorization status
Deployment permission
Simulation scope
```

### 6.2 Required values in Phase 6

| Dimension | Required Phase 6 state |
|---|---|
| Gate verdict | recomputed existing gate result |
| Integrity | `INTERNALLY_CONSISTENT`, `INVALID_EVIDENCE`, or transient `UNVERIFIED` |
| Authenticity | `NOT_AUTHENTICATED` |
| Authorization | `NOT_EVALUATED` |
| Deployment permission | `NONE` |
| Scope | `SIMULATION_ONLY` |

### 6.3 Prohibited labels

Do not present current artifacts as:

- trusted;
- approved;
- certified;
- validated for road use;
- deployable;
- production-safe;
- Level 4;
- authenticated.

## 7. Implemented architecture

```text
Allowed local artifact root
        │
        ▼
Artifact selection and path containment
        │
        ▼
Existing no-follow immutable snapshot/capture
        │
        ▼
Existing stored verification facade
        │
        ├── schemas/digests/events
        ├── recomputed metrics/findings
        ├── recomputed gate verdict
        └── evidence availability
        │
        ▼
Immutable ReviewEnvelope v1
        │
        ├── CLI JSON/text
        └── PresentationProjection
                 │
                 ▼
         Local read-only workbench
```

Comparison:

```text
Artifact A → capture → verify ┐
                              ├→ existing compatibility/compare core
Artifact B → capture → verify ┘
                                      │
                                      ▼
                           ComparisonEnvelope v1
                                      │
                                      ▼
                         CLI and read-only workbench
```

## 8. Component responsibilities

| Component | Responsibility | Must not do |
|---|---|---|
| Artifact selector | Resolve a path under an allowed root | Infer authority from “latest” |
| Snapshot/capture | Create a fixed no-follow view and digest identity | Write or repair files |
| Verification facade | Invoke existing stored verification | Format UI or run simulator |
| Review assembler | Map verified results to `ReviewEnvelope v1` | Reimplement gate/verifiers |
| Comparison facade | Invoke existing compatibility and comparison | Create winner score |
| Presentation projection | Units, grouping, event references, chart series | Change verdict/finding semantics |
| Workbench UI | Render immutable projection | Parse source files directly |
| Authenticity provider | Return `NOT_AUTHENTICATED` in Phase 6 | Pretend local hashes authenticate origin |

## 9. Implemented package structure

Implemented package boundaries:

```text
src/hermes/
  review/
    __init__.py
    models.py
    projection.py
    facade.py
  workbench/
    __init__.py
    app.py
    launcher.py
```

Framework-specific modules may import `hermes.review`. `hermes.review` must not import the UI framework.

## 10. Stage 1 — design freeze (completed)

### Objective

Freeze contracts and decisions before implementation.

### Required work

1. Inspect current code, schemas, CLI, comparison, no-follow capture, tests, and documentation.
2. Reconcile the ten-file bundle contract.
3. Define `ReviewEnvelope v1` and `ComparisonEnvelope v1`.
4. Define evidence-category vocabulary.
5. Define evidence-sufficiency semantics.
6. Define exact source-reference semantics.
7. Select the UI framework and record rationale.
8. Define path, size, event-count, cache, and local-bind policies.
9. Define CLI review commands and exit semantics.
10. Freeze acceptance and negative tests.
11. Update requirement traceability.
12. Produce `PHASE6_DESIGN_FREEZE_HANDOFF.md`.

### Historical design-freeze isolation

- At that checkpoint only, changes were limited to the contract and design documents; production
  code and the optional UI dependency followed in later commits.
- No gate/verifier semantic changes unless required only to expose existing requiredness and explicitly documented.
- No signing.
- No artifact format migration.

### Design-freeze acceptance gate

- Current tests and Ruff remain green.
- Current artifacts still verify.
- One canonical bundle inventory exists.
- Review envelope is versioned and complete.
- Gate, integrity, authenticity, authorization, permission, and scope are independent fields.
- Dependency direction is testable.
- Every negative test has an expected result.

## 11. Stage 2 — review core (completed)

### 11.1 Review facade

The framework-independent service:

- accepts an exact artifact directory and allowed artifact root;
- enforces containment;
- invokes existing immutable capture;
- invokes stored verification;
- assembles an immutable `ReviewEnvelope v1`;
- never reruns the simulator;
- never edits the bundle;
- returns an invalid-evidence envelope rather than trusting stored verdicts after failure.

### 11.2 Review CLI

Implemented command using a root-relative selection:

```bash
hermes review-artifact handoff-phase5-demo \
  --artifact-root artifacts \
  --format json
```

Required behavior:

- JSON is one canonical envelope only.
- `PASS`, `CONDITIONAL`, and `HOLD` are reviewable valid evidence.
- Invalid evidence returns exit 30.
- Path/configuration errors return exit 40.
- No simulator import or launch.
- No source artifact write.

### 11.3 Comparison facade and CLI

Implemented command using two root-relative selections:

```bash
hermes review-compare handoff-p3-lead-baseline handoff-p3-lead-shielded \
  --artifact-root artifacts \
  --format text
```

Required behavior:

- independently verifies both bundles;
- invokes existing compatibility/compare core;
- returns one `ComparisonEnvelope v1`;
- incompatible evidence exits 40 and emits no comparison chart payload;
- invalid evidence exits 30;
- includes improvements, regressions, unchanged results, and availability deltas;
- contains no winner score.

## 12. Stage 3 — local workbench (completed)

### 12.1 Framework

Selected framework: Streamlit as an optional extra:

```toml
[project.optional-dependencies]
workbench = ["streamlit>=1.37,<2"]
```

The review core remains framework-independent and does not import Streamlit.

### 12.2 Launcher

Implemented command:

```bash
hermes workbench \
  --artifact-root artifacts \
  --host 127.0.0.1 \
  --port 8501 \
  --no-browser
```

Phase 6 rejects non-loopback host binding before process startup.

### 12.3 Workbench information architecture

The six-screen predecessor was replaced by three primary destinations:

1. **Review**, with `Select & Verify`, `Overview`, `Evidence`, `Timeline`, and `Provenance`.
2. **Compare**.
3. **Evidence limitations**.

The submitted artifact locator persists throughout Review. Gate/integrity form Tier 1 decision
state; origin, authorization, deployment permission, simulation scope, and authoritative status
remain independent Tier 2 authority boundaries. This hierarchy is presentation-only.

### 12.4 Read-only behavior

The UI must not expose:

- run;
- edit;
- repair;
- migrate;
- sign;
- approve;
- promote;
- release;
- deploy;
- threshold editing;
- scenario selection for execution.

## 13. ReviewEnvelope v1 — required domains

The normative schema is in `docs/PHASE6_REVIEW_ENVELOPE_CONTRACT.md`.

Required domains:

- schema/tool identity;
- artifact identity;
- verification status;
- trust states;
- gate result;
- evidence sufficiency;
- findings;
- metrics;
- event index/timeline references;
- provenance;
- assumptions;
- unavailable evidence;
- residual limitations;
- source references.

## 14. Evidence sufficiency

The core must expose:

```text
required_and_available
required_but_unavailable
optional_and_available
optional_and_unavailable
not_applicable
```

Requiredness must come from existing gate/verifier profiles or a new versioned core contract—not from UI interpretation.

Phase 6 must not silently change a valid existing verdict merely because a reviewer considers an optional signal important. It should expose the limitation and gate consequence truthfully.

## 15. Numeric integrity

For every metric/finding:

- preserve canonical machine value;
- provide display value;
- include unit;
- include threshold and operator;
- include verifier version;
- include supporting event sequences;
- include evidence category and availability;
- include gate consequence.

Exact value detail must remain inspectable. Rounding cannot hide a threshold crossing.

## 16. Artifact identity and authority

The workbench must show:

- run ID;
- relative artifact path;
- bundle digest;
- trace digest;
- creation time;
- Hermes Git commit and dirty state;
- adapter/simulator identity;
- scenario, gate, policy, shield, and fault profiles;
- authenticity status;
- authority/supersession status.

For Phase 6:

```text
Authoritative status: NOT_DEFINED
```

Do not auto-select “latest.”

## 17. Caching and state

- Cache only immutable review envelopes or presentation projections.
- Key only INTERNALLY_CONSISTENT envelopes with a non-null computed bundle digest by that digest,
  review schema 1.0, Hermes version, and selected relative path. Never cache any INVALID_EVIDENCE
  envelope, including a complete invalid capture with a digest, or a partial/null-digest capture.
- Prefer in-memory local cache.
- Before every cached render, repeat containment and full capture/stored verification.
- Filesystem metadata remains private and nonserialized.
- Digest change invalidates the active projection; identical bytes at the same path retain the
  same envelope even if metadata changes.
- Accepted P2: the process-local cache and active-session maps do not yet have an entry cap. Every
  entry requires an explicit local selection, Hermes performs no root discovery/automatic loading,
  and process restart recovers memory. Add a deterministic synchronized LRU before materially
  increasing artifact scale.

## 18. Threat model

The normative threat model is in `docs/PHASE6_THREAT_MODEL.md`.

Priority threats:

1. coherent full-bundle forgery;
2. false runtime facts accepted as trace inputs;
3. under-specified evidence requirements;
4. self-asserted provenance;
5. UI semantic drift;
6. stale cache/TOCTOU;
7. comparison overclaim;
8. simulation-fidelity confusion;
9. numeric rounding;
10. stale artifact authority.

## 19. Implemented negative-test matrix

Coverage includes:

- artifact changes after verification;
- directory swapped under same path;
- symlink escape;
- traversal;
- missing file;
- mixed/unsupported schema;
- malformed and oversized input;
- duplicate/reordered events;
- stored `PASS` plus corrupt trace;
- XSS payload in artifact strings;
- incompatible comparison;
- threshold-rounding edge;
- `NOT_AVAILABLE` TTC;
- UI filter/sort cannot alter verdict;
- workbench cannot write artifacts;
- missing authenticity field;
- non-loopback bind rejected;
- UI/core dependency import violation;
- simulator launch attempt absent.

## 20. Human comprehension gate

A reviewer unfamiliar with the implementation must be able to answer:

1. Why did the gate issue this verdict?
2. Which hard requirement failed?
3. Which evidence was unavailable?
4. What did the shield change?
5. What improved and regressed?
6. Is the bundle authenticated?
7. Does the verdict authorize real-world deployment?

The gate may be executed as a scripted review or a documented human evaluation. Do not fabricate participant results.

## 21. Test strategy

### Unit

- review models;
- evidence classification;
- sufficiency mapping;
- presentation precision;
- path and host validation.

### Contract

- review facade ↔ existing verification;
- comparison facade ↔ existing compare core;
- JSON schema stability;
- dependency boundaries.

### Integration

- valid PASS/CONDITIONAL/HOLD envelopes;
- invalid/tampered quarantine;
- artifact immutability;
- stale cache invalidation;
- no simulator import/launch.

### Workbench

- screen render from fixed envelopes;
- escaped evidence strings;
- mandatory trust strip;
- no write controls;
- incompatible comparison behavior.

### Regression

- entire existing suite;
- Ruff;
- doctor;
- MetaDrive smoke remains manual and unchanged.

## 22. Acceptance artifacts

Use available retained artifacts when present:

```text
handoff-phase5-demo
handoff-p1-collision
handoff-p1-conditional
phase1-tampered
handoff-p2-metadrive
handoff-p3-lead-baseline
handoff-p3-lead-shielded
handoff-p3-cutin-baseline
handoff-p3-cutin-shielded
handoff-p4-fault
```

If absent, generate only the minimum required documented artifacts through existing commands. The workbench itself must not generate them.

## 23. Stage 4 — adversarial review and hardening (completed)

The independent review covered:

- false-pass and false-trust presentation;
- artifact mutation;
- TOCTOU;
- UI/core semantic drift;
- invalid-artifact quarantine;
- comparison cherry-picking;
- numeric precision;
- prohibited safety language;
- local-only behavior.

It closed four reproduced P1 findings covering mutable semantic registries, malformed-YAML and
derived-value exception escape, and unsafe/unbounded terminal text projection. It also closed a P2
artifact-switch drill-down state issue. Independent reviewers returned GO; the cache/session growth
P2 in section 17 remains accepted.

## 24. Stage 5 — documentation and handoff (completed by finalization)

Finalization updates:

- root README;
- project brief;
- architecture and trust docs;
- review-envelope contract;
- UX specification;
- threat model;
- traceability matrix;
- decision log;
- demo runbook;
- `CODEX_HANDOFF.md`.

The final handoff records actual review commands, envelope samples, tests, negative results, local
URL/launch command, Git status, and limitations.

## 24A. Reviewer-comprehension iteration

### Design and implementation

The repository-aware design freeze rejected UI-side artifact discovery because the public facade
has no descriptor-safe discovery contract. Selection remains blank-by-default exact text with an
inert example, explicit Verify, submitted-identity confirmation, and recovery copy. A future picker
requires both a reviewed discovery API and a deterministic synchronized bounded LRU.

The implementation adds, without changing evidence semantics:

- the ordered Review/Compare/Evidence limitations hierarchy;
- Overview ordered around identity, gate, rationale, integrity/authority, unavailable required
  evidence, limitations, and Provenance cue;
- `Failed required evidence`, `Required but unavailable`, `Soft failures and warnings`, `Passing
  required evidence`, `Optional evidence`, and `Not applicable` groups;
- distinct required/optional/not-applicable unavailable copy;
- `Decision evidence`, `Action accountability`, `Fault behavior`, and `All tracks` Timeline presets;
- finding-to-first-supporting-event navigation; and
- mandatory compatible-comparison synthesis for gate, hard failures, improvements, regressions,
  unchanged, not comparable, availability, and no-overall-advancement interpretation.

Strict invalid quarantine, exact values/units/thresholds/references, side qualification, 16-track
data, and facade ownership remain unchanged. Task 3 attacked 15 authority/workflow seams and
reported GO with no P0/P1. One P2 presentation-state rehydration observation and the pre-existing
cache/session P2 remain accepted.

A later in-app browser DOM walkthrough found that first Timeline mount displayed an All-tracks
projection while the radio indicated Decision evidence. Commit `cbced6e` aligns both to
`All tracks`; its targeted RED/GREEN cycle, 88 scoped tests, two independent targeted tests, and
fresh DOM confirmation passed. The screenshot backend returned blank/non-visible images, so only
that particular DOM structural parity result is observed. The complete retained-state browser DOM
walkthrough also observed initial UNVERIFIED, PASS, HOLD, invalid quarantine without stored-PASS
leakage, Timeline/action accountability, Provenance/limitations, compatible mixed comparison,
incompatible fail-closed comparison, and no exception/leak. Pixel/manual visual and accessibility
gates remain open.

The same walkthrough found stale dynamic H2 permalinks after radio reruns. Commit `0fe3459` assigns
explicit anchors to all seven primary H2s. One targeted test failed then passed; 83 focused tests
and two independent targeted tests passed, with Ruff/diff clean. The code/test P2 is closed; browser
DOM also observed Overview `#overview`, Timeline `#timeline`, Compare `#compare`, and exception-text
count 0. Manual visual/accessibility/human gates remain unchanged.

Final Task 4 gates at `0fe3459` plus the documentation working tree recorded 756 full tests, 756
non-MetaDrive tests, and 506 focused tests. Both editable installs succeeded; repository Ruff and
diff/cached checks passed; doctor reported 17 PASS, one intended 15-entry dirty-tree WARN, one
optional DISPLAY `NOT_AVAILABLE`, and no FAIL. Six review and three comparison CLI cases matched
their expected contracts, and the exact before/after map for 100 canonical files across ten
retained artifact directories was unchanged. No simulator or policy was launched; doctor performed
only an environment-level MetaDrive import.

### Human-review package and status

The package comprises:

```text
PHASE6_DESIGN_ITERATION_HANDOFF.md
docs/PHASE6_USABILITY_TEST_PLAN.md
docs/PHASE6_HUMAN_OBSERVATION_TEMPLATE.md
docs/PHASE6_VISUAL_REVIEW_CHECKLIST.md
```

The usability plan defines Tasks 1–10 for 6–10 future product, safety, simulation, and engineering
participants. The visual checklist covers screenshots, keyboard, screen reader, focus/announcement,
non-color/contrast, table alternatives, 200% zoom/reflow, and bounded inert content. It makes no
WCAG claim. Manual visual review, accessibility audit, and human comprehension remain
`NOT YET OBSERVED` until actual evidence is recorded.

## 25. Explicit non-goals

- Evidence signing or trust-anchor implementation.
- Approval/promotion workflow.
- Scenario execution from UI.
- Simulator playback or visual driving replay.
- New simulator or policy.
- RL.
- CARLA, ROS 2, Autoware.
- Cloud deployment or remote access.
- Database persistence.
- Physical hardware.
- Safety/certification claims.

## 26. Stop conditions

Stop Phase 6 if:

- UI requires a second gate/verifier;
- source artifacts must be modified;
- CLI/UI verdict parity cannot be maintained;
- invalid evidence can display accepted `PASS`;
- `NOT_AUTHENTICATED` cannot be mandatory;
- workbench must launch simulator/policy;
- immutable digest-bound review cannot be achieved;
- canonical bundle contract remains inconsistent;
- public or multi-user deployment becomes required;
- scope expands into deferred areas.

## 27. Suggested local commits

```text
docs: freeze Phase 6 review contracts
feat: add immutable evidence review facade
feat: add local read-only evidence workbench
test: harden workbench trust boundaries
docs: finalize Phase 6 validation and handoff
```

No push or PR.

## 28. Definition of success

Phase 6 met its definition of success: a reviewer can inspect valid, invalid, and compared artifacts
through a local read-only surface, every displayed verdict remains traceable to the existing
verified core, and every trust limitation remains explicit.

## Recommendation

Maintain Phase 6 as a local-only, read-only reviewer. Before materially increasing artifact scale,
bound the process-local cache/session maps with a deterministic synchronized LRU. Treat signing,
authorization, promotion, or remote review as separate future phases with their own trust gates.
