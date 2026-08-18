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
