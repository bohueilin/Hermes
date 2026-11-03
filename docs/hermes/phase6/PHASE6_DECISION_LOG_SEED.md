# Hermes Phase 6 Frozen Decision Register

Status: design-frozen on 2026-08-12 for Stage 6B implementation. No unresolved P0 decision.

| ID | Frozen decision | Repository evidence / rationale |
|---|---|---|
| D6-001 | Build a local, read-only Evidence Review Workbench before new scenarios or learned policy work. | Retained artifacts already cover all gate classes, simulator evidence, faults, and mixed comparisons; reviewer comprehension is the missing product surface. |
| D6-002 | One-way consumer only; no second evidence authority. | inspect_artifact and compare_artifacts already own stored verification, compatibility, and deltas. |
| D6-003 | Canonical bundle is exactly REQUIRED_ARTIFACT_FILES: ten files in exported order. | evidence.artifacts writes it and verification requires exact inventory. |
| D6-004 | ReviewEnvelope and ComparisonEnvelope version exactly 1.0, strict, immutable, portable, canonical JSON. | Aligns existing frozen Pydantic/canonical JSON patterns. Generated time and absolute path are excluded. |
| D6-005 | Capture inventory plus observed/computed bundle roots derive from the same captured bytes; no reopen. | Current descriptor-safe double-read capture is sound but ArtifactInspection does not retain these fields. |
| D6-006 | Map core IntegrityStatus.INVALID to portable INVALID_EVIDENCE; do not rename the core enum. | Preserves Phase 1–5 compatibility while using the Phase 6 vocabulary. |
| D6-007 | Trust fields are independent: gate; integrity; NOT_AUTHENTICATED; NOT_EVALUATED; NONE; SIMULATION_ONLY; NOT_DEFINED authority. | Prevents PASS/internal consistency from implying authentication or permission. |
| D6-008 | Every display item uses one exact evidence category from AGENTS.md. | Prevents unlabeled inference and makes missing/residual evidence explicit. |
| D6-009 | Requiredness is core-owned by verifier profiles legacy 1.0 and fault_coverage 1.0. Hard findings are REQUIRED, soft comfort findings OPTIONAL, and fault coverage NOT_APPLICABLE for legacy. | EXPECTED_FINDINGS_BY_PROFILE already fixes membership and hard/soft identity; Stage 2 exposes it without changing gate behavior. |
| D6-010 | Finding thresholds are structured core projection metadata derived from verified gate/scenario config; compound predicates supported. UI never parses strings or decides pass/fail. | Current Finding stores an audit string only; boundary/progress criteria are compound. |
| D6-011 | Schema 1 separately permitted action and raw/delivered/result observations are NOT_AVAILABLE, never inferred. Schema 2 exposes the separated fields. | TraceEvent versus TraceEventV2 models. |
| D6-012 | Framework is Streamlit >=1.37,<2 under optional workbench extra, added only in Stage 2. | Fastest demo path with table/chart/accessibility support; review core remains independent and render logic is envelope-only. |
| D6-013 | Rejected framework alternatives are custom stdlib server-rendered UI and static report generation. | Stdlib server reduces dependency weight but adds routing/escaping/state code; static report improves audit portability but weakens interactive drill-down and stale-session handling. Neither has a material trust-boundary advantage. |
| D6-014 | Planned packages are review/{__init__,models,facade,projection}.py and workbench/{__init__,app,launcher}.py. | Small boundaries; no duplicate services or view-file sprawl required for the smallest useful release. |
| D6-015 | CLI uses lazy run-only imports; review processes do not import adapters, policies, shields, faults, runtime, or MetaDrive. UI imports public hermes.review only. | Current CLI imports runtime eagerly; existing AST architecture pattern can enforce the corrected boundary. |
| D6-016 | Numeric loopback literals only, parsed by ipaddress. Accept loopback 127/8 and ::1; reject wildcard, hostname, LAN, link-local, and public addresses. | Enforceable local-only boundary without DNS ambiguity. |
| D6-017 | Telemetry false; no external assets/API, upload, database, accounts, remote ingestion, or cloud. | Phase 6 is single-user and local-only. |
| D6-018 | Existing verifier alone enforces 16 MiB/file, 64 MiB total, 10,000 events, and 1 MiB/line. Review passes no stricter artifact limits. | Review must not redefine integrity. |
| D6-019 | Operational envelope budgets are 64 findings, 64 metrics, depth 16, and 1,024 projection display scalars. Unsupported core-valid shape returns REVIEW_UNAVAILABLE / UNSUPPORTED_REVIEW_SHAPE / 40 with no envelope and unchanged gate/integrity. Timeline retains all core-valid events. | Separates review availability from evidence validity. |
| D6-020 | Only an INTERNALLY_CONSISTENT envelope with non-null computed bundle digest is cacheable; every INVALID_EVIDENCE or partial/null-digest result is not. Cache key is computed bundle digest + review schema 1.0 + Hermes version + selected relative path. Before every cached render, perform full containment/capture/verification. Metadata is private; identical bytes at the same path remain deterministic. | Prevents stale or invalid review reuse and preserves the required displayed relative locator. |
| D6-021 | New review-artifact/review-compare support text/json. Valid PASS/CONDITIONAL/HOLD review exits 0; invalid 30; path/config/operational/incompatible 40. Legacy exits remain unchanged. | Review-operation success differs from policy verdict; compatibility with existing commands is preserved. |
| D6-022 | Comparison calls compare_artifacts only; no winner score. NOT_COMPARABLE remains descriptive and availability deltas are separate. Incompatibility has no delta/chart payload. | Existing comparison already reports mixed direction and descriptive intervention changes. |
| D6-023 | Streamlit content uses safe text APIs only; no unsafe HTML. | Artifact strings are untrusted. |
| D6-024 | All current evidence remains NOT_AUTHENTICATED. Detached Ed25519 attestation is future design only. | SHA-256 detects partial tampering but cannot authenticate a coherent producer. |
| D6-025 | Design recommendation is CONDITIONAL GO with no unresolved P0. Conditions are implementation and regression gates. | All architecture decisions required to implement are frozen; proof awaits Stage 2 tests. |
| D6-026 | The controlling user request says “Perform four internal stages in this one chat,” “Do not wait for human approval between stages unless a genuine unresolved P0 blocker...,” and after GO/CONDITIONAL GO, “continue automatically to Stage 6B.” | This explicit current instruction overrides the generic AGENTS separate-approval gate under repository precedence. |

## Framework evaluation

Scores use 1 poor, 3 adequate, 5 strongest for the constrained Phase 6 release.

| Option | Setup simplicity | Dependency weight | Core/browser testability | Escaping/XSS security | Read-only enforcement | Loopback launch control | Tables/timeline/accessibility support | Decision |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Streamlit >=1.37,<2 optional extra | 5 | 3 | 4 | 4 with safe APIs/no raw HTML | 4 | 4 via validated launcher/config | 5 | Selected |
| Custom stdlib server-rendered | 2 | 5 | 3 | 2; bespoke escaping/templates | 4 | 5 | 2 | Rejected: security/support code outweighs dependency savings |
| Static local report | 4 | 5 | 5 | 4 | 5 | 1; no interactive local server | 2 | Rejected: insufficient interactive drill-down/session invalidation |

## Required non-claims

- Hermes PASS is only a prototype gate verdict.
- Internal consistency is not authenticity.
- Stored verification does not reexecute policy or simulator.
- Simulation evidence grants no permission for physical systems.
- SHA-256 is tamper-evident, not authenticated.
