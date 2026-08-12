# Hermes Phase 6 Design-Freeze Handoff

## 1. Executive verdict

**CONDITIONAL GO** for Stage 6B implementation.

There is no unresolved P0 design decision. Conditions are implementation and regression gates:
one-capture/no-reopen review identity, invalid-claim quarantine, CLI/UI parity, core-owned
requiredness and thresholds, immutable artifacts, dependency boundaries, resource limits,
loopback-only launch, XSS-safe rendering, and full Phase 0–5 regression coverage.

The controlling user request says “Perform four internal stages in this one chat,” “Do not wait for
human approval between stages unless a genuine unresolved P0 blocker...,” and after
GO/CONDITIONAL GO, “continue automatically to Stage 6B.” Under repository instruction precedence,
this explicit current instruction overrides the generic AGENTS separate-approval stage gate.

## 2. Repository snapshot

| Item | Starting observed state | Ending state in this handoff |
|---|---|---|
| Branch | feat/phase6-evidence-workbench | feat/phase6-evidence-workbench |
| Commit | 27cc5a08931cc1d659128bfebd0bd1ca7e9aefee | Same commit; no commit created |
| Working tree | Clean | Exactly the 15 documentation paths in section 15 modified/untracked |
| Package | hermes-autonomy 0.1.0; Python target 3.11 | No dependency/version edit |
| Tests | 273 passed in supplied/observed baseline | 273 passed in 3.97 s |
| Ruff | Passing baseline | All checks passed |
| Doctor | 18 PASS, 1 optional NOT_AVAILABLE, no WARN/FAIL | 17 PASS, 1 intentional dirty-worktree WARN, 1 optional NOT_AVAILABLE, no FAIL |
| Simulator | MetaDrive 0.4.3 at 85e5dadc6c7436d324348f6e3d8f8e680c06b4db | Not launched |

No remote action, simulator launch, artifact write, production code change, test change, dependency
change, commit, or third_party change occurred in Stage 6A.

## 3. Contracts inspected

| Contract | Actual modules/tests inspected | Observed contract and Phase 6 consequence |
|---|---|---|
| Bundle inventory/publication | src/hermes/evidence/artifacts.py; phase architecture/docs | REQUIRED_ARTIFACT_FILES is the exact ten-file contract; bundle.sha256 binds manifest plus companions |
| Capture and mutation | src/hermes/evidence/verification.py; tests/unit/test_artifact_verification.py | _read_exact_files uses descriptor-relative O_NOFOLLOW opens, double reads, metadata and inventory stability; semantic verification uses captured bytes |
| Stored verification | src/hermes/evidence/verification.py; domain models/enums | inspect_artifact returns ArtifactInspection; valid yields immutable VerifiedArtifactSnapshot; invalid yields no snapshot |
| Gate/findings | src/hermes/gates/release.py; src/hermes/verifiers/__init__.py | Explicit VerifierProfile selects a closed finding set; gate is non-compensatory; Finding carries status/severity/hardness and an audit threshold string |
| Schemas/availability | src/hermes/domain/models.py; test_artifact_schema_version.py | Evidence schemas 1.0/2.0 are explicit; Measurement is AVAILABLE or reasoned NOT_AVAILABLE |
| Event references | TraceEvent/TraceEventV2 | V1 has candidate/executed plus summaries; V2 adds permitted and raw/delivered/result observations |
| Comparison | src/hermes/comparison/compare.py; test_comparison.py | compare_artifacts is the only compare core; compatibility fails closed and dimensions are mixed-direction/NOT_COMPARABLE |
| CLI/exits | src/hermes/cli.py; cli_errors.py; CLI tests | Existing verdict exits 0/10/20/30 and error 40 remain legacy behavior; JSON errors are canonical |
| Trust | AuthenticityStatus, ArtifactVerification, manifest limitation | Current evidence is NOT_AUTHENTICATED; integrity is separate from verdict |
| Imports | tests/unit/test_architecture_boundaries.py; pyproject.toml | Stored decision layers cannot import adapters/MetaDrive; no current web dependency |

Observed gap: ArtifactInspection does not retain captured file inventory, metadata, observed
bundle.sha256, or the computed bundle digest for facade projection. Stage 2 must extend the
capture/result boundary so these values originate from the same bytes. Reopening source paths or
reimplementing verification is prohibited.

## 4. Canonical bundle decision

Exactly:

~~~
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
~~~

This is REQUIRED_ARTIFACT_FILES. No alternative workbench bundle or migration is permitted.
Phase 6 documents were reconciled to this inventory; validated Phase 1–5 history remains intact.

## 5. ReviewEnvelope 1.0 decision

- Version: exactly 1.0.
- Normative contract: docs/PHASE6_REVIEW_ENVELOPE_CONTRACT.md.
- Model target: immutable strict models in src/hermes/review/models.py.
- Portable content: tool, artifact/inventory, observed/computed bundle/trace roots, verification,
  trust, gate, sufficiency, findings, metrics, timeline, provenance, assumptions, unavailable
  evidence, and residual limitations.
- Determinism: unchanged bytes + selected relative path + schema 1.0 + Hermes version produce
  byte-identical canonical JSON; filesystem metadata never enters the envelope.
- Excluded: generated timestamp, duration, random/session ID, absolute path, port, browser/cache
  state.
- Invalid evidence: gate INVALID_EVIDENCE; stored verdict/findings/metrics quarantined; accepted
  findings/metrics/timeline empty; mandatory trust/limitations remain.
- Unsupported source/review versions: fail closed; no repair, migration, or reinterpretation.

Core IntegrityStatus.INVALID maps to portable INVALID_EVIDENCE without changing the core enum.

## 6. ComparisonEnvelope 1.0 decision

- Independently capture and verify baseline and candidate.
- Call existing compare_artifacts as the only compatibility/delta authority.
- Compatible results partition every dimension into improvements, regressions, unchanged, or
  descriptive NOT_COMPARABLE; availability changes are separate.
- Intervention counts are descriptive, not ordinal.
- Incompatible results contain reasons but no verdict/hard-failure delta, dimension partition,
  source links, or chart series and exit 40.
- No winner, winner score, aggregate score, safety score, or UI-specific ranking.

Retained lead and cut-in pairs are compatible. Both show improved TTC, regressed route completion,
acceleration, and jerk, unchanged verdict, and descriptive intervention changes.

## 7. Trust vocabulary

~~~
Gate verdict: PASS | CONDITIONAL | HOLD | INVALID_EVIDENCE
Evidence integrity: transient UNVERIFIED; completed INTERNALLY_CONSISTENT | INVALID_EVIDENCE
Evidence authenticity: NOT_AUTHENTICATED
Authorization status: NOT_EVALUATED
Deployment permission: NONE
Scope: SIMULATION_ONLY
Authoritative status: NOT_DEFINED
~~~

A Hermes PASS is only a prototype gate verdict. Internal consistency is not independent
authenticity. Stored verification does not reexecute the policy or simulator. SHA-256 is
tamper-evident, not authenticated. Simulation evidence grants no physical-system permission.

## 8. Evidence-sufficiency and threshold decision

Core-owned profile metadata is frozen:

- legacy 1.0: trace, collision, boundary, and progress REQUIRED; comfort acceleration/jerk
  OPTIONAL; fault coverage NOT_APPLICABLE.
- fault_coverage 1.0: the same assignments plus fault coverage REQUIRED.

The minimal core extension exposes this metadata adjacent to EXPECTED_FINDINGS_BY_PROFILE without
altering gate precedence or existing artifact semantics. UI receives only the five classified
states and never infers requiredness.

Thresholds are structured projection metadata derived from verified gate/scenario configuration.
They support compound ALL_OF/ANY_OF predicates. The original string is audit text only; UI never
parses it or decides pass/fail.

## 9. Framework decision

| Option | Setup | Dependency | Testability | Security | Read-only | Local launch | UI/support | Decision |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Streamlit optional extra | 5 | 3 | 4 | 4 | 4 | 4 | 5 | Selected |
| Custom standard-library server-rendered UI | 2 | 5 | 3 | 2 | 4 | 5 | 2 | Rejected |
| Static report | 4 | 5 | 5 | 4 | 5 | 1 | 2 | Rejected |

Scores are 1 poor to 5 strongest. Streamlit wins setup and reviewer support while remaining
optional/testable; stdlib requires bespoke escaping/routing; static output lacks interactive local
launch, source drill-down, and session invalidation.

Stage 2 optional extra is streamlit>=1.37,<2. No dependency was added during design freeze.

## 10. Components and imports

~~~
src/hermes/review/{__init__,models,facade,projection}.py
src/hermes/workbench/{__init__,app,launcher}.py
~~~

Workbench imports only public hermes.review, Streamlit, and standard library. Review imports the
existing stored verification/compare core but never workbench/Streamlit. CLI uses lazy run-only and
review-only imports so review commands do not import adapters, policies, runtime, or MetaDrive.
AST and import-bomb tests enforce these rules.

## 11. Resource, cache, and network policy

- Existing verifier alone enforces 16 MiB/file, 64 MiB total, 10,000 events, and 1 MiB/line.
- Review passes no stricter artifact limit. Operational envelope budgets are 64 findings,
  64 metric items, depth 16, and 1,024 projection display scalars.
- Core-valid unsupported shape returns REVIEW_UNAVAILABLE / UNSUPPORTED_REVIEW_SHAPE / 40 with no
  portable envelope and unchanged integrity/gate.
- Portable timeline retains all core-valid events; UI pagination has no semantic decimation.
- Cache key: computed bundle digest + review schema 1.0 + Hermes version + selected relative path.
  Only INTERNALLY_CONSISTENT envelopes with non-null computed digest are cacheable. All
  INVALID_EVIDENCE envelopes, including complete captures with a non-null digest, and all
  partial/null-digest captures are never cached.
- Before every cached render, perform full containment/capture/stored verification. Filesystem
  metadata stays private; digest mismatch invalidates the active projection.
- ipaddress accepts numeric loopback only (127/8 and ::1); wildcard, hostname, LAN, link-local, and
  public addresses are rejected.
- Streamlit telemetry is false; no external assets/API, upload, database, or remote ingestion.

## 12. Representative artifacts inspected

| Artifact | Bundle digest text | Expected review |
|---|---|---|
| handoff-phase5-demo | fd42b8399ba32853a587a63fee7aba9803c5918539b6053b1554937abcc13334 | PASS / internally consistent |
| handoff-p1-collision | 723e814d0aea399dc2590dd0f1d5b09b20a03a28cadb49c062610894049ae27c | HOLD |
| handoff-p1-conditional | 752ba4725930d62335c1469ceebee6f7517d24265f8c945f68e45d2e7cb41cb4 | CONDITIONAL |
| phase1-tampered | 6eac41695c890dd08758bc6da95e8ae0092d9120057af4693fc64847017d97de | INVALID_EVIDENCE / 30; stored PASS quarantined |
| handoff-p2-metadrive | 78b6b15f96b3e2c3aacdbd525031cd82b54ccf7f17e162b36cff9dfba436ab42 | PASS without simulator rerun |
| handoff-p4-fault | 83ba9b39b764fb3f09f9fc70f2adfb42415a73ef3b43b655c1a639d49761c43f | HOLD; fault coverage PASS |

phase1-tampered selects directory phase1-tampered while manifest run_id is phase1-nominal. Stored
verification reports bundle mismatch, events digest mismatch, and current-hash mismatch at
sequence 0.

## 13. Threat-model outcome

The threat register now maps prevention, detection, fail behavior, exact test, and residual risk
for traversal/symlinks/TOCTOU, stale cache, invalid stored PASS, coherent forgery, false runtime
facts, UI semantic drift, requiredness, missing evidence, schema inference, threshold parsing,
rounding, XSS, resource exhaustion, decimation, comparison cherry-picking/incompatibility,
provenance/authenticity confusion, physical-permission confusion, stale authority, writes,
simulator imports, public bind, and telemetry.

No P0 threat is unresolved at design level. Each must pass its Stage 2 regression before completion.

## 14. Validation and acceptance status

| Check / command | Starting evidence | Ending result |
|---|---|---|
| conda hermes-dev: python -m pip install -e ".[dev]" | Exit 0 baseline | Exit 0 |
| conda hermes-dev: python -m pytest -q | 273 passed baseline | 273 passed in 3.97 s |
| conda hermes-dev: python -m ruff check . | Passing baseline | All checks passed |
| conda hermes-dev: python -m hermes doctor | 18 PASS / 1 optional NOT_AVAILABLE clean baseline | 17 PASS, 1 expected dirty design-doc WARN, 1 optional NOT_AVAILABLE, no FAIL |
| git diff --check | Clean baseline | Exit 0 |
| Documentation-only scope | Starting clean | Exactly listed 15 docs; no src/tests/pyproject/artifacts/third_party diff |

## 15. Files changed by the design-freeze workstream

Validated documentation-only scope:

~~~
PHASE6_DESIGN_FREEZE_HANDOFF.md
CURRENT_STATE_HANDOFF.md
PROJECT_BRIEF.md
BUILD_PLAN.md
VALIDATION_MATRIX.md
README_PHASE6_DRAFT.md
docs/PHASE6_PRODUCT_REQUIREMENTS.md
docs/PHASE6_ARCHITECTURE_AND_TRUST_MODEL.md
docs/PHASE6_REVIEW_ENVELOPE_CONTRACT.md
docs/PHASE6_UX_INFORMATION_ARCHITECTURE.md
docs/PHASE6_THREAT_MODEL.md
docs/PHASE6_REQUIREMENTS_TRACEABILITY.md
docs/PHASE6_AUTHENTICITY_DESIGN.md
docs/PHASE6_DECISION_LOG_SEED.md
docs/decision-log.md
~~~

No production module, test, dependency, artifact, or third_party file belongs in the diff.

## 16. Unresolved decisions

- P0: none.
- P1 implementation conditions: exact captured-result refactor API; strict model implementation;
  profile/threshold projection registry; lazy CLI imports; cache mutation checks; Streamlit harness.
  These are specified decisions, not design blockers.
- P2 future: signer persona, trust-policy owner, and key custody for a separately authorized
  authenticity phase.

## 17. Git status and commit

~~~
branch: feat/phase6-evidence-workbench
commit: 27cc5a08931cc1d659128bfebd0bd1ca7e9aefee
status: 14 modified documentation files plus untracked PHASE6_DESIGN_FREEZE_HANDOFF.md
local commit: none
remote action: none
~~~

## 18. Exact next action

Under the controlling request, continue automatically:

~~~
Run prompts/02_IMPLEMENT_PHASE6.md
~~~
