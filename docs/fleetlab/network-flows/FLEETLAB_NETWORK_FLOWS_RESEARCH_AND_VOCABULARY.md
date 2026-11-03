# FleetLab — Network-Flows Research, Vocabulary & Simulation Roadmap

**Date:** 2026-10-14
**Status:** Proposals for owner review. Nothing here is approved for Codex or for the site. Review-only, as always.

---

## 1. What "network flows" means for AV fleets

Research synthesis (10 papers, 2024–2026, read 2026-10-14). In both academia and industry, an autonomous fleet is modeled as **flows on a network**: vehicles are commodities moving along road-network edges; dispatch, rebalancing, and charging are flow-control decisions. The canonical academic formulation reduces coupled routing + rebalancing to a **minimum-cost multi-commodity flow** problem; operational work uses time-expanded networks solved as MILP, plus MPC, RL/neural surrogates, and bipartite matching for dispatch. Industry frames it KPI-first: cut deadhead miles, raise utilization/readiness, keep pickup waits low.

Grounding stat: an MIT Transit Lab analysis of Waymo CPUC filings (Aug 2023–Dec 2025, via *Transport Findings*) found only **54% of fleet miles carried passengers** — deadheading hovered at **43–45% of total VMT**. (This comes via a secondary press summary, not the paper itself.) The inefficiency the optimizers attack is real and large.

| # | Sub-problem | What's optimized | Binding constraint |
|---|---|---|---|
| 1 | Fleet dispatch / vehicle-to-request assignment | Minimize pickup wait / assignment cost over a bipartite vehicle↔request graph | Request time windows + idle-vehicle scarcity per zone |
| 2 | Empty-vehicle rebalancing between zones | Minimize empty VKT while maximizing served demand | Demand asymmetry in space and time — vehicles end up in the wrong zones |
| 3 | Ride-pooling / matching | Minimize total distance / vehicle-hours, maximize requests served | Vehicle capacity + per-passenger pickup-delay and detour limits |
| 4 | Charging scheduling under shared site power | Minimize electricity cost while every vehicle hits target SoC by departure | The depot's shared power ceiling + charger count + departure deadlines |
| 5 | Depot throughput / curb & berth queueing | Maximize throughput through berths/curb slots, minimize queueing delay | Number of service berths × service time — curb space is the binding bottleneck |
| 6 | V2X communications under constrained links | Maximize spectral efficiency / link capacity under latency/reliability QoS | Scarce shared radio bandwidth + cross-link interference; strict delay budgets |
| 7 | OTA software update distribution | Minimize last-hop delivery latency, maximize update success rate | Cellular last-hop bandwidth per vehicle + contact durations |
| 8 | Edge caching at depots / RSUs | Maximize cache hit ratio, minimize backhaul load and delivery delay | Cache size vs. content diversity; vehicle mobility makes placement stale |

---

## 2. Ten papers that move the needle (2024–2026)

### Fleet operations (6)

**P1 — Jacobsen, Kulcsár, Lindman (arXiv 2025, preprint-only).** Combined stochastic+robust MPC with Nested Benders Decomposition for electric AMoD. Joint dispatch + rebalancing + charging under demand/travel-time/energy/charger uncertainty. SF & Chicago sims: **median wait −36%, p95 delay −20%, rebalancing distance −27%, electricity cost >−35%** vs deterministic/reactive/robust baselines.
URL: https://arxiv.org/abs/2508.19933

**P2 — Paparella et al. (arXiv 2024, preprint).** Ride-pooling electric AMoD as a multi-layer time-invariant network flow (layers = position × state of charge), time-optimal MILP; Manhattan taxi data. **Ridepooling cuts energy & vehicle-hours by up to 45%**; joint charger placement adds ~1% over heuristics; lightweight two-seaters optimal in low-demand areas, heavier four-seaters in high-demand ones.
URL: https://arxiv.org/abs/2403.06566

**P3 — Yang, Liu, Du (*Sustainability* 2026, peer-reviewed).** LSTM+BiGRU end-to-end neural surrogate for SAV rebalancing under congestion (Manhattan, 3,000 SAVs). **Pickup duration 113.2 → 108.7 s, relocation distance 6.1 → 0.1 km, −25.29% road congestion, −22,247 km empty VKT** vs a traditional MILP rebalancer.
URL: https://www.mdpi.com/2071-1050/18/19/9768

**P4 — Jiang, Xu, Varakantham (arXiv 2025, preprint).** Ride-pool matching with flexible pickup/drop-off points (tree-based feasible-match generation + dynamic assignment). **+13% requests served, −21% average travel distance** on city-scale taxi datasets.
URL: https://arxiv.org/abs/2503.08472

**P5 — Song & Han (AIAT 2025 / Springer 2026, peer-reviewed).** Cooperative scheduling of AV platoons through an airport curbside (SUMO + Python, calibrated traffic data). **−77.9% average vehicle delay at peak flow (1100 veh/h)**; stable even at 1500 veh/h oversaturated flow.
URL: https://link.springer.com/chapter/10.1007/978-981-95-9342-2_35

**P6 — Deng, Li, Qian, Ma (arXiv 2025, preprint, theory).** Bi-modal two-tandem bottleneck model of ride-hailing curbside congestion (Hong Kong). Structural result: capacity mismatch between highway and curb bottlenecks wastes road capacity; **expanding curb space or the urban main road — not the highway — reduces social cost**; pricing must coordinate both bottlenecks.
URL: https://arxiv.org/abs/2506.09466

### Vehicular networking (4)

**P7 — Liu & Ma (*Scientific Reports* 2025, peer-reviewed).** Federated multi-agent DRL (MADDPG + async federated learning) for V2I/V2V spectrum, power, and bandwidth allocation. **+19.1% spectral efficiency, +16.1% V2I link capacity, +9.3% V2V success rate** vs centralized DDPG, MADDPG, MAPPO, FL-DuelingDQN.
URL: https://www.nature.com/articles/s41598-025-15982-x

**P8 — Bankov et al. (arXiv 2025, preprint).** Improved 5G V2X Mode 2 resource selection for sporadic safety traffic (advanced PSCCH decoding + full-duplex). **Up to +40% system capacity** with low added complexity.
URL: https://arxiv.org/abs/2510.17395

**P9 — Sghaier et al. (Apr 2026, venue provisional).** Dual-path V2N/V2V OTA update distribution (delta updates + IPFS P2P + centralized orchestration). **−81% last-hop delivery latency** vs cloud-only; **+85.7% update success rate** under intermittent connectivity. (Venue suggested by filename as IEEE VTC 2026 but not confirmed.)
URL: http://www.lre.epita.fr/dload/papers/sghaier.26.vtc.pdf

**P10 — Tokunaga & Tang (*Electronics* 2024, peer-reviewed).** Clustering-based collaborative V2V caching (content-centric networking + popularity-based replacement). **−33% fetching latency**, +17% packet reception rate in a 200-vehicle scenario.
URL: https://www.mdpi.com/2079-9292/13/5/883

### Caveats
- P1 is preprint-only; no peer-reviewed venue confirmed.
- P9's venue is provisional (IEEE VTC 2026 inferred from filename, not confirmed).
- The Waymo deadhead figures come via a secondary press summary of the *Transport Findings* analysis, not the paper itself.
- No 2024–2026 peer-reviewed paper was found specifically on **depot throughput** as distinct from curbside queueing; depot operations live mostly in industry/charging-infrastructure literature. Depot-specific edge caching is similarly thin — RSU/V2V caching papers transfer directly.

---

## 3. FleetLab Network-Flows Vocabulary

### 3.1 The flagship pair: COD and VOR

The proposal: every vehicle in the fleet is, at any instant, either **on the drive** or **off the road**. The pair partitions the fleet — there is no third state.

- **COD — Car on Drive.** A vehicle currently executing a trip or a repositioning move: carrying passengers, deadheading to a pickup, or rebalancing between zones. It is *in the flow*.
- **VOR — Vehicle Off-Road.** A vehicle unavailable for dispatch: charging, receiving a software update, in maintenance, or held at the depot. It is *out of the flow*.

Flow metrics are then defined on COD vehicles (deadhead ratio, utilization, pickup wait), while capacity and readiness metrics are defined on the VOR side (charge-queue wait, update latency, maintenance dwell). The vocabulary makes the binding-constraint stories readable: the capacity lesson is a VOR story (too many vehicles stuck charging), the dispatch lesson is a COD story (too few cars on drive in the right zone).

**One honest flag:** in automotive language, "off-road" already means driving off paved terrain. Keep the spelling **Off-Road** with a one-line clarifier ("off the drive network, not off the pavement") wherever the term first appears, and if the collision bothers you, the fallback is **OOR — Out of Rotation**. Don't ship VOR without the clarifier.

### 3.2 Industry terms to adopt verbatim

These are industry-standard; use them exactly as defined — no FleetLab reinvention:

- **Deadhead ratio** — empty miles ÷ total miles (industry term; academia says "empty VKT"). Trucking targets <10–15%; Waymo runs ~43–45%.
- **Pickup wait** — request time → vehicle arrival; report **median and p95**, never the mean alone.
- **Service rate** — requests served ÷ requests received. Pin this definition; in queueing theory "service rate" means something else.
- **Readiness / availability** — operable-and-ready time ÷ scheduled time ("operational readiness rate").
- **Charge-queue wait** — arrival at charger → plug-in start, in minutes.
- **Energy cost per mile** — charging spend ÷ total miles (with off-peak charging share as the companion KPI).
- **Link utilization / saturation** — fraction of a link's capacity in use; "saturation" ≈ at ~100%.
- **Flow completion time** — first packet sent → last packet received; the datacenter-networking headline metric.
- **Cache hit ratio** — requests served from edge cache ÷ total requests.
- **Spectral efficiency** — bits/s/Hz; the V2X papers' headline metric.

### 3.3 Overloaded terms — teach them explicitly

These words mean different ratios in different rooms. FleetLab rule: **every metric carries its numerator/denominator in the label, every time.** Suggested "teach the collision" panels:

- **Utilization** — fleet (loaded ÷ total miles) vs link (used ÷ capacity) vs charger (power draw ÷ ceiling). One word, three different ratios.
- **Throughput** — network (bits/s) vs fleet (trips/h) vs depot (veh/h). Scope it on every chart.
- **Service rate** — % requests served (ops) vs jobs-per-time (queueing).
- **Capacity** — vehicle seats vs link bits/s vs curb slots vs depot power kW vs cache GB.
- **Rebalancing** — in papers it means *empty-vehicle repositioning*; in industry press it loosely covers any repositioning including moves to chargers.

---

## 4. Simulation roadmap — 8 areas to build, ranked

Ranked by fit for a small in-browser learner simulator: small state, visible trade-off, one binding constraint each.

**R1. Empty-vehicle rebalancing between zones (min-cost flow).** Build: a zone grid with vehicle counts + demand forecast; learner allocates rebalancing moves. Learn: empty VKT vs unserved-demand penalty; why reactive fleets strand vehicles. Optimize: rebalancing flows. Binding constraint: demand asymmetry. *Best starter; maps to P1–P3. Extends the "who gets the depot link first" spirit to geography.*

**R2. Charging scheduling under a shared site power cap (LP over time).** Build: per-vehicle SoC + site power ceiling + time-of-use prices + departure deadlines; learner schedules charging. Learn: electricity cost vs deadline readiness; why first-come-first-served wastes the peak. Optimize: charge schedule. Binding constraint: depot power ceiling + charger count. *Very visual (power-over-time chart). Direct extension of the capacity lesson (which proved power wasn't the binding constraint there — here it is).*

**R3. Fleet dispatch / vehicle-to-request assignment (bipartite matching).** Build: idle vehicles + pending requests on a grid; learner assigns; compare greedy nearest-vehicle vs lookahead. Learn: pickup wait now vs coverage later. Optimize: assignment. Binding constraint: request pickup deadlines. *Maps to P4's assignment stage and the US10775806B2 fleet-objective framing.*

**R4. Ride-pool matching with detour limits (max-weight matching on a shareability graph).** Build: requests with O/D, vehicles with routes; learner sets detour/wait caps. Learn: vehicle-miles saved vs passenger tolerance. Optimize: matches. Binding constraint: per-passenger detour/wait caps + vehicle capacity. *Maps to P4; pairs with the P2 −45% energy figure as the "why it matters" anchor.*

**R5. Curb/berth queueing at a depot (tandem queue).** Build: berths with service times, arriving vehicles; learner adds berths or holds vehicles. Learn: throughput vs wait; why curb space — not the road — binds (P6). Optimize: berth count + scheduling. Binding constraint: berths × service time. *Fills the depot-throughput gap the literature leaves open.*

**R6. V2X link capacity allocation (max-min fairness / water-filling).** Build: flows with demands sharing link capacities; learner allocates. Learn: total throughput vs fairness. Optimize: allocation. Binding constraint: shared link capacity + interference budget. *Maps to P7/P8; the first lesson in the networking half of the tree.*

**R7. OTA update dissemination via V2V gossip (epidemic spread).** Build: % of fleet updated over time; learner chooses backhaul vs gossip mix. Learn: backhaul cost vs time to full coverage. Optimize: dissemination policy. Binding constraint: contact duration/bandwidth per encounter. *Maps to P9 (−81% last-hop latency); natural sequel to the software-delivery lesson.*

**R8. Edge cache placement at a depot/RSU (knapsack with popularity).** Build: content popularity + cache contents; learner picks what to cache. Learn: hit ratio vs backhaul. Optimize: cache contents. Binding constraint: cache size. *Maps to P10; natural sequel to the cache-arm policy in software-delivery.*

**Recommended build order:** R1 (rebalancing) → R3 (dispatch) → R2 (charging) → R7 (OTA gossip). The first three complete the fleet-operations half and each reuses the capacity/software-delivery lesson scaffolding; R7 opens the networking half.

---

## 5. Visual system for the new lessons

### New assets

- **NF-05 rebalancing loop** (generated, v1 — pending owner review): `loops/media-generation-nf-05-rebalancing-flow-0-910ad588-a717-4a60-abd1-01a8a00151b0.mp4`. Aerial clay-3D city map; pods glide from a downtown cluster to suburban zones along glowing teal dotted arcs. Candidate hero loop for the R1 rebalancing lesson. Text ban was the first line of the prompt (the V-03 learning).
- **NF-02 / NF-03 / NF-04** (already generated, Round-2 brief): binding-constraint battery, repeated-download clog, cache fanout. Unchanged.

### Recommended new vignettes (prompts ready, not yet generated)

- **NF-06 zone grid (R1):** "Soft clay 3D illustration, 1:1, text-free: a miniature city map split into four rounded zones on warm cream; small white pods cluster in one zone while another zone glows teal with a waiting-request pulse; thin dotted teal arcs suggest planned rebalancing moves. Friendly, Apple-grade, no text."
- **NF-07 power ceiling (R2):** "Soft clay 3D illustration, 1:1, text-free: a row of white clay pods plugged into charging posts beneath a wide horizontal teal power bar that is visibly full to a marked ceiling line; one pod waits unplugged beside the row. Friendly, Apple-grade, no text."
- **NF-08 gossip spread (R7):** "Soft clay 3D illustration, 1:1, text-free: a ring of white clay pods where a teal ripple passes from pod to pod, half the ring already glowing teal, half still white; one pod at the top receives a signal from a small cloud. Friendly, Apple-grade, no text."

### Logo round 2 — the 5 candidates

All in `logo/`, 1:1, text-free (wordmark stays in HTML). QA-passed by visual inspection.

| File | Concept | Verdict |
|---|---|---|
| `LOGO-C1-orbit.webp` | Teal orbit ring around the roof puck on forest squircle | Strongest connectivity story; slightly busy at favicon size |
| `LOGO-C2-front-badge.webp` | Symmetric front-view pod, badge-like | **Recommended primary.** Most iconic, most legible small — best favicon candidate |
| `LOGO-C3-flow.webp` | Pod with dotted route arcs streaming behind | Clearest network-flows tie-in; pod reads slightly blobby |
| `LOGO-C4-monoline.webp` | Single-weight teal line pod, no squircle | **Recommended futuristic alternate.** Boldest design move, most award-minimal; departs from the clay world, so use where the site goes flat/minimal |
| `LOGO-C5-apex.webp` | Pod with speed swoosh in rimmed ink-green squircle | Most cinematic; the rimmed squircle reads premium |

Recommendation: ship **C2** as the primary mark (header, footer, favicon, City Explorer) and keep **C4** as the futuristic alternate for launch moments and dark contexts. C1 stays available if the connectivity story needs to lead.

---

## 6. Fences

- All simulation numbers in the roadmap are structural proposals; any numbers shown in future lessons must be synthetic and fenced `Synthetic scenario · not operational data`.
- Paper caveats from §2 apply (P1 preprint-only; P9 venue provisional; Waymo stats via secondary summary; depot-throughput and depot-caching literature gaps).
- No video, vignette, or logo in this file is approved for the site. Codex implementation remains a separate, owner-authorized step.
