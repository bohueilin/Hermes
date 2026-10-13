# FleetLab NF04-B implementation handoff — October 13, 2026

## Status and scope

NF04-B is implemented as a bounded software-delivery teaching lesson. It is live; the exact release identity and completed hosting readback appear below. The owner explicitly authorized build, validation, repository push and live educational-site publication. That authorization overrides the historical local-only Git restriction for this website release only.

The lesson is **One update. Four vehicles. Where is the wait?**, at `/network-flows/software-delivery/`. Existing Overview, Fleet day, Street lab, Learning, City Explorer and NF01–NF03 remain. Hosted Explore, next-lesson and roadmap discovery lead to NF04; NF03 remains the first Network Flows destination. The offline edition has no dead NF04 control.

**SF remains HOLD / BLOCKED_MAP_QUALIFICATION.** No Austin work, held power evaluation, vehicle connection, operational deployment permission, calibration or real-world safety claim was added. The lesson is a published candidate with explicitly open physical-device and human-comprehension qualification.

## What was built and why

A strict versioned common input feeds two deterministic policies: repeated vehicle downloads and a cold shared depot cache. A separately implemented verifier reconstructs allocation, cursor movement, eligibility, whole-file forwarding, task transitions, outcomes and metrics. It shares schema/canonical encoding, not producer scheduling logic. Executed mutation tests and a transitive-import check support that separation.

The browser loads small primary/refinement summaries and digests. Watch explicitly reconstructs the primary pair in a worker, independently verifies each record, and checks published identities and metrics. It accepts both records atomically and freezes them. An edited preset cannot relabel old accepted results. Cancellation terminates the worker; obsolete messages cannot commit. The browser does not rerun 250 ms refinement or ship full record arrays.

The default has six held chapters, a shared exact clock, fixed whole-run outcomes, common rate scale, selected-vehicle causes, owned versus shared traffic, and a finite separate timeline. Mobile arm choice persists independently of narration. Counterexamples use the same inspection bench with static explanations. Raw deadlines stay inclusive and unrounded; event navigation distinguishes raw time from applied boundary. Modeled checks and activation remain separate from receipt and readiness.

| Public case | Repeated download | Cold shared cache | Learning goal |
|---|---|---|---|
| Four vehicles, one update | 666 s all ready; 0/4 by 480 s; 48 GB WAN | 378 s; 4/4; 12 GB WAN | Reuse removes duplicate WAN work; both still deliver 48 GB locally. |
| One vehicle | 234 s; 1/1 | 234 s; 1/1 | No duplicate upstream work exists to remove. |
| Slower local link | 2010 s; 0/4 | 1722 s; 0/4 | Caching saves time but does not guarantee the target. |
| Two arrivals, competing deadlines | 334 s fleet completion; 1/2 by 250 s; V1 ready 234 s | 282 s; 0/2; V1 ready 278 s | Faster fleet completion can delay an individual and reduce deadline success. |

Declared depot storage is an assumption (N×artifact versus one artifact), not measured occupancy or facility sizing. The target, whole-file forwarding and equal-sharing policy are teaching assumptions. “Checked” means internally consistent with the installed model/verifier, not authenticated or permitted for installation/driving.

## Feedback decisions and implementation

| Brief finding | Decision and disposition |
|---|---|
| P1, P2 | Confirmed both reported blockers. Added explicit legacy/NF04/integration ownership, complete route closures, a scoped NF03 v2 sidecar and a separate NF04 sidecar. Existing hard gates remain. |
| P3 | Adopted the bounded dependency approach. Route-local DOM, live status and player avoid importing the large legacy accessibility/label tree for convenience. Shared dependencies are counted. |
| P4 | Captured and commit-bound all 28 integration originals in a separately declared existing owner. Final transformed text is counted once; no uncapped integration escape. |
| C1–C3 | Adopted derived IDs, explicit resource caps, strict normalized fields, total event order and fixed task chain. New contract amendment records the schema decision. |
| C4 | Declared-empty inventory only; nonempty inventory is a named unsupported mode. No speculative inventory taxonomy. |
| C5 | Retained bounds and measured actual records. Serialized bytes are not a heap estimate. |
| C6 | Free seek floors; event navigation uses the applied boundary while exposing raw time. |
| V1–V3 | Independent replay, executed mutations, unified analytical fixtures, primary/refinement manifests, maximum-object and residual-heavy stress, real worker termination. Physical performance gates remain separate. |
| E1–E2 | Published summaries before Watch; atomic accepted pair; cancellation/rejection preserve old results; three public counterexamples. |
| E3–E4 | Small local playback controller. Default narration bound to exact default input and record identities; other cases never inherit its claims. |
| E5–E6 | Persistent named mobile arms, both outcomes, readable vertical flow, exact target wording. No forced one-screen phone layout. |
| E7–E8 | Visible assumptions and the simpler two-arrival individual-regression example. No duplicate near-identical preset. |
| NF03 minor findings | Phone strategy labels now name actual rules/treatments and update without remounting. Existing workload chips measured 50 px at 390 px; the reported 41 px issue was not reproduced, so no speculative CSS repair. |
| Broader suggestions | No runtime module-by-module pinning, new optimizer, preload, 3D assets, global navigation redesign or new dependency. No blanket ban on readable units or arbitrary caption word count. |

## Validation evidence

Focused tests cover analytical values, permutation/canonical identity, schema rejection, residual fairness, off-grid outcomes, zero rates/caps, check failure, censoring, delayed source, observation-end closure, positive-task refusal at H, and forged grant/cursor/eligibility/manifest records. An independent whole-change review found no material issue; an additional deterministic 400-run varied-input sweep independently verified every record.

The first broad teaching run had three failures: a prohibited UI-to-data import, a UI token scan catching a literal transfer ID, and the historical capacity test applying the legacy cap to the whole new site. Fixes inject the manifest from boot, derive depot transfer identity from the accepted universe, and assert legacy and aggregate ownership separately. No numerical threshold or hard budget was relaxed. Final teaching suite: **2270 passed, 8 existing skips, 1 existing TODO, zero failures** (2279 total tests). Final packaging/integration focused Node: **72/72**; Python integration after the final closure guard: **28/28**.

Other broad gates: City Node **72/72**; City Python **338/338**; Hermes **1662 passed, 55 existing skips** using `FLEET_PLAYGROUND_BASE=bca4ccd`; Ruff passes. The 55 skips are not newly executed coverage. Focused UI and boundaries passed after the corrections. The generated manifest reproduces all 16 primary/refinement records.

Observed in the Codex Chromium browser on this Mac mini: 1440 px desktop, 390×844 and 320×568 phone widths; no horizontal overflow; visible controls at least 44 px high; visible keyboard focus; chapter selection, arm switching, vehicle selection and keyboard timeline Home/End; all three counterexamples; old results retained during pending selection; no browser warning/error logs in the inspected lesson. Emulated width is layout evidence only. The pending computation completed too quickly for the tool's live Cancel click, so that attempted interaction is not claimed as a passing latency measurement.

### Runtime observations

Machine: Apple M4 Pro Mac mini, Node 22.22.0, Python 3.11.15. Each p95 below uses the 19th sorted value of 20 observations, a small benchmark sample.

| Condition | Default p95 | Maximum-object p95 | Residual-heavy p95 |
|---|---:|---:|---:|
| Fresh Node process after imports; generation + independent verification + digest/metric check | 228.89 ms | 324.83 ms | 292.59 ms |
| Warm Node process, same complete compute path | 211.18 ms | 297.14 ms | 259.81 ms |
| Browser, already loaded assets, fresh worker per comparison | 157.7 ms | Not measured | Not measured |

Browser compute excludes asset loading, structured transfer to the page and drawing; maximum observed default was 159.3 ms. Node phase-boundary heap observations reached 30.2/43.0/39.0 MB, but miss synchronous peaks and do not cover an old accepted pair plus replacement job. No peak-heap claim is made. Largest measured canonical record was 6,547,238 B and 67,207 entries; the record limit is 32 MiB / 130,000 entries. Serialization is not heap.

A private native-worker harness used the production worker and job through a Node Web Worker event adapter, requesting cancellation on observed generation, verification and hashing progress notifications. All 60 jobs rejected, actually exited and produced no accepted result. Native-exit p95 was 0.989 / 1.854 / 1.736 ms; maximum 1.905 ms. This demonstrates thread termination rather than late-result suppression. It does not measure browser UI acknowledgment or pinpoint the internal instruction executing when termination arrives; hashing may already have advanced to a later phase.

Reproduction logs and benchmark scripts remain private under `build/fleetlab-city/validation/nf04b-20261013/`. Public source, tests and the small release receipt are committed; generated full records, screenshots, logs and credentials are not published.

## Remaining qualification and manual script

These items are open, not blockers to the specifically authorized educational candidate publication:

1. **Physical Pixel and native preferences:** ADB on Oct13 listed no devices. On a physical phone, open the immutable release, Watch, pause, change arm, select V2, seek, background/restore, rotate and navigate back. Confirm manual pause and ended playback persist. Enable reduced motion/data saving, reload and confirm a static path; disabling it must not restart playback automatically.
2. **Assistive technology and 200% zoom:** Inspect reading order, status announcements without frame-by-frame chatter, named controls, focus, all timeline/preset operations and no clipped content. Keyboard operations and narrow layout were observed; native screen reader and browser zoom were not.
3. **Device performance:** Measure 20 default and separate maximum/residual-heavy primary trials, browser cancellation acknowledgment/actual stop, seek latency and supported peak heap including retained old pair plus new job. Phone targets: default p95≤5 s; stress≤15 s; acknowledgment≤100 ms, stop≤250 ms; seek p95≤100 ms; heap default≤128 MiB/stress≤256 MiB. Targets are not measured results.
4. **Five independent participants:** At least 4/5 should explain the default target, discover the one-vehicle/two-arrival counterexamples, and distinguish model consistency from installation/driving authority. Record uncoached answers. Any authority misconception triggers copy revision and retest; five participants are qualitative evidence, not operator adoption validation.
5. **SF-specific work:** Independent map/source observations and existing launch-readiness gates remain separate. NF04 does not clear SF qualification or authorize another city.

## Recommendation

Use the published bounded lesson to review mechanism comprehension; its exact-source preview and production checks are complete. Preserve open qualification labels. The next modeling discussion should define an objective, decisions, constraints and independent feasibility checks before building an optimizer.

## Top risks + mitigations

- Fleet averages conceal individual regressions: retain the public two-arrival case and V1 inspector.
- Synthetic readiness is mistaken for authority: keep the visible scope sentence, detailed trust states and human authority task.
- Runtime or stable-host generation assumptions: retain limits, terminating workers, immutable reproduction URLs and explicit unverified device/peak-heap gates. B-lite does not promise whole-session module pinning across a stable-host deployment switch.

## Next 3 actions

1. Review the live default and its three counterexamples using the immutable release for reproducibility.
2. Collect physical-device and independent comprehension observations using the scripts above.
3. Review a separate constrained scheduling/optimization design; do not silently expand this equal-sharing lesson or start Austin.

## Exact-source package checkpoint

Released candidate source: `f54496ed47f76b9378277f979318fc0f36a482f1`, pushed to `github/codex/fleetlab-city-sf`. Built from a clean managed checkout. Source-bound package proof and upload guard pass. Clean doctor: **18 PASS, 1 optional NOT_AVAILABLE**. Locked deployment and MapLibre audits report zero known vulnerabilities; all 38 audited deployment packages have verified registry signatures and 22 have attestations. Tool versions remain pinned, including Wrangler 4.148.0.

| Counter | Exact candidate bytes | Limit / meaning |
|---|---:|---|
| Legacy teaching text | 2,598,990 | 2,621,440 |
| NF04 route-local | 116,378 | 327,680 working target |
| NF04 complete closure after hosted headers | 131,653 | 524,288 |
| NF03 complete closure after hosted headers | 468,398 | 524,288 |
| Final emitted text including receipt/integration | 2,776,111 | 3,145,728 |
| Integration text subset | 34,175 | Already inside final emitted union |
| Teaching original source/tools | 2,896,622 | 3,145,728 |
| Separate integration originals | 196,141 | 28 existing-owner files; all archived/commit-bound |
| Combined net original-source growth | 138,103 | 307,200 working target |
| Receipt metadata | 28,584 | 32,768 |
| Source archive compressed | 881,219 | 4,194,304 |
| Source archive extracted | 3,203,019 | 4,194,304 |
| Offline HTML | 2,549,837 | 2,571,440 after existing reserve |
| Complete non-City generation | 7,319,784 | 14,360,576 |

The integration-original owner grew 7,280 B from its 188,861 B immutable baseline. No teaching source was reclassified outside the 3 MiB gate. Source archive schema 1.1.0 captures these originals separately. The public receipt describes the teaching input generation; the final integration inventory additionally counts transformed root/header bytes. The NF04 closure grows from 130,816 to 131,653 B with the final headers.

All **9,908 City/source-offer files / 1,613,222,668 B** are byte-identical to the prior live generation. The complete 2,549,837 B offline edition is unchanged. No City scientific record was regenerated. Five pre-existing owner documents remain untracked and excluded.

### Reproduction commands

Use the exact source checkout and the existing deployment runbook; uppercase paths below are placeholders for private build outputs.

```sh
node --test playground/fleetlab/test/*.test.mjs
node --test apps/fleetlab-city/test/*.test.mjs
python -m unittest discover -s apps/fleetlab-city/tests
PYTHONPATH=src FLEET_PLAYGROUND_BASE=bca4ccd python -m pytest -q
python -m ruff check .
PYTHONPATH=src conda run -n hermes-dev python -m hermes doctor
node playground/fleetlab/tools/software-delivery-study.mjs --check
node playground/fleetlab/tools/pack.mjs --out OFFLINE_FILE
node playground/fleetlab/tools/pack.mjs --site PACKED_SITE --source-commit f54496ed47f76b9378277f979318fc0f36a482f1
node playground/fleetlab/tools/check-dist.mjs OFFLINE_FILE
node playground/fleetlab/tools/check-dist.mjs --site PACKED_SITE
node playground/fleetlab/tools/package-proof.mjs --site PACKED_SITE --playground playground/fleetlab --offline OFFLINE_FILE --source-commit f54496ed47f76b9378277f979318fc0f36a482f1 --out PACKAGE_DIR
node playground/fleetlab/tools/package-proof.mjs --check-integrated INTEGRATED_SITE --playground playground/fleetlab --source-commit f54496ed47f76b9378277f979318fc0f36a482f1
python apps/fleetlab-city/tools/publication-guard.py --staged
git diff --check
```

Publication uses the pinned wrapper, the complete integrated site, source/receipt guard, full byte readback and separate header checks described in [the runbook](FLEETLAB_CLOUDFLARE_DEPLOYMENT.md). The same artifact must pass preview before production.

Preview interaction also confirmed the Explore card opens the exact new route, the worker reconstructs under deployed CSP, the 378 s chapter preserves phone arm/time on selection, and NF03 still reconstructs all four records. NF03 Trade-off selects B2 at minute 18 and exposes the explicit Equal uplink share / Departure deadline first arm controls while retaining the 132.3/70-minute whole-run values.

## Final publication receipt — October 13, 2026

**LIVE and pushed to GitHub.** The same source-bound artifact passed preview and production; no intervening build was substituted.

| Identity / check | Result |
|---|---|
| Stable lesson | [Open software delivery](https://fleetlab.pages.dev/network-flows/software-delivery/) |
| Immutable lesson | [Open this exact release](https://38a98b78.fleetlab.pages.dev/network-flows/software-delivery/) |
| Source commit | `f54496ed47f76b9378277f979318fc0f36a482f1` |
| Git branch | `codex/fleetlab-city-sf` |
| Preview deployment | `b397050c-d6f2-415e-93f4-95a9820760d5` |
| Production deployment | `38a98b78-2fae-4d16-87d5-3cfa37c11b24` |
| Prior production retained | `3d23afce-4404-430b-a5d2-a543a45c6754` |
| Final integration inventory SHA-256 | `d2735c99639c7c531a0f0eb8e01e9d9268012d704201a3c0764dc1d42e066a69` |
| Physical generation | 10,054 files / 1,620,542,452 B |
| Preview byte readback | 10,053 / 10,053 matched |
| Stable production byte readback | 10,053 / 10,053 matched |
| Preview / production headers | 16 / 16 each |
| Immutable production smoke | 21 / 21 matched |
| Prior immutable production smoke | 15 / 15 matched |
| Production readback completed UTC | 2026-10-13T16:33:25.493115+00:00 |

The unserved `_headers` configuration explains the one-file difference between physical and served counts. Production browser validation reconstructed the primary pair and checked the inclusive 480 s wording: repeated is “Target now; not ready”; cache is “Ready on time.” No horizontal overflow was observed at phone width. Earlier preview tests also covered the catalog entry and preserved NF03.

[Live teaching receipt](https://fleetlab.pages.dev/downloads/teaching-package.json) and [immutable original-source archive](https://38a98b78.fleetlab.pages.dev/network-flows/sources/f61a5de05d57d71cdb20b8e27733f200ffb525055192c23339e7ba4273aa6614.json.gz) expose the reproduction package. The source archive SHA-256 is `f61a5de05d57d71cdb20b8e27733f200ffb525055192c23339e7ba4273aa6614`. [The committed publication receipt](releases/fleetlab-current.json) records the live identities and small smoke inventory. Documentation-only commits after the source commit do not change the deployed source identity.

### Rollback and limitations

Prior whole-generation production remains available at [the previous immutable site](https://3d23afce.fleetlab.pages.dev/), source `eef0180e160671efa1fd9202321096741dbd27f9`. Its 15-file smoke passed this release. The complete prior integrated stage is retained locally with its inventory; current and prior City payloads are also retained in the new artifact. To roll back this teaching release, restore the prior whole generation through the existing owner-authorized release process and repeat byte/header checks; do not mix its old receipt/sidecars with the new lesson. No production rollback was performed.

Public educational publication is complete. Physical Pixel, native preferences/screen reader/200% zoom, browser peak heap and the independent participant study remain open exactly as described above. The SF map qualification hold and all operational authority boundaries are unchanged.
