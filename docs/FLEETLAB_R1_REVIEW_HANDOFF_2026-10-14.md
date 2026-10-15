# FleetLab R1 review checkpoint — October 14, 2026

## Status and authority

**CONDITIONAL GO for owner review; HOLD for numerical implementation and publication.** This is not a completed simulator or a release candidate.

The owner requested R1 only, its software-delivery forward link and the chosen logo. The owner then explicitly selected: **draft a complete synthetic model contract for review before implementing numerical results**, and **add Ready / idle alongside COD and VOR**. Those decisions govern this checkpoint. No R1 policy was executed, no recorded outcome was invented, and R2/R3/R7 were not started.

- Branch: `codex/fleetlab-city-sf`, existing linked worktree.
- Starting/current HEAD: `fc8bd332c7a505a7c4f663867b6c5090c5872a01`; no new commit in this checkpoint.
- Working tree: intended logo/source/test changes and new review documents; unrelated owner inputs remain untouched.
- Remote actions: none. No GitHub push or deployment in this checkpoint.
- Current production remains the separately published October 14 visitor-design release: application source `86f8a13f487ee2137ddaf400931048d3485b53ea`, deployment `5924764c-7dc2-4336-a7d4-94fe3e39a991`. `docs/releases/fleetlab-current.json` is unchanged.
- SF map, physical-device and human qualification status is unchanged. Nothing here authorizes physical deployment or establishes operator performance.

## Review these deliverables

1. [Proposed synthetic model contract](FLEETLAB_R1_SYNTHETIC_MODEL_CONTRACT_2026-10-14.md). All new numerical constants and policies are proposals, not accepted results. The most consequential choices are sections 4 and 6–9: demand, event ordering, policy reserves, manual controls and metric populations.
2. Local preview: <http://127.0.0.1:8781/network-flows/rebalancing/>. Server is loopback only. Output is `build/fleetlab-city/r1-review-20261014/site-v2`; do not upload it.
3. [Preview reproduction notes](../apps/fleetlab-city/review/README.md). Local concept-video files are ignored by Git and require the owner-supplied originals in another checkout.
4. [Execution plan](superpowers/plans/2026-10-14-r1-review-and-logo.md).

The preview includes existing lessons to make navigation and the logo reviewable. Copied historical teaching receipts describe their reference generation, not this new preview. The preview has no root publication receipt, declares `NOT_FOR_PUBLICATION.txt`, and falls outside the production upload allowlist. City assets reference the unchanged prior generation through symlinks; do not edit through those links.

## Built, by specification section

| Section | Completed in this checkpoint | Pending / deviation |
|---|---|---|
| §3.1 route/framing | Local `/network-flows/rebalancing/` with exact question title; software-delivery forward link reaches it; R1 links to existing Delivery order | Forward link is applied by review assembly only. Production navigation waits for a complete checked lesson. The past-tense recorded-study kicker is withheld because no R1 recording exists. |
| §§3.2–3.5 story and simulator | Six chapters, keyboard chapter navigation, code-built four-zone layout, explicit unavailable metrics, proposed manual control layout, glossary links and evidence boundary | No numerical model, counted fleet animation, per-vehicle inspector, accepted ledger or policy verdict. Controls are disabled. Draft defines these contracts for review. |
| §§3.6 / 6 media | NF05 hero and NF06 decision-notebook vignette; silent optimized loops; poster frames; visible Play/Pause; reduced-motion and visibility handling; exact concept captions | NF07/NF08 untouched. Concept film motion is not a counted display or simulation output. Actual network-error recovery requires an additional browser check before production. |
| §5 vocabulary | Ready / idle, COD, VOR with first-use clarifier; deadhead ratio, service rate, readiness; overloaded-term disclosure | Status counts and per-vehicle state inspection wait for accepted records. VOR is defined but deliberately has no arbitrary occurrences in the proposed R1 baseline. |
| §7 logo | Chosen text-free mark, responsive 64/128/256 px derivatives, HTML wordmark, header/footer/offline-panel decorator, 32 px favicon and 180 px touch icon; exact media ownership updated | Logo is implemented locally, not published. The immutable old City viewer shows the new shared mark but retains its historical page head in this preview; the new icon injection will be applied by the existing branded-City generation build for a future release. |
| §8 design evaluation | All seven questions answered below | Learning effectiveness and numerical trade-offs cannot be claimed before a working lesson exists. |
| §9 fences | No new lesson titles/routes, no new follow-on lessons, no numerical claims, no changes to existing simulation/evidence logic, exact synthetic/concept fences | Shared logo changes are the explicit §7 exception to the existing-lesson presentation freeze. Production ownership/source capture for R1 is not yet implemented. |

## Proposed assumptions, not invented results

The draft proposes a two-kilometer square with Manhattan distances; twelve ten-minute intervals; fixed initial supply A8/B8/C2/D6; an explicit twelve-row demand tape with deterministic arrivals and destinations; six-minute pickup deadlines; one-minute local pickup; four/eight-minute interzone travel; perfect next-interval origin-count forecasts; local dispatch; deterministic reactive and forecast reserve heuristics; and exact event, batch, ledger and digest ordering.

These are newly proposed inputs for owner review. No research-paper numerical result is used as a calibration target. Reactive versus forecast also changes reserve targets, not only timing; the contract states that limitation. Manual moves may intentionally empty a zone; invalid aggregate allocations fail as a whole. Unserved, pending, assigned, picked-up and completed populations remain distinct. A zero wait population is unavailable, not zero.

A request expiring exactly at a decision boundary is included once in the reactive target: `t−600 < expiry_time ≤ t`. Boundary ledger counters use the same convention. Manual batches merge duplicate origin/destination pairs, sort canonically and allocate the lowest remaining vehicle IDs. These refinements make the proposal deterministic without executing it.

The supplied “will need 9 cars” wording becomes a proposed comparison of **forecast requests** and **ready vehicles**, because requests need not require nine simultaneous cars. Demand asymmetry is a hypothesis to inspect, not a predetermined verdict. The preview lead is phrased as a question for the same reason.

## §8 design evaluation answers

1. **Does the lesson teach demand asymmetry?** The structure exposes the coverage-versus-empty-distance question. It has not demonstrated learning effectiveness yet. The final lesson should require inspecting the zone shortfall and ledger, not merely clicking a better-looking policy. Do not award a generic winner or hard-code the intended conclusion.
2. **Minimal controls?** Origin, destination and count are sufficient for a learner move. Use one explicit apply-and-advance action with separate pending and accepted states. Hide additional tuning; this round does not need fleet-size, battery, charger, fare or forecast-accuracy controls.
3. **Does vocabulary earn its place?** Ready / idle repairs a real state gap. COD and VOR are defined, with Ready / idle + COD + VOR conserving 24 vehicles in the future model. The preview introduces terms; it cannot yet substantiate their inspector use. VOR may legitimately remain zero in R1.
4. **Lesson tree?** Retain the specified R1→R2→R3→R7 sequence for implementation planning. Spatial availability provides context for power and depot decisions, then fleet-wide software spread. No reorder or follow-on implementation was made. The R1 page's next link remains the existing Delivery order lesson exactly as specified.
5. **Asset/design compatibility?** The supplied clay scenes and pod mark fit the warm cream/forest-green presentation. Labels, zones, counts and warnings stay in code. Sampled video frames and the chosen mark were visually inspected for text; final all-frame media QA remains a release check. Original images and clips remain intact.
6. **Missing edge cases?** Boundary expirations, same-time arrivals/completions, overallocated or malformed batches, stranded zones, no pickups, empty denominator, horizon leftovers, mixed-workload records, stale pending selections, missing rows and fabricated movements are now explicit proposed verification cases. Independent reconstruction must reject these failures before displaying accepted results.
7. **Which logo?** Ship the owner's selected `FleetLogo.png` when the release is ready. It is text-free and visually coherent with the existing vehicle imagery; keeping FleetLab in HTML improves clarity and accessibility. The responsive derivatives make it small enough for the header and phone layouts without substituting a new design or an unrequested candidate.

## Validation evidence

Logs and screenshots: `build/fleetlab-city/validation/r1-20261014/`.

| Check | Actual result |
|---|---|
| City JavaScript, final | 92 passed, 0 failed |
| Teaching JavaScript | 2,338 passed; 8 skipped; 1 todo; 0 failed |
| City Python | 342 passed |
| Hermes Python | 1,662 passed; 55 skipped |
| Ruff | Passed |
| Doctor | 17 PASS; 1 WARN for dirty Git tree; 1 optional display NOT_AVAILABLE |
| Git diff whitespace | Passed |
| New concept-loop behavior tests | 7 passed, including two interruption regressions first observed failing |
| Browser | Desktop, 390 px and 320 px R1 layouts: no horizontal overflow; visible HTML wordmark; actual NF05/NF06 playback; explicit pause; hidden chapter pauses; chapter focus; disabled numerical controls; forward link navigation |
| Logo surfaces | Home, footer, offline panel, software-delivery and City header observed; header-shape/idempotence/icon injection tests passed |
| Device scope | Browser viewport checks only; no new physical Pixel validation claimed |

Commands used:

```sh
node --test apps/fleetlab-city/test/*.test.mjs
node --test playground/fleetlab/test/*.test.mjs
build/fleetlab-city/venv/bin/python -m unittest discover -s apps/fleetlab-city/tests
PYTHONPATH=src FLEET_PLAYGROUND_BASE=bca4ccd conda run -n hermes-dev python -m pytest -q
conda run -n hermes-dev python -m ruff check .
PYTHONPATH=src conda run -n hermes-dev python -m hermes doctor
git diff --check
```

The actual current-source development package proof also passed via `measurePackageProof`; see `package-measurement.json`. It is explicitly `DEVELOPMENT_MEASUREMENT_NOT_RELEASE_BOUND`, not a publication authorization. Metadata is **32,130 / 32,768 bytes**; legacy text **2,612,515 / 2,621,440**; offline **2,563,278 / 2,571,440**; raw teaching source/tools **3,011,946 / 3,145,728**. R1 review files are not shipped or counted as a production route. No numerical/source/payload byte cap was raised. Exact brand inventory count changed from 3 to 7 for responsive mark/icon assets; its 2 MiB byte cap is unchanged.

## Media provenance and limitations

Originals preserved:

| Input | SHA-256 |
|---|---|
| `FleetLogo.png` | `2089bf4a37a876c7e6a71dc858e8c7200f1830ec4f199cb0225db4543d4bd841` |
| `NF-05-rebalancing-flow.mp4` | `bdd553fccfd6cc32ceb0a39c3e7bd9b8d87ca8623c17e7ae686ae342d4cf8d17` |
| `NF-06-zone-rebalancing.mp4` | `e04ad3b040a9429648e32c17f80f39eedc661427210b320174e9ff595ab83df5` |

Preview clips: 960×540 H.264, 24 fps, ten seconds each, **no audio stream**. NF05 is 992,600 bytes, SHA-256 `27cdf1bc2fa71a24d6e19afc29cf130744e9d6cb7aa8d0b4d9a500cb278b0306`; NF06 is 850,111 bytes, SHA-256 `fb72e529a3122c30e2410aba1f1111145f4141d76d760cd40c32eec8a88e425c`. WebP posters and all new logo pins are local. New logo derivatives total 75,998 bytes; the complete existing brand group is now 795,985 bytes, including the unchanged two scene images.

An initial poster extraction attempt found that installed ffmpeg lacks `libwebp`. The successful path extracts PNG frames, then converts them with installed Sharp. The original media was never altered. Production media ownership and a portable delivery mechanism remain required before R1 ships; the ignored local preview videos are not a completed packaging solution.

## Research and audit decisions

- The primary [Jacobsen/Kulcsár/Lindman arXiv abstract](https://arxiv.org/abs/2508.19933v3) was checked. Its reported up-to-36% median-wait and 27% rebalancing-distance changes are labeled external preprint results, not FleetLab results or expected effect sizes.
- The supplied [Sustainability source](https://www.mdpi.com/2071-1050/18/19/9768) returned 429 for publisher retrieval and could not be independently verified here. Its supplied 22,247-km headline is withheld. This is an access limitation, not a claim that the paper is false.
- Independent read-only review found two Important issues: a stale `play()` rejection disabled resumption; reactive interval endpoints were undefined. Both are addressed. The playback regression failed first and now passes; endpoint semantics are clarified in the proposed contract.
- Manual allocation ordering was regraded as important to the requested complete deterministic contract and specified. No numerical implementation was added to resolve it.
- **Deferred minor:** automatic reproducibility of ignored media is not implemented; reproduction commands and hashes are documented, and publication remains held.
- **Deferred minor:** retry after an actual media/network error is not browser-validated; current source reuse may need `load()` on explicit retry. Autoplay denial, stale-promise interruption and deliberate retry controls are unit-tested. Do not claim network recovery is qualified.
- Reviewer declined numerical outcomes, primary-paper accuracy, visual quality and package headroom. Resolution: outcomes remain intentionally unavailable; primary-source access limits are carried; visual inspection/browser evidence and separate development package measurements are reported above.

## Recommendation

Review and approve or amend the model contract before numerical implementation. The chosen mark and review shell are ready to inspect; the complete R1 learning experience is not yet built or published.

## Top risks + mitigations

- A plausible result without consistent evidence: common-input binding, independent reconstruction, exact interval accounting and fail-closed presentation are required by the draft.
- Perfect forecasts or reserve heuristics mistaken for production optimization: label them explicitly and keep conclusions conditional.
- Review-only presentation mistaken for a shipped simulator: unavailable values, disabled controls, explicit banners, separate output and unchanged live receipt.
- Tight package limits: measure a complete R1 manifest and source capture before release; any required budget amendment must be explicit.

## Next 3 actions

1. Owner reviews the proposed demand/geometry, forecast information, dispatch/expiry rules, reserve heuristics and metric populations together.
2. After acceptance, implement the model, independent verifier, exact tiny fixtures and two recorded arms; inspect actual trade-offs before writing the verdict.
3. Implement counted visuals, per-vehicle inspection and manual runs; finalize source/media ownership, validate the complete package and perform release review. R2/R3/R7 remain outside this round.
