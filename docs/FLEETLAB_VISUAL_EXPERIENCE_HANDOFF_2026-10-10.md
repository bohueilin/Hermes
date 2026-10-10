# FleetLab visual experience implementation handoff

October 10, 2026 · Educational website release

**Released:** implemented, validated, pushed to GitHub and published at [FleetLab](https://fleetlab.pages.dev/). [Open the capacity study](https://fleetlab.pages.dev/network-flows/capacity/). Preview and production each matched all 10,036 served files and all ten header checks. The original site content remains available.

## Scope and authority

The owner explicitly requested reading the October 10 visual brief, building, validating, pushing to the repository and launching the site. This authorizes this educational-site publication despite the generic no-push/no-publication rule in AGENTS.md §19. It does not authorize physical operations, account changes or release of autonomy software.

Implemented the brief's **first vertical slice, stages 0–2**: integrate the existing website redesign and NF-03, improve welcome/discovery, make the capacity study visually understandable, fix stale lesson announcements and bind the hosted release to reviewed source. NF-04 is the brief's separate follow-on and is specified in `FLEETLAB_NETWORK_FLOWS_NEXT_DESIGN_SPEC_2026-10-10.md`. No new city or held SF experiment was started.

The worktree began on `codex/fleetlab-city-sf` at `1df2e362f37ab68af0441ec5baadccc3376204b9`. Inspection confirmed the Fable capacity/redesign branch was a descendant; it was integrated with `git merge --ff-only claude/fleetlab-depot-capacity-study` to `629892982bc1b0945eaba929b9a8eeb0021d1ea7`. Existing untracked design documents were preserved. No reset, force push or historical rewrite occurred.

## What changed for visitors

- **A clearer welcome.** “What keeps an autonomous fleet ready?” introduces concrete operational questions. Independent authorship by Bo-Huei Lin appears beside the introduction. Network Flows is the primary hosted destination; the optional film and broader learning paths remain available.
- **Easier discovery.** Home / Explore / About & limits remain the three global destinations. Explore features the capacity, readiness and scheduling questions ahead of the complete 61-lesson library. City Explorer remains accessible. Fleet day, Street lab, Scale lab, saved setup links and other existing routes remain intact.
- **A usable first action.** NF-03 starts with a question, short simulation scope, a static system preview and **Load fixed comparison**. Copy explains that loading reconstructs and verifies the fixed study. Optional assumptions and setup changes are disclosures. A View comparison link takes the visitor to playback after loading.
- **A record-driven resource bench.** Twelve parked symbols show recorded task state; upload and energy have separate channels. Quantitative bars share exact physical scales. A common clock, vehicle selector and wait explanation connect the animation to required upload, battery and local work. Motion conveys transfer direction, never packet count or driving routes.
- **Real comparisons on small screens.** Desktop shows both arms. Phone layouts switch one visible arm while retaining the same clock, vehicle and both final outcomes. Improving, regressing and unchanged examples, difference jumps and exact tables remain available.
- **Honest result state.** Edits pause playback and cancel stale loads. Accepted results retain their old setup identity until a complete new comparison passes verification. Rejected or cancelled candidates do not replace them. Returning through the browser's cached page does not leave a false “Reconstructing” message.
- **Accessible controls.** Explicit Play/Pause, restart, previous/next event, scrubber and speed controls; keyboard-accessible controls and disclosures; reduced-motion stepping; pause on hidden/navigation. New bench labels are at least 14 px and main prose is around 18 px.
- **Correct announcement lifecycle.** Switching NF-01/NF-02 clears old live-region text and stops the outgoing player silently. Late callbacks cannot announce the old lesson.

## Numeric and evidence integrity

The fixed NF-03 model, verifier, scientific manifest, workloads and accepted record identities were not modified. It is a constructed study, not 72 independent stochastic replications and not an optimality claim. The presentation projection is versioned `depot-capacity-projection/1.1.0`.

Previous timeline bars used a minimum height that could be mistaken for proportional rate. They now encode duration with constant-height task marks. Exact instantaneous upload and energy quantities use common-scale meters; exact merged average rates remain in tables. Playback, seeking, selecting and resizing do not invoke the engine or change records.

The source-bound `network-flows/capacity/release.json` is a separate, non-self-referential packaging sidecar. It binds the source commit/tree, source/build-tool fingerprints, scientific identities, runtime/tool versions and emitted teaching payloads. The scientific manifest's historical null source commit is retained. Uncommitted development builds declare modified source; a final source-commit build fails on a mismatch. Three integration-owned root files are excluded from the teaching emitted-payload list because integration rewrites them; the whole-site integration manifest and hosted readback cover those final bytes.

An independent review found that resealing a changed capacity HTML body could initially pass source checks. The fix shares the deterministic source-to-page transform and binds it into the sidecar. Both package checks and integration now reject the resealed mutation. Self-consistency alone is not called authenticity: the site remains simulation-only, not authenticated operator evidence, with no operational deployment permission.

SF current City release remains `c56bda6b509105c5` and compatible rollback remains `e3318a76588a7403`. Map/source and human qualification remain open; publication of educational UI does not clear them. No model or City recording regeneration was performed.

## Validation and failures resolved

The pre-edit integrated baseline passed **2,127 Node tests**, with zero failures, eight existing skips and one TODO. Fresh feature tests first reproduced stale route announcements, pending-setup confusion and missing presentation/provenance behavior before fixes.

Intermediate full-suite failures were recorded, not hidden: new responsive card CSS tripped the existing fixed-width guard, and media-test fixtures lacked the newly required hosted stylesheet. The CSS now uses explicit responsive columns; fixtures now supply the actual required package inputs without relaxing media checks. An initial local integration invocation selected the 98-file hosted readback payload rather than the original 99-file distribution containing `_headers`; the correct preserved distribution was selected and verified. The real integration also exposed the missing allowlist entry for Fable’s already-reviewed explicit-play film change; that one path was declared with a rejection-without-flow-update regression. A development package built before final source edits was correctly rejected for mismatched fingerprints and rebuilt. No scientific protocol retry was involved.

Final measured results, browser observations and release identities are recorded below. Logs, screenshots, full inventories and generated packages stay in ignored local validation storage.

### Reproducible commands

Run from the repository root with Node 22.22.0, the existing Python 3.11 `hermes-dev` environment and the locked City environment:

```sh
node --test playground/fleetlab/test/*.test.mjs
node --test apps/fleetlab-city/test/*.test.mjs
build/fleetlab-city/venv/bin/python -m unittest discover -s apps/fleetlab-city/tests
PYTHONPATH=src FLEET_PLAYGROUND_BASE=bca4ccd conda run -n hermes-dev python -m pytest -q
conda run -n hermes-dev python -m ruff check .
PYTHONPATH=src conda run -n hermes-dev python -m hermes doctor
node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-visual-oct10/offline.html
node playground/fleetlab/tools/pack.mjs --site dist/fleetlab-visual-oct10/root --source-commit SOURCE_COMMIT
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-visual-oct10/offline.html
node playground/fleetlab/tools/check-dist.mjs --site dist/fleetlab-visual-oct10/root
npm --prefix apps/fleetlab-city/deploy ci --ignore-scripts
npm --prefix apps/fleetlab-city/deploy audit --omit=dev
npm --prefix apps/fleetlab-city/deploy audit signatures
npm --prefix apps/fleetlab-city audit --omit=dev
git diff --check
```

`SOURCE_COMMIT` is the full reviewed source commit in the final receipt, not a literal command argument. Integration uses `integrate-site.py` with the verified original root/readback, current City viewer, sanitized rollback, source offer, packed client, offline file, `--flow-update` and the same `--source-commit`. The publication runbook documents the pinned uploader, exact permitted preview/production branch labels and full served-byte/header checks. No `npx` resolution or dependency upgrade was used.

### Final acceptance record

| Gate | Fresh result |
|---|---|
| Teaching Node suite | 2,150 passed; 0 failed; 8 existing skips; 1 TODO |
| City Node suite | 66 passed |
| City Python suite | 329 passed; subsequent focused integration suite 19 passed after one new allowlist test |
| Hermes suite with boundary base | 1,662 passed; 55 skips |
| Ruff / diff whitespace | Passed |
| Doctor in activated environment | Clean source checkout: 18 PASS, 1 optional NOT_AVAILABLE, no WARN or FAIL |
| Deployment dependency audit | 0 reported vulnerabilities; 38 registry signatures and 22 attestations verified |
| Map dependency audit | 0 reported vulnerabilities |
| Offline | 2,545,778 B; 75,662 B under cap; 25,662 B beyond the reserved 50,000 B |
| Hosted teaching package | 121 files, 3,711,334 B from committed source |
| New bench / route stylesheet | 10,090 B / 11,930 B; excluded from offline |
| City preservation | All 9,908 City/source-offer files unchanged against prior published package |
| Independent code review | Two findings fixed and rechecked; no open findings in the reviewed patch |

Browser QA observed painted desktop and phone layouts, 1440×900, 1024×768, 375×812 and 320 px width, shared-time arm switching, keyboard scrubbing, explicit Play/Pause, improving/regressing inspection, catalog discovery, deep links, refresh/history and the NF-01/NF-02 announcement lifecycle. No page overflow was observed at the tested widths. The default phone Load button was visible in the first viewport. Initial Home video has no media src until explicit play. Unit tests cover reduced/hidden motion, invalid record rejection, cancellation and late callbacks. The hosted preview also retained City Explorer and its atlas. Native screen-reader, system reduced-motion and physical-phone performance measurements remain unperformed this turn. A browser zoom shortcut did not change the measured viewport or font size; native browser 200% text enlargement is not claimed as tested. An isolated local CSS `zoom:2` fixture did load the comparison without page overflow at 1440 px; this is a rendered enlargement check, not a native-browser setting or a WCAG certification. The browser policy refused `file://` navigation, so offline file-origin behavior was not tested; no workaround was attempted. The package content/CSP/size checks passed.

### Publication receipt

| Item | Observed value |
|---|---|
| Source commit | `35c687e4bb96eb610bd4f8aa1d7f538876edb12d` |
| Source branch | `codex/fleetlab-city-sf`, pushed to the existing Hermes GitHub remote |
| Production deployment | `c40d90b5-65aa-40ce-828b-5c0b5d4328d9` |
| Preview deployment | `be1826b2-98a5-45f6-a8e5-7360e6188514` |
| Prior production retained | `c98eb10c-1726-4005-80c4-9bfea6e44be2` |
| Immutable production | https://c40d90b5.fleetlab.pages.dev/ |
| Integrated package | 10,037 files, 1,619,508,321 bytes |
| Served bytes checked | 10,036 / 10,036 matched on preview and stable production; `_headers` is hosting configuration |
| Header checks | 10 / 10 matched on preview and production, including capacity, download and genuine 404 routes |
| Immutable production smoke | 6 / 6 files matched, independently of stable-alias readback |
| Production readback completed | `2026-10-10T07:42:11.979790+00:00` |
| Offline SHA-256 | `d941591e458196379cf238e46da37d4d4a6f4d9d1de734ad43c85ce8fd556827` |
| Integration manifest SHA-256 | `c24278a845c19d1e66f2691c11ba26abf4447a60d357a34c77b23da66d559725` |
| Capacity sidecar release digest | `55a9eb4ee3cb83edb7be7ea38c6cbda68ea87ce1e012053f5e5c0c3b3df8e040` |
| Source tree | `62c1eb126f40b9d5e55bfe0a3ed1f2ddf0c7d68c` |

The same source-frozen artifact was deployed first to preview and then to production. The production upload reused all 10,036 assets already verified on preview. The committed `docs/releases/fleetlab-current.json` now supports a ten-file smoke check including the new capacity page, CSS, sidecar and bench module. Receipt and handoff edits follow in a separate documentation commit; they do not change deployed application bytes. No account, credential, hosting-retention or autonomy deployment authority was changed.

## What remains outside this release

- Physical Pixel validation: ADB reported no attached device during this turn. Phone viewport browser testing is not physical-device evidence.
- Independent human comprehension, map/source expert review, screen-reader and broad Safari/Firefox acceptance remain separate. Existing dated device results do not automatically validate this new interface.
- The brief's proposed physical-phone reconstruction, frame-time and heap budgets are measurement targets, not achieved claims without device instrumentation.
- No new artwork or Blender runtime was necessary for the first slice. The existing film and poster remain optional; original 3D scenery is a future visual choice, subordinate to the causal diagram.
- NF-04 implementation is proposed next. Q1 remains partial device/browser acceptance; Q8's separate simulated-period replay remains queued; N2 remains a separate curb-study design. NF-02 is not N2. Austin remains paused.
- Account hardening, operator calibration, independent authenticity and real-world validation are not supplied by this release.

## Recommendation

Use the shipped NF-03 page to review whether a visitor can explain the limiting resource, the selected vehicle's wait and the trade-off. Give reviewers this handoff and the next design specification together; the second file contains a focused feedback prompt.

## Top risks + mitigations

- Visual confidence mistaken for operational evidence → visible synthetic scope, exact records and unchanged qualification boundaries.
- Reviewers assess a stale tab → use the immutable deployment in the final receipt and refresh before review.
- Device/browser gaps disappear from the narrative → retain explicit performed/open validation statuses.
- More content dilutes the learning goal → next increment stays a bounded two-arm software-delivery lesson.

## Next 3 actions

1. Review the current capacity lesson and report concrete comprehension or interaction failures.
2. Review the NF-04 next design spec, particularly accounting, mobile comparison and modeled failure semantics.
3. Complete targeted physical-device and human qualification alongside the next contract review; preserve SF's separate HOLD until its own evidence is sufficient.
