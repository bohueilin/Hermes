# NF04-B software-delivery lesson implementation plan

> **For agentic workers:** Use review, test-driven development and verification skills. Independent packaging and model domains may use the dispatching-parallel-agents skill; shared interfaces are frozen below before concurrent implementation.

**Goal:** Publish one bounded, verified software-delivery comparison with three counterexamples while preserving existing FleetLab and SF content.
**Architecture:** Canonical schema → independent engine and verifier → manifest-bound accepted pair → projection → route-local UI and terminated-worker cancellation. Owner-aware packaging binds the entire integrated generation.
**Tech stack:** Existing dependency-free JavaScript ES modules, Node 22.22.0 tests, Python integration, pinned Cloudflare deployment.
**Spec:** `docs/FLEETLAB_NF04_B_ACCEPTED_BRIEF_2026-10-13.md`, with the Oct12 contract A1 allocator mathematics retained.

## Authority and amendments

User explicitly requested build, validation and live publication on Oct13. This overrides AGENTS §19's historical local-only publication restriction for this educational website and redundant skill approval checkpoints; it grants no physical-system authority. Contract document version 1.1.0; first NF04 input/record versions 1.0.0. Accept the consolidated brief's named defaults, explicit caps, empty inventory, persistent arm choice, primary-only browser reconstruction and hosted-only discovery. Historical Oct12 files remain historical, with a pointer to the new amendment. Current HEAD cf690bd7d974b8e057560a9a993374a83e4ec769; published source eef0180e160671efa1fd9202321096741dbd27f9. Existing isolated branch codex/fleetlab-city-sf is reused; five owner-untracked design files are preserved.

## Global constraints

Simulation only; SF HOLD / BLOCKED_MAP_QUALIFICATION; no Austin, held power study, preload, nonempty inventory, optimizer, backend or dependency upgrades. No full record arrays shipped. Preserve all hard caps from accepted brief §4 and §5.5. Source growth target 307200 B; NF04 route-local target 327680 B; closure hard cap 524288 B. Preserve NF03 science and offline reserve. Human/device gates stay explicitly open unless actually observed.

## Review focus

1. Pending preset must not rename a prior accepted pair; test cancellation and rejected replacement.
2. Raw off-boundary times and inclusive deadlines must not inherit display rounding; test 1999/2000 ms and rounding fixture.
3. Failed/censored requests must remain denominators with null readiness; test actual boundary/future-failure projection.
4. Shared cache traffic must not appear as selected vehicle traffic; test staggered t150 and default t378.
5. Scoped ownership must not omit hosted integration or reclassify legacy dependencies; test unknown paths and legacy cap independently.

### Task 1: Packaging preflight
Files: `tools/pack.mjs`, `check-dist.mjs`, `release-sidecar.mjs`, `package-proof.mjs`, new `tools/software-delivery-package.mjs` and focused tests under `playground/fleetlab`; exact integration mirrors under `apps/fleetlab-city` when needed.
- [x] Reproduce P1 all-text cap and P2 whole-site sidecar at current HEAD.
- [x] Write and observe failing historical +118 B legacy, scratch 300000 B NF04-only, unknown owner, NF03 sidecar scope, final integration text and discovery tests.
- [x] Implement explicit ownership/reachability, scoped versioned NF03 metadata and distinct NF04 metadata. Count integration source and emitted text without raising gates.
- [x] Run focused tests and publish preflight counters before model/UI implementation.

### Task 2: Canonical model and independent verification
Files: `src/model/software-delivery-contract.js`, `software-delivery.js`, `software-delivery-verify.js`; `src/data/software-delivery-study.js`; generator `tools/software-delivery-study.mjs`; tests `software-delivery-*.test.mjs`.
Interfaces: `deliveryInput(preset='default', quantum_ms=1000)` returns canonical common input; `normalizeDeliveryInput(input)` validates and sorts; `runDelivery(input, policy)` returns record; `verifyDelivery(record)` independently derives every ledger and returns `{ok, errors, metrics, record_digest, input_digest}`. `canonicalDelivery` and `deliveryDigest` are schema-only utilities. Record shape is frozen in the contract module before separate implementations begin.
- [x] Write numerical fixtures directly from accepted brief §6 and Oct12 A1, observe initial failure.
- [x] Implement bounded engine, independently implemented verifier, strict schemas and canonical identities.
- [x] Exercise all analytical cases, permutations, wrong-grant/cursor/eligibility/digest/manifest mutations and transitive dependency separation.
- [x] Generate primary/refinement summaries and digests for four public presets; measure serialized entries/bytes, runtime and stress.

### Task 3: Accepted projection and visual lesson
Files: `src/ui/software-delivery-view.js`, `software-delivery-page.js`, `software-delivery-player.js`, `software-delivery-app.js`, `src/runtime/software-delivery-worker.js`, `software-delivery/index.html`, `software-delivery/visual.css`; focused model/UI tests.
- [x] Pin projection boundaries, own/shared rates, target language, failure/censoring, fixed outcomes and finite endpoints in tests before implementation.
- [x] Add worker job tokens and actual termination; atomically accept two verified manifest-matching records; preset changes wait for explicit Watch and preserve prior labels.
- [x] Render warm ivory/forest/teal bench, six held default chapters, exact shared clock, paired whole-run outcomes, common rate scale, named mobile arms and causal inspectors.
- [x] Add static counterexamples, persistent view state, separate finite timeline, off-boundary event navigation and accessible controls; test hide/show/history/preferences/cancellation.

### Task 4: Integration and review
Files: `apps/fleetlab-city/hosted/integration.mjs`, integration transforms/guards and tests; targeted NF03 CSS/title only if confirmed.
- [x] Add hosted catalog/next-lesson/roadmap discovery only for accepted same-generation route; no new top-level tab or dead offline action.
- [x] Run full teaching/City/Hermes regression, Ruff, doctor and diff checks once integrated; resolve failures with focused reruns.
- [x] Observe desktop/390/320 layouts, keyboard controls and benchmark20 default browser trials. Record native static preferences/zoom, physical Pixel and human/device gates explicitly open as described in handoff.
- [x] Obtain independent whole-change review, fix material findings and record validation.

### Task 5: Authorized publication and handoff
- [x] Stage only task files, run publication guard and review cached diff, commit and push github/codex/fleetlab-city-sf.
- [x] Build exact-commit package in clean managed release checkout; integrate unchanged City; verify complete final budget/ownership and source guard.
- [x] Deploy preview; verify bytes/headers/interactions. Publish the identical artifact to stable production and verify production bytes/headers/immutable URL.
- [x] Update Oct13 handoff, audit dispositions, latest release receipt and CODEX_HANDOFF with measured identities and remaining physical/human gates. Push documentation and provide reviewable links.

## Progress ledger

- Kickoff: user scope accepted; external feedback treated as recommendations. P1 and P2 confirmed by current pack/check and sidecar source inspection. Baseline package tests running. No NF04 model work started before packaging preflight.

- Implementation checkpoint: schema/engine, independent verifier, all16 primary/refinement identities, accepted-pair UI, worker termination, counterexamples and hosted discovery complete. Independent code review clear; extra400 runs verified. Broad City72/338 and Hermes1662/55skip, Ruff pass; three teaching regressions corrected without relaxing gates, final broad rerun running. Packaging focused72/72 and final integration28/28 pass. Browser1440/390/320, keyboard, public presets and20 default trials observed. Physical Pixel absent; native preferences/screen reader/zoom/human comprehension and browser peak heap stay open as specified in handoff. Native worker60 cancellations actually exited; no browser latency claim.

- Final precommit gates: teaching2270 passed/8skip/1TODO, no failures; generated16-run manifest unchanged; Ruff, staged publication scan and whitespace pass after stripping three Markdown hard-break trailing spaces from the copied brief. Initial doctor16PASS/2WARN (base env reported plus dirty checkout)/1optional unavailable; clean correctly activated release-checkout doctor remains required.

- Publication complete: source f54496e, preview b397050c, production 38a98b78; each 10053/10053 bytes and 16/16 header checks. Immutable 21/21 and prior 15/15 smoke. All 9908 City files and offline unchanged. Full final receipt and open qualification script are in the Oct13 handoff.
