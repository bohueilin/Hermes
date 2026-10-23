# FleetLab artwork, transparent logo and Google tag — implementation handoff

**Date: October 14, 2026. Status: published and verified.**

The owner-approved artwork and transparent logo are live at [FleetLab](https://fleetlab.pages.dev/#/overview). The original animation, learning catalog, Fleet day, Street lab, Network Flows and San Francisco City Explorer remain available. This release changes presentation and adds the requested Google tag; it does not qualify SF or introduce a new simulation model.

This handoff supersedes the deployment identity in [the October 13 visual handoff](FLEETLAB_VISUAL_EXPERIENCE_HANDOFF_2026-10-13.md), while preserving its outstanding SF, device and human-review limitations. The [publication runbook](FLEETLAB_CLOUDFLARE_DEPLOYMENT.md), [release plan](FLEETLAB_ARTWORK_RELEASE_PLAN_2026-10-14.md) and [public readback receipt](releases/fleetlab-current.json) are updated.

## What changed and why

- **Home:** the approved “Readiness, made visible” depot scene introduces the fleet-readiness question. The accompanying buttons open depot operations or scroll to and play/replay the existing concept film.
- **Explore / Network Flows:** the approved “Same work. Different order” scene introduces shared delivery. NF04 and Delivery order include it in a collapsed disclosure, keeping comparison controls prominent.
- **Brand:** the approved transparent PNG logo replaces the rectangular logo treatment across the root site, NF03, NF04, Delivery order and City Explorer. It uses the existing warm background; no solid logo panel is added. Responsive sizes and visible keyboard focus are retained.
- **Analytics:** Google tag `G-04EZ8EZWQ2` appears once, immediately after the head element, on each of the eight current public HTML documents. Collection is enabled only for `fleetlab.pages.dev`; local and immutable preview hosts set Google's measurement-disable flag. The async tag resource may still load on previews. This is collection suppression, not a promise of zero third-party network requests.
- **Disclosure:** current public pages disclose Google Analytics and Cloudflare hosting. The offline edition remains analytics-free; obsolete hosted “no app analytics” wording was corrected.

The images are clearly labeled concept illustrations, separate from recorded depot imagery or simulation results. No affiliation with Waymo, Zoox or their partners is claimed.

## Asset provenance

The owner supplied `FleetLab Logo.jpeg`, `Depot Studio_ Readiness made visible.png` and `Shared work, different order.png`. The logo's transparent-background edit was generated with the built-in image tool in the preceding preview task and approved by the owner before this release. The exact approved preview assets were integrated; original owner inputs remain unchanged and were not staged in the Git release.

Production media lives in `apps/fleetlab-city/brand-media/`, with byte sizes and SHA-256 pins in `hosted/brand-assets.json`. Total artwork: **1,714,931 bytes**, under the separate 2 MiB hosted-media cap. The 2,172 × 724 RGBA PNG contains actual transparency, not a background-colored rectangle. The source offer includes media paths and hashes; binaries are served at the pinned `/site-media/` paths.

## Preservation and trust boundaries

- Original film MP4, poster, `hero-film.js` and 2,562,865-byte offline edition are byte-identical to the prior deployment.
- A new immutable City presentation was derived from the verified original viewer. Only `index.html`, its gzip copy, `network.json` and `_headers` change inside the file inventory; the release manifest records the new presentation and its bound external assets. **4,941 City payload files remain unchanged**, including the app, maps and recordings.
- The prior current City generation is retained byte-for-byte as rollback, with its original restrictive CSP and no analytics. Historical rollback HTML and downloadable offline artifacts deliberately do not receive the new tag.
- The City source-offer index and manifest reflect the new presentation; **12 other source-offer payload files remain unchanged**.
- The source-bound upload guard reproduces root HTML, owned assets and City presentation. It rejects changed artwork and changed/resealed recordings. Content hashes demonstrate internal consistency, not independent authenticity.
- SF qualification remains **HOLD**. Operational deployment permission remains **NONE**. Vehicle safety, regulatory compliance, map qualification and real-device/human acceptance are not established by this website release.

## Exact release identity

| Item | Observed value |
|---|---|
| Application source commit | `698f8272502c6211340f653408b0fa1ec1a6ea64` |
| Git branch / remote | `codex/fleetlab-city-sf` / `github` (`bohueilin/Hermes`) |
| Production deployment | `f6c88a3b-9ac5-4f8d-bb47-b5960968be6e` |
| Immutable production URL | https://f6c88a3b.fleetlab.pages.dev |
| Preview deployment | `8b5473f7-c06a-4743-95dd-208b201b2315` |
| Previous production | `c1da5337-1ff7-40df-ad1a-5f33fb73d1e5` |
| Current City generation | `city-explorer/releases/0c493355ecacbd36` |
| Retained City rollback | `city-explorer/releases/c56bda6b509105c5` |
| Integration manifest SHA-256 | `986b8eaa78490b881c0923a9e12f468203695235ea15ebc0885917ea99edefda` |
| Production full readback completed, UTC | `2026-10-14T07:27:17.732584+00:00` |

Preview and production used the same checked directory without a rebuild between uploads. The application commit was pushed before production publication. A subsequent documentation-only commit contains this handoff and the observed release receipt; that later commit is not a different deployed application.

## Validation results

| Check | Result |
|---|---|
| Teaching Node suite | 2,337 pass; 8 existing skips; 1 todo; 0 failures |
| City Node suite | 77 pass |
| City Python suite | 342 pass |
| Hermes pytest with boundary base `bca4ccd` | 1,662 pass; 55 existing environment/optional skips |
| Ruff / Git whitespace | Pass |
| Hermes doctor in clean release checkout | 18 PASS; 1 optional display NOT_AVAILABLE |
| Frozen NF04 study | 16 runs match generated module |
| Frozen Delivery order study | 8 complete studies / 192 records, plus 8 equal-share records checked |
| Independent final review | No blocking findings; focused 9/9 tests pass |
| Deployment dependency audit | 0 known vulnerabilities; 38 registry signatures / 22 attestations verified |
| MapLibre dependency audit | 0 known vulnerabilities |
| Exact committed-source build / package / upload guard | Pass; 10,076 staged files |
| Preview readback | 10,075 / 10,075 served files match; 27 / 27 headers |
| Stable production readback | 10,075 / 10,075 served files match; 27 / 27 headers |
| Immutable production smoke | 39 / 39 match |
| Prior production smoke | 32 / 32 match |

Browser observations include desktop Home, phone layouts at 320 and 390 CSS pixels, transparent logo and image loading, Explore navigation, NF04 artwork disclosure and checked playback, Delivery order reconstruction, NF03 header, and the SF road map. No page overflow or console warnings/errors were observed on those tested views. Live Home's original film played from `/media/fleet-film.mp4` with ready state 4 and the Pause control visible. These are browser viewport checks, not a new physical Pixel or human qualification claim.

### Commands used

```sh
node --test playground/fleetlab/test/*.test.mjs
node --test apps/fleetlab-city/test/*.test.mjs
build/fleetlab-city/venv/bin/python -m unittest discover -s apps/fleetlab-city/tests
PYTHONPATH=src FLEET_PLAYGROUND_BASE=bca4ccd conda run -n hermes-dev python -m pytest -q
conda run -n hermes-dev python -m ruff check .
PYTHONPATH=src conda run -n hermes-dev python -m hermes doctor
node playground/fleetlab/tools/software-delivery-study.mjs --check
node playground/fleetlab/tools/delivery-order-study.mjs --check
git diff --check
```

The exact build script, test logs, readbacks, header checks, preservation comparison and screenshots are retained privately under `build/fleetlab-city/validation/artwork-20261014/`. Final payload: `build/fleetlab-city/artwork-20261014/reviewed/`. The source-bound release uses the pinned City Python **3.11.15**; changing Python can alter gzip header bytes and correctly fail the independent Node reproduction check.

## Packaging measurements

| Counter | Bytes | Limit |
|---|---:|---:|
| Raw teaching source and tools | 3,010,842 | 3,145,728 |
| Legacy text | 2,612,012 | 2,621,440 |
| Offline edition | 2,562,865 | 2,571,440 |
| Package metadata | 32,189 | 32,768 |
| Final integrated emitted text | 2,901,170 | 3,145,728 |
| Final NF03 text closure, including brand JS/CSS | 484,422 | 524,288 |
| Final NF04 text closure, including brand JS/CSS | 147,325 | 524,288 |
| Final Delivery order text closure, including brand JS/CSS | 151,249 | 524,288 |
| Hosted artwork, counted separately from text | 1,714,931 | 2,097,152 |
| Complete non-City generation | 9,210,114 | 14,360,576 |

Whole staged site: **1,622,441,662 bytes / 10,076 files**, including retained City generations and source offers. One `_headers` control file is not served as an asset. No existing hard cap was raised. Media use is 994,944 bytes for the logo on NF03/City; NF04/Delivery order can use 1,313,485 bytes including shared-delivery artwork; Home/Explore can use all three assets. Cached reuse and lazy loading affect transfer timing, not these storage counts.

Only **579 bytes** of package-metadata headroom, **8,575 offline bytes** and **9,428 legacy-text bytes** remain. Any substantial next feature needs an explicit packaging design decision rather than hiding new payload from a counter.

## Negative results and limits retained

Initial fixture omissions for the new media owner and lint formatting failures were fixed. A development source-capture test detected a formatting edit during capture; after source stopped changing the full suite passed. These failures were retained in private logs, not bypassed.

Google Analytics property receipt was **not observed**: this release verifies the requested code, duplicate prevention, finite CSP permissions, production host guard and served pages, but does not log into Analytics or claim a Realtime/DebugView event. Google Analytics may use cookies on the public host. No custom visitor identifiers, application-result events or account integrations were added.

Independent SF source/map review, physical-device coverage and visitor comprehension remain separate open work. Earlier security account follow-ups, qualification limits and low-fidelity simulation assumptions remain as documented in the previous handoffs. No Austin work, new city expansion, simulation arms or hardware actuation occurred. Existing open tabs may retain old cached assets until reloaded; readbacks attest to the observed URLs at the recorded time.

## Recommendation

Use this published generation for the next presentation and design feedback. The approved visual treatment is integrated and the requested publication work is complete.

## Top risks + mitigations

- A polished concept image could be mistaken for evidence: keep the illustration labels and visible simulation/qualification boundaries.
- Analytics installation could be mistaken for confirmed reporting: have the property owner check Realtime once; no additional deployment approval is needed for that read-only check.
- Tight legacy and metadata budgets: decide package ownership before adding another substantial model or visual payload.

## Next 3 actions

1. Open the live Home and Explore pages to present the approved imagery alongside the retained animation and checked Network Flows lessons.
2. Confirm incoming visits in the owner's Google Analytics property when convenient; gather physical-device and human feedback separately.
3. Choose the next bounded Network Flows question and its packaging budget before implementation. Keep SF qualification claims unchanged until their independent prerequisites are met.
