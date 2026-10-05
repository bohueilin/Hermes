# FleetLab SF clarity release — 4 October 2026

Status during preparation: local implementation and regression tests completed;
independent review passed; final immutable build and publication pending. This record will
be finalized with observed release identities. SF acceptance remains HOLD under
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

Final build/check-dist, preservation checks, exact browser evidence, deployment
readback and Git identities will
be recorded below after they occur. `npm run test:browser` validates a historical
evidence inventory; it is not a fresh interaction test.

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

**Recommendation:** publish the focused educational improvements after the
release checks; retain SF acceptance HOLD.

**Top risks + mitigations:** stale/mixed assets → immutable packaging and complete
HTTP readback; misleading evidence → preserved results and separate gates;
regression → focused behavior tests, actual browser interaction and staged rollback.

**Next 3 actions:** complete release validation; publish and verify the exact
artifact; collect remaining source, physical-device and visitor acceptance evidence.
