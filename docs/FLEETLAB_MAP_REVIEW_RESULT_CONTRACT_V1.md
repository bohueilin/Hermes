# SF map source-review result contract — design v1

Implementation update, 29 September 2026: `citylib/map_review_v1.py` now validates
bounded review histories; `tools/map-review.py` prepares and validates workspaces.
The first frozen workspace is `build/fleetlab-city/reviews/sf-v2-review-r1/`.
Its requirements digest is
`b32ab2e295c67c22a820b65b4a9a8fab4b347a2ea3ed230e252b4fabc98d98d8`;
the independently retained initial history checkpoint is
`b1f184bdf132ebd64074333a6036ce747ac33816b5f310822c6b34f90b548ffb`.
No actual human observations have been supplied. Qualification remains HOLD.

The runtime embeds bounded UTF-8 captures in one JSON document instead of
resolving external capture paths. Capture SHA-256 identities are checked. New
records can only reference evidence already present in their first manifest.
Human samples must match the frozen feature/OD roster and cannot be counted
twice. Conflicting complete resolutions keep the obligation open. Resolver and
reviewer identity declarations remain unauthenticated. See the current
[completion record](FLEETLAB_SF_COMPLETION_STATUS_2026-09-29.md) for wider gates.

The following is the original design record; its future-tense status is historical.

29 September 2026. This specifies how actual review observations can be recorded without editing the frozen `sf-v2` checklist. No human observations are invented by this document, and no existing NOT_RUN gate changes.

## Why a separate result

Current candidate binding correctly requires its frozen human checklist to remain `NOT_RUN` with no results. That establishes what was outstanding when the candidate was made. Review evidence should be a new immutable artifact, followed by a derived qualification envelope bound to both the candidate and the review artifact.

```text
frozen candidate + frozen review requirements
  + immutable review observations + source capture identities
  → review validation
  → qualification envelope with explicit remaining gates
```

The display consumes the envelope; it cannot implement review sufficiency or change statuses itself. Review validity, gate decision, authenticity and deployment permission remain distinct.

## Proposed observation schema

`fleetlab.map-review-result/1.0.0` is a proposed contract, not an installed parser. A result contains:

- Review ID and schema version; exact candidate pack, graph, checklist and source digests.
- Reviewer identifier and role, observation timestamp/timezone, method (human source inspection, automated reconciliation or field observation), and tool versions where relevant. Automated checks cannot be labeled human observations.
- Stable OSM way/relation IDs or district-gap IDs; source URLs and captured source revision/digest. Newer live source information is supplementary until a new source snapshot is registered.
- What was checked: direction/access/restriction chain, connector topology, district attribution, coordinate projection or another named obligation.
- Observation, supporting evidence references and rationale; unresolved ambiguities are explicit.
- Disposition: `SOURCE_CONFIRMED`, `SOURCE_CONFLICT`, `UNRESOLVED`, or `NOT_REVIEWED`. “Confirmed” means the inspected claim matches the named source; it does not mean road legality, completeness or safety.
- Proposed action as a separate field: retain conservative block, require new parser fixture, register source correction, propose scope policy, or no change. A proposed action is not automatically executed.
- Affected routes/classes/districts and required fixture IDs, with explicit absence if not determined.

Results use an append-only workflow. A correction creates a new result that references the superseded result; both remain. Each versioned canonical manifest binds ordered observation IDs/digests, resolution records, referenced captures and the preceding manifest digest. Validation requires an expected manifest digest retained separately by the review consumer (for example in the frozen qualification requirements/checkpoint). A regenerated local manifest cannot replace that expected identity. The consumer may accept a later manifest only through an explicitly recorded update that preserves the prior chain and records its expected new digest.

This detects mutation or removal relative to a known, externally retained checkpoint; it does not prove that all historical observations were ever submitted, nor independently authenticate the checkpoint, reviewer or source. With no expected checkpoint, report internal consistency only and leave history completeness unverified. Qualification may not treat an unanchored history as complete.

## Conflict-resolution records

`fleetlab.map-review-resolution/1.0.0` is a separate proposed record. It names the exact claim/obligation, candidate and source snapshot; all conflicting observation IDs/digests; the resolver identity and claimed role; the requirements-manifest rule authorizing that role to resolve this obligation; the selected interpretation; supporting captured evidence; rationale; timestamp; and remaining uncertainty. The original observations remain visible. A resolution may select a supported source interpretation or retain the block; it cannot grant driving legality or deployment permission.

The requirements manifest freezes permitted resolver roles and any independent-review requirement before observations are considered. Resolver-role declarations are not authenticated in this version: they can support only a transparently attributed source-review decision, not proof of who performed it. A missing role rule, unmet independent-review requirement, unsupported interpretation, omitted conflicting observation or stale snapshot prevents closure. Another contradictory observation reopens the obligation until a new resolution references the complete conflict set. A later `SOURCE_CONFIRMED` observation, a superseding correction or a newer timestamp alone never resolves a conflict.

## Validation and sufficiency rules

Reject unsupported schema, unsafe paths, stale candidate/source identities, duplicate observation IDs, malformed or unbounded records and missing referenced evidence. Contradictory observations stay visible and block closure until a valid resolution record covers the full conflict set under the frozen requirements. An observation cannot declare itself sufficient for a whole gate.

The separate requirements manifest names the mandatory routes/features, stratified sampling obligations and unresolved exception queues before review. Required source samples include the existing at-least-200 stratified segment/junction and 100 OD review requirements; previously automated samples do not silently satisfy human semantic inspection. Mandatory-route defects remain blocking unless routes are explicitly disabled under a reviewed scenario version.

The current queue contains 411 restored-road entries, 310 restriction exceptions and 108 district-gap entries: 829 queue entries across different categories, not a claim of 829 unique roads or 829 independent observations. Work can be linked to more than one obligation without inflating the number of independent checks.

Qualification is derived from complete required coverage, unresolved conflicts, class/district budgets, source accounting and the independent continuity contract. Passing one priority list or a class percentage cannot bypass other gates. Missing evidence remains NOT_RUN/UNRESOLVED, never zero or PASS.

## Prioritized source work now available

`build/fleetlab-city/validation/power-v1/map-priority-queue.json` identifies all **26 unsupported trunk/living-street ways**, with captured tags, blocking relation IDs/tags, source links and projected city length. It prioritizes the two living-street records, then larger affected trunk lengths. Each remains `review_status: NOT_RUN`.

The list includes Lombard Street, South Van Ness Avenue, Van Ness Avenue, 19th Avenue, Maiden Lane and Bridgeview Paseo. It is a navigation aid for the complete review, not permission to restore roads. Conditional restrictions need their exact conditional expression, applicable vehicle class, temporal context and source semantics interpreted before implementation. Do not strip conditions simply to satisfy a threshold.

The exact district queue remains `build/fleetlab-city/packs/sf-v2/district-gaps.json`, with source links and geometry. The three official district-layer comparisons remain in `build/fleetlab-city/research/districts/assessment.json`; a different endpoint alone did not remove the gaps.

## Negative acceptance cases for future implementation

1. Rehashed observation for another pack/source is rejected.
2. A live-page assertion without captured revision cannot silently supersede the frozen source.
3. A source conflict plus a confirming result remains unresolved until a valid resolution names every conflicting observation and satisfies the frozen role/evidence requirements. An additional conflicting observation reopens the obligation.
4. Twenty-six priority ways marked inspected do not close the complete stratified review.
5. An automated result mislabeled as human cannot satisfy a human obligation.
6. Valid observations with missing district or continuity evidence produce a held qualification envelope.
7. Result deletion, reordering or referenced-capture mutation relative to the expected manifest fails integrity validation, including a locally regenerated manifest. Duplicate IDs fail structurally. Without a retained expected checkpoint, completeness stays unverified rather than being inferred from fresh hashes.
8. Text is escaped and source paths remain bounded; reviewer content is data, never code or UI instructions.

## Current disposition

Contract designed; runtime result validator and human review are not implemented/completed in this M1 design deliverable. The candidate remains map-only with the execution guard unchanged. Use this contract to record real review and plan the next independently testable implementation, without altering historical claims.
