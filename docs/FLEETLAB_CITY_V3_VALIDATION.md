# FleetLab City v3 — validation record

29 September 2026. Tested working tree based on `7e1da7cb72ca0e08fe46ead83db07adfce0e757e`, branch `codex/fleetlab-city-sf`. Source changes remain a separate overlay; historical baseline records are preserved. This is a local review and launch-preparation result. Public deployment has not occurred.

## Changes

- A guided welcome page, three-step learning path, model-fidelity guidance, and original Ojai/Zoox concept illustrations with source links and explicit simulation boundaries.
- A separate candidate-map selector, before/after road-class qualification table, exact district-gap inspection and evidence downloads.
- Versioned via-way routing support, stricter source accounting, bounded compiled-rule validation, independent sequence inspection and a fail-closed fleet guard.
- Candidate report, display geometry, coverage, source identities, review queues and gap calculations bound to captured artifacts. Rehashed cross-file mismatches fail.
- Shared request ordering across map versions and layers; welcome remains accessible while city data loads or fails.
- A legacy-preserving launch staging tool, content-addressed current/prior viewer directories, proposed route-header and navigation diffs, and rollback descriptors.

## Scientific and regression validation

| Check | Result / evidence |
|---|---|
| City Python suite | 86 PASS; `build/fleetlab-city/validation/launch-v3/python.log` |
| Node browser-logic suite | 15 PASS, including four actual-handler response-order/error regressions; `node.log` |
| Legacy Python parity/boundaries | 89 PASS in 5.27 s; `legacy-python.log` |
| Full serial legacy Node suite with timing gates | 1,972 PASS, 0 FAIL, 1 existing TODO; 295.922 s; `legacy-node.log` |
| Root Ruff | PASS; `ruff.log` |
| Doctor | 16 PASS, 2 WARN (active environment label, dirty tree), 1 optional NOT_AVAILABLE; `doctor.log` |
| Legacy hosted/offline checkers | PASS; 99 files / 3,366,216 bytes hosted, 2,424,861 bytes offline |
| Source accounting | 69,027 ways and 2,490 restriction records accounted; 431 supported compiled rules |
| Candidate routing | 100/100 OD paths agree across A*/prepared Dijkstra and pass direct path inspection; `map-v2-routing.json` |
| Supported overlap cases | 40,920 generated overlap/prefix cases agree with direct inspection, within the compiler's bounded subset |
| Frozen v1 preservation | Original graph, coverage, source inventory, road display and geometry reproduce exactly; `sf-v1-preservation.json` |
| Frozen v1 execution | Seed-1001 baseline digest reproduced after supplied-router guard changes; `sf-v1-guard-repetition.json` |
| Display projection preservation | Shared projection reproduces exact frozen v1/v2 road bytes; no source/pack outputs changed by the refactor |
| Final recorded data | All 2,429 pre-existing non-catalogue data files match v2 byte-for-byte; `launch-v3/final-audit.json` |
| Separate final code review | Road-display binding finding resolved; 5 focused tests include 8 rehashed tamper cases; no new actionable findings in that scope; `focused-review.json` |

Candidate compiled-rule validation costs about 0.8 ms on the captured candidate; supplied-router binding costs about 0.93 s per full SF run, with no per-step overhead. These are local observations, not performance guarantees.

The final legacy timing run passed with original thresholds after map builds and browser animation had stopped. It does not erase earlier failed timing observations, qualify the new app's unmeasured interaction percentiles, or prove performance under arbitrary CPU contention. Ruff and `git diff --check` also passed after the final documentation update.

Core repeatable checks, from the repository root:

```bash
PYTHONDONTWRITEBYTECODE=1 build/fleetlab-city/venv/bin/python -m unittest discover -s apps/fleetlab-city/tests -v
node --test apps/fleetlab-city/test/*.test.mjs
FLEET_PLAYGROUND_BASE=bca4ccd PYTHONDONTWRITEBYTECODE=1 PYTHONPATH="$PWD/src" /Users/bohueilin/miniconda3/envs/hermes-dev/bin/python -m pytest -q tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py
FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 playground/fleetlab/test/*.test.mjs
/Users/bohueilin/miniconda3/envs/hermes-dev/bin/python -m ruff check .
git diff --check
```

Do not run the timing suite concurrently with full-map imports, package copies or replay animation. Performance thresholds remain unchanged. Generated evidence is under `build/fleetlab-city/validation/`; the tested source overlay is inventoried in `launch-v3/implementation-files.json`. This identifies local bytes rather than implying they were committed.

## Final review package

`dist/city-explorer-v3-final/` contains the freshly verified 34 recorded arms and the separately bound candidate map. Every served frontend source file matches the final source tree. The older `dist/city-explorer-v3-reviewed/` and mutable `dist/city-explorer-v3-preview/` are intermediate review artifacts, not the final release.

- Release manifest SHA-256: `7450c2aaf5e5ca90e2f5cbf6cf7d05cf6520f11b1f92267bbdf511c557ce2926`.
- Candidate pack: `00ac2168f2b93e526cc824fe717859b835bda6928f49b6998bb4f75a05f27eb9`.
- Original pack remains `5c604fa0c0af9355dd6851ec5f6f7cac16a00b3c296c08de318f468ac1d7e536`.
- 4,908 manifest-listed files; 1,858,502 bytes first-view gzip; largest file 22,272,149 bytes.
- Pair replay gzip 9,546,202–9,848,483 bytes; comparison 24,354 bytes.
- Integrity, 3 MiB initial transfer, 25 MiB file size, 20 MiB pair replay and comparison budgets pass.

## Browser and physical-device observations

The new UI was inspected in the in-app browser at desktop, tablet and narrow widths. Actual interactions verified the vehicle-reference selector and heading sketch, map-version selection, gap inspection, and preservation of static welcome/gallery content when the city catalogue is missing. Deferred-response regression tests exercise the actual map handlers; they are not a substitute for browser observations.

`launch-v3/browser/evidence.json` records the observations, precise scope and screenshot hashes. The final welcome and vehicle/gallery screenshots are local review artifacts; phone serial and account identifiers are not included.

A physical **Pixel 10 Pro XL / Android 17** loaded the existing v2-reviewed replay through a USB reverse port and a scrcpy mirror controlled through the Mac UI. The actual phone rendered the route, one-depot square, readable copy, featured vehicles and controls. Keyboard activation played the recording to 15:00 / 8h 00m and restarted it directly, observed progressing again at 08:57 / 1h 57m elapsed. Screenshots are in `launch-v3/browser/pixel-completed-v2.jpg` and `pixel-restarted-v2.jpg`. Recorded data is unchanged in v3; this observation is still labeled v2 rather than claiming an unperformed v3 device sweep.

During the new-page Pixel check, the Mac locked. The control tool reported that automatic unlock failed. The owner was asked to unlock manually; independent code/build checks continued. Do not infer a new-page physical-device pass from narrow browser emulation. Touch/pinch, final v3 Pixel sweep, iPhone/Safari, screen-reader use, context-loss recovery and the five-person formative study remain unclaimed unless an actual subsequent record below supersedes this paragraph.

Quantified cold-load, frame/selection/seek percentiles, browser memory ceiling and OS reduced-motion validation also remain pending from the previous record. Package transfer budgets and the existing legacy timing suite answer different questions.

### Concrete remaining device and human checks

After manually unlocking the Mac, load the final v3 package on Pixel and record each observation separately: initial welcome; all three gallery references; atlas zoom/pinch and source inspection; candidate/recorded map switching; one/two depot replay markers; direct Play and restart; fare fields empty then populated; portrait/landscape readability; and TalkBack focus/labels. Record device, browser/version, build identity, input method, result and reproducible issue. USB authorization by itself is not a pass.

For five independent first-time visitors, use the final build and ask them to perform these tasks without presenter coaching:

1. Explain the one-depot/two-depot question and name what stays constant.
2. Explain what a seed and an experiment pair mean.
3. Use EV-001 to explain why a vehicle can remain at the depot.
4. Distinguish a fleet result from one selected vehicle's story.
5. Identify which map is candidate-only, which vehicle was simulated, and which safety/revenue claims are unavailable or assumed.

Record task completion, their own explanation, time/help required and confusing wording. Do not invent observations or use team review as five independent participants. This is a formative study to find presentation failures, not statistical proof of broad usability or launch approval.

## Qualification and launch disposition

SF v2 reduces unsupported eligible road length to 1.322%; primary roads now meet the existing class threshold. Trunk and living-street classes still fail. District coverage, source-semantic review and fleet-leg continuity remain open. Candidate fleet execution is rejected. Original notebook/replay results remain diagnostic under SF v1.

The existing public site was fetched read-only: all 98 served payloads match the preserved 99-file local bundle, with legacy headers confirmed. The older readback for two files was stale and is retained as history. A local Wrangler Pages 4.135.0 synthetic probe confirmed one legacy CSP at root and one city CSP on the new route; duplicate inherited headers were removed. Hosted Pages preview and owner review remain separate from this local probe.

The final local stage contains 9,897 files, including all 99 legacy files unchanged, and both current/prior compatible City Explorer releases. A separate local Pages rehearsal applied the proposed header changes. Root/city response checks and switching to the prior release and back passed. The actual browser followed the stable entry with `?renderer=flat#replay` intact, loaded EV-001, and restarted it from 15:00 directly to 07:00. Playback paused when the tab lost visibility; no continuous-animation claim is inferred from that browser interaction. On the final staged welcome view at 390 × 844, document width was 375 px within the 390 px viewport, with no horizontal overflow; its screenshot was visually inspected. The final staged tab reported no browser errors.

Wrangler's local emulator ignored a byte Range request and returned the full file; the FleetLab review server returned the expected HTTP 206 / 128-byte range. Hosted Pages Range behavior is **NOT_RUN**. See `FLEETLAB_CITY_LAUNCH_PREPARATION.md` for exact stage commands, proposed diffs, rollback and remaining readback. Local port 4173 now serves `dist/city-explorer-v3-final/`; port 4180 serves the rehearsal route. Neither is a public deployment.

No paid model calls or infrastructure purchases were initiated. Existing account charges were not audited. No operator data, endorsement, real vehicle connection, physical safety result or deployment authority is claimed.

## Recommendation

Use the final review build for a bounded demonstration. Review the launch stage and source gaps before publishing or treating the candidate as the next experiment map.

## Top risks + mitigations

Version confusion is controlled through distinct map identities, byte preservation and an execution guard. Misleading realism is controlled through sourced reference labels and explicit absent physics. Browser/device and comprehension uncertainty remain visible, with the actual phone observations distinguished from pending checks.

## Next 3 actions

1. Complete the final device/participant checks and record observations.
2. Resolve restriction, district and cross-leg contracts, then rerun qualified experiments.
3. Review the concrete staged route, headers/navigation diffs and rollback before any public switch.
