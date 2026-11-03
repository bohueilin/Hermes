# Versioned SF administrative overlay contract

30 September 2026. Implements the remaining district/scope work in the approved SF completion plan. The existing temporal graph and recorded demand remain immutable.

The question is where each captured road portion is reported, and which source disagreements require a decision. The administrative boundary, captured road context and frozen scenario population are separate inputs. A refreshed reporting layer must never silently remove a request, alter route permissions, change the source denominator or inherit a human review.

## Design decision

Build a separate immutable administrative proposal bound to the existing complete temporal candidate, captured official district geometry, source provenance and one explicit input tape. Keeping the routing graph byte-identical preserves the completed engineering case. Mutating graph metadata would instead require a new graph identity; silently replacing old district fields is rejected. An administrative overlay is not a new fleet run or a new accepted map.

The policy uses exact projected intersections in EPSG:32610 with no snapping, buffering, nearest-district assignment or invented tolerance zone. All eligible source rows are accounted for. City/boundary road portions are clipped to the retained OSM municipality using the established clipping order. Source context outside that municipality is reported separately. Measured projected lengths never replace the frozen graph's existing length denominator.

Every municipal road portion belongs to exactly one accounting category: exclusive district interior/boundary membership, a shared district-boundary portion, or outside the proposed district union. Shared portions are counted once in the partition and remain separately identified; per-district membership metrics may include them in each district and explicitly disclose that difference. Tiny positive residuals remain in totals even when below the display/review threshold. Material polygon-area overlaps, invalid polygons, duplicate/missing districts, missing eligible-road geometry or incomplete source IDs fail validation.

All eleven expected SF districts are required. Raw source SHA-256, decoded geometry digest, policy digest, candidate identity, source inventory and full input-tape digest bind the report. Independent recomputation rejects rehashed changes to counts, geometry, review items, policy and acceptance claims. Output creation refuses existing destinations and commits a complete immutable directory atomically.

The tape report preserves all 220 pool nodes, all 1,200 requests and all initial vehicle entries. It records old municipal membership and proposed district-union membership for every node, changes to request endpoints and affected initial placements. Neither absent inputs nor incomplete geometry may become zero impact.

## Evidence states

- Automated partition/accounting checks: computed from captured geometry.
- Source attribution/redistribution decision: the full ArcGIS source has no explicit license in its captured item, web map or application metadata. Current status remains NOT_ESTABLISHED, not a fabricated PDDL grant.
- Administrative adoption: PROPOSED, not substituted into the current pack.
- Remaining outside/shared road portions: explicit review obligations, never silently assigned.
- Human observations: none generated; source qualification and map acceptance remain HOLD.
- Authenticity: NOT_AUTHENTICATED; authority: NONE; scope: SIMULATION_ONLY.

The public DataSF layers retain their captured CC0/PDDL terms. Fresh current/2022 geometry downloads on 30 September confirm the same trimmed source footprint. The separate full geometry is retained locally for research; public packaging must establish its own redistribution basis before including it. This workflow does not contact source owners or resume the stopped power study.

## Validation

Tests cover full partition and conserved length; shared-boundary double counting; outside context and municipal disagreements; invalid/overlapping/duplicate/missing polygons; source/tape/policy identity changes; missing eligible geometry; changed pool nodes and request endpoints; forged review/adoption claims; output immutability. Run a measured full-inventory derivation and independent recomputation against the exact captured candidate, official source and existing engineering tape, recording source hashes before and after. No simulation is necessary.

Recommendation: adopt reporting semantics only after the actual exception list and source terms are resolved; retain routes and demand until a separately versioned scenario intentionally changes them.

Top risks + mitigations: boundary disagreement is not permission to shrink scope; explicit before/after accounting prevents it. Shared boundary roads must not inflate the conserved total. Source metadata with an empty license is not represented as a grant.

Next 3 actions: implement/test the partition and identity contract; generate the full measured proposal and exception worksheet; resolve source/adoption decisions and bind actual independent observations before publication or SF acceptance.
