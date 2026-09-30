# SF power study: proposed memory amendment

29 September 2026. Proposal only. Frozen v1 source, protocol, tapes and preflight evidence remain unchanged. No evaluation directory or arm was created.

## Observed failure and concrete correction

The original 24 preflight runs were internally consistent with zero hard violations. Their peak was 2.38 GB; standalone analysis passed. The evaluation command then exceeded the unchanged 4 GB limit while rechecking preflight. It retains an execution map while analysis loads another map and performs its final recapture. A read-only allocator experiment also failed, peaking at 4,602,757,120 bytes. No evaluation outcome was generated or inspected.

The proposed patch moves fresh preflight analysis **before** acquiring the execution map, releases each raw run after its summary is complete, and releases the analysis map/tapes before the mandatory final recapture. It retains every final mutation check and does not alter the engine, routing, verifier, scientific controls, metrics or thresholds. The exact unapplied change is `.superpowers/sdd/2026-09-29-sf-power-and-integration/memory-amendment-v2.diff`; memory evidence and source hashes are recorded beside it. The active source has not been patched.

The proposed code passed a read-only SF analysis, execution capture and routing preparation at **3,153,264,640 bytes**, leaving **846,735,360 bytes / 21.17%** below the unchanged ceiling. It took 122.482 seconds. All deterministic analysis fields equal the frozen preflight report; only measured timing is excluded. No simulation or evaluation ran, and original source/protocol/tape bytes remain unchanged. Four focused regressions cover ordering, object lifetime and retained tape/arm mutation rejection; the complete temporary-copy City suite passes 122 tests. This is useful resource evidence, not an end-to-end evaluation guarantee. The earlier reorder-only proposal left just 1.59% headroom and is superseded.

## Proposed new frozen revision

A source correction changes a hash bound into the frozen protocol. Keep the original instance and its failure record, and create a new frozen instance at `build/fleetlab-city/studies/sf-power-headroom-v1-r2/` only after the amendment decision.

- Preserve the scientific question, six A/A+B/B × 200/400 kW configurations, fleet, requests, original map/pool/sites, 30/48 kWh controls, fixed 24-repeat analysis, ±1 pp band and all limits.
- Declare fresh preflight seeds **7303001–7303004** and evaluation seeds **7304001–7304024** before any new execution. A structured scan found no prior collisions. These are proposed, not frozen or executed.
- Retain the original unused evaluation tape block as part of the held original instance. This is an explicit whole-instance revision before any evaluation, not replacing an adverse seed or omitting a failed main arm.
- Independently review the patch and meaningful ordering tests, capture the complete new source/protocol/tape identities, then run 24 new preflight arms. If they pass, run the new 144-arm evaluation once.
- The original 24 preflight arms remain historical and are never pooled into the new evaluation. Adding 24 replacement preflight runs raises the total authorized-work estimate from **202 to 226 arms**, including the completed 34-arm historical reproduction.
- Keep the 4 GB process and 2 GB route-table limits. Any subsequent missing, invalid or resource-stopped arm remains explicit and blocks a complete primary; no further automatic revision or replacement.

The scientific study family can retain its existing interface ID; the new protocol digest, directory, declared seed block and predecessor record must make this revision distinct. The UI may only show results from the explicit selected package and must retain its exact protocol identity.

## Decision requested

Recommended: approve this bounded new frozen revision and 24 additional preflight arms. The alternative is to keep the power experiment held and finish the corrected existing-study viewer plus integration preparation. Either choice preserves original evidence and leaves map qualification and production publication separate.

This decision is required because the approved final proposal fixes the protocol before evaluation and declares an initial 202-arm ceiling. A transparent new revision and additional compute are different from silently modifying frozen evidence.
