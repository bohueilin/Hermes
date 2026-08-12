# Hermes repository instructions

These instructions apply to every Codex task in this repository. Read them before planning or editing.

## Canonical identity

- Product and repository display name: `Hermes`.
- Intended GitHub repository: `bohueilin/Hermes`.
- Local repository root: `/Users/bohueilin/Documents/GitHub/Hermes`.
- Python distribution: `hermes-autonomy`.
- Python import package: `hermes`.
- Console command: `hermes`.
- Module commands: `python -m hermes` and `python -m hermes.cli`.
- Generated evidence root: `artifacts/`.
- External simulator checkout: `third_party/metadrive/`.

Do not rename these surfaces or reintroduce a former project name unless the user explicitly changes the product identity.

## Validated baseline

The unattended build plan assumes this starting point:

- Baseline branch: `main`.
- Baseline commit: `c181509a691b132cb732a50c24612f6bd40bafca`.
- Phase 0 environment doctor is implemented.
- Existing test baseline: 26 tests passing.
- Existing Ruff baseline: clean.
- Conda environment: `hermes-dev`.
- Python: 3.11.15.
- MetaDrive: 0.4.3.
- Recorded MetaDrive commit: `85e5dadc6c7436d324348f6e3d8f8e680c06b4db`.
- MetaDrive headless and offscreen verification have passed on the development machine.

At task start, verify the current repository and environment rather than assuming the baseline still holds. If the repository has advanced, preserve valid newer work and reconcile this plan with the actual code.

## Instruction precedence

Use this precedence order:

1. Explicit instructions in the current user prompt.
2. This `AGENTS.md`.
3. `MASTER_PROMPT.md` for the current unattended run.
4. `BUILD_PLAN.md` and phase-specific design documents.
5. Existing code, tests, and documented behavior.

When two instructions conflict, follow the higher-precedence instruction, document the conflict in `docs/decision-log.md`, and continue all independent work.

## Product thesis

> Autonomy policy proposes → environment executes → verifiers evaluate → gate decides → trace proves.

Hermes is a simulation-only scenario-to-evidence control plane. Its value is not merely moving a simulated car; its value is producing reproducible, independently reviewable evidence about what was attempted, what actually executed, what happened, which requirements held or failed, and why a policy version should advance or be held.

## Non-negotiable safety boundary

- Simulation and closed-lab learning only.
- Never connect Hermes to a road vehicle, public-road actuator, remote-control channel, vehicle CAN bus, or safety-critical production system.
- Never claim road readiness, production safety, SAE automation level, certification, regulatory approval, or compliance.
- Prototype thresholds must be stored in versioned configuration and labeled illustrative.
- An LLM may generate scenario drafts, tests, explanations, and documentation. It must never operate inside the real-time vehicle-control loop.
- Do not add code that can send control commands to physical hardware.

## Unattended execution protocol

The user may be unavailable for an extended period. Work autonomously within the repository and these constraints.

### Do

- Inspect before editing.
- Make reasonable, conservative assumptions when ambiguity is non-material.
- Record material assumptions and trade-offs in `docs/decision-log.md`.
- Execute code, tests, and demonstrations; do not stop after writing a plan.
- Work in priority order and enforce phase acceptance gates.
- Continue independent work when one optional item is blocked.
- Create `CODEX_HANDOFF.md` before finishing.
- Leave the repository in a reviewable state with truthful test results.
- Use subagents for independent review or test design when available; continue sequentially if delegation is unavailable.

### Do not

- Ask the user routine implementation questions.
- Wait for clarification when a safe, reversible default exists.
- Skip a failed gate to reach a later visual demo.
- fabricate command output, metrics, artifacts, hashes, screenshots, or pass results.
- overwrite an existing artifact directory.
- use `git reset --hard`, `git clean -fd`, force push, history rewriting, or destructive filesystem commands.
- push, publish, deploy, create a pull request, modify remotes, purchase services, or change external infrastructure.
- inspect or transmit credentials, tokens, cookies, SSH keys, or unrelated personal files.

### Hard-stop conditions

Stop the affected operation and document the blocker when it would require:

- destructive or irreversible action;
- access outside the repository or declared simulator checkout;
- credentials or secrets;
- remote publication or deployment;
- real-vehicle or public-road integration;
- a safety claim not supported by the evidence;
- bypassing a failed hard invariant or evidence-integrity check.

Continue all other safe, independent work.

## Priority order for the unattended build

1. **P0 — Phase 1 evidence core:** deterministic fake simulator, contracts, trace, artifacts, verifiers, release gate, CLI, tamper tests, determinism tests, documentation.
2. **P1 — Phase 2 MetaDrive adapter:** one bounded headless nominal run through the same contracts and evidence pipeline.
3. **P2 — Phase 3 safety shield and challenge scenarios:** deterministic runtime shield, lead-vehicle braking and cut-in scenarios, candidate/executed action comparison.
4. **P3 — Hardening:** fault injection, comparison tooling, CI, and additional documentation.
5. **Deferred:** dashboard, RL, CARLA, ROS 2, Autoware, hardware-in-the-loop, and real-log pipelines.

Never begin P1 until every P0 acceptance gate is green. Never begin P2 until every P1 acceptance gate is green.

## Architecture rules

- Keep domain contracts simulator-neutral.
- Simulator-specific code belongs under `src/hermes/adapters/` or `src/hermes/simulators/`.
- Domain models, evidence serialization, verifiers, gate logic, and artifact verification must not import MetaDrive.
- The release gate consumes structured findings, not simulator objects.
- Artifact verification must not rerun a simulator.
- The CLI is a thin composition layer; business logic belongs in testable modules.
- Candidate and executed actions are always distinct fields, even when identical.
- A safety shield must return explicit reason codes for every override.
- Missing evidence must be represented as `NOT_AVAILABLE` with a reason, never as zero or success.
- Use strict schemas that reject unknown fields.
- Use deterministic seeds and bounded episode horizons.

## Evidence and integrity rules

Each completed run must preserve, at minimum:

```text
artifacts/<run-id>/
  manifest.json
  scenario.resolved.yaml
  gate-config.resolved.yaml
  events.jsonl
  metrics.json
  verdict.json
  trace.sha256
```

- Use canonical JSON and SHA-256 for deterministic event chaining.
- Do not use Python object hashes.
- Separate deterministic trace content from wall-clock metadata.
- Record repository commit, dirty state, adapter version, simulator revision when applicable, scenario digest, policy version, shield version, gate-config digest, Python version, platform, seed, and evidence schema version.
- A missing, malformed, incomplete, or inconsistent bundle must produce `INVALID_EVIDENCE`.
- Collision and hard boundary violations must force `HOLD`; aggregate scores may not compensate for them.
- Local hashing is tamper-evident, not independently authenticated. State this limitation explicitly.

## MetaDrive rules

- Treat `third_party/metadrive` as an external dependency; do not modify it.
- Before using any API or configuration key, inspect the installed MetaDrive 0.4.3 source, examples, and `MetaDriveEnv.default_config()`.
- Do not invent configuration keys or assume examples from a different release are compatible.
- Keep the imported source commit consistent with `SIMULATOR_COMMIT`.
- Run MetaDrive headless for automated tests. Offscreen rendering is optional and must not become a gate for core evidence behavior.
- If an intended maneuver cannot be reproduced reliably, implement the closest supported deterministic scenario and document the limitation rather than fabricating an event.

## Python and dependency rules

- Target Python 3.11.
- Prefer the active `hermes-dev` environment. If shell activation is unavailable, use `conda run -n hermes-dev`.
- Add dependencies to `pyproject.toml` with bounded major versions and a clear justification.
- Keep runtime dependencies minimal.
- Do not install into Conda `base`.
- No network calls or telemetry in Hermes runtime code.

## Tests and validation

Run the narrowest relevant tests during implementation, then run the full gates before a phase is declared complete:

```bash
python -m pip install -e ".[dev]"
python -m pytest -q
python -m ruff check .
python -m hermes doctor
git diff --check
```

For Phase 1, also run the nominal, collision, boundary, conditional, verification, tamper, and repeated-seed demonstrations defined in `MASTER_PROMPT.md`.

For Phase 2 and later, run the documented bounded MetaDrive smoke command and independently verify its stored artifact.

A phase is not complete unless:

- the requested behavior works from a documented command;
- all existing and new tests pass;
- a negative or failure path is tested;
- generated evidence can be verified without simulator rerun;
- documentation and requirements traceability are updated;
- known limitations and residual risks are explicit.

## Git discipline

- Work on a feature branch, not directly on `main`.
- Local checkpoint commits are allowed only after the relevant phase gates pass.
- Recommended commits:
  - `docs: define unattended Hermes build plan`
  - `feat: add deterministic evidence core`
  - `feat: add MetaDrive headless adapter`
  - `feat: add safety shield and challenge scenarios`
  - `docs: add demo runbook and handoff`
- Never push or create a pull request.
- Do not stage generated artifacts, simulator assets, caches, virtual environments, or package metadata.
- Before each commit, inspect `git status --short`, `git diff --cached --check`, and `git diff --cached --stat`.

## Required handoff

Before the final response, create or update `CODEX_HANDOFF.md` with:

- executive summary;
- branch and HEAD commit;
- phases attempted and completed;
- architecture and key decisions;
- files changed;
- dependencies added;
- exact commands run and actual results;
- demonstration artifact paths and verdicts;
- trace digests where applicable;
- known failures, blockers, and limitations;
- Git status;
- the single best next command for the user.

The final response must distinguish observed results from assumptions and planned follow-up.
