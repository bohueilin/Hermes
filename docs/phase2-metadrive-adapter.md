# Phase 2 MetaDrive adapter

## Purpose and evidence status

This note records the MetaDrive 0.4.3 APIs inspected before implementing the
Phase 2 adapter and the resulting Hermes mapping decisions. The design preserves
the Phase 1 contract:

```text
policy proposes -> optional shield decides -> adapter executes -> trace records
-> offline verifiers evaluate -> release gate decides
```

The reconnaissance below is based on the vendored source, examples, tests, and
a read-only call to `MetaDriveEnv.default_config()`. The runtime acceptance
section records the subsequently observed real smoke, evidence, stored replay,
and repeat-seed results.

MetaDrive remains an external dependency. Nothing under
`third_party/metadrive/` may be modified.

## Inspected MetaDrive 0.4.3 surfaces

The following checked-in files were inspected at simulator commit
`85e5dadc6c7436d324348f6e3d8f8e680c06b4db`, which matches the current
`SIMULATOR_COMMIT` value:

- `metadrive/envs/metadrive_env.py`: `METADRIVE_DEFAULT_CONFIG`,
  `MetaDriveEnv.default_config()`, reward and done information, route success,
  and off-road logic.
- `metadrive/envs/base_env.py`: base configuration, lazy initialization,
  `reset(seed)`, `step(action)`, observation/action spaces, truncation, and
  `close()`.
- `metadrive/policy/base_policy.py`, `env_input_policy.py`, and
  `idm_policy.py`: policy construction, action format, clipping, reset, destroy,
  and IDM behavior.
- `metadrive/base_class/base_object.py` and
  `metadrive/component/vehicle/base_vehicle.py`: position, velocity, speed,
  current lane, collision flags, and on-lane state.
- `metadrive/component/navigation_module/node_network_navigation.py`: route
  localization and `route_completion`.
- `metadrive/examples/verify_headless_installation.py` and
  `verify_image_observation.py`: installation verification, physics-only versus
  offscreen rendering, and installed IDM usage.
- `metadrive/tests/test_env/test_metadrive_env.py` and
  `metadrive/tests/test_functionality/test_route_completion.py`: expected
  reset/step shapes, stable `info` fields, headless construction, and IDM use.
- `metadrive/version.py`: package version `0.4.3`.

### Environment API

Observed single-agent signatures are:

```python
observation, info = env.reset(seed=seed)
observation, reward, terminated, truncated, info = env.step(action)
env.close()
```

`reset(seed)` treats the seed as a scenario index and asserts that it lies in
`[start_seed, start_seed + num_scenarios)`. Reset also performs MetaDrive's lazy
engine initialization. `step` returns separate Gymnasium-style `terminated` and
`truncated` booleans. `close()` closes the process-global MetaDrive engine when
one exists. MetaDrive itself warns that only one active environment should exist
in a process, so Hermes must enforce a single owned environment and close it on
every success and failure path.

With `image_observation=False`, `BaseEnv.get_single_observation()` constructs a
`LidarStateObservation`; its numeric vector shape depends on configured sensors.
Hermes therefore does not assign version-independent meaning to vector offsets.
It maps verifier-relevant state from named vehicle accessors and named `info`
keys instead.

### Verified configuration keys

A read-only `MetaDriveEnv.default_config()` inspection returned the following
keys and defaults in 0.4.3:

| Key | Observed default | Phase 2 use |
| --- | --- | --- |
| `start_seed` | `0` | Set to the Hermes seed. |
| `num_scenarios` | `1` | Keep at one bounded scenario. |
| `map` | `3` | Adapter fixes the documented string block sequence to `"S"`; schema v1 has no map field. |
| `traffic_density` | `0.1` | Set to `0.0` for the bounded nominal run. |
| `random_traffic` | `False` | Keep `False`. |
| `accident_prob` | `0.0` | Keep `0.0`. |
| `horizon` | `1000` | Set from `scenario.control.horizon_steps`. |
| `random_spawn_lane_index` | `True` | Set `False`. |
| `agent_policy` | `EnvInputPolicy` | Retain external action execution. |
| `manual_control` | `False` | Keep `False`. |
| `discrete_action` | `False` | Keep continuous action mode. |
| `action_check` | `False` | Set `True` to reject malformed actions. |
| `image_observation` | `False` | Keep `False` for physics-only headless execution. |
| `use_render` | `False` | Keep `False`; no display window. |
| `physics_world_step_size` | `0.02` | Keep the verified physics step. |
| `decision_repeat` | `5` | Keep five physics steps per decision, yielding 0.1 s per action (10 Hz). |
| `force_destroy` | `False` | Leave at the default; Hermes owns explicit close. |
| `truncate_as_terminate` | `False` | Keep `False` so horizon remains truncation. |

The nested `vehicle_config` key `spawn_lateral` (default `0.0`) maps from the
scenario. Phase 2 intentionally accepts only `initial_state.speed_mps: 0.0` and
leaves the verified `spawn_velocity=None` default; other initial speeds fail
configuration validation. The nominal adapter accepts a 10 Hz scenario because
`0.02 * 5 = 0.1` seconds per decision; it rejects a frequency with no exact
integer decision repeat rather than silently falsifying simulation time.

The internal `_render_mode` key is explicitly marked by MetaDrive as not for
user configuration and is not set by Hermes. Physics-only headless operation is
`use_render=False` plus `image_observation=False`. Offscreen image rendering is
a different mode (`image_observation=True`) with additional graphics
prerequisites and is not required by the Phase 2 evidence path.

## Selected adapter configuration

The bounded nominal translation uses only the verified keys above:

- one scenario with `start_seed=<Hermes seed>` and `reset(seed=<same seed>)`;
- a deterministic string block map for the nominal route;
- no generated traffic or accidents;
- fixed spawn lane, zero initial speed, and scenario lateral offset;
- scenario horizon, continuous external actions, action validation, and the
  verified 10 Hz physics/decision cadence;
- no window, image observation, manual control, or offscreen camera; and
- explicit owned-policy destruction plus environment close.

The resolved, JSON-safe subset of this configuration is included in the Hermes
execution context. Python class objects such as `EnvInputPolicy` are recorded by
stable name rather than serialized by representation.

Schema v1 still requires `road.destination_distance_m` for cross-adapter
compatibility, but the Phase 2 adapter does **not** use its `20.0` value to define
MetaDrive route geometry. MetaDrive route length comes from the fixed `"S"` map,
and Hermes progress comes from the named `route_completion` signal. The 20 m
value must not be interpreted as the physical length of this MetaDrive run.

## Policy integration decision

Hermes retains MetaDrive's `EnvInputPolicy` as the environment policy so the
action passed to `env.step()` is the action that MetaDrive executes. After
`reset()`, the adapter separately instantiates the installed
`IDMPolicy(env.agent, seed)` and owns its lifecycle. Each control step is:

1. Call the owned installed IDM policy once against the current MetaDrive ego
   state to obtain the Hermes candidate.
2. Normalize, bounds-check, and round the command once to MetaDrive's float32 action precision.
3. Pass that candidate through the Hermes shield interface.
4. Translate the executed Hermes action to MetaDrive's action vector.
5. Call `env.step()` exactly once and record candidate and executed actions as
   distinct trace fields.

This wraps installed policy behavior without copying or modifying simulator
internals, while preserving Hermes's proposal/execution boundary. The adapter
destroys the separately owned IDM policy before closing the environment.

The wrapper sets both installed IDM speed fields from the scenario target:
`8.0 m/s` becomes `28.8 km/h`. It disables IDM lane changes for this single-lane
nominal integration run and leaves IDM deceleration enabled. Those settings,
the target in both units, the installed backend/version, and the clipping rule
are trace-bound policy configuration. They are not inferred after execution.

MetaDrive's `IDMPolicy.act()` returns `[steering, acceleration]` and may use
lidar, navigation, seeded lane-change timing, and an internal error fallback.
Hermes clips its output to the supported normalized action range and rounds it
to IEEE-754 binary32 before creating the strict candidate `Action`, so the trace
matches the checked MetaDrive action space exactly. The installed-policy path passed the real pinned
runtime smoke and nominal run. Its broad upstream internal exception fallback
remains an explicitly recorded limitation. Modifying or copying IDM internals
is not an option.

## Action mapping

MetaDrive 0.4.3 defines a continuous two-element action as
`[steering, throttle/brake]`, with both elements in `[-1, 1]`. A positive second
element is throttle and a negative second element is braking when reverse is
disabled.

Hermes uses separate strict fields:

```text
steering in [-1, 1]
throttle in [0, 1]
brake    in [0, 1]
throttle and brake cannot both be positive
```

The adapter mapping is therefore:

```python
metadrive_action = [
    hermes_action.steering,
    hermes_action.throttle if hermes_action.throttle > 0 else -hermes_action.brake,
]
```

The adapter does not contain gate logic and does not choose whether an override
is warranted. It executes only the already selected Hermes executed action.

## Observation, fact, and termination mapping

Named MetaDrive signals map to Hermes as follows:

| Hermes field | MetaDrive 0.4.3 source | Mapping and limitation |
| --- | --- | --- |
| `speed_mps` | `env.agent.speed` | Direct value in m/s. (`speed_km_h / 3.6` is an equivalent checked accessor.) |
| `position_m` | consecutive `env.agent.position` samples | Cumulative planar displacement since reset; this is not a global coordinate or odometer-grade signal. |
| `acceleration_mps2` | consecutive `speed` values | Deterministic finite difference at the configured 0.1 s cadence; it is derived, not a direct accelerometer signal. |
| `lateral_offset_m` | `env.agent.lane.local_coordinates(env.agent.position)[1]` | Direct signed offset relative to the current localized lane. Reset must match the scenario within `1e-6 m` or the run fails; the source and tolerance are trace-bound. |
| `route_progress_pct` | `info["route_completion"]` / `navigation.route_completion` | Normalize from the reset baseline to the remaining route, multiply by 100, and clamp to `[0, 100]`; the trace-bound mapping explicitly forbids a destination override. |
| `collision_count` | aggregate `info["crash"]` and component crash flags | Episode occurrence count (`0` or `1`), not a count of physics contact points. |
| `offroad` | `info["out_of_road"]` | Direct named termination fact. MetaDrive computes this from lane and configured line/sidewalk rules. |
| `destination_reached` | `info["arrive_dest"]` | Direct named success fact. |
| `front_distance_m` | no stable named adapter signal selected | `None`; evidence is `NOT_AVAILABLE` where a verifier requires it. IDM's private sensing is not reinterpreted as Hermes evidence. |
| `front_relative_speed_mps` | no stable named adapter signal selected | `None`; evidence is `NOT_AVAILABLE` with a reason. |

MetaDrive's reward/done path supplies named `info` keys including
`route_completion`, `crash`, `crash_vehicle`, `crash_object`,
`crash_building`, `crash_human`, `crash_sidewalk`, `out_of_road`,
`arrive_dest`, `max_step`, and `env_seed`. The installed black-box test also
checks `cost`, `velocity`, `steering`, `acceleration`, and `step_reward`.
Hermes consumes only the named signals needed by its simulator-neutral
contracts; it does not treat reward as safety evidence.

Termination reason precedence is deterministic and safety-first:

1. any aggregate collision -> `COLLISION`;
2. off-road -> `OFF_ROAD`;
3. destination success -> `DESTINATION_REACHED`;
4. `truncated` or `max_step` -> `HORIZON`; and
5. an unexplained MetaDrive termination -> fail the run as an operational error.

This ordering prevents simultaneous success or horizon flags from masking a
hard safety event. Unsupported signals are never synthesized as zero or pass;
they remain absent in observations and become structured `NOT_AVAILABLE`
evidence with a reason when evaluated.

The shared `ProgressVerifier` is version `1.1`. It requires both the independent
`destination_reached` fact and the configured numeric progress threshold. The
Phase 2 illustrative gate uses `95%` because the pinned simulator's named
`arrive_dest` geometry fired at `96.05972167673185%` normalized raw progress in
the accepted run. Hermes preserves that value rather than rewriting it to
`100%`. A horizon-truncated run at or above `95%` therefore remains `HOLD`; it
cannot receive `PASS` without the destination fact. This is shared mission
semantics plus a versioned configuration, not adapter-specific gate logic.

The verifier-version change intentionally makes older pre-1.1 prototype bundles
unsupported by the current stored verifier; regenerate them rather than treating
different mission semantics as the same verifier identity.

## Lifecycle and failure handling

- Importing `hermes` or using the fake adapter must not import MetaDrive.
  MetaDrive is imported only when the MetaDrive adapter is selected.
- A missing or incompatible dependency raises an actionable adapter error; it
  must not silently fall back to fake evidence.
- Environment construction, reset, policy construction, stepping, and artifact
  orchestration are enclosed by ownership that always calls policy `destroy()`
  when created and `env.close()` when created.
- `close()` is idempotent at the Hermes boundary and invokes both owned cleanup paths.
- A simulator exception is an operational failure, never a successful episode
  or fabricated terminal state.
- Stored artifact verification imports no MetaDrive runtime package or adapter code and never
  reruns the simulator. It reads only an import-safe, data-only declaration of the supported
  recorded profile.

## Provenance

For a MetaDrive run, the manifest and execution context must record:

- adapter name and adapter version;
- simulator name `metadrive`;
- imported package version from `metadrive.version.VERSION` (expected `0.4.3`
  for this pinned checkout);
- validated imported source path, with stable `third_party/metadrive` identity persisted;
- source Git commit from the containing MetaDrive checkout;
- the expected `SIMULATOR_COMMIT` value and whether it matches;
- resolved adapter and policy configuration digests; and
- the existing Hermes repository commit/dirty state, Python, platform, seed,
  scenario digest, gate digest, shield identity, and evidence schema version.

If the package version, source path, source commit, or expected commit cannot be
established consistently, Hermes must fail the run rather than fabricate
provenance. The observed checkout commit and `SIMULATOR_COMMIT` currently match,
but the runtime adapter must repeat that check for each evidence run.

## Determinism boundary

Hermes removes avoidable scenario variability by fixing the seed/scenario
index, map description, traffic, accident probability, spawn lane and state,
decision cadence, horizon, policy seed, and action path. The trace excludes
wall-clock time and uses the Phase 1 canonical hash chain.

This does not establish cross-platform bitwise determinism for Panda3D/Bullet
physics or floating-point execution. On the current macOS arm64 development
machine, two independent seed-7 runs produced byte-identical execution context,
events, metrics, findings, verdict, and trace root. The declared portability
tolerance remains exact categorical outcomes plus numeric state agreement within
`1e-5`; cross-platform byte identity is not claimed. Local SHA-256 chains remain
tamper-evident, not independently authenticated.

## Observed runtime acceptance evidence

- `hermes sim-smoke --headless`: exit 0; five headless IDM-controlled steps;
  MetaDrive `0.4.3`; source commit
  `85e5dadc6c7436d324348f6e3d8f8e680c06b4db`.
- `phase2-metadrive-nominal`: `PASS`, exit 0, destination reached after 165
  events / 16.5 simulated seconds, with trace digest
  `2b5009971c37c1eb65c9cc2830596689b5a25904a9b52b524d5bf77305848987`
  in the final post-edit acceptance run.
- Stored `hermes verify-artifact` replay: `INTERNALLY_CONSISTENT`, `PASS`, exit
  0, without constructing MetaDrive. A test bombs MetaDrive imports during the
  same stored-only verification path.
- Metrics observed: zero collisions, zero off-road time, `96.05972167673185%`
  normalized named route completion, max absolute acceleration about
  `2.7772 m/s^2`, max absolute jerk about `2.8324 m/s^3`, and simulated policy
  latency `10 ms`.
- A second seed-7 run produced the same trace digest and byte-identical
  deterministic evidence files listed above.
- Dependency-injected tests cover normal close, exceptional step cleanup,
  destination/collision/off-road/horizon mapping, missing dependency behavior,
  action mapping, and provenance capture without launching the simulator.
- `third_party/metadrive` was clean after runtime acceptance. Generated bundles
  remain ignored and unstaged.
