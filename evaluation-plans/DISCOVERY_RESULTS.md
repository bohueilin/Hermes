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
