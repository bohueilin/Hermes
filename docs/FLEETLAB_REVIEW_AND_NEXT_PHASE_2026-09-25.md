# FleetLab / Hermes: project review and next-phase brief

**Prepared for:** Bo-Huei Lin to share with ChatGPT for independent review and product/building ideation.
**Snapshot date:** September 25, 2026 UTC / September 24 Pacific.
**Purpose:** A self-contained account of the project, completed work, design decisions, evidence, limitations and useful next-phase questions. This is a dated review brief; the repository's `HERMES_SOURCE_OF_TRUTH.md` remains its ongoing status record.

## 1. Read this first

FleetLab is an independent, browser-based learning and experimentation playground within the Hermes repository. It explores how fleet supply, demand, geography, depot resources, energy and operational decisions affect service. Its strongest product story is to make a decision inspectable: declare the assumption, change a constraint, run the scenario, follow a vehicle, examine aggregate outcomes and unfinished work, and decide what to test next.

The project combines a polished introductory experience with substantive synthetic simulation. It is not a calibrated digital twin, a commercial fleet management system, a Waymo operations model, a driving stack, or evidence of real-world vehicle safety. No relationship with a fleet operator is claimed.

The latest work improves navigation, reproducibility and interpretation. It does not add a new simulator or change the numerical behavior of the existing models. A separate previous development wave added staffing-aware readiness, charging-policy experiments, resource observations, synthetic airport preparation and depot launch rehearsal.

**Core distinctions to retain during review:**

- Capability is separate from permission, execution, verification, evidence and deployment authority.
- A visually convincing replay is not a validated model or an experiment conclusion.
- A scenario link contains inputs. A completed-run export contains recorded results. Neither authenticates an operational claim.
- Fleet day, Street lab, regional experiments and the Python Hermes evidence systems have different contracts. Their metrics and conclusions are not interchangeable.
- A synthetic result can motivate a next test. It cannot authorize a real fleet change.

## 2. Published release identity

| Release item | Verified value |
|---|---|
| Live website | [FleetLab playground](https://fleetlab-playground.pages.dev/) |
| Immutable deployment | [September 25 design release](https://e72ae87d.fleetlab-playground.pages.dev/) |
| GitHub repository and release branch | [bohueilin/Hermes — feat/fleetlab-playground](https://github.com/bohueilin/Hermes/tree/feat/fleetlab-playground) |
| Deployed application source | [`96fde5b862119c9bbcd7a2ae76450f8dee616f93`](https://github.com/bohueilin/Hermes/commit/96fde5b862119c9bbcd7a2ae76450f8dee616f93) |
| Deployment ID | `e72ae87d-6b96-47a0-950d-4d4a87b8bb95`; Cloudflare Pages Production |
| Source change | `feat(playground): add addressable lessons and reproducible setup sharing`; 28 files, 1,798 insertions, 151 deletions |
| Previous source/deployment | M1–M4 source `7874c7ed1453b97123946b43b153f80a7228088c`, deployment `40858080-b229-44f1-8169-4f8b4faf5c86` |
| Development branch | `codex/fleetlab-m2-m3`; pushed normally to the existing website branch |
| Main branch observed during release | `bca4ccd4d881e58904e59bb1b1ff594442099654`; not changed by this publication |

The owner explicitly authorized both the GitHub push and existing live-site publication. The source commit was pushed, the checked static package was uploaded, Cloudflare reported the matching production commit, and all 84 public files were read back successfully. This review brief and publication records are delivered in a subsequent documentation-only commit; the source hash above identifies the actual website code.

Rollback, if needed, is a separate explicit operation in Cloudflare Pages: select the prior successful Production deployment `40858080-b229-44f1-8169-4f8b4faf5c86`, roll back, then verify the stable URL. No rollback, force push or history rewrite occurred.

The source branch and hosted site are intentionally released independently from main. This publication does not imply that the entire feature branch has been merged into main, that all Hermes tracks were retested, or that the complete repository's Python suite is green.

## 3. The larger Hermes context

Hermes is a simulation-only autonomy and evidence lab. Its canonical thesis is:

> Autonomy policy proposes → environment executes → verifiers evaluate → gate decides → trace proves.

“Trace proves” means the stored trace supports a reproducible, internally consistent decision under the installed implementation. It does not prove independent authenticity, the truth of every producer assertion, real-world safety, compliance, certification or deployment permission.

Historical project records describe an evidence-bundle core, a local read-only evidence review workbench, an ADAS evaluation lane with seeded defective controllers, and a Python fleet-experiment lane. Those are context for FleetLab's methodological discipline, not new deliverables of this website release. The Python fleet lane has a preregistered experiment specification, paired worlds, registered metrics and digest-bound decision records; its broader roadmap remains incomplete. The public playground is a separate teaching surface.

Do not collapse gate verdict, internal consistency, authenticity, authorization and deployment permission into one “trusted” or green state. In the current evidence-workbench contract, authenticity is `NOT_AUTHENTICATED`, authorization is `NOT_EVALUATED`, deployment permission is `NONE`, and scope is `SIMULATION_ONLY`. Browser teaching results are `NOT_EVIDENCE`; the browser does not promote an artifact into that evidence workflow.

## 4. Product users and decisions

These are design hypotheses, not claims of validated customer adoption.

| Intended user | Decision or question | What the current product makes inspectable |
|---|---|---|
| Market operations lead | Is service constrained by fleet size, geography, time away from riders or demand concentration? | Completed, unserved and unfinished requests; waits; vehicle activity; regional availability |
| Depot lead | Is a queue limited by workers, bays, power, usable equipment or policy? | Required tasks, queue/active time, blockers, energy and unfinished work |
| Fleet planning/optimization partner | Does an intervention improve service without moving harm elsewhere? | Shared-demand comparisons, declared treatments, paired uncertainty where supported, guardrails |
| Region/depot launch planner | What happens when configured capacity becomes usable later? | Setup tasks, ownership, resource state, commissioning timeline and one-seed rehearsal outcomes |
| Reviewer or technical decision-maker | Can I understand and reproduce the claim and its limits? | Exact inputs, seeds, model versions, populations, stale-state notices and exports |

The interface is designed to support a short demonstration, then deeper inspection. No operator study, business impact, adoption metric, forecast accuracy or real-fleet throughput improvement has been established.

## 5. Architecture and model boundaries

| Surface | Model / role | Important limits |
|---|---|---|
| Overview and Product approach | Editorial introduction, original concept film, interactive depot explanation, product hypotheses and roadmap | Film and depot illustration are explanatory assets, not recorded simulation evidence |
| Fleet day | Bay Area fleet operations: 18 geographic anchors, route distance, vehicles, demand, weather, energy and serial depot work | One-minute model resolution; synthetic operations; sparse major-road routing; no physical driving |
| Launch rehearsal | Explicit region/site/setup extension of the Fleet day lifecycle | Configured synthetic commissioning, not a real launch system or authorization workflow |
| Street lab | Directed SF/SFO/East Bay network, finite road queues, spillback, pickup and routing comparisons | Five-second replay; synthetic traffic/capacity/signals; no calibrated traffic, lane-changing or energy/depot coupling |
| Regional experiments | Original four-area synthetic model; Learn, Sandbox, preregistered paired A/B and guided walkthrough | Different world and metric contract; no Bay charging/software/upload model |
| Python Hermes/FleetLab | Separate scenario/evidence and fleet experiment systems | No browser result is silently accepted as a Python decision record |

The browser application uses native JavaScript modules, native DOM/CSS and existing rendering code. It has no framework runtime dependency, accounts, database, browser persistence or telemetry. Node is used for tests and static packaging. Python is used for the separate core, compatibility checks and optional local serving, not as a website backend.

The hosted bundle contains static application files, frozen attributed OSM data, and original film/poster media. It makes no application data-fetch calls. The offline single HTML file embeds the application and poster. The regional worker remains separate from the newer model code. Replay projects recorded state rather than rerunning the simulation on each frame.

Packaging enforces constrained content-security policy, URL handling, forbidden code/network APIs, copy rules and size budgets. The live host also supplies its own platform headers; application code itself adds no telemetry.

## 6. What had already been built before this design-review wave

### Regional experimentation and teaching

The original workbench models four named areas with invented geometry and inputs: cars, demand, depots, parking, cleaning/service capacity, routes, congestion, recall, release and assignment rules. It supports a recorded day, Learn cases, a scenario editor and a frozen experiment specification.

A paired experiment declares its question, one variation axis, primary metric and equivalence margin, guardrails, seed set and resampling settings. Outcomes distinguish improvement, regression, unchanged and inconclusive results. Guardrails remain non-compensatory. Its instrument parity with the Python fleet rules is tested; that parity does not imply that the newer Bay or Street worlds are the same model.

The regional casebook includes 20 operational situations plus the original presets. Each explains what its proxy stands for and what the model omits. A guided walkthrough uses one prepared replay and experiment across operations, analytics, simulation and product questions. Prepare computes; later steps inspect recorded outputs.

### Fleet day and geographic replay

Fleet day added 18 city/airport anchors, a frozen attributed OpenStreetMap road extract, native 3D replay, flat/map-table alternatives, city focus, camera controls, car follow, exact-minute and next-activity navigation. Geographic provenance is distinct from synthetic operating values. These routes omit many one-way, turn and access restrictions and are not navigation directions or a verified operator service area.

Users can change fleet size, demand, time, weather, traffic multipliers, patience, selected places, depot resources and vehicle mix. Jaguar I-PACE and Ojai labels correspond to editable teaching profiles for modeled usable battery, energy per distance, charge acceptance, boarding and service-time factors. Ojai is not labeled fictional; its numerical operating assumptions here are illustrative. Neither vehicle label changes road speed or grants a performance claim.

Serial depot work covers scheduled software occupancy, cleaning, charging and upload occupancy. The product reports completed service alongside unserved, waiting and in-progress requests. It distinguishes completed-only means from all-work accounting. Fleet/depot and vehicle-mix comparisons share demand, but adding a depot also adds configured resources and power. The first tested depot count meeting an end-window completion target is not a global optimum or pickup-service guarantee.

### Street lab

Street lab added a frozen directed network with 2,343 road links, supported turn rules, SF bottlenecks and gateway routes toward SFO and the East Bay. Six presets cover the bridge approach, SoMa feeders, Chinatown friction, Van Ness signals, waterfront pressure and Lombard queues.

It supports finite road storage, upstream spillback, route inspection, selected AV activity, pickup dwell, background demand, free-flow versus queue-aware routing and same-demand comparison. Finished and unfinished journey populations remain explicit. A detour can trade completion against empty distance or move a queue elsewhere. Gateways are modeled handoffs, not authorized pickup zones. The Street model has no Fleet day battery/depot lifecycle.

### Original homepage film and product narrative

An original 16-second concept film connects waterfront travel, neighborhoods and depot charging/readiness. The shipped poster and film were retained in this wave. Playback honors existing reduced-motion, Save-Data, visibility and explicit user controls, with a poster fallback. The offline version uses the poster. No new image generation or media re-encoding was part of the current work.

### Depot readiness M1

An explicit opt-in extension adds a finite pool of qualified cleaning workers alongside cleaning bays. It records required work, queued/active/completed task state, worker/bay blockers and unfinished tasks. The comparison isolates an extra worker from an extra bay under identical demand. Deliberately broken defer/skip/cancel policies exercise the checks; they are not recommended operating policies. This comparison is descriptive and one-seed, without an inferred winner or confidence interval.

### Charging and paired evaluation M2

Charging experiments distinguish equal power sharing, capped redistribution and deadline/aged-job priority. Vehicle, port and site constraints remain explicit. The model uses simplified battery-side linear kW, with no taper, losses, tariff or electrical-network model.

The Bay paired contract freezes non-treatment inputs, separates tuning from evaluation seeds, checks producer/version/configuration/population compatibility and exact external demand, and performs a repeatability precheck. Statistical inference operates on paired run-level deltas, not on cars or requests treated as independent samples. Required guardrails cover observed request wait, unfinished visits, terminal fleet energy and rejected actions; airport cases add service guardrails. A primary improvement cannot compensate for a guardrail failure.

### Resource observations and synthetic airport preparation M3

Resource modeling separates fictional physical port truth from planner observations, freshness and exclusive reservations. Unknown, stale and unusable states are not interchangeable. Execution is constrained by usable truth even when a planner's knowledge is stale.

The airport example uses a synthetic passenger pulse and independently published synthetic forecast. Preparation has finite staging capacity, reserve and non-airport service consequences. A dated fictional access rule is a teaching input; no external airport demand feed or curb permission is claimed. Request cohorts and pending deadlines remain explicit.

### Configuration-driven launch rehearsal M4

Launch rehearsal added versioned regions, depots, setup tasks, ownership, dependencies, resource identities and mock commissioning events. Peninsula reuses the Bay geography; Region B uses explicitly fictional geometry. Planned, installed, commissioned, healthy, compatible, reserved and calendar-open conditions remain distinct.

Users can inspect a setup, introduce a defect, validate it, and compare a uniform commissioning delay under the same demand. The timeline and usable-capacity boundaries are checked. Local dates/timezones are labels; there is no DST/calendar conversion. The rehearsal is one-seed, with no invented confidence interval or winner. Operator manual touches and first-pass success remain unavailable until a real usability study measures them.

## 7. The design review and the latest implementation

Bo-Huei supplied Muse AI's website evaluation and first requested an independent audit: identify agreement, specify what to adopt, explain what not to implement, write the full feedback to Markdown, and wait for approval. The audit was completed before implementation. Bo-Huei then said “go,” approving local Packages A–C. A later explicit request authorized the GitHub push and live-site release.

The audit's central judgment was to improve addressability, reproducibility and clarity while preserving the current visual identity, working mobile layout, simulation boundaries and media behavior. It corrected overstatements in the external review rather than treating that document as instructions.

| Recommendation | Decision and implementation |
|---|---|
| Make views and lessons shareable | Adopted: dependency-free hash routes, real links, titles, history and all 56 lesson destinations |
| Fix document hierarchy | Adopted: one active H1/main; embedded brand is non-heading; skip link and focus management |
| Share reproducible scenarios | Adopted with complete per-model configuration/version checks and explicit run control |
| Add result context | Adopted selectively near result groups and in exact disclosures/exports; preserve each model's meaning |
| Explain FleetLab/Hermes and authorship | Added concise relationship copy, restrained author colophon and footer links |
| Clarify illustrative visuals | Added a compact label inside the film; retained the original introduction and caption |
| Call Ojai fictional | Rejected: use accurate vehicle identity with explicit assumed numerical values |
| Redesign mobile navigation | Not taken: existing wrapping navigation worked; new links preserve it |
| Add a renderer/loading watchdog | Not taken: no reproduced need; avoid fabricated timeout behavior |
| Replace/re-encode film | Not taken: current budget, preference handling and fallback already work |
| Rewrite design tokens or overall visual language | Deferred: no evidence justifying that additional change |
| Treat hash routes as SEO/social-preview work | Rejected: unique metadata-bearing entry pages would be a separate task |
| Add cloud saving, analytics, accounts or a general file importer | Not included: separate architectural/product/privacy decisions |

### Routes

Six main views are Overview, Fleet day, Street lab, Experiments, Learning catalog and Product approach. Regional Learn/Sandbox and the guided walkthrough also have direct routes. The same hash format works for the hosted application and offline file. Lesson links are based on the existing catalog IDs, not display titles.

Examples:

- `#/fleet-day?lesson=weather-day`
- `#/street-lab?lesson=street-lombard`
- `#/experiments?lesson=UC-08a`
- `#/fleet-day?lesson=region-launch`

Ordinary navigation retains in-session work. An explicit lesson restores its complete named setup. Opening a route or setup never executes a simulation automatically. Modified/new-tab link behavior remains native. Invalid links show an error and an explicit recovery path.

### Setup sharing

The `fleetlab-setup-v1` envelope carries model, applicable producer/data versions, complete configuration and options. The UI distinguishes current edited inputs from a completed run's inputs and, where supported, the last completed paired experiment. A shared link is a captured snapshot, not a continuously synchronized state or stored result.

Model coverage includes full Fleet day inputs and nested opt-in extensions; Street configuration/network identity; launch site/task/resource/event data and commissioning delay; and regional scenarios plus complete drafts or submitted frozen specifications, including metric scope/direction, thresholds, guardrails, seeds and resamples.

The codec rejects unknown or dangerous keys, unsupported versions, malformed/ambiguous encodings, partial structures, nonfinite values, sparse arrays and excessive size/depth/counts. The link limit is 32,768 encoded characters. Valid setup exports are bounded to 64 KiB JSON; oversized valid links provide a complete JSON download rather than truncation. There is no new general file-import product.

Custom launch owner/label/timezone text, custom regional names/questions and unsupported region identities are refused explicitly. Synthetic template text remains shareable. Sensitive data should not be placed into a URL. Links validate reproducibility prerequisites; they do not establish authenticity.

### Result and state handling

Loading settings pauses playback, cancels pending work where needed, restores controls and marks or removes incompatible old results. It does not rerun an engine. Exact submitted configuration stays attached to the recorded result despite later edits. Details preserve full numbers; missing measurements remain unavailable, not zero.

Fleet day now shows compact model/seed/scope context and exact submitted configuration/metrics. Street shows model/network/seed, `NOT_EVIDENCE` and authority `NONE`, with matching download metadata. Existing launch, paired and regional exact records retain their distinct contracts.

## 8. Important defects found and fixed during the work

1. **Metric-population defaulting:** Removing a regional primary scope previously survived shared-input validation because the downstream validator supplied an empty/global scope. The codec now requires explicit scope and direction for every primary/guardrail reference. Omissions reject before handoff.
2. **Session-dependent launch lesson:** Reopening the launch lesson retained an earlier commissioning delay. Template selection now restores the default 90 minutes; full settings are compared across lesson traversal orders.
3. **Undefined inactive threshold field:** A real regional guardrail edit stored an inactive units field as undefined. The adapter now removes only an explicitly inactive alternative with a valid active counterpart, preserving exact text and the frozen-spec digest. Other undefined data still rejects.
4. **Narrow exact-result overflow:** The Fleet day details element missed its intended class. Correct markup now applies bounded scrolling/wrapping to exact JSON.
5. **Touch target and stacking:** The new disclosure was initially too short and the skip link exceeded the teaching strip's stacking rule. Existing 44px and strip constraints now hold.
6. **Hero links under a noninteractive layer:** Converting buttons to anchors required updating the pointer-interaction selector. The final browser check confirms the main CTA works.
7. **Phone illustration label placement:** The label initially followed the overall hero rather than its media area. It now sits inside the film and is visible over the image.

An independent code review identified the first two issues and the result-details selector problem. Re-review and independent reproductions passed after fixes, with no remaining important findings in that reviewed scope. This is not a claim of exhaustive security assurance.

## 9. Behavioral evidence

| Demonstration | Observation |
|---|---|
| Fleet day default: seed 42, 24 AVs | 95 of 284 completed, 176 unserved, 4 waiting, 9 assigned/in progress |
| Edit fleet to 48 after the default run | Last-run sharing preserves 24; current-input sharing captures 48 |
| Open the 48-AV setup in a fresh tab | Controls restore 48; no result appears until Run |
| Run the restored 48-AV setup | 197 of 284 completed, 66 unserved, 4 waiting, 17 assigned/in progress |
| Street Lombard scenario | 39 of 71 completed, 12 waiting, 20 in progress in its separate model |
| Regional full draft/frozen experiment round trip | Exact scopes, thresholds, seed/resample settings and frozen digest preserved by tests |
| Malformed, mismatched, unsupported or incomplete link | Explicit error; no automatic run or silent default replacement |
| Revisit all 56 lessons in reverse order | Complete effective setups match the original traversal |

These are synthetic model observations with declared populations. They are not estimates of an operator's service quality or vehicle performance, and Fleet day/Street numbers must not be compared as if they measured one common system.

## 10. Validation, public readback and limitations

| Check | Actual result and scope |
|---|---|
| Fresh release Node suite, performance checks enabled | **1,778 passed**, 0 failed/cancelled/skipped, 1 existing TODO; 1,779 total tests, 245 suites, 145.227 seconds |
| Fresh Python playground parity/boundary checks | **89 passed in 5.08 seconds**, against starting commit `cce9fe027a9509e30695c2c741a6c6a406292940` |
| Ruff / whitespace | Passed; source commit staged diff checked before commit |
| Static package | Passed distribution check; 85 files including `_headers`, 3,149,404 bytes |
| Offline single HTML | Passed distribution check; 2,510,896 bytes, within the unchanged 2.5 MiB application budget |
| Public file readback | **84 of 84 SHA-256 matches**, stable production URL versus checked local build; `_headers` verified through response headers |
| Hosted security headers | CSP including `connect-src 'none'` and `frame-ancestors 'none'`; X-Frame-Options DENY, nosniff, no-referrer and same-origin opener policy observed |
| Hosted browser smoke | Homepage CTA; default fleet run; current versus last-run snapshot; fresh-tab restore without autorun; 48-AV explicit run; direct Lombard lesson/run; malformed link/recovery; back/forward titles; visible landmarks |
| Hosted model observations | Fleet day 95/284 and restored 197/284; Street Lombard 39/71, with matching unfinished populations |
| Hosted overview layout | One visible H1/main, 1,265px document width inside a 1,280px viewport; no errors in inspected browser console log |
| Protected paths | No changes to Python core/tests, `pyproject.toml`, `.github`, Makefile or `.gitignore` in this enhancement source change |
| Broader Python suite, implementation-stage run | **1,433 passed, 186 failed, 42 errors, 56 skipped**; retained evidence fixtures absent, including `artifacts/handoff-phase5-demo`; not rerun or claimed green for publication |
| Doctor, implementation-stage run | 17 PASS, 1 dirty-worktree WARN, 1 optional display NOT_AVAILABLE; no FAIL |

The existing Node TODO is a browser-only 400px layout check. It is not counted as passed automation. Actual responsive inspection is recorded separately below. The wider Python gate failure was disclosed before the user authorized publication. This is a scoped static-website release, not an assertion that the full Hermes branch is ready to merge.

Package identifiers:

- Offline HTML SHA-256: `c77b3a2700144469679677fc8148001d7ac0723921618a0df84571df29f1ebd4`.
- Sorted JSON manifest SHA-256 for all 85 static-package files: `fe4998b40ab683fff246733d9717bd3ae54b32282992f592a5a73bbd32b420f9`.
- Original film: 1,079,939 bytes; poster: 32,678 bytes. Both remain unchanged. Existing limits remain 4 MiB for film and 200 KiB for poster.
- Offline size change from M1–M4: +44,846 bytes, approximately 1.8%.

Public-readback qualification: Python urllib requests received Cloudflare error 1010/HTTP 403. Normal browser and curl requests succeeded. The complete final hash comparison used curl without changing server access policy or application code. Cloudflare also supplies its own network-error-reporting headers; the application adds no analytics or telemetry.

Local evidence logs are retained under ignored `artifacts/fleetlab-design-enhancements/`, including `release-node.txt`, `release-python.txt`, `full-pytest-final.txt`, `public-readback.json`, the initial failed-client readback, and `deployment-list.txt`. These generated logs and packages are not committed or included in the site upload. The counts and limitations above are reproduced here so a reviewer does not need those local files.

**Small remaining presentation observation:** The hosted Street selected-vehicle panel at the initial off-road frame exposed a literal `null` text node below its location. Inspection found the optional queue paragraph is passed as `null` directly to native `replaceChildren`. This is a cosmetic follow-up in an existing rendering path; it does not change the simulation totals. It was recorded during publication verification and is not claimed fixed by this release.

Local browser coverage includes six main views at actual widths 320, 390, 768, 1024 and 1440: one visible H1/main and no document horizontal overflow. Phone navigation targets are at least 44px. Expanded exact JSON and setup URLs remain contained at 320px. Browser history, direct lesson entry, fresh-tab setup handoffs, invalid recovery, keyboard navigation/skip, map focus/zoom, hero interaction and illustration labeling were exercised.

The offline package executed over local HTTP and reproduced the Street observation. Direct `file://` testing was blocked by browser URL policy; no bypass was attempted. Existing reduced-motion/Save-Data/visibility/cancellation/poster tests pass, but actual network requests under emulated reduced motion were not measured. No Lighthouse/page-load lab baseline, network/CPU-throttled run, physical-phone, VoiceOver/NVDA, Safari/Firefox or independent browser-zoom validation was performed. Engine/fake-DOM performance checks are not browser paint or page-load measurements.

The broad Python fixture limitation remains material to main integration and repository reproducibility. It does not change the static package's verified bytes, but it prevents a claim that all Hermes gates pass. Retained evidence artifacts were not fabricated, silently repaired or regenerated to hide failures.

No current exhaustive security scan was added in this wave. A previous release's security scan is historical evidence for its own commit range only. Current assurance comes from the scoped independent review, regression/negative tests, protected-path checks, packaging policy and public readback described here.

## 11. Technical map for a reviewer

| Area | Repository path |
|---|---|
| Studio/navigation/learning | `playground/fleetlab/src/ui/studio.js`, `routes.js`, `simulation-catalog.js` |
| Sharing validation and UI | `src/ui/setup-codec.js`, `setup-sharing.js`, `regional-setup.js` under the playground |
| Fleet/Street/launch UI | `operations-lab.js`, `advanced-operations-view.js`, `street-lab.js`, `launch-view.js` |
| Bay model and extensions | `src/model/bay-operations.js`, `depot-readiness.js`, `charging-allocation.js`, `resource-observations.js`, `airport-demand.js`, `bay-systems.js` |
| Paired Bay contract | `src/model/bay-experiment-contract.js` |
| Launch model/contract | `src/model/launch-rehearsal.js`, `launch-contract.js` |
| Street model/data | `src/model/street-simulation.js`, `street-network.js` and attributed map data |
| Regional model and instrument | Existing `src/model/engine.js`, `experiment.js`, schema/presets/metrics, worker/runtime and UI store |
| Distribution checks | `playground/fleetlab/tools/pack.mjs`, `check-dist.mjs`, `media.mjs` |
| Browser application tests | `playground/fleetlab/test/` |
| Cross-system boundaries/parity | `tests/unit/test_fleet_playground_parity.py`, `test_fleet_playground_boundaries.py` |
| Separate Python fleet core | `src/hermes/fleet/` |
| Ongoing status | `HERMES_SOURCE_OF_TRUTH.md` |

Commands from the repository root:

```bash
FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 playground/fleetlab/test/*.test.mjs
node playground/fleetlab/tools/pack.mjs --site dist/site
node playground/fleetlab/tools/check-dist.mjs --site dist/site
node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html
python -m http.server 8767 --bind 127.0.0.1 --directory dist
```

No `npm install` or application backend is needed. Development uses Node 22+; observed validation used Node 22.22.0. Relevant Python checks use Python 3.11 in `hermes-dev`, with the intended checkout selected explicitly. Generated distributions, caches, private environment files and evidence artifacts must remain outside the Git commit and website upload.

The existing Cloudflare Pages project uses Direct Upload rather than native Git deployment. A Git push alone does not publish the site. The release uploads only the checked `dist/site` folder, attaches the exact source commit, reads back public file hashes and verifies response headers. A later documentation-only commit can therefore be newer than the deployed application source.

## 12. Open product and engineering questions

The following are candidate directions for discussion, not approved implementation scope. Avoid selecting a simulator, backend or framework before naming the decision it must improve.

| Candidate direction | User value / question | Evidence needed before building broadly | First bounded slice and limits |
|---|---|---|---|
| Reproducibility and release quality | Can another person clone, test and review the same work reliably? | Fixture provenance/availability, clean-environment checks, release checklist | Restore the approved fixture workflow and document environment selection; preserve evidence contracts |
| Reviewer comprehension and usability | Can a first-time reviewer find the constraint, understand an incomplete result and reproduce a setup? | Observed task completion, errors, time to diagnosis, explanation accuracy | Run a small task-based study; fix demonstrated confusion before a visual rewrite |
| Browser responsiveness | Which actual scenarios cause input/replay stalls? | Page-load and long-task measurements on declared devices and workloads | Profile first; consider worker execution for a measured bottleneck while preserving cancellation and exact outputs |
| Deeper depot realism | Which operational decision is most sensitive to simplified service assumptions? | Sensitivity analysis and a declared comparison question | One extension such as shifts, service-time distributions or charge taper, with explicit versions and regression controls |
| Calibration and validation | Where does the simplified model diverge enough to change a decision? | Authorized data, provenance, held-out comparisons and error envelope | Calibrate one corridor/resource process before making larger geographic or operational claims |
| Street/depot coupling | Is lost service better explained by road delay, energy or depot readiness? | Shared event/population contract and independently verified model interfaces | A separate design spike; do not simply join result tables or compare incompatible metrics |
| Experiment workflow | Which repeated authoring/review task is cumbersome enough to justify new structure? | Reviewer needs, version/compatibility requirements, repeatability evidence | Consider local export/import or experiment comparison only with a clear contract; accounts/cloud saving require separate scope |
| Python/browser relationship | Should browser work remain teaching-only or become an authoring/review client? | Explicit authority and evidence-ingestion design | Keep the current boundary unless a separately approved, versioned bridge demonstrates a real need |

My proposed sequencing for discussion is: establish reliable reproduction and reviewer comprehension, measure actual browser bottlenecks, then select one operational-fidelity experiment. This is a recommendation for review, not a claim that those phases are complete or already authorized.

Avoid a broad “add AI,” universal scheduler, live-data feed or simulator migration as the default next move. If an AI assistant is later proposed, keep it in scenario drafting/explanation and require deterministic validation before execution; it must not enter physical control, replace the gate or grant authority. More simulation fidelity is useful only when it changes the answer to a defined question.

## 13. Suggested prompt to give ChatGPT with this file

> Review this FleetLab/Hermes project as a rigorous technical product and simulation reviewer. Distinguish shipped behavior, recorded observations, historical context, proposed directions and unverified claims. Do not assume you inspected the source or website unless you actually do so.
>
> First identify the strongest product thesis, the intended user/decision, the clearest demo and any misleading or confusing claims. Evaluate model boundaries, metric populations, paired-experiment logic, reproducibility, missing/stale evidence, authority separation, accessibility and developer workflow. For findings, separate confirmed defects from hypotheses and state what evidence would resolve each.
>
> Then propose three credible next-phase options. For each, specify the user problem, smallest useful scope, explicit exclusions, architecture implications, experiment/metric contract, acceptance criteria, validation plan, risks and dependencies. Rank them by decision value and learning, not feature count. Recommend one option and explain the trade-offs; do not combine all three into a large roadmap by default.
>
> Preserve simulation-only scope and current model/evidence boundaries. Do not infer real-world safety, calibration, operator performance, affiliation, deployment permission or adoption. Do not assume a backend, accounts, live feed, new simulator or AI agent is necessary. Flag the missing full-repository fixture gate and unsupported browser/performance measurements explicitly.
>
> End with a concise Recommendation, Top risks + mitigations, and Next 3 actions. Produce a concrete design proposal for owner review before any new implementation.

## 14. Reference documents

The repository documents provide the deeper contracts; this brief is sufficient to begin the review without local-file access.

- `HERMES_SOURCE_OF_TRUTH.md`: dated status across tracks and known core fixture/environment issues.
- `docs/FLEETLAB_DESIGN_ENHANCEMENTS_HANDOFF_2026-09-24.md`: pre-publication implementation and validation details for this wave.
- `docs/FLEETLAB_DEPOT_RELEASE_2026-09-24.md`: previous M1–M4 publication and historical security coverage.
- `docs/FLEETLAB_DEPOT_READINESS.md`: required work, staffing and descriptive comparison contract.
- `docs/FLEETLAB_DEPOT_M2_M3.md`: charging/resource/airport semantics, metric populations and paired comparisons.
- `docs/FLEETLAB_DEPOT_LAUNCH.md`: versioned setup and commissioning rehearsal contract.
- `docs/FLEETLAB_STREET_LAB.md`, `FLEETLAB_STREET_MAP_DATA.md`: Street scope and source data.
- `docs/FLEETLAB_BAY_AREA_MAP_DATA.md`, `FLEETLAB_VEHICLE_PROFILES.md`: geography and operating assumptions.
- `docs/FLEETLAB_HOMEPAGE_FILM.md`: original media rationale and playback boundaries.
- `docs/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md`: exact publication and rollback procedure.
- `docs/FLEETLAB_REPOSITORY_RECOMMENDATION.md`: separate website release path and main-integration conditions.

## 15. Complete current lesson inventory

Generated from the checked application's registry rather than reconstructed from older documentation. There are 56 entries: 18 Fleet day (including operational extensions and launch rehearsal), six Street lab and 32 regional lessons.

| ID | Family | Lesson | Direct link |
|---|---|---|---|
| bay-area | Fleet day | Real Bay Area routes in 3D | [Open](https://fleetlab-playground.pages.dev/#/fleet-day?lesson=bay-area) |
| vehicle-mix | Fleet day | I-PACE versus Ojai assumptions | [Open](https://fleetlab-playground.pages.dev/#/fleet-day?lesson=vehicle-mix) |
| fleet-day | Fleet day | Fleet size versus trip demand | [Open](https://fleetlab-playground.pages.dev/#/fleet-day?lesson=fleet-day) |
| weather-day | Fleet day | Rain and hot-weather service | [Open](https://fleetlab-playground.pages.dev/#/fleet-day?lesson=weather-day) |
| rush-hour | Fleet day | Morning and evening peaks | [Open](https://fleetlab-playground.pages.dev/#/fleet-day?lesson=rush-hour) |
| depot-count | Fleet day | How many depots are sufficient? | [Open](https://fleetlab-playground.pages.dev/#/fleet-day?lesson=depot-count) |
| cleaning | Fleet day | Cleaning capacity and queues | [Open](https://fleetlab-playground.pages.dev/#/fleet-day?lesson=cleaning) |
| charging | Fleet day | Battery and charging constraints | [Open](https://fleetlab-playground.pages.dev/#/fleet-day?lesson=charging) |
| shared-power | Fleet day | Charge ports versus site power | [Open](https://fleetlab-playground.pages.dev/#/fleet-day?lesson=shared-power) |
| software | Fleet day | Software-update scheduling | [Open](https://fleetlab-playground.pages.dev/#/fleet-day?lesson=software) |
| upload | Fleet day | Trip-data transfer bottlenecks | [Open](https://fleetlab-playground.pages.dev/#/fleet-day?lesson=upload) |
| full-cycle | Fleet day | Follow a car through its day | [Open](https://fleetlab-playground.pages.dev/#/fleet-day?lesson=full-cycle) |
| staffing-readiness | Fleet day | Staffing: workers versus bays | [Open](https://fleetlab-playground.pages.dev/#/fleet-day?lesson=staffing-readiness) |
| power-redistribution | Fleet day | Use acceptance-limited power shares | [Open](https://fleetlab-playground.pages.dev/#/fleet-day?lesson=power-redistribution) |
| deadline-charging | Fleet day | Prioritize readiness deadlines | [Open](https://fleetlab-playground.pages.dev/#/fleet-day?lesson=deadline-charging) |
| resource-freshness | Fleet day | Stale resource status and recovery | [Open](https://fleetlab-playground.pages.dev/#/fleet-day?lesson=resource-freshness) |
| airport-preparation | Fleet day | Prepare for a synthetic airport wave | [Open](https://fleetlab-playground.pages.dev/#/fleet-day?lesson=airport-preparation) |
| region-launch | Fleet day | Rehearse commissioning in Region B | [Open](https://fleetlab-playground.pages.dev/#/fleet-day?lesson=region-launch) |
| street-first | Street lab | Bridge rush | [Open](https://fleetlab-playground.pages.dev/#/street-lab?lesson=street-first) |
| street-harrison | Street lab | SoMa ramp feeders | [Open](https://fleetlab-playground.pages.dev/#/street-lab?lesson=street-harrison) |
| street-stockton | Street lab | Chinatown friction | [Open](https://fleetlab-playground.pages.dev/#/street-lab?lesson=street-stockton) |
| street-van-ness | Street lab | Van Ness signals | [Open](https://fleetlab-playground.pages.dev/#/street-lab?lesson=street-van-ness) |
| street-embarcadero | Street lab | Waterfront event | [Open](https://fleetlab-playground.pages.dev/#/street-lab?lesson=street-embarcadero) |
| street-lombard | Street lab | Lombard visitor queue | [Open](https://fleetlab-playground.pages.dev/#/street-lab?lesson=street-lombard) |
| bay_teaching_map | Regional experiments | Bay teaching map | [Open](https://fleetlab-playground.pages.dev/#/regional?lesson=bay_teaching_map) |
| L1 | Regional experiments | Peak and off-peak with the same fleet | [Open](https://fleetlab-playground.pages.dev/#/regional?lesson=L1) |
| L2a | Regional experiments | Bays are not always the bottleneck | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=L2a) |
| L2b | Regional experiments | Bays are not always the bottleneck, with a bay wait guardrail | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=L2b) |
| L3 | Regional experiments | Evening depot visit in San Jose | [Open](https://fleetlab-playground.pages.dev/#/regional?lesson=L3) |
| UC-01 | Regional experiments | Null check | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=UC-01) |
| UC-02 | Regional experiments | How many cars does San Jose need? | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=UC-02) |
| UC-03 | Regional experiments | Rider patience and the population trap | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=UC-03) |
| UC-05 | Regional experiments | End-of-day highway slowdown | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=UC-05) |
| UC-08a | Regional experiments | Depot throughput: more cleaning bays at SF-1 | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=UC-08a) |
| UC-08b | Regional experiments | Depot throughput: a shorter clean | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=UC-08b) |
| UC-10 | Regional experiments | Pool the bays or spread them? | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=UC-10) |
| OPS-01 | Regional experiments | Evening crunch: more cars in San Francisco | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=OPS-01) |
| OPS-02 | Regional experiments | Late night recall: 00:30 or 02:00 | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=OPS-02) |
| OPS-03 | Regional experiments | Defer depot visits through the evening peak | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=OPS-03) |
| OPS-04 | Regional experiments | Release cars to home areas earlier | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=OPS-04) |
| OPS-05 | Regional experiments | Launch fleet size with a 12 stall depot | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=OPS-05) |
| OPS-06 | Regional experiments | Launch demand above plan | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=OPS-06) |
| OPS-07 | Regional experiments | One cleaning bay or three at the launch depot | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=OPS-07) |
| OPS-08 | Regional experiments | Launch lot overflow: nearest depot with a free stall | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=OPS-08) |
| OPS-09 | Regional experiments | Rain: slower curbside pickups in San Francisco | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=OPS-09) |
| OPS-10 | Regional experiments | Rain: more cars for San Francisco | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=OPS-10) |
| OPS-11 | Regional experiments | Rain: wet interiors and 30 minute cleans | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=OPS-11) |
| OPS-12 | Regional experiments | Rain: add bays where the queue reaches riders | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=OPS-12) |
| OPS-13 | Regional experiments | Crowded curbs slow every downtown pickup | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=OPS-13) |
| OPS-14 | Regional experiments | An event lets out in San Francisco | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=OPS-14) |
| OPS-15 | Regional experiments | The neighbour adds cars for an event next door | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=OPS-15) |
| OPS-16 | Regional experiments | Streets full of people in the evening peak | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=OPS-16) |
| OPS-17 | Regional experiments | Highway closure between SF and the Peninsula | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=OPS-17) |
| OPS-18 | Regional experiments | Cars held at incident scenes in San Francisco | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=OPS-18) |
| OPS-19 | Regional experiments | A service check every second depot visit | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=OPS-19) |
| OPS-20 | Regional experiments | A staging area on two thirds of the SF-1 lot | [Open](https://fleetlab-playground.pages.dev/#/experiments?lesson=OPS-20) |

## Recommendation

Use this release as the review baseline. Have ChatGPT challenge the claims, reproduction contract and usability, then choose one bounded next phase with explicit acceptance criteria. Preserve the current clear separation between teaching simulations and authority-bearing evidence systems.

## Top risks + mitigations

- **Visual polish mistaken for validation:** Keep synthetic assumptions, metric populations, unfinished work and model limits adjacent to results.
- **Configuration or version drift:** Preserve complete immutable snapshots, strict compatibility checks, negative tests and exact submitted records.
- **Unreproducible wider repository:** Resolve retained-fixture and environment provenance before claiming a fully green Hermes checkout or merging the entire branch.
- **Premature scope expansion:** Start each proposed phase with one user decision and its cheapest sufficient fidelity; require separate design approval for new data, coupling or authority.
- **Unmeasured usability/performance:** Test declared tasks and devices; do not substitute model timing or subjective polish for those measurements.

## Next 3 actions

1. Review the live release and use this file as the context package for ChatGPT.
2. Turn the review into a prioritized list of confirmed issues, missing measurements and one recommended next-phase design.
3. Approve a bounded implementation plan with objective checks before beginning new project-building work.
