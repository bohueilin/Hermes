# Hermes Phase 8 — Implementation Note

**Companion to:** [PHASE8_DESIGN_SPEC.md](PHASE8_DESIGN_SPEC.md) (design) and
[PHASE8_BASELINE_AUDIT.md](PHASE8_BASELINE_AUDIT.md) (pre-work survey).
**Branch:** `feat/phase8-adas-scenarios`; WP-3 started from checkpoint `75d1679`.
**Gates at time of writing:** 1,108 tests pass (29 are `metadrive`-selected, including real
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

Triage: agent proposal and deterministic classifier agreed on all 8 seeded defects. The
environment-path seed resolves its finding, nested age and fault-count metrics, and stored
policy-threshold citations against the verified bundle.

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

### 2.6 The threat oracle labels from the realised trace — and the controller affects it

Found by running the comparison demo, not by reading the code. A candidate that brakes far
earlier prevented the threat from ever developing, so the oracle saw a threat-free run and
judged the candidate for *false* intervention — converting a correct early intervention into a
failure.

This is a second kind of circularity, distinct from threshold circularity: not "the evaluator
shares the controller's thresholds" but "the evidence the evaluator reads was shaped by the
controller's actions."

Mitigated by making the scenario's **declared** expectation decide whether false-intervention
exposure applies, while the realised trace still decides whether a threat response was due.
That is sound, but it moves authority to the scenario author. The PRD's stronger answer —
label threats from omniscient simulator state — is recorded as open question 7 in the spec.

### 2.7 Comparison gained a declared variation axis

`_compatibility` refuses any pair whose identity digests differ, which is correct and also made
comparing two controllers impossible. The caller now names the independent variable in advance;
every other digest must still match. Default is unchanged and fully fail-closed, the vocabulary
is closed, and a declared axis that did not actually vary is surfaced as a warning.

Produces the demonstration the evaluation design exists for:

```
threat scenario    minimum_ttc_s   1.17 s -> 4.67 s        IMPROVED
nominal scenario   verdict         CONDITIONAL -> HOLD     REGRESSED
                   hard_failures   [] -> [adas.aeb.no_false_intervention]
```

### 2.8 The flywheel derives from the trace, not from a template

A regression case is only worth adding if it discriminates. The derivation therefore reads the
geometry the trace records at the failing event and proposes a scenario that *starts* there,
rather than re-emitting the source scenario under a new name.

Verified end to end: the derived case fails for the controller that provoked it (required
deceleration at onset 6.83 m/s², 114% of authority) and passes for the baseline (2.71, 45%).
A case that cannot separate those two grows the suite and detects nothing.

Two latent defects surfaced by running it, both the same shape — a float32 storage boundary
meeting a float64 tolerance:

* A derived spawn speed of 18.515 is not float32-exact, so MetaDrive spawned at 18.514999…
  and failed the reset check. The adapter now projects the spawn velocity to binary32 and
  compares against the same projection, which keeps the check exact rather than loosening it.
* The observed initial gap is a *difference of two float32 positions*, so its error is an ulp
  of the position (tens of metres), not of the gap. An absolute 1e-6 m tolerance held only by
  luck — a 40 m gap landed exactly, a 28.816 m gap missed by 1.4e-6.

  **This entry previously described my fix as a deliberate loosening of a trace-integrity
  tolerance, and asked that it be reviewed as one. That framing was half right and the fix was
  worse than it needed to be.** It was a relative tolerance of 1e-6 — a number that worked but
  that I had chosen rather than derived. It has been replaced (`65363ae`) with a tolerance
  computed from the float32 grid spacing at the compared magnitude, via `_geometry_agrees` in
  `evidence/trace.py`. That is *tighter* than the relative tolerance at every magnitude
  (1.5e-5 m rather than 2.9e-5 m at a 28.8 m gap, and 20× tighter near zero), so relative to
  the fix it replaces it is a tightening, not a loosening.

  Relative to the **original** 1e-6 m it is still wider at large magnitudes, and that is
  correct: the original was tighter than the representation permits, which does not make a
  check stronger, it makes it fire on correct behaviour. Two tests pin the properties that
  matter — it absorbs float32 representation error, and it still rejects a one-millimetre
  disagreement at every magnitude in the schema's range. A third records where the headroom is
  thinnest, because it is not uniform: at the 200 m schema maximum the tolerance is 0.12 mm,
  roughly 8× under a millimetre rather than the three orders available at the low end. A
  sub-millimetre contradiction in a very long-range gap is beyond what this check can resolve,
  and that limit is inherent to float32 storage rather than to the choice of tolerance.

  The generalisable lesson, now recorded as handoff landmine 7: **when a tolerance has to be
  chosen rather than derived, the error model is usually wrong.**

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
| §0-A.7.1 oracle from omniscient simulator state | Oracle computed from the stored trace | Keeps evaluation offline and re-judgeable without the simulator, at the cost described in §2.6. |
| §0-A.9.7 `hermes regression promote <draft> --approve` | Approval is a separate verb | A single command lets the promoter self-approve, which defeats the boundary the approval record exists to draw. |

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
5. **Threat labels come from the realised trace, not omniscient state.** See §2.6 — the
   current mitigation is sound but places authority with the scenario author, and the PRD's
   own stronger answer is not implemented.

## 6. Reproduction

```bash
cd <repo> && export PYTHONPATH="$PWD/src"

# gates
python -m pytest -q                 # 1,108 passed
python -m pytest -q -m metadrive    # 29 passed, including real physics
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

# baseline-policy environment-path seed: real observation delay, not a broken controller
python -m hermes run --simulator metadrive --headless \
  --scenario scenarios/adas/aeb_stationary_lead_observation_delay.yaml \
  --policy adas-longitudinal --policy-config config/adas/baseline.yaml \
  --gate-config config/gates.adas.yaml --seed 7 --run-id demo-stationary-delay
# Expected: internally consistent evidence with a HOLD verdict. verify-artifact exits 20
# for a valid held artifact; that disposition is not an execution or integrity failure.
python -m hermes verify-artifact artifacts/demo-stationary-delay

# the trade-off demonstration, and the flywheel
make demo-adas-tradeoff
make demo-flywheel
```

### 6.1 WP-3 delay reproducibility and historical evidence disposition

The committed delay scenario has a durable same-host real-MetaDrive N = 3 test at
`tests/integration/test_stationary_lead_observation_delay.py`. Each repeat uses run ID
`stationary-delay-n3`, seed 7, and a distinct artifact root. The trace digest is
`f87e9e8b739dcef62d99ab3328450e1e43d8417736a14a738b005796c5735bcb`; all three repeats
also produced these byte-identical companion hashes:

| File | SHA-256 |
|---|---|
| `events.jsonl` | `c248d1625230e42f863d1ff12fd06a61d8f135290615374326ff0006e42b51eb` |
| `trace.sha256` | `5af413888e7750bfdb6f4f140ebb00a9f64e3e1ea87c813320f56caf5f6536df` |
| `execution-context.json` | `819db7a8f8e6190dd5229721571ab9c6c01022d5c84f5ef2e6349956bacd682d` |
| `metrics.json` | `46b20932b15ea1c6258012f648118d2ce7ef3c22e7339d0bab1554c8214d0816` |
| `findings.json` | `733547085261c7fabfa6634950034a55cdb8f9780e6956777846c9a4c6166610` |
| `verdict.json` | `53e0517d5f8f48c4555107ba1cac36f944b7e538e9dfbacaee276d12ea01bc71` |
| `scenario.resolved.yaml` | `e32c06557811cd455424f3aa85d97a522e10ea1b3f35922f4868b47a44553eca` |
| `gate-config.resolved.yaml` | `db9e70ec89e3eaf32dcf988702a2866e73138dbb6efd3b9c0746bcc38540e05f` |

Every manifest field except `created_at_utc` is equal. Manifest bytes and bundle-root digests
are intentionally not asserted: the truthful creation timestamp makes both vary.

Verifier-suite binding changed the historical disposition of six preserved, local,
pre-binding ADAS bundles from internally consistent to `INVALID`:

- `stationary-nominal-wp1-final-demo`
- `stationary-threat-wp1-final-demo`
- `wp1-stationary-no-aeb-measure`
- `wp1-stationary-nominal-measure`
- `wp1-stationary-over-measure`
- `wp1-stationary-threat-measure`

That fail-closed result is intentional. Compatibility that accepts an ADAS bundle with its
ADAS verifier identities omitted is explicitly rejected; the coherent-omission regression
in `test_stored_adas_bundle_rejects_coherently_wrong_verifier_suite` must remain `INVALID`.
The six bundles remain unmodified local historical evidence. Choosing whether to migrate or
rebaseline them, and recording any resulting disposition in `HERMES_SOURCE_OF_TRUTH.md`,
belongs to the repository/evidence owner—not to the compatibility layer or this work package.

**Environment note:** the `hermes-dev` conda environment's editable install resolves `hermes`
to a different checkout. Always run with `PYTHONPATH="$PWD/src"`;
`tests/unit/test_import_provenance.py` fails loudly if this is got wrong.

## 7. Layout

```
src/hermes/adas/        interfaces, functions, policy, config, seeded_defects
src/hermes/agents/      contracts, tools, approval, triage, citations
src/hermes/regression/  builder, floor, models - the failure-to-regression flywheel
src/hermes/verifiers/   adas.py — four offline evaluators
src/hermes/fixtures/    registry.py — reproducible test fixtures
config/adas/            baseline + four seeded-defect controller configs
config/gates.adas.yaml  gate-config schema 2.0, oracle thresholds
scenarios/adas/         eight schema-4.0 ADAS scenarios, including the delay environment seed
```
