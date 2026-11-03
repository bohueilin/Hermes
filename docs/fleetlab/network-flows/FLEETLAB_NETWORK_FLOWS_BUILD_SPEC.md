# FleetLab — Network-Flows Build Spec (for design evaluation)

**Purpose:** Hand this document to ChatGPT as the implementation brief for building the next FleetLab network-flows lessons: full build specification for the flagship lesson, sequenced follow-ons, vocabulary rollout, and asset placement map. ChatGPT should implement §3–§7 and report back on §8.

**Status:** Implementation brief — approved by the owner for build.

---

## 1. Context

FleetLab (fleetlab.pages.dev) is an educational site that teaches autonomous-vehicle fleet management through small synthetic simulators. Each lesson follows an established scaffolding, proven on the `/network-flows/software-delivery/` lesson ("One update. Four vehicles. Where is the wait?"):

- **Recorded synthetic study framing** — kicker states it is a recorded synthetic study: N vehicles, M-minute observation.
- **Question headline** — the lesson title is a question the simulator answers.
- **Chapter guide** — a multi-chapter walkthrough (software-delivery uses six chapters).
- **Per-unit inspection** — the learner can inspect individual vehicles.
- **Ledger verification** — a verifiable record (row grid with digests) backing the headline numbers.
- **Trust fences** — every synthetic number is fenced: `Synthetic scenario · not operational data`. Concept illustrations are fenced: `Concept illustration · not simulation output`.

The `/network-flows/` tree currently holds: `capacity/` ("Scheduling or capacity?") and `software-delivery/` ("One update. Four vehicles."). The capacity page links forward to software-delivery; software-delivery links forward to "Who gets the depot link first?".

**Design system:** soft clay 3D illustration, Apple-grade, warm cream backgrounds (~#FAF6EE), forest green (~#0B3B2E), teal accents (#2A9D8F). All generated imagery is text-free; labels and numbers live in HTML/code. Counted visuals (anything with an exact count) must be code-built, never generated.

---

## 2. Scope

**Flagship (full spec below): R1 — zone rebalancing.** The first new lesson. Ranked #1 of 8 candidate simulation areas for small-state, visible trade-off, and one binding constraint.

**Sequenced follow-ons (one-paragraph specs in §4):** R3 dispatch matching → R2 charging under site power cap → R7 OTA update sharing. Build in this order.

**Vocabulary rollout (§5):** COD/VOR definitions plus overloaded-term teaching panels, integrated into the new lessons and the existing tree.

---

## 3. R1 build spec — "Where should the empty cars go?"

### 3.1 Route and framing

- **Route:** `/network-flows/rebalancing/`
- **Title (question headline):** "Where should the empty cars go?"
- **Kicker:** "A recorded synthetic study · 24 vehicles · 4 zones · 120-minute observation."
- **Position in tree:** linked as the next lesson after software-delivery ("Who gets the depot link first?" becomes the R1 lesson's forward link target — update the software-delivery next-link to point at `/network-flows/rebalancing/`).

### 3.2 Story spine

1. **Question:** demand is asymmetric — vehicles end up in the wrong zones. Empty cars must be repositioned before the next demand wave.
2. **Controlled comparison:** reactive rebalancing (move cars only after requests go unserved) vs forecast rebalancing (pre-position cars to anticipated demand). Same demand trace, same fleet, different policy.
3. **Binding-constraint verdict:** demand asymmetry in space and time is the binding constraint; empty vehicle-kilometers are the price of coverage.
4. **Evidence apparatus:** full ledger of zone states per interval with digests (same pattern as the capacity page's 36-row grid).

### 3.3 Simulator spec

- **State:** vehicle counts per zone (4 zones), per-zone demand forecast for the next interval, per-vehicle status (COD/VOR — see §5).
- **Controls:** per interval, the learner allocates rebalancing moves (which zone → which zone, how many vehicles). A "run policy" toggle switches between reactive and forecast rebalancing for the comparison.
- **Outputs (exact, code-built):** total empty vehicle-kilometers, unserved requests, pickup wait median and p95 per zone, end-of-observation zone balance.
- **Binding constraint surfaced in UI:** the demand-asymmetry readout — "Zone C will need 9 cars; it has 2."
- **Research anchor (cited, fenced as external):** Yang/Liu/Du 2026 neural rebalancing surrogate cut empty VKT by 22,247 km in a Manhattan sim; Jacobsen et al. 2025 stochastic-robust MPC cut median wait 36% and rebalancing distance 27%. These are real-paper anchors in a "Why it matters" panel, clearly labeled as external research, not FleetLab output.

### 3.4 Chapter outline (six chapters, mirroring software-delivery)

1. The map — four zones, one fleet, uneven demand.
2. The price of coverage — what empty kilometers buy.
3. Reactive — wait for the shortfall, then move.
4. Forecast — pre-position to anticipated demand.
5. The verdict — asymmetry is the binding constraint.
6. Try it — learner drives the rebalancing controls.

### 3.5 Code-built visuals (required — never generated)

- **Zone grid:** four zones with exact vehicle counts and demand forecasts, updated per interval. Counts must match the ledger exactly.
- **Policy comparison:** reactive vs forecast side-by-side — empty VKT, unserved requests, pickup wait median/p95 — on a shared scale.

### 3.6 Generated-asset placement

- **Hero:** `NF-05-rebalancing-flow.mp4` (owner-renamed from the generated file) — aerial clay city map, pods gliding along teal arcs between zones. Standard video player spec: autoplay muted loop playsinline + Play/Pause + poster frame. Caption: `Concept illustration · not simulation output`.
- **Decision-notebook vignette:** `NF-06-zone-rebalancing.mp4` — top-down four-zone map with pods moving along dotted arcs. Same player spec and caption.

---

## 4. Follow-on lesson specs (sequenced)

**R3 — dispatch matching.** Route `/network-flows/dispatch/`. Title: "Which car takes the next request?" Simulator: idle vehicles + pending requests on a grid; learner assigns; toggle greedy nearest-vehicle vs lookahead. Binding constraint: request pickup deadlines. Extends the US10775806B2 fleet-objective framing (dispatch serving fleet-level targets, not just nearest car). Research anchor: Jiang/Xu/Varakantham 2025 (+13% served, −21% distance).

**R2 — charging under a shared site power cap.** Route `/network-flows/charging/`. Title: "Who charges first?" Simulator: per-vehicle SoC + site power ceiling + time-of-use prices + departure deadlines; learner schedules charging. Binding constraint: depot power ceiling + charger count. Direct sequel to the capacity lesson (which proved power was *not* the binding constraint there — here it is). Asset: `NF-07-power-ceiling.mp4` beside the power-ceiling readout.

**R7 — OTA update sharing.** Route `/network-flows/ota-sharing/`. Title: "How does the update reach every car?" Teaching story: 40 cars need the same software update. Option A: every car downloads it from the cloud — 40 separate downloads clogging the shared link (the repeated-download failure the learner already saw in the software-delivery lesson). Option B: a few cars download it, then cars pass it to each other whenever they meet. Simulator: % of fleet updated over time; the learner mixes cloud downloads vs car-to-car sharing. Binding constraint: cars meet only briefly, so each encounter can pass only so much data. Takeaway: sharing beats re-downloading — the fleet's own encounters become the distribution network. (Technical term is gossip / epidemic dissemination — it lives in the research doc, never in lesson copy.) Asset: `NF-08-update-ripple.mp4` beside the sharing chart — the video shows the update rippling from car to car, which is exactly the mechanism being taught. Research anchor: Sghaier et al. 2026 (−81% last-hop latency via dual-path V2N/V2V).

---

## 5. Vocabulary rollout

### 5.1 Flagship pair — COD / VOR

- **COD — Car on Drive:** a vehicle currently executing a trip or a repositioning move. In the flow.
- **VOR — Vehicle Off-Road:** a vehicle unavailable for dispatch — charging, receiving a software update, in maintenance, held at depot. Out of the flow.
- The pair partitions the fleet; every simulator in the tree shows COD/VOR state per vehicle.
- **Naming caution:** "off-road" collides with off-pavement driving. First use on every page carries the clarifier: *"off the drive network, not off the pavement."* Fallback term if the collision proves confusing: **OOR — Out of Rotation**.

### 5.2 Industry terms (adopt verbatim, with pinned definitions)

Deadhead ratio (empty miles ÷ total miles), pickup wait (median + p95), service rate (requests served ÷ requests received — pinned), readiness (operable-and-ready time ÷ scheduled time), charge-queue wait, energy cost per mile, link utilization/saturation, flow completion time, cache hit ratio.

### 5.3 Overloaded-term teaching panels

Each new lesson includes a small "one word, several ratios" panel for the terms it touches: **utilization** (fleet vs link vs charger), **throughput** (bits/s vs trips/h vs veh/h), **service rate** (ops % vs queueing jobs/time), **capacity** (seats vs bits/s vs curb slots vs kW vs GB), **rebalancing** (papers: empty-vehicle repositioning; press: any repositioning). Rule: every metric label carries its numerator/denominator.

### 5.4 Placement

- Glossary entries for COD, VOR, deadhead ratio, service rate, readiness — linked from first use in each lesson.
- The R1 simulator's per-vehicle inspector shows COD/VOR status (this is where the vocabulary becomes visible, not just defined).

---

## 6. Asset placement map (all lessons)

| Asset | File | Placement | Caption |
|---|---|---|---|
| NF-05 | `NF-05-rebalancing-flow.mp4` | R1 hero | `Concept illustration · not simulation output` |
| NF-06 | `NF-06-zone-rebalancing.mp4` | R1 decision notebook | `Concept illustration · not simulation output` |
| NF-07 | `NF-07-power-ceiling.mp4` | R2 beside power-ceiling readout | `Concept illustration · not simulation output` |
| NF-08 | `NF-08-update-ripple.mp4` | R7 beside the sharing chart | `Concept illustration · not simulation output` |
| NF-02 | `NF-02-binding-constraint.webp` | capacity, beside "More power" result | `Concept illustration · not simulation output` |
| NF-03 | `NF-03-repeated-clog.webp` | software-delivery, beside repeated-download policy card | `Concept illustration · not simulation output` |
| NF-04 | `NF-04-cache-fanout.webp` | software-delivery, beside cache-arm policy card | `Concept illustration · not simulation output` |

Video player spec (all loops): autoplay muted loop playsinline, visible Play/Pause control, poster frame, prefers-reduced-motion respected. All generated imagery stays text-free; every label and number is HTML/code.

### Generation prompts (v2/v3, 2026-10-14)

NF-07 and NF-08 were re-rendered as v2 after the owner judged the v1 pods muddy/dirty. NF-08 was re-rendered again as v3 after the owner judged v2 confusing and too fast: v3 adds a fully static camera (no rotation or spinning), slow meditative pacing, and a legible narrative — one source pod glows first, the ripple rests a full beat on each pod, then a gentle reset. Share these prompts with ChatGPT if further re-renders are needed.

**NF-07-power-ceiling (v2):**
```
ABSOLUTELY NO text, letters, numbers, logos, or wordmarks anywhere in the video.

Seamless 6-second looping animation: a row of pristine small white clay autonomous pods — each a clean compact rounded pod with a small LiDAR puck on the roof, a teal stripe along the side, smooth matte surfaces with no grime and no texture noise — plugged into sleek modern teal charging posts on a spotless warm cream surface; a wide horizontal segmented teal power bar above fills up to a ceiling line and gently pulses there; one extra pod waits unplugged beside the row; subtle clean shimmer on the charging cables; motion is calm, continuous, perfectly loopable. Soft studio light, claymation feel, spotless, friendly, clean, Apple-grade.
```

**NF-08-update-ripple (v3 — pacing and legibility pass):**
Teaching note: the video shows the update rippling from car to car — the mechanism the R7 lesson teaches (sharing beats re-downloading). The filename matches the visual: a ripple, not jargon. v3 direction: static camera, slow beats, one glowing source pod first.
```
ABSOLUTELY NO text, letters, numbers, logos, or wordmarks anywhere in the video.

Slow, calm looping animation with a completely static camera — no rotation, no spinning, no camera movement at all. On a spotless warm cream surface, a ring of eight pristine small white clay autonomous pods — each a clean compact rounded pod with a small LiDAR puck on the roof, smooth matte surfaces with no grime and no texture noise. The story unfolds slowly and legibly: first ONE pod glows teal, holding the software update; then the teal glow passes deliberately from pod to neighboring pod, resting a full beat on each pod so the eye can easily follow; one by one the whole ring turns teal; then the glow gently fades back to white and the sequence begins again. Slow, meditative, easy-to-follow pacing throughout — nothing rushed, nothing spinning. Soft studio light, claymation feel, spotless, friendly, clean, Apple-grade.
```

---

## 7. Logo integration — DECIDED

**Picked mark:** `FleetLogo.png` — the owner's final pick from the Gemini/ChatGPT round. This file must sit alongside this spec when it is handed to Codex.

**Placements:** all SPA headers, City Explorer header, footer, favicon/touch icon, offline-edition panel.

**Rules:**
- The wordmark ("FleetLab") stays in HTML. The mark file must contain no baked-in text — verify FleetLogo.png is text-free before it ships. If it carries baked-in letters, regenerate or fall back to `logo/LOGO-C2-front-badge.webp`.
- Serve responsive sizes; derive the favicon from the mark.

### Candidate archive (superseded)

Nine generated candidates remain in `logo/` for reference: C1-orbit, C2-front-badge, C3-flow, C4-monoline, C5-apex, D1-sentinel, D2-constellation, D3-horizon, D4-guardian-ring. Fallback if FleetLogo.png fails QA: C2-front-badge.

### Canonical logo generation prompt (owner is running a final round in Gemini/ChatGPT)

```
Logo mark for "FleetLab", an educational website about autonomous-vehicle fleet management.

STYLE: Soft clay 3D illustration, Apple-grade, matte finish, gentle ambient occlusion, soft studio key light from upper-left. Warm cream background (#FAF6EE); deep forest green (#0B3B2E) and teal (#2A9D8F) accents. Friendly, premium, minimal.

SUBJECT: A compact white autonomous pod — rounded corners, ONE small LiDAR puck centered on the roof, a teal-blue stripe along the side, exactly 4 wheels (2 visible), no grille, no logos. Futuristic feeling: sleek, intelligent, forward-looking. It must communicate SAFE network flow — the pod connected to or protected by a gentle network: an orbit ring, a constellation of glowing nodes, a light trail, or a protective ring.

COMPOSITION: 1:1 square. One single standalone mark, centered with generous margin, optionally inside a deep forest-green rounded squircle badge. Nothing cropped.

HARD RULES: Absolutely no text, no letters, no numbers, no wordmark, no badges with writing. The wordmark will be set in HTML separately.
```

Direction variants — swap the "Futuristic feeling" sentence for one of these to explore:
- Safe-flow: "It must communicate SAFE network flow above all — the pod sheltered under a soft protective arc, route lines flowing securely beneath it."
- Ultra-minimal: "Strip it to the essence: the simplest iconic pod silhouette that still reads as autonomous, badge-like, legible at 16px."
- Cinematic: "Dramatic but friendly: deep ink-green badge, pod leaning forward with a teal light-trail, cinematic depth."

---

## 8. Questions for design evaluation

Address each of these in the implementation and report back on them when the build is done:

1. Does the R1 lesson scaffolding (§3) actually teach the binding constraint (demand asymmetry), or does the simulator let the learner win without understanding it?
2. Is the simulator's state/controls/output set (§3.3) minimal and learnable? Flag any control that adds complexity without teaching.
3. Does the COD/VOR vocabulary (§5) earn its place — is it visible in the simulator (§5.4), or is it decoration?
4. Do the four sequenced lessons (§3 + §4) form a coherent tree, or do R2/R3/R7 need reordering?
5. Does anything in the asset placement map (§6) or logo plan (§7) break the clay design system or the text-free rule?
6. What states, edge cases, or failure modes is the spec missing (e.g., what happens when the learner strands every zone)?
7. Which of the logo candidates would you ship as primary, and why — in one paragraph?

---

## 9. Build fences (must-haves and must-nots)

**Must:**
- Implement R1 first (§3). R2/R3/R7 (§4) follow in the stated order; do not build them in parallel with R1.
- Reuse the established lesson scaffolding: recorded synthetic study framing, question headline, chapter guide, per-unit inspection, ledger verification, trust fences.
- Fence every synthetic number: `Synthetic scenario · not operational data`. Fence every concept illustration/video: `Concept illustration · not simulation output`.
- Keep all generated imagery text-free; every label, number, and count lives in HTML/code. Counted visuals are code-built and must match the ledger exactly.
- Video player spec (§6): autoplay muted loop playsinline, visible Play/Pause, poster frame, prefers-reduced-motion respected.
- Roll out COD/VOR per §5, including the "off the drive network, not off the pavement" clarifier on first use, plus the glossary entries.
- Update the software-delivery forward link to `/network-flows/rebalancing/` (§3.1).
- Integrate the picked logo `FleetLogo.png` per the §7 placement map; verify it is text-free before it ships.
- Accessibility: alt text on every vignette and loop; keyboard-operable simulator controls; reduced-motion support.

**Must not:**
- Present synthetic output as real fleet or operator data, ever.
- Present paper headline numbers (§3.3, §4) as FleetLab's own results — they are external research anchors, labeled with venue and year, with preprint/provisional-venue caveats carried over.
- Use the words "gossip" or "epidemic" in lesson copy (§4 R7).
- Bake text, numbers, or counts into generated images or videos.
- Touch the existing `/network-flows/capacity/` and `/network-flows/software-delivery/` lessons beyond the forward-link update.
- Invent routes, lesson titles, or vocabulary beyond this spec — flag gaps and ask instead.
