# FleetLab homepage film release

The homepage now introduces the human purpose of fleet operations with an original 16-second Blender film: a waterfront AV ride, a depot preparing vehicles, and a wider view of the neighborhood and fleet. The headline is **Every great ride starts with a ready fleet.** Visitors can go directly into Fleet day, explore the models, or inspect the preserved depot-stage explainer.

The film is an illustration, separate from simulation output. All geometry, materials and motion were authored for this project. No Wayve footage, logo, music or vehicle asset is used. See the [design rationale](FLEETLAB_HOMEPAGE_FILM.md) and [reconstructible authoring workflow](../tools/fleet-film/README.md).

## Scope and authorization

Starting commit: `91621293885421256c8b23b9dfc8545268bb7b9f`. Existing feature branch: `feat/fleetlab-playground`; repository: `bohueilin/Hermes`; remote: `github`. The user's explicit film request and earlier GitHub/Cloudflare publication authorization govern this static-site enhancement. No main merge, Python-core change, evidence-contract change or real-fleet connection is included. This does not expand the historical Phase 6 workbench scope.

## Delivered media

| Item | Verified value |
| --- | --- |
| Movie | `playground/fleetlab/media/fleet-film.mp4` |
| Format | H.264, 1280 × 720, 24 fps, 384 frames, 16.000000 seconds |
| Audio | No audio stream |
| Movie size | 1,079,939 bytes |
| Movie SHA-256 | `47e5edef395327fb32f2744ce73020542071f28f8b653d9bf7d10150995ca862` |
| Poster | `playground/fleetlab/media/fleet-film-poster.webp`, 32,678 bytes |
| Poster SHA-256 | `fce22fa9f19eb10e85bfed2fcdf53864b4be57dfa6b3423407baf2497241538c` |
| Authoring | Blender 4.5.0, Cycles/Metal, original scene; FFmpeg 8.0.1 H.264 encoding; Pillow poster conversion |

The movie loops silently and has a visible pause control. It pauses on leaving Overview, hiding the document or scrolling out of view; a deliberate pause persists across navigation. Reduced-motion and data-saving preferences begin with the poster and do not attach a video source until the visitor chooses playback. Decode/autoplay failures retain the image and product actions. The offline edition embeds the poster, omits the movie and retains every simulation tool.

## Validation before publication

| Check | Observed result |
| --- | --- |
| Full JavaScript suite | 1,629 total: 1,626 pass, zero failures, two skipped, one existing TODO |
| Python parity and placement boundaries | 89 pass |
| Ruff / whitespace / protected paths | Pass; core, workflows, package configuration and existing simulation semantics unchanged |
| Environment doctor | 17 PASS; working-tree-dirty WARN before commit; optional display NOT_AVAILABLE; no FAIL |
| Static package | 69 files, 2,963,232 bytes; distribution checker passes |
| Application excluding media | 1,850,615 bytes; unchanged 2.5 MiB cap |
| Offline package | 2,319,114 bytes; checker passes under unchanged 2.5 MiB cap |
| Offline SHA-256 | `69114d2e5373e0892c0b19b2666adbb7865788eeb3163a0b1a069ed018be3c10` |
| Movie verification | FFprobe confirms format/frame count/duration/no audio; all 384 frames decoded without error; no black interval detected at 0.04s / 0.05 pixel threshold |
| Visual inspection | Three scene samples and shot endpoints inspected; discarded camera intersection corrected before final render |
| Packaged desktop browser | Actual playback, looping, pause/resume, retained manual pause on navigation, offscreen pause; readable scene/copy and control inside 1280 × 720 viewport |
| Packaged phone browser | Actual moving video and pause at 390 × 844; image above copy; no horizontal overflow |
| Offline browser | Embedded poster loads; no video element; default Fleet day runs and produces trip/depot outputs |
| Independent review | Both pending-play findings fixed with four reproducing regressions; scoped re-review passes; final source/asset release review passes |

Commands and detailed outputs are preserved locally under `artifacts/film/`:

```sh
node --test playground/fleetlab/test/*.test.mjs
node playground/fleetlab/tools/pack.mjs --site dist/site
node playground/fleetlab/tools/check-dist.mjs --site dist/site
node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html
FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 python -m pytest -q tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py
python -m ruff check .
python -m hermes doctor
git diff --check
```

The existing validation environment was reused. The whole Hermes Python suite was not rerun or described as passing: historical missing evidence-fixture failures remain documented in the [prior public release](FLEETLAB_PUBLIC_RELEASE_2026-09-19.md).

## Recommendation

Use the film as a short introduction, then open **Fleet day** or **Street lab** to demonstrate the inspectable product. The movie is not the evidence for an operational recommendation.

## Top risks and mitigations

- Motion can distract or cost bandwidth: silent loop, explicit pause, visibility controls, preference-aware source attachment and a 1.08 MB file.
- A concept scene can be mistaken for a model result: explicit illustration label, generic vehicle shapes and clear separation from simulation replay.
- Structural file checks do not establish decoding or comprehension: complement them with actual decoder/browser checks; evaluate first-time visitor understanding next. Legacy browsers without IntersectionObserver start on the poster; after deliberate play, scroll detection is unavailable, while navigation and tab visibility still pause playback.

## Next three actions

1. Publish and verify the reviewed static package on the existing Pages project.
2. Share the stable interview address and move from the film into an actual scenario.
3. Ask a first-time reviewer to explain FleetLab's purpose and start one experiment without guidance.
