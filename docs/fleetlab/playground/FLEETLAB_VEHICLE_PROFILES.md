# FleetLab vehicle profiles and Bay Area operations

The Bay Area operations model uses real, frozen OSM road geometry and editable synthetic fleet assumptions. Jaguar I-PACE and Ojai names identify vehicle silhouettes and sourced public context. They do not validate the model's battery, energy, charging, boarding or service-time values, and they do not create a performance advantage by themselves.

## Published context versus model inputs

Jaguar's March 2018 introduction of the 2019 retail I-PACE describes a nominal 90 kWh battery and approximately 0–80% charging in 40 minutes on a 100 kW DC charger. These are retail reference statements. They do not establish the usable energy, charge-acceptance curve, condition or configuration of a Waymo fleet vehicle. [Jaguar primary source](https://media.jlr.com/corporate/en-us/news/2018/03/2019-jaguar-i-pace).

Waymo's May 2026 Ojai introduction describes elevator-like doors, a low step, flat floor and sixth-generation Waymo Driver. It does not publish the usable kWh or charging kW required by this model. The Ojai numbers below are illustrative; they are not inferred from another vehicle such as Zeekr MIX. [Waymo primary source](https://waymo.com/blog/2026/05/welcoming-riders-in-the-ojai/).

Waymo's seating page states a maximum of four riders and shows both I-PACE and Ojai. FleetLab therefore gives neither type an extra rider-capacity multiplier. A modeled request represents one party of up to four riders; there is no pooling. [Waymo seating](https://support.google.com/waymo/answer/9059053?hl=en-GB).

## Editable teaching defaults

Every quantitative operational value in this table is a model assumption. They support sensitivity experiments, not real-fleet estimates.

| Parameter | Jaguar I-PACE | Ojai | Interpretation |
| --- | ---: | ---: | --- |
| Model usable battery | 84 kWh | 90 kWh | Available modeled pack energy; not verified fleet usable capacity |
| Vehicle charge acceptance | 100 kW | 150 kW | Constant upper cap before port and site limits; no taper |
| Moving energy intensity | 0.24 kWh/km | 0.27 kWh/km | Applied to modeled road distance and weather factor |
| Rider boarding | 2 min | 2 min | Stationary time, independent of road speed |
| Cleaning multiplier | 1.00 | 1.25 | Scales configured base cleaning duration |
| Software multiplier | 1.00 | 1.00 | Scales configured software duration on scheduled visits |
| Upload multiplier | 1.00 | 1.20 | Scales configured upload duration |

The initial mix is 50% Ojai. Integer allocation uses `round(fleet_size × ojai_share_pct / 100)` Ojai vehicles, with the rest I-PACE, and actual counts are reported. Each type occupies one vehicle and one resource slot. Visual silhouette size does not change road speed, bay capacity or passenger capacity.

Profiles require both known types and reject unsupported parameter keys. Bounds: battery 1–300 kWh; acceptance 1–500 kW; intensity 0.01–3 kWh/km; boarding 0–30 minutes; service multipliers 0.1–10. Road speed is a shared 5–100 km/h assumption, initially 38 km/h. Other inherited operational bounds remain in force. Each run deeply clones the supplied configuration.

## What the simulation measures

Default geography includes all 18 documented city/airport anchors. At least two distinct known places must be selected. Source places retain their representative coordinates; road motion and parked vehicles use their separate `road_anchor` coordinates. Depot sites are hypothetical, co-located with selected road anchors, and distributed north-to-south. With more depots than selected places, multiple independent illustrative sites can share an anchor. Visits select among equally near sites by the fewest unfinished inbound and on-site visits, with stable depot-order ties. Selection never chooses a farther site, and dispatch reserves the same minimum return distance. There are no fabricated connectors or inferred commercial service zones. See [map data and limitations](FLEETLAB_BAY_AREA_MAP_DATA.md).

Demand origin is uniform across selected places. Destination weights are `1 / (2 + route_distance_km)^1.5`, favoring nearer destinations while keeping every other selected place eligible. Arrivals depend on seed, clock, weather and demand controls. Fleet count, depot count and vehicle profile do not change generated requests. Request processing is FIFO, choosing the nearest available energy-feasible car with stable car-order ties; an infeasible earlier request may remain queued while a later feasible request is served.

Moving duration is `ceil(distance_km / road_speed_kph × 60 × synthetic_traffic × weather_travel_factor)`, calculated at each leg departure. Neither vehicle name changes road speed. The two types can differ in boarding time, modeled battery, energy intensity, charge acceptance and depot work. Same-anchor legs take zero minutes and zero energy; zero-duration transitions settle before a replay frame is captured.

Energy is distance-proportional and spread uniformly over each moving leg's minute intervals. Dispatch reserves enough individual-vehicle energy for current-location pickup, passenger travel, nearest-depot return and the configured SOC reserve. An initial depot trip must also preserve reserve. If no vehicle can cover a request, it remains waiting or expires; the model never fabricates a journey or negative battery.

Charging allocates equal site-power shares among active ports, then caps each share by port rating, vehicle acceptance and remaining energy to target SOC. Unused capped shares are not redistributed. Charging time is measured from delivered energy. No taper, HVAC/standby draw, battery aging, thermal derating or regenerative physics is modeled.

Depot flow is scheduled software → cleaning → charging → upload. Per-type multipliers scale fixed software, cleaning and upload durations; charging follows actual allocated energy. Each vehicle uses one state/resource at a time. Bays, ports and site power are finite per depot.

The synthetic clock has 07:00–10:00 and 16:00–19:00 demand peaks and a 1.25 travel factor, multiplied by the traffic control. Rain uses travel ×1.30, energy ×1.12 and demand ×1.12; heat uses ×1.05, ×1.25 and ×1.05. These are teaching assumptions, not external traffic data. Travel and horizon round up to minutes; the start clock rounds to the nearest minute and wraps at midnight.

## Metric populations and limits

- Requests partition exactly into completed, unserved, waiting and in progress. In progress includes pickup, boarding and passenger travel.
- Completed wait measures request arrival to vehicle pickup arrival; it includes pickup driving and excludes boarding. Patience applies to waiting for assignment, not total pickup wait. Broad-region demand can therefore produce pickup waits longer than the patience setting; this is an explicit policy limitation.
- Completed trip time includes boarding plus passenger driving, excluding pickup. Moving and boarding components are separately recorded.
- Completed depot turnaround includes depot-bound driving, queueing and service. On-site time begins at depot arrival. Active service excludes travel and queues.
- Means use completed populations only and are null when that population is absent. Unfinished trips and censored visits remain visible, so completed-only means cannot be presented as all-work turnaround estimates.
- Energy counters include every observed moving/charging interval, including incomplete legs. Initial energy plus delivered minus consumed reconciles to final fleet energy.
- Type metrics report actual count, completed trips, trips per vehicle, moving distance, consumed energy and delivered energy. Place metrics attribute demand outcomes to pickup origin, not jurisdiction coverage.

`analyzeBayAreaCapacity` tests bounded fleet counts and depot counts 1–6 on the same generated demand. A minimum means the first tested depot count reaching 95% completed/all requests under that scenario; it is not a global optimum. Null means no tested count met the target, including the zero-demand case. More depots also add service capacity and site power.

`analyzeVehicleMix` tests 0%, 50% and 100% Ojai with the same demand, fleet count, speed rule and depot resources. Differences result from the declared parameter values. Identical profile parameters produce identical aggregate trip and energy results regardless of label. A branding comparison is not evidence of real vehicle throughput.

The isolated Bay model leaves the original synthetic `operations.js` unchanged. Legacy `battery_kwh`, `energy_kwh_per_minute`, `pickup_minutes` and `trip_minutes` remain valid compatibility fields but do not enter Bay calculations; the Bay controls should hide them.

## API and validation

`bay-operations.js` exports `defaultBayAreaConfig`, `validateBayAreaConfig`, `simulateBayAreaOperations`, `analyzeBayAreaCapacity`, `analyzeVehicleMix`, `BAY_OPERATIONS_VERSION` and `BAY_OPERATIONS_STATES`. The states extend the original lifecycle with `boarding`.

Results retain the prior operations structure and add a `routes` object keyed by `route_id`. Route geometry appears once per used route, not in every vehicle frame. Frames add `vehicle_type`, `battery_kwh` and `route_id`. Requests separately record `pickup_distance_km`, `pickup_drive_min`, `boarding_min`, `passenger_drive_min` and `trip_minutes`; values not yet observed are null.

Primary metric additions are `avg_trip_min_completed`, `avg_depot_onsite_min`, `distance_km`, `by_vehicle_type` and `by_place`. Vehicle-profile metadata is separate in `vehicle-profiles.js`, including `ILLUSTRATIVE_ASSUMPTIONS`, published rider limits, source URLs and explicit unavailable Ojai nominal battery information.

Focused validation covers shared demand, individual energy conservation/reserve, site/port/vehicle caps, finite resources, geography and route timing, profile sensitivity, equal-profile branding neutrality, boarding, zero legs, incomplete populations, cloned configuration, input bounds, extreme infeasible demand and compatibility with the untouched synthetic model. None of these tests establishes real-world performance, legal routing, safety or deployment authority.
