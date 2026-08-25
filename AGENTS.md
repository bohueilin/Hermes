# Hermes repository instructions — Phase 6

These instructions apply to every Codex task in this repository. Read them before planning or editing.

## 1. Canonical identity

- Product and repository display name: `Hermes`.
- Intended GitHub repository: `bohueilin/Hermes`.
- Local repository root: `/Users/bohueilin/Documents/GitHub/Hermes`.
- Python distribution: `hermes-autonomy`.
- Python import package: `hermes`.
- Console command: `hermes`.
- Module commands: `python -m hermes` and `python -m hermes.cli`.
- Generated evidence root: `artifacts/`.
- External simulator checkout: `third_party/metadrive/`.
- Conda environment: `hermes-dev`.
- Python target: 3.11.

Do not rename these surfaces unless the user explicitly changes the product identity.

## 2. Current validated baseline

The Phase 6 pack was prepared from this observed state:

- Branch: `feat/unattended-evidence-core`.
- Final local HEAD at design review: `9e257a0cf0ddbdbf601b8a01deebe4de52de9763`.
- Working tree: clean.
- Tests: 273 passing.
- Ruff: passing.
- Doctor: 18 PASS, 1 optional NOT_AVAILABLE, no WARN or FAIL.
- MetaDrive: 0.4.3.
- MetaDrive source commit: `85e5dadc6c7436d324348f6e3d8f8e680c06b4db`.
- Phases 0–5: locally complete.
- No remote action occurred.

At task start, inspect actual branch, commit, working tree, tests, package version, artifacts, and documentation. Preserve valid newer work. Never reset the repository to the historical baseline merely because it is listed here.

## 3. Instruction precedence

Use this order:

1. Explicit current user instruction.
2. This `AGENTS.md`.
3. The specific prompt being executed under `prompts/` or `MASTER_PROMPT.md`.
4. `BUILD_PLAN.md`, `PROJECT_BRIEF.md`, `VALIDATION_MATRIX.md`, and Phase 6 design documents.
5. Existing code, tests, and documented behavior.

When instructions conflict, follow the higher-precedence instruction, record the conflict in the decision log, and continue all unaffected work.

## 4. Product thesis and precise meaning

> Autonomy policy proposes → environment executes → verifiers evaluate → gate decides → trace proves.

For current Hermes, “trace proves” has a narrow meaning:

> The stored trace supports a reproducible and internally consistent Hermes decision under the installed verifier and gate implementation.

It does **not** prove:

- independent authenticity;
- that runtime facts were not fabricated by the producer;
- real-world vehicle safety;
- certification or compliance;
- authorization to promote software;
- permission to deploy to physical hardware.

## 5. Non-negotiable safety and product boundary

- Simulation and closed-lab learning only.
- Never connect Hermes to a road vehicle, CAN bus, automotive Ethernet, public-road actuator, remote-control channel, or production safety-critical system.
- Never claim SAE automation level, road readiness, production safety, certification, compliance, regulatory approval, or deployment permission.
- Prototype thresholds are illustrative and versioned.
- An LLM may generate scenarios, tests, explanations, and documentation. It must never enter a real-time control loop.
- Phase 6 is local-only and read-only.

## 6. Canonical Phase 5 evidence contract

Unless current code inspection proves otherwise, a completed bundle contains:

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

Reconcile older documents that list only seven files. Do not create a second bundle contract for the workbench.

## 7. Phase 6 objective

Build a reviewer-oriented local Evidence Review Workbench that answers:

1. What was tested?
2. What happened?
3. What did the policy propose, the shield permit, and the simulator execute?
4. Which findings passed, failed, warned, or lacked evidence?
5. Why did the gate issue its verdict?
6. Is the bundle internally consistent?
7. Is the bundle authenticated?
8. What does this result not establish?
9. How does a compatible candidate differ from its baseline?

## 8. Phase 6 trust-state contract

Always separate:

- **Gate verdict:** `PASS`, `CONDITIONAL`, `HOLD`, or `INVALID_EVIDENCE`.
- **Integrity:** `INTERNALLY_CONSISTENT`, `INVALID_EVIDENCE`, or transient `UNVERIFIED`.
- **Authenticity:** `NOT_AUTHENTICATED` in Phase 6.
- **Authorization:** `NOT_EVALUATED` in Phase 6.
- **Deployment permission:** `NONE` in Phase 6.
- **Scope:** `SIMULATION_ONLY`.

Never compress these into a generic “trusted,” “approved,” or green state.

## 9. Phase 6 evidence categories

Every displayed item must be classified as one of:

- `OBSERVED`
- `COMPUTED`
- `GATE_DECISION`
- `ASSUMPTION`
- `NOT_AVAILABLE`
- `AUTHENTICITY`
- `RESIDUAL_RISK`

Do not rely on color alone. Do not represent missing evidence as zero, false, empty text, or success.

## 10. One-way architecture rules

The required dependency direction is:

```text
Untrusted artifact directory
→ immutable no-follow snapshot
→ existing stored verification/compare core
→ immutable ReviewEnvelope/ComparisonEnvelope
→ presentation projection
→ local read-only UI
```

Hard rules:

- UI code must not implement gate logic.
- UI code must not implement verifier logic.
- UI code must not directly parse artifact files after the verification facade has captured them.
- UI code must not import simulator adapters, policies, shields, faults, gates, or verifier implementations.
- Artifact verification must not rerun a simulator.
- Comparison must use the existing comparison compatibility and delta logic.
- The CLI and UI must consume the same review facade.
- No artifact writes, edits, normalization, migration, or repair are permitted.
- No scenario launch, policy execution, simulator launch, threshold editing, approval, promotion, or release action is permitted.
- Cache keys must include bundle digest and Hermes review-schema/tool version.
- Any artifact mutation invalidates the review session.

## 11. Framework rule

The review core must be framework-independent.

The design freeze must select and record the UI framework. The default implementation choice is a local Streamlit workbench installed under an optional `workbench` dependency extra, but Codex may choose a server-rendered local alternative only when it documents a material testability or trust-boundary advantage.

Regardless of framework:

- bind to loopback only;
- reject public bind addresses in Phase 6;
- do not add telemetry;
- do not add cloud services, authentication accounts, databases, uploads, or remote artifact ingestion;
- escape all artifact-derived text;
- no raw HTML from evidence content.

## 12. Design-first gating

### Stage 1 — design freeze

When executing `MASTER_PROMPT.md` or `prompts/01_DESIGN_FREEZE.md`:

- inspect code and tests;
- reconcile canonical contracts;
- update Phase 6 documents;
- add no production implementation;
- stop with `PHASE6_DESIGN_FREEZE_HANDOFF.md`.

### Stage 2 — implementation

Only execute `prompts/02_IMPLEMENT_PHASE6.md` after explicit user approval of the design freeze.

### Stage 3 — adversarial review

Use a separate chat and `prompts/03_ADVERSARIAL_REVIEW.md` after implementation.

## 13. Security and artifact handling

- Treat artifact content and paths as untrusted.
- Use existing no-follow, directory-relative capture rather than reopening files ad hoc.
- Enforce path containment under an explicitly selected artifact root.
- Reject symlink escape, traversal, mutation during capture, mixed schema, malformed events, duplicate/reordered sequences, and unsupported versions.
- Bound file size, event count, and parsing resources using documented defaults derived from current artifacts with safety margin.
- Never auto-select an artifact merely because it is newest.
- Show exact run ID, path relative to allowed root, bundle digest, trace digest, creation time, Git commit, and verification state.
- If verification fails, quarantine the stored verdict and findings. Do not display a stored `PASS` as accepted evidence.

## 14. Numeric and presentation integrity

For each metric or finding, preserve:

- exact stored or recomputed machine value;
- display value;
- unit;
- threshold;
- comparison operator;
- verifier name and version;
- supporting event sequences;
- evidence availability;
- gate consequence.

Rounding must never change the apparent side of a threshold. The UI may format values, but it must provide exact details on inspection.

## 15. Evidence sufficiency

The review core, not the UI, must expose which evidence was:

- required and available;
- required but unavailable;
- optional and available;
- optional and unavailable;
- not applicable.

Do not change existing gate semantics implicitly. If current core APIs do not expose requiredness cleanly, design a versioned core-level representation and test it before the UI consumes it.

## 16. Comparison integrity

- Independently verify both artifacts before comparison.
- Fail closed for incompatible evidence.
- Never render comparison charts after incompatibility.
- Show improvements, regressions, unchanged outcomes, and evidence-availability deltas separately.
- Do not compute a UI-specific winner score.
- Intervention count is descriptive, not ordinal.
- A better TTC with worse mission/comfort and unchanged verdict must be shown as a mixed trade-off.

## 17. Authenticity boundary

All current Phase 6 evidence is `NOT_AUTHENTICATED`.

Do not implement signing during the workbench wave unless the user explicitly authorizes a separate authenticity phase. A future design may use a detached Ed25519 signature over a canonical attestation, but signature validity must remain separate from integrity, authorization, policy advancement, and deployment permission.

## 18. Testing and validation

Run focused tests during work, then full gates:

```bash
python -m pip install -e ".[dev]"
python -m pytest -q
python -m ruff check .
python -m hermes doctor
git diff --check
```

When the workbench optional extra exists:

```bash
python -m pip install -e ".[dev,workbench]"
```

Required Phase 6 categories include:

- review-envelope schema and determinism;
- CLI/UI parity;
- artifact immutability;
- stale cache and TOCTOU;
- XSS escaping;
- path containment and symlink rejection;
- invalid artifact quarantine;
- unavailable evidence display;
- exact threshold presentation;
- comparison incompatibility;
- dependency-boundary AST tests;
- local-only bind behavior;
- existing 273-test regression coverage or current equivalent.

## 19. Git discipline

- Work on `feat/phase6-evidence-workbench` or another explicitly approved Phase 6 feature branch.
- Never push, create a pull request, modify remotes, deploy, or publish.
- Never use force, hard reset, destructive clean, or history rewriting.
- Local commits are allowed only after documented gates pass.
- Do not stage generated artifacts, caches, virtual environments, simulator assets, workbench cache, or package metadata.
- Review `git status --short`, `git diff --cached --check`, and `git diff --cached --stat` before each commit.

Suggested checkpoints:

```text
docs: freeze Phase 6 review contracts
feat: add immutable evidence review facade
feat: add local read-only evidence workbench
test: harden workbench trust boundaries
docs: finalize Phase 6 validation and handoff
```

## 20. Hard stop conditions

Stop the affected implementation and document the blocker if:

- UI requires artifact mutation;
- UI must implement a second gate or verifier;
- CLI and UI verdicts diverge;
- invalid evidence can display an accepted `PASS`;
- authenticity is implied without a valid signature;
- workbench requires simulator or policy execution;
- immutable digest-bound capture cannot be maintained;
- canonical bundle inventory cannot be reconciled;
- a public/multi-user deployment is required;
- scope expands to RL, CARLA, ROS, Autoware, cloud, or physical hardware;
- gate verdict cannot be separated from deployment permission.

Continue all other safe, independent work.

## 21. Required handoffs

### Design freeze

Create `PHASE6_DESIGN_FREEZE_HANDOFF.md` containing:

- repository snapshot;
- inspected modules and contracts;
- canonical bundle decision;
- framework decision;
- review schema decision;
- trust-state decision;
- dependency rules;
- unresolved questions;
- acceptance results;
- exact recommendation to proceed or hold.

### Implementation

Create/update `CODEX_HANDOFF.md` using `CODEX_HANDOFF_TEMPLATE.md` and include actual commands, tests, review envelopes, artifact digests, negative results, Git state, and limitations.
