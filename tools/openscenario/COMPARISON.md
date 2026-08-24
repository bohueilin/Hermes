# FCW cut-in: MetaDrive 0.4.3 × esmini 3.7.1

**SIMULATION-ONLY / NOT HERMES EVIDENCE.** This is a deterministic standards audition. It is
not backend parity, a real-world safety claim, certification evidence, or production
validation. TTC <= 2.6 s is an illustrative **scenario-exposure** threshold. Hermes traces do
not record an FCW warning signal, so this note does not claim that either backend issued a
warning.

## What was translated

The source is the current `scenarios/adas/adas_cut_in_near.yaml`, not the stale Phase-3 handoff
scenario.

| Contract | Hermes / MetaDrive | OpenSCENARIO audition |
|---|---:|---:|
| Fixed control/sample step | 0.1 s | 0.1 s (`--fixed_timestep 0.1`) |
| Ego speed | 20.0 m/s | 20.0 m/s scripted |
| Actor speed | 12.0 m/s | 12.0 m/s target |
| Initial lane-center delta | -3.5 m | lane -2 to lane -1, -3.5 m |
| Vehicle length × width | 4.515 × 1.852 m | 4.515 × 1.852 m inline |
| Initial center / bumper gap | 36.515 / 32.0 m | 36.515 / 32.0 m |
| Cut-in action start | 1.0 s | 1.0 s (`greaterOrEqual`) |
| First displaced grid sample | 1.1 s | 1.1 s |
| Target-lane grid sample | 2.0 s | 2.0 s |
| Lateral center interpolation | cubic smoothstep | `dynamicsShape="cubic"` |

esmini 3.7.1's cubic implementation evaluates the same center interpolation used by Hermes:
`u²(3 - 2u)`. This is a formula match, not a trajectory-parity claim. The actor pose and
longitudinal update semantics differ, as described below.

The committed OpenDRIVE file is intentionally small: a 300 m straight, right-hand-traffic
road with two 3.5 m driving lanes. It is a genuine required input because the official binary
ZIP contains executables/libraries/headers but no roads, catalogs, models, or configuration.

## Actual producer provenance

Observed on macOS 26.5.2, native arm64, on 2026-08-24:

- Official release: esmini v3.7.1, published 2026-08-20; peeled tag commit
  `b848e291e0d183d1b2bce234ecda3d4b84d35169`.
- Official asset:
  `https://github.com/esmini/esmini/releases/download/v3.7.1/esmini-bin_macOS.zip`
- Archive SHA-256:
  `b69e08691319fe8041027687a5b678a5e18e4c5775cb5708362707940c534079`
- Executable SHA-256:
  `20d53493cee342cd4dd1b5139d1bafc0ebb5e7793ac8991457d13aa53115e999`
- `--version` output SHA-256:
  `48087271229852025c2646654d91b52881fdb24432e0e8856488dafda63d7f6e`
- Version banner: revision `v3.7.1-0-b848e291`, tag `v3.7.1`, branch
  `tags/v3.7.1^0`, build `6348`.
- v3.7.1 landmine: `--version` writes the correct four-line banner and exits 255. The runner
  accepts 255 only with the exact banner and exact producer hashes; the scenario execution
  itself must exit 0.
- `lipo -archs`: `x86_64 arm64`; execution is forced through `/usr/bin/arch -arm64`.
- `file` output, with only the local binary path normalized:

  ```text
  Mach-O universal binary with 2 architectures: [x86_64:Mach-O 64-bit executable x86_64] [arm64]
  <ESMINI_BIN> (for architecture x86_64): Mach-O 64-bit executable x86_64
  <ESMINI_BIN> (for architecture arm64): Mach-O 64-bit executable arm64
  ```

  The exact unnormalized `file` output SHA-256 is
  `67a125d5eab049c61dfa06b0601f6a5730e64d705b33e5b60b6ecd1dc2afe03e`.

The runner removes ambient `ESMINI_CONFIG_FILE`, disables log-file creation, supplies seed 7,
and uses repository-relative scenario spelling. No esmini binary/archive, raw CSV, environment,
or runtime resource was committed.

## Fresh MetaDrive comparator

The actual comparator was `artifacts/wpd-metadrive-1`, freshly executed from this branch before
WP-D files were committed:

- Scenario `adas_cut_in_near`, schema 4.0, seed 7, 10 Hz, horizon 300.
- MetaDrive 0.4.3, source commit
  `85e5dadc6c7436d324348f6e3d8f8e680c06b4db`.
- Hermes clean repository commit `846e27fefd3ce5fd6ff7fe0442383c124f9b444e`.
- Baseline policy `adas-longitudinal` 1.0 digest
  `1e01c56e46beb4722015d336e8808849e0065b96fad562465870f2f152807da6`.
- Gate `adas_p0` 1.0 digest
  `026fed87eb047c4c9f2bafcf3383387919f2b0ed9874a0c67227c53f313175d8`.
- Shield `noop` 1.0 digest
  `44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a`.
- Scenario digest `989e948e5e49805125c895d21e889d33bc6c45b33c58cf151377888683b56904`;
  trace digest `e895022b0977ee6c8701a937e7995e7042b1720c2557aa47cbdabb019c256f14`;
  78 result events through 7.8 s.
- Final event tuple: `terminated=true`, `truncated=false`,
  `termination_reason=DESTINATION_REACHED`. Every earlier event is exactly
  `terminated=false`, `truncated=false`, `termination_reason=NONE`.

The parser verifies these identities, file hashes, trace continuity, result/input clocks,
recorded reset speeds/geometry, every terminal tuple, and the final trace digest before
comparing anything.

## Observed comparison

Geometry is computed from recorded oriented boxes. World velocities are projected into the
ego heading frame; bumper overlap is inclusive; TTC exists only for an actor ahead, in path,
with positive closing speed. esmini CSV has six decimal places (absolute quantization floor
0.5e-6); each timestamp must use the producer's canonical six-decimal spelling and equal its
`index / 10` value exactly in decimal arithmetic. Timing is the recorded 0.1 s grid with no
interpolation.

The matched longitudinal-like values are explicitly **route-axis proxies**, not exact
cross-backend world positions. MetaDrive's ego source is `VehicleState.position_m`, the
cumulative traveled path distance; its actor proxy adds the recorded actor-center longitudinal
offset relative to ego. esmini uses each recorded box center's world X relative to the initial
ego on this committed straight road.

| Observed event / metric | MetaDrive result geometry | esmini | esmini - MetaDrive |
|---|---:|---:|---:|
| First in-path sample | 1.5 s | 1.4 s | -0.1 s |
| First TTC <= 2.6 exposure | 1.5 s, TTC 2.496078 s | 1.4 s, TTC 2.315766 s | -0.1 s |
| Gap at first exposure | 19.444828 m | 20.470718 m | different sample times |
| Minimum TTC through 2.2 s | 1.792637 s | 1.720403 s | -0.072234 s |
| First executed brake | input 2.2 s → result 2.3 s, command 0.5 | no Hermes controller | n/a |
| Overall minimum TTC | 1.260313 s at 7.0 s | 0.0 s at 4.0 s | controller-confounded |

Through the first executed-brake input at 2.2 s, the maximum matched-grid differences were:

- actor lateral center: 0.000117 m (the cubic center interpolation is effectively aligned);
- actor route-axis proxy: 1.200002 m, first maximized at 0.5 s;
- ego route-axis proxy: 0.788105 m at 2.2 s;
- in-path bumper gap: 0.315335 m at 1.9 s;
- TTC: 0.362633 s at 1.6 s.

The 2.2 s cutoff is not a claim that everything before it is pure scenario translation:
MetaDrive already includes its baseline speed policy and vehicle dynamics, while esmini scripts
the ego at exactly 20 m/s. It is the last grid boundary before AEB braking adds a larger,
qualitatively different controller confound. All post-cutoff trajectory/TTC deltas are labelled
`CONTROLLER_RESPONSE_CONFOUNDED` in the JSON.

## What the disagreement means

1. **Center interpolation matches; oriented pose does not.** esmini yaws the actor along its
   lane-change path, expanding the actor box's projection into the ego lateral frame. Hermes
   teleports the lateral center while keeping road heading. That pose difference advances
   esmini's first oriented-box in-path sample from 1.5 s to 1.4 s.
2. **The 12 m/s constraint means different things.** esmini spends the scalar speed along the
   yawed path, reducing world-X progress during the lane change. At 2.0 s, its actor center is
   0.636778 m behind the independent `x0 + 12t` road-longitudinal command. Hermes commands that
   coordinate independently while replaying lateral position. This within-scenario observation
   does not turn the cross-backend route-axis proxy into an exact common world coordinate.
3. **Hermes has a first-interval alignment difference.** Result event 0 occurs at 0.1 s but
   retains actor replay step index 0, so the actor route-axis proxy is one 1.2 m interval
   behind the esmini time grid before the lateral maneuver.
4. **Ego/controller semantics differ.** esmini keeps the ego scripted at 20 m/s and has no
   Hermes FCW/AEB controller. MetaDrive runs the baseline policy and vehicle physics; the first
   executed brake uses the controller observation at 2.2 s and changes the result at 2.3 s.
5. **Exposure is not warning issuance.** MetaDrive first exposes TTC <= 2.6 at result time
   1.5 s. That result becomes the next controller input at input time 1.5 s (stored on the 1.6 s
   result event). The trace does not store FCW state, so no warning-timing claim is made.

These are useful fidelity-tier findings, not defects hidden behind a tolerance and not evidence
that one backend is more realistic.

## Determinism

Three clean native-arm64 executions produced identical bytes:

| Output | SHA-256 (same ×3) | Committed? |
|---|---|---:|
| Raw esmini CSV | `01b082d13364a1144bfcf9bf57c9f27b36c2ddd3d03543d082634f7e0d093972` | No |
| Path-free normalized trajectory JSONL | `ec251e5116733ae616c63405a6662987e0ee19e17a40e27092f8aceb7e9d3b20` | Hash only |
| Comparison JSON | `efc3c64432e05dc6ced3f9e1c41292c5e841f65551ccff2971fb697ebe3cd0d5` | Yes |
| SVG plot | `e5a9e2263bcf9cfb437a44f5c5abde0b26091f648247d16b04db93d792222e61` | Yes |

The committed whole-summary hash binds the exact pre-WP-D MetaDrive manifest and repository
commit. A newly generated comparator after these commits should reproduce the numerical
trajectory/timing findings, but its provenance-bound summary hash will intentionally differ.

## Observed, assumed, and not claimed

**Observed:** actual official producer bits, native arm64 execution, exact XOSC/XODR inputs,
raw CSV, actual Hermes events, oriented-box geometry, N=3 hashes, and the numbers above.

**Modeling choices / assumptions:** the straight road supplies a route-axis comparison proxy,
not an exact shared world-position frame; inline vehicle dimensions deliberately match
MetaDrive's default/traffic vehicle dimensions; the OpenSCENARIO lane-change primitive is the
closest explicit representation of Hermes's replay.

**Not observed or claimed:** physical-vehicle behavior, public-road safety, sensor behavior,
FCW warning issuance, certification, backend parity, cross-platform determinism, or production
suitability.

## Why no adapter was built

This audition answered the standards-fluency and translation-cost question without widening
Hermes's trusted evidence boundary. A full `EsminiAdapter` would additionally require:

- a new schema version with a named OpenSCENARIO/OpenDRIVE block and older-version strip list;
- adapter-literal and full adapter-seam widening, plus boundary-test registration;
- pinned producer distribution/licensing and supported-platform policy;
- controller/action injection semantics instead of scripted ego speed;
- verified mappings for reset state, front-object geometry, collision, route progress,
  termination, and simulator provenance;
- a complete independent verification mirror, artifact schema decision, replay/fixture strategy,
  failure-path tests, and digest re-baseline.

That cost is deliberately deferred until a real scenario family needs standards interchange.
No adapter, Hermes schema/source, dependency declaration, or WP-E item was changed here.
