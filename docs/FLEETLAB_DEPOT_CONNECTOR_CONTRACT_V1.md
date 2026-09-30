# Explicit depot circulation connectors

30 September 2026. Implementation increment under the approved SF continuity
plan. Simulation only. This closes the positive connector contract with an actual
traversed path; it does not supply private-yard geometry or physical maneuver
validation, and does not change any historical study or SF recording.

## Decision

A connector is a declared circulation path on the captured road graph, beginning
and ending at a declared depot's anchor node. It runs before a nonempty departure
whose incoming edge and restriction prefix match the declared trigger. Each edge
must obey the existing continuity, access and actual-time rules. There is no
reset of history, artificial initial placement, implicit reversal or teleport.
A zero-length leg preserves state and does not trigger circulation.

This is the lowest existing fidelity that can represent a reviewed depot
departure transition with accountable travel time, distance and energy. A future
private-yard maneuver requires a separate geometry/dynamics contract; drawing
an assumed loop cannot establish that a physical depot supports it. No connector
is added to SF merely because a node has an inconvenient departure.

## Identity and declaration

Use model `fleetlab.graph-resource-depot-connectors/4.0.0` and run schema
`fleetlab.city-depot-connector-run/4.0.0`, over a validated temporal v3 source pack.
The new model consumes a nonempty list of at most 32 connector declarations and
one review record per declaration. The continuity v2 and temporal v3 entrypoints
reject these new fields. Frozen v1 code retains its historical unknown-field
behavior; it is not a connector consumer and cannot validate this contract.

Each declaration carries an ID, pack digest, scenario-core digest, depot ID,
exact trigger incoming edge/prefix, explicit edge sequence, declared duration in
integer milliseconds, declared distance in meters and bounded provenance text.
The scenario-core digest covers the complete scenario except the connector and
review lists; the full scenario digest covers both lists too. This avoids a
self-referential digest while rejecting stale source, scope, cost or scenario
claims. Duplicate IDs/triggers, extra reviews and absent/stale reviews fail.

Review records bind the complete declaration digest and distinguish a contract
fixture review from a recorded external review. Neither method authenticates a
person or grants road permission. Test fixtures use only fixture review records;
agents cannot manufacture human observations. Source/map qualification remains
separate and unavailable for a merely fixture-tested connector.

## Execution and independent verification

The router validates the declaration and each actual-time connector traversal,
retains the resulting incoming state, and plans the remaining leg from that state
at the connector's end instant. The combined leg must fit the unchanged journey
horizon. If the connector or continuation is unavailable, no route is fabricated.
The connector path is part of the ordinary leg's recorded edges, motion, energy,
travel time and partial-horizon position. Its transition record includes ID,
declaration/review digests, provenance, before/after state and declared cost.
This record describes the planned prefix; an unfinished trace must not claim that
the entire connector executed.

The verifier checks the full edge sequence independently using the temporal and
continuity verifiers. It also reconstructs connector metadata from the scenario
and source rules, checks the exact required prefix and resulting state, and
rejects omitted, substituted or invented transitions. It never calls route search
or trusts producer permission flags. The existing resource/energy reducer counts
connector edges normally; no second fleet clock or special free movement exists.

## Acceptance fixtures

1. A valid declared loop changes the arrival edge through actual graph traversal;
   an integrated fleet run preserves it across service and independently verifies.
2. Missing/stale pack, scenario, declaration or review identity is rejected.
3. A prohibited connector turn, active temporal closure or unavailable onward
   route yields no modeled continuation; no implicit repair is attempted.
4. Zero-length legs and unrelated arrivals do not trigger a connector; initial
   placement is not treated as a matching arrival.
5. A partial connector at the horizon counts only entered/executed edges and
   leaves the unexecuted suffix as planned evidence.
6. Forged metadata, omitted prefixes, altered cost/state/provenance and changed
   connector definitions fail independent verification.
7. Old temporal runs remain accepted by their existing verifier; v2/v3 consumers
   cannot silently ignore a connector declaration. Frozen v1 is unchanged.
8. A nonempty route returning to its starting node cannot masquerade as a
   zero-length leg, alter arrival history and evade the declared connector.

SF remains HOLD. No SF connector, named vehicle calibration, human map review or
physical maneuver result is supplied by these fixtures.

## Validation — 30 September 2026

Twelve connector tests and all 274 City Python tests pass. The shared-core root
suite has 1,661 passes / 56 skips; Ruff and whitespace checks pass. Doctor reports
16 PASS, two environment/dirty-worktree warnings and one optional display
NOT_AVAILABLE. No browser code changed. The twelve frozen scientific source files
remain byte-identical to commit `7cf32c5`.

Independent review reproduced a P1: an undeclared circulation leg ending at its
starting node bypassed the endpoint-based connector match. The new literal test
fails before correction and passes after the verifier rejects nonempty
same-endpoint legs. Review of the correction found no remaining issue. Earlier
RED/GREEN fixtures also cover combined-query work accounting and v3 rejecting a
rehash that adds unsupported connector declarations.

Together with the existing continuity and fleet integration tests, this closes
the eight hand-checkable implementation fixtures in the continuity design. It
does not replace source review, SF resource qualification of a future connector
scenario, private-yard dynamics or physical evidence. No SF run, scientific arm
or public deployment was performed for this connector checkpoint.
