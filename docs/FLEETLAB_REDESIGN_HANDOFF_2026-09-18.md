# FleetLab experience redesign handoff

Historical snapshot. The later [operational extension handoff](FLEETLAB_OPERATIONS_HANDOFF_2026-09-19.md) supersedes the presentation-only scope and model-absence statements below.

Date: 2026-09-18. This adapts `CODEX_HANDOFF_TEMPLATE.md` to the owner-requested playground presentation wave. Phase 6 review-envelope fields are explicitly not applicable to this work.

## 1. Outcome and repository snapshot

- Completed: source-tree/product audit, public research synthesis, website redesign, responsive browser inspection, local distributions and role-specific demonstration narrative.
- Recommendation: ready for local design review and a comprehension study. The repository-wide Python gate remains incomplete; no commit or publication was performed.
- Worktree: `/Users/bohueilin/Documents/GitHub/Hermes-playground`.
- Branch: `feat/fleetlab-playground`.
- Starting and ending HEAD: `fb07b66ddaa786020f2176efdb82727bd55c5d4b`.
- Starting worktree: clean. Ending worktree: intentional uncommitted source, test and documentation changes.
- The initial task directory, `Hermes-fleetlab`, was on `feat/phase9-metric-contract` at `9daacef2675873cb78017e1ec2387f66b7560fa6`; it was left unchanged.
- Package: `hermes-autonomy` 0.1.0. Python: 3.11.15. MetaDrive: 0.4.3, source `85e5dadc6c7436d324348f6e3d8f8e680c06b4db`, clean.
- Remote actions, pushes, PRs, deployments and commits: none. The supplied public URL still serves its previous version.

## 2. Product boundary and design decisions

This static playground executes only its existing synthetic fleet model, in the browser, on explicit Run/Prepare. It does not execute Hermes evidence review, ingest operational data, control hardware or authorize operational changes. The overview illustration has no computed run values. No simulator/model, metric or recommendation algorithm changed.

| Decision | Implemented choice |
|---|---|
| Experience | Decision-led overview; Fleet operations; Depot experiments; Product approach |
| Visual explanation | Interactive conceptual depot SVG plus existing run-derived Canvas/SVG replay |
| Framework | Existing plain ES modules and DOM; no new dependency |
| Styling | Warm light surfaces, forest palette, responsive layouts, tested contrast tokens |
| First action | Guided walkthrough; Prepare explicitly computes the existing case |
| Capacity entry | Existing UC-08a, initialized once; explicit reset; navigation retains work |
| Presentation | Controls precede the stage in DOM and visual order; bounded desktop ledger; phone controls scroll horizontally |
| Scope disclosure | Synthetic inputs; fixed-demand uncertainty; unmodeled energy/staffing; no calibrated-twin claim |
| Remote services | None; original CSP and network restrictions retained |
| Evidence contracts | No new bundle contract, ReviewEnvelope or ComparisonEnvelope; Phase 6 unchanged |

Design details and instruction reconciliation: [experience plan](plans/2026-09-18-fleetlab-experience-redesign.md).

## 3. Architecture and files

```text
Decision-oriented studio navigation
  → existing store / presenter / experiment setup
  → explicit execution through existing runtime host
  → existing model + instrument outputs
  → existing charts, inspector and verdict projections
```

The separate conceptual depot explanation never consumes model state. The new shell does not parse evidence artifacts or compute a metric. Development, hosted and single-file entry points all enable the same shell.

| Area | Files / purpose |
|---|---|
| New UI | `src/ui/studio.js`, `src/ui/depot-scene.js` |
| Integration | `src/ui/app.js`, `index.html`, `tools/pack.mjs` |
| Presentation | `styles.css`, `src/ui/map.js`, `src/ui/labels.js` |
| Checks | `test/studio.test.mjs`, `test/app.test.mjs`, `test/a11y.test.mjs`, `test/pack.test.mjs`, `tools/check-dist.mjs` |
| Documentation | README, architecture amendment, root handoff pointer, audit, design plan, this handoff |

Paths in the table are relative to `playground/fleetlab/` except the root documentation. There are no changes under Python `src/hermes`, playground `src/model`, `src/core`, `src/instrument` or `src/runtime`.

## 4. Trust and numeric semantics

Two existing UI claims were corrected: an accepted allowance does not mean a guardrail suffered no harm; no crossed allowance does not mean a run “trades nothing.” Copy now refers to **evaluated** guardrails exceeding their limits and directs readers to deltas and unavailable results.

The inherited instrument still skips unavailable guardrails. Its existing missing-result notice remains. This wave does not silently change that algorithm. The audit recommends a separately versioned sufficiency policy if the owner wants different semantics.

Playground recommendations such as HOLD and NO_RECOMMENDATION are teaching outcomes, not Phase 6 review verdicts or deployment authority. No authenticity, signed evidence, operational approval, optimality or real-world safety claim is introduced. No winner score is added. Exact values, units, scopes, intervals and frozen specification details remain in the existing views.

## 5. Commands and observed results

Commands ran from the target worktree. The local isolated environment was created with the existing Python 3.11 interpreter and system site packages so the shared development environment was not reinstalled.

| Command / check | Result |
|---|---|
| `/tmp/hermes-fleetlab-redesign-venv/bin/python -m pip install -e '.[dev,workbench]'` | Passed |
| `node --test 'playground/fleetlab/test/*.test.mjs'` | **1,478 passed, 0 failed, 2 skipped, 1 TODO**; 1,481 total |
| `FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 /tmp/hermes-fleetlab-redesign-venv/bin/python -m pytest -q tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py` | **89 passed** |
| `python -m ruff check .` using the existing development interpreter | Passed |
| `PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 python -m hermes doctor` after activating `hermes-dev` | **17 PASS, 1 WARN, 1 optional NOT_AVAILABLE**; warning is intentional dirty tree |
| `git diff --check` | Passed |
| `node playground/fleetlab/tools/pack.mjs --site dist/site` | Passed: 47 files, 1,118,084 bytes |
| `node playground/fleetlab/tools/check-dist.mjs --site dist/site` | Passed: file inventory, policy, URLs, tokens, copy and labels |
| `node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html` | Passed: 1,537,748 bytes, below 2 MB limit |
| `node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html` | Passed |
| Baseline broad `PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -m 'not metadrive'` | **186 failed, 1,433 passed, 1 skipped, 55 deselected, 42 errors** |
| Unfiltered `python -m pytest -q` | Not run; the broad non-MetaDrive gate already fails, and no driving-simulator implementation changed |

The broader failures include missing ignored historical bundles such as `artifacts/handoff-phase5-demo`, `handoff-p1-nominal`, and Phase 3/4 comparison/fault bundles. No bundle was synthesized or repaired to make these tests pass. This is a negative validation result, not a claim that every broad failure has been independently triaged.

An initial invocation resolved the installed package from the other checkout and failed collection; explicit `PYTHONPATH` corrected that. The required editable install also generated ignored `src/hermes_autonomy.egg-info`, which caused a source-boundary scan to see README text as Python source. That newly generated metadata was moved to `/tmp/hermes-fleetlab-redesign-generated-egg-info`; the unchanged boundary tests then passed. No test exception was added.

Accessibility tests now evaluate the final cascading palette rather than historical color snapshots. Text and non-text contrast thresholds remain enforced. Existing motion, keyboard, table alternatives, numeric details and invalid-state tests remain. Human assistive-technology validation is not claimed.

Logs are copied into ignored `artifacts/fleetlab-redesign-review/`. The JavaScript baseline before this wave was 1,475 passing, 0 failing, 2 skipped, 1 TODO.

## 6. Browser verification and demonstrations

Inspected the original public site and the redesigned local source. Tested desktop, 768-pixel tablet, 390-pixel phone and 320-pixel narrow-phone viewport settings. The document had no horizontal overflow at the tested narrow sizes; wide data tables and the phone presentation rail retain their own scrolling.

Verified stage selection, all four navigation destinations, draft preservation, explicit capacity reset, all four guided chapters, presenter exit synchronization, and a computed capacity experiment. The final desktop ledger stayed bounded at 620 pixels in the observed viewport; the long verdict no longer stretches the map to more than 3,000 pixels. Controls remain above the stage and retain keyboard focus across Next.

| Computed example | Actual observation |
|---|---|
| UC-08a, four versus six cleaning bays | `playground-spec:34d504c1`; UNCHANGED / NO_RECOMMENDATION; wait p90 mean delta approximately −3.4 seconds; 95% interval approximately −10.2 to +0.4 seconds; equivalence margin ±30 seconds |
| OPS-01, more SF fleet supply | `playground-spec:089edeff`; IMPROVED primary / HOLD recommendation; SF evening wait mean delta approximately −1,565.6 seconds; SF-2 first-task delay harm approximately +2,364.4 seconds versus 1,800-second allowance |

These are synthetic computed observations. They are not calibrated operational outcomes. Twenty paired seeds vary travel/ride factors on one fixed demand trace. Neither result claims a global optimum.

The single-file distribution was also opened in the browser and its capacity example executed. It produced the same specification and outcome. The hosted folder opened the redesigned overview. Browser warning/error logs were empty during the checked flows. Packaging checks establish a self-contained distribution; a manually disconnected network session was not tested.

Saved screenshots: `overview-desktop.png`, `overview-mobile.png`, `depot-experiment.png`, `guided-verdict.png`, `guided-mobile.png`, `product-approach.png` under `artifacts/fleetlab-redesign-review/`. Screenshots are design QA artifacts, not Hermes decision evidence.

## 7. Distribution digests

SHA-256 binds these local outputs to the reviewed version; it is not a signature or authenticity claim.

| File | SHA-256 |
|---|---|
| `dist/fleetlab-playground.html` | `f99dfdc04c9de4ddae20a83192c131af5d52a000933f88bf6f0c4c07f00eaa08` |
| `dist/site/index.html` | `35676dbe3efed026f9ea5130876c5b51e544f0b58a3d1e9afb4c5fd2af2bdcfd` |
| `dist/site/styles.css` | `daa26539cdfdababfec341044b995b0aafa2e5e18f160200fc9069ec74d6fb80` |
| `dist/site/src/ui/studio.js` | `06c3a2f45cd5c87f7e69816c671e2eb73ece39577f0d2eb3d94fbf279b450685` |
| `dist/site/src/ui/depot-scene.js` | `485c86a03726e31bbbab62bf28e1780f28ff6200c65bc3015f383d163f46b961` |

No canonical review bundles were modified, and no artifact review, signing, approval or promotion feature was added. Review-envelope demos, bundle/trace digests and Phase 6 comparison demonstrations are not applicable to this presentation wave.

## 8. Independent review and residual limitations

A separate reviewer audited source semantics and then re-reviewed navigation, readiness copy, contrast and the written audit. Initial issues were fixed: draft reset on navigation, misleading static depot title, presenter exit synchronization, readiness/release wording, insufficient note contrast and overbroad guardrail language. Final bounded re-review reported no remaining blockers and 37 targeted tests passing. A later browser-only layout finding was fixed and rechecked locally.

This is not a completed security audit, usability study or proof of accessibility. Known model gaps remain: independent demand-day variation, stage-complete delay metrics, charging/SOC/site power, labor and shifts, inspection/readiness rules, validated geography/service distributions, calibrated operational inputs, a solver and an external depot commissioning API.

No RL, CARLA, ROS, Autoware, cloud backend, vehicle/hardware connection, model-in-control-loop, signing, account system or telemetry was added.

## 9. Local preview

The source preview was served on loopback port 8766; the final distributions on loopback port 8767.

```bash
python3 -m http.server 8767 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8767/site/` for the hosted-folder preview, or `http://127.0.0.1:8767/fleetlab-playground.html` for the single-file distribution. This starts no remote deployment. The HTML can also be shared as a local artifact after review.

## Recommendation

Use this as a product and simulation case study. Lead with the operational question and show the mixed or unchanged result before discussing the roadmap. The [full audit](FLEETLAB_DESIGN_AUDIT_2026-09-18.md) includes role evidence, genuine gaps, a 20-second narrative and a six-minute demonstration.

## Top risks and mitigations

- A polished visual may imply excessive fidelity: keep synthetic scope, missing resources and conditional uncertainty visible.
- Technical QA is not comprehension evidence: conduct the proposed task-based study with unfamiliar visitors and operators.
- Repository-wide validation remains incomplete: restore or explicitly resolve the historical fixture prerequisites in a separate evidence-maintenance task before claiming a green full suite.

## Next three actions

1. Review the local design and rehearse the two computed trade-off examples.
2. Test comprehension with five unfamiliar visitors; record misconceptions and revise before publication.
3. Define the next model wave around independent demand variation, stage-level depot metrics and one bounded charging/readiness question.
