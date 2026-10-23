# FleetLab NF04-A implementation handoff

October 12, 2026 · Educational website · NF04-B has not started.

This release addresses the Revision 3 design audit by freezing the bounded numerical contract and implementing a source-package proof for the existing website. The current NF-03 learning experience, all earlier lessons, offline edition and San Francisco City Explorer are preserved. The new visitor-facing addition is a footer link to the teaching source and build receipt.

## Audit decisions and next design

- [Finding-by-finding decisions](FLEETLAB_REV3_AUDIT_DECISIONS_2026-10-12.md): M1–M3 accepted; M4 chooses one deduplicated build and one atomic release; V1 stays an NF-04 acceptance requirement.
- [Numerical contract and packaging decision](FLEETLAB_NF04_A_CONTRACT_AND_PACKAGING_PROPOSAL_2026-10-12.md): cold/repeated contract, exact allocator/cursor, rates, timing boundaries, failure states and limits.
- [Next experience design](FLEETLAB_NETWORK_FLOWS_NEXT_DESIGN_SPEC_2026-10-12.md): first cold-cache versus repeated-delivery vertical slice, shared clock, inspector, guide, static/mobile paths and discriminating verification fixtures.

M1 separates a selected request's transfer rate from aggregate shared traffic and explains zero caps without inventing congestion. M2 puts both preload arms in the same recording window; the default cold/preload full WAN totals are 12/12 GB, with elapsed readiness from common P at 474/378 seconds. M3 declares N×S repeated-buffer provision versus S cache provision; these are sufficient-capacity assumptions, not measured disk costs or occupancy. These are design specifications, not executed NF-04 results.

## Implemented boundaries

`package-proof.mjs` reproduces the existing teaching site/offline file from the exact source commit, captures original text/tools and validation policy, pins separately served media, and creates a compressed source archive at its SHA-256 path. A small receipt reports source, emitted, route-closure, archive and offline accounting separately. It does not create a backend, simulator, paid API, extra city or independent deployment pipeline.

Integration accepts exactly the receipt and immutable source archive, verifies them against the reviewed client/offline/source, copies them without modifying existing teaching/City inputs, and binds them into its final whole-site inventory. The publication selector points to the receipt. The upload guard reproduces and checks the teaching package again, beyond checking the integration manifest hashes. It independently reconstructs root HTML, boot, headers and hosted integration assets, rejects marker removal and closes the non-City inventory against unexpected files.

The existing legacy text gate remains 2,621,440 B; offline remains under that ceiling with a 50,000 B reserve. Additional proof metadata/source storage has explicit gates. No original runtime bytes are moved into a new accounting category. The tiny future Explore-link fixture is measured privately and not published as a working NF-04 route.

The immutable Cloudflare deployment URL preserves a generation for reproduction. The stable alias remains convenient for visitors, but browser caches or requests spanning a deployment switch may mix generations; this release adds no runtime session pinning. Full readback establishes consistency at measurement time. Digests do not establish independent authenticity or real-world authority.

## Validation recorded during implementation

- Existing packer baseline: 43 passed before changes.
- New integration prerequisite test failed before the option existed, then passed.
- Source-checkout-required upload test and conditional footer-link test failed before implementation, then passed.
- Teaching Node: 2,200 passed, 8 existing skips and 1 existing TODO; 43 focused packer tests passed.
- City Node: 70 passed; City Python: 334 passed.
- Hermes: 1,662 passed, 55 skipped with the required playground comparison base supplied.
- Ruff: passed after correcting one overlong header string; no behavior changed by that correction.
- Dependency observations: deployment and map audits report zero vulnerabilities; 38 registry signatures and 22 attestations verified.
- Package proof: 7 focused tests passed, including archive restoration and deliberate provenance/inventory mutations.
- Review found package-marker downgrade and resealed root-shell bypasses; both failed before fixes and passed afterward. The new packaging tool also required an exact filesystem/writer allowlist entry; two full-suite policy failures were corrected without broadening browser code permissions.
- First preview header check caught Cloudflare concatenating the inherited 600-second and new archive one-year Cache-Control values. Publication was held; the new rule now explicitly removes the inherited header before setting immutable caching. The source-bound header test failed before the correction. The final preview and production hosting rechecks both passed. A private header helper initially used the system Python (without datetime.UTC); it was rerun with the project Python 3.11 environment.
- Initial doctor: 17 PASS, 1 expected dirty-checkout WARN, 1 optional NOT_AVAILABLE. The final clean release result below supersedes that checkout warning.
- Current live NF-03 baseline: Watch reconstructs the comparison; Trade-off shows B2 at minute 18 and both whole-run outcomes; 390/320-pixel inspection shows no horizontal overflow and switching arms preserves B2/time.

## Final release receipt — October 12, 2026

This bounded NF04-A release is **LIVE**. Source and header corrections are pushed to `github/codex/fleetlab-city-sf`. The same integrated artifact passed preview and was published to production; no build was substituted between them.

| Identity | Verified value |
| --- | --- |
| Released source | `eef0180e160671efa1fd9202321096741dbd27f9` |
| Stable site | https://fleetlab.pages.dev/ |
| Immutable site | https://3d23afce.fleetlab.pages.dev/ |
| Preview deployment | `5e1bbbab-ceee-4537-923c-162c73b4aa05` |
| Production deployment | `3d23afce-4404-430b-a5d2-a543a45c6754` |
| Prior production retained | `1b5e00d3-70c0-4182-83c4-9f19fcaba11e` |
| Final inventory SHA-256 | `b6e946b3cab3c09a483c63ea15685db80b66ef01f427dbdc652269ecf73bfbf9` |
| Whole physical integration | 10,040 files / 1,620,357,054 B |
| Preview readback | 10,039/10,039 served files, 12/12 header checks |
| Stable production readback | 10,039/10,039 served files, 12/12 header checks |
| Immutable production smoke | 15/15 files, including receipt, archive and integration script |
| Measurement completed UTC | 2026-10-13T05:46:18.464999+00:00 |

The root `_headers` file is deployment configuration and is not itself served, explaining 10,040 packaged versus 10,039 served files. All **9,908 City/source-offer files, 1,613,222,668 B**, are byte-identical to the previous integration. The complete 2,549,837 B offline edition is unchanged. The full previous 10,038-file integration (1,619,535,612 B) was restored locally and checked against its original inventory and publication selector; its immutable host passed 12/12 smoke checks. No scientific records were regenerated and no production rollback was performed. Retained prior City and source-offer copies count as physical files; none are hidden by content deduplication.

The source-bound upload guard accepted the actual Python-generated integration, confirming the independent JavaScript root/header transform agrees. Clean release doctor: **18 PASS, 1 optional NOT_AVAILABLE**. The cache correction passed its four guard tests and 23 integration tests after the earlier full suites. The reviewed toolchain remains pinned; the CLI's incidental update notice did not trigger an upgrade.

### Measured package budgets

| Counter | Actual bytes | Gate / remaining |
| --- | ---: | --- |
| Legacy teaching text | 2,621,323 | 2,621,440; **117 remaining** |
| Original source, tools, validation policy and license | 2,765,799 | 3,145,728 |
| NF-03 complete dependency closure | 489,894 | 524,288; 34,394 remaining |
| Receipt metadata | 26,342 | 32,768 |
| Teaching text plus receipt | 2,647,665 | 3,145,728 |
| Source archive, compressed / extracted | 794,409 / 2,860,033 | 4,194,304 each |
| Teaching text plus compressed source | 3,442,074 | 7,340,032 |
| Media | 1,112,617 | Existing film/poster gates preserved |
| Offline | 2,549,837 | 21,603 discretionary bytes after 50,000 reserve |
| Teaching input-generation subtotal | 7,104,528 | Before integration-owned additions |
| Complete non-City generation | 7,134,386 | 14,360,576 including root, footer, headers and publication metadata |

The private future discovery-link fixture costs **80 source B / 80 emitted B**, yielding 2,621,403 legacy B and **37 B remaining**. This is a minimal link, not a full design card or proof that NF-04 fits. It is not published and no dead NF-04 control was added. A complete card, route and shared dependencies must be remeasured; any legacy growth must fit its unchanged owner gate or recover source-preserving space.

- [Live teaching package receipt](https://fleetlab.pages.dev/downloads/teaching-package.json)
- [Original source archive](https://3d23afce.fleetlab.pages.dev/network-flows/sources/b5821706919dd9efcc5093314a991651f74a605ced963ff4b93b12f92310dddd.json.gz) — SHA-256 `b5821706919dd9efcc5093314a991651f74a605ced963ff4b93b12f92310dddd`.
- Media are separate, exact path/length/hash-pinned inputs. The archive carries every original teaching module and tool, HTML/CSS, validation policy and license. Restoration tests rebuilt the payload/offline bytes; original Git identity is required for the exact provenance sidecar. It is not a self-contained City dataset or media bundle.

### Negative evidence, review and browser observations

Two full teaching-suite policy failures initially exposed that the new packaging tool was absent from the exact filesystem/writer allowlists; only that bounded tool and its named imports were added. Final teaching suite: **2,200 pass, 8 existing skips, 1 existing TODO**. City Node: **70 pass**; City Python: **334 pass**; Hermes: **1,662 pass / 55 skip**; Ruff and publication/diff guards pass. The package tests include no-follow/path/size refusal, independently restored source, exact commit/tool binding, changed shared payload, altered closure and ownership, extra/missing archive, wrong pointer and mixed source generation. The release review found and fixed package-marker downgrade and resealed root/hosted-asset bypasses; red/green results are retained privately. No material finding remained in the reviewed scope.

The first preview `bd6cf0ff` failed its archive cache header check (11/12), so production was held and its full byte readback was interrupted. Cloudflare joined the inherited and new Cache-Control values. A narrow `! Cache-Control` removal corrected the rule; the final preview and production both passed **12/12** checks. No header-test threshold was relaxed. The historical public receipt also had stale aggregate manifest/count metadata; this receipt regenerates every aggregate from the actual final inventory rather than copying those fields.

Browser observations cover the homepage entry into NF-03, reconstruction of all four comparison cells, Trade-off B2 at minute 18, and phone arm switching at 390/320 CSS px without resetting B2/time or losing the 132.3/70-minute and 3/12/3/12 outcomes. The new footer link is visible at 320 px without horizontal overflow. The source receipt/archive URLs pass byte and header readback. Clicking JSON did not navigate the in-app browser into a rendered document, so receipt rendering is not claimed as a browser result. A production page smoke and source-link check are recorded separately from the earlier preview interaction. Native preferences, screen-reader and physical Pixel testing remain unverified; ADB listed no attached device.

### Commands and reproduction

Commands used for verification (private environment/output prefixes omitted):

```sh
node --test playground/fleetlab/test/*.test.mjs
node --test apps/fleetlab-city/test/*.test.mjs
python -m unittest discover -s apps/fleetlab-city/tests
PYTHONPATH=src FLEET_PLAYGROUND_BASE=bca4ccd python -m pytest -q
python -m ruff check .
PYTHONPATH=src conda run -n hermes-dev python -m hermes doctor
node playground/fleetlab/tools/pack.mjs --out OFFLINE_FILE
node playground/fleetlab/tools/pack.mjs --site PACKED_SITE --source-commit eef0180e160671efa1fd9202321096741dbd27f9
node playground/fleetlab/tools/check-dist.mjs OFFLINE_FILE
node playground/fleetlab/tools/check-dist.mjs --site PACKED_SITE
node playground/fleetlab/tools/package-proof.mjs --site PACKED_SITE --playground playground/fleetlab --offline OFFLINE_FILE --source-commit eef0180e160671efa1fd9202321096741dbd27f9 --out PACKAGE_DIR
node playground/fleetlab/tools/package-proof.mjs --check-integrated INTEGRATED_SITE --playground playground/fleetlab --source-commit eef0180e160671efa1fd9202321096741dbd27f9
python apps/fleetlab-city/tools/publication-guard.py --staged
git diff --check
node apps/fleetlab-city/deploy/wrangler.mjs pages deploy INTEGRATED_SITE --project-name fleetlab --branch codex-city-explorer
node apps/fleetlab-city/deploy/wrangler.mjs pages deploy INTEGRATED_SITE --project-name fleetlab --branch feat/fleetlab-playground
python apps/fleetlab-city/tools/readback.py --site INTEGRATED_SITE --url https://fleetlab.pages.dev --output PRIVATE_READBACK_JSON
```

Use the [deployment runbook](FLEETLAB_CLOUDFLARE_DEPLOYMENT.md) for the exact legacy/City/offline integration recipe, explicit `--teaching-package`, locked install, header checks and historical rollback handling. `OFFLINE_FILE`, `PACKED_SITE`, `PACKAGE_DIR`, `INTEGRATED_SITE` and `PRIVATE_READBACK_JSON` denote the actual private output paths recorded below, not literal shell variables. Node was 22.22.0; Python was 3.11.15. The full Node suite keeps its existing optional performance skips; it is not a newly executed latency benchmark.

Build outputs are under `dist/fleetlab-nf04a-oct12-v2/`: `offline.html`, `release-root/` and `package/`. Generated evidence is ignored and private under `build/fleetlab-city/validation/nf04a-20261012/`. Final package: `build/fleetlab-city/nf04a-20261012/integrated-release-v2/site`. The small public receipt is `docs/releases/fleetlab-current.json`. Four pre-existing untracked Oct9 owner documents were preserved and excluded from commits. Earlier Oct10 handoffs remain historical.

## What remains after this bounded release

NF04-B remains a separate implementation: engine and independently implemented verifier, accepted pair/projection, shared-clock bench, causal inspector, static chapters and finite six-beat guide. Test one-vehicle, slow-local, zero-cap, staggered transfers, failures, censoring, horizon and discretization cases before accepting results. Preload UI follows later with the settled accounting windows.

Physical Pixel testing is unverified: Android Debug Bridge returned no attached devices on this pass. Native reduced-motion/data-saving, screen-reader, 200% zoom, browser-family and device-performance checks remain separate. The first NF-04 default/max cases must measure reconstruction, verification, cancellation, seeking, serialized size and peak memory; input ceilings are not performance evidence.

Independent human comprehension remains open. Use the three tasks in the design spec; never convert automated browser checks into human comprehension evidence. SF remains HOLD / BLOCKED_MAP_QUALIFICATION. Austin expansion and the held power study remain paused. Q1, Q8 and N2 retain their distinct documented scopes.

Recommendation: accept the completed current-source package proof and use the Oct12 contract/design for the next NF-04 build review. Top risks are causal misattribution, hidden earlier work, misleading byte accounting and overclaiming browser or simulation evidence; the contract, independent checks and explicit evidence limits address these. Next three actions: review the frozen first NF-04 slice, authorize its engine/verifier/UI implementation and remeasure the complete card/route budgets, then collect physical-device and independent comprehension evidence before treating the lesson as qualified.
