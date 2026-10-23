# SF fleet continuity — engineering checkpoint, 30 September 2026

Static cross-leg continuity is integrated into a separately versioned fleet runner
and independent verifier. This is a local engineering checkpoint. It is not a new
public fleet study, a completed map qualification, or another power-study retry.
The public site remains production deployment `a9f05880-a7c7-426f-b5ee-567a39cf0fce`.

## Installed behavior

`fleetlab.graph-resource-continuity/2.0.0` consumes the arriving road and restriction
prefix for pickup, passenger travel, return-to-depot and dispatch feasibility.
Boarding, charging, turnaround, idle intervals and zero-length trips preserve that
state. Initial-node placement is explicit and occurs once per vehicle.

Run schema `fleetlab.city-continuity-run/2.0.0` records the exact pack/scenario,
UTC departure, planned before/after states and actual boundary states. At a
truncated horizon, the final vehicle position distinguishes fully traversed edges,
the elapsed fraction of an entered edge, and the unentered planned suffix.
Only executed distance is counted. No partial endpoint becomes a new graph node.

The independent verifier reconstructs edge history from source rules and events;
it never calls route search or trusts producer permission flags. Resource and
energy accounting retain the existing event ledger. Duplicate final requests,
changed request inputs, forged ownership/timestamps, missing positions and malformed
JSON containers are rejected. Required history is bounded by the longest source
restriction, retaining at least the previous edge for node turns.

All 12 source files frozen by power protocol
`9a738e81dec4c14b1b6e2a000cb1c4cf4833a005445e1b3e1e9caddb57ceaa3a`
match their recorded SHA-256 values. The old runner's candidate guard remains.
Internal consistency does not confer map qualification or recommendation eligibility.

## SF-sized diagnostic

The unchanged SF v2 graph contains 261,455 source nodes, 186,927 directed edges and
2,179 restrictions. The router's original 250,000-node structural bound could not
admit it. The revised structural bound is 300,000 nodes; per-search state budget
is 250,000, work budget remains 2,000,000, and the process ceiling remains 4 GB.
Search remains on demand with bounded caches; no all-pairs table is allocated.
Indexed rule matching agrees with the reference scan on all tiny-graph pairs,
both algorithms and distinct incoming states.

31 source prohibition sequences contain an edge absent from the routable graph:
26 `no_u_turn` and 5 `no_left_turn`. They are preserved as inert prohibitions,
without restoring an absent edge. Missing edges in an `only_*` required sequence
still reject the graph; disconnected adjacent present members still reject it.

The fixed 100 OD samples from the existing review requirements were checked with
A* and Dijkstra, then checked on their return journey with the outbound arrival
history retained and a declared 30-second stop. There were 400 route searches:
380 returned ROUTE and 20 returned NO_MODELED_CONTINUATION. Both algorithms agreed
on status and cost. Concatenated outbound/return paths passed direct source-rule
inspection. No context/resource overflow occurred. Unavailable continuation is a
modeled outcome, not a road-legality conclusion.

Elapsed diagnostic time: **88.925 seconds**. Observed process peak:
**1,535,672,320 bytes**. This is one fixed routing diagnostic, not a full fleet
resource qualification or an independent human observation.

Evidence: `build/fleetlab-city/validation/sf-continuity-20260930/routing-100.json`.
SHA-256: `86ad95453df30b67686491ec889ed24038f798fbd4ca3404069e2903719ec24f`.
Pack digest: `2d4f21c7148c6d2fb4393f36d750be576b2aa4e44810d10a482f4dbdf74ff67d`.
Requirements digest: `b32ab2e295c67c22a820b65b4a9a8fab4b347a2ea3ed230e252b4fabc98d98d8`.
Failed diagnostic attempts and the 31-sequence audit remain in the same directory.

## Validation

- 29 new integration tests, including the review reproductions observed failing
  before the fixes; 223 City Python tests pass in total.
- 49 City JavaScript tests pass; 1,661 root Python tests pass, 56 skip.
- Repository Ruff and whitespace checks pass.
- Doctor: 16 PASS, 2 WARN (shell environment and uncommitted work), one optional
  display check NOT_AVAILABLE; no FAIL.
- Independent review identified malformed-container exceptions and unchecked final
  request ownership/inventory. Both are fixed and covered by regression tests.
- ADB currently lists no connected device. No physical-device pass is claimed.

The frontend and public study files were not changed in this checkpoint, so the
previous deployment/browser readback remains the release evidence. There was no
new website deployment and no additional power evaluation arm.

## Recommendation

Continue source-backed conditional import and declared temporal/access semantics,
then explicit connector contracts and full SF fleet resource qualification. Keep
SF acceptance HOLD until the remaining requirements are actually satisfied.
Austin is the next requested city after SF acceptance; the older San Mateo-first
ordering is superseded, while its source research remains available.

## Top risks + mitigations

Static routing cannot interpret conditional road permissions. The new runner does
not consume raw conditional rules. No connector, reversal or physical maneuver is
invented. Automated OD checks cannot satisfy the frozen independent human sample.
The failed power evaluation remains incomplete and requires a reviewed repair and
new execution decision before any additional scientific run.

## Next 3 actions

1. Integrate supported captured conditional semantics under a separately identified
   context policy, preserving unknown source cases and all historical packs.
2. Complete connector, memory and review evidence; collect actual map, device and
   visitor observations without substituting synthetic responses.
3. Publish the qualified SF update, record acceptance and proceed to Austin.
