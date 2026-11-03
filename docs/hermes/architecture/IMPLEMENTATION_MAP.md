# FleetLab visual experience implementation map

Date: October 10, 2026 (America/Los_Angeles).

## Authority, scope and starting point

The user explicitly requested reading the October 10 visual brief, building, validating, pushing to the repository and launching the educational site. This overrides AGENTS.md §19's generic no-publication rule for this website release only. It does not change physical/operational deployment authority. The supplied brief is advisory source material; its first vertical slice (stages 0–2) is this release. NF-04 is the separately requested next-step design artifact. Austin, other new cities, the held power experiment and SF qualification are unchanged.

The existing linked worktree is reused on `codex/fleetlab-city-sf`. It began at `1df2e36`; the inspected redesign/capacity branch at `6298929` was integrated by fast-forward without replacing untracked design documents. The current production receipt still identifies `a877ab1` / deployment `c98eb10c` until fresh publication/readback replaces it.

## Resolved ownership

| Task | Allowed paths | Protected boundary |
|---|---|---|
| Welcome and discovery | `playground/fleetlab/src/ui/studio.js`, `simulation-catalog.js`, root `styles.css`, corresponding tests; hosted `integration.mjs`/`integration.css` and tests | Existing routes, shared setups, all 61 lessons, film, City links |
| NF-03 resource bench | `src/ui/depot-capacity-page.js`, `depot-capacity-view.js`, new `depot-capacity-bench.js`, `capacity/visual.css`, `capacity/index.html`, corresponding capacity tests | All model/verifier/data modules and accepted workload/record digests |
| NF-01/02 announcement lifecycle | `src/ui/depot-flow-lab.js`, its UI/learning tests | Scheduling, fixtures, model outputs, exports |
| Hosted provenance/package | `tools/pack.mjs`, `tools/check-dist.mjs`, narrowly declared City integration updates, release-sidecar helper and focused tests | Existing allowlists stay fail-closed; offline cap/reserve; content-addressed City payloads |
| Documentation/release | This map, October 10 plan/handoff/NF-04 design spec, release receipt/runbook | No credentials, private logs, local artifact paths or generated data committed |

## Exact validation commands

From repository root, Node 22:

```sh
node --test playground/fleetlab/test/depot-capacity*.test.mjs playground/fleetlab/test/capacity-site.test.mjs
node --test playground/fleetlab/test/depot-flow-ui.test.mjs playground/fleetlab/test/depot-flow-learning.test.mjs
node --test playground/fleetlab/test/studio.test.mjs playground/fleetlab/test/simulation-catalog.test.mjs
node --test playground/fleetlab/test/*.test.mjs
node --test apps/fleetlab-city/test/*.test.mjs
build/fleetlab-city/venv/bin/python -m unittest discover -s apps/fleetlab-city/tests
node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-visual-oct10/offline.html
node playground/fleetlab/tools/pack.mjs --site dist/fleetlab-visual-oct10/root
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-visual-oct10/offline.html
node playground/fleetlab/tools/check-dist.mjs --site dist/fleetlab-visual-oct10/root
git diff --check
```

Hermes lint/doctor/full tests use the established `hermes-dev` runtime with this worktree on PYTHONPATH and `FLEET_PLAYGROUND_BASE=bca4ccd`. The final handoff records the fully resolved commands, not an inferred pass. Integrate using the existing `integrate-site.py` security/redesign/capacity allowlists, source-frozen commit, preserved City current/rollback/source offer, then preview and production readback per `FLEETLAB_CLOUDFLARE_DEPLOYMENT.md`. Exact artifact arguments are resolved from private local build manifests and recorded in private logs; public handoff records stable source/digest identities.

## Review focus

- Old result versus edited inputs; cancellation and late completion must not change the accepted comparison.
- Play/scrub/selection/resize must not invoke the engine or mutate record digests.
- Upload/energy rate marks must use common physical scales, with exact values beside small marks.
- Old lesson announcements must not survive a route change.
- Hosted-only NF-03 assets must be excluded from the offline module graph; source provenance must be real, non-self-referential and verifiable.
