# FleetLab SF clarity release — 4 October 2026

Status: **LIVE AND VERIFIED** at [FleetLab](https://fleetlab.pages.dev/) and
[City Explorer](https://fleetlab.pages.dev/city-explorer/). Published and checked
on October 4, 2026 (America/Los_Angeles). SF acceptance remains HOLD under
the [canonical acceptance record](FLEETLAB_SF_ACCEPTANCE_2026-10-04.md).

## Changes

Replay operational state now follows the exact recorded interval at the cursor;
pose, sampled state and energy retain their separate 15-second sample time.
At A / seed 1001 / EV-001, the 09:36:29 queue boundary no longer displays the
older 09:36:15 turnaround state as current. Continuous slider values preserve
exact event seeks; no interpolation, trace repair or scientific change occurred.

The original comparison displays its existing +2 pp practical threshold beside
+1.11 pp and its interval, with missing/incompatible evidence unavailable. Scope
and sources now exposes approved SF milestone deferrals. Other site sections,
adverse sensitivities, the incomplete power study and source qualification limits
remain visible. The header now wraps navigation at intermediate widths; an
observed 5-pixel overflow at 844×390 is fixed.

## Validation collected

Evidence directory: `build/fleetlab-city/validation/sf-acceptance-20261004/`.

- Focused four-test regression: all four RED before implementation; all four GREEN after.
- City Python: `build/fleetlab-city/venv/bin/python -m unittest discover -s apps/fleetlab-city/tests` — 312 passed.
- City JavaScript: `npm --prefix apps/fleetlab-city test` — 59 passed (including the terminal-state regression).
- Hermes: `PYTHONPATH="$PWD/src" /Users/bohueilin/miniconda3/envs/hermes-dev/bin/python -m pytest -q` — 1,661 passed, 56 skipped.
- Actual in-app browser: original defect reproduced; corrected exact queue boundary,
  backward seeking, direct Play/Pause and terminal state inspected separately from tests.
- Local QA initially served stale gzip mirrors after manual source overlay. This
  was diagnosed and both plain/compressed QA representations refreshed before
  validating the fix. This mutable QA copy is not a release or deployment input.
- Responsive browser checks: atlas, replay and notebook at 390×844, 844×390,
  768×1000 and 1440×900 all have no page overflow after the header fix (12 checks).
  These are emulated viewports, not physical-device results.
- Physical Pixel: `adb devices -l` returned an empty listing. Physical touch,
  screen-reader and participant checks remain NOT_RUN.

Ruff passed. Doctor with the activated `hermes-dev` environment reports 17 PASS,
1 WARN (dirty working tree) and 1 optional NOT_AVAILABLE; the initial direct
interpreter invocation additionally warned that the environment was not activated.
Independent review found no Critical/Important issues. Its single minor finding
was fixed: a zero-duration final transition now uses final snapshot state/site and
“State at recording end,” without inheriting the prior interval. A failing regression
was observed before the fix; all 59 JavaScript tests then passed. The reviewer also
verified all batch hashes/counts and inspected all 2,400 original vehicle projections.
No independent human map qualification is implied by this code review.

Build, preservation, publication and readback results are recorded below. `npm run test:browser` validates a historical
evidence inventory; it is not a fresh interaction test.


## Immutable build and preservation

- Source implementation: `749ae0cb70187599487bc1586d7b3a831e792326`, pushed to `github/codex/fleetlab-city-sf` (earlier focused implementation `f7e5e46`). Main was not merged or rewritten.
- Viewer: `dist/city-explorer-v9-sf-acceptance`, release SHA-256 `cee47cf4eb126c1a14892bad0568ed73f3171611626580281a026f29980fce35`.
- Combined stage: `build/fleetlab-city/launch-integration-v5/site`; integration manifest SHA-256 `1a6d6f9a178adffced0ba90b2b52d6fc2e55f09a8c29ec705bdde80944bb2e8f`.
- Combined stage: 10,019 files / 1,616,598,719 bytes; 10,018 publicly served payloads (the `_headers` configuration is not a served asset).
- Viewer including its manifest: 767,997,489 bytes / 4,951 files, **+10,852 bytes** versus v8. Builder inventory excludes the manifest itself and reports 4,950 constituent files.
- First-view compressed transfer: **1,906,730 bytes**, +1,087 bytes versus v8; largest file 22,272,149 bytes; largest pair gzip 9,869,801 bytes. All existing byte/integrity/dependency checks pass.
- All **4,886 non-catalog data files**, including compressed representations, match v8. The catalog's only semantic change is this build's measured export peak RSS. Scientific values, recordings, comparison and temporal summary are unchanged.
- All 12 frozen scientific sources, comparison core and 13 review/proposal inputs match. All 96 protected root files and the hosted root entry, boot module and headers match the prior live stage. Offline SHA remains `169388571013337332b33aad79d7e4576e6490f07ec70322ced188dfd0c8c130`.
- `preservation.json` lists every changed presentation/documentation path. No old distribution or study was overwritten. Two intermediate builds were retained while terminal/landscape refinements were validated; only the final path above is a deployment input.

Commands used: `city.py build-viewer --runs build/fleetlab-city/runs/sf-depots-v1 --out dist/city-explorer-v9-sf-acceptance --power-status build/fleetlab-city/studies/sf-power-headroom-v1-r2 --temporal-candidate`; `city.py check-dist --site dist/city-explorer-v9-sf-acceptance`; `tools/integrate-site.py` with the retained legacy site, v8 previous viewer, v8 source offer, offline regression edition and existing complete legacy readback. Exact logs and validation scripts are in the evidence directory.

The source offer remains byte-identical and matches the selected temporal bundle.
The static build reverified retained full-SF recordings and used existing tiny
teaching fixtures; no new full-SF arm, evaluation tape or scientific campaign ran.
Build manifests retain their `REVIEW_ONLY` / `NOT_PERFORMED` creation-time fields;
the separate publication record documents owner-authorized static hosting.

## Browser and hosting observations

The preview stable route selected release `cee47cf4eb126c1a`; production selects
the same release. Actual interaction confirmed the 09:36:29 state versus held
09:36:15 sample, direct Play, automatic end, Replay restart and Pause. The final
terminal context says “State at recording end,” without an inherited interval.
Both configurations' whole-shift totals were invariant through the local seeks.
The production result card shows the +2 pp margin; the stopped power study still
has no paired estimate. No browser error/warning was observed in these sessions.

Production keyboard Tab focused City atlas; Enter opened it and focused its
heading. The live atlas has no document overflow at 390 px. This does not establish
physical touch, TalkBack or enlarged-text behavior. Fresh throttled load,
frame-latency and browser-memory measurements were not performed in this release;
no performance pass is inferred from byte-budget checks.

The retained v8 viewer under the preview domain played from 07:00 to 10:46.
This verifies the retained compatible viewer with the current hosted headers;
it is not a claim that production was actually rolled back. The original
Overview video had `readyState=4` and was playing; original navigation and owner
contact remained visible. Raw browser observations and three production screenshots
are in the evidence directory (`replay-live.jpg`, `threshold-live.jpg`,
`atlas-phone-live.jpg`).

Hosting checks pass for root, current viewer, retained viewer, source offer,
recorded JSON and Overview film. Hosted Range requests returned the correct full
HTTP 200 bodies, not 206; no partial-content claim is made. Effective CSP remains
scoped correctly, with nosniff and frame denial. Preview full readback matched
10,018/10,018 payloads; independent production readback also matched
**10,018/10,018**, with no failures and matching headers.

## Preservation and rollback requirements

Build into a new immutable viewer and combined stage. Retain current production
`e37b4a7b-c60d-4a42-b705-ec6c0bf730e2`, viewer
`14dc0191dd7684d0ea9807f8a4d68e018a8be58a2349440ce0b4a801c0af51ad`, and
`build/fleetlab-city/launch-integration-v4/site` unchanged. Reuse the compatible
source offer `71872c6f571c644dbc2fbfee4bb308e3ed2f7406c7a54ecb3f70ab0e2e4fc817`;
this release changes no map or source transformation. The fuller unresolved
district geometry remains local.

Full-site rollback restores the retained v4 Pages deployment/stage. City-only
rollback points the stable entry to the retained compatible v8 viewer, including
its manifest, data and schemas; validate replay and route headers before using
it. Keep both releases at least 30 days after publication. Never overwrite
historical stages to perform a rollback rehearsal.

No original recording, frozen protocol, evaluation tape, map pack or review
requirement is authorized to change. No new simulator/provider dependency or
scientific execution is part of this release. All 96 protected root assets and
the offline edition must remain byte-identical.


## Publication and Git handoff

- Production deployment: `b009157f-a164-42cc-a0b5-c63ef9d12c57`, [immutable production URL](https://b009157f.fleetlab.pages.dev/).
- Preview deployment: `046e87d6-5549-483b-90d5-394c02409060`, [immutable preview URL](https://046e87d6.fleetlab.pages.dev/).
- Current immutable City path: `/city-explorer/releases/cee47cf4eb126c1a/`.
- Both environments serve the same staged bytes. Existing pinned Wrangler 4.135.0 with its retained serial-upload transport was used; preview uploaded 19 new files and production reused all uploaded payloads.
- Publication envelope: `build/fleetlab-city/launch-integration-v5/review/publication-2026-10-04.json`; SHA-256 `ad52f0e78dfe89b4c056d1a05984a264bfac3fc3cfabc76c525bd4d4ec365c74`.
- Production readback SHA-256: `5b7b50b19148e44437f7e91cf074df5c60da78aa85943199dd4b0483edd69f21`; preview: `ec841d9b3447015a602008c84c22065750b50f248b870e78cb388c4a0d83adf8`.
- Code and final documents are on [the feature branch](https://github.com/bohueilin/Hermes/tree/codex/fleetlab-city-sf). The published source remains commit `749ae0c`; the later documentation commit records this publication without changing the site artifact. No main-branch merge, force push or history rewrite occurred.
- Owner files `.wrangler/` and `FleetLab-ChatGPT-review-and-next-phase.md` were preserved and excluded from commits. Temporary local QA servers were stopped; the live City Explorer is left open in the browser.

The completed scope is presentation engineering, acceptance preparation and static
publication. SF source/map qualification, physical-device accessibility, actual
visitor feedback and owner acceptance remain open. The source-owner draft was
not sent. The current Pixel did not appear in ADB. No Austin work, new full-SF
study, r3 freeze or new campaign budget was started or approved.

**Recommendation:** use the verified live educational release for review;
retain SF acceptance HOLD.

**Top risks + mitigations:** stale/mixed assets → immutable packaging and complete
HTTP readback; misleading evidence → preserved results and separate gates;
regression → focused behavior tests, actual browser interaction and staged rollback.

**Next 3 actions:** assign source/map reviewers; collect physical-device and
five-visitor evidence; record the explicit SF acceptance decision. Austin remains
NOT_STARTED.
