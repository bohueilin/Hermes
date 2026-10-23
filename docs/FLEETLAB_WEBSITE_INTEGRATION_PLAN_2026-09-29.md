# FleetLab website integration plan

29 September 2026. Presented before shared-site implementation. The owner approved the SF build and asked how it will fit into `https://fleetlab.pages.dev/`. The owner confirmed the top-level City Explorer tab and authorized integration, validation and live publication. No existing experience is removed.

## Recommended visitor experience

### Preservation requirement clarified by the owner

The owner explicitly wants to retain the existing FleetLab content and does not authorize migrating the whole website to City Explorer. The root Overview remains FleetLab's front door, including its animation/concept film. Fleet day, Street lab, Four-area experiments, Scale lab, Learning catalog, Product approach and the guided walkthrough remain accessible with their existing routes, content and interactions. City Explorer is an additional experience. There is no proposed removal or retirement of these sections, and no root redirect to City Explorer.

The standalone City Explorer preview shows only the new application because it is a development/test entry point. It is not the complete-site integration preview. Before integration is presented as complete, add the agreed shared entry points and a clear return to FleetLab, and demonstrate navigation between the existing experiences and City Explorer. Preserve the current site's animation and design character; harmonize the addition with them.

Any later proposal to remove, rename, consolidate or replace an existing experience must be raised explicitly with the owner and must not be bundled into this addition. References to the existing code as “legacy” in engineering records mean the preserved established edition, not a product deprecation decision.

Add **City Explorer** to FleetLab's main navigation immediately after **Fleet day**. It is a site-navigation item and opens in the same browser tab. Keep the existing Fleet day, Street lab, Four-area experiments and Scale lab identities. At narrow widths it appears in the existing **Explore** menu; collapse before links overflow rather than shrinking the text.

Add one focused homepage feature card: **“San Francisco, one working day.”** Its explanation: “Explore a sourced city map, compare depot and charging decisions, then follow one vehicle's trips and queues.” The action is **Explore San Francisco**. Label it **Recorded experiments · synthetic operations**. Existing interactive teaching lessons retain their own entry points.

The proposed path is:

```text
FleetLab overview
  → City Explorer / San Francisco
      Start here
        → City atlas
        → Decision notebook
        → Replay studio
```

Use the shared FleetLab name, warm palette, typography and button language. Inside City Explorer, show the SF context and a clear **Back to FleetLab** link. FleetLab's brand returns to the main overview; an explicit City Explorer home action returns to the city's start view. Navigation must not misleadingly imply that the legacy lesson engine generated City Explorer's recordings.

For this release, Decision notebook contains the reviewed twelve-pair depot study. The new power-study software exists, but its SF evaluation is held pending a separate execution amendment; no new results are published. The visitor should understand the question, fixed controls, changed parameter, recorded outcome and limitation before opening detailed evidence. No nonfunctional Run button and no implication that changing a recorded selection launches a simulation.

## Route and packaging

Use `/city-explorer/` as the public entry path, with stable links to `#welcome`, `#atlas`, `#compare` and `#replay`. Retain current versioned release directories and query/hash-preserving routing. The viewer loads only its own same-origin assets when opened; visiting the main site does not preload the full SF map.

This is a separate static application within one website. Avoid an iframe or shared simulation runtime. Do not insert city assets into the offline teaching bundle. Preserve compatible prior viewer/data versions and the original public legacy bundle for rollback.

The hosted integration is an intentional, narrow change to main navigation, one overview card, corresponding catalogue/context copy if necessary, and route-specific headers. It must have its own explicit before/after inventory; the older staging tool's “all 99 legacy files unchanged” claim cannot be reused for a bundle that changes the homepage/navigation. Offline bytes stay unchanged unless separately approved.

## Validation and launch sequence

1. Build and validate the SF corrections and bounded power study, keeping old evidence intact.
2. After the placement choice, construct the combined hosted preview with only the declared integration edits.
3. Check root and city deep links, reload/Back, active navigation, return links, mobile Explore menu, keyboard access, missing-data states and flat-map fallback.
4. Verify original legacy lessons, numerical pins and offline size/integrity. Check city file, initial-transfer and selected-replay budgets; no hidden third-party calls.
5. Inspect effective root/city response headers in hosting preview, complete the redistribution/attribution record, and rehearse the current/prior release switch.
6. Present the exact preview, changed-file inventory, outstanding device/human/map findings and rollback. The owner has authorized publication after these checks; record exact deployment identity and readback.

Recommendation: top-level **City Explorer** plus the SF homepage card. This makes it discoverable without replacing existing lessons or forcing the city renderer into their runtime.
