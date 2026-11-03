# FleetLab R1 implementation handoff — October 14, 2026

Status: LIVE, validated and pushed to GitHub. Supersedes the R1 review-only checkpoint. R3/R2/R7 remain contract drafts, per the owner's explicit answer.

## Delivered scope

Build spec §3: hosted `/network-flows/rebalancing/`, “Where should the empty cars go?”, 24 cars/four zones/120-minute frozen study, reactive and perfect-next-count heuristics, six guided chapters, counted zone state/transit, per-vehicle full event trace, whole-run paired metrics and zone wait comparison, full 52-zone-row ledger per arm, pending/manual allocation and independent reset.

Build spec §3.1: software-delivery forward link now points to R1; R1 continues to the existing delivery-order lesson. Hosted Explore and roadmap expose R1 only when the complete integrated generation declares its release marker.

Build spec §§5–7: Ready / idle, COD and VOR defined separately; no fabricated VOR events. Numerators and denominators explained. NF-05 hero and NF-06 decision vignette preserve the concept/output distinction. Muted, playsinline looping films have visible controls, reduced-motion/data-saver handling, visibility pause, poster fallback and explicit error retry. Owner-selected text-free FleetLogo mark replaces the image wordmark; HTML text, responsive derivatives, favicon/touch icon, headers, footer and offline panel retained. Existing homepage animation and teaching content remain.

## Actual results, not promised benefits

| Outcome | Reactive | Forecast |
|---|---:|---:|
| Requests admitted |163|163|
| Pickups within deadline/observation |137|151|
| Trips completed |132|145|
| Picked up, trip unfinished at 120 min |5|6|
| Expired/unserved requests |26|12|
| Empty kilometers |59.4|92.2|
| Pickup approach km |27.4|30.2|
| Repositioning km |32.0|62.0|
| Zone B p95 pickup wait, served only |60s|258s|

Forecast serves 14 more requests for 32.8 more empty km, while Zone B's tail wait worsens. No scalar winner, paper-effect target or fleet-optimum claim. The two rules also use different reserves: this is not only a timing switch.

Reactive record SHA-256: `43c92491189cdb64eea6c5483488374a00399e155f6b61475bce093d449ec17a`.
Forecast record SHA-256: `30543a2352d3e826e9f82ce61fe82d07b5e9cf01dc92b019582e1df4bf977f89`.

A bounded worker reconstructs the recorded arms. An independent verifier reconstructs mandatory events, complete ledgers, legal policy moves, exact request populations and rational distances without importing the producer. Common-input identity and pinned study digests gate acceptance. Manual edits do not change results until a matching checked response is accepted. Stale/corrupt responses and over-allocation are rejected; a batch in flight cannot be edited. Emptying a zone is allowed with a specific projected-zero warning.

## Deliberate amendments and gaps

- The owner approved the full R1 numerical contract before implementation; all invented workload/algorithm choices are recorded there. No further scientific parameters were invented during implementation.
- The owner approved 40 KiB package metadata after the initial inventory exceeded 32 KiB. All other ceilings remain unchanged; final measured counters appear below from the immutable build.
- Immutable study pins live under `src/model/` to retain the runtime dependency boundary. There is a narrow R1-only forecast terminology and exact research-navigation exception; remote asset/network restrictions remain.
- Only the two reviewed MP4 derivative paths are excepted from existing ignore rules. Original full-size videos and unrelated owner files remain unstaged.
- The requested paper effect for Yang/Liu/Du remains withheld because its primary source was not verified. The Jacobsen preprint is linked with its real version date and external-results boundary. No implied replication.
- R3/R2/R7 need owner review of the supplied complete contracts; no numerical implementation, chart results or public lesson routes for them yet.
- No physical Pixel test in this release; responsive browser checks do not establish hardware qualification. Independent human comprehension, SF map/source review and existing SF launch holds remain open. This teaching release grants no operational authority.

## Review decisions

One fresh independent final review found two R1 issues, both fixed with failing-then-passing tests: removal of a submitted pending row, and absent actual zero-ready-zone warning. It also corrected the R2 draft's power diagnostic to distinguish commanded allocation from actual draw. No deferred minor findings. Final source-bound integration and live behavior were outside that review and are separately checked below.

## Build-spec §8 design answers

1. **Demand asymmetry:** the first chapter puts ready cars beside next-interval demand, and the comparison shows both unmet demand and travel cost. There is no win score. Forecast also worsens one zone's wait, so the lesson cannot honestly collapse to “move more cars.” Human comprehension is still unmeasured.
2. **Controls:** recorded policy, snapshot clock and vehicle inspection are view-only. Only the final chapter exposes origin, destination and vehicle count, followed by a single batch acceptance. Pending changes stay separate from accepted results. No additional tuning sliders or invented policy knobs were added.
3. **Vocabulary:** Ready / idle and COD have visible, counted examples. VOR is explicitly zero because this workload contains no charging, maintenance or update activity; it is defined without inventing events. The three-way partition corrects the initial COD/VOR-only gap with the owner's approval.
4. **Sequence:** R1 location → R3 assignment → R2 energy availability → R7 package dissemination builds a coherent learning path. Each contract remains independently versioned; this is a learning sequence, not evidence of one integrated fleet optimizer.
5. **Media:** the two supplied concept loops stay separate from counted code-built state and carry the required caption. The selected text-free vehicle mark fits the existing warm palette; the readable wordmark remains HTML. Exact-size derivatives, motion controls and posters preserve the mobile experience.
6. **Missing states resolved:** explicit request expiry and horizon clipping, idle dispatchability, in-transit conservation, complete boundary coverage, over-allocation rejection, an allowed-but-warned empty zone, immutable accepted results during edits, stale worker rejection, and no next-interval forecast beyond the observation. These choices are in the approved R1 contract and tests.
7. **Logo choice:** ship the owner's selected `FleetLogo.png`, which was inspected as text-free and converted to hosted responsive derivatives. It provides a recognizable vehicle silhouette without encoding simulation state. No alternate candidate was substituted.

## Follow-on review packet

1. `FLEETLAB_R3_DISPATCH_MODEL_CONTRACT_2026-10-14.md`: exact current-batch matching versus greedy; no future request oracle.
2. `FLEETLAB_R2_CHARGING_MODEL_CONTRACT_2026-10-14.md`: six-car workload, exact taper integration, plug/site limits, tariff and deadlines.
3. `FLEETLAB_R7_OTA_SHARING_MODEL_CONTRACT_2026-10-14.md`: 40-car chunk dissemination, explicit contacts, cloud/seeding/rescue and counterexample. Package delivery does not mean installation or fleet readiness.

Recommended review prompt: “Review these proposed synthetic model contracts before implementation. Identify ambiguous event ordering, objectives, invariants, input domains, metric denominators, unearned optimality/safety claims and missing counterexamples. Check whether a visitor could understand the decision and its costs. Do not substitute research percentages for expected results. Return only concrete amendments, distinguish blocking defects from optional extensions, and preserve build order R3→R2→R7.”

## Recommendation

R1 is published. Review the three follow-on contracts before building their numerical outcomes; R3 is next after approval and package-budget review.

## Top risks + mitigations

1. Optimistic forecast mistaken for production prediction: explicit perfect-count assumption and mixed results.
2. Inconsistent evidence displayed as results: independent coverage/common-input checks and synchronized accepted identities.
3. New lessons mistaken for AV qualification: persistent synthetic scope, missing-evidence labels and separate SF holds.

## Next 3 actions

1. Review R3, R2 and R7 contracts together or sequentially.
2. Resolve R3 source packaging within existing budgets or explicitly review a proposed amendment.
3. After approval, implement R3 first with its bounded verifier and counted UI.

## Validation record

Commands actually executed in this workspace (logs under `build/fleetlab-city/validation/r1-build-20261014/`):

| Gate | Observed result |
|---|---|
| Focused R1 model/verifier/session/UI/package tests |34 passed after review fixes|
| Concept-loop player tests |8 passed, including actual-error explicit retry|
| City Node suite |94 passed|
| City Python unittest discovery |343 passed (includes40KiB Python boundary regression)|
| Hermes pytest with `PYTHONPATH=src FLEET_PLAYGROUND_BASE=bca4ccd` |1,662 passed,55 skipped|
| Ruff |passed|
| Hermes Doctor |17 PASS,1 WARN (working tree edits),1 optional NOT_AVAILABLE|
| Browser |1280px desktop,390px and320px responsive widths; no horizontal page overflow after fix; accepted/rejected manual batches, recorded arm switch, complete52-row ledger,24-vehicle conservation, keyboard endpoint and no console errors|
| Full teaching Node suite |2,372 passed,8 skipped,1 todo;0 failures|

Initial failures were resolved, not hidden: old fixtures omitted new owned media; runtime pins were moved to the permitted model layer; a local variable named `window` was renamed to avoid the model boundary guard; the filesystem reader retained its existing bounded API; exact two-path ignore additions were tested; source restoration now includes the R1 sidecar. One interim suite encountered a CSS mutation during reproduction while responsive QA was editing it; the final suite runs against stable application sources.

```sh
node --test playground/fleetlab/test/*.test.mjs
node --test apps/fleetlab-city/test/*.test.mjs
build/fleetlab-city/venv/bin/python -m unittest discover -s apps/fleetlab-city/tests
PYTHONPATH=src FLEET_PLAYGROUND_BASE=bca4ccd conda run -n hermes-dev python -m pytest -q
conda run -n hermes-dev python -m ruff check .
PYTHONPATH=src conda run -n hermes-dev python -m hermes doctor
git diff --cached --check
```

The first immutable integration stopped before upload because the Python integrator retained the old 32 KiB receipt cap. Its mirrored cap is now 40 KiB; a regression test verifies 40,960 bytes reach source verification and 40,961 bytes are rejected. No other limit changed.

The second immutable integration stopped before upload because Python's forward-link transformation still targeted delivery order while the JavaScript source reproduction expected R1. The two transformations now agree; the expanded parity test was observed failing before the fix and passing after it. Full City Python tests and Ruff then passed. The final v3 build passed exact source reproduction and the 10,120-file upload guard. Neither failed build was uploaded.

## Final measured package

Source implementation: `5ffe7c1dc33ba7b055c907ef55fb378b2d247610` (includes R1 plus the two integration corrections).

| Measurement | Actual bytes | Ceiling / meaning |
|---|---:|---|
| Package metadata |34,892|40,960; the only amended ceiling|
| Complete offline download |2,563,278|2,571,440; unchanged from previous publication|
| Original source + build tools |3,093,857|3,145,728|
| Compressed teaching source offer |954,770|4,194,304|
| Integrated emitted text |3,019,087|3,145,728|
| Integrated R1 runtime closure |131,320|includes shared integration modules|
| R1 concept derivatives |1,983,799|2,097,152; two videos and two posters|
| All hosted artwork |4,770,278|separate artwork counter|
| Complete integrated stage |1,625,656,953|10,120 files including existing City payload|

Offline SHA-256: `532986f1a67923735d9692ca106337697e7e50885d254ca23e6597ee6a524f8a`.
Current City presentation generation: `fde5c033bb02929e`; scientific inputs/results remain unchanged. Existing compatible City generation `c56bda6b509105c5` remains staged. The large complete stage is principally the existing City payload, not newly downloaded R1 content.

The original-source/tools ceiling has only 51,871 bytes remaining. Before R3 implementation, measure the actual contract's source and establish a reviewed packaging plan; the 40 KiB metadata amendment does not authorize increases to this or any other budget. R1 is hosted-only and is not added to the complete offline numerical edition.


## Browser and hosting observations

The immutable preview reconstructed both accepted policy records in-browser. Its 120-minute forecast endpoint conserved all 24 vehicles (18 in zones, 6 in transit) and labeled the endpoint “observation end.” A manual A→C batch of 2 vehicles remained pending until acceptance; after acceptance the display advanced to 10 minutes with 9 pickups, 7 completed trips and 5.8 empty km. The integrated catalog exposes R1, and the software-delivery onward link resolves to `/network-flows/rebalancing/`.

At 390 px the deployed preview had a 375 px document width with no horizontal page overflow. Local 320 px and 1280 px checks were also completed. These are browser viewport checks, not a physical Pixel certification. On stable production the chosen logo loaded, the established homepage remained present, R1 independently reconstructed both arms and displayed the same 137/151 pickup and 59.4/92.2 empty-km outcomes, with no captured console errors. Concept autoplay and its visible Pause control were observed; automated tests cover reduced motion, data saving, visibility and retry behavior.

Private reproducibility artifacts are under `build/fleetlab-city/validation/r1-build-20261014/`. Full JSON file readbacks, header responses, build logs and browser screenshots remain there; the committed compact publication receipt binds their hashes without checking generated artifacts into Git.


## Verified publication

- Live lesson: https://fleetlab.pages.dev/network-flows/rebalancing/
- Source commit: `5ffe7c1dc33ba7b055c907ef55fb378b2d247610`.
- GitHub branch: `bohueilin/Hermes`, `codex/fleetlab-city-sf`; implementation and subsequent handoff/receipt commits pushed. Production uses the configured Pages branch alias `feat/fleetlab-playground`; this is not a claim that the Git branch was merged.
- Preview: `43a2f25b-5de8-470a-a007-16d7eada5261`, https://43a2f25b.fleetlab.pages.dev.
- Production: `186cb2a5-23b8-419f-8aaa-4cf95cf44567`, https://186cb2a5.fleetlab.pages.dev.
- Stable production full byte readback: **10,119 / 10,119 matched**, captured 2026-10-15T01:50:48Z (October 14 Pacific).
- Immutable preview full byte readback: **10,119 / 10,119 matched**.
- Hosting header checks: **61 / 61** on both preview and stable production.
- New immutable production smoke: **82 / 82**; previous production smoke: **62 / 62**. The prior immutable deployment remains reachable.
- Committed receipt: `docs/releases/fleetlab-current.json`, with build identity, sidecar/source-offer hashes and hashes of full private validation reports.
- No live-file mismatch, browser-console error or unresolved release-test failure was observed. Eight teaching tests skipped and one existing TODO remain visible in the suite report; 55 Hermes tests were skipped. These are not claimed as passes.
- SF qualification remains **HOLD**. Physical Pixel and independent human/map-source qualification are not established by this release. No Austin or other-city work was started.

The two integration failures occurred before upload and were fixed with regression tests. A private header-check invocation initially used the system Python, which lacks `datetime.UTC`; it was rerun successfully under the project's Python environment. This was a validation-runner mismatch, not a hosted-site failure. All final assertions above refer to completed passing runs.
