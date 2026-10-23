# City Explorer UX v2 — scope and implementation decisions

Owner direction, 2026-09-29: improve the San Francisco experience before adding cities; make maps, repeat/vehicle selection, replay and operational summaries understandable to technical and business audiences. The owner explicitly selected visitor-entered fares, with no estimate until set.

## Product decisions

- Keep the existing sourced SF geometry and frozen graph/resource experiment. No simulator swap or new city is needed for this enhancement.
- Explain the question before the controls: one versus two fictional depots, equal total capacity, shared inputs within each repeat.
- Put reproducibility jargon second: “Repeat 01 · seed 1001.” The seed identifies generated inputs, not an AV scenario class.
- Offer transparent, deterministic vehicle examples while retaining all 100 IDs. Preserve the selected vehicle when switching configurations.
- Use red squares and labels for depots; color alone is insufficient. Replay renders only active sites.
- Show true traveled route geometry and held sampled positions. Never present straight-line interpolation as a recorded road trajectory.
- Expose the complete eight-hour history, charging/turnaround queues and the terminal recording state.
- Distinguish completed PUDO trips, unfinished assigned/aboard requests, all traveled distance and completed passenger fare population.
- Keep safety/regulatory metrics unavailable; generic turnaround cannot imply cleaning, repair or software work.
- Improve small text by roughly two pixels and adapt the layout for mobile instead of shrinking descriptions to fit.

## Implementation sequence and checks

1. Add tested descriptive projections from verified bundles: trip/energy/queue totals, depot activities, state intervals, road routes and fleet selection indexes.
2. Add replay restart and explicit-fare/controller regressions; keep request revision invalidation for overlapping asynchronous selections.
3. Share the map renderer between Atlas and Replay, with detailed local labels and an interactive flat fallback. Retain no-provider browser policy.
4. Rework the visual hierarchy, trip summary, full history and audience framing; add a presenter guide with each pair's measured trade-off.
5. Inspect desktop/mobile painted frames, replay/seek/restart, site configuration, selection changes, fares and missing/incompatible records. Attempt the connected Pixel; report permission and human-validation gaps honestly.
6. Run independent read-only review, fix concrete findings, rebuild a new package with fresh run verification, and execute applicable regression/distribution checks.

## Boundaries and alternatives

GeoLibre was evaluated from its primary repository as a possible GIS authoring/inspection tool. It already uses MapLibre and does not itself improve the source or simulation model, so it was not added to the focused viewer. No Google Maps content was scraped or copied. MetaDrive/MuJoCo and richer 3D worlds remain separate fidelity decisions for a later experiment.

This pass does not relax map qualification thresholds, change the frozen scenario, claim operator calibration, deploy publicly, or establish physical-vehicle safety. Current outcome and evidence are recorded in `docs/FLEETLAB_CITY_UX_V2_VALIDATION.md`.
