# Regional power N0 + N1 implementation plan

**Goal:** Test existing redistribution versus deadline/aged charging under identical synthetic Austin-inspired conditions.

**Architecture:** A pinned region package adapts a small explicit graph to the existing minute-resolution Fleet day engine. A separately versioned site-power profile supplies only current usable capacity to existing allocation policies. The current paired evaluator, completion primary, guardrails and metric definitions remain authoritative. A compact Fleet day sub-view exposes exact settings, recorded power, service populations and unfinished work.

**Stack:** Existing native JavaScript modules, DOM helpers, Node tests, static/offline packer. No dependencies or backend.

**Spec:** Owner's `FleetLab_Regional_Simulation_Design_and_Codex_Brief_09-24.md`, sections 7–8. Only N0 + N1 is implemented.

## Decisions and baseline

- Request: “read and build, go”. This explicitly authorizes implementation of the recommended first slice; embedded document prompts to stop for approval are proposal content. No remote action is authorized.
- Entry checkout: `Hermes-fleetlab`, `feat/phase9-metric-contract`, `9daacef`; no website. Owner's untracked review file preserved.
- Actual released application: `96fde5b`; local documentation successor `4b7a276` in `Hermes-depot-m1`. The older `Hermes-playground` worktree is at `6b376fb`. New local branch `codex/fleetlab-regional-power` starts at `4b7a276` inside the existing FleetLab worktree. No other worktree changes.
- Phase 6 instructions remain binding for protected evidence/workbench paths. This is a website teaching-model extension, not execution of a Phase 6 prompt; none of those paths will change.
- `bay-operations.js` owns lifecycle, demand and energy; `bay-systems.js` owns per-interval allocation and accounting; `charging-allocation.js` owns existing pure proposals; `bay-experiment-contract.js` owns pairing and compatibility; `setup-codec.js` owns strict sharing.
- Confirmed repository/documentation drift: the named website branch/worktree is older than the supplied release. No confirmed simulator defect at design time. Street literal-null is unrelated; reproduce before any proposed fix.
- Prefer an independent panel within Fleet day over replacing Bay controls or creating a fourth numerical engine. Region references are immutable, synthetic and fixed to one graph. The original regional workspace remains a separate model.

## Contracts

- Graph coordinates: local meters in the package, converted explicitly to kilometers at the adapter. Paths traverse declared graph edges; no fallback straight-line road or renamed Bay route. Two fixed fictional depots reuse `depot-1` and `depot-2` resource identities.
- Condition: contiguous half-open integer-minute segments covering `[0,H)`, each fraction in `[0,1]`, at most 48 segments. One named site; all other sites retain configured nominal battery-side power. Apply at `t` before allocation over `[t,t+1)`. The terminal frame consumes no energy.
- Policies receive jobs, current cap, current minute and starvation bound, never the future profile. Connected zero-power vehicles retain reservations under existing resource semantics.
- Defaults have no new fields. Opt-in versions distinguish the graph/profile/diagnostics. Constant full-power opt-in preserves existing numerical metrics, request/visit outcomes and energy.
- Existing whole-run completion primary and guardrails remain unchanged. All-request within-target pickup is unavailable in N1; do not infer it from completed-only means or import launch metric semantics.
- Setup links contain complete region/profile/config/options and reject unknown versions, gaps, overlaps, unrecognized sites and unsupported cross-model combinations. Load never executes.
- Scope `SIMULATION_ONLY`, browser result `NOT_EVIDENCE`, deployment permission `NONE`; no calibration, heat physics, data acquisition, new optimizer, launch coupling or publication.

## Implementation steps

- [x] Add failing model tests for graph identity/routing, strict profile validation, boundary time, constant-cap parity, conservation, no-effect, overcommit, unfinished work, pair equality and null treatment.
- [x] Add region/profile modules and connect the existing engine and paired compatibility paths. Retain exact configuration, graph provenance, cap/delivery trace and terminal task records.
- [x] Add strict codec tests and extend setup sharing with `regional-power`, preserving existing envelope bytes/versions for old setups.
- [x] Add UI tests and the Fleet day panel: explicit run, condition control, paired run/cancel, schematic, recorded-minute inspection, exact exports, stale-input disclosure and current/last-run sharing.
- [x] Run full Node suite; scoped Python parity/boundary and full Python gates with explicit checkout imports; package static and offline under existing budgets; perform actual browser inspection and timing measurements.
- [x] Run an untuned four-condition sweep on 12 fixed held-out seeds; document actual mixed/negative outcomes, review independently, update source of truth and handoff. No commit unless all required gates permit it; no push/merge/deploy.

## Review focus

1. Condition boundary and terminal observation cannot add an extra interval of energy.
2. Unknown or incomplete settings reject rather than silently selecting Bay topology.
3. Edited controls cannot relabel old results or cause shared setups to execute.
4. Offline size, security policy and all 56 old lesson routes must remain supported.
5. Valid adverse policy outcomes and rejected proposals remain separate from invalid simulator accounting.

## Execution ledger

- Design inspected and frozen in this file before production edits. Implementation proceeds under the user's explicit build instruction. Historical evidence fixtures will not be regenerated; existing wider Python failures will be reported separately.

- Completed model, codec and UI tests using observed red → green cycles. Initial integration caught an import cycle, a protected Python label collision and the shared-envelope/raw-input distinction; fixed without relaxing checks.
- Ruling: browser scope copy uses “Simulation only”/`simulation-only`, preserving the existing explicit prohibition on Python decision-record labels in the playground. Semantic scope is unchanged; no evidence promotion.
- Ruling: paired exports bind the graph digest and source version in the frozen spec and include complete region provenance once. Existing nonregional spec shapes remain unchanged.
- Ruling: generated-record writer lives in `tools/fleet_playground/`, preserving browser-tree file-write prohibitions. It uses the same producer/instrument as the UI.
- Independent review: fixed both P2 findings (condition changes after a short-horizon shared setup; absent paired-export provenance) and the adjacent minor (canonical setup preset recognition). Tests failed before each fix and pass afterward.
- Review exclusions: real-world calibration/safety and adequacy of 12 seeds remain unclaimed; human usefulness remains unmeasured. Coordinator separately ran browser/package/lesson suites and disclosed Python failures and timing sensitivity.
- Ruling: keep synchronous arms with yields between them. Default measured shift 48.4 ms, comparison 603.7 ms with no >50 ms tasks; maximum tested 120-vehicle arms had 62–83 ms tasks. Cancellation is bounded by one arm. No worker migration in this bounded slice; revisit if a lower latency budget is required.
- Standard Node 1,779 passed; 89 scoped Python passed; Ruff/package checks passed. Full Python retained-fixture gate remains non-green. No commits or remote actions; see source of truth and CODEX handoff for actual commands and artifacts.

## Publication authorization — 2026-09-25

The owner subsequently requested “deploy and push to github” and a draft of the next design
phase, after the local handoff disclosed the broader Python fixture failures. This supersedes
the earlier local-only/no-push instructions for this website release. Use the established
Cloudflare Pages project `fleetlab-playground` and GitHub website branch
`feat/fleetlab-playground`, with a normal fast-forward push from the current feature branch.
Publish only the checked static package. Keep `main`, other worktrees, Python evidence
contracts, generated records and the owner's untracked review outside the change.

Release acceptance is scoped to the website: the complete Node suite with optional performance
checks, Python website parity/boundaries, Ruff, package budgets/security checks and hosted
readback. The retained broader Python failures are not waived as repository correctness;
this release does not claim a green full repository or main-integration readiness. Record
exact source/deployment identities and negative results in the existing source of truth and
handoff. The requested next-phase document is a draft; it grants no implementation authority.
