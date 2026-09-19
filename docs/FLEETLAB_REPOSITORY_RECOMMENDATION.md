# FleetLab in Hermes: repository recommendation

## Current state

The original playground was already pushed to the public `bohueilin/Hermes` repository on `feat/fleetlab-playground`. Both local and remote branches pointed to `fb07b66ddaa786020f2176efdb82727bd55c5d4b` at the start of this release. The 3D Bay Area simulation, vehicle profiles and redesigned experience were local changes. This release publishes those changes to the same feature branch; the release record identifies the resulting commit.

No existing pull request was found for this branch. Main was `bca4ccd4d881e58904e59bb1b1ff594442099654`. The previously pushed branch already differed from main by 108 files and roughly 103,450 added lines, much of it implementation and fixtures. A public demo does not require merging that entire branch immediately.

## Recommendation

**Keep FleetLab in Hermes, with a clearly separated static playground and release path.** It is a useful entry into the repository's broader thesis: make a decision testable, preserve the experiment, and inspect its trade-offs. A separate repository would duplicate contracts and weaken the connection to the underlying experiment work. Reconsider extraction only if contributors, ownership or releases become operationally independent.

| Surface | Responsibility | Release boundary |
|---|---|---|
| `playground/fleetlab/` | Browser teaching models, 3D replay, product narrative and learning catalog | Independently packed static site |
| `src/hermes/fleet/` | Python experiments and evidence contracts | Existing Python distribution and checks |
| `tests/fixtures/fleet_playground/` | Explicit parity vectors for shared semantics | Regenerate only with a documented reason |
| `tools/map-data/` | Attributed OSM extraction and provenance | Source tooling; never a website backend |
| `tools/fleetlab-traffic/` | Optional local Google traffic companion | Separate configuration; not publicly hosted |
| `docs/FLEETLAB_*` | Model limits, design rationale, release and publishing guides | Reviewer documentation |

The website should remain an independent project by Bo-Huei Lin. Fleet operations and depot optimization are its PM themes: user decisions, constrained resources, measurable outcomes and the fidelity needed to support a claim. Do not frame illustrative output as Waymo capacity, operating results, an operator service-area map, or evidence of deployment readiness.

## How to integrate into main

1. Share the public website and feature source now. Use a draft pull request to review the full branch, organized around presentation, model semantics, data provenance and packaging.
2. Resolve the inherited full-Python-suite fixture failures in the appropriate core workstream. The focused playground parity/boundary suite is necessary but does not establish that all Hermes tests pass.
3. Merge only after that review and required checks. Then add a narrowly scoped FleetLab CI/deployment workflow, explicitly update the existing `.github` boundary restriction, and move its deployment trigger to main. Keep generated `dist/` and artifacts untracked.

The root README links directly to the public demo and playground documentation so a hiring manager can find the experience without understanding the Python CLI. The source branch is the authoritative home until main integration is reviewed.

## Top risks and mitigations

- **Visual confidence can exceed model fidelity.** Keep sourced geography separate from editable operational assumptions; pair replay with measurable outcomes and unfinished work.
- **A large branch can hide regressions.** Review model, UI and package changes separately; retain focused parity coverage and report broader test limitations.
- **Git and hosted code can diverge.** Publish a checked build with its source commit attached; record the deployment URL and validate public bytes.

## Next three actions

1. Use the stable Pages link in the interview and demonstrate one vehicle's full operating cycle.
2. Review the feature branch for main integration, including the inherited core-test fixture issue.
3. Optionally add a custom subdomain and the isolated publishing workflow described in the Cloudflare guide.
