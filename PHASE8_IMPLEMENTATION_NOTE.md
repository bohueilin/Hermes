# Hermes Phase 8 — Implementation Note

**Companion to:** [PHASE8_DESIGN_SPEC.md](PHASE8_DESIGN_SPEC.md) (design) and
[PHASE8_BASELINE_AUDIT.md](PHASE8_BASELINE_AUDIT.md) (pre-work survey).
**Branch:** `feat/phase8-adas-lab` from `feat/phase6-reviewer-comprehension` @ `4eb8765`.
**Gates at time of writing:** 903 tests pass (11 of them `metadrive`-marked, running real
physics), ruff clean repo-wide, doctor 16 PASS.

This note records what was built, what was measured, what deviates from the PRD and why, and
what a reviewer should push on. It is deliberately organised around *decisions and evidence*
rather than around files.

---

## 1. What runs today

```bash
# the two-scenario ADAS demo
make demo-adas

# the agent surface
hermes agent tools
hermes agent triage <run-id>
hermes agent check-citations <run-id>

# reproducible test fixtures
hermes fixtures regenerate
```

Measured end to end on real MetaDrive physics, seed 7:

| Controller | Scenario | Verdict | Caught by | a_req at brake onset |
|---|---|---|---|---|
| `baseline` | threat | CONDITIONAL | — | 3.00 m/s² (50% of authority) |
| `defect_late_braking` | threat | HOLD | `adas.aeb.brake_onset_margin` | 6.46 m/s² (108%) |
| `defect_no_aeb` | threat | HOLD | `adas.aeb.threat_response` | n/a (never braked) |
| `baseline` | nominal | CONDITIONAL | — | n/a (never braked) |
| `defect_over_braking` | nominal | HOLD | `adas.aeb.no_false_intervention` | 0.02 m/s² |

Determinism: N = 3 repeats of the threat scenario produce trace digest
`1603319fbd213b01…` with byte-identical `events.jsonl`, `metrics.json`, `findings.json` and
`verdict.json`.

Triage: agent proposal and deterministic classifier agreed on 3 of 3 seeded defects; 11 of 11
citations re-resolved and matched.

## 2. Decisions taken during implementation

These are the ones a reviewer should interrogate. Each was forced by something the code did,
not chosen on paper.

### 2.1 The flagship scenario was measuring nothing — rewritten

As originally authored, `aeb_lead_hard_brake` put the ego 10 m behind a slower lead at 20 m/s.
Required deceleration at step 0 was already ~9 m/s², above even a deliberately-late
controller's trigger, so **a timely controller and a broken one behaved identically**. The
scenario looked like a hard threat while testing nothing.

Rewritten so the ego follows at matched speed from 40 m until the lead brakes. That separates
the controllers: onset TTC 2.436 s versus 1.548 s.

*Lesson worth generalising: a scenario that every controller fails, or that every controller
survives, has no evaluative power regardless of how dramatic it looks.*

### 2.2 The brake-onset criterion was a tuned number — replaced with physics

The first version used a minimum TTC at brake onset. At 0.5 s it caught neither defect, and
the obvious fix — raise it until it does — is fitting the threshold to the controller under
test. That is precisely the circularity the design spec says the oracle must avoid.

Replaced with required deceleration at onset against braking authority. Speed-independent,
derivable from the trace, and it separates 50% from 108% without anyone choosing a number to
make a test pass. A unit test pins the speed-independence claim directly: a 2.0 s onset is
inside authority at 10 m/s and outside it at 30 m/s.

### 2.3 The scripted driver was made non-braking by default

Offline evaluators see only the trace, which records executed actions and not the controller's
internal decisions. Attribution therefore had to be either recorded or made structural. Making
the driver non-braking makes it structural: in a default FCW/AEB run every braking command is
AEB-attributable by construction. A configuration that raises `DriverConfig.max_brake` opts
into ambiguous attribution, and the docstring says so.

*This is a deviation from the PRD, which assumed brake-source attribution would be a trace
field. Recording it in the trace requires evidence schema 3.0; this achieves the same
guarantee for the P0 slice without it.*

### 2.4 Two ADAS verifier profiles, not one

Schema 4.0 permits `adas` and `faults` together. A profile's expected finding set is matched
for **exact equality**, so a single ADAS profile would have silently dropped fault-coverage
checking for any ADAS scenario that also injects faults. `ADAS_P0_LONGITUDINAL_FAULT` exists
to prevent a coverage gap nobody would have noticed.

### 2.5 Controller configuration became a file

Not planned, but three things needed it at once: seeded defects expressible as data, a
declared variation axis for candidate comparison, and a developer-facing configuration
surface. `--policy-config` binds the file's content into `policy_config_digest`.

## 3. Defects found in the existing codebase

Four, all pre-existing, all fixed test-first and proven behaviour-preserving. These are worth
review attention because each is a class of bug rather than an instance.

### 3.1 The release gate failed open

`soft_nonpassing` filtered on `not finding.hard_invariant`, so a **hard** finding registered
in a profile without its own precedence branch was excluded from the soft bucket, matched no
earlier branch, and fell through to `PASS` while failing.

Not reachable with the two pre-Phase-8 profiles — and live the instant Phase 8 registered its
first hard ADAS finding. A failing `adas.aeb.threat_response` would have been reported as
PASS. Fixed with a non-compensatory catch-all plus an explicit list of the finding IDs that
have their own branch.

### 3.2 Scenario identity used a forked canonical serializer

`scenarios/loader.py` carried a private `json.dumps` without `evidence/canonical.py`'s
`-0.0 → 0.0` normalisation. Two YAML files describing the same scenario produced different
digests:

```
lateral_offset_m:  0.0  →  c8d4e79352e5b556…
lateral_offset_m: -0.0  →  6abf74206dc1cdfc…
```

`scenario_digest` feeds `RunContext` and the fail-closed comparison check, so one scenario
became two identities and two runs of it became incomparable. Phase 8's float-dense scenarios
and parameter sweeps raise the exposure sharply.

### 3.3 Adding a model field silently invalidated stored evidence — twice

`scenario_digest` and `gate_config_digest` both hash `model_dump()`, and both are re-derived
during verification. Adding schema-4.0 scenario fields would have changed every existing
scenario's digest; adding the gate-config `adas` block *did* change every schema-1.0 gate
digest, and every stored bundle immediately failed with "gate configuration digest does not
match trace context."

Both now strip version-only fields for older versions (`_SCHEMA_4_ONLY_FIELDS`,
`_SCHEMA_2_ONLY_FIELDS`). **This is the single most repeatable trap in this codebase** and it
will recur on the next schema addition.

### 3.4 The test suite could not run on a fresh clone

Eight test modules read gitignored `artifacts/` fixtures that nothing regenerated: 127 failed
/ 593 passed / 40 errors on a clean checkout. Now regenerates from committed recipes, and a
self-maintaining test scans the test tree for fixture references and fails if any lacks one.

## 4. Deviations from the PRD

| PRD says | Built | Why |
|---|---|---|
| §0-A.2.2 "evaluators are `Verifier` implementations" | Module-level functions returning `Finding` | The `Verifier` Protocol is dead code — nothing implements or references it. Following the real in-repo pattern avoids a second, inconsistent verifier style. |
| §0-A.9.7 "`--policy` registrations" | A registry built from scratch | No registry existed; `--policy` was validated against one derived value and discarded. |
| §0-A.4.1 lead relative acceleration in the observation | Estimated policy-internally | Adding an observation field changes the pinned `observation_summary` field set. `a_req` staging already addresses the decelerating-lead problem the field was meant to solve. |
| §0-A.2.4 brake source in the trace | Structural attribution (§2.3) | Requires evidence schema 3.0; the guarantee is achieved without it for the P0 slice. |
| §0-A.6.4 `agent-trace.jsonl` | Not built | Bundle capture rejects *any* file outside `REQUIRED_ARTIFACT_FILES`, so §24's "Optional:" list is not implementable. Needs a schema-gated optional-artifact mechanism first. |
| §12 `RunMetricsV3` | ADAS values live as finding measurements | Evidence schema 3.0 is six model subclasses plus four dispatch maps; deferred rather than half-done. |

## 5. What I would push on if reviewing this

Honest list of where the work is thinnest:

1. **Two scenarios and one seed.** Everything measured here rests on a very small sample. The
   seeded-defect result would be far more convincing across a parameter sweep.
2. **Uncalibrated dynamics.** Peak deceleration reaches ~13 m/s² against a declared 6 m/s²
   authority — `ControlConfig` limits are declared but not enforced on the simulator, and
   MetaDrive brake response was never measured. Both demos land CONDITIONAL on comfort as a
   result, and that CONDITIONAL is currently noise rather than signal.
3. **Triage accuracy may be tautological.** The scripted agent applies the same precedence
   rule as the classifier it is scored against. 3/3 is close to guaranteed. The metric only
   becomes interesting with a runtime that reasons differently.
4. **`adas.fcw.warning_timing` verifies less than its name suggests.** The trace has no field
   for the warning signal, so it confirms only that the run presented the declared closing
   geometry. The finding message says this; the name still oversells it and should change.
5. **No comparison.** Without the variation axis, the "candidate improves collisions but
   regresses false braking" story — the most valuable demonstration in the whole design —
   cannot actually be run.

## 6. Reproduction

```bash
cd <repo> && export PYTHONPATH="$PWD/src"

# gates
python -m pytest -q                 # 903 passed
python -m pytest -q -m metadrive    # 11 passed, real physics
python -m ruff check . && python -m hermes doctor

# seeded-defect suite (needs vendored third_party/metadrive)
python -m pytest -q tests/integration/test_seeded_defects.py

# one defect by hand
python -m hermes run --simulator metadrive --headless \
  --scenario scenarios/adas/aeb_lead_hard_brake.yaml \
  --policy adas-longitudinal --policy-config config/adas/defect_late_braking.yaml \
  --gate-config config/gates.adas.yaml --seed 7 --run-id demo-late-braking
python -m hermes agent triage demo-late-braking
python -m hermes agent check-citations demo-late-braking
```

**Environment note:** the `hermes-dev` conda environment's editable install resolves `hermes`
to a different checkout. Always run with `PYTHONPATH="$PWD/src"`;
`tests/unit/test_import_provenance.py` fails loudly if this is got wrong.

## 7. Layout

```
src/hermes/adas/        interfaces, functions, policy, config, seeded_defects
src/hermes/agents/      contracts, tools, approval, triage, citations
src/hermes/verifiers/   adas.py — four offline evaluators
src/hermes/fixtures/    registry.py — reproducible test fixtures
config/adas/            baseline + three seeded-defect controller configs
config/gates.adas.yaml  gate-config schema 2.0, oracle thresholds
scenarios/adas/         three schema-4.0 scenarios (one threat, two nominal)
```
