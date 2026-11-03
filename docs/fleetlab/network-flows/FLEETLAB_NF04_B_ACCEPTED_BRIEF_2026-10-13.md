# FleetLab NF04-B — consolidated design review and Codex brief

**Date:** October 13, 2026
**Prepared for:** Bo-Huei Lin
**Status:** Advisory consolidation, with recommended defaults. No implementation, push, deployment, operator authorization or safety claim is approved by this document alone.

**Recommendation: proceed with the named amendments below.** Keep the completed NF04-A package proof and the sound numerical model. First confirm and resolve the two reported packaging blockers; then build one bounded software-delivery lesson with an independent verifier, a clear shared-clock comparison, and visible counterexamples. A new platform design or another broad audit cycle is unnecessary.

This document reconciles Fable’s October 13 audit with the October 12 pre-build review and Codex’s four October 12 documents. It is intended to replace overlapping review instructions when handed to Codex, not erase the implementation history. Where an audit conflicts with a frozen contract, the change is explicitly identified as a proposed amendment. Where Fable reports a code or browser observation, that remains attributed evidence until Codex confirms it against the current checkout.

## 1. Read this first: the decisions to carry forward

| Decision | Recommended baseline for the next build |
| --- | --- |
| Product question | **One update. Four vehicles. Where is the wait?** Explain repeated WAN work, downstream contention and modeled readiness. This is a resource-flow lesson, not a general fleet optimizer or an operator’s OTA system. |
| Public scope | One comparison bench; default four-vehicle case plus **One vehicle**, **Slower local link**, and **Two arrivals, competing deadlines** inside one “Test the limits” disclosure. No additional top-level tabs. |
| Implementation order | Contract/schema amendments and packaging preflight first; engine and verifier next; accepted projection and interaction next; hosted discovery last. A separate tooling deployment is not required. |
| Packaging | Preserve legacy and offline limits. Add enforceable owner accounting, scope the legacy sidecar, and count hosted integration text honestly. Do not raise caps or relabel existing payload to manufacture space. |
| Budget target | Propose **320 KiB emitted NF-04 route-local** and **300 KiB net original-source/tool growth** as separate working targets. Keep the **512 KiB complete route-closure cap** and all existing hard gates. These targets are not available capacity. |
| Browser work | Reconstruct and verify the **1,000 ms primary pair** in the browser. Generate and independently verify **250 ms refinement** at build time; publish its digests and differences, not full records. |
| Animation | One approximately 40-second default guide using held, accepted snapshots. Separate full-timeline inspection. Other presets initially use static explanation and inspection, not a falsely universal six-chapter film. |
| Input scope | Explicit canonical fields and caps, derived transfer identities, fixed prerequisite chain, declared-empty initial inventory. No preload, arbitrary graph editor or public fault-injection console in the first slice. |
| Evidence | Published summary, browser-accepted records, simulated outcome, record consistency, authenticity and deployment permission remain distinct. |
| Existing work | Preserve NF-03, small offline edition, City content and scientific records. SF stays **HOLD / BLOCKED_MAP_QUALIFICATION**. Austin and the held power study stay paused. Q1, Q8 and N2 retain their separate scopes. |

These defaults resolve the owner decisions in Fable’s audit without adding a questionnaire. Codex should record their acceptance or any necessary bounded deviation before implementing them. Do not silently treat every suggestion in either review as a mandatory requirement.

## 2. Evidence and baseline

### Source documents read

| Key | Source |
| --- | --- |
| F | `FLEETLAB_NF04_B_DESIGN_FEEDBACK_2026-10-13.md` — Fable’s complete audit |
| R | `FLEETLAB_NF04_B_PREBUILD_FEEDBACK_2026-10-12.md` — preceding independent review |
| D | `FLEETLAB_REV3_AUDIT_DECISIONS_2026-10-12.md` |
| S | `FLEETLAB_NETWORK_FLOWS_NEXT_DESIGN_SPEC_2026-10-12.md` |
| C | `FLEETLAB_NF04_A_CONTRACT_AND_PACKAGING_PROPOSAL_2026-10-12.md` |
| H | `FLEETLAB_NF04_A_IMPLEMENTATION_HANDOFF_2026-10-12.md` |

**Evidence limits for this consolidation:** attachment review and independent analytical checking only. No application repository was inspected, no application tests were executed, and no live browser, viewport, physical device, native preference, screen-reader or human-comprehension test was performed in this pass. Fable’s code references and browser measurements are **Fable-reported**, not observations newly reproduced here. The volume of reviewers is not a substitute for reproducible evidence.

H reports released source `eef0180e160671efa1fd9202321096741dbd27f9`, immutable deployment [3d23afce.fleetlab.pages.dev](https://3d23afce.fleetlab.pages.dev/), and stable site [fleetlab.pages.dev](https://fleetlab.pages.dev/). Its readback completed October 13 at 05:46:18 UTC, corresponding to October 12 Pacific time. F reports a later working checkout, `cf690bd` on `codex/fleetlab-city-sf`. These are different identities. Codex must inspect the actual HEAD and preserve valid newer work; do not reset to the release commit merely to match this document.

### What is implemented, and what is not

- **Document-reported implemented:** NF04-A source/package proof, byte counters and guards, source archive, integration prerequisite, publication checks and the corrected archive cache header. H records negative tests and release checks. This is meaningful completed work.
- **Not implemented in the reviewed baseline:** NF04-B’s numerical engine, independent verifier, accepted projection, public software-delivery bench and guide. The numerical examples below are **fixture expectations**, not executed NF-04 results.
- **Still open:** actual NF-04 package size, runtime performance, device and preference behavior, independent human comprehension, and SF map qualification.
- **Retained decisions:** M1 selected-request versus shared traffic; M2 common prefetch accounting window; M3 repeated N×S versus cache S storage provision; M4 B-lite packaging. Do not reopen these as unanswered questions.
- **Retained B-lite limitation:** a stable-host browser session can cross a deployment or use older cached assets. Readback proves bytes at measurement time, not runtime session atomicity. Immutable deployments remain the reproduction path. A mandatory build-identity export from every module is not added here.

### Reported budget baseline — remeasure at current HEAD

All quantities here are bytes; KiB means 1,024 bytes. H’s counters describe different sets and must not be summed indiscriminately.

| Counter | Reported size | Existing limit | Remaining |
| --- | ---: | ---: | ---: |
| Legacy hosted teaching text | 2,621,323 | 2,621,440 | **117** |
| Original source, tools, policy and license | 2,765,799 | 3,145,728 | **379,929** |
| NF-03 complete route closure | 489,894 | 524,288 | 34,394 |
| Global package receipt | 26,342 | 32,768 | 6,426 |
| Teaching text plus current receipt | 2,647,665 | 3,145,728 | 498,063 |
| Compressed source archive | 794,409 | 4,194,304 | 3,399,895 |
| Extracted source archive | 2,860,033 | 4,194,304 | 1,334,271 |
| Teaching text plus compressed archive | 3,442,074 | 7,340,032 | 3,897,958 |
| Offline file | 2,549,837 | 2,621,440 | 71,603; **21,603 after 50,000 reserve** |

H also reports 1,112,617 media bytes, 7,134,386 non-City generation bytes, and a whole integration of 10,040 files / 1,620,357,054 bytes. City remains 9,908 files / 1,613,222,668 bytes. The 29,858-byte difference between the teaching input subtotal and non-City generation is a **net physical difference**, not a measured integration-text subtotal. Do not simply subtract it from text headroom.

## 3. Reconciled audit decisions

This table accounts for every numbered Fable finding. “Accept” adopts the issue and bounded remedy, not unverified code evidence or every proposed sentence.

| ID | Decision | Consolidated direction |
| --- | --- | --- |
| P1 — single packer cap | **Accept as a reported blocker to confirm** | Implement owner-aware gates in packer, checker and proof before adding substantial NF-04 payload. Completed proof of today’s package does not prove future partition support. |
| P2 — whole-site NF-03 sidecar | **Accept, correct acceptance** | Exclude NF-04 paths through a versioned sidecar scope and give NF-04 its own metadata. Remeasure NF-03 closure; do not require it to stay exactly 489,894 B after changing the sidecar. |
| P3 — shared dependency cost | **Accept with tighter scope** | Use an explicit small shared closure and 320 KiB route-local working target. No NF-03 accessibility refactor merely to fund NF-04. Preserve its accessibility behavior. |
| P4 — discovery ownership | **Accept** | Use existing hosted integration injection. Supersede the literal 80-byte catalog-link plan; avoid a hosted-only dead link in the offline edition. Count integration bytes and source. |
| P5 — opt-in copy lint | **Partly accept** | Cover all new NF-04 copy/styles and changed integration copy. Confirm and fix the reported existing title violation. A full historical copy-lint migration is not a prerequisite. |
| P6 — arithmetic | **Accept with explicit counter names** | Add existing receipt and new route metadata only if they are distinct files. Count the final emitted union; avoid double counting replaced root HTML. |
| C1 — transfer IDs | **Accept** | Derive transfer IDs and ownership from canonical requests and policy. Add the discriminating ID/rounding fixture. |
| C2 — caps | **Accept as an explicit amendment** | Require uniform WAN/local caps in the first canonical input schema. This narrows/clarifies the older missing-cap language; version the change, do not describe it as already frozen. |
| C3 — input, checks, ordering | **Accept** | Freeze normalized fields, fixed task chain, exogenous outcome and total event ordering, including depot-owned events. |
| C4 — inventory | **Partly accept** | First slice accepts declared-empty inventory only. Define exact identity equality; defer the full inventory taxonomy. Nonmatching artifacts are not automatically corrupt or invalid. |
| C5 — record bounds | **Accept clarification; reject “overflow proven”** | Loose maxima need not co-occur. Define serialization entries and derive the bound. First-slice P=0 bound differs from future prefetch-window bound. Keep existing hard ceilings. |
| C6 — off-boundary navigation | **Accept** | Free seek floors; event navigation moves to the first applied boundary and displays raw versus applied time. Raw deadlines remain unrounded. |
| V1 — verifier independence | **Accept intent, strengthen method** | Enforce transitive dependency boundaries and discriminating mutations. An export-name regex alone cannot prove independence. |
| V2 — one fixture table | **Accept** | Use the unified analytical expectations in §6, including failure, censoring, source availability and individual regression. |
| V3 — quantum/performance | **Accept with correction** | Browser primary only; build-time refinement. Actual cancellation must interrupt work, not merely suppress a late result. Add residual-heavy stress alongside the large-object case. |
| E1 — loading and summaries | **Accept** | Manifest-backed published summaries; verify both reconstructed records, hashes and metrics; replace the pair atomically. Changes cancel work and wait for an explicit action. |
| E2 — visible controls | **Accept** | Ship three counterexamples using the same bench, not test-only assurances. Slow local disproves “cache guarantees the target,” not “cache saves time.” |
| E3 — two playback modes | **Accept with less prescription** | Held chapters and continuous inspection are separate. Use a small route-local controller if shared player behavior is unsuitable; no unnecessary wholesale player copy. |
| E4 — dynamic captions | **Partly accept** | Derive quantitative facts from accepted records. Bind authored default chapters to a compatible case; do not auto-generate a universal six-chapter story for every fixture. |
| E5 — phone and arm state | **Accept state rule; relax overconstrained layout** | Arm choice persists independently of narration. Keep both outcomes near the clock. Permit vertical scrolling; do not shrink text to fit all controls and meters in 320×568. |
| E6 — target status | **Accept with boundary correction** | At the inclusive deadline use **“Target now; not ready.”** Use “Target passed” only after it. Completion exactly at target is on time. |
| E7 — assumptions | **Accept with scope correction** | Make equal sharing, whole-file forwarding and invented target visible. The 36 GB/288 s difference is invariant to changing only the default deadline, not to arbitrary changes in policy or workload. |
| E8 — individual regression | **Accept now, consolidate** | Use the simpler two-request 0/100 s arrival case with 250 s deadlines. Defer the additional four-arrival case; do not ship two near-duplicate presets. |

### Minor suggestions and earlier feedback

| Suggestion | Disposition |
| --- | --- |
| Common scale across WAN, local and both arms | Adopt. One byte-rate scale fixed for the accepted pair; separate capacity marks. |
| One “Why this state?” inspector per arm | Adopt. Cause/headline visible; detailed quantities in a disclosure. |
| Consistent arm names, WAN definition and chapter terminology | Adopt. “Repeated download” then “Cold shared cache.” Adapt definitions to the accepted vehicle count. |
| Six-value trust line | Preserve the existing trust vocabulary and exact meanings after repository inspection. Keep a short scope line visible and detailed states readable; no new authority badge. |
| Depot-partner relevance | Adopt “What would a depot partner need to measure first?” Storage is declared provision, not measured occupancy or facility sizing. |
| Every module exports build identity | Defer. This adds runtime pinning beyond accepted B-lite. A common imported build ID does not itself prove every cached module is from that build. |
| NF-03 41 px chips and generic arm labels | Reproduce the reported issues. If confirmed, make only the targeted accessibility/label repair with measured byte impact. No global navigation redesign. |
| Ban “minutes” everywhere or universal 25-word captions | Do not adopt as absolute rules. Primary technical labels use exact seconds; optional readable mm:ss is fine. Follow actual repository copy policy. Prefer a short sentence plus details. |
| Require every phone focal element above the fold | Do not adopt. Require readable, reachable, unclipped controls and sensible grouping instead. |
| Refuted findings in F §6 | Retain as closed: grant forgery already rejected by full comparison; positive grants define Receiving; future-event distinction and stage chain are present; fixture ownership and visitor-question mapping are already scoped. |
| Prior review’s early budget/runtime checkpoint and counterexamples | Retain, made concrete below. Earlier UI and contract amendments are reconciled here rather than appended as competing instructions. |

## 4. Packaging preflight: prove there is a valid build path

**Priority: before substantial engine/UI work.** F reports that `pack.mjs` and `check-dist.mjs` still apply the old all-text cap before the newer receipt gate, and that NF-03’s sidecar inventories every hosted file. Confirm these facts at current HEAD. If already fixed, record the evidence and skip the fix. If reproduced, address them in the first bounded NF04-B tooling commit; no separate production release is necessary.

### 4.1 Ownership and reachability

Use explicit physical ownership plus dependency reachability and declared non-imported assets:

1. Preserve ownership of existing legacy paths. A rename, exclusion or relocation does not make existing legacy work “NF-04.”
2. Count text reachable from the legacy app, worker and capacity entries, plus their declared assets, in the legacy gate. Any new shared dependency reachable from these entries is also legacy-counted.
3. Count genuinely NF-04-only paths under NF-04 ownership. Maintain a distinct NF-04 route-local counter and a complete transitive route closure.
4. Declare hosted integration-owned files and final transforms explicitly. Unknown ownership or conflicting classifications fail closed. Count an actual shared physical file once in the emitted union and fully in each route closure that needs it.
5. Include manifests, sidecars, HTML, CSS, boot modules, worker modules and dynamically required assets. Reachability alone must not omit non-imported runtime files.
6. Compute text from the final emitted/deployed inventory, including non-served deployment configuration such as `_headers`; report served transfer bytes separately. If integration replaces root HTML, count the final replacement once; do not silently omit its additions or count both versions unless both are actually retained in the deployed inventory.

Retain the legacy 2,621,440 B cap; the aggregate emitted 3,145,728 B cap; original-source, receipt, archive, offline, non-City and route-closure caps. Add integration-text as a visible subset counter within the aggregate, not as an uncapped escape hatch. Report the baseline, delta, owning source counter and reproduction binding for original integration code and tools. State explicitly whether each is inside the 3 MiB teaching-source gate or a separately declared existing owner. Do not move existing inputs out or omit new code solely because it is integration-owned. H establishes capture of teaching originals/tools; it does not establish that the archive already contains every integration source.

**Discriminating acceptance:** reproduce the legacy baseline at the historical source; a scratch NF-04-only 300,000 B module passes ownership/aggregate checks without growing legacy; a separate scratch mutation adding 118 B to the unrecovered legacy baseline fails its gate. Do not combine these into a test against a newly shrunken sidecar and still expect the old 117-byte margin.

### 4.2 Sidecars and discovery

Recommended: retain NF-03’s sidecar for explicitly declared legacy scope, exclude new NF-04 paths, and add a separate NF-04 sidecar at the new route. The whole-integration inventory still accounts for everything. If scope semantics change, version the sidecar schema and update its independent readers/tests. Preserve historical published sidecars and NF-03 scientific records. Regenerate and measure NF-03 closure; shrinking the sidecar is allowed but does not authorize unrelated growth.

Use `apps/fleetlab-city/hosted/integration.mjs`’s existing hosted discovery mechanism for NF-04’s catalog entry, next-lesson link and roadmap status. Inject only when the accepted NF-04 route is present in the same generation’s inventory. The small offline edition retains its useful existing content and contains no nonfunctional hosted-only NF-04 control. An explanatory offline roadmap mention is not itself a defect.

This supersedes the literal 80-byte link fixture in `simulation-catalog.js`. Any necessary legacy hook must be named and measured. Allowed changes include declared sidecars, receipts, packaging tools, integration transforms and necessary hooks; an impossible “all existing bytes unchanged except hooks” rule would contradict these changes.

### 4.3 Dependency and budget plan

F reports NF-03’s shared closure as 248,827 B, including approximately 103,892 B of `a11y.js`/`labels.js` transitively needed for a small live-region helper. Verify actual imports before reusing them.

Recommended initial shared set, subject to measured reachability: existing `styles.css`, `dom.js`, `sha256.js`, `display-text.js`, `model-identity.js`, and required headers. F’s reported total for those is **131,979 B**. Implement a small accessible live-region adapter locally if needed. Do not import capacity-model UI or the large label tree solely for convenience. Add the unchanged shared player only if its actual behavior fits; otherwise write a small local controller. Any additional shared dependency must be named, justified and counted, not implicitly permitted.

Planning arithmetic, assuming distinct files:

| Planning calculation | Bytes |
| --- | ---: |
| Minimal reported shared set + proposed 320 KiB local + 32 KiB route metadata | 131,979 + 327,680 + 32,768 = **492,427** |
| Reserve under 512 KiB closure before other imports | **31,861** |
| Old 350 KiB local plan, plus legacy, route metadata and existing global receipt | 2,621,323 + 358,400 + 32,768 + 26,342 = **3,038,833** |
| Its aggregate reserve before other counted changes | **106,895** |
| Proposed 320 KiB local version of that aggregate | **3,008,113**, reserve **137,615** |
| Source after proposed 300 KiB net growth | 2,765,799 + 307,200 = **3,072,999**, reserve **72,729** |

These are planning sums, not proof the route fits. The 32 KiB route metadata allowance is separate from the existing global receipt. If it instead describes the same receipt, adding both is wrong. Count integration text, any additional unique shared files and receipt growth before claiming actual reserve. Source size and emitted size need not match. Tests and fixtures follow declared source-offer ownership; they are not automatically free.

Run the current copy/style rules over every new NF-04 user-facing module, stylesheet and changed integration string. Confirm F’s reported title violation and correct it narrowly if present. Do not invent a new site-wide editorial migration as a blocking dependency.

## 5. Contract amendments to freeze before model implementation

Keep the A1–A5 numerical mechanism. The following close input, serialization and viewer ambiguities; they are not a new allocator design.

### 5.1 Version and input boundary

Recommended versioning: amend the contract document to **1.1.0** for these explicit decisions; use first NF-04 input/record schema **1.0.0** because no NF-04 records have shipped; keep the allocator policy version unchanged if its mathematics is unchanged. Confirm the repository’s version conventions before naming constants. Distinguish contract document version, input schema, record schema, allocator policy, manifest schema and package-sidecar schema.

Require explicit canonical resource caps. This intentionally replaces the ambiguous missing-cap normalization in the older proposal for this first supported schema. No published NF-04 input migration is expected; if Codex discovers external consumers or stored inputs, preserve normalization at a documented adapter boundary or version the incompatible interface. Never silently reinterpret an existing accepted input.

| Canonical input | Required fields/rules |
| --- | --- |
| Scenario/window | `P_ms=0`, bounded `H_ms`, `quantum_ms` 1000 or 250; horizon/window alignment follows A3. Public presets use H=2,400,000 ms and browser quantum 1000. |
| Artifact | `id`, `version`, digest in the declared canonical digest format, `size_bytes`, `available_at_ms`. Equality requires all identity fields including size. |
| Requests | Unique `id`, raw `arrival_ms`, raw `deadline_ms`, `check_ms`, `check_outcome` (`pass` or `fail`), `activation_ms`. Sort canonically, not by caller array order. |
| Resource rates | WAN/local `aggregate_Bps` and `transfer_cap_Bps`, explicit nonnegative integer values satisfying A2’s quantum divisibility/range constraints. Caps apply uniformly to every transfer on that resource in both arms. |
| Inventory | Explicitly declared empty. Reject nonempty/partial/obsolete stock with a named **unsupported-mode** error in this slice. |
| Arm policy | `repeated` or `cold`, recorded separately from the common exogenous input identity. Both arms must use the same normalized exogenous inputs. |

The default caps remain WAN 125,000,000 and local 250,000,000 B/s, including the slow-local case. Lowering aggregate local capacity does not silently lower its declared per-transfer cap. No per-request cap editor or arbitrary task graph is needed.

### 5.2 Transfer identity and ownership

Request IDs: unique ASCII `[A-Za-z0-9_-]`, 1–28 characters. Derive immutable universes before execution:

- Repeated WAN: `wan-<request-id>`; local: `loc-<request-id>`.
- Cold-cache WAN: exactly `depot-fetch`; local: `loc-<request-id>`.
- Each transfer records resource, owner kind (`request` or `depot_cache`) and request ID, null for shared fetch.
- Sort derived IDs using the declared ASCII ordering; do not locale-sort or let UI labels change ordering.
- The verifier independently derives and checks universes and owners. Unknown, duplicate or additional IDs reject.
- Selected-request rates include only its owned transfers. Shared cache fetch can be a prerequisite while the selected request’s own WAN rate is zero.

### 5.3 Preserve the physical model and exact boundary rules

The fixed chain is **receipt → modeled check → activation → readiness**, with no cross-request check/activation dependencies. Energy is already available. Whole-file forwarding permits each repeated request’s local transfer as soon as its own WAN receipt completes; there is no artificial all-requests WAN barrier. Repeated WAN work waits for that request’s arrival and source availability. Cold fetching waits until the first arrived request needs the available object; it fetches one complete object, then permits arrived local consumers. It must not start early merely because the source is available. Check outcomes are scenario inputs, identical across arms and revealed only at the complete check boundary. A future outcome never affects transfer eligibility or allocation; activation eligibility requires the completed check to have passed.

Retain capped equal sharing, simultaneous rounds, residual-only cursor advancement, persistent idle cursors, discarded unused whole-byte budget, and no fractional carry. These are teaching-model assumptions, not claims about real update systems.

Retain A3’s phases: previous-interval completions; arrivals/source/inventory transitions; bounded acyclic zero-duration closure; readiness/deadline evaluation; new positive-duration work only when t < H. Define a total canonical ordering within phases, including a stable key for depot-owned events, then request ID and chain position. Do not leave simultaneous depot/request events to insertion order.

Raw arrivals and source availability become eligible at the first boundary at or after their raw time. Positive durations round up to a quantum. **Deadlines are raw and inclusive, never rounded.** Zero-duration work may close at H; positive-duration work may not start at H. Cycles or more than the declared bounded closure reject. A snapshot at t includes bytes through t; displayed rates describe the next interval `[t,t+Δ)`. At H there is no next interval and rates are zero.

Keep null completion for failure/unfinished work and retain every request in denominators. “All ready” is null if any request failed or remains unfinished. The narrative/normal-play endpoint is the latest terminal event across both arms when all requests are terminal; otherwise H. Records remain inspectable through H regardless of that shorter endpoint.

### 5.4 Inventory and preloading stay bounded

Declared-empty first-slice inventory removes preload ambiguity without pretending it is solved for all future inputs. A later inventory extension must distinguish a nonmatching artifact from an internally contradictory identity. Do not freeze F’s blanket rejection of every different artifact ID or same-version/different-digest entry as a general truth.

For the future extension, preserve retirement-before-replacement accounting if required by the declared S provision; specify the exact retirement boundary before the first replacement grant. Commit a fetched complete object at its receipt boundary. “Inventory at zero” is a snapshot, not an extra inventory commit. Storage provision remains N×S for repeated versus S for cache, not a storage contention model or measured occupancy cost.

Preloading remains a second question. It must show a common earlier window and inventory, so earlier work does not look free. Do not implement it in this slice.

### 5.5 Record entries and ceilings

Keep the existing 130,000-entry, 32 MiB serialized per-record and 64 MiB pair hard ceilings, plus existing input bounds. Define an entry before deriving a count. Recommended representation: boundary rows; two resource rows per boundary; eligible-transfer rows per service interval, including zero grants; task-transition rows; inventory-event rows. Embed arrivals/source markers in boundary rows rather than counting them a second time.

Whole-file prerequisites mean at most N eligible transfers across both resources per interval, not 2N simultaneously: each repeated request can be eligible for only one transfer stage; a cold fetch and its local delivery do not overlap. Under that representation a conservative count is:

| Window/quantum | Slots | Boundary + resource + transfer + task + inventory upper bound |
| --- | ---: | ---: |
| First slice P=0, H=2400 s, Δ=1 s | 2,400 | 2,401 + 4,802 + 9,600 + 64 + 2 = **16,869** |
| First slice P=0, H=2400 s, Δ=0.25 s | 9,600 | 9,601 + 19,202 + 38,400 + 64 + 2 = **67,269** |
| Future maximum 3,000 s common window, Δ=0.25 s | 12,000 | 12,001 + 24,002 + 48,000 + 64 + 2 = **84,069** |

These are conservative representation-dependent bounds, not measured record sizes. Arrays nested inside a row, ID strings, metadata and parsed heap still cost bytes. Serialize stress cases and measure. F’s sum of independent loose maxima did not demonstrate a reachable 130,000-entry overflow.

## 6. One numerical acceptance matrix

**All values below are independently checked analytical expectations, not executed results.** Use decimal GB and useful byte rates, not binary GiB or unmodeled protocol overhead. Unless changed in a row: 12,000,000,000 B artifact; 125,000,000 B/s WAN; 250,000,000 B/s local; matching default caps; 60 s checks + 30 s activation; raw target 480 s; source available at zero; H=2400 s. Primary Δ=1 s. Test both arms.

### 6.1 Main calculations

For four simultaneous identical requests, equal sharing and whole-file forwarding yield:

- Repeated: 48 GB ÷ 0.125 GB/s + 48 GB ÷ 0.25 GB/s + 90 s = **666 s**.
- Cold cache: 12 GB ÷ 0.125 GB/s + 48 GB ÷ 0.25 GB/s + 90 s = **378 s**.
- One vehicle, either arm: 12 ÷ 0.125 + 12 ÷ 0.25 + 90 = **234 s**.
- Future preload after arrival: 48 ÷ 0.25 + 90 = **282 s**. From the common P=−96 s origin, cold takes **474 s** and preload **378 s**. Both transfer 12 GB over WAN across the full common window; cold does it after arrival, preload before arrival. These are later-extension expectations, not first-slice functionality.

At default cold t=96 WAN receipt completes; t=288 local receipt completes; t=348 modeled checks complete; t=378 activation completes. Repeated t=378 has delivered **47.25 GB WAN and zero local**; WAN finishes at384; t=480 local has delivered **24 GB total / 6 GB each**; local finishes 576; checks 636; readiness 666.

### 6.2 Public cases

| Case | Repeated download | Cold shared cache | What visitors learn |
| --- | --- | --- | --- |
| Four vehicles, simultaneous | All ready 666 s; 0/4 by 480; WAN 48 GB; local 48 GB | All ready 378 s; 4/4 by 480; WAN 12 GB; local 48 GB | Reuse removes repeated WAN work; local delivery remains. |
| One vehicle | Ready 234 s; 1/1 by 480; WAN 12 GB; local 12 GB | Same | No duplicate WAN work means no reuse advantage in this model. |
| Slower local link: aggregate 31,250,000 B/s, cap still 250,000,000 | All ready 2010 s; 0/4 by 480 | All ready 1722 s; 0/4 by 480 | Cache saves 288 s but does not make the deadline. The downstream link still dominates. |
| Two arrivals at0/100 s; both raw targets 250 s | V1 ready 234; V2 ready 334; all-ready 334; 1/2 on time; WAN 24 GB; local 24 GB | V1 ready 278; V2 ready 282; all-ready 282; 0/2 on time; WAN 12 GB; local 24 GB | Earlier fleet completion can delay an individual and worsen a deadline count. |

**Why the staggered case regresses:** repeated V1 receives locally from 96 to 144; V2 is still fetching over WAN until 196. In cold cache, V1 receives 1 GB from 96 to 100, then shares the local link with newly arrived V2. Its remaining 11 GB at 0.125 GB/s completes at 188; V2 completes 192. Add 90 s to get 278/282. The fleet finishes 52 s earlier, while V1 finishes 44 s later.

At t=150 in that case, repeated V1 is checking: own transfer rate 0 while shared WAN is1 Gbit/s for V2. Cold V1 is receiving locally at1 Gbit/s out of 2 Gbit/s shared with V2. This is a required inspector/projection acceptance case.

### 6.3 Discriminating model and verifier fixtures

| Fixture | Exact expected evidence |
| --- | --- |
| Derived-ID tie, Δ=1 s | Requests `A`, `A0`, `B`, arrival 0, S=11,958,333,334 B, target 520 s. Repeated WAN receipts 287/288/288; local 429/431/431; ready 519/521/521. Only A meets target. Permuting request arrays preserves normalized identity and record. Do not assert these same milestones at250 ms. |
| Maximum object / censored repeated arm | N=4, S=64 GB. Cold WAN 512, local 1536, checks 1596, ready 1626; 0/4 on time, WAN 64 GB/local 256 GB. Repeated WAN 2048, local through H: 88 GB, 22 GB each and 42 GB remaining each; no checks; all-ready null; endpointH. Same milestones at both quanta. |
| Rounding accumulation | N=1, arrival 100 ms, S=12,000,000,001 B, check 60001 ms, activation 30000 ms, deadline 236000 ms. At1 s: eligibility 1, WAN 98, local 147, check 208, ready 238, late. At250 ms: eligibility 0.25, WAN 96.5, local 144.75, check 205, ready 235, on time. Difference 3000 ms; outcome changes. |
| Exogenous failed check | Default, V4 fails. Cold failure 348, repeated failure 636. V4 never activates. Others ready 378/666; all-ready null both; on-time cold 3/4 versus repeated 0/4; pair endpoint 666. Allocation/receipt ledgers match the all-pass cases; full input/record digests do not. |
| Delayed source | Default, available 50 s. Cold WAN 146, local 338, check 398, ready 428. Repeated WAN 434, local 626, check 686, ready 716. No WAN grant before 50. Raw availability 50.1 s applies at51 with 1 s quantum, adding 1 s to those milestones. |
| Inclusive horizon | N=1, S=4 B, WAN/local 4 B/s, Δ1 s, zero check/activation, H=2 s. WAN done 1, local and readiness 2; deadline 2000 ms met,1999 ms missed. A positive activation may not start at H and leaves readiness null. |
| Small-object discretization | N=1, S=1 B, same 4 B/s rates and zero tasks. Ready 2 s atΔ1 s; ready 0.5 s atΔ250 ms. A1 s target changes outcome. |
| Zero cap / zero resource | Test a zero transfer cap, zero aggregate capacity and both. No fabricated progress; unfinished at H. Inspector names the binding cap/resource accurately, including ties rather than implying throughput exists. |
| Residual-heavy primary stress | N=3, S=64 GB, WAN aggregate 4 B/s, positive nonbinding cap, Δ1 s, H2400. Budget 4 B/slot produces a rotating remainder. Repeated: each request receives 3200 B WAN after 2400 slots. Cold: the single depot-owned fetch receives 9600 B. Local 0 in both; all unfinished. |
| Residual-heavy refinement stress | N=4, S=64 GB, WAN aggregate 12 B/s, Δ250 ms, H2400. Budget 3 B/slot. Repeated: each request receives 7200 B WAN over 9600 slots. Cold: the depot-owned fetch receives 28,800 B. Local 0 in both; all unfinished. |
| Rejection mutations | Changed grant; wrong residual cursor; ineligible early local transfer; source-unavailable grant; forged owner/universe; wrong version/schema; wrong digest; missing request; early readiness; nonempty unsupported inventory; forged manifest metric; horizon overshoot. Require a discriminating reason, not a generic “failed” screenshot. |

Keep existing A1 round/cap/redistribution, cursor persistence, unused-budget, integer/divisibility, malformed-input and permutation fixtures. This table supplements them; it does not replace detailed per-slot grant/cursor checks with end-state-only tests.

### 6.4 Independent verification

The verifier may share validated schema, canonical encoding and digest utilities, but not executable allocation, eligibility, dependency or readiness logic. Inspect its **transitive imports** and enforce the architectural boundary in tests. A renamed function can evade a name regex; names alone are not independence.

Use mutation tests that actually execute a discriminating case: a deliberately wrong engine allocation/eligibility record must be rejected; a verifier with a changed cursor or store-forward rule must fail the relevant correct/incorrect fixture suite. Assert the mutation applied and ran. Keep expected constants independent of engine helper output.

This establishes consistency with a declared model, within the verifier’s tested limits. It does not establish real-world authenticity, calibration, operator endorsement, driving safety, authorization or deployment permission.

## 7. Product and interaction specification

### 7.1 First useful screen

Preserve warm ivory, forest and teal. Use contrast, spacing and visible causality rather than decorative complexity. No mandatory image, video, 3D asset, backend, paid API or new dependency is needed.

Suggested initial copy:

> **One update. Four vehicles. Where is the wait?**
> Compare four separate downloads with one reusable depot copy. Can all four vehicles be ready by the 480-second target?

Place a short fixed-conditions line nearby: same artifact, arrivals, useful link rates, checks and activation; only delivery policy changes. Primary action: **Watch comparison**. Follow it with a concise scope line: **Synthetic model. Readiness here does not establish driving safety or permission to deploy.**

Before loading, numerical summaries must say **Published study summary**. After successful reconstruction and verification, say **Loaded records checked** with details explaining what “checked” means. Never silently promote a build-time statement to a browser-verified result.

Whole-run summary, fixed while the cursor moves:

| Default outcome | Repeated download | Cold shared cache |
| --- | ---: | ---: |
| Ready by 480 s | 0/4 | 4/4 |
| All ready | 666 s | 378 s |
| WAN delivered | 48 GB | 12 GB |

Immediately add **Local delivery: 48 GB in both**. Keep three ledgers distinguishable: useful WAN bytes crossing into the depot, local bytes delivered to vehicles, and unique required artifact identities/size. The default requires **one unique 12 GB artifact in both arms**, despite different WAN traffic; this is an input fact, not a statement that receipt has completed at the cursor. Declared depot storage provision is 48 GB versus 12 GB, separately labeled and not interpreted as measured occupancy or a binding storage constraint. Do not reduce these distinct outcomes to a “winner” score. The selected vehicle’s current state, current useful rates and current bytes belong in a separately labeled **At this time** area.

### 7.2 Bench layout and information hierarchy

| Desktop, target 1440×900 | Phone, target 390×844; narrow 320 px |
| --- | --- |
| Short caption and guide controls above a common exact clock. | Short caption and controls, then exact clock and named arm switch. |
| Both whole-run outcome summaries together. | Both outcome summaries remain together near the switch, even while one arm is hidden. |
| Side-by-side arms: source → WAN crossing depot boundary → depot copy → local link → vehicles. | One visible arm; the same topology stacks vertically without horizontal page overflow. |
| Four rate bars share one physical scale. Capacity markers distinguish WAN/local capacities. | Same scale and marker meanings. A hidden arm does not reset or recompute. |
| Selected-vehicle task chain and one visible cause/headline per arm; details expandable. | Selected vehicle and its cause remain adjacent to the visible arm; details are touch reachable. |
| Full timeline and event navigation below the guided explanation. | Full timeline can scroll vertically into view. Sticky controls are optional and must not obscure content or keyboard focus. |

After bringing the bench into view on desktop, aim to show clock, both outcomes, rate bars and both state headlines within 900 px. At320×568, accept vertical scrolling; do not promise the entire focal composition fits at once. Require no horizontal overflow, clipping or inaccessible controls. New interactive targets should meet the project’s44×44 px target. Check 200% zoom and long/failure text. Preserve clear focus and sufficient text/non-text contrast.

Common rate scale: maximum declared aggregate capacity across both resources and both arms, fixed for the accepted pair. Default max 250,000,000 B/s makes WAN’s capacity mark 50%; slow-local max 125,000,000 makes local’s mark 25%. When both capacities are zero, show unavailable/zero bars without dividing by zero. Show numeric rates and units; do not let a full 1 Gbit/s bar appear equal to a full 2 Gbit/s bar. Moving dots are illustrative flow cues, not exact byte counts or additional evidence.

### 7.3 Loading, cancellation and accepted state

Maintain distinct `pending selection`, `active job` and `accepted pair` state:

1. Before first Watch, show the manifest’s published summary and static explanation. Do not execute a model merely on page load.
2. Watch creates one cancellable job: reconstruct each primary arm, independently verify, compare canonical record digests and verifier-derived metrics with the manifest, then atomically accept both.
3. A preset change stops guide playback, actually cancels active work and waits for the next explicit **Watch comparison** or **Compare this case**. It does not silently start another model run.
4. Retain an earlier accepted pair as **Previous setup: [case name]** while a new selection waits or loads. Its title, counts, labels, captions and summary stay attached to that old pair; do not relabel old numbers with the pending case.
5. Late messages from obsolete job tokens cannot commit. Also stop the computation itself using worker termination or bounded cooperative checks within long phases. Suppressing output alone is not cancellation.
6. Any arm rejection, digest mismatch or metric mismatch prevents pair replacement. Show an accessible error and preserve the previous accepted pair or published fallback.
7. Selecting a vehicle, switching the visible arm, seeking, resizing or navigating chapters never runs an engine.

Use test harness injection for failure/unfinished UI cases; do not ship a public test-only backdoor. Public cases must have complete manifest entries, common input identities, both primary record identities and metrics, version IDs and clearly attributed refinement summaries.

### 7.4 Guide, inspection and mobile state

The default guide is an editorial sequence of held accepted snapshots, not continuous model time. Display **Jump to t=…** when it skips. Its 40 seconds of narration are distinct from 666 simulated seconds of default progress and the 2400-second observation horizon.

- Watch starts the default guide only after records are accepted. Pause holds a chapter; Resume continues; Replay explicitly returns to the beginning. No automatic repeat loop.
- Direct chapter selection selects its accepted time and authored vehicle, then pauses until Resume. Keyboard actions must match this behavior.
- Manual vehicle or time changes pause the guide and enter inspection. Resume restores the chapter’s authored time/vehicle; make that restoration predictable and visible.
- **Visible arm is persistent view state.** Chapters and Resume never change it. Phone arm switching does not pause narration, change time/vehicle or trigger a run.
- Preset changes cancel narration. The authored guide is available only for its compatible default input/record identity. Other cases get accurate projection-driven explanations and full inspection; no default “four ready” captions or default 666-second endpoint.
- Full-timeline Play is a separate control, supports 30×, and normally stops at the finite pair endpoint. Default 0 to 666 takes 22.2 seconds of scheduler time. The slider/event table still permits inspection throughH. A seek beyond the finite endpoint remains a static inspection; offer explicit replay from 0 rather than silently rewinding.
- Free seek floors to a boundary. Raw event navigation moves to the first applied boundary and shows both raw/applied times when different. Preserve the exact raw target in all deadline labels.
- Reduced-motion/static paths expose the same snapshots, facts and controls without animated travel. Do not start autonomous motion without a usable pause mechanism. First-slice NF-04 Watch remains intentional; homepage autoplay policy is unchanged.

Preserve the existing playback lifecycle: start the guide only when its accepted bench is visible. Manual Pause persists across visibility changes, resizing and history restoration. An automatic hidden/offscreen pause may resume only the same accepted intent at its displayed playhead, with no elapsed-wall-time catch-up. Ended playback stays ended. Reduced-motion or applicable data-saving preference changes cancel automatic presentation; changing the preference back never silently restarts it. During loading, distinguish **Cancel computation** from pausing pending playback intent. Add a focused test for paused/ended state across hide/show and history restoration, plus preference-change no-restart behavior.

### 7.5 Six-chapter default storyboard

All quantities are filled from the accepted projection. These anchors are expected for the default only. Names “chapter” and “guide” are user-facing; the table is an authoring plan, not an executable result.

| Chapter / hold | Accepted time | Visual focus | Main learning point |
| --- | ---: | --- | --- |
| 1 /6 s | 0 | Same four vehicles, empty depot, equal fixed conditions; one object required by each vehicle. | Change delivery policy while holding demand and resources fixed. |
| 2 /7 s | 96 s | Cold depot object complete; local delivery starts. Repeated WAN still active. | A reusable completed object releases downstream work sooner. |
| 3 /7 s | 288 s | Cold local delivery complete; modeled checks begin. Repeated WAN still active. | Receiving bytes is a prerequisite, not modeled readiness. |
| 4 /7 s | 378 s | Cold 4/4 ready; repeated WAN 47.25 GB, local 0. Show selected request and shared traffic separately. | Shared work can continue while a request waits on its prerequisite. |
| 5 /7 s | 480 s | Cold 4/4 meet the target; repeated local 24 GB,6 GB each, not ready. | Deadline counts depend on the invented target and declared sharing/forwarding assumptions. |
| 6 /6 s | 666 s | Repeated reaches readiness. Whole-run WAN 48 versus 12 GB; local 48 in both. | Reuse saved WAN work in this setup; inspect a counterexample before generalizing. |

An event inspection at348 s should say **“Modeled checks finish as declared; activation begins.”** Do not imply real software validation or signing took place. Reuse the same factual projection for visible caption facts, static chapter content and screen-reader announcements. Avoid announcing every animation frame.

### 7.6 State and target language

Every inspector shows current state, next blocking prerequisite/resource, own useful rate, relevant shared rate and target status. A zero own rate with positive shared traffic is not a contradiction.

| Condition after boundary closure | Target wording |
| --- | --- |
| Not ready, t < raw target | “Target at 480 s; 102 s remaining” at t=378, derived from the actual raw target and cursor |
| Not ready, t = raw target | **“Target now; not ready”** |
| Not ready, t > raw target | “Target passed; not ready” |
| Ready at or before raw target | “Ready on time” |
| Ready after raw target | “Ready late” |
| Check has failed | “Modeled check failed; readiness blocked” |
| Still unfinished at H | “Unfinished at observation end”; keep null readiness and denominator |

Do not reveal the future failure in an earlier current-state label. A separately labeled whole-run result may report it. Checking can say **“Modeled check; outcome set by the scenario.”** A null all-ready value must not render as0 s or disappear from the comparison.

### 7.7 Explain assumptions and relevance without overclaiming

Keep a concise line at the target chapter and static equivalent:

> The target is invented. These counts depend on that target, equal sharing and whole-file forwarding.

In limits, state that the model omits streaming, multicast, delta updates, retries, packet overhead, real signing/installation checks, calibrated device performance, safety assurance and deployment authority. The 36 GB and 288 s differences hold when changing only the default deadline; they are not universal results for different schedules or workloads. Fable’s sequential-download and ideal-streaming calculations describe **different mechanisms**, not implemented alternatives to display as executed results.

Connect to AV operations through questions that can actually be supported: How much upstream work is repeated? When does local contention become binding? Which vehicle is delayed by a policy that improves fleet completion? What would a depot partner need to measure first? Useful measurements include artifact/delta distributions, arrival patterns, useful link throughput, per-device caps, real validation/activation duration, eligibility rules and actual target priorities.

A later optimization lesson needs an explicit objective, decision variables, constraints and feasibility checks. For example: minimize weighted deadline misses and fleet unavailability; choose delivery order/allocation/preload timing; constrain capacities, cache space, arrivals, source availability, task prerequisites and allowed activation windows; verify every proposed schedule independently against those constraints. NF-03 and NF-04 teach mechanisms needed to reason about those choices; neither is that optimizer today.

## 8. Runtime, accessibility and comprehension acceptance

### Proposed runtime targets — not measured or previously approved

Adopt or revise these before performance polish, with a stated reason if revised. Measure primary browser reconstruction + verification + digest/manifest checks after assets are available, not network loading mixed into compute time. Report cold and warm conditions separately. For p95, collect at least 20 trials per named condition and disclose that this is a small benchmark sample.

| Measure | Proposed target |
| --- | --- |
| Default primary pair | p95≤3 s on named reference laptop; p95≤5 s on named reference phone |
| Maximum-size and residual-heavy primary pairs | p95≤15 s on reference phone; report each case separately |
| Cancel feedback / actual work stop | UI acknowledgment≤100 ms; work stops≤250 ms |
| Seek to accepted snapshot | p95≤100 ms |
| Peak retained/active heap | Default≤128 MiB; stress≤256 MiB, including previous accepted pair plus new job where retained |

Use supported memory instrumentation and state its limitations. Do not substitute record serialization size for heap measurement. Test cancellation during generation, verification and hashing, including a long phase; merely yielding between phases is insufficient. Test successful replacement and rejected/cancelled replacement with a previous pair present. Build-time 250 ms performance is measured separately, with no claim of browser re-verification.

Physical-device gates stay **UNVERIFIED** until run on a physical device. Emulated width is layout evidence, not device performance, touch usability or native preference evidence. If unavailable, provide the exact manual script and mark the gate open rather than converting automated checks into closure.

### Three short human-comprehension tasks

Use at least five independent participants as a small qualitative check, not population validation or operator adoption evidence. Record uncoached answers and failure patterns. Proposed success threshold: at least 4/5 complete each learning task; any authority misconception triggers copy revision and retesting.

| Task | Observable success |
| --- | --- |
| **Explain the default at the target.** “What changed, what stayed fixed, and why is the selected repeated-download vehicle not ready?” | Names reuse versus repeated WAN work, at least two fixed conditions, current local receipt/prerequisite, and recognizes that the 480 s target and whole-file/equal-sharing model shape the count. Does not confuse remaining local work with a failed check. |
| **Find a limit to the improvement.** “Use One vehicle and Two arrivals. Does caching always help every vehicle or target?” | Checks 234/234 in the control, then identifies V1’s234→278 regression and 1/2→0/2 deadline count despite earlier all-ready. Explains shared local contention rather than asserting a universal winner. |
| **Explain what can be concluded.** “What would you measure before using this for depot planning? Does a checked record permit installation or road operation?” | Names at least two uncalibrated real inputs; distinguishes model consistency from authenticity/safety/permission; explicitly says this result alone authorizes neither installation nor driving. |

Also inspect keyboard-only Watch/Cancel, pause/resume, chapter selection, preset selection, vehicle selection, arm switching and timeline controls; visible focus; screen-reader reading order; reduced-motion path;200% zoom; contrast and target sizes. Record actual browser/device/viewport/date and observed interactions when these checks are performed. An AI review cannot close human or physical-device requirements.

## 9. Bounded Codex implementation sequence

This sequence is ready for use after the owner accepts the scope. It is not authorization to begin a broader redesign or deploy. At kickoff, read repository `AGENTS.md`, applicable project instructions and the current versions of D/S/C/H. Inspect current status before editing. Preserve unrelated work.

### Step 0 — Amend documents and establish current truth

Update C/S/D’s conflicting statements using this consolidation. Record the accepted defaults, actual HEAD and source/release identities; distinguish historical from current evidence. Confirm P1/P2, shared imports, integration copy and NF-03 narrow-width observations. List exact files and tests to change based on repository inspection.

**Exit:** one contract/schema/fixture table, one supported-mode statement, one packaging ownership definition, no contradictory guide/arm/cap/inventory instructions. No new simulation feature required yet.

### Step 1 — Packaging/tooling preflight

Implement only reproduced ownership/sidecar/discovery-accounting gaps. Add meaningful failing fixtures before fixes: new NF-04 payload blocked by wrong cap; legacy overgrowth rejected; unknown ownership rejected; NF-04 sidecar does not bloat legacy; integration-only discovery absent without accepted route; integration bytes included; new copy violations caught.

**Exit:** scratch route has a valid source/offline/hosted/integrated build path under all existing caps; historical records remain valid under their version; new sidecar readers reject scope/provenance mutations; offline remains useful. Remove scratch payloads from release output. Publish a measured counter table and explicit deltas. Do not raise limits to make this step pass.

### Step 2 — Model, independent verifier and manifests

Build fixed-chain repeated/cold primary runs, independent verification and canonical records. Implement the fixture matrix, including stale/corrupt input rejection and test-only failure/unfinished projections. Generate selectable-pair manifests and build-time refinement reports. Measure sizes/runtime early.

**Exit:** independently expected grants, boundaries, ledger totals, outcomes and failure reasons pass; mutation tests discriminate; no full record arrays enter the shipped route; the measured package still fits before visual polish. Refinement differences are visible evidence, not silently normalized away.

### Step 3 — First public vertical slice

Build one accepted projection, default guide, exact clock, paired outcomes, selected-request explanations, phone arm view, static/reduced-motion path and the three compact counterexamples. Add actual cancellation, atomic replacement and error/fallback states. Use existing identity and typography.

**Exit:** no stale numbers/captions across presets; same projection powers visual/static explanations; negative and unchanged cases are discoverable; keyboard/mobile interactions pass; numerical source of each displayed measure is traceable. Runtime and physical-device gaps are explicitly reported.

### Step 4 — Integration and reviewable release candidate

Add hosted discovery only when the accepted route exists. Preserve NF-03 as the current first destination unless a separately reviewed learning change is justified. Produce final byte/source/dependency counters, immutable candidate identity, validation report, remaining limitations and rollback plan. Complete human/device checks required for the release claim.

**Exit:** a reviewable candidate with bounded changes and truthful evidence. Deployment follows the existing owner-authorized release process; this document does not itself authorize publication.

### Defer

Preloading and nonempty inventory; extra staggered variants; scheduler-policy comparisons; an optimization solver; additional cities; arbitrary scenario import/editor; public fault injection; mandatory 3D or generated film; runtime generation pinning; broad global navigation/copy/accessibility refactors unrelated to confirmed first-experience defects. Preserve Q1/Q8/N2 as distinct items, not absorbed into NF04-B.

## 10. Implementation guardrails, reproduction and definition of done

### Allowed scope and protected contracts

These are intended scope boundaries, not invented permission to edit every file under a directory. Codex must name exact paths after inspecting current conventions.

| Scope | Allowed changes |
| --- | --- |
| New NF-04 route | `network-flows/software-delivery/` emitted route, with matching source modules in existing model/runtime/UI conventions. Exact source filenames chosen from actual repository structure. |
| Teaching implementation | New NF-04 model, verifier, projection, controller, copy, route styling, fixtures and tests under `playground/fleetlab/`; small declared shared hooks only when needed. |
| Packaging | Relevant `playground/fleetlab/tools/` packer, checker, sidecar, package-proof code and corresponding guards/tests. No blanket policy exception. |
| Hosted integration | `apps/fleetlab-city/hosted/integration.mjs`, its exact counterpart transforms and focused tests required to keep independently reproduced output equal. |
| Documentation | Contract, design, decision log and implementation handoff, with explicit revisions and current evidence. |

Protect NF-03 numerical outputs, input/record contracts and published scientific digests; other model semantics; small offline behavior and reserve; City datasets and source-record qualification state; source-offer and release guard integrity; package/caching boundaries; declared dependency/toolchain pins. Do not install or upgrade dependencies incidentally. Any necessary narrow shared change needs an impact explanation and targeted regression evidence. Do not weaken guards or expand writer/import allowlists broadly to obtain a pass.

### Validation commands

The following are **historical command forms from H**, not commands executed for this review and not proof of a current checkout. Resolve project environments, output directories and the actual committed source identity first. Use pinned project Node/Python versions; H reported Node 22.22.0 and Python 3.11.15. Do not hardcode historical release SHA into a new source proof.

```bash
node --test playground/fleetlab/test/*.test.mjs
node --test apps/fleetlab-city/test/*.test.mjs
python -m unittest discover -s apps/fleetlab-city/tests
node playground/fleetlab/tools/pack.mjs --out OFFLINE_FILE
node playground/fleetlab/tools/pack.mjs --site PACKED_SITE --source-commit SOURCE_COMMIT
node playground/fleetlab/tools/check-dist.mjs OFFLINE_FILE
node playground/fleetlab/tools/check-dist.mjs --site PACKED_SITE
node playground/fleetlab/tools/package-proof.mjs --site PACKED_SITE --playground playground/fleetlab --offline OFFLINE_FILE --source-commit SOURCE_COMMIT --out PACKAGE_DIR
node playground/fleetlab/tools/package-proof.mjs --check-integrated INTEGRATED_SITE --playground playground/fleetlab --source-commit SOURCE_COMMIT
```

Uppercase tokens are placeholders, not literal paths or shell variables. Record actual new focused test commands once files exist. Use the current deployment runbook for the integration recipe and header/readback checks; deployment commands are intentionally not supplied as an instruction to publish. Run broad regression suites when required by repository gates or shared impact, not repeatedly without a concrete reason. Historical test totals remain historical.

### Migration and rollback

There are no shipped NF-04 records to migrate in the reviewed baseline. Verify that remains true. Version changed schema/sidecar semantics; maintain old-reader support where existing consumers require it, otherwise fail explicitly rather than misread. Regenerate derived manifests/receipts from accepted inputs and source; never hand-edit results to match a desired chart.

Keep the last accepted immutable deployment and source identity. If NF-04 fails acceptance, remove its hosted discovery and exclude the new route from the release candidate while preserving the accepted legacy package; rebuild and verify the complete integrated inventory. For a published regression, use the existing runbook’s whole-generation rollback with matching root, headers, archives and sidecars. Do not mix an old root with a new receipt or selectively replace hashed files. Retain source and evidence needed to reproduce both generations.

### Exact definition of done for the first slice

- [ ] Owner-approved scope and document amendments recorded; current source identity is explicit.
- [ ] Reported packaging blockers reproduced or evidenced as already fixed; owner accounting, scoped sidecars and final integration text pass existing hard caps without relabeling legacy payload.
- [ ] Default plus three public presets run both primary arms through the independent verifier; exact analytical fixtures and discriminating mutations pass.
- [ ] Every visible quantitative result traces to the current accepted projection or is clearly labeled a published summary; both records, digests and manifest metrics match before atomic acceptance.
- [ ] Separate WAN/local/unique-artifact accounting, selected versus shared rates, prerequisite causes, raw inclusive deadlines, failures and unfinished outcomes render correctly.
- [ ] Default six-chapter guide is compatible with its accepted case; static equivalents and full-timeline inspection work; no false default narration on another preset.
- [ ] Cancellation actually stops work; obsolete jobs cannot commit; previous accepted results keep their correct labels.
- [ ] Desktop 1440×900, phone 390×844 and narrow 320 px behavior recorded; keyboard, reduced-motion, zoom, screen-reader and physical-device checks are completed or explicitly left open without claiming release closure.
- [ ] Measured package, record and runtime evidence meets the adopted targets; any exception is documented before approval, not hidden by redefining metrics.
- [ ] Human-comprehension tasks completed to the adopted standard before claiming visitor understanding. No implication of safety validation, authenticity or authority.
- [ ] Hosted discovery appears only with the accepted route; offline, NF-03, City and protected contracts are preserved; rollback is reproducible.
- [ ] Handoff distinguishes executed results, document reports, analytical expectations and open checks; no unsupported operator data, endorsement, adoption or deployment claim.

A build may be technically complete while physical-device or human gates remain open. Label it a candidate with those open items; do not mark this complete checklist as passed by an AI review.

## Recommendation

**Proceed with these named amendments, starting with packaging preflight and a precise contract/schema update.** Preserve the numerical design and completed B-lite work. The strongest portfolio result is a small lesson whose mechanisms and limits a visitor can explain: less repeated WAN work, unchanged local work, prerequisite-driven waiting, and a counterexample where earlier fleet completion harms an individual deadline.

## Top risks + mitigations

- **An apparently generous route budget still cannot build** → enforce ownership and sidecar scope in the actual build path; measure complete closures and original-source growth early.
- **An attractive comparison becomes “cache always wins”** → ship unchanged, deadline-failing and individually regressing cases in the same bench; state the target and sharing assumptions.
- **Captions or old results tell the wrong story** → one accepted pair/projection, compatible default guide, explicit pending versus previous setup and atomic acceptance.
- **Verification sounds like real-world authority** → separate consistency, authenticity, safety and permission; use modeled-check language and the human authority probe.
- **Animation or reconstruction fails on real phones** → bounded primary browser work, actual cancellation, accessible static path and measured device checks; do not convert emulation into device evidence.

## Next 3 actions

1. **Codex: reconcile the current checkout and amend C/S/D** using the decisions above; confirm the two packaging blockers and list exact affected paths.
2. **Prove the build path and numerical core** with the scratch ownership tests, independent verifier and unified fixture matrix before spending time on visual polish.
3. **Build and review one learning bench** with the default guide and three counterexamples, then present measured budgets, behavior, comprehension evidence and remaining gaps for release review.
