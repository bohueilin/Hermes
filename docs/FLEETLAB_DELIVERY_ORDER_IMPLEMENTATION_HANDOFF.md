# FleetLab Delivery order — implementation and release handoff

Date: October 13, 2026 (America/Los_Angeles). Scope: public educational website only.

## Outcome

NF04 corrections and its bounded **Who gets the depot link first?** companion are implemented. The owner approved the five final amendments, building, validation, Git push and publication. The release identities below distinguish a checked local package, preview and actual production readback. Existing Overview, Fleet day, Street lab, Learning, City Explorer and NF01–NF04 remain available.

New route: `/network-flows/delivery-order/`. Discovery: Explore catalog card and NF04 onward link. NF03 now links onward to NF04. Offline remains byte-identical and receives no dead hosted-only control. No Austin, other city, SF power study or vehicle integration was started. **SF qualification remains HOLD / BLOCKED_MAP_QUALIFICATION.**

## Published release

The same immutable, source-bound generation passed preview and production checks; it was not rebuilt between uploads. Publication finished October 13, 2026 PDT (readback timestamp below is UTC).

| Identity / check | Observed result |
|---|---|
| Live lesson | https://fleetlab.pages.dev/network-flows/delivery-order/ |
| Immutable production lesson | https://c8bfa50a.fleetlab.pages.dev/network-flows/delivery-order/ |
| Released application commit | `f8b3b2738c969b9981387d033163d589c6d235c7` |
| Git destination | `bohueilin/Hermes`, branch `codex/fleetlab-city-sf`; application commit pushed and remote SHA checked |
| Production deployment | `c8bfa50a-5ad8-44c7-a742-f5ceddd1aa41` |
| Preview deployment | `9f2a6320-1ee5-4571-aa99-b1d3c6504766` |
| Preview full readback | 10,069 / 10,069 served files match; 20 / 20 header checks |
| Stable production full readback | 10,069 / 10,069 served files match; 20 / 20 header checks |
| Stable readback completed | `2026-10-14T05:00:16.811774+00:00` |
| Immutable production smoke | 29 / 29 files match |
| Prior production smoke | 21 / 21 files match |
| Prior whole-site production | `38a98b78-2fae-4d16-87d5-3cfa37c11b24`, https://38a98b78.fleetlab.pages.dev |

The committed [publication receipt](releases/fleetlab-current.json) records readback digests and a 29-file smoke inventory. A later documentation-only commit contains this handoff; it does not change the application commit or claim a new deployment. Rollback uses the retained prior whole-site deployment or a checked sanitized package through the publication runbook; no rollback or retention deletion occurred. The separate City rollback remains `e3318a76588a7403`.

## What a visitor learns

Four synthetic vehicles share one already-fetched depot copy. Changing local service order changes who meets a ready target, even when total transferred bytes and fleet completion time remain identical. The objective is explicit: minimize missed targets, then total late milliseconds. Worst individual lateness is shown separately. “Best” means best among the complete, independently checked set of permitted serial orders, not a general optimum over all operational policies.

| Case | First come / earliest target | Best permitted serial order | Lesson |
|---|---|---|---|
| Different targets | First come: 2/4 ready on time; 178 s total late | V4→V3→V2→V1: 4/4; zero late | V1 waits 144 s longer while still on time. Better fleet counts can delay individuals. |
| One impossible target | First come: 1/4, 192 s total late. Earliest target: 0/4, 134 s total late | V4→V3→V2→V1: 3/4; 158 s total late | Spending an early slot on an already-impossible target can lose feasible targets. Fewest misses and least lateness alone are different objectives. |
| Close targets | First come and earliest target: 2/4; 4 s total late, 2 s worst late | V1→V3→V2→V4: 3/4; 50 s total/worst late | Meeting one more target shifts a substantial delay to V2: ready 282→330 s, 50 s late. Sorting targets misses the declared optimum. |
| Equal targets, in disclosure | 4/4; zero late | All 24 tie | Optimization may offer no objective improvement; individual ready times can still differ. |

All serial cases use 12 GB WAN, 48 GB local delivery, ready positions 234/282/330/378 s and fleet completion 378 s. Arrivals are 0/30/60/90 s; targets vary by case. Equal sharing is reconstructed and independently checked only on request, on the same workload; it is explicitly outside the serial-order search. Its on-time counts are 1/4, 0/4, 1/4 and 4/4 respectively. No weighted business or safety score is claimed.

## Final feedback decisions

| Amendment | Disposition |
|---|---|
| Bind every candidate to one workload | Adopted. Each candidate must match normalized study input, input digest, domain, policy and quantum. Resealed valid foreign-workload substitution fails. Independently ranked permutation coverage and full tie checks precede acceptance. |
| Pending versus accepted behavior | Adopted. Moving vehicles changes only pending order. Compare reuses an accepted study matching workload/version identities. A new workload reconstructs and checks all candidates before replacing results. Cancel, Restore, preset changes and page lifecycle invalidate pending tokens. |
| Unambiguous initial/playback behavior | Adopted. Initially both orders match and V1 delta is 0 s. Show best accepts a checked comparison without autoplay and saves the edited order for Restore. Explicit Watch worked example binds narration to the default FCFS-versus-best pair. Phone arm choice is view-only. Resume restores the authored snapshot after free inspection. |
| Ownership before payload | Adopted. Narrow import/source-capture scaffold precedes model payload; real 17,593 B manifest, worker and initial page were measured before full UI. No zero-content final-size claim. |
| Accurate 128 KiB label | Adopted. The envelope is captured teaching + integration original-source growth, excluding tests. Test-tree and total tracked repository growth are separately reported at the released application commit. Existing hard counters remain. |
| Two extra domain rejections | Adopted. Nonzero source availability and absence of a raw request at zero both fail before scheduling. |

The generated study has canonical ASCII order arrays, canonical permutation record ordering and exact tie ordering. A record digest excludes only its own digest; a study digest excludes only its own digest and includes candidate digests. Input and verification contracts are documented in [the contract](FLEETLAB_DELIVERY_ORDER_CONTRACT.md).

## NF04 correction checkpoint

Correction commit `9ac9e81295bd994fea30b699e35bb106a03ab784` and navigation/ownership checkpoint `f2d72d093ed15a0cbfea085949d6c4176d999289` precede the companion. Existing 16 NF04 primary/refinement identities are unchanged.

Receipt state now follows accepted selected-vehicle grants; whole-copy counts distinguish aggregate partial bytes from usable completed copies. Same-time receipt/check transitions have stable causal ordering. Counterexamples open at the cause (234 s one vehicle, 480 s slow local, 150 s competing arrivals), with both full-run and selected-vehicle outcomes visible. Accepted status survives lifecycle suspension; interrupted first runs no longer say computation is still active. Native vehicle buttons identify arm, vehicle and state. Timeline values announce seconds; replay restarts after the end. Reduced preferences expose manual chapters without ineffective Play controls. The static boot fallback preserves scope and navigation on failure.

## Architecture and trust boundaries

- A strict normalized 1–4-vehicle domain produces compact interval records; no 24-fold dense time-step allocation.
- Producer uses serial accumulation. Independent record verification uses fixed-position equations. Search enumerates recursively; independent study verification uses Lehmer ranks to check all 1/2/6/24 permutations exactly once.
- Four cases are checked at 1,000 ms and 250 ms: eight studies, 192 compact records, plus eight unchanged-NF04 equal-share comparisons. An independent Python oracle compares all objective pairs, complete tie sets and histograms.
- Worker reconstructs and checks; page independently verifies the returned study and published identities. Cancel/timeout terminates the owned worker. Stale completions cannot publish.
- The accepted study drives outcome cards, schedule strips, selected-vehicle deltas, all-order list and vehicle×position assignment matrix. Projection does not optimize or allocate. Equal-share retains compact metrics/outcomes/identities after its dense record is checked.
- Scope SIMULATION_ONLY, evidence NOT_EVIDENCE, authenticity NOT_AUTHENTICATED, authorization NOT_EVALUATED, decision authority NONE and operational deployment permission NONE stay distinct.

This is an educational assignment/scheduling model relevant to shared depot-resource questions. It is not calibrated to Waymo, does not reproduce proprietary operations, install vehicle software or establish driving safety.

## Validation and independent review

Final teaching suite: **2,336 passed, 8 existing skips, 1 existing TODO; zero failures**. City Node **72/72**; City Python **340/340**; Hermes **1,662 passed, 55 existing skips**. Ruff and diff/publication guards pass. Clean doctor: **18 PASS, 1 optional NOT_AVAILABLE**. The full teaching suite ran again after all review fixes; earlier City/Hermes suites cover unchanged integration/core code. No failing timing threshold was relaxed.

Model tests include 1–4 requests, invalid domains, inclusive/off-grid raw targets, unsafe/accessor/sparse data, receipt/check/byte mutations resealed with recomputed digests, foreign workloads, duplicate/missing/reordered candidates, false optimum and incomplete ties. Package tests cover source capture, ownership, closure accounting, omitted or changed payloads, reconstructed source, unchanged offline content and exact JavaScript/Python navigation transforms.

A fresh read-only whole-branch review found no Critical issues and three Important plus three Minor issues. All six were adopted in one fix pass, with failing regressions before corrections: Restore during computation, saved pending order, focus before hiding Cancel, interrupted initial-run status, guide Resume after free inspection, and dense equal-share retention. The reviewer independently ran 46 focused tests. After fixes, 21 focused transition tests and the full teaching suite passed. Real Chromium deferred-worker fixture confirmed accepted focus on the heading and cancellation focus on Compare; stale fixture observations were discarded after detecting a refused local repack.

Observed browser checks: 1440, 768, 390 and 320 px; no page-level horizontal overflow; primary buttons at least 44 px high; schedule diagrams scroll internally on narrow screens. Preview catalog discovery, deployed worker reconstruction, initial equality, Show best without autoplay, preserving an edited order, Close targets V2, equal sharing, NF04 reconstruction and onward links passed. Worked-example snapshots and mobile arm switching retain time and manual pause. No warning/error log entries appeared in the inspected preview routes. Resizing is layout evidence, not physical-phone qualification. Separate private Chromium pages deliberately referencing an unavailable boot module preserved heading, scope and Home for both lessons, without claiming a checked result; both missing modules returned 404. Those fixtures are not in the public stage.

### Measured runtime

Machine: Apple M4 Pro Mac mini; Node 22.22.0. Twenty fresh processes after import and twenty warm trials. p95 is the 19th sorted observation. The timed path includes production reconstruction and worker plus page independent verification; excludes process/import startup, network, structured transfer and browser drawing.

| Observation | Result |
|---|---:|
| Default complete study, cold p95 | 33.93 ms |
| Default complete study, warm p95 | 22.79 ms |
| Default canonical complete study | 57,597 B |
| Equal-share reconstruction/check, one separate observation | 86.86 ms |
| Equal-share serialized record | 915,666 B |
| Native cancellation, 20 actual workers, p95 / maximum exit | 0.834 / 1.207 ms |
| Chromium complete load, 20 fresh workers, p95 | 65.70 ms |
| Chromium accepted-study application, 20 trials, p95 | 1.00 ms |

The 250 ms desktop compute target is met under those conditions. Cancellation uses production worker/job through a Node Web Worker event adapter; it establishes actual thread exit after a progress-triggered cancellation, not browser UI acknowledgment latency. The 17.25 MB post-computation heap observation is not peak heap. A separate private Chromium fixture uses the production page, job and worker with loaded assets: complete load includes page verification and DOM application; cached-study application includes projection and DOM mutation, without a paint guarantee. Its 65.70 ms and 1.00 ms p95 observations meet the 250 ms complete-compute and 50 ms application targets under these desktop conditions. Browser paint latency, cancellation acknowledgment, physical Pixel performance and peak memory remain unmeasured. No instrumentation was added to the public site.

## Exact-source package and budgets

Application source commit: `f8b3b2738c969b9981387d033163d589c6d235c7`. Integration manifest SHA-256: `b5b39baf11f5325f1997773d1a5af9c9e49ed4c6faf18c5c211822b38f1c0bf7`. All 9,908 City/source-offer files / 1,613,222,668 B and the 2,549,837 B offline HTML remain byte-identical. Offline SHA-256: `eeba4707891e98eb572ef4d58ff8ee92768f9ff9cf9cfe1996be72f3b695b522`.

| Counter | Released bytes | Gate / meaning |
|---|---:|---|
| Legacy teaching text | 2,598,991 | 2,621,440 hard cap |
| New route local | 88,496 | 98,304 working target |
| New route complete integrated closure | 141,446 | 524,288 hard cap, shared code and headers included |
| NF04 / NF03 integrated closures | 137,522 / 468,558 | Each ≤524,288 |
| Final emitted teaching + integration text | 2,874,878 | 3,145,728 hard cap |
| Teaching original source/tools | 2,996,113 | 3,145,728 hard cap |
| Separately captured integration originals | 200,702 | Existing declared owner, commit-bound and archived |
| Receipt metadata | 31,998 | 32,768 hard cap |
| Source archive compressed / extracted | 906,818 / 3,310,657 | Each ≤4,194,304 |
| Offline HTML | 2,549,837 | 2,571,440 after existing reserve |
| Complete non-City generation | 7,444,150 | 14,360,576 hard cap |
| Physical entire generation | 1,620,666,818 | 10,070 files, including unserved `_headers` |

This wave adds **104,052 B** captured teaching + integration original source, within the **131,072 B** envelope. At the application source commit, test-tree growth is **31,335 B** and total tracked repository growth is **205,494 B** (including plan/contract documents; later release receipts are documentation-only).

**Two working targets were missed; no hard gate was weakened:** final emitted growth is 98,767 B, 463 B above the 98,304 B target; receipt growth is 3,414 B, 914 B above the 2,500 B target. Retained complete file identities/ownership and the async/focus corrections rather than removing verification metadata. Receipt hard-cap headroom is only 770 B: the next lesson must address packaging before adding payload. These are recorded implementation trade-offs, not claims that all targets passed.

Original-source archive: `network-flows/sources/899fd49ffa748e61e0dc3f26c9875f7aaafa548d154807ef6dc80cef1cbd50eb.json.gz`, SHA-256 `899fd49ffa748e61e0dc3f26c9875f7aaafa548d154807ef6dc80cef1cbd50eb`. Exact-source reproduction, integrated package proof and upload guard passed. Wrangler stays pinned at 4.148.0; deployment and MapLibre dependency audits report zero known vulnerabilities. All 38 audited deployment packages have verified registry signatures; 22 have attestations. This is a dated registry observation, not a guarantee about unpublished vulnerabilities.

## Remaining qualification

- **Physical device:** the first ADB inventory was empty; a later check detected an authorized Pixel 10 Pro XL. The existing screen mirror opened, but browser input was unreliable and the FleetLab lesson was not successfully loaded on the device. This is an automation limitation, not a passing phone check. The mirror was closed after the attempt. On the connected phone: compare, reorder, Show best/Restore, follow V2, inspect time, rotate, background/restore and navigate back.
- **Native accessibility/preferences:** OS reduced-motion/Save-Data, screen reader and actual 200% browser zoom remain open. Automated restricted-path tests and narrow layouts do not replace these checks.
- **Browser performance:** desktop complete-load and DOM-application p95 were measured as above. Browser paint latency, cancellation acknowledgment/termination and supported peak heap remain open, including old accepted results plus a replacement job. Do not substitute Node or serialized-byte measurements for those observations.
- **Independent comprehension:** use uncoached participants to explain why fleet completion stays fixed, what Close targets trades off, what “best permitted” excludes, and why checked simulation does not grant vehicle deployment authority.
- **SF:** map/source review and existing acceptance holds remain independent. Publishing this companion does not close them or authorize another city.

## Reproduction

Use the exact application checkout and the project’s Python 3.11 environments. City tests require the existing City venv with its scientific dependencies; generic conda Python lacked SciPy/shapely in an initial attempt. Hermes tests require retained ignored evidence fixtures; an initial isolated checkout lacked them. Those failed attempts and corrected passing runs are retained privately. No numerical scientific records were regenerated for those environment repairs.

```sh
node --test playground/fleetlab/test/*.test.mjs
node --test apps/fleetlab-city/test/*.test.mjs
python -m unittest discover -s apps/fleetlab-city/tests
PYTHONPATH=src FLEET_PLAYGROUND_BASE=bca4ccd python -m pytest -q
python -m ruff check .
PYTHONPATH=src conda run -n hermes-dev python -m hermes doctor
node playground/fleetlab/tools/software-delivery-study.mjs --check
node playground/fleetlab/tools/delivery-order-study.mjs --check
python tests/fixtures/delivery_order_oracle.py
```

Follow [the publication runbook](FLEETLAB_CLOUDFLARE_DEPLOYMENT.md) for pack, package-proof, whole-generation integration, pinned upload, full byte readback and separate headers. Private evidence is retained under `build/fleetlab-city/validation/delivery-order-20261013/`; the exact stage is under `build/fleetlab-city/delivery-order-20261013/final/`. Generated records, screenshots, logs and credentials are not committed or uploaded as source.

## Recommendation

Use this bounded lesson to discuss objective selection, shared resources and individual trade-offs. Keep the domain explicit before considering larger scheduling or flow models.

## Top risks + mitigations

- Plausible optimum from inconsistent candidates: common-input binding, independent coverage/feasibility checks and synchronized accepted identities.
- Visitors infer a universal or operational optimum: name the serial domain, show equal sharing separately, retain impossible/close/tie cases and trust boundaries.
- Packaging headroom and browser/device assumptions: publish measured counters, preserve whole-generation rollback, and keep physical/human/performance qualification open.

## Next 3 actions

1. Review the live worked example and Close targets, including V2 and the assignment matrix.
2. Collect independent comprehension and physical-device observations using the script above.
3. Before expanding the model, define measured workloads and the next objective/domain; resolve receipt headroom. No new city or broader optimizer is preapproved by this handoff.

## Subsequent visual refinement release

The later October 13 visual release preserves the Delivery order model and checked study identities. It updates shared Home/catalog styling, conceptual teaching diagrams and the offline edition. See [the visual implementation handoff](FLEETLAB_VISUAL_EXPERIENCE_HANDOFF_2026-10-13.md) for current production identities and validation. Earlier release facts above remain historical.
