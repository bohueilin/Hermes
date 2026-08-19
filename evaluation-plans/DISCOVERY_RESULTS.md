# Phase 7 declared-question discovery results

This file is the disclosure record required by the Phase 7 anti-cherry-picking
protocol. Every registered discovery version appears here, including versions that
found nothing. Failed attempts are never deleted and never silently retried.

## Protocol version 1 — `lead_ttc_engagement.protocol.v1.yaml`

- Protocol byte digest: `d1d86c343c67ee9c8d048b915ca7288bb8b36ec86d02578c5b3bd997c144580d`
- Protocol semantic digest: `330bd84458c0b67064402a8db263dff8cdb2994dd6dc44b42410a45f16ddd841`
- Registration commit: `69fe004de30c60764273fb53217125e5fd037788`
- Ledger: `lead_ttc_engagement.discovery.v1.jsonl` (18 attempts, byte digest
  `0d48c7258cba208c2716b1d8699ee93b1a8a4b205b6d1bd95ee3055d8fe72781`)
- Grid: `initial_gap_m` {6.0, 8.0, 10.0} x `actor_speed_mps` {4.0, 6.0, 8.0} x
  `trigger_step` {30} x `brake_duration_steps` {15, 30} x `recovery_throttle` {0.0}

**Outcome: NO VALID ATTEMPT.** No baseline in the declared grid entered the 2.0 s
policy-input TTC band. Observed minimum policy-input TTC ranged from
11.193010753306831 s to 12.317239968120395 s across all 18 attempts.

The v1 grid therefore selects nothing, and no pair plan may be built from it.

### What the v1 evidence shows

The declared question was not exercised because the encounter never reached
speed. With initial gaps of 6-10 m and a trigger at step 30, the ego was still
gap-limited by its own car-following policy: at the trigger it was travelling
about 2.1-2.5 m/s against an 8.0 m/s configured target, and the lead actor had
itself only reached about 3.1 m/s. After the lead stopped, the ego crept behind
it at roughly 0.7-1.0 m/s, so the closing speed stayed small and the ratio
`front_distance_m / -front_relative_speed_mps` stayed above 11 s throughout.

Retained evidence agrees: `handoff-p2-metadrive` shows the ego needs about 20.8 m
of free travel to reach its 8.0 m/s target, which a 6-10 m gap never allows.

Variant `grid-0016` reproduced `11.585881563948043 s`, exactly the minimum
policy-input TTC of the retained `handoff-p3-lead-baseline`, confirming the
materialized-variant path reproduces the original scenario's behaviour.

### Consequence

A material retry requires a new protocol version and new run IDs. Version 2 is
registered separately. Its grid is informed only by this disclosed v1 evidence
and by retained pre-existing artifacts; no unregistered exploratory run informed
it, and no candidate outcome informed it.

## Protocol version 2 — `lead_ttc_engagement.protocol.v2.yaml`

- Protocol byte digest: `e878b936936cb97431f0499f77121bfcb2669704c81b1819148d75a3b6a2555f`
- Protocol semantic digest: `aa7d6b54abec9e1405f776c1f6b849f565345787c231f55228d93ce2d80fe49f`
- Registration commit: `bc66fa0c4782a6f9b554bc2d7f26a047c24e3b77`
- Ledger: `lead_ttc_engagement.discovery.v2.jsonl` (32 attempts, byte digest
  `147c321e54e2974d5adaf95477e3e40f027656ade3f633c54105df17a972dea9`)
- Grid: `initial_gap_m` {12.0, 16.0, 20.0, 30.0} x `actor_speed_mps` {6.0, 8.0} x
  `trigger_step` {80, 140} x `brake_duration_steps` {30, 60} x
  `recovery_throttle` {0.0}

**Outcome: NO VALID ATTEMPT.** No baseline entered the 2.0 s band. Observed
minimum policy-input TTC ranged from 3.113655645906048 s to 12.49756404415772 s.

### What the v2 evidence shows

Two effects are now visible and both are monotonic within the searched range.

At `actor_speed_mps` 8.0 with `trigger_step` 80, opening the initial gap lowers
the observed minimum policy-input TTC:

| `initial_gap_m` | minimum policy-input TTC (s) |
|---:|---:|
| 12.0 | 6.9420108834983845 |
| 16.0 | 7.261493612440824 |
| 20.0 | 6.059562678424191 |
| 30.0 | 3.113655645906048 |

A larger gap lets the ego reach and hold its 8.0 m/s target, so the closing speed
after the lead stops is larger. `trigger_step` 140 is uniformly worse than 80
(about 12.4-12.5 s at every gap): by step 140 the car-following policy has
settled into a wide steady-state headway.

`brake_duration_steps` had no effect at all. Every 30-step and 60-step pair
produced an identical minimum, so the minimum always falls inside the first 30
steps of braking.

### Consequence

Version 3 fixes `brake_duration_steps` at 30 and `actor_speed_mps` at 8.0 on this
disclosed evidence, and extends the gap and trigger ranges in the direction the
v2 ledger already shows. As with v2, the grid is informed only by committed
discovery ledgers and retained pre-existing artifacts.

## Protocol version 3 — `lead_ttc_engagement.protocol.v3.yaml`

- Protocol byte digest: `0b2aa172d2227d09fb24a4deed3c15ace61ae932e7a2890cd5c96a10cdccf17c`
- Protocol semantic digest: `68a0a1f696814386b7e2737c6456f8ec6e5379b33c7161e1b69cd886a5bd69d3`
- Registration commit: `34b6c43b81ad276d33af423895f70329992d6594`
- Ledger: `lead_ttc_engagement.discovery.v3.jsonl` (15 attempts, byte digest
  `9fd6f73c5d14ebfb9b4c70a035de9aa8b03caa57a0172b85efbe2cdc14f38d2f`)
- Grid: `initial_gap_m` {40.0, 50.0, 60.0, 80.0, 100.0} x `actor_speed_mps` {8.0} x
  `trigger_step` {60, 80, 100} x `brake_duration_steps` {30} x
  `recovery_throttle` {0.0}

**Outcome: NO VALID ATTEMPT.** Observed minimum policy-input TTC ranged from
3.108394946413832 s to 10.313028788093142 s.

### What the v3 evidence shows — the search is now bracketed

v3 extended the gap in the direction v2 favoured and the trend reversed:

| `initial_gap_m` | trigger 60 | trigger 80 | trigger 100 |
|---:|---:|---:|---:|
| 40.0 | 3.11849651401919 | 3.1548306140668023 | 3.108394946413832 |
| 50.0 | 4.0653360306295445 | 3.4050433173209447 | 3.158785598958083 |
| 60.0 | 5.314561906794161 | 4.655639527283892 | 3.808240334472508 |
| 80.0 | 7.813863553047341 | 7.156405483717201 | 6.306950606898969 |
| 100.0 | 10.313028788093142 | 9.65739937864893 | 8.805536544980038 |

Together with the v2 row at 30 m (3.113655645906048 s), the observed minimum is
flat near 3.11 s for every gap at or above 30 m and rises above it. The low side
is limited by how far the ego can run up before the encounter; the high side by
the measurement window and the road length. This is **not** a two-sided bracket
of a physical optimum, and the earlier text saying so was wrong.

**Correction, 2026-08-19 (Fable round-1 finding F-05).** The original text
attributed this floor to "a car-following policy that brakes early enough to
preserve its own headway". **That attribution was wrong**, and it was wrong in
the same way the Phase 7A showcase was wrong: a real number with an invented
mechanism.

The artifacts show the opposite of early braking. In
`artifacts/p7-v5-discovery-0000`, the ego holds **8.000 m/s with `brake` 0.00 and
`throttle` 0.000** from sequence 64 through 73 — it does not respond to the
decelerating lead at all — and then applies **`brake` 1.00** at sequence 74, the
step at which the minimum is recorded.

The mechanism is MetaDrive `IDMPolicy`'s detection horizon.
`third_party/metadrive/metadrive/policy/idm_policy.py:212` sets
`MAX_LONG_DIST = 30`: the policy does not perceive the lead beyond 30 m
centre-to-centre, then brakes hard. With the two vehicle lengths giving a
5.1275 m bumper offset and the ego at its 8.0 m/s target:

```text
(30 − 5.1275) / 8.0 = 3.109062 s
```

The observed minimum across all 65 attempts is **3.108394946413832 s** — a match
to four significant figures. The floor is a perception cutoff, not conservative
foresight.

**What this does and does not license.** `control.target_speed_mps` was fixed at
**8.0** in every one of the 83 registered attempts, is not a mappable grid
parameter, and is the term the floor scales with. The search could never have
varied it. So the correct statement is:

> Within the registered family — lead-vehicle hard brake, `metadrive-idm`, ego
> target speed 8.0 m/s, actor speed ≤ 8.0 m/s — no baseline entered the 2.0 s
> band, and the floor is set by the policy's 30 m detection horizon.

It is **not** established that a 2.0 s threshold is unreachable for this policy in
general. The floor scales as roughly `(30 − 5.13)/v`, so a legal template edit to
a higher ego target speed would be expected to reach the band. The retained cut-in
baseline already reaches 1.8155836417275437 s, so 2.0 s is reachable elsewhere in
Hermes today.

**Measurement caveat.** `minimum_policy_input_ttc_s` is derived over the
**BRAKING window only**. Of the 65 v1–v3 attempts, **19** have a whole-run minimum
*below* their recorded braking-window minimum, and **5** ended
`DESTINATION_REACHED` before the encounter concluded. The whole-run global minimum
across v1–v3 is **3.1020836761465693 s**. The recorded figures are correct for the
declared window and should not be read as whole-run minima.

### Consequence

The declared question at a 2.0 s threshold is closed as unreachable and is not
retried. Version 4 asks a different, explicitly stated question at a threshold
above the measured floor, so the positive path of the adequacy assessor can also
be exercised. The 2.0 s result stands unchanged in this record.

## Protocol version 4 — `lead_ttc_engagement.protocol.v4.yaml`

- Protocol byte digest: `3021c4a59b52fde36bea6d921b88170dffb8aa481efc193528b0080ea854fbd0`
- Registration commit: `ef1169e2b819dca219dd4dd06e37ffb237ea9808`
- Pair-plan commit: `389a3cceb8ecec28e816b46f304c6501adc81d6e`
- Ledger: `lead_ttc_engagement.discovery.v4.jsonl` (9 attempts, byte digest
  `969779633829f4f543ecc528f38c190405a85d37ec60f94189c105057a8db765`)
- Declared threshold: 4.0 s
- Primary pair: `handoff-p7-lead-baseline` / `handoff-p7-lead-candidate`

**Discovery outcome: SELECTED `attempt-0000` / `grid-0000`** (30 m gap, 8.0 m/s
actor, trigger 60, 30 braking steps, zero resume throttle) with an observed
minimum policy-input TTC of 3.1221979708407908 s.

**Overlap disclosure (added 2026-08-19, Fable round-1 F-04).** Seven of the nine
v4 grid points are re-runs of points already committed in the v2 and v3 ledgers,
and six of those were already recorded below 4.0 s. A valid selection was
therefore **certain before v4 was registered**. Because the shield tests the same
predicate on the same observation the ledger formula uses, candidate engagement
follows mechanically once a baseline dips below the declared threshold.

What the v4/v5 pair establishes is the behaviour of the **assessor**: v4's
`INADEQUATE` demonstrates its refusal path and v5's `ADEQUATE` its positive path
and bookkeeping. Neither establishes anything about the shield beyond its
unit-tested predicate.

**Assessment outcome: INADEQUATE — mis-declared policy component identity.**

The primary pair engaged the mechanism cleanly. The candidate recorded three
`TTC_BELOW_THRESHOLD` overrides at sequences 66, 70, and 74, with no
`SPEED_CAP` or any other non-target reason anywhere in the run, and the fresh
primary baseline reproduced the selected discovery observation exactly
(3.1221979708407908 s at sequence 74). Sixteen of seventeen criteria passed,
including target-condition exposure, material target intervention, arm alignment
at the divergence, non-target predicate clearance, and common-prefix equality.

One criterion failed: `artifact_component_identities_match_pair_plan`. The v4
protocol declared the `metadrive-idm` policy configuration digest as the
empty-object digest `44136fa3...`, but the policy has a real configuration whose
digest is `22b5e129ed53fad94e0bf70e38bdf341316d8ff1d8a75652abd08c964f230fa4`.

This is an authoring error in the frozen protocol, and the assessor caught it
rather than accepting the pair. It is preserved here rather than corrected in
place. The v4 artifacts are retained unchanged.

### Consequence

A mis-declared component identity is a material defect, so version 5 re-declares
the protocol with the correct policy digest and uses new discovery and primary
run IDs. The correct digest is taken from retained pre-existing artifacts
(`handoff-p2-metadrive`, `handoff-p3-lead-baseline`), where it has been stable
since Phase 2; it is not read from any v4 result.

## Protocol version 5 — `lead_ttc_engagement.protocol.v5.yaml`

- Protocol byte digest: `977a93f90b635fb5bd054dfcc896de758efb5ea35142567eea69a88bc7ba2cc5`
- Protocol semantic digest: `e83fac88293ec9eed7d68fcc5ee2f09f32a78f43bc30f43a5b45cb4e6141151d`
- Registration commit: `fc63bd3bbd2dad6d8d5b2641e39fde102a3f2c28`
- Pair-plan commit: `cb6d66954a277eb21d3100eb555222f9acc0c16a`
- Ledger: `lead_ttc_engagement.discovery.v5.jsonl` (9 attempts, byte digest
  `2c8deaf5e48d8378b1169c7c1a50d54987982fdb5dc5817857f6b00b678eb10d`)
- Selected: `attempt-0000` / `grid-0000` — 30 m gap, 8.0 m/s actor, trigger 60,
  30 braking steps, zero resume throttle; observed minimum policy-input TTC
  3.1221979708407908 s at sequence 74
- Primary pair: `handoff-p7b-lead-baseline` / `handoff-p7b-lead-candidate`
  (trace digests `26489bf0f904f0e4a2d05fef371e6992dd2a9d383a341e6345396b275548c661`
  and `b2e651fab965fe532450df18b1885090d4e098f63c1fe8febb1ff48a558e0d02`)

**Discovery outcome: SELECTED `attempt-0000`. Assessment outcome: `ADEQUATE`.**

All seventeen criteria passed. Registration is `LOCAL_HISTORY_ORDERING_VERIFIED`
and interpretation is `DECLARED_QUESTION_ONLY`.

The candidate recorded three `TTC_BELOW_THRESHOLD` overrides at sequences 66, 70,
and 74. No `SPEED_CAP`, `STALE_OBSERVATION`, `BOUNDARY_RISK`, `EMERGENCY_STOP`,
or `ACTUATION_DELAY_COMPENSATION` reason appears anywhere in the run, and every
non-target predicate recomputed from stored observations is false through the
treatment divergence. The two arms match exactly on all 66 events through
sequence 65, diverge first at sequence 66, and the fresh primary baseline
reproduced the selected discovery observation exactly.

This is the first `TTC_BELOW_THRESHOLD` override recorded anywhere in this
repository's evidence.

### Negative control

The retained `handoff-p3-lead-baseline` → `handoff-p3-lead-shielded` pair,
assessed against the same plan, returns `INADEQUATE` with disposition
`TARGET_INTERVENTION_CONFOUNDED`, interpretation `DESCRIPTIVE_ONLY`, and
registration `REGISTRATION_NOT_ESTABLISHED`. Its diagnostics state exactly why:
available BRAKING inputs never entered the declared band, 36 target-evidence
violations precede any divergence, 73 non-target predicate or reason violations
were found, and zero qualifying target events exist.

Invalid stored evidence (`phase1-tampered`) fails closed at exit 30 with
`assessment: null` and no criteria.

### What this does and does not establish

The pair exercised the locally registered lead-TTC engagement question at a 4.0 s
threshold in this bounded simulation. The registration ordering is evidenced by
local Git history, which is rewritable and carries no external timestamp, and the
evidence remains `NOT_AUTHENTICATED`.

It does not establish that the shield is safer, that the challenge is realistic,
that the candidate is ready to advance, that the comparison proves a causal
treatment effect, or anything about real-world vehicle safety. Both arms hold at
gate verdict `HOLD`.
