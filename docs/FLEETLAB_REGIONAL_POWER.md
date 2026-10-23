# Austin-inspired regional power rehearsal

Open **Fleet day → Regional stress lab: Austin power and readiness**. Choose full power,
60%, 20%, or outage/recovery, then **Run Austin shift**. The graph is synthetic; it does not
reuse Bay roads. **Compare Austin charging policies** runs capped redistribution versus
deadline/aged priority using identical external requests and power conditions in each pair.

Default inputs: 40 vehicles, two fictional sites, eight hours, 60 requests/hour, seed 42,
120 battery-side kW per site, eight ports and eight cleaning workers per site. Site A changes
capacity during `[90,180)`; Site B retains its nominal cap. These inputs exercise a large
energy/work backlog, not a calibrated or successful operating plan. No evaluation seed was
selected to produce a favorable result.

The registered primary remains **completion fraction over every request created before H**.
All-request within-target pickup is explicitly unavailable for this experiment. Deadline
readiness requires the entire serial visit. Review unfinished tasks, remaining charge targets,
zero-power occupancy, rejected proposals and terminal fleet energy alongside completion.
The four conditions are independent tests, not a fitted response surface.

## Model and interface map

| Concern | Existing behavior retained | N1 implementation |
|---|---|---|
| Lifecycle and demand | `playground/fleetlab/src/model/bay-operations.js` | Optional `region` network adapter and fixed depot identities; no default changes |
| Charging policy | `src/model/charging-allocation.js` under the playground | Existing proposals receive only the current scalar cap, jobs and time |
| Allocation and accounting | `src/model/bay-systems.js` | New `site-power.js` applies a validated external fraction before allocation, records cap/delivery and zero-power blockers |
| Regional topology | Bay and launch paths remain available | `src/model/region-package.js`: pinned five-node, five-edge schematic; meter-to-kilometer conversion and graph shortest paths |
| Demo configuration | No new engine | `src/model/regional-power.js`: versioned conditions, clipped to a shared setup's horizon |
| Paired evaluation | `src/model/bay-experiment-contract.js` | Existing primary, mean-harm guardrails, replay checks and disjoint seed contract; graph digest/source version bound into regional specs |
| Review and sharing | Native DOM, existing six main views | `src/ui/regional-power-view.js`, strict `regional-power` setup codec, current/last-run/last-experiment snapshots |

Paths abbreviated after the first row are relative to `playground/fleetlab/`.

`region-package-1.0.0` uses `tx-austin-schematic-1.0.0`; `site-power-profile-1.0.0`
has one named site and 1–48 contiguous, half-open integer-minute segments covering `[0,H)`.
Fractions must be finite within `[0,1]`. Unknown fields, sites, versions, overlaps and gaps
reject. At H no energy is delivered; the terminal frame retains the last cap for context.
No auxiliary loads, losses, taper or thermal mechanism is added. Resource truth, observations,
reservations and required work retain their existing semantics.

The source registry declares each input family synthetic and records units, coordinate basis,
transformation version, graph hash, missing measured fields and destination. Hashes provide
configuration identity, not authentication. A paired export includes the entire region/source
record once; each arm retains complete metrics, unfinished work and the power trace.

Changing settings leaves prior results explicitly labeled with their submitted condition.
Loading a shared setup never runs. Comparisons yield between complete simulation arms and
bootstrap steps; cancellation takes effect at those boundaries, not inside a synchronous arm.
One seed is descriptive; missing required metrics block analysis.

## Reproduce locally

From the repository root:

```bash
python -m http.server 8765 --bind 127.0.0.1 --directory playground/fleetlab
```

Open `http://127.0.0.1:8765/#/fleet-day` and expand the regional panel. Choose another port
if occupied. The preview stays on loopback.

Generate the fixed four-condition, 12-evaluation-seed rehearsal:

```bash
node tools/fleet_playground/regional_power_demo.mjs --out artifacts/fleetlab-regional-power/demo
```

This writes four complete experiment records, four strict setups and setup fragments, one
development-seed replay, and `observed-results.json`. There are 96 primary arms, 16 repeatability
probe arms, and one seed-42 development arm. The output is browser teaching data,
`NOT_EVIDENCE`, and never a Hermes evidence bundle.

```bash
node --test 'playground/fleetlab/test/*.test.mjs'
FLEET_PLAYGROUND_PERF=1 node --test playground/fleetlab/test/performance.test.mjs
node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-regional-power.html
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-regional-power.html
node playground/fleetlab/tools/pack.mjs --site dist/regional-site
node playground/fleetlab/tools/check-dist.mjs --site dist/regional-site
```

The application budget remains 2.5 MiB. No dependencies, map downloads, external data,
network permissions or publication settings were added. The file-writing rehearsal tool
lives beside the existing repository development tools, outside the read-only browser tree.

## Decision boundaries

Simulation only; deployment permission NONE. No new region beyond Austin, dataset acquisition,
Waymo affiliation, real airport access, calibration, safety case, tariffs, new optimizer,
Street coupling, launch commissioning changes or Python evidence-contract changes.

Measured validation, observed outcomes, review fixes and remaining limitations are recorded
in `HERMES_SOURCE_OF_TRUTH.md` §7.5 and the regional addendum to `CODEX_HANDOFF.md`.
