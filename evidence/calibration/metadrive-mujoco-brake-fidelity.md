# MetaDrive 0.4.3 × MuJoCo 3.12.0 brake fidelity note

Status: observed simulation calibration result; **not** a real-vehicle limit, safety case,
certification result, deployment permission, or claim that either backend is physically correct.

## Headline finding

The outcome distributions disagree substantially. Across the 14 matched entry speeds,
MetaDrive's peak deceleration is **2.255–2.270×** the MuJoCo reference, while MuJoCo's
stopping distance is **1.810–1.974×** MetaDrive's. At the mandatory 20 m/s point, MetaDrive
reports 12.982444763183452 m/s² peak deceleration and 17.70855712890625 m stopping distance;
MuJoCo reports 5.742364940147837 m/s² and 34.78038992231897 m.

This is the product finding: these are different fidelity tiers with different parameterizations.
The disagreement must not be averaged away, used to tune one backend silently toward the other,
or represented as validation of either model.

## Compared records and claim contract

- MetaDrive source: `evidence/calibration/metadrive-brake-curve-0.4.3.json`, SHA-256
  `a9f4c6360b384b0fe8e641632d9f6db174a927da342654d07595e479e658c19e`. This is the sole
  committed WP-A curve/bridge source.
- MuJoCo source: `evidence/calibration/mujoco-brake-reference-3.12.0.json`, SHA-256
  `5da0d72a4b8d00933cfd165326545d5e149c4106827e23a64f504d37b6591f00`.
- Common support: exactly 4, 6, ..., 30 m/s, inclusive; 14 entry-speed samples.
- Comparison unit: empirical outcome distributions across the matched entry-speed support.
  The N=3 repeats in each backend establish deterministic replication on this host; they are not
  independent stochastic samples.
- No trajectory or time-series alignment is performed. Per-speed values below are outcome anchors
  supporting the distribution comparison, not claims that the simulations share state semantics.

## Distribution comparison

Values are minimum / median / maximum across the 14 entry speeds.

| Outcome | MetaDrive 0.4.3 distribution | MuJoCo 3.12.0 distribution | Plain-language disagreement |
|---|---:|---:|---|
| Peak deceleration (m/s²) | 12.982425690 / 12.982473373 / 12.982482910 | 5.719509756 / 5.738079593 / 5.756649430 | Disjoint; MetaDrive is 2.255–2.270× MuJoCo at matched speeds. |
| Steady deceleration (m/s²) | 11.511614223 / 11.546295023 / 11.938190460 | 5.716896119 / 5.726149448 / 5.735444798 | Disjoint; MetaDrive is 2.007–2.088× MuJoCo at matched speeds. |
| Mean deceleration (m/s²) | 9.569636732 / 11.252552862 / 11.458577772 | 5.716896131 / 5.726149505 / 5.735444898 | Disjoint; MetaDrive is 1.674–1.999× MuJoCo at matched speeds. |
| Stopping distance (m) | 0.758720398 / 12.875889778 / 39.620292664 | 1.373538934 / 25.215573977 / 78.208681648 | MuJoCo is 1.810–1.974× longer at every matched speed. |

At 20 m/s:

| Backend | Peak decel (m/s²) | Steady decel (m/s²) | Mean decel (m/s²) | Stop distance (m) |
|---|---:|---:|---:|---:|
| MetaDrive 0.4.3 | 12.982444763183452 | 11.531851328908054 | 10.998299726180328 | 17.70855712890625 |
| MuJoCo 3.12.0 | 5.742364940147837 | 5.728320165257537 | 5.728320232077412 | 34.78038992231897 |

## Why the distributions differ

Observed inputs and model choices, not a post-hoc fit, explain the direction of the result:

- MetaDrive runs its pinned behavior-level vehicle dynamics on `map="S"` with full normalized
  brake, a 0.02 s physics step, and five physics steps per action. Tire, wheel, brake-command,
  and low-speed behavior remain internal to MetaDrive.
- MuJoCo is an intentionally simple 1-D actuator reference adapted from the prior sandbox pilot:
  a 1,400 kg ego body, 0.1 kg nonzero joint armature, 2 N·s/m slide damping, and a fixed 8,000 N
  full-brake motor command at a 0.01 s step. It does not model tires, wheels, ABS, aerodynamic
  drag, suspension, road grade, or a measured real brake plant.
- The MuJoCo lead is held 100 m ahead by a velocity servo at the entry speed. It is explicitly
  **scripted-kinematic**, carries `behavior_realism_claim=false`, and does not interact with the
  ego during this sweep.
- This sweep therefore exercises the MuJoCo actuator-level reference, not contact physics. It
  establishes the optional instrument and its evidence discipline; it does not claim that the
  chosen 8,000 N is calibrated to MetaDrive or to a real vehicle.

The appropriate use is question-to-fidelity routing: MetaDrive remains the scenario/behavior
lane; MuJoCo is an optional reference instrument when actuator or contact-level assumptions are
the question. This record does not authorize substituting MuJoCo values into Hermes thresholds.

## Determinism and fwd/inv residual interpretation

The MuJoCo record uses `mujoco==3.12.0`, `implicitfast`, nonzero armature, `fwdinv` enabled,
and autoreset disabled. Each speed ran three fresh `MjData` states. Both the observation-stream
SHA-256 and the full `mjSTATE_INTEGRATION` stream SHA-256 are bitwise identical within every
N=3 set; the integration state has 29 binary64 values. All runs emitted zero numerical warnings.
These are same-host, same-wheel, same-model guarantees only.

`MjData.solver_fwdinv[0]` is the joint-space relative norm and `[1]` is the constraint-space
relative norm of the forward/inverse applied-force discrepancy. Both maxima are 0.0 at all 14
speeds and are retained as first-class per-speed and distribution outputs. That result is expected
for this simple, non-contacting rail model. It shows no observed forward/inverse discrepancy in
this run; it does **not** validate the 8,000 N parameter, contact fidelity, vehicle realism, or
real-world braking.

## Graduation Q3 — what a full MuJoCo lane would require

This instrument does **not** graduate MuJoCo into Hermes's simulator lane. A future full lane
must land the following as one reviewed change set:

1. schema 5.0 with a reviewable `MujocoScenario` block and a `_SCHEMA_5_ONLY_FIELDS` strip list
   so older scenario identities remain stable;
2. widening `ScenarioDefinition.adapter` from `Literal["fake", "metadrive"]` to include
   `"mujoco"`—digest-neutral by itself, but unsafe to land by itself;
3. the complete verification mirror for MuJoCo provenance/configuration, with every adapter
   branch audited to fail closed rather than silently taking the MetaDrive path;
4. a `mujoco` entry in the architecture boundary test so evidence, gate, and verifier layers
   cannot import or execute the simulator;
5. a named scenario family needing contact-level physics, an accountable owner, a funded test
   budget, the pinned dependency, conformance tests, deterministic replay tests, and a documented
   residual-risk owner.

Graduation remains **deferred until a named scenario family needs contact-level physics**.
Until then, there is no `MujocoAdapter`, no schema widening, no verification mirror, no release
evidence lane, and no agent execution surface for MuJoCo.

## Reproduce

```bash
export PYTHONPATH="$PWD/src"
/Users/bohueilin/miniconda3/envs/hermes-dev/bin/python -m pip install -e '.[mujoco-cal]'
/Users/bohueilin/miniconda3/envs/hermes-dev/bin/python \
  tools/calibration/mujoco_brake_reference.py
```

The command loudly refuses to run when the exact optional dependency is unavailable. Re-running
from the committed instrument/model inputs should reproduce the JSON byte-for-byte on the same
host and MuJoCo wheel; cross-platform bitwise identity is unresolved and is not claimed.
