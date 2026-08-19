# Phase 7A — Fable Round 1 Review Disposition Ledger

**Review:** Fable 5, 2026-08-18, against HEAD `4e654e3`.
**Disposition by:** Opus 5 (builder), 2026-08-19.
**Rule:** no finding is implemented merely because it was proposed. Each was independently
reproduced or reasoned against the repository before disposition.

**Outcome: 7 P1 · 18 P2 · 8 P3, no P0.** Every P1 reproduced. Two are serious:

- **F-01** is a genuine vulnerability — the review layer executes attacker-chosen shell.
- **F-05** means the Phase 7A headline claim was **causally wrong**, in the very document
  announcing a fix for causally wrong claims.

Fable's verdict — accept the machinery, hold the record and Phase 7B — is correct and accepted.

---

## Independent verification performed before disposition

| Finding | How I checked | Result |
|---|---|---|
| F-01 | Built a scratch repo with `filter.trap.clean`, armed `.git/info/attributes`, made a path stat-dirty, ran the exact hardened argv from `provenance/git.py` | **Filter executed.** `GIT_CONFIG_NOSYSTEM` / `GIT_CONFIG_GLOBAL=/dev/null` do **not** block it — `filter.*.clean` is repo-local config |
| F-01 (fix safety) | `git.py:472-481` `_blob_digest_matches` uses `show <commit>:<path>` | File-at-commit bytes are already compared, so `status` is redundant. Deletion is safe |
| F-05 | Replayed `artifacts/p7-v5-discovery-0000` seq 64–78 | Ego holds **8.000 m/s at brake 0.00** through seq 73, then **brake 1.00** at seq 74. No early braking at all |
| F-05 | `third_party/metadrive/.../idm_policy.py:212` | `MAX_LONG_DIST = 30` confirmed in the pinned checkout |
| F-05 | Arithmetic vs ledgers | Predicted `(30 − 5.1275)/8.0 = 3.109062`; observed min across 65 attempts `3.108394946413832`. **Match to 4 s.f.** |
| F-05 | `target_speed_mps` across all templates/scenarios and `GRID_PARAMETER_SCENARIO_FIELDS` | Fixed at **8.0** everywhere and **not mappable** as a grid parameter — the search could never have varied it |
| F-03 | `grep artifact_locator src/` outside `models.py` | **No hits.** Nothing resolves a non-selected entry's artifacts |
| F-06 | `docs/PHASE7_REQUIREMENTS_TRACEABILITY.md:14` vs handoffs | `IMPLEMENTED` vs `BLOCKED` — contradiction confirmed |
| F-02 | `grep -rn materialize src/hermes/cli.py`; `require_frozen_simulator_identity` callers | No CLI command; **zero production callers** — tests only |

---

## Dispositions

### P1 — all accepted, all implemented this round

| ID | Disposition | Decision |
|---|---|---|
| **F-01** | `ACCEPT` | Delete the `status` operation, `_parse_status_output`, `status_pathspec`, the dead fsmonitor/untrackedCache args, and `status` from `_ALLOWED_OPERATIONS`. Also delete `merge-base` (F-33) — redundant with the sole-parent check. Inspector becomes object-graph-only. Regression test arms a clean filter and asserts no marker and no `status` spawn. |
| **F-02** | `ACCEPT WITH MODIFICATION` | Took Fable's option (b) **plus** a hard disclosure, not (a). The authoring/discovery drivers are committed verbatim under `tools/phase7-authoring/` with a README stating they were repository-external when the evidence of record was produced, that the ledgers were written once rather than appended, and that the tracked tree cannot currently regenerate them. Option (a) — a real `hermes materialize-evaluation-plan` and `hermes discover` — is scheduled as Phase 8 work, not done here: building it now would produce a *second* untested path to evidence generation while the first is still the one that made the record. |
| **F-03** | `ACCEPT` | Verify every discovery-ledger entry whose `artifact_locator` resolves under the artifact root: bundle/trace digests, and recomputation of the selection observation with the assessor's own scanner. Mismatch → `INVALID_PLAN`. Absent artifacts → explicit envelope limitation naming that non-selected observations are unverified, rather than silence. |
| **F-04** | `ACCEPT WITH MODIFICATION` | Governance and disclosure accepted in full. The **rule change** is accepted in Fable's first shape: an LLM may author a successor protocol version only from disclosed prior-version evidence, baseline-informed, frozen before its own runs, with the successor's registration recorded. I did **not** adopt "a human must author successor versions" — that would make the disclosure discipline unenforceable in practice and the real control is the record, not the author. Added: decision-log entry, the 4.0 s value rule stated explicitly, the re-run/by-construction disclosure, and `frozen in advance` → `frozen before any run under this protocol version existed`. |
| **F-05** | `ACCEPT` | The mechanism statement was wrong and is corrected everywhere it appears. "Brakes early enough to preserve its own headway" is replaced by the observed mechanism. "Structurally unreachable" is qualified to the registered family at 8 m/s target speed. The BRAKING-window censoring and the `DESTINATION_REACHED` truncations are disclosed. The bracket paragraph is rewritten. |
| **F-06** | `ACCEPT` | Traceability row set to `BLOCKED` with the precondition named. Exact-row test added so the row cannot drift from the governing documents again. Registry version bump deferred to approval, as the amendment requires. |
| **F-07** | `ACCEPT` | Scoring rule made deterministic: per-item type annotations in every checklist rather than moderator classification, an authority-token spoken-form table, a digest rule, and a `WRONG` mark for SUPPORTING items. |

### P2 — implemented this round

| ID | Disposition | Decision |
|---|---|---|
| **F-08** | `ACCEPT` | Verify the reviewed template blob at the registration commit. Real gap: the template defines every variant and was unverified. |
| **F-10** | `ACCEPT` | Assert the pair-plan commit is an ancestor of the supplied checkout's HEAD. Cheap, and closes "verified against a repository that isn't the one you're holding". |
| **F-12** | `ACCEPT` | Relax `SideReviewState` so `INTERNALLY_CONSISTENT` permits any gate verdict. The adequacy plane must not couple to verdict values — that is the coupling this phase exists to forbid, and it was pointing the wrong way. |
| **F-13** | `ACCEPT` | Add the in-band non-gate statement to envelope limitations. The JSON is the machine-consumable surface and carried no such statement. |
| **F-20** | `ACCEPT` | Typed closed `reason` on `REGISTRATION_NOT_ESTABLISHED`. Twelve causes collapsing into one silent status is the same compression error the project forbids elsewhere. |
| **F-21** | `ACCEPT` | Real bug: `serialize_protocol` round-trips through YAML and emits exponential floats that reload as strings. Fixed by canonical-JSON round-trip, with a regression test at `1e-05`. |
| **F-26** | `ACCEPT` | Move the non-causal limitation into `ComparisonEnvelope.residual_limitations` and delete the UI-composed directional sentence. This is also Fable's decision on **E**, which I accept: suppress the synthesis, keep the typed partition polarity. |
| **F-33** | `ACCEPT` | Folded into F-01 (delete `merge-base`); grafts/shallow caveat added to the boundary text. |

### P2/P3 — deferred, with reasons

| ID | Disposition | Reason |
|---|---|---|
| **F-09** | `NEEDS OWNER DECISION` | Whether a Git operational failure should veto the whole plane or degrade to a third registration status is a product call about failure semantics, not a defect. Raised in `PROJECT_HANDOFF.md` §10. |
| **F-11** | `DEFER` → Phase 8 | Protocol lineage machinery is the right fix and is larger than this round. The disclosure half is delivered now under F-04. |
| **F-14** | `ACCEPT WITH MODIFICATION` | Fable offered "constrain `d` to the required phase" **or** "state the looser semantics". I took the second: the criteria deliberately allow the response to land outside the braking window, and tightening it now would change the meaning of the committed v5 result. Documented instead. |
| **F-15, F-32** | `DEFER` → Phase 8 | Both concern making shield-predicate recomputation a shared, surfaced object. Correct, and belongs with the reviewer-surface work. |
| **F-16, F-17, F-18, F-19, F-25, F-30** | `DEFER` → next round | Test-infrastructure and diagnostics hardening. Real, none affecting the validity of the record. F-17 is the notable one: my previous fix restored `sys.meta_path` but the bomb still runs in-process, so it does not prove what it claims. |
| **F-22, F-23, F-24, F-31** | `DEFER` → pre-pilot | Human-instrument refinements. `P7-HV-07` stays `BLOCKED`, so none of them gates anything until the amendment is approved. F-23 is accepted in substance now (the hidden-set claim was too broad) and corrected as part of F-07. |
| **F-27, F-28, F-29** | `ACCEPT` (partial, this round) | The record-accuracy items fold into F-04/F-05. Stale-pointer items in `AGENTS.md` are corrected. |

---

## What I disagreed with

**Nothing material.** Two scope choices differ from Fable's first suggestion — F-02 (commit and disclose now, build the CLI in Phase 8) and F-04 (keep LLM authorship, strengthen the record) — and both are argued above rather than silently taken.

One correction to the review itself: F-27 asserts the "first `TTC_BELOW_THRESHOLD` anywhere" claim is misattributed to the v5 primary. It is accurate as written for the *primary pair*, but Fable is right that the v4 primary recorded it first and the v4/v5 traces are byte-identical. The sentence is corrected to say so.
