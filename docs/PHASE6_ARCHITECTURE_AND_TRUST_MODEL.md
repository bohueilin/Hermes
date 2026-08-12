# Hermes Phase 6 Architecture and Trust Model

## 1. Frozen objective

Add reviewer comprehension without adding a second evidence authority.

> The workbench is a consumer of verified stored evidence. It is not a verifier, gate,
> simulator, policy runtime, artifact editor, approval system, or deployment authority.

## 2. Repository-evidenced starting contracts

| Surface | Observed implementation | Phase 6 implication | Stage 2 change |
|---|---|---|---|
| Bundle | REQUIRED_ARTIFACT_FILES is an ordered ten-file tuple | Reuse exactly; no workbench bundle | None |
| Capture | _read_exact_files uses directory-relative O_NOFOLLOW descriptors, regular-file checks, existing hard ceilings, double reads, metadata comparison, and directory re-enumeration | Review must use captured bytes and must not reopen for assembly | Retain portable inventory/roots plus private CaptureIdentity; do not alter verifier ceilings |
| Verification | inspect_artifact returns ArtifactInspection with ArtifactVerification and a VerifiedArtifactSnapshot only when valid | This remains the stored-verification authority | Add captured inventory and observed/computed roots to the facade result |
| Integrity enum | Core uses INTERNALLY_CONSISTENT or INVALID | Portable envelope maps INVALID to INVALID_EVIDENCE | Mapping only; do not rename core enum |
| Gate | apply_release_gate requires explicit VerifierProfile and recomputes GateResult | UI never applies precedence | Expose versioned requiredness metadata |
| Comparison | compare_artifacts is the only compatibility and delta core | Comparison facade independently verifies both, then calls it | Envelope mapping only |
| Availability | Measurement uses AVAILABLE or NOT_AVAILABLE with a required reason | Missing data stays typed | Add core-owned requiredness/applicability projection |
| Events | Schema 1 has candidate/executed plus summaries; schema 2 adds permitted and raw/delivered/result observations | Do not infer absent schema-1 distinctions | Projection exposes explicit NOT_AVAILABLE tracks |
| CLI | Existing run/verify/compare exits are verdict-oriented and errors use canonical envelopes | New review commands use operation-oriented exits | Add commands without changing legacy commands |
| Imports | AST tests prevent evidence/gates/verifiers from importing adapters or MetaDrive | Extend the architecture test to review/workbench/CLI lazy loading | Tests only plus lazy imports |

Stored verification recomputes deterministic shield and fault transforms, metrics, verifiers, and
gate results. It does not reexecute the candidate policy or simulator dynamics.

## 3. One-way architecture

~~~
Untrusted artifact directory
  -> allowed-root containment
  -> immutable no-follow descriptor snapshot
  -> existing stored verification
  -> existing compare_artifacts when comparing
  -> immutable ReviewEnvelope/ComparisonEnvelope 1.0
  -> presentation projection
  -> local read-only Streamlit UI
~~~

No downstream layer may reopen source files, mutate artifacts, or strengthen a claim made by an
upstream layer.

## 4. Frozen package boundaries

Stage 2 uses exactly:

~~~
src/hermes/review/
  __init__.py
  models.py
  facade.py
  projection.py

src/hermes/workbench/
  __init__.py
  app.py
  launcher.py
~~~

- review.models owns strict immutable ReviewEnvelope/ComparisonEnvelope 1.0 models, review enums,
  source references, thresholds, projection-shape budgets, and serialization.
- review.facade owns root containment, configured capture/verification calls, invalid quarantine,
  evidence sufficiency, comparison orchestration, and cache identity inputs.
- review.projection owns view-ready grouping and display precision without changing semantics.
- review.__init__ exports the only public review APIs used by CLI and UI.
- workbench.launcher validates numeric loopback addresses and starts Streamlit with telemetry off.
- workbench.app renders only public hermes.review objects.

The existing evidence.verification and comparison.compare modules remain authorities. Do not create
artifact_service, source_reference_service, comparison logic, gate logic, or verifier logic in the
UI package.

## 5. Import rules

Allowed:

~~~
workbench -> public hermes.review API + Streamlit + Python standard library
review -> evidence.verification + comparison.compare + domain/gate configuration metadata
CLI review commands -> public hermes.review API
~~~

Forbidden:

~~~
workbench -> hermes.evidence
workbench -> hermes.comparison
workbench -> hermes.gates
workbench -> hermes.verifiers
workbench -> hermes.adapters
workbench -> hermes.policies
workbench -> hermes.shields
workbench -> hermes.faults
review -> hermes.workbench or streamlit
review path -> external metadrive
~~~

The root CLI currently imports runtime, adapters through runtime, shield, comparison, and evidence
modules at module import time. Stage 2 must move run-only imports inside run/sim-smoke handlers and
review-only imports inside review handlers so review command processes do not import adapters,
policies, simulator runtime, or MetaDrive.

An AST test recursively inspects src/hermes/workbench and permits imports whose roots are
hermes.review, streamlit, or the standard library only. A second test rejects streamlit/workbench
imports below src/hermes/review. A process-level import bomb proves review-artifact and
review-compare never import hermes.adapters, hermes.policies, or metadrive.

## 6. Capture, containment, and source-reference policy

The facade accepts an existing allowed artifact root and one exact selected directory. It:

1. rejects a symlink root;
2. resolves the root once;
3. rejects absolute selections, parent traversal, and selections outside the root;
4. opens the selected directory without following links;
5. captures the exact canonical inventory through directory-relative descriptors;
6. computes file digests and the bundle root from captured bytes;
7. invokes stored verification on that same capture;
8. builds all references against that capture.

The current private capture/inspect boundary needs a narrow refactor so the public review facade
receives portable inventory, private CaptureIdentity metadata, observed roots, computed roots, and
the verified snapshot from one call. Existing verifier limits remain unchanged. Mutable byte
dictionaries are never exposed to UI and no second parsing path is created.

Path is a locator, not identity. Manifest run_id and selected directory name are shown separately.
No artifact is auto-selected as newest, official, authoritative, or superseding.

## 7. Resource policy

Existing general verification defaults remain backward compatible:

| Limit | Existing default |
|---|---:|
| Per required file | 16 MiB |
| Total bundle | 64 MiB |
| Events | 10,000 |
| Event line | 1 MiB |

These are the sole artifact-integrity ceilings. Review does not pass stricter capture/parser limits.

Operational projection-shape budgets are at most 64 findings, 64 metric items, generated model
depth 16, and 1,024 displayed Unicode scalars before explicit non-authoritative truncation. They do
not affect integrity or gate. If a core-valid snapshot exceeds a structural envelope budget,
facade returns REVIEW_UNAVAILABLE / UNSUPPORTED_REVIEW_SHAPE, exit 40, emits no portable envelope,
and preserves the core result unchanged. Full values remain in the envelope/source drill-down;
only presentation text may truncate with an explicit marker. Portable timeline retains all
core-valid events through 10,000. UI pagination/filtering is deterministic and always shows total
counts; semantic decimation is forbidden.

## 8. Trust-state model

The following are independent mandatory fields:

| Dimension | Domain or Phase 6 value |
|---|---|
| Gate verdict | PASS, CONDITIONAL, HOLD, INVALID_EVIDENCE |
| Integrity | transient UNVERIFIED; completed INTERNALLY_CONSISTENT or INVALID_EVIDENCE |
| Authenticity | NOT_AUTHENTICATED |
| Authorization | NOT_EVALUATED |
| Deployment permission | NONE |
| Scope | SIMULATION_ONLY |
| Authoritative status | NOT_DEFINED |

Exact interpretation:

- Gate verdict is the installed Hermes gate result for the bounded stored simulation.
- Internally consistent means captured bytes support a reproducible Hermes decision under the
  installed verifier/gate implementation.
- Authenticated would require a separately trusted signature and policy; Phase 6 has none.
- PASS is only a prototype gate verdict. It is not safe, trusted, approved, certified, road-ready,
  deployable, or permission to control physical hardware.
- SHA-256 is tamper-evident against partial change, not authenticated origin.

## 9. Evidence sufficiency

The core owns versioned profile metadata:

- legacy 1.0: hard findings REQUIRED, comfort findings OPTIONAL, fault coverage NOT_APPLICABLE.
- fault_coverage 1.0: hard findings including fault coverage REQUIRED, comfort findings OPTIONAL.

The UI receives the five states required_and_available, required_but_unavailable,
optional_and_available, optional_and_unavailable, and not_applicable. It never infers requiredness
from severity, hard_invariant, name, threshold text, or current availability.

The minimal core change exposes immutable profile specifications adjacent to
EXPECTED_FINDINGS_BY_PROFILE. It does not change existing findings, verdict precedence, or legacy
artifact interpretation.

## 10. Threshold and numeric policy

Finding thresholds are core projection metadata derived from verified gate and scenario
configuration. Structured expressions support compound ALL_OF/ANY_OF predicates. Presentation
does not parse threshold strings, recompute boundaries, or decide pass/fail.

Every metric/finding carries exact machine value, canonical text, display text, unit, threshold
operator/expression where applicable, verifier/version, supporting events, availability,
requiredness, and gate consequence. Rounding cannot alter the apparent side of a threshold.

## 11. Cache and session state

Portable envelope cache key is exactly:

~~~
(computed_bundle_digest_sha256, review schema "1.0", Hermes version, selected_relative_path)
~~~

The cache is in-process only. Before every cached render, the facade repeats allowed-root
containment and full capture/stored verification. Digest mismatch selects a new cache entry and
invalidates the active projection. Metadata changes alone trigger the recapture but do not change
the portable envelope when bytes and relative locator are unchanged.
Only an INTERNALLY_CONSISTENT envelope with a non-null computed bundle digest is cacheable. Every
INVALID_EVIDENCE envelope, including one with a non-null digest from a complete invalid capture,
and every partial/null-digest capture is never cached.

## 12. Framework and local network

Selected framework: Streamlit at optional dependency streamlit>=1.37,<2. The review core imports no
Streamlit code. No production dependency is added during design freeze.

Launcher host input is parsed with ipaddress.ip_address. Only numeric addresses whose is_loopback
is true are accepted, including 127.0.0.0/8 and ::1. Hostnames, wildcard 0.0.0.0 and ::, LAN,
link-local, and public addresses are rejected before process startup.

Streamlit runs with browser.gatherUsageStats false, no external assets, no telemetry, no external
API, no upload, no database, and no remote artifact ingestion. Artifact strings are passed only to
safe text/table/chart APIs; unsafe_allow_html and raw HTML are forbidden.

## 13. Failure behavior

| Failure | Exit | Portable result |
|---|---:|---|
| Valid PASS/CONDITIONAL/HOLD review | 0 | Complete envelope |
| Invalid artifact | 30 | INVALID_EVIDENCE envelope; stored gate/findings/metrics quarantined |
| Invalid plus valid comparison | 30 | Invalid side identified; no comparison claims |
| Path/config/operational error | 40 | Existing canonical CLI error envelope |
| Core-valid unsupported review shape | 40 | REVIEW_UNAVAILABLE / UNSUPPORTED_REVIEW_SHAPE; no portable envelope |
| Incompatible valid artifacts | 40 | ComparisonEnvelope with reasons and no deltas/charts |

Legacy verify-artifact and compare exits do not change.

## 14. Residual limitations

- A coherent producer can rewrite and rehash an entire bundle.
- Candidate policy outputs and simulator results are trace inputs, not reexecuted facts.
- Recorded provenance is not authenticated origin.
- Simulation fidelity and scenario distributions remain limited.
- Same-host deterministic evidence does not establish cross-platform bitwise physics identity.
- No review result grants physical deployment permission.
