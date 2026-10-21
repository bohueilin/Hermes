# FleetLab publication runbook

Updated 14 October 2026. Applies to the static educational FleetLab website.
Hermes operational deployment permission remains NONE. Historical deployment
paragraphs and the old playground-only CI template are superseded; do not use them.

## Release identity and authority

The stable site is https://fleetlab.pages.dev/. Use its `/publication.json`
for the selected City release, compatible sanitized rollback, offline digest
and exact source commit. That file records packaging intent, not proof of
hosting. Compare it with the committed `docs/releases/fleetlab-current.json`
and run the readback tool to establish which bytes are actually served.

The owner explicitly authorized the October 13 NF04 correction wave and bounded Delivery order companion, including all five final amendments, Git push and live publication, following October 13 NF04-B implementation and publication, following October 12 NF04-A implementation, Git push and live publication, following the October 10
visual-experience update, controlled-autoplay/guided-NF-03 follow-up, and final-review NF-03 trade-off/copy improvements, following the authorized October 8 and 9 releases. An audit, handoff,
successful verifier, Git branch label or this runbook never grants authority for
a future release. Follow the user's
actual instruction. Account/credential changes and destructive retention actions
are separate decisions; no document can authorize them by itself.

The Delivery order route is `/network-flows/delivery-order/`. Its explicit route owner, source-capture entries, worker, study and release sidecar are included in the same atomic teaching/integration generation. Validate both it and NF04; do not deploy a standalone route over the integrated site. See [the implementation handoff](FLEETLAB_DELIVERY_ORDER_IMPLEMENTATION_HANDOFF.md) for the current release and retained rollback.

## October 14 approved artwork and analytics

The owner approved the reviewed depot and shared-delivery artwork, transparent logo,
Google tag `G-04EZ8EZWQ2`, Git push and public-site publication. The existing film and
all teaching/simulation behavior remain. This is the explicit website-only override
of the historical no-telemetry/no-publication instruction.

For a new generation, use the tracked local recipe below. It first runs
`tools/hosted-brand.py --project-base` against the approved original City viewer,
creating a new rollback generation that omits its inert nested `_headers` file.
The original input remains unchanged. The presentation derives from that projected
base with `--source-commit FULL_SHA`; both generations use the effective root headers.
Integration receives the original manifest through `--city-base-manifest` and retains
its exact bytes as review evidence. The guard reproduces both transformations from
the independently pinned original and rejects resealed changes to scientific files.

Hosted artwork is a separate, exact three-file inventory capped at 2 MiB. Its bytes
count toward total generation storage; hosted JS/CSS count toward text and route
closures. All previous hard caps remain. The source offer includes artwork paths,
bytes and hashes, with binaries served at those pinned paths. The offline edition
remains unchanged and analytics-free, as does the immutable historical City rollback.

Every current public HTML document has one tag immediately after its head element.
Collection is enabled only on `fleetlab.pages.dev`; preview/local collection is disabled.
Hosted pages disclose Google Analytics and Cloudflare hosting. The CSP retains hashed
inline-script authorization and finite Google origins; no script unsafe-inline/eval.
Verify the tag and actual CSP on the preview and stable host. Browser byte/tag checks
cannot establish receipt inside the owner's Google Analytics property.

## October 14 visitor design follow-up

After reviewing the local design, the owner explicitly authorized GitHub push,
live deployment, live validation and the updated handoff. This follow-up uses
the 19 supplied tiles and the existing concept film, as selected by the owner.
See [the visitor design handoff](FLEETLAB_VISITOR_DESIGN_HANDOFF_2026-10-14.md).

There are now two independent exact media owners: three brand files capped at
2 MiB, plus 19 tile files capped at 2 MiB. Total hosted artwork is 3,705,425 bytes.
All media bytes count toward generation storage. The visitor module, family
mapping and stylesheet count toward captured integration source, emitted text
and the final route closures. No existing hard cap was raised.

The small catalogue filter interface is also included in the rebuilt offline
edition; the illustrated presentation remains hosted-only. Offline analytics
remain absent. Do not describe this follow-up's offline file as byte-identical
to the preceding artwork release. The concept film and City scientific payloads
are unchanged. Keep all publication identities in the committed readback receipt;
source commits and documentation-only commits can differ.

## Build and verify

The subsequent October 13 Argon visual refinement uses the same release workflow and adds the explicitly reviewed `src/ui/concept-primer.js` module to `FLOW_ADDED`. It updates the offline edition while preserving all City payload bytes. See [the visual implementation handoff](FLEETLAB_VISUAL_EXPERIENCE_HANDOFF_2026-10-13.md) for the current production readback and remaining qualification limits. Continue to reject any undeclared module; do not broaden the allowlist during packaging.

Use the project's Python 3.11 environment for these tools. The Mac's default
Python may be older; use `build/fleetlab-city/venv/bin/python` explicitly.

The tracked recipe reconstructs a verified local package from explicit inputs:

```sh
PYTHON_EXECUTABLE -B apps/fleetlab-city/deploy/build-release.py \
  --commit FULL_SHA \
  --legacy PRESERVED_LEGACY_DIR \
  --legacy-readback LEGACY_READBACK_JSON \
  --city-base ORIGINAL_CITY_DIR \
  --city-source-offer ORIGINAL_SOURCE_OFFER_DIR \
  --out NEW_OUTPUT_DIR
```

Replace `PYTHON_EXECUTABLE` with the selected Python interpreter. Run from the
clean source checkout at `FULL_SHA`; the output parent must exist and the output
must be new, outside the checkout or under its ignored `dist/`, and separate from
every input. City input digests must match `deploy/approved-inputs.json`.
The recipe builds and checks hosted/offline teaching files, verifies the source
package, derives both City generations, integrates them, and independently verifies
the complete stage. It neither installs dependencies nor accesses hosting services.

Only a complete verified result is moved to `NEW_OUTPUT_DIR`. Its `stage/site/`
is the served tree, `stage/review/` holds supporting evidence, and
`local-release.json` records `server_side: none` for the verified local stage only.
`build-inputs.json` records source/input digests and runtime versions without machine
paths. Publication and hosted readback remain `NOT_PERFORMED`; the production receipt
is unchanged. Preserve the original inputs for reconstruction. The steps below cover
additional release checks and separately authorized publication.

1. Run the City Python and Node suites, the teaching-lab Node suite and Hermes
   checks. Run the boundary suite with `FLEET_PLAYGROUND_BASE=bca4ccd`; do not
   count a missing-base skip as a completed release gate.
2. If City content changes, build a new viewer from the stored recordings. No new
   simulation arms are needed for interface or publication fixes. Export only the
   allowlisted public study guides and blank worksheets. Validate current and rollback.
   For a teaching-only addition, reuse the verified current City viewer, sanitized
   rollback and source offer, and prove that every City payload remains unchanged.
3. Build the root teaching site and offline file with `playground/fleetlab/tools/pack.mjs`.
   Use `integrate-site.py` with the preserved original root and readback, the selected
   City viewer, a sanitized prior viewer, the complete source offer, and new output.
   The security client update declares three replaced source modules: setup codec,
   setup sharing and Studio. The October 9 `--flow-update` additionally declares
   the NF-01/NF-02 route, catalog, teaching frames, Fleet day links, stylesheet,
   shared charts, the film lifecycle, depot model/presentation modules, and the hosted capacity bench/guide/CSS/source sidecar. The October 10 follow-up adds only the named route-local guide module to that inventory. It rejects undeclared changes, compares copied payloads
   with validated digests, and rechecks the client inventory before finalization.
   All City payloads and source offers are preserved by that update.
4. Commit reviewed source before final integration. Build the teaching site with pack.mjs `--source-commit` set to the exact commit;
   use that same `--source-commit` for integration. The capacity sidecar must bind
   committed source/tool bytes and the deterministic page transform. Inspect `review/integration-manifest.json`; package only its `site/`.
   Never upload the repository, a working directory, or a legacy-only build.
   For the October 12 source-package release, also run
   `node playground/fleetlab/tools/package-proof.mjs --site PACKED_SITE --playground playground/fleetlab --offline OFFLINE_FILE --source-commit FULL_SHA --out PACKAGE_DIR`
   and pass `--teaching-package PACKAGE_DIR` to integration. This adds exactly a
   source archive at its SHA-256 path and `downloads/teaching-package.json`.
   The proof reproduces the teaching build and checks original-source, emitted,
   closure, compressed/extracted archive, media and offline budgets separately.
   The deployment guard rechecks the package and teaching payload against the
   source checkout, even if an integration manifest was resealed. Root HTML,
   boot, headers and hosted integration assets are independently reproduced
   from source by the upload guard. Deleting package markers cannot bypass it. A content digest
   does not authenticate the producer. NF04-B adds explicit owner-aware counters, a separately scoped software-delivery sidecar, integration-original source capture and final transformed route closures. Include the manifest as a declared route input; bootstrap injects it into the UI. All original hard caps remain.
5. For the audits, install the locked deployment tool in `apps/fleetlab-city/deploy` with
   `npm ci --ignore-scripts` (the folder's `.npmrc` also sets `ignore-scripts`); run
   `npm audit --omit=dev` and `npm audit signatures`.
   Also run `npm --prefix apps/fleetlab-city audit --omit=dev` for MapLibre.
   The release wrapper never loads this install (step 6).
6. Use `node apps/fleetlab-city/deploy/wrangler.mjs pages deploy SITE
   --project-name fleetlab --branch codex-city-explorer` for preview. The wrapper
   requires a clean checkout and matching source commit. For every command it installs
   the tool fresh from the committed `package-lock.json` with `npm ci --ignore-scripts`
   into a new temporary directory it owns (npm checks every package against the lock's
   integrity hash), so the git-ignored `node_modules` tree is never loaded. It verifies
   exact upstream CLI bytes and writes a separate serial uploader there as a new file
   (8 MiB buckets, one concurrent Pages request), preserving upstream authentication and
   asset validation. The tools and that copy are deleted when Wrangler exits.
   Wrangler runs in an empty temporary directory with only PATH, HOME, user, shell,
   temp, locale and terminal variables, so `.env` files, `functions/`, Wrangler configs,
   a shared account cache and caller variables (an API token included) are not used.
   `WRANGLER_CACHE_DIR` points at an empty cache inside that run directory, so Wrangler
   never falls back to a `node_modules/.cache/wrangler` above it; with several accounts
   on the login, Wrangler may ask which one to use each time.
   Before uploading it refuses a stage with `_worker.js`, `_routes.json`, `functions/`
   or any `.DS_Store`, `node_modules`, `.git` or `.wrangler` entry; a `functions/` in
   the checkout root or `apps/fleetlab-city/deploy/`; and any Wrangler config or
   `.env` file in the checkout root, the temporary directory or any of their parents.
   Afterwards it fails a deployment list or upload whose Wrangler log shows a compiled
   Worker, a Functions, Worker or `_routes.json` upload, a redirected Wrangler config,
   or an API or token host other than `api.cloudflare.com` and `dash.cloudflare.com`;
   the log is then kept in the temporary directory the error names. Any command also
   fails when the cached `pages.json` names a Pages project other than `fleetlab`.
7. Verify all preview bytes with `tools/readback.py --site SITE --url PREVIEW
   --output PRIVATE_RESULT`. Verify root/City CSP, attachment headers, a real 404,
   malformed links, normal navigation, map/replay and phone-width layout. The
   readback tool verifies bytes/statuses; check response headers with
   `tools/check-headers.py SITE PREVIEW PRIVATE_RESULT`, which also requests
   percent-encoded spellings that only the `/*` rule matches.
   A missing page must return 404 with the security headers and `no-store` cache policy.
   Header rule: `/*` is the only security baseline. Path-specific `_headers` rules may
   relax or annotate it but must never be relied on to restrict.
8. For the currently authorized production release, use the same command and
   stage with `--branch feat/fleetlab-playground`. That branch is Cloudflare's
   production alias; it is not the actual Git source branch.
9. Repeat full byte/header checks on production. Record deployment IDs, prior
   production ID, manifest and source identity, tests and residuals privately.
   Commit the small public digest record only after successful readback.

Wrangler is pinned to 4.148.0. Its image-processing dependency is overridden to
sharp 0.35.5 for GHSA-wq5f-xc86-pv6w. Image processing is not a visitor feature.
No unpinned `npx` resolution is part of this recipe. Dependency audits are dated
observations, not guarantees against unpublished vulnerabilities.

## Before a presentation

Run the receipt-driven, secret-free smoke check from repository root:

```sh
build/fleetlab-city/venv/bin/python apps/fleetlab-city/tools/readback.py --record docs/releases/fleetlab-current.json --url https://fleetlab.pages.dev --output /tmp/fleetlab-smoke.json
```

A digest or status mismatch is a failed check, even if the page returns 200.
This is an on-demand tool; no recurring monitor or telemetry was enabled.

## Privacy and account controls

The local common Git exclude file covers Wrangler caches and private notes.
The publication guard checks staged additions and every outgoing commit for
forbidden paths and credential/home-directory patterns. Local hooks are a backstop,
not an authentication mechanism; do not bypass failures. Never print token values.

Owner follow-up: confirm Cloudflare/GitHub 2FA, audit logs and account membership;
replace broad cached OAuth with an expiring, account-restricted Pages Edit token
held outside the repository. Keep credentials out of agent context and rotate/revoke
old grants after validating the replacement. These account settings were not changed
or independently certified by this release. Shared Hermes CI/branch protections
need a separate repository-policy change; no workflow deployment secret was added.

For a lost or compromised workstation: use a trusted device to revoke Cloudflare
OAuth/API grants, end affected sessions, revoke GitHub tokens/SSH access, review
account audit logs, restore a verified package, and rerun readback. A timed owner
rehearsal and a 30-minute response target remain unverified.

## Rollback and retained content

Use the sanitized compatible viewer named in the current integration manifest for
City-only rollback, rehearsed on a separate local copy. For a whole-site rollback,
Cloudflare's Deployments page can select a previous production deployment, but older
packages may reintroduce the issues fixed here. Prefer redeploying a checked sanitized
package; never silently substitute a legacy-only build. Record the selected source
and compare all bytes and headers after any rollback.

No historical deployment was deleted and the separate legacy project was not
redirected in this release. Inventory and approve a specific retention set before
those actions. Old immutable hosts remain independently reachable. Cloudflare's
[asset retention documentation](https://developers.cloudflare.com/pages/configuration/serving-pages/#asset-retention)
says removed assets can remain at an edge for up to one week. A 600-second browser
cache directive does not provide a ten-minute takedown guarantee. Check both the
current immutable host and stable alias when validating removed paths.

## Hosting trade-offs retained

Public static CORS, the existing chart style policy and the .dev transport posture
remain. No user accounts, runtime AI, API or remote simulation were added. The October 14
release adds the owner-requested Google Analytics tag on the public host; Google
Analytics may use browser cookies. Cloudflare receives hosting requests and may receive
browser network-error reports. No automation or branch protection was enabled by
copying the former CI template; that template has been removed.
