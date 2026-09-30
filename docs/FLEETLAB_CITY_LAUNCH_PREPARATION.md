# FleetLab City launch staging, not publication

**Current review stage (v4):** `build/fleetlab-city/launch-stage-v4-final/` contains the corrected viewer release `920887f3fb0841b066f26a996d8c9c157fc47c1e9f2cff0b70837c069c80f0a2` and the prior v3 release, with all 99 legacy files unchanged (9,921 staged files total). The standalone reviewed preview is `http://127.0.0.1:4182/`. Shared-site placement is awaiting the owner; header/navigation proposals are unapplied. This release pair's hosted readback and rollback rehearsal remain unperformed. Read `FLEETLAB_SF_POWER_BUILD_VALIDATION_2026-09-29.md` and `FLEETLAB_WEBSITE_INTEGRATION_PLAN_2026-09-29.md` before the historical stage notes below. Do not use `launch-stage-v4-corrections/`, which preserves the earlier failed Play-click browser check.

29 September 2026. `apps/fleetlab-city/tools/prepare-launch.py` creates an atomic local review stage for Cloudflare Pages. It neither deploys nor modifies the legacy site, the current viewer, or the prior viewer. The staged `site/` root contains the original 99 legacy files byte-for-byte, including the original root `_headers`, plus a versioned `/city-explorer/` route. `review/` contains evidence and proposed changes. `release_ready` is always `false` until remaining gates and owner review are recorded separately.

## Actual legacy baseline reconciliation

The two preserved local copies, `dist/site` and `dist/fleetlab-city-legacy-site`, contain 99 files and match each other byte-for-byte. The historical `dist/validation/live-readback.json` is stale for two files: it records `index.html` as 1,461 bytes and `styles.css` as 112,515 bytes, while the current local copies are 1,440 and 112,536 bytes. The staging tool correctly refuses that historical readback.

On 29 September 2026, a fresh read-only capture of all 98 publicly served payload files from `https://fleetlab.pages.dev/` matched the local 99-file copy (the root `_headers` itself is not served). The live response CSP retains `connect-src 'none'`. The new capture is at `build/fleetlab-city/validation/launch-live-baseline-20260929/`: `payload/` holds the 98 fetched files and `live-readback.json` records their sizes, hashes, response headers and the local root `_headers` hash. This is a point-in-time readback, not proof that later production state stays unchanged. Repeat the live readback just before any publication decision.

## Prepare a stage

After the parent builder packages and verifies the final viewer, run:

```bash
python apps/fleetlab-city/tools/prepare-launch.py \
  --legacy dist/site \
  --viewer dist/city-explorer-final-reviewed \
  --previous-viewer dist/city-explorer-reviewed \
  --legacy-readback build/fleetlab-city/validation/launch-live-baseline-20260929/live-readback.json \
  --out build/fleetlab-city/launch-stage-v1
```

`--viewer` must point at a complete release with a valid `release.json` inventory and self-only `network.json`. The tool refuses mismatched bytes, unlisted files, links/special files, incompatible rollback schemas, an existing output directory, a file over 25 MiB, or a stage over 20,000 files. It copies to a temporary sibling and renames only after a second inventory check. The launch-stage command is to be rerun with fresh readback evidence if the hosted legacy content changes.

The output has this shape:

```text
launch-stage-v1/
  site/                         # potential Pages upload root, not yet deployable
    _headers                    # exact legacy bytes, deliberately unchanged
    index.html                  # exact legacy bytes
    ...                         # other exact legacy files
    city-explorer/
      index.html                # stable entry
      switch-<release-prefix>.mjs
      releases/
        <current-release-prefix>/ # verified viewer + pack + run data
        <prior-release-prefix>/   # verified compatible rollback unit
  review/
    _headers.candidate          # separately proposed root-file replacement
    _headers.diff
    optional-legacy-nav.diff    # source-only proposal; no legacy edit
    inventory-diff.json         # all unchanged legacy and added-file hashes
    rollback.json
    staging-report.json
    local-rehearsal-result.json # added after V3 local checks, outside site/
```

Each release prefix is the first 16 hexadecimal digits of its `release.json` SHA-256. A stable `/city-explorer/` entry loads a relative, versioned switch module; that external module preserves the URL query and hash while navigating to the versioned viewer directory. The viewer then uses its own relative module, style and data paths. This is a static routing convenience, not an assertion that changing a viewer alone is a safe rollback. The rollback descriptor identifies the prior viewer plus its compatible pack, run and metric schemas, with a 30-day default retention note. It does not mark the rollback rehearsal complete.

## Root-header exception and network posture

The existing legacy `_headers` has a `/*` CSP rule with `connect-src 'none'`. Cloudflare Pages uses one root `_headers` file for a static site; copying a second `_headers` into the city route does not provide an effective route override. The stage therefore keeps the canonical root file byte-for-byte and emits a separate `review/_headers.candidate` plus unified diff. The candidate adds a `/city-explorer/*` block that detaches the inherited CSP and sets self-only script, style, image, font, worker and data permissions for the viewer. It inherits the root `nosniff` and referrer values without repeating them. A later publication would make this one explicit exception to root-file byte preservation after review and route-header readback. The legacy response must retain `connect-src 'none'`; the city response must obtain `connect-src 'self'` without duplicated or comma-joined CSP values. Confirm this in a Pages preview before any switch.

The candidate was tested locally with the existing cached **Wrangler Pages dev 4.135.0** against a two-page synthetic site. The first probe confirmed that `! Content-Security-Policy` followed by a new CSP in the same matching city rule replaces the inherited root CSP: one root CSP with `connect-src 'none'`, one city CSP with `connect-src 'self'`. It also exposed comma-joined duplicate `X-Content-Type-Options` and `Referrer-Policy` values in the initial candidate. Those redundant city lines were removed. The second probe returned one value for each inherited header, no root `Permissions-Policy`, and the intended city `Permissions-Policy`. Exact local response headers are saved in `build/fleetlab-city/validation/headers-probe-20260929/result.json`. This validates the local emulator's handling; hosted Pages preview readback remains a release gate.

Cloudflare documents that matching `_headers` rules inherit headers and that an inherited header can be detached with `!`; it also documents that duplicate header values can be joined. This is why the candidate is evidence for review rather than silently placed in `site/`. Cloudflare's current Pages limit is [25 MiB per asset](https://developers.cloudflare.com/pages/platform/limits/), so the tool checks individual staged files. See the [Pages headers reference](https://developers.cloudflare.com/pages/configuration/headers/) for the route rule and detach behavior. A static package does not execute simulations or create a backend.

## Optional legacy navigation link

The generated legacy `dist/site/index.html` is only a shell; its navigation is built in [`playground/fleetlab/src/ui/studio.js`](../playground/fleetlab/src/ui/studio.js) inside `mountStudio`, immediately after `navLinks` is created. `review/optional-legacy-nav.diff` proposes the exact one-line source change: append a plain `<a href="/city-explorer/">City explorer</a>` to `navLinks` before `navigation` is constructed. The tool generates this diff from the inspected current source and refuses to guess if that structure changes. Repackage and requalify that changed legacy edition as a separate decision; no nav edit is part of this stage.

## Required readback before a release decision

1. Inspect `review/inventory-diff.json`: no modified or removed legacy file, and every new asset under `city-explorer/`. Read `review/_headers.diff` and explicitly decide on the root-header exception.
2. In a Pages preview, fetch `/` and `/city-explorer/` plus representative module, data and Range responses; inspect effective CSP, content types, no third-party/provider requests, hash-preserving navigation, flat-map fallback and unavailable-data behavior.
3. Exercise the prior compatible bundle through the stable entry in a rollback rehearsal; retain both release directories. Freshly verify the production legacy inventory and root headers before any later publication.
4. Record owner review, rights/source disposition, target browser/device results and unresolved SF map qualification. Until then the stage remains a review candidate, with `release_ready: false` and `publication: NOT_PERFORMED`.

The staging test suite covers byte preservation, complete versioned copies, CSP proposal separation, hosted-readback tamper refusal, viewer tamper refusal and incompatible rollback refusal. It uses small synthetic fixtures; it does not assert an actual Pages deployment or production rollback.

## V3 local stage and rehearsal — 29 September 2026

The final viewer package `dist/city-explorer-v3-final` was staged with the preserved `dist/site` legacy root and the prior compatible `dist/city-explorer-v2-reviewed` release. The exact command was:

```bash
python apps/fleetlab-city/tools/prepare-launch.py \
  --legacy dist/site \
  --viewer dist/city-explorer-v3-final \
  --previous-viewer dist/city-explorer-v2-reviewed \
  --legacy-readback build/fleetlab-city/validation/launch-live-baseline-20260929/live-readback.json \
  --out build/fleetlab-city/launch-stage-v3
```

The stage has 9,897 files: 99 unchanged legacy files and 9,798 added files. The largest is 22,272,149 bytes, below 25 MiB. The canonical `site/_headers` SHA-256 is `c3a7c78abb90501711efc25ec6201ebfc6ad7be1bc2f722770ad1eb68712c35a`, identical to `dist/site/_headers`. The current release is under `city-explorer/releases/7450c2aaf5e5ca90/` (`release.json` SHA-256 `7450c2aaf5e5ca90e2f5cbf6cf7d05cf6520f11b1f92267bbdf511c557ce2926`). The compatible prior release is under `city-explorer/releases/d3e6b1b58d37980f/` (`release.json` SHA-256 `d3e6b1b58d37980f965f908a8f8ec6a8b70b66972ba6f719339a994fa56bc53f`). The stage report still says `release_ready: false` and `publication: NOT_PERFORMED`.

A separate copy at `build/fleetlab-city/launch-rehearsal-v3/site/` received `review/_headers.candidate`; the canonical stage remained unchanged. That copy was served by cached Wrangler Pages dev 4.135.0 on loopback port 4180:

```bash
node /Users/bohueilin/.npm/_npx/c943b712072b77c4/node_modules/wrangler/bin/wrangler.js \
  pages dev build/fleetlab-city/launch-rehearsal-v3/site \
  --ip 127.0.0.1 --port 4180 \
  --persist-to build/fleetlab-city/launch-rehearsal-v3/state --log-level error
```

The local response check fetched the legacy root (HTTP 200, 1,440 bytes), stable city entry (HTTP 200, 403 bytes), current `app.mjs` (HTTP 200, 15,355 bytes, `application/javascript`) and a large current road-data file. All bodies matched the staged bytes; root CSP was exactly the legacy `connect-src 'none'` policy, and city responses had one CSP with `connect-src 'self'`, one inherited `nosniff` value and one inherited referrer value. Details are in `build/fleetlab-city/launch-rehearsal-v3/current-response-check.json`.

**Range remains a hosted Pages preview gate.** Wrangler Pages dev ignored `Range: bytes=0-127` for the 22,272,149-byte road-data file, returning HTTP 200 and its complete body. The FleetLab local review server, run separately with the v3 viewer, returned HTTP 206, exactly 128 bytes and `Content-Range: bytes 0-127/22272149`; see `build/fleetlab-city/launch-rehearsal-v3/fleetlab-range-check.json`. These are two local-server observations, not a claim about hosted Pages Range behavior.

The rollback rehearsal edited only the rehearsal copy's stable switch module to point at prior prefix `d3e6b1b58d37980f`. The served switch preserved `?renderer=flat#replay`, and prior `app.mjs` and `data/catalog.json` matched the staged prior release. The switch was restored to current prefix `7450c2aaf5e5ca90`; both redirected URLs were checked. The stage's switch module and legacy root headers remained untouched. See `build/fleetlab-city/launch-rehearsal-v3/rollback-response-check.json`. This rehearsal does not authorize or simulate a production rollback.
