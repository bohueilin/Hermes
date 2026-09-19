# FleetLab: Cloudflare publishing and owner steps

## What you need to do now

**No account setup is required for the public Pages address.** The existing Cloudflare account is authenticated on the development machine and already owns the project. The public address to share is **https://fleetlab-playground.pages.dev/**. The [completed release record](FLEETLAB_PUBLIC_RELEASE_2026-09-19.md) identifies deployment `5f2ce6b9`, published source `b65895d`, and the successful public-file and browser checks.

| Setting | Value |
|---|---|
| Repository | `bohueilin/Hermes` |
| Source branch | `feat/fleetlab-playground` |
| Pages project | `fleetlab-playground` |
| Upload mode | Direct Upload; no Git provider attached |
| Current Pages production branch | `feat/fleetlab-playground` |
| Build working directory | Repository root |
| Public build folder | `dist/site` |
| Build tooling | Node.js 22+; Wrangler pinned to `4.135.0` for this release |
| Website runtime | Static HTML, CSS and JavaScript; no account or backend |

The project already existed: production deployment `b6e30d08` served source commit `fb07b66` before this update. A deployment-specific address stays tied to that release; use the stable address above for interviews.

## Repeat a deployment from a reviewed source commit

Run from your Hermes checkout on the intended release branch. Check `git status --short` first; commit reviewed source changes before publishing. These commands stop on any failure:

```bash
set -e
node --test playground/fleetlab/test/*.test.mjs
node playground/fleetlab/tools/pack.mjs --site dist/site
node playground/fleetlab/tools/check-dist.mjs --site dist/site
node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html
git diff --check
npx --yes wrangler@4.135.0 whoami
FLEETLAB_COMMIT=$(git rev-parse HEAD)
npx --yes wrangler@4.135.0 pages deploy dist/site \
  --project-name fleetlab-playground \
  --branch feat/fleetlab-playground \
  --commit-hash "$FLEETLAB_COMMIT" \
  --commit-dirty=false
```

If authentication has expired, run `npx --yes wrangler@4.135.0 login` and complete Cloudflare's sign-in. No token belongs in this repository or in chat. Deploy **`dist/site`**, not `dist`, the source directory or the repository root. The offline HTML is a separate distributable.

After upload, open the stable address in a private browser. Check the title, Overview, Simulation, **Run fleet day**, a selected vehicle's next activity, and Product approach. Confirm the Pages deployment source hash matches the reviewed Git commit. The release record also compares public files against the local package.

Direct Upload supports Wrangler folder uploads. The existing project cannot be converted to native Git integration; a new project would be needed for that route. Keeping this project preserves its current address. [Cloudflare Direct Upload documentation](https://developers.cloudflare.com/pages/get-started/direct-upload/)

## Optional: use your own domain

Only do this if you want a branded address; the Pages address already works.

1. Choose an unused subdomain you own, such as `fleetlab.yourdomain.com`.
2. Open **Cloudflare dashboard → Workers & Pages → fleetlab-playground → Custom domains → Set up a domain**.
3. Enter that exact subdomain and continue.
4. If Cloudflare manages the domain, review and confirm its proposed DNS record. Otherwise, add a `CNAME` at your DNS provider: your chosen subdomain → `fleetlab-playground.pages.dev`.
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
          --project-name fleetlab-playground
          --branch feat/fleetlab-playground
          --commit-hash "$GITHUB_SHA"
          --commit-dirty=false
```

The current boundary suite freezes `.github` relative to the playground base. A future automation PR must explicitly allow only this isolated workflow and preserve the existing Python CI checks. After main integration, change the trigger and Pages production-branch mapping together. Do not enable deployment on untrusted pull-request code or expose deployment secrets to it.

## Roll back an interview release

Open **Workers & Pages → fleetlab-playground → Deployments**. On the previous successful **Production** deployment, open its three-dot menu and choose **Rollback to this deployment**. Verify the stable address afterward. Preview deployments are not rollback targets. This changes the served version without rewriting Git history. [Cloudflare rollback documentation](https://developers.cloudflare.com/pages/configuration/rollbacks/)

## Published scope

The public bundle includes only the static playground and its attributed map extract. Hermes evidence files, local server tools, credentials and the optional Google Maps traffic companion are outside the upload. The page has no analytics, persistence or external data requests. Google traffic requires separate billing/key configuration and an architecture review before any public integration; it is not active in this release.
