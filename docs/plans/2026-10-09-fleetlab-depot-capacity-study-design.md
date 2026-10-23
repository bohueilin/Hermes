# FleetLab NF-03 depot capacity study and P0 completion pass: design addendum

**Date:** 2026-10-09. **Owner:** Bo-Huei Lin. **Status:** build decisions for the owner's next-phase design document (`FLEETLAB_NETWORK_FLOWS_NEXT_PHASE_DESIGN_2026-10-09.md`, kept outside the repository). That document is the design; this addendum records the decisions and enhancements the build makes where the design leaves room, so a reader can audit the result without the original.

Boundary: simulation and closed-lab only; no telemetry, runtime model service, new city, SF coupling or operational authority. Trust state stays `SIMULATION_ONLY`, `NOT_EVIDENCE`, `NOT_AUTHENTICATED`, `NOT_EVALUATED`, decision authority and deployment permission `NONE`. Nothing here publishes, pushes or integrates a City package.

## 1. Scope

Two deliverables, two local branches, one final branch:

1. **P0 completion pass** (design section 3) on `claude/fleetlab-p0-completion`: first-screen action placement on both depot flow lessons, after-comparison order with a resource view and recorded wait reason, compact Explore topics, manually stepped reduced motion, film opt-in only, Home DOM order aligned with the phone visual order, a direct NF-01 to NF-02 route sequence test.
2. **NF-03 depot capacity study** (design sections 4 to 7) on `claude/fleetlab-depot-capacity-study`: frozen contract, bounded engine, independent verifier, CPU runner with a committed study manifest, a recorded comparison viewer at `/network-flows/capacity/`, packaging and hosted-integration tooling. The P0 branch merges into the study branch at the end.

Not built: NF-04 and later mechanisms, the 24-permutation serial reference and any solver (design section 5 says after the study is stable), human sessions, device observations, publication.

## 2. Protocol freeze (values are synthetic design choices)

| Element | Frozen value |
|---|---|
| Fixture | `nf03-twelve-visits/1`; 12 distinct visits A1..D1, A2..D2, A3..D3 |
| Arrivals | Wave 1 at 0 s, wave 2 at 600 s, wave 3 at 1,200 s |
| Departure targets | arrival + A 600 s, B 900 s, C 1,320 s, D 360 s |
| Required work | blocking upload; energy to target; independent 120 s local step after upload |
| Horizon | 5,400 s, fixed before every run |
| Regimes (upload bytes A/B/C/D) | data-heavy 60e9 / 7.5e9 / 45e9 / 15e9; energy-heavy 6e9 / 0.75e9 / 4.5e9 / 1.5e9; mixed as data-heavy |
| Regimes (energy joules A/B/C/D) | data-heavy 0 / 0 / 0 / 0; energy-heavy and mixed 21,600,000 / 7,200,000 / 14,400,000 / 3,600,000 (6 / 2 / 4 / 1 kWh) |
| Treatments | base: uplink 125,000,000 B/s, 2 ports, port and vehicle cap 60,000 J/s, site 60,000 J/s; more bandwidth: uplink 250,000,000 B/s; more power: site 120,000 J/s |
| Per-vehicle upload cap | 250,000,000 B/s in every treatment (recorded and verified; it never binds here) |
| Policies | `capacity_fifo`, `capacity_equal_uplink`, `capacity_departure_deadline`, `capacity_shortest_upload` |
| Charging | FIFO port admission by arrival then ID among visits with energy work; a port is held until the target is reached; each occupied port gets min(port cap, site power / occupied ports); zero-energy visits take no port |
| Quantum | 1,000 ms primary; 250 ms refinement; integer bytes and joules per slot |
| Ties | arrival then stable ID; shortest-upload uses remaining known bytes when admitting a serial job; equal share rotates the whole-byte remainder by slot index over the eligible ring in arrival then ID order (as NF-02) |
| Boundary order at time t | close service of the previous slot and record completions and releases; register arrivals; update eligibility and readiness; record deadline events; allocate the next slot |
| Policy knowledge | the frozen observation names only arrived visits, their remaining work and deadlines; no future wave |

Totals checked arithmetically: full-size upload work 382.5 GB; energy-bearing regimes 39 kWh over 12 visits. Analytic fixture: A1 and D1 need 75 GB by 480 s; at 125,000,000 B/s only 60 GB can pass, so both wave-1 targets cannot be met under any rule.

Everything in the design's exclusion row stays excluded: no Wi-Fi contention, retries, cloud ingestion, charge taper, thermal limits, auxiliary load, software download, finite storage, failures, route motion, cleaning staffing or real control. The user asked for the most realistic map possible; the honest answer inside this protocol is a complete logical map that names every real stage and marks which ones this model carries (section 5), plus the list of measurements each excluded stage would need. Realism is added to the explanation, not invented in the numbers.

## 3. Contracts and modules

New contract family `depot-capacity-study/1.0.0` with separately versioned `depot-capacity/1.0.0` (model), `depot-capacity-rules/1.0.0`, `depot-capacity-metrics/1.0.0`, `depot-capacity-record/1.0.0`, `depot-capacity-verifier/1.0.0`. NF-01 and NF-02 modules, fixtures, records and exports are not edited.

- `src/model/depot-capacity-contract.js`: versions, rules, regimes, treatments, `capacityScenario({regime,treatment,time_quantum_ms})`, `validateCapacityScenario` (rejects anything that is not exactly the frozen workload for its declared regime and treatment), object hygiene reused from the NF-02 contract, `canonicalText` (sorted keys, finite numbers only) and `recordDigest` (SHA-256 of the canonical record).
- `src/model/depot-capacity.js`: `simulateCapacity(scenario, rule, {propose, shouldCancel})` slot engine; records `{versions, trust fields, scenario, rule, execution_status, policy_status, end_s, events, intervals, diagnostics, totals}` with per-slot `{id,start_s,end_s,upload,grant_bytes,unused_bytes,charge,grant_j,unused_j,ports}`. `upload` and `charge` are useful rates per second; `grant_bytes`, `unused_bytes`, `grant_j` and `unused_j` are amounts per slot; `ports` gives each charging visit its port, 1 or 2. Every per-slot object holds positive entries only: a visit with no grant, no unused amount or no port has no key.
- `src/model/depot-capacity-verify.js`: independent reconstruction (no engine import) of upload holders and equal-share grants, port admission and power sharing, completions, readiness, deadline events, totals and metrics; corruption of any of these fails closed.
- `src/data/depot-capacity-study.js`: generated, committed study manifest (`depot-capacity-study-manifest/1.0.0`), written as a frozen plain object literal: protocol, versions, workload digest, 72 cells with inputs, record digest and verification summary, refinement agreement, source identity. The 36 primary cells also carry the verifier metrics without `ready_s` and compact per-visit rows (ready time, outcome, lateness, last prerequisite); the 36 refinement cells carry nothing more. No timestamps, so regeneration is byte-identical.
- `tools/capacity-study.mjs`: runs the 72 cells sequentially, verifies each, writes the manifest module, optional per-cell records under `dist/`, and a separate benchmark file (wall time, peak RSS, record bytes, verification time).
- `src/ui/depot-capacity-view.js`: pure projection (cursor state, allocation spans, first allocation difference, first readiness difference, wait reason, example visits, headline sentence).
- `src/ui/depot-capacity-page.js` and `src/ui/capacity-app.js`: the viewer page.

## 4. Load and verification semantics

The four cards read the committed manifest: retrieved evidence, no computation. **Load comparison** reconstructs the four cells of the chosen regime in the browser with the same deterministic engine, verifies each, and compares each canonical record digest with the manifest's accepted digest. Only matching cells unlock inspection. A mismatch, a failed check, or an incomplete manifest shows its reason and keeps the previously accepted comparison, labelled as such. There is no "Run custom setup" action.

Refinement: every primary cell is repeated at 250 ms. Per regime and treatment the viewer's one-sentence reading is shown only if the 250 ms run agrees on every visit's outcome class and on the policy ordering by (missed targets, total lateness). Disagreement is reported in the full table and the sentence is withheld.

Metrics per cell: on time, late, unfinished at a reached deadline, pending, missed (late plus unfinished), total lateness (final only when all twelve visits are ready; otherwise a censored lower bound reported separately, with rankings withheld), per-visit ready times and last prerequisite (ties listed), unfinished work at the horizon, accepted versus available capacity for the uplink, the site feed and the ports.

## 5. The visitor page

Route `/network-flows/capacity/` inside the hosted teaching site, built by `pack.mjs --site` as a second page that shares `styles.css` and the `src/` module tree. The offline single file excludes it and says so in the depot flow lessons. The hosted `integration.mjs` adds the link to the depot flow lesson chooser and an Explore entry under Depot readiness & data. Explore's 61 identities and all routes are unchanged; no new global tab.

Page order: breadcrumb and title; workload choice, alternate rule, **Load comparison**, "What is held fixed?"; status; four matched cards (Base, Different rule, More bandwidth, More power), each naming its changed field; "Which vehicles changed, and why?" with a contrast picker, a deterministically selected affected visit (earliest arrival then ID among visits whose outcome class differs; else the first allocation difference; else "no readiness difference"), improving, regressing and unchanged examples, Play and Next event, a per-visit comparison table, the first allocation difference stated separately from the first readiness difference, a resource board (uplink holders and shares, two ports with kilowatts, site feed used of available, the selected visit's prerequisites and its recorded wait reason), and a twelve-lane timeline per contrast; a logical depot map that names every stage of a real turnaround (arrive and park, bay link, depot network, uplink, cloud ingestion, site feed, port, battery, local step, software, cleaning, departure) and marks which are modeled; the full 36-cell table with refinement agreement and digest prefixes; exact record JSON for loaded cells; model and limits; the closing question "What would we have to measure at a real depot before using this result?" with the design's list.

Design posture: same tokens, type and 44 px targets as the redesign; one primary action per view; static SVG diagrams, not moving cars; no autoplay; reduced motion steps by event.

## 6. P0 decisions

- **First screen** on both lessons: question as the H1, one summary paragraph, the readiness definition and boundary line, a compact setup table, then Compare with "Change the setup" beside it. Rule explanations, the optional guess and the chips follow in disclosures. Targets: the whole Compare button inside 375 by 812 and 1366 by 768 at normal text size.
- **After comparison**: headline and trade-off, compact outcomes, resource view with controls, next test, then bound, task histories, checks and ledger.
- **Explore**: three topic buttons replace the tall topic cards; one filter row; the lab row scrolls horizontally on phones; target: the first lesson card's title inside 812 px at 375 wide.
- **Reduced motion**: Play becomes Next event; nothing advances on a timer.
- **Film**: never starts without the Play film button.
- **Home DOM order**: copy, starting points, film, caption, browse on every width; the desktop grid places the film beside the copy without CSS `order`.
- Body text stays 16 px on studio pages; the 14 px root is unchanged and reported, not marked delivered.

## 7. Packaging and release tooling

`check-dist.mjs --site` accepts exactly two more fixed files (`network-flows/capacity/index.html`, `network-flows/capacity/boot.js`) and applies every existing rule to the new modules. `integrate-site.py --flow-update` declares the new modules and page files in a `CAPACITY_ADDED` allowlist; the root `_headers` policy already covers the new path. The offline cap and reserve are unchanged; the hosted code total must stay under 2,621,440 bytes.

## 8. Risks

- Browser reconstruction of four 5,400-slot cells plus hashing: expected well under a second; measured in the build report.
- The manifest module size: expected about 40 KB; measured.
- The P0 merge touches `styles.css` in both streams; the study stream only appends.
- No human, device or screen-reader observation is produced by this build; the report says so.
