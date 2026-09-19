# FleetLab operational simulation handoff

Updated 2026-09-19 UTC. This extends the 2026-09-18 website redesign under the owner's explicit follow-up request. It does not execute a Phase 6 evidence workbench implementation or change its contracts.

## Outcome

Implemented a new individual-vehicle fleet day, replay/step controls, time/weather/demand/energy configuration, sequential finite-resource depot work, capacity comparisons, a complete learning catalog, and an optional local Google traffic companion. Researched CARLA's reusable capabilities, version/hardware constraints, weather semantics and licenses. All work is local and uncommitted.

| Requested capability | Delivered | Boundary |
|---|---|---|
| Cute, clear cars | Code-native cars with cabin, windows, tires, lights and sensor pod; every car corresponds to a modeled vehicle; zoom/pan on phone | Invented street geometry; no lane or collision physics |
| Movement and each step | Explicit run begins replay; pause/play, minute step, next activity, stage seeking, speed and scrubber; selected-car trail and full table | One-minute model; intermediate motion is illustrative |
| Google traffic prediction | Separate Routes API companion with chosen route, future departure and three traffic models; attributed non-map result | Requires server-side key/billing; no live request verified; does not feed the synthetic map |
| Fleet / trips / time / weather / depots | Editable assumptions; same-demand fleet and 1–6 depot sweeps; completed trips per AV and explicit unmet target | Bounded comparison, not a globally optimal or calibrated site plan |
| Depot service time | Scheduled software → cleaning → power-limited charging → upload; finite stations, stage queues, shared site power; completed on-site/work/queue means | Fixed service times except charging; no staff, charge taper, actual updates or bandwidth model |
| Clear simulation list | 42 searchable, runnable lessons and examples; question, change, watch, learn and limits for each | 10 new operational lessons and all 32 existing regional presets use two different models |
| CARLA reuse | Primary-source decision brief covering Traffic Manager, sync/seeds, sensors/weather, recorder, ScenarioRunner and SUMO | Research only; no CARLA installation or run |

## Repository state

- Worktree: `/Users/bohueilin/Documents/GitHub/Hermes-playground`.
- Branch: `feat/fleetlab-playground`.
- Unchanged HEAD: `fb07b66ddaa786020f2176efdb82727bd55c5d4b`.
- The earlier redesign was already uncommitted and has been preserved.
- The original task worktree `/Users/bohueilin/Documents/GitHub/Hermes-fleetlab` remains clean on its existing Phase 9 branch.
- No commits, staging, pushes, PRs, deployments or remote writes. The previously supplied public URL remains unchanged.
- No evidence artifacts were ingested or changed. No physical/production vehicle interface, simulator installation, cloud account, telemetry or persistence was added.

## Architecture and model contract

```text
Explicit Fleet day settings + seed
  → operations.js: deterministic minute model
  → frames / events / visits / request metrics / bounded capacity trials
  → operations-lab.js: user controls and result projections
  → operations-map.js + car-glyph.js: schematic and recorded-car motion
```

`fleetlab-operations-1.0.0` is a separate model. Existing regional model/instrument/runtime implementations and golden fixtures are unchanged. The studio routes between them; it never combines their results into one recommendation. The regional Run window now autoplays only while the submitted scenario/mode and playback intent remain current. Pause, seek, step, jump, navigation and edits suppress pending autoplay; reduced motion stays paused.

Requests conserve the population: completed + unserved + waiting + in progress = all requests. A car has one state at every frame. Finite stage resources cap simultaneous work, charging respects both port and site power, and energy is reconciled. Final-frame completions are processed without starting new assignments or service. Means are null when no eligible completed population exists.

On-site depot time excludes the drive back to the depot and includes waiting. Total turnaround additionally includes return travel. Active work excludes both travel and waiting. Stage averages cover stages in completed visits; unfinished visits are counted separately. No result is imputed beyond the horizon.

Demand and request-keyed trip variation are identical across a capacity sweep. Fleet sweeps test approximately 0.5×, 1×, 1.5× and 2× the current fleet, bounded to 1–120. Depot sweeps test 1–6 sites with per-site resources held constant, so adding sites also adds power/bays. The target is 95% completed requests by the horizon, including late arrivals. Zero-demand fractions are unavailable. A first sufficient tested count can be absent; no monotonic gain or optimality is assumed. Tables show the explicit target state alongside rounded completion percentages.

Weather, rush-hour effects, energy, geography and service times are synthetic. The full model assumptions appear in the traffic/weather disclosure after a run. Pickup durations do not depend on actual vehicle distance. Rain/heat change multiple inputs; the animation is not physical validation.

## Worked default run

24 AVs, two depots, eight hours starting 07:00, 30 base requests/hour, clear weather, seed 42. Computed locally with 481 frames and 958 events:

| Metric | Exact computed value |
|---|---:|
| Requests | 284 |
| Completed trips | 131 |
| Unserved | 144 |
| Waiting at end | 4 |
| In progress at end | 5 |
| Completed trips per starting AV | 5.458333333333333 |
| Completed-trip mean wait, min | 10.977099236641221 |
| Completed depot visits | 24 |
| Unfinished depot visits | 19 |
| Mean completed on-site depot time, min | 156.91666666666666 |
| Mean active work per completed visit, min | 87.54166666666667 |
| Mean completed turnaround including depot travel, min | 162.70833333333334 |
| First sufficient depot count in 1–6 | Not available |

Charging explains much of this example's delay: completed-visit charging averages 72.54166666666667 active minutes and 62.5 queued minutes. These are demonstration results, not operator benchmarks. The non-cryptographic demand diagnostic is `d6b5f6ad`; it is not an authenticated evidence digest.

## Validation

| Check | Observed result |
|---|---|
| `node --test playground/fleetlab/test/*.test.mjs` | 1,518 passed, 0 failed, 2 skipped, 1 todo; 1,521 total |
| New model tests | 22 passed; determinism, request/car conservation, stage/resource caps, battery/power/energy, horizon, weather/time, same-demand comparison and absent means |
| `node --test tools/fleetlab-traffic/test/*.test.mjs` | 14 passed; mocked provider only, actual local HTTP exercised |
| Python playground parity/boundary tests with `FLEET_PLAYGROUND_BASE=bca4ccd` | 89 passed |
| `python -m ruff check .` | Passed |
| `python -m hermes doctor` in `hermes-dev` | 17 PASS, 1 dirty-worktree WARN, 1 optional NOT_AVAILABLE |
| `git diff --check` | Passed |
| Independent model review | Approved after fixing a terminal-minute depot launch |
| Independent UI review | Both material findings resolved: pending autoplay intent and structured UC-10 catalog values; final focused suite 86 passed |
| Independent companion review | Approved; attribution, fixed endpoint/schema, local guards and key handling reviewed |
| Desktop/phone browser review | 1280 px and 390 px checked; no horizontal page overflow; default run contains 24 vehicle elements; movement, pause, charge/software seeking, resource details, capacity tables, search/launch and zoom exercised |
| Packaged browser smoke | Static site and single-file package both ran; no console errors/warnings in inspected sessions |

The wider repository Python regression is **not green**. The preceding redesign run found missing historical evidence fixtures: 186 failed, 1,433 passed, 1 skipped, 55 deselected and 42 setup errors. Those outputs are preserved in `artifacts/fleetlab-redesign-review/`; this wave changes no Python core or historical fixtures and does not claim to repair them. This is why no commit or publication is presented as fully repository-validated.

Latest logs and screenshots: `artifacts/fleetlab-operations-review/`. Earlier design audit and screenshots remain separately under `artifacts/fleetlab-redesign-review/`. Review working papers are under `.superpowers/sdd/2026-09-19-fleetlab-operations-lab/` and are not application assets.

## Local packages and preview

- Static site: `dist/site/`, 52 files, 1,195,862 bytes.
- Single offline file: `dist/fleetlab-playground.html`, 1,616,883 bytes, below the 2 MB limit.
- SHA-256 of the single file: `7183c26451ca935d9cad8b89a48e6d28fccc6c312d53861b4578754fa26d35b9` (build identity, not signed evidence).
- Both pack checkers passed policy, files/URLs, tokens, copy and required-label checks.
- Current site preview: `http://127.0.0.1:8767/site/`.
- Current single-file preview: `http://127.0.0.1:8767/fleetlab-playground.html`.
- Optional unconfigured traffic companion: `http://127.0.0.1:8768/`.
- No new dependency or network access enters the default site/offline package.

The companion was started with its key explicitly removed from the process environment. Its button is disabled while unconfigured. No key was accessed and no paid Google request was made. Live coverage, response accuracy and applicable operator account/policy prerequisites remain unverified. See [Google setup and CARLA research](FLEETLAB_GOOGLE_TRAFFIC_CARLA_RESEARCH.md).

## Hiring-manager demonstration

1. **Frame the customer decision:** a market lead needs enough rider service; a depot lead needs readiness without moving queues elsewhere.
2. **Run a day:** follow a car, step into charging, open depot resource details, and distinguish active work from waiting.
3. **Test a capacity assumption:** compare fleet/depot sizes on identical demand. Explain why unmet targets and late requests remain visible.
4. **Show rigorous experimentation:** open the regional four-versus-six cleaning bay example and inspect paired outcomes, uncertainty and guardrails.
5. **Name the roadmap:** operator research, calibrated inputs, staffing/charging fidelity, held-out error assessment, versioned site configuration and commissioning API.

This demonstrates independent product/technical reasoning relevant to Fleet Operations and Fleet Optimization. It does not establish commercial fleet ownership, operator adoption, validated business impact or production autonomy experience. The [complete simulation guide](FLEETLAB_SIMULATION_GUIDE.md) documents all 42 examples.

## Recommendation

Use this local version for design review and a first-time-user comprehension session. Keep CARLA as a separate future pilot only when a lane/sensor/interaction question requires its fidelity. Keep the optional Google estimate visibly separate until configured and validated.

## Top risks + mitigations

- **Visual realism mistaken for accuracy:** retain synthetic assumptions, model/version boundaries and absent-population disclosures; calibrate against approved data before operational use.
- **Incomplete Google integration:** configure the server-side API and applicable account/policy prerequisites, then verify one authorized request. The synthetic map remains independent.
- **Repository validation gap:** restore historical fixtures in a separate task before claiming full repository regression or preparing a commit/release.

## Next 3 actions

1. Review the Simulation and Learning catalog in the refreshed local preview; use the demonstration path above.
2. Supply configuration through a local secret mechanism if Google route estimates are desired; do not paste a key into the website or source.
3. Run a small operator/hiring-reviewer comprehension study, then prioritize calibration and depot-resource fidelity from observed confusion and decisions.
