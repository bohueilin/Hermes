# FleetLab simulation and learning guide

Updated 2026-09-19 UTC. 44 runnable examples and lessons: 12 Fleet day lessons and 32 regional presets. Fleet day combines frozen real geography with synthetic operations; neither model is real-fleet evidence.

## Start here

Open Simulation, select at least two Bay Area locations and choose your I-PACE/Ojai mix, then press **Run fleet day**. All 18 locations are selected initially. Use the city focus, orbit/zoom/tilt controls or **Follow selected car** to inspect 3D movement. Flat mode and tables remain available. The view moves to the replay. Use **Next minute** for an exact minute or **Next activity** for the selected car’s next recorded event. Stage buttons find an actual occurrence in the run, and explain when none occurred. Open the depot resource details to see queues, occupied capacity and charging power at that minute.

Open **Vehicle assumptions** to inspect per-type battery, charging, energy, boarding and service factors. Ojai numerical defaults are illustrative. Both types follow identical road-speed rules. Compare all-I-PACE, mixed and all-Ojai fleets using **Compare I-PACE · mixed · Ojai**.

Read end-of-day service before changing one assumption. Compare fleet and depot sizes against the same demand. The displayed depot requirement is the first of 1–6 tested counts reaching 95% completed requests by the end of the window. It can be unavailable; it is not a global optimum. More depots add per-site resources and power as well as locations.

## What the two models answer

| Model | Best question | Limits |
|---|---|---|
| Fleet day | How do Bay Area geography, vehicle mix, fleet size, demand, time, weather, energy and depot work affect completed service? | One-minute steps, synthetic multipliers, fixed service durations, equal charging-power sharing; no staffing, lane physics or calibrated travel. |
| Regional experiments | How does one declared policy or capacity change affect rider/depot metrics and guardrails? | Four invented areas; travel replications on fixed demand; no charging/software/upload model. |

Google Maps route estimates live in a separate optional local companion. They are not inputs to either offline replay. See [traffic configuration and CARLA research](FLEETLAB_GOOGLE_TRAFFIC_CARLA_RESEARCH.md).

## Complete catalog

### Fleet day

**bay-area · Real Bay Area routes in 3D**

- Question: How does the geography of service change the fleet day?
- Change: 18 named places, city focus, orbit, zoom and road speed
- Watch: Recorded cars on OpenStreetMap routes; distance and travel time
- Learn: Longer road routes consume vehicle time and energy before the next rider.
- Limits: Sparse undirected major-road routes between anchors; no turn rules, local access or service-area verification.

**vehicle-mix · I-PACE versus Ojai assumptions**

- Question: Which vehicle assumptions affect fleet throughput?
- Change: Mix percentage; per-type battery, energy, charge limit, boarding and service factors
- Watch: Same-demand fleet comparison; trip completion, depot time and energy
- Learn: A vehicle choice changes capacity through explicit operating assumptions, not its brand.
- Limits: Ojai numerical specifications are illustrative; no validated fleet performance or charge taper.

**fleet-day · Fleet size versus trip demand**

- Question: How many requests can this fleet complete?
- Change: AV count, demand, selected places, road speed, rider patience
- Watch: Completed, unserved, waiting and in-progress trips; trips per AV
- Learn: A vehicle count alone is not service capacity. Time away from riders matters.
- Limits: Synthetic trip distribution and dispatch; no actual market data.

**weather-day · Rain and hot-weather service**

- Question: What happens when trips slow down or energy use rises?
- Change: Weather, start time, travel factor
- Watch: Trip completion, wait, energy and depot queues
- Learn: Weather can affect several constraints at once.
- Limits: Declared multipliers; no tire grip, visibility or sensor model.

**rush-hour · Morning and evening peaks**

- Question: Can the same fleet handle a different time of day?
- Change: Start hour, run length, peak demand multiplier, traffic factor
- Watch: Minute-by-minute replay and end-of-day service
- Learn: Time-dependent demand and travel can create temporary shortages.
- Limits: Synthetic clock profiles; no external traffic feed in this model.

**depot-count · How many depots are sufficient?**

- Question: Which tested depot count meets the chosen service target?
- Change: Depot count, fleet count and resources per site
- Watch: Same-demand comparison across 1 to 6 sites; explicit unmet target
- Learn: More sites help only when depot access or service is the limiting resource.
- Limits: First sufficient tested count; no site economics or global optimum.

**cleaning · Cleaning capacity and queues**

- Question: Do more bays or shorter cleaning times change readiness?
- Change: Cleaning bays, cleaning minutes and visit frequency
- Watch: Cleaning queues, active work and completed turnaround
- Learn: Service rate is capacity divided by work time; queues add delay.
- Limits: Fixed service times and unlimited staff.

**charging · Battery and charging constraints**

- Question: Can vehicles recharge in time to serve another trip?
- Change: Battery size, energy use, reserve/target SOC and charger count
- Watch: Vehicle battery, delivered energy, charger queues and service outcomes
- Learn: Fleet availability depends on energy as well as cars.
- Limits: No charge taper, battery aging, temperature physics or V2G.

**shared-power · Charge ports versus site power**

- Question: Will adding ports help under the same site power cap?
- Change: Ports, kW per port and shared kW per depot
- Watch: Per-depot charging power and charging time
- Learn: A power-constrained site can remain slow after adding ports.
- Limits: Equal power sharing; no tariff or optimized energy scheduler.

**software · Software-update scheduling**

- Question: What happens when updates take longer or occur more often?
- Change: Update duration, update stations and visit cadence
- Watch: Update queues and time away from riders
- Learn: Fleet software operations consume real service capacity.
- Limits: Occupied-resource delay only; no actual update or failure/rollback model.

**upload · Trip-data transfer bottlenecks**

- Question: Can data-upload work delay the return to service?
- Change: Upload minutes and simultaneous upload stations
- Watch: Upload queues, active work and depot turnaround
- Learn: Data operations belong in the readiness path.
- Limits: Fixed transfer duration; no bytes, bandwidth contention or retry model.

**full-cycle · Follow a car through its day**

- Question: Where does one vehicle spend its time?
- Change: Vehicle selector, next activity, stage buttons and clock
- Watch: Pickup, trip, depot journey, queues, work and return to readiness
- Learn: The activity trail connects fleet outcomes to individual transitions.
- Limits: One-minute model resolution; motion between snapshots is explanatory.

### Regional experiments

**bay_teaching_map · Bay teaching map**

- Question: How do supply, demand, routes and depot rules interact across four areas?
- Change: Fleet, demand, traffic, depot capacity, recall and release.
- Watch: Recorded replay, rider wait, unserved demand, fleet state and depot queues.
- Learn: Change one decision and inspect its trade-offs rather than assuming the primary metric tells the whole story.
- Limits: Invented regional network; charging, software and upload are absent in this older model. Replication seeds vary travel on fixed demand.

**L1 · Peak and off-peak with the same fleet**

- Question: With the same total requests, does peaked demand instead of flat demand change rider wait p90 in the day 1 evening peak?
- Change: One declared change: parameter:DEM-5. flat → peaked.
- Watch: Primary: wait.p90_s; 1 guardrails; paired uncertainty and recommendation.
- Learn: Compare moments in one day, then inspect the population and constraint behind the number.
- Limits: Invented regional network; charging, software and upload are absent in this older model. Replication seeds vary travel on fixed demand.

**L2a · Bays are not always the bottleneck**

- Question: With 12 cars in San Jose and a depot visit every 5 trips, does cutting SJ-1 from 3 cleaning bays to 1 change San Jose rider wait p90 in the day 1 evening peak?
- Change: One declared change: parameter:DEP-3.SJ-1. 3 → 1.
- Watch: Primary: wait.p90_s; 1 guardrails; paired uncertainty and recommendation.
- Learn: Compare moments in one day, then inspect the population and constraint behind the number.
- Limits: Invented regional network; charging, software and upload are absent in this older model. Replication seeds vary travel on fixed demand.

**L2b · Bays are not always the bottleneck, with a bay wait guardrail**

- Question: With 12 cars in San Jose and a depot visit every 5 trips, does cutting SJ-1 from 3 cleaning bays to 1 change San Jose rider wait p90 in the day 1 evening peak?
- Change: One declared change: parameter:DEP-3.SJ-1. 3 → 1.
- Watch: Primary: wait.p90_s; 2 guardrails; paired uncertainty and recommendation.
- Learn: Compare moments in one day, then inspect the population and constraint behind the number.
- Limits: Invented regional network; charging, software and upload are absent in this older model. Replication seeds vary travel on fixed demand.

**L3 · Evening depot visit in San Jose**

- Question: Does sending cars to the nearest depot instead of their home depot change San Francisco rider wait p90 on day 2 from 07:00 to 09:00?
- Change: One declared change: policy:depot_assignment. home_depot → nearest_depot.
- Watch: Primary: wait.p90_s; 3 guardrails; paired uncertainty and recommendation.
- Learn: Compare moments in one day, then inspect the population and constraint behind the number.
- Limits: Invented regional network; charging, software and upload are absent in this older model. Replication seeds vary travel on fixed demand.

**UC-01 · Null check**

- Question: With trips between depot visits set to 10 in both arms, does the verdict read no change?
- Change: One declared change: parameter:DEP-7. 10 → 10.
- Watch: Primary: wait.p90_s; 1 guardrails; paired uncertainty and recommendation.
- Learn: Change one decision and inspect its trade-offs rather than assuming the primary metric tells the whole story.
- Limits: Invented regional network; charging, software and upload are absent in this older model. Replication seeds vary travel on fixed demand.

**UC-02 · How many cars does San Jose need?**

- Question: Does giving San Jose 24 cars instead of 16 change San Jose rider wait p90 in the day 1 morning peak?
- Change: One declared change: parameter:SUP-1.SJ. 16 → 24.
- Watch: Primary: wait.p90_s; 2 guardrails; paired uncertainty and recommendation.
- Learn: Change one decision and inspect its trade-offs rather than assuming the primary metric tells the whole story.
- Limits: Invented regional network; charging, software and upload are absent in this older model. Replication seeds vary travel on fixed demand.

**UC-03 · Rider patience and the population trap**

- Question: Does cutting rider patience from 20 minutes to 5 minutes change rider wait p90?
- Change: One declared change: parameter:RID-1. 1200 → 300.
- Watch: Primary: wait.p90_s; 1 guardrails; paired uncertainty and recommendation.
- Learn: Change one decision and inspect its trade-offs rather than assuming the primary metric tells the whole story.
- Limits: Invented regional network; charging, software and upload are absent in this older model. Replication seeds vary travel on fixed demand.

**UC-05 · End-of-day highway slowdown**

- Question: Does a highway slowdown of ×1.6 in both directions from 16:00 to 19:00 change San Jose rider wait p90 from 17:00 to 20:00 on day 1?
- Change: One declared change: parameter:RD-3.highway.evening. 1000 → 1600.
- Watch: Primary: wait.p90_s; 2 guardrails; paired uncertainty and recommendation.
- Learn: Change one decision and inspect its trade-offs rather than assuming the primary metric tells the whole story.
- Limits: Invented regional network; charging, software and upload are absent in this older model. Replication seeds vary travel on fixed demand.

**UC-08a · Depot throughput: more cleaning bays at SF-1**

- Question: Does raising SF-1 from 4 cleaning bays to 6 change rider wait p90?
- Change: One declared change: parameter:DEP-3.SF-1. 4 → 6.
- Watch: Primary: wait.p90_s; 1 guardrails; paired uncertainty and recommendation.
- Learn: Change one decision and inspect its trade-offs rather than assuming the primary metric tells the whole story.
- Limits: Invented regional network; charging, software and upload are absent in this older model. Replication seeds vary travel on fixed demand.

**UC-08b · Depot throughput: a shorter clean**

- Question: Does a 15 minute clean instead of a 20 minute clean change rider wait p90?
- Change: One declared change: parameter:DEP-4. 1200 → 900.
- Watch: Primary: wait.p90_s; 1 guardrails; paired uncertainty and recommendation.
- Learn: Change one decision and inspect its trade-offs rather than assuming the primary metric tells the whole story.
- Limits: Invented regional network; charging, software and upload are absent in this older model. Replication seeds vary travel on fixed demand.

**UC-10 · Pool the bays or spread them?**

- Question: With the same total cleaning bays, does moving from 6 at SF-1 and 1 at SJ-1 to 4 and 3 change rider wait p90?
- Change: One declared change: parameter:DEP-3. SF-1: 6, SF-2: 2, SJ-1: 1, EB-1: 2 → SF-1: 4, SF-2: 2, SJ-1: 3, EB-1: 2.
- Watch: Primary: wait.p90_s; 3 guardrails; paired uncertainty and recommendation.
- Learn: Change one decision and inspect its trade-offs rather than assuming the primary metric tells the whole story.
- Limits: Invented regional network; charging, software and upload are absent in this older model. Replication seeds vary travel on fixed demand.

**OPS-01 · Evening crunch: more cars in San Francisco**

- Question: Does giving San Francisco 52 cars instead of 40 change San Francisco rider wait p90 in the day 1 evening peak?
- Change: One declared change: parameter:SUP-1.SF. 40 → 52.
- Watch: Primary: wait.p90_s; 2 guardrails; paired uncertainty and recommendation.
- Learn: In the day 1 evening peak San Francisco has almost no free car, many riders wait a long time and some go unserved. An operations lead proposes starting the day with 12 more San Francisco cars. Every San Francisco car sleeps at SF-1 or SF-2, so the extra cars also join the overnight depot wave there.
- Limits: Parking, charging and staff for the extra cars; Depot opening hours and cleaning crew size by hour; Riders who request more once waits are shorter; Cars added for the peak and taken out after it; Repositioning free cars toward San Francisco instead of adding cars

**OPS-02 · Late night recall: 00:30 or 02:00**

- Question: Does moving the end of service recall from 00:30 to 02:00 change San Francisco rider wait p50 from 00:30 to 02:00 on day 2?
- Change: One declared change: parameter:POL-3. 88200 → 93600.
- Watch: Primary: wait.p50_s; 2 guardrails; paired uncertainty and recommendation.
- Learn: At 00:30 on day 2 the end of service recall sends every free car to a depot and marks the cars then on a pickup or a trip to head for a depot when they finish, while a car sent out after that moment stays on the street. Riders leaving late night venues keep requesting after midnight at the off peak rate. Moving the recall to 02:00 keeps cars on the street longer and starts the depot wave later.
- Limits: A closing time surge that arrives all at once; Cleaning crew hours at night; Night pickup conditions; Charging windows before the morning; Keeping a small night pool out while the rest return; A second recall for cars sent out after the first

**OPS-03 · Defer depot visits through the evening peak**

- Question: Does a depot visit every 15 trips instead of every 10 change the share of San Francisco riders left unserved in the day 1 evening peak?
- Change: One declared change: parameter:DEP-7. 10 → 15.
- Watch: Primary: unserved.fraction; 3 guardrails; paired uncertainty and recommendation.
- Learn: Cars go to a depot for a clean after every 10 trips, and in the day 1 evening peak that takes San Francisco cars off the street while riders go unserved. An operations lead proposes stretching the cadence to one visit every 15 trips. The model has one cadence for every hour, so the change applies all day.
- Limits: Cabin cleanliness and rider complaints between visits; Maintenance triggered by distance or faults rather than visit count; A deferral rule that switches on only in the peak; Cleaning crew idle time when peak visits drop

**OPS-04 · Release cars to home areas earlier**

- Question: Does releasing ready cars to their home areas at 05:00 instead of 05:45 change San Francisco rider wait p90 in the day 2 morning peak?
- Change: One declared change: parameter:POL-4. 107100 → 104400.
- Watch: Primary: wait.p90_s; 2 guardrails; paired uncertainty and recommendation.
- Learn: The Peninsula has no depot, so Peninsula cars spend the night at SF-1 and SF-2. At 05:45 on day 2 the morning release sends every car that is ready at a depot outside its home area back home, once, while a car still queued at that moment stays where it is. An operations lead proposes releasing at 05:00 so cars are in place well before the morning peak.
- Limits: Crew and dispatcher shift start times; Sending cars toward where morning requests start rather than to a home area; Releasing each car as soon as it is ready; Charging before the morning; A depot in the Peninsula

**OPS-05 · Launch fleet size with a 12 stall depot**

- Question: With a 12 stall launch depot, does giving East Bay 18 cars instead of 12 change East Bay rider wait p90 on day 2 from 07:00 to 09:00?
- Change: One declared change: parameter:SUP-1.EB. 12 → 18.
- Watch: Primary: wait.p90_s; 3 guardrails; paired uncertainty and recommendation.
- Learn: East Bay opens as a new service area with 12 cars and a temporary depot, EB-1, with 12 stalls, 1 cleaning bay and 1 service bay. The launch team asks whether 18 cars would serve riders on the second morning, after the overnight recall has put the fleet through the depot.
- Limits: Staged vehicle delivery and fleet growth over weeks; Launch checks and cars held out of service; Staff and shift limits at a new depot; Charging and battery range; Rider awareness and a demand ramp in a new area; Repositioning cars between areas

**OPS-06 · Launch demand above plan**

- Question: With the 12 car launch fleet, do 45 East Bay peak requests per hour instead of the planned 30 change East Bay rider wait p90 in the day 1 morning peak?
- Change: One declared change: parameter:DEM-1.EB. 30 → 45.
- Watch: Primary: wait.p90_s; 2 guardrails; paired uncertainty and recommendation.
- Learn: The launch plan for East Bay assumed 30 ride requests per hour in the peaks. Suppose peak requests arrive at 45 per hour, half again above plan, while the fleet stays at 12 cars and EB-1 stays small.
- Limits: Demand that ramps over days or weeks; Waitlists, pricing and promotions; Riders who stop requesting after long waits; Cancellation after assignment; A destination mix specific to a new area; Rules that keep cars inside their service area

**OPS-07 · One cleaning bay or three at the launch depot**

- Question: Does giving the East Bay launch depot EB-1 3 cleaning bays instead of 1 change East Bay rider wait p90 on day 2 from 07:00 to 09:00?
- Change: One declared change: parameter:DEP-3.EB-1. 1 → 3.
- Watch: Primary: wait.p90_s; 3 guardrails; paired uncertainty and recommendation.
- Learn: EB-1 opens with 1 cleaning bay, and after the end of service recall East Bay cars queue for it into the night. The launch team asks whether 2 more bays would put more East Bay cars on the road for the second morning peak.
- Limits: Staff to work extra bays and depot opening hours; Time to build or lease bays; Charging and inspection steps; Cars held at the depot until a planned start; Repositioning cars home before the morning peak

**OPS-08 · Launch lot overflow: nearest depot with a free stall**

- Question: With 6 stalls at EB-1, does sending cars to the nearest depot with a free stall instead of their home depot change East Bay rider wait p90 on day 2 from 07:00 to 09:00?
- Change: One declared change: policy:depot_assignment. home_depot → nearest_depot_with_capacity.
- Watch: Primary: wait.p90_s; 3 guardrails; paired uncertainty and recommendation.
- Learn: EB-1 has only 6 stalls for the 12 launch cars, and cars queued for its single cleaning bay keep their stalls, so on the first afternoon East Bay cars reach a full lot and are sent on to SF-1. The alternative rule sends every car, in every area, to the nearest depot that still has a free stall when it leaves.
- Limits: Real depot locations at different distances; Overflow parking arrangements outside a depot; Dispatcher judgment and stall reservations; A depot choice that counts free bays; Staff at the receiving depot; Night road conditions on the overflow route

**OPS-09 · Rain: slower curbside pickups in San Francisco**

- Question: In the rain world, does a San Francisco pickup and in area trip time of 9 minutes instead of 6 change San Francisco rider wait p90 from 16:00 to 19:00 on day 1?
- Change: One declared change: parameter:RD-2.SF. 360 → 540.
- Watch: Primary: wait.p90_s; 2 guardrails; paired uncertainty and recommendation.
- Learn: Rain slows every road on the afternoon and evening of day 1 and brings more San Francisco requests. Wet curbs also stretch each pickup and each short trip inside San Francisco. An operations lead asks whether that slower curbside time is what hurts the evening peak.
- Limits: Rain that varies by hour and by area; Riders who decide not to book or who cancel after assignment; Pickup spot choice, walking time and waiting under cover; Road surface, visibility and any vehicle response to rain; Demand that returns to normal once the rain stops

**OPS-10 · Rain: more cars for San Francisco**

- Question: In the rain world, does giving San Francisco 48 cars instead of 40 change the whole run unserved fraction?
- Change: One declared change: parameter:SUP-1.SF. 40 → 48.
- Watch: Primary: unserved.fraction; 3 guardrails; paired uncertainty and recommendation.
- Learn: The rain world slows every road on the afternoon and evening of day 1, adds 2 minutes to every pickup and brings about 25 percent more San Francisco requests. The team can place 8 more cars in San Francisco at the start of the run. The question is whether those cars add more served rides in rain than on a dry day, and what they ask of the depots.
- Limits: Adding cars partway through the day when rain starts; Staff, preparation and charging for extra cars; Demand that falls back after the rain; Repositioning idle cars between areas; Riders who cancel after assignment

**OPS-11 · Rain: wet interiors and 30 minute cleans**

- Question: In the rain world, does a 30 minute clean instead of a 20 minute clean change San Francisco rider wait p90 from 07:00 to 09:00 on day 2?
- Change: One declared change: parameter:DEP-4. 1200 → 1800.
- Watch: Primary: wait.p90_s; 3 guardrails; paired uncertainty and recommendation.
- Learn: Riders bring water and grit into cars on a rainy day, so each depot clean takes longer. In the rain world every clean at all four depots goes from 20 minutes to 30 minutes. Most depot visits in this model arrive after the 00:30 recall, before the day 2 morning peak.
- Limits: Which cars actually got wet and how dirty they are; Cleaning staff on the night shift and their breaks; A quick clean option for lightly used cars; Depot opening hours; Drying time and supplies

**OPS-12 · Rain: add bays where the queue reaches riders**

- Question: With 30 minute cleans in the rain world, does raising SJ-1 from 3 cleaning bays to 5 change San Francisco rider wait p90 from 07:00 to 09:00 on day 2?
- Change: One declared change: parameter:DEP-3.SJ-1. 3 → 5.
- Watch: Primary: wait.p90_s; 3 guardrails; paired uncertainty and recommendation.
- Learn: With 30 minute cleans in the rain world, every depot runs a long queue after the 00:30 recall. SF-2 has the longest bay wait and cars still in its queue at 07:00, so it looks like the place for 2 more cleaning bays. The team tests the same 2 bays at SJ-1 and compares.
- Limits: Repositioning idle cars between areas before the morning peak; Staff and space to open bays; Dispatch rules other than nearest idle car; Depot opening hours; Which cars actually need the longer clean

**OPS-13 · Crowded curbs slow every downtown pickup**

- Question: Does raising the San Francisco trip and pickup time inside the area from 6 minutes to 10 minutes change San Francisco rider wait p90 in the day 1 morning peak?
- Change: One declared change: parameter:RD-2.SF. 360 → 600.
- Watch: Primary: wait.p90_s; 2 guardrails; paired uncertainty and recommendation.
- Learn: Crowds on downtown sidewalks make every pickup in San Francisco and every trip that stays inside it slower, because a car waits longer at the curb. The teaching model has no pedestrians, so the case lengthens the trip and pickup time inside San Francisco from 6 to 10 minutes and asks which rider waits feel it.
- Limits: Pedestrian volumes and where crowds gather by hour; Curb space, loading zones and pickup rules; Riders walking to a meeting point, and failed pickups; A delay that applies only while crowds are present

**OPS-14 · An event lets out in San Francisco**

- Question: Does raising San Francisco peak requests from 60 to 90 per hour change the East Bay unserved fraction in the day 1 evening peak?
- Change: One declared change: parameter:DEM-1.SF. 60 → 90.
- Watch: Primary: unserved.fraction; 2 guardrails; paired uncertainty and recommendation.
- Learn: A stadium event ends in San Francisco and many people ask for rides in the evening peak. The model has no crowd that leaves at once, so the case raises San Francisco peak requests by half and watches a neighbouring area that shares the same cars.
- Limits: A crowd that leaves at once in a short burst; Venue location, event timing and closed streets nearby; Staging cars near the venue before the event ends; Riders sharing rides or walking away from the venue first

**OPS-15 · The neighbour adds cars for an event next door**

- Question: With San Francisco at 90 peak requests per hour, does giving East Bay 32 cars instead of 24 change the East Bay unserved fraction in the day 1 evening peak?
- Change: One declared change: parameter:SUP-1.EB. 24 → 32.
- Watch: Primary: unserved.fraction; 3 guardrails; paired uncertainty and recommendation.
- Learn: The OPS-14 world: a stadium event in San Francisco stands as 90 peak requests per hour instead of 60, and San Francisco shares its cars with the East Bay under nearest idle dispatch. The East Bay operations lead asks for 8 more cars for the day to protect East Bay riders. The model has no way to keep cars inside one area, so the case asks whether cars added in the neighbouring area stay there.
- Limits: A rule that keeps cars inside their home area, or a cap on pickup distance; Repositioning cars back to the East Bay between trips; Cars added only for the event hours, and where they come from; Depot staff and hours at EB-1 for the extra overnight work

**OPS-16 · Streets full of people in the evening peak**

- Question: Does traffic inside areas of ×2.0 instead of ×1.3 from 16:00 to 19:00 change the share of riders left unserved across the map from 17:00 to 20:00 on day 1?
- Change: One declared change: parameter:RD-3.in_area.evening. 1300 → 2000.
- Watch: Primary: unserved.fraction; 3 guardrails; paired uncertainty and recommendation.
- Learn: A street festival and evening crowds slow every drive inside the city areas during the evening peak. The model has one congestion row for travel inside areas, shared by all four areas, so the proxy slows San Francisco, Peninsula, San Jose and East Bay streets together.
- Limits: Crowds confined to one area or a few streets; Pedestrians crossing and street closures for a festival; Riders walking to a pickup point away from the crowd; Slowdowns that build and fade instead of starting on the hour

**OPS-17 · Highway closure between SF and the Peninsula**

- Question: Does closing highway H1 for the whole run, set as 90 minutes instead of 25, change Peninsula rider wait p90 in the day 1 morning peak?
- Change: One declared change: parameter:RD-1.H1. 1500 → 5400.
- Watch: Primary: wait.p90_s; 3 guardrails; paired uncertainty and recommendation.
- Learn: A police closure shuts highway H1 between San Francisco and the Peninsula for the whole run, so every car between the two areas takes local route L1. The Peninsula has no depot, and in the morning most of its riders travel to San Francisco and take Peninsula cars with them.
- Limits: Closure start and end times and reopening estimates; Detour traffic loading the local route and other corridors; Riders cancelling or changing destination because of the closure; Moving spare cars into the Peninsula before the morning; Messages to riders and coordination with the road authority

**OPS-18 · Cars held at incident scenes in San Francisco**

- Question: Does taking 6 of San Francisco's 40 cars out of service for the whole run change San Francisco rider wait p90 from 07:00 to 09:00 on day 2?
- Change: One declared change: parameter:SUP-1.SF. 40 → 34.
- Watch: Primary: wait.p90_s; 2 guardrails; paired uncertainty and recommendation.
- Learn: Police activity in San Francisco holds six cars at incident scenes, and they stay out of service for the whole run. Day 1 starts with every car idle in its own area, while day 2 starts from where the overnight recall and the depot queues left the fleet.
- Limits: Cars removed and returned partway through the day; The rider on board when a car is held; Scene clearance and inspection time; Backfill from spare vehicles or moving cars between areas; Rider cancellations after assignment

**OPS-19 · A service check every second depot visit**

- Question: Does a service check every second depot visit instead of every third change San Francisco rider wait p90 from 07:00 to 09:00 on day 2?
- Change: One declared change: parameter:DEP-8. 3 → 2.
- Watch: Primary: wait.p90_s; 3 guardrails; paired uncertainty and recommendation.
- Learn: After police activity in the service area, every car must pass a service check more often. The model has no inspection, so the case raises the service cadence from every third depot visit to every second, on the service bays the map already has (SF-1 2, SF-2 1, SJ-1 1, EB-1 1) and with the 45 minute service. The 00:30 recall then sends the whole wave through those bays before the morning.
- Limits: An inspection shorter than a full 45 minute service; Checks limited to cars that were near an incident, or to a few days; Staff, parts and shift limits at the service bays; Cars that fail the check and leave the fleet; Checks done on the street by a mobile crew; Depot opening hours and charging during longer stays

**OPS-20 · A staging area on two thirds of the SF-1 lot**

- Question: With cars returning to their home depot, does cutting SF-1 from 60 parking stalls to 20 change San Francisco rider wait p90 from 07:00 to 09:00 on day 2?
- Change: One declared change: parameter:DEP-2.SF-1. 60 → 20.
- Watch: Primary: wait.p90_s; 2 guardrails; paired uncertainty and recommendation.
- Learn: A police staging area takes two thirds of the SF-1 lot for the whole run, leaving 20 of its 60 stalls. Cars keep returning to their home depot, so the 00:30 recall wave, which peaks at about 21 cars on the SF-1 lot, now meets a lot that fills. The question is whether San Francisco riders feel it the next morning or only the depot gate does.
- Limits: Staging that only covers part of the night; Staging vehicles blocking gates, bays or access roads; Temporary parking elsewhere; Staff moving cars inside a crowded lot; A dispatcher who knows the true stall count and sends cars elsewhere before they reach the gate

## Map and vehicle sources

See [map provenance](FLEETLAB_BAY_AREA_MAP_DATA.md) and [vehicle assumptions](FLEETLAB_VEHICLE_PROFILES.md). The map download provides the attributed compact database. Source geography is not commercial service coverage, navigation or airport access permission.
