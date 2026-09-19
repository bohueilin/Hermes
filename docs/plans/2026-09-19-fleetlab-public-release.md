# FleetLab public release plan

## Spec and authorization
The user requests a professional website inspired by Waymo's visual restraint, public Cloudflare deployment, publication to `bohueilin/Hermes`, repository integration recommendations, and exact Cloudflare steps in Markdown. This explicit instruction supersedes the historical local-only/no-push restriction for the static playground only. Hermes evidence review and physical-system boundaries remain unchanged.

## Decisions
- Preserve `feat/fleetlab-playground` in its existing worktree and all valid uncommitted 3D work.
- Keep the product inside `playground/fleetlab`; retain a separate static build, no Python runtime coupling.
- Reuse the existing Direct Upload Pages project `fleetlab-playground`, whose production branch is `feat/fleetlab-playground`.
- Publish only validated `dist/site`, never the repository root, evidence artifacts, or the optional Google companion.
- Push the feature branch; recommend a reviewed integration into main, not an automatic merge of the large branch.
- Keep existing protected Python CI unchanged. Document a future isolated GitHub Actions publishing workflow; do not create credentials or change account permissions.
- Independent project identity, no operator affiliation, calibrated capacity, or real-world validation claims.

## Tasks
1. Polish `studio.js`, `styles.css`, and the existing code-native depot illustration for a clear interview introduction, spacious layout, useful calls to action and creator attribution. Preserve simulations, accessibility, offline behavior and existing interface contracts. Validate relevant UI tests and inspect desktop/mobile.
2. Improve repository discovery and sharing metadata. Write `docs/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md` with current project, exact build/deploy commands, optional domain and automation steps, and rollback. Write repository integration recommendation and release record. No shared files with task 1 except final review.
3. Run JavaScript suite, packaging checks, focused Python parity/boundaries, lint, doctor and whitespace review. Review the publication payload. Commit and push the feature branch, deploy the matching static artifact, verify anonymous public rendering and source identity.

## Acceptance
- Clear entry explains what it does, how to try it, why a fleet PM cares, and who built it.
- 18-location 3D fleet day and vehicle profiles remain functional; no horizontal overflow on a phone.
- Existing source and static/offline tests pass; broader inherited Python fixture failures disclosed separately.
- Stable public URL serves the new artifact with expected CSP; GitHub branch contains the source commit.
- User guide distinguishes already completed steps from optional owner actions.
