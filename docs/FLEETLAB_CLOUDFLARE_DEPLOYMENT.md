# FleetLab publication runbook

Updated 9 October 2026. Applies to the static educational FleetLab website.
Hermes operational deployment permission remains NONE. Historical deployment
paragraphs and the old playground-only CI template are superseded; do not use them.

## Release identity and authority

The stable site is https://fleetlab.pages.dev/. Use its `/publication.json`
for the selected City release, compatible sanitized rollback, offline digest
and exact source commit. That file records packaging intent, not proof of
hosting. Compare it with the committed `docs/releases/fleetlab-current.json`
and run the readback tool to establish which bytes are actually served.

The owner explicitly authorized Git push and publication of the October 9
Depot flow learning update, following the authorized October 8 release. An audit, handoff,
successful verifier, Git branch label or this runbook never grants authority for
a future release. Follow the user's
actual instruction. Account/credential changes and destructive retention actions
are separate decisions; no document can authorize them by itself.

## Build and verify

Use the project's Python 3.11 environment for these tools. The Mac's default
Python may be older; use `build/fleetlab-city/venv/bin/python` explicitly.

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
   shared charts and ten depot model/presentation modules. It rejects undeclared changes, compares copied payloads
   with validated digests, and rechecks the client inventory before finalization.
   All City payloads and source offers are preserved by that update.
4. Commit reviewed source before final integration. Set `--source-commit` to the
   exact commit. Inspect `review/integration-manifest.json`; package only its `site/`.
   Never upload the repository, a working directory, or a legacy-only build.
5. Install the locked deployment tool in `apps/fleetlab-city/deploy` with
   `npm ci --ignore-scripts`; run `npm audit --omit=dev` and `npm audit signatures`.
   Also run `npm --prefix apps/fleetlab-city audit --omit=dev` for MapLibre.
6. Use `node apps/fleetlab-city/deploy/wrangler.mjs pages deploy SITE
   --project-name fleetlab --branch codex-city-explorer` for preview. The wrapper
   requires a clean checkout and matching source commit. It verifies exact upstream
   CLI bytes and generates a separate serial uploader (8 MiB buckets, one concurrent
   Pages request), preserving upstream authentication and asset validation.
7. Verify all preview bytes with `tools/readback.py --site SITE --url PREVIEW
   --output PRIVATE_RESULT`. Verify root/City CSP, attachment headers, a real 404,
   malformed links, normal navigation, map/replay and phone-width layout. The
   readback tool verifies bytes/statuses; inspect response headers separately.
   A missing page must return 404 with the security headers and `no-store` cache policy.
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

Run the six-request, secret-free smoke check from repository root:

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
remain. No user accounts, runtime AI, API, remote simulation, analytics, cookies or
visitor storage were added. Cloudflare receives hosting requests and may receive
browser network-error reports. No automation or branch protection was enabled by
copying the former CI template; that template has been removed.
