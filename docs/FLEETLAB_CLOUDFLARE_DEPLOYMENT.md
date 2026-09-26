# FleetLab: Cloudflare publishing and owner steps

## What you need to do now

**No account setup is required for the public Pages address.** Existing authentication was rechecked for this release; the account already owns the project. The public address to share is **https://fleetlab.pages.dev/**. The [source of truth](../HERMES_SOURCE_OF_TRUTH.md#75-fleetlab-playground-teaching-model-not-evidence) records current Austin deployment `f08b6b6f`, published source `345b427`, all 88 matching public payloads and hosted browser checks. The [regional runbook](FLEETLAB_REGIONAL_POWER.md) explains the new slice and [N2 draft](plans/2026-09-25-fleetlab-n2-design.md) describes proposed next work. The [earlier design review](FLEETLAB_REVIEW_AND_NEXT_PHASE_2026-09-25.md), [depot milestones](FLEETLAB_DEPOT_RELEASE_2026-09-24.md), [homepage film](FLEETLAB_FILM_RELEASE_2026-09-19.md) and [Street lab](FLEETLAB_STREET_RELEASE_2026-09-19.md) preserve earlier publication checkpoints and their review scope. The [Claude review packet](FLEETLAB_DESIGN_DATA_AND_N2_REVIEW_2026-09-25.md) contains the new design proposal, Waymo pilot steps and N2 audit. A documentation-only branch head after release does not change the deployed application source.

| Setting | Value |
|---|---|
| Repository | `bohueilin/Hermes` |
| Source branch | `feat/fleetlab-playground` |
| Pages project | `fleetlab` |
| Upload mode | Direct Upload; no Git provider attached |
| Current Pages production branch | `feat/fleetlab-playground` |
| Build working directory | Repository root |
| Public build folder | `dist/site` |
| Build tooling | Node.js 22+; Wrangler pinned to `4.135.0` for this release |
| Website runtime | Static HTML, CSS and JavaScript; no account or backend |

The owner requested the shorter address on September 25 Pacific / September 26 UTC, 2026. Cloudflare Pages cannot rename an existing `pages.dev` hostname, so a new `fleetlab` project now serves the same checked application source `345b427`. Production is `f08b6b6f-c5d0-44f7-905b-5f16087fbc85`, immutable address https://f08b6b6f.fleetlab.pages.dev/. All 88 public payloads matched, response headers were verified, and a browser run reproduced 95/284 completed. The old `fleetlab-playground` project and https://fleetlab-playground.pages.dev/ are preserved for existing links; there is no automatic redirect. Use the new stable address for sharing. [Cloudflare hostname limitation](https://developers.cloudflare.com/pages/platform/known-issues/).

## Repeat a deployment from a reviewed source commit

Run from your Hermes checkout on the intended release branch. Check `git status --short` first; commit reviewed source changes before publishing. These commands stop on any failure:

```bash
set -e
FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 playground/fleetlab/test/*.test.mjs
node playground/fleetlab/tools/pack.mjs --site dist/site
node playground/fleetlab/tools/check-dist.mjs --site dist/site
node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html
git diff --check
npx --yes wrangler@4.135.0 whoami
FLEETLAB_COMMIT=$(git rev-parse HEAD)
npx --yes wrangler@4.135.0 pages deploy dist/site \
  --project-name fleetlab \
  --branch feat/fleetlab-playground \
  --commit-hash "$FLEETLAB_COMMIT" \
  --commit-dirty=false
```

If authentication has expired, run `npx --yes wrangler@4.135.0 login` and complete Cloudflare's sign-in. No token belongs in this repository or in chat. Deploy **`dist/site`**, not `dist`, the source directory or the repository root. The offline HTML is a separate distributable.

After upload, open the stable address in a fresh browser tab. Check the title, Overview film playback and pause, Fleet day, **Run fleet day**, a selected vehicle's next activity, **Street lab → Largest queue → Compare route policies**, and Product approach. Leaving Overview must pause the film. Exercise the [depot lesson recipes](FLEETLAB_DEPOT_M2_M3.md) and [launch rehearsal](FLEETLAB_DEPOT_LAUNCH.md), including stale edits and one-seed labeling; run the separate regional comparison. Confirm the Pages deployment source hash matches the reviewed Git commit. Compare every public file against the local package; request `/` for `index.html`, since Pages redirects the explicit filename. Verify response security headers separately from the package's `_headers` file.

The homepage film and poster are included automatically by the static packer. No video account, API key or Cloudflare Stream setup is needed. The packer enforces a 4 MiB movie limit, 200 KiB poster limit and separate 2.5 MiB application limit. The offline file embeds the poster and retains all simulation tools. Re-rendering is optional: the checked-in MP4 and WebP are the publication inputs; Blender is an authoring tool outside the website build.

Direct Upload supports Wrangler folder uploads. The existing project cannot be converted to native Git integration; a new project would be needed for that route. Keeping this project preserves its current address. [Cloudflare Direct Upload documentation](https://developers.cloudflare.com/pages/get-started/direct-upload/)

## Optional: use your own domain

Only do this if you want a branded address; the Pages address already works.

1. Choose an unused subdomain you own, such as `fleetlab.yourdomain.com`.
2. Open **Cloudflare dashboard → Workers & Pages → fleetlab → Custom domains → Set up a domain**.
3. Enter that exact subdomain and continue.
4. If Cloudflare manages the domain, review and confirm its proposed DNS record. Otherwise, add a `CNAME` at your DNS provider: your chosen subdomain → `fleetlab.pages.dev`.
5. Wait for the custom domain to show **Active**, then test its HTTPS address in a private browser.

Associate the domain inside Pages before adding external DNS. Avoid replacing a record already used by another site. An apex domain requires Cloudflare nameservers; an unused subdomain is the smaller change. [Cloudflare custom-domain instructions](https://developers.cloudflare.com/pages/configuration/custom-domains/)

## Optional: automate future releases through GitHub

This release uses an explicit local upload. Pushing GitHub alone does **not** update this Direct Upload project.

1. In Cloudflare, open **API Tokens → Create Token → Custom Token**. Name it `Hermes FleetLab deploy`; grant **Account → Cloudflare Pages → Edit**, restricted to the account containing this project. Set an expiry appropriate to your release process.
2. In `bohueilin/Hermes`, open **Settings → Secrets and variables → Actions**. Add `CLOUDFLARE_API_TOKEN` as a secret and `CLOUDFLARE_ACCOUNT_ID` as a variable, copied from your project account. Never commit the token.
3. Add a dedicated FleetLab workflow after reviewing the repository boundary-contract change. Use the template below; keep the Python CI independent. No workflow or credential is created by this document.

Cloudflare documents Pages token scope and GitHub secret setup in its [continuous-integration guide](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/).

Suggested `.github/workflows/fleetlab-pages.yml` for a **future reviewed change**:

```yaml
name: FleetLab Pages
on:
  push:
    branches: [feat/fleetlab-playground]
    paths:
      - 'playground/fleetlab/**'
      - 'tests/fixtures/fleet_playground/**'
      - '.github/workflows/fleetlab-pages.yml'
permissions:
  contents: read
concurrency:
  group: fleetlab-production
  cancel-in-progress: false
jobs:
  publish:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Test and build
        run: |
          node --test playground/fleetlab/test/*.test.mjs
          node playground/fleetlab/tools/pack.mjs --site dist/site
          node playground/fleetlab/tools/check-dist.mjs --site dist/site
      - name: Publish checked static files
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}
        run: >-
          npx --yes wrangler@4.135.0 pages deploy dist/site
          --project-name fleetlab
          --branch feat/fleetlab-playground
          --commit-hash "$GITHUB_SHA"
          --commit-dirty=false
```

The current boundary suite freezes `.github` relative to the playground base. A future automation PR must explicitly allow only this isolated workflow and preserve the existing Python CI checks. After main integration, change the trigger and Pages production-branch mapping together. Do not enable deployment on untrusted pull-request code or expose deployment secrets to it.

## Roll back an interview release

The new `fleetlab` project currently has one Production deployment. Historical deployments in `fleetlab-playground` cannot be selected as rollback targets in this different project. If an earlier application must be restored now, rebuild and verify its exact source in an isolated checkout, then upload that checked package to `fleetlab` with matching commit metadata. Once this project has multiple successful Production releases, open **Workers & Pages → fleetlab → Deployments**. On the previous successful **Production** deployment, open its three-dot menu and choose **Rollback to this deployment**. Verify the stable address afterward. Preview deployments are not rollback targets. This changes the served version without rewriting Git history. [Cloudflare rollback documentation](https://developers.cloudflare.com/pages/configuration/rollbacks/)

## Published scope

The public bundle includes only the static playground, its attributed map extracts, and two original film/poster media files. Hermes evidence files, render frames, Blender source scenes, local server tools, credentials and the optional Google Maps traffic companion are outside the upload. The page has no analytics, persistence or external data requests. Google traffic requires separate billing/key configuration and an architecture review before any public integration; it is not active in this release.
