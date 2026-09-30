# Temporal SF candidate packaging contract

30 September 2026. This implements the already approved versioned export work.
It does not change the recorded experiment, source geography or SF acceptance.

The public viewer will preserve the original recorded map and static candidate.
A separately named temporal candidate will show source-support improvements,
newly blocked roads, actual-time semantics and the remaining review obligations.
Existing depot comparisons continue to use their original map and model.

## Immutable inputs and output

The captured temporal graph is exported without modification: full graph digest
`426201012c7caae963fd71215b38967fbaa46ff18ce43376f729bbd212961de3`.
Its prior static graph is named by the graph's existing baseline digest. Source
candidate IDs, node geometry, road tags, source-node order, geographic scope,
eligibility and district lengths must match the captured prior static pack.
The old municipal/district geometry is retained; the new official full-district
research is not silently adopted. The source XML identity must also match.

Use the existing immutable city-pack container and its exact member manifest;
the inner graph retains temporal-pack schema 3.0.0. A distinct qualification
report schema identifies a temporal engineering candidate. Historical fleet
consumers continue to reject the temporal graph. Container format compatibility
does not imply routing-model compatibility.

Derived members include road display geometry, recomputed source coverage,
source/status transitions in both directions, unchanged district-gap inventory,
source provenance and a new review checklist. Binding validation recomputes these
members from the captured graph and prior pack; rehashing a forged report is not
sufficient. Displayed graph identity covers temporal rules as well as topology.
No arbitrary stored PASS or human response is imported from a previous candidate.

## Review and presentation boundaries

Source budgets and software checks remain separate from city acceptance. The
candidate stays HOLD until district and independent review obligations pass.
A new worksheet must bind the complete candidate identity, changed ways,
conditional and unsupported source rules, district exceptions, 200 source ways
and 100 OD pairs. Prior candidate observations cannot satisfy new obligations.

The completed full-fleet engineering recording may be offered separately with
its exact run, source and verifier identities. It is one synthetic diagnostic,
not a new paired study or an estimate of an operator's performance. The original
invalid verifier report and corrected result remain distinguishable. Connector
model 4 fixtures are not evidence of an SF connector being used in model 3.

Publication requires a complete corresponding map-source offer, compatible
viewer build, preserved original sections/offline content, browser checks,
preview readback and production readback. The frozen power evaluation remains
stopped and is never executed by a packaging command.


## Implemented checkpoint — 30 September 2026

The immutable map is at `build/fleetlab-city/packs/sf-temporal-v3-r2/`.
It includes the complete original temporal graph, projected roads, source
inventory, unchanged geography, derived coverage, exact district gaps, source
transitions and a new review checklist. It is not yet in the public viewer.

| Artifact | Exact identity |
|---|---|
| Candidate bundle | `8a927cba063febeb9edaf99f4ab0e0c05f9a8fe349fd192da9afcbc46355f198` |
| Full graph | `426201012c7caae963fd71215b38967fbaa46ff18ce43376f729bbd212961de3` |
| Review checklist | `6ba7354f8b38aca5e3fd655d23c9c068439f06603c770ca02fa03f61ef37f82a` |
| Current review requirements | `4d43fb2d932b01da27d16055774dfe1b6de141ce342e1a74d9f0248b689c5ac8` |
| Empty history checkpoint | `b1f184bdf132ebd64074333a6036ce747ac33816b5f310822c6b34f90b548ffb` |

Fresh review workspace: `build/fleetlab-city/reviews/sf-temporal-v3-review-r2/`.
Its 2,160 obligations include 200 class-stratified source-way samples and 100
fixed OD pairs. Feature reasons are merged, not counted as independent source
observations. The whole original node pool is checked before sampling; absent
nodes or insufficient population fail instead of silently shrinking scope.
OD instructions explicitly cover 09:59, 10:59 and 14:59 departures and retained
history on the return path. Human observations: zero; acceptance: HOLD.

The original v2 review workspace still reproduces byte-for-byte, including its
requirements, history, checkpoint, envelope and worksheet. The temporal review
r1 is superseded: 324 internal access-block IDs incorrectly appeared as OSM
relations. Independent review reproduced this; the regression failed before the
fix, and r2 merges these reasons into their actual source ways. r1 is retained
with a separate supersession record; none of its bytes or observations changed.

| Packaging phase | Peak resident bytes | Seconds |
|---|---:|---:|
| Build r2 | 2,809,413,632 | 16.954 |
| Independent validation r2 | 3,224,518,656 | 19.143 |
| Final validation + review r2 | 3,255,451,648 | 19.637 |

All phases fit the unchanged 4 GB limit and captured unchanged source hashes.
Reports are under `build/fleetlab-city/validation/sf-temporal-packaging-20260930/`.
Final `review-r2.json` SHA-256: `54cccba00d109511d896ec073b2c0cbcea2cd958f4cbceea86a74b40195ae37e`.
No simulator, power-study arm or repeated full-fleet case ran during packaging.

Twelve new packaging/review tests and all 286 City Python tests pass. Root:
1,661 passes / 56 skips. City Node: 49 passes. Ruff and whitespace checks pass.
Independent review also reproduced and closed two package-boundary defects:
report output could overwrite a new graph member, and container-level trust
claims were not checked. Both have RED/GREEN regressions; invalid paths are now
rejected before writing, and the exact container type/metadata/trust fields are
required even when an attacker recomputes hashes. Final review found no remaining
issue in the scoped changes. The twelve frozen scientific files remain unchanged.

## Commands and next integration step

From the repository root, use the City Python environment. `build` requires a
new candidate directory; `validate` never writes to that directory. Each report
path must be new and outside the input/output bundles. `review` requires a new,
separate workspace and an explicit source-node-pool scenario.

```sh
build/fleetlab-city/venv/bin/python apps/fleetlab-city/tools/package-temporal-candidate.py validate \
  --baseline build/fleetlab-city/packs/sf-v2 \
  --candidate build/fleetlab-city/packs/sf-temporal-v3-r2 \
  --expected-graph-digest 426201012c7caae963fd71215b38967fbaa46ff18ce43376f729bbd212961de3 \
  --report build/fleetlab-city/validation/my-new-map-validation.json
```

The CLI requires the independently selected full graph digest and records its
source hashes, resource measurement and failures. The complete derived database
must be included in the public source offer before the viewer uses its geometry.
Next: export compatible temporal report/review data, add a clearly identified
atlas view and current readiness presentation, update source downloads, then
build and inspect the complete combined website and publish/read back it. Keep
original recorded replay on v1. District adoption, actual human/device/visitor
observations and any scientific-study amendment remain separate open work.
