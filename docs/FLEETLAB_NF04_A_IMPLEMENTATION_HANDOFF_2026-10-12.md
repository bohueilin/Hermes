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
- First preview header check caught Cloudflare concatenating the inherited 600-second and new archive one-year Cache-Control values. Publication was held; the new rule now explicitly removes the inherited header before setting immutable caching. The source-bound header test failed before the correction. Final hosting recheck is required. A private header helper initially used the system Python (without datetime.UTC); it was rerun with the project Python 3.11 environment.
- Initial doctor: 17 PASS, 1 expected dirty-checkout WARN, 1 optional NOT_AVAILABLE. A clean release-checkout result is required before publication.
- Current live NF-03 baseline: Watch reconstructs the comparison; Trade-off shows B2 at minute 18 and both whole-run outcomes; 390/320-pixel inspection shows no horizontal overflow and switching arms preserves B2/time.

Final source/package measurements, whole-patch review and publication results are recorded below when performed. This implementation-stage draft is not a publication receipt.

## What remains after this bounded release

NF04-B remains a separate implementation: engine and independently implemented verifier, accepted pair/projection, shared-clock bench, causal inspector, static chapters and finite six-beat guide. Test one-vehicle, slow-local, zero-cap, staggered transfers, failures, censoring, horizon and discretization cases before accepting results. Preload UI follows later with the settled accounting windows.

Physical Pixel testing is unverified: Android Debug Bridge returned no attached devices on this pass. Native reduced-motion/data-saving, screen-reader, 200% zoom, browser-family and device-performance checks remain separate. The first NF-04 default/max cases must measure reconstruction, verification, cancellation, seeking, serialized size and peak memory; input ceilings are not performance evidence.

Independent human comprehension remains open. Use the three tasks in the design spec; never convert automated browser checks into human comprehension evidence. SF remains HOLD / BLOCKED_MAP_QUALIFICATION. Austin expansion and the held power study remain paused. Q1, Q8 and N2 retain their distinct documented scopes.

Recommendation: finish the bounded packaging proof and use the Oct12 contract/design for the next NF-04 build review. Top risks are causal misattribution, hidden earlier work, misleading byte accounting and overclaiming browser or simulation evidence; the contract, independent checks and explicit evidence limits address these. Next three actions: validate/publish this package, review the first NF-04 slice against the frozen contract, then authorize and implement that slice with measured device and human acceptance.
