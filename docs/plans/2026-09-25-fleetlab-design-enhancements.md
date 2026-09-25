# FleetLab design enhancements implementation plan

**Goal:** Implement approved Packages A–C: addressable navigation and lessons, versioned setup sharing, accessible page structure, precise provenance/copy, and verified hosted/offline behavior.

**Approved specification:** `/Users/bohueilin/Downloads/ChatGPT6_fleetlab-design-review-feedback-audit.md`, approved by the user's “go” on September 24 Pacific time.

**Architecture:** Retain all existing engines and the dependency-free static/offline application. A bounded hash-route table coordinates current studio destinations. A versioned setup codec validates complete producer configuration before a UI handoff; loading never computes results. Current inputs and submitted run inputs remain distinct.

**Tech stack:** Native JavaScript modules, DOM, existing Node 22 tests and pack tools.

## Constraints and rulings

- User approval covers the concrete audit's implementation package, so no second design-approval cycle is introduced.
- Reuse the already isolated `Hermes-depot-m1` worktree at `cce9fe0`; preserve newer operating extensions. The current explicit website scope supersedes historical Phase 6 feature-branch wording for this work only.
- No publish, push, remote change, model-semantic change, telemetry, backend, account, persistence or runtime dependency.
- Keep `NOT_EVIDENCE`, simulation-only scope, no operational authority, exact values and missing-value distinctions.
- No cosmetic rewrite, speculative mobile menu or fabricated timeout.
- Local commits only after repository gates; leave changes reviewable if unrelated historical gates cannot pass.
- Work is divided into independent file ownership for codec, Fleet day handoff, Street lab/embedded title, and root-owned routing/integration.

## Review focus

1. A malformed, unknown-version, oversized or partial shared setup must not silently load defaults or leave accepted results attached to new inputs.
2. Back/forward, direct route entry and new-tab links must select the same model as the catalog, including regional Learn/Sandbox and tour states.
3. Sharing after input edits must distinguish current configuration from the submitted configuration of a result or paired experiment.
4. Launch configurations and paired options require all effective fields; custom owner/free-text data must not be silently disclosed in links.
5. Hosted and offline packages must retain strict URL/CSP checks, media policy and accessible active-page landmarks.

## Tasks

### 1. Setup codec

- [x] Add `src/ui/setup-codec.js` and `test/setup-codec.test.mjs`.
- [x] API: `createSetup({model,config,options={}})`, `encodeSetup(envelope)`, `decodeSetup(payload)`, `MAX_SETUP_LENGTH`.
- [x] Model IDs: `fleet-day`, `street-lab`, `launch-rehearsal`, `regional`. Derive version identities from installed producers and bind schema, versions, config and options.
- [x] Test complete deterministic roundtrip, nested config, unknown keys/versions, prototype keys, nonfinite values, partial configuration, resource limits and privacy handling before implementation.

```js
const shared = createSetup({model:'fleet-day',config:defaultBayAreaConfig()});
const restored = decodeSetup(encodeSetup(shared));
assert.deepEqual(restored.config, defaultBayAreaConfig());
assert.throws(() => decodeSetup('not a setup'));
```

### 2. Model UI handoff

- [x] Fleet day: `getSharedSetup(source='current',model='fleet-day')`; `loadSharedSetup(envelope)`. Include launch config/delay and relevant paired options; reject unavailable last-run requests.
- [x] Street: same APIs with fixed model `street-lab`; preserve complete config, producer/network identity and export metadata.
- [x] Synchronize controls, invalidate incompatible displayed results, cancel pending work, pause playback, never invoke engines on load.
- [x] Keep exact submitted configuration/metrics in inspectable result details and concise scope beside output groups.
- [x] Tests compare current versus last submitted configuration, detached values, nested option restoration, no automatic run and stale behavior.

### 3. Routes, catalog and page structure

- [x] Add `src/ui/routes.js`, `test/navigation.test.mjs`; integrate `studio.js` and catalog links.
- [x] One route table maps `overview`, `simulation`, `streets`, `depots`, `catalog`, `approach`, `operations`, `tour` to hash URLs and titles.
- [x] Lesson lookup is the catalog's existing stable registry. Native `href` links work without JavaScript click interception for modified/new-tab actions.
- [x] Direct loading, `hashchange`, title, active nav, focus, skip link and unknown-route recovery share one path. Invalid setup keeps error visible and requires a deliberate default recovery action.
- [x] Workspace wrapper is a main landmark; standalone app retains its H1; embedded branding becomes non-heading.
- [x] Verify all 56 lesson destinations; public route changes do not run engines and browser history does not add per-keystroke entries.

```js
assert.equal(routeHref({page:'simulation'}), '#/fleet-day');
assert.equal(parseRoute('#/street-lab').page, 'streets');
assert.throws(() => parseRoute('#/fleet-day?unexpected=yes'));
```

### 4. Sharing controls and regional state

- [x] Add `src/ui/setup-sharing.js` for explicit link generation, current/last-run selection, visible selectable URL fallback and bounded config export when a full URL does not fit.
- [x] Add `src/ui/regional-setup.js` adapting existing scenario/draft/frozen spec/store actions; no new gate or engine.
- [x] Integrate shared setup routing and page/model consistency. Explicit URL state update uses replacement only when sharing, navigation uses separate history entries.
- [x] Regional experiments preserve baseline/candidate settings, metric scopes, guardrails, full seed set and resamples. Current draft sharing must not claim a last result.
- [x] Tests cover malformed/mismatched payloads, no-result actions, stale configurations, privacy refusal and regional reload behavior.

### 5. Copy, presentation and packaging

- [x] Explain FleetLab/Hermes once, add restrained author colophon, native footer links, truthful internal arrows and in-media illustration label.
- [x] Preserve current palette/type/film/mobile layout; style skip/error/share/provenance surfaces and responsive links with existing tokens.
- [x] Update exact pack manifests and narrow URL allowances; no generalized external URL or dynamic-code exception.
- [x] Run both packers/checkers and package regressions.

### 6. Validation and handoff

- [x] Existing full Node baseline before changes; focused red/green tests during work; full serialized suite including performance gates when code is stable.
- [x] Required Python parity/boundary, full pytest, Ruff, doctor and whitespace checks; document unrelated failures honestly.
- [x] Browser-check hosted/offline routes, default/changed run, sharing fresh context, invalid payload, landmarks, keyboard, narrow layouts and reduced-motion/media behavior available in tooling.
- [x] Record performance measurements only with stated conditions; identify unavailable lab/AT/device measurements.
- [x] Independent whole-change review, resolve important findings, then prepare local preview and handoff with actual commands/results/digests and remaining limits.

## Progress ledger

- Initial state: clean `codex/fleetlab-m2-m3` at `cce9fe0`; no application changes prior to this implementation.
- Baseline full Node run started; output in ignored `artifacts/fleetlab-design-enhancements/baseline-node.txt`.
- Tasks 1–2 and embedded heading delegated with non-overlapping file ownership; routing and final integration remain with the primary agent.

- Final outcome: approved local implementation complete, with verification limits recorded in `docs/FLEETLAB_DESIGN_ENHANCEMENTS_HANDOFF_2026-09-24.md`.
- Final serialized website suite: 1,778 pass, zero fail/skip/cancel, one existing TODO; 146.504 seconds. Final presentation follow-up: 111 pass, zero fail, same existing TODO.
- Playground Python contract checks: 89 pass against starting commit. Full repository Python gate: 1,433 pass, 186 fail, 42 errors, 56 skip; retained artifact fixtures are absent. No backend/protected-path changes, no local commit or remote action.
- Independent review: missing metric scope/direction and launch delay reset fixed; re-review found no remaining important findings. Additional fixes cover UI threshold serialization, 44-pixel disclosure targets, expanded result overflow and hero anchor interaction.
- Browser: six main views at 320/390/768/1024/1440 pixels; no document overflow and one active H1/main. Current/last-run setup, fresh-tab loading, history, invalid links, keyboard skip/navigation, map controls and single-file package over loopback HTTP checked.
- Direct file browser navigation was blocked by browser URL policy. No bypass attempted. Page-load lab measurements, network-level reduced-motion audit, real assistive technology and cross-browser/device coverage remain unavailable; no claim of those checks passing.
