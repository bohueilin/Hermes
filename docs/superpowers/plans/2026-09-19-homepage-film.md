# Homepage film implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Execute the bounded website task while the controller authors the original film, then review the integrated result.

**Goal:** Introduce FleetLab with an original AV concept film that connects a pleasant ride to fleet readiness.

**Architecture:** A small DOM media controller presents local MP4 and poster assets. The existing studio owns its visibility and destruction. The packer copies two allowlisted media files for hosting and substitutes an embedded poster with no movie for the offline edition.

**Tech Stack:** Vanilla JavaScript, HTML video, existing Node packer and tests; Blender and FFmpeg for offline film authoring.

**Spec:** `docs/FLEETLAB_HOMEPAGE_FILM.md`.

## Global Constraints

- Work only in `/Users/bohueilin/Documents/GitHub/Hermes-playground` on `feat/fleetlab-playground`.
- Do not alter Python core, GitHub workflows, evidence contracts or simulation semantics.
- No frontend dependency, analytics, external media request or copied corporate asset.
- Hosted film `media/fleet-film.mp4` ≤ 4 MiB; poster `media/fleet-film-poster.webp` ≤ 200 KiB; app/offline budget stays 2.5 MiB.
- Keep the existing safe DOM helper, copy rules, strict CSP and minimum 44px targets.
- Preserve the interactive depot explainer and every simulation navigation route.
- No commit, push or deployment by the implementer; the controller integrates, verifies, commits and publishes after review.

### Task 1: Accessible film-led homepage and bounded media packaging

**Files:** Create `src/ui/hero-film.js` and a small media configuration module under `playground/fleetlab`; modify `src/ui/studio.js`, `styles.css`, `tools/pack.mjs`, `tools/check-dist.mjs`; create focused media and packaging tests. All paths are relative to `playground/fleetlab` unless prefixed otherwise.

**Interfaces:** The controller will supply the two exact media files from the spec. The hero media controller exposes `{element, setActive(boolean), destroy()}`. `mountStudio` calls `setActive(page === 'overview')` and `destroy()`. Hosted media paths remain relative to the page, so both `/site/` and root deployments work. Offline packing replaces the film URL with an empty value and poster URL with its data URI, preserving identical simulation code.

- [x] Write meaningful failing lifecycle tests: normal playback/real pause state; user pause persists; reduced motion starts without a video source; explicit play opts in; navigation or document hiding cancels pending autoplay and pauses; destruction removes observers/listeners; decode/playback failure keeps poster and truthful button state.
- [x] Write failing package tests: real binary copy and byte equality; explicit source/media budgets; unexpected binary, wrong format, symlink and oversized asset rejection; offline output has embedded poster and no film reference; unchanged app/offline budget and no external request.
- [x] Implement the media controller with progressive enhancement. Use `video.muted = true`, `playsinline`, loop, no audio track, safe local URLs, visible Play/Pause button based on actual playback events, appropriate accessible description. Start with poster, attach source only when motion is allowed and the hero is visible. Avoid retry loops when autoplay is denied. Reconcile pending `play()` with current visibility and preference.
- [x] Integrate a cinematic wide hero with headline **Every great ride starts with a ready fleet.**, supporting explanatory copy, **Run a fleet day** and **Explore the models** actions. Overlay text must remain readable on every frame. Give the image room on mobile without hiding cars behind all the copy. Label the visual **Original 3D concept film** and provide a brief text description of its ride/depot story. Retain authorship and the interactive depot explainer below the hero. Keep the rest of the site styling coherent.
- [x] Extend the packer/checker for exactly the two media assets. Only the actual application graph requires them: scratch module fixtures without the media module remain valid. Preserve complete code scanning and the old code/offline budget. Inspect binary type and independent size caps before publication. Offline video control is absent and descriptive poster is present.
- [x] Run focused tests and the full JS suite once assets are available. Report exact results, files and any limitations to the task report. Do not commit. The controller will inspect real playback and visual layout.

## Integration and release verification

The controller authors and visually reviews the scene and MP4, adds its reproducible render script and provenance, reviews the implementation via an independent agent, runs packaging and relevant regressions, tests desktop/mobile/public playback, and publishes the validated feature branch and static package. Record source commit, deployment and media hashes. The existing non-green whole Python suite is not described as passing.
