# Anonymous vehicle and curb readiness teaching model v1

29 September 2026. This is a separate deterministic calculator and direction-choice fixture, implemented in `apps/fleetlab-city/citylib/vehicle_readiness_v1.py`. It does not modify or execute the recorded SF experiment, vehicle profiles, routing, power study, simulator adapters, or published website. It has no file/network/vehicle interfaces. Its schema is `fleetlab.vehicle-readiness/1.0.0`.

The intended lesson is to distinguish inputs we need from assumptions we can vary. Source references do not calibrate the anonymous calculator. Results are `ILLUSTRATIVE_CALCULATION`, `SIMULATION_ONLY`, `NOT_AUTHENTICATED`, authorization `NOT_EVALUATED`, deployment permission `NONE`. There is no gate verdict or operator recommendation.

## Explicit-input station sensitivity

`station_sensitivity(inputs)` evaluates one focal vehicle: complete a specified service block from the starting energy, then charge while stationary to the target energy. The site has a fixed declared number of concurrent active ports. Their grid-power shares are equal, and unused capped power is not redistributed. This is arithmetic, not a queue model or an eight-hour fleet simulation.

Every field is required. Omitted or `None` inputs return `NOT_AVAILABLE`, a list of missing fields and null computed quantities. No teaching default is silently inserted. Invalid types, unknown keys, nonfinite values and bounds violations raise `ValueError`. Booleans are not numbers and port counts must be integers. Field names specify units; no automatic unit conversion occurs.

| Field | Meaning | Supported teaching range |
|---|---|---|
| `distance_km` | Distance in one service block | 0–10,000 km |
| `battery_kwh_per_km` | Battery-side moving consumption, excluding separately modeled auxiliary draw | 0.001–5 kWh/km |
| `service_hours` | Total service-block duration exposed to the declared auxiliary draw, including dwell if included in the supplied block | 0–168 h; must be positive if distance is positive |
| `aux_battery_kw` | Constant battery-side auxiliary load during that block | 0–100 kW |
| `usable_capacity_kwh` | Declared available pack energy | 1–1,000 kWh |
| `start_kwh`, `target_kwh` | Starting and final target battery energy | 0–1,000 kWh, with start ≤ target ≤ usable capacity |
| `site_grid_kw` | Station-wide grid-side power limit | 0.001–100,000 kW |
| `ports`, `active_ports` | Installed and concurrently active port counts | Integers 1–10,000, active ≤ installed |
| `port_grid_kw` | Focal port's grid-side limit | 0.001–2,000 kW |
| `vehicle_acceptance_battery_kw` | Constant battery-side acceptance limit | 0.001–2,000 kW |
| `charging_efficiency` | Battery-delivered energy / grid-supplied energy | 0.000001–1 |

These bounds control the teaching interface; they are not manufacturer capabilities or engineering safety limits. Input snapshots are copied into the result. Functions do not mutate caller data.

For distance `d`, battery moving intensity `e`, service duration `h`, auxiliary power `a`, efficiency `η`, and concurrent active ports `n`:

```text
service battery energy E = d × e + h × a
energy after service B = start − E
effective battery power P = min(site_grid_kw / n × η,
                                port_grid_kw × η,
                                vehicle_acceptance_battery_kw)
battery recharge C = target − B
grid recharge G = C / η
charging losses = G − C
charging hours = C / P
cycle hours = service hours + charging hours
start + C − E = final = target
```

If `E > start`, the result is `NOT_FEASIBLE` with the energy deficit. After-service/final energy and charge time remain null; the calculator does not create negative battery energy or invent a mid-service charge stop. It does not infer a reserve margin, road route or return-to-depot energy. Those must be represented in the supplied service block or tested elsewhere.

`site_grid_saturation_kw = n × min(port_grid_kw, vehicle_acceptance_battery_kw / η)` is the focal vehicle's site-power crossover at the fixed declared occupancy. Above it, more site power cannot improve this vehicle's charge time under the stated equal-share rule. Exact limiting terms are returned in `bottlenecks`; ties are retained. `unused_grid_share_kw` is unused power in the focal vehicle's share, not an observed total-site power measurement.

`service_time_fraction` divides the explicitly supplied service-block duration by service-plus-charge duration. It is null for a zero-duration cycle. It is not passenger utilization, all-day vehicle availability or fleet throughput; changing the start/target policy can change this one-cycle quantity. There is no pooling, dispatch, waiting, cleaning, charge taper, SOC/temperature dependence, charging-time auxiliary load, site electrical engineering or operational forecast.

### Hand-computed anonymous example

An explicitly supplied 40 km service block at 0.2 battery kWh/km, lasting 2 h with 1 kW auxiliary load, consumes 10 kWh. Starting at 30 kWh leaves 20. Recharging to 40 kWh requires 20 battery kWh. With 100 grid kW shared by two active ports, a 60 grid-kW port limit, 50 battery-kW acceptance and 80% charging efficiency, effective battery power is 40 kW. Recharge takes 0.5 h and draws 25 grid kWh, including 5 kWh loss. These are synthetic inputs, not a named vehicle's characteristics.

Do not map an EPA/WLTP consumption label into `battery_kwh_per_km` by unit conversion alone. The [EPA test procedure explanation](https://www.fueleconomy.gov/feg/pdfs/EPA%20test%20procedure%20for%20EVs-PHEVs-11-14-2017.pdf) includes charger losses in recharge energy and describes label adjustments. Battery energy, wall energy, moving consumption and auxiliary consumption must have compatible measurement boundaries. Do not add auxiliary load twice.

## Direction-flexibility fixture

`direction_fixture(inputs)` accepts a fixed `body_heading_deg` (clockwise from north, in `[0,360)`), a declared `bidirectional` boolean, vehicle/bay length and width in metres, and 1–8 explicit exit choices. Vehicle dimensions are bounded to 0.01–50 m long and 0.01–10 m wide; bay dimensions to 0.01–1,000 m. The bay rectangle's axes are aligned with the body. It is a static fit comparison, not a path/steering model.

Each exit has a unique nonempty `id` of at most 80 characters, `heading_deg`, motion `forward` or `reverse`, boolean `permitted`, explicit `dwell_s` in 0–86,400 s, and `dwell_basis` of `USER_SUPPLIED` or `MEASURED_USER_SUPPLIED`. The latter records the caller's assertion; measurements and permissions are not authenticated or legally verified. Missing exit inputs produce a null cost and `NOT_AVAILABLE`.

Forward travel has the same heading as the body; reverse travel has body heading plus 180 degrees modulo 360. Body yaw never changes. A permitted exit with a different heading remains unavailable because turning is not modeled. `bidirectional=True` cannot grant a prohibited exit, and `bidirectional=False` cannot prevent an explicitly permitted conventional reverse movement. Declared direction flexibility, permission and four-wheel steering are separate concepts.

The output preserves every exit choice and its reason. It does not automatically choose the fastest option or report a winner. Dwell is a supplied cost, not a prediction of driving, boarding or switching time. Static nonfit blocks available options. Exactly equal rectangles produce zero spare dimension but still do not establish maneuver feasibility. Total longitudinal/lateral margins are spare lengths, not measured side clearances or safety margins.

`geometric_maneuver_feasibility` is always `NOT_EVALUATED`. No travel path, speed, steering, swept footprint, obstacle, door, wheelchair-access aisle, curb height, grade, pedestrians, tire/contact physics or collision risk is modeled. A later computed maneuver lesson requires independently checked geometry, motion primitives and swept-path validation; the present fixture must not be renamed as that model.

## Public references and remaining inputs

| Reference | Usable context | Not established |
|---|---|---|
| [Waymo Ojai introduction](https://community.waymo.com/blog/2026/05/welcoming-riders-in-the-ojai/) | Qualitative doors, low step, flat floor and rider/accessibility design | Calibrated battery, charging, dimensions, dwell, four-wheel steering or bidirectional performance |
| [Zoox's 2020 launch release](https://www.globenewswire.com/news-release/2020/12/14/2144364/0/en/Zoox-Reveals-First-Look-at-Autonomous-Purpose-Built-Robotaxi.html) | Dated manufacturer claims: 3.63 m length, 133 kWh battery and four seats, with bidirectional/four-wheel-steering design | Current-generation usable energy, actual service endurance, charge curve, dimensions/steering envelope or productivity advantage |
| [JLR 2019 I-PACE announcement](https://media.jlr.com/corporate/en-us/news/2018/03/2019-jaguar-i-pace) | Retail nominal 90 kWh and approximate charging reference; model-specific geometry | Operator-modified usable capacity, battery-side fleet energy or constant charge acceptance |
| [DataSF Curbs and Islands metadata](https://data.sf.gov/api/views/emxt-b6yg.json) | Official PDDL historical reference geometry | Current as-built curb/site geometry; source explicitly warns the drawings may differ from built conditions |
| [SFMTA white-zone guidance](https://www.sfmta.com/getting-around/drive-park/loading-and-short-term-parking/white-zonespassenger-loading) | Loading rules and posted time-window context | A measured dwell distribution or site/vehicle maneuver permission |
| [2018 SF curb study by Fehr & Peers for Uber](https://www.fehrandpeers.com/wp-content/uploads/2025/04/SF_Curb_Study_2018-10-19_low-res.pdf) | Historical timed observations and a useful measurement method | Current AV boarding/exit dwell, unrestricted raw-data reuse, or present-day site calibration |

The research inventory is in `build/fleetlab-city/research/vehicle-curb-r1/RESEARCH_NOTES.md`, with exact endpoint metadata and retrieval hashes in its capture manifest. Manufacturer pages and study reports are linked as references; no third-party artwork or site plan is reused. Public SFMTA ArcGIS curb inventories inspected in that research have blank/unresolved license fields and historical vintages; do not treat them as a newly licensed current source.

SUMO is appropriate for a separately qualified interacting-traffic/curb-capacity question; its documented parking maneuver duration option is not a four-wheel-steering swept-path solver. MetaDrive needs a qualified scene/vehicle adapter for driving scenarios. MuJoCo needs measured physical models for contact/actuator questions. None of those systems is called by this module.

## Fixed public lesson projection and renderer

`citylib/model_lessons_v1.py` exports `build_model_lessons()` and `verify_model_lessons(data)`. The builder calls the anonymous calculator for twelve explicit cases: site grid limits of 100, 200, 400 and 800 kW crossed with battery acceptance of 20, 40 and 80 kW. Every case declares eight installed/active ports rated 50 grid kW, 0.9 charging efficiency, 60 kWh usable capacity, 30 kWh start, 48 kWh target, 40 km service distance, two service hours, 0.2 battery kWh/km and 1 battery kW auxiliary draw. These are schematic sensitivities, with no city/route/demand or named vehicle input.

All cases therefore consume 10 battery kWh and charge 28 battery kWh, drawing 31.111… grid kWh and losing 3.111… kWh. At 100 site kW, battery power is 11.25 kW and charging takes 2.48888… h. At 800 site kW with 80 kW acceptance, the port limits battery power to 45 kW and charging takes 0.62222… h. At 20 kW acceptance, the site crossover is 177.777… kW; above that site limit, the acceptance cap remains binding. These decimal expansions illustrate the equations; exact machine values remain in the projection.

The three exit fixtures show forward-only permission, conventional permitted reverse, and forbidden reverse despite declared bidirectionality. Original synthetic 4 × 2 m vehicle rectangles sit in aligned 6 × 3 m bay rectangles with a fixed 90° body heading. Forward (90°) and reverse (270°) costs are explicitly supplied 12 s and 4 s teaching assumptions. Those costs are not measurements, and the renderer makes no path-clearance or safety conclusion. The CSS rectangles are schematic and labeled with their input dimensions; their rendered pixel dimensions are not a geometry calculation.

The public schema is `fleetlab.model-lessons/1.0.0`. It includes twelve station cases, three direction cases, limitations, primary context references, trust states and a SHA-256 `content_digest` computed with existing canonical JSON. Verification checks the digest, exact reproducibility of the fixed population and inputs under the core, and energy/power-time ledger identities. Re-digesting altered examples does not make them pass. `INTERNALLY_CONSISTENT` means those checks passed; it is not a source-authenticity or real-world validation claim.

The independent `web/model-lessons.mjs` exports `validateModelLessons(data)` and `mountModelLessons(host, data)`. The latter returns a cleanup function. The renderer uses precomputed results, accessible selects, cream/teal cards, site → ports → battery diagrams, a loss/time/energy ledger, permission arrows, and expandable exact assumptions/equations. All content enters through DOM text, with HTTPS-only source references. Invalid replacement data clears the prior display and throws; explicit null outputs display as unavailable. Browser validation checks presentation shape and permission consistency, not the numerical equations, digest authenticity or physical model. The Python builder is the arithmetic verification boundary.

`web/model-lessons.css` is scoped under `.model-lessons` and adapts to narrow screens. Integration of navigation, imports, packaging and data export belongs to the parent task. This addition does not regenerate the live package or run a fleet simulation.

## Validation

Tests were written first and all 18 original tests failed because the calculator did not exist. Implementation then passed those cases. An additional large-number rejection test failed on an overflow and passed after bounds were checked before float conversion. The resulting 19 focused tests cover conservation, loss boundaries, power bottlenecks/crossover, unavailable/invalid inputs, energy infeasibility, determinism, nonmutation, static dimensions and direction/permission separation.

Focused commands (from the repository root, after creating the documented city virtual environment):

```bash
build/fleetlab-city/venv/bin/python -m unittest discover -s apps/fleetlab-city/tests -p 'test_vehicle_readiness_v1.py' -v
build/fleetlab-city/venv/bin/python -m unittest discover -s apps/fleetlab-city/tests -p 'test_model_lessons_v1.py' -v
node --test apps/fleetlab-city/test/model-lessons.test.mjs
```

With the repository development environment active and its Ruff dependency installed, run `python -m ruff check` on the two new Python modules and their two test files. The calculator/projection tests use only the Python standard library.

The projection's three Python tests first failed without its implementation, then passed. Six browser tests first failed without the renderer, then passed using actual Python-generated projections: fixed population validation, malformed/duplicate/missing cases, unavailable quantities, unsafe URLs, text escaping, selection changes, explicit reverse permissions, cleanup and stale-result removal. These are DOM behavior tests; integrated browser visual review belongs to the parent task.

At authoring: 22 focused Python tests and six browser tests passed; scoped Ruff passed. Broader integration gates are reported by the parent task before any completion/publication claim. No scientific study was run, frozen artifact changed, existing website integration edited, commit created or remote action performed by this addition.

## Recommendation

Use this as an anonymous input-readiness and bottleneck lesson after the SF acceptance decision. Keep named products in reference cards until compatible measured inputs and rights are available.

## Top risks + mitigations

Keep wall/battery boundaries explicit to prevent double-counted energy. Keep source context separate from quantitative calibration. Label the direction fixture's output as a static choice illustration so permission and footprint fit cannot become maneuver or safety evidence.

## Next 3 actions

1. Review and integrate these independent functions without changing frozen SF studies.
2. Collect compatible battery-side, charging and event-defined dwell measurements before introducing measured classes.
3. Qualify one bounded California municipality and any future geometric maneuver model separately.
