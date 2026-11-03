# NF04-B contract amendment and implementation interfaces

October 13, 2026 · Contract document 1.1.0 · User-authorized implementation.

The accepted consolidated brief is normative for this slice; Oct12 A1 allocator mathematics remains unchanged. This amendment supersedes the older missing-cap normalization, nonempty inventory extension, arm-reset instruction, browser refinement reconstruction and literal catalog-link proposal. None had shipped as an NF04 runtime contract. First input, record, verifier and manifest schemas are 1.0.0. No migration is required. Existing NF03 records are protected.

## Common canonical input

`normalizeDeliveryInput(raw)` accepts only own plain data with exact keys; rejects getters, symbols, inherited fields, sparse/extra arrays, unsafe integers, negative zero and unknown fields. Return a detached canonical object sorted by ASCII request ID. Canonical serialization and SHA256 utilities may be shared, no runtime policy helpers.

```js
{
 schema: 'fleetlab.software-delivery-input/1.0.0',
 P_ms: 0, H_ms: 2400000, quantum_ms: 1000,
 artifact: {id:'update',version:'1',digest:'0000000000000000000000000000000000000000000000000000000000000000',size_bytes:12000000000,available_at_ms:0},
 requests: [{id:'V1',arrival_ms:0,deadline_ms:480000,check_ms:60000,check_outcome:'pass',activation_ms:30000}],
 resources: {wan:{aggregate_Bps:125000000,transfer_cap_Bps:125000000},local:{aggregate_Bps:250000000,transfer_cap_Bps:250000000}},
 inventory: []
}
```

Bounds are accepted brief §5 plus Oct12 A2/A3. Artifact id/version are nonempty ASCII `[A-Za-z0-9_.-]` strings of at most64 characters; digest exactly64 lowercase hex. It names a synthetic identity, not actual binary verification. Request IDs `[A-Za-z0-9_-]{1,28}`. Explicit nonempty inventory is `unsupported-mode: inventory`. No preset ID enters input identity. `deliveryInput(preset='default',quantum_ms=1000)` returns detached values for `default`, `one`, `slow-local`, `two-arrivals`, exactly brief§6 public cases. Policy is separate `repeated`/`cold`.

## Serialized record shape

`runDelivery(input,policy)` returns this plain record. Canonical digest is SHA256 of all record fields except `record_digest`. `input_digest` is canonical common input SHA256. All numeric fields are safe integers or explicit nullable timestamps.

```js
{
 schema:'fleetlab.software-delivery-record/1.0.0',
 policy_version:'capped-equal-share/1.0.0',
 input, input_digest, policy,
 universe:[{id,resource,owner_kind,request_id}],
 boundaries:[{t_ms,arrivals:[],source_available:false}],
 resources:[{t_ms,resource,cursor_in,cursor_out,budget_bytes,unused_bytes,
   eligible:[{id,remaining_bytes,cap_bytes,grant_bytes}]}],
 tasks:[{t_ms,phase,owner_kind,request_id,type}],
 inventory:[{t_ms,type:'commit',artifact_id:'update'}],
 outcomes:[{id,arrival_applied_ms,wan_completed_ms,local_completed_ms,
   check_started_ms,check_completed_ms,activation_started_ms,
   ready_ms,failed_ms,deadline_ms,wan_bytes,local_bytes}],
 metrics:{request_count,on_time_count,all_ready_ms,terminal_ms,wan_bytes,local_bytes,unique_artifact_bytes,storage_provision_bytes},
 record_digest
}
```

`universe` is all transfer IDs sorted ASCII, resources `wan` or `local`. Owners `request` with exact request ID, or `depot_cache`/null. Cold fetch ID is `depot-fetch`, repeated `wan-ID`, all local `loc-ID`. Each resource cursor starts at its first ASCII transfer ID. Resource rows are boundary-major, then WAN then local, including H with0 budget/grants/eligible and unchanged cursor. Remaining bytes are before next-slot grant; cap_bytes is declared per-slot cap (not limited by remaining). Eligible includes0 grants, unknown/ineligible IDs forbidden. Engine emits ASCII-ordered eligible arrays; schema canonicalization sorts eligible arrays by ID and the verifier independently compares their sorted unique IDs, preserving the older serialized-eligible-permutation identity fixture. Boundary arrivals are IDs first due at this boundary, sorted; source_available is cumulative boolean. Source/arrival raw timestamps remain in input.

Events in `tasks` are transitions only, never repeated state. Types: `wan_received`, `local_received`, `check_started`, `check_passed`, `check_failed`, `activation_started`, `activation_completed`, `ready`. Shared depot WAN receipt is depot_cache/null; no cold request-owned WAN receipt. A cold request's wan_completed_ms is null and wan_bytes0 (shared receipt is the prerequisite, not its owned traffic). Inventory commits only cold completed object; repeated inventory empty. Source/arrival transitions are boundary fields, not duplicate tasks.

Total task ordering: t_ms, phase, owner key (depot first; request ASCII ID), chain position by type order above. Phase1 prior interval/task completion; phase3 zero-duration start/completion closure; phase4 readiness; phase5 positive task start. A same-boundary zero activation after a positive check completion closes atphase3. Receipt atH permits zero closure; positive tasks never start atH. At most32 task terminal transitions at one boundary. `activation_completed` atphase1 for positive orphase3 for zero; `ready` alwaysphase4. A check's configured failure is revealed only at its completion. All times include pending-null values, no future outcome leaks into current-state projection.

`terminal_ms` is latest ready/failed time if every request terminal, otherwiseH. `all_ready_ms` null if any failed/unfinished. on_time_count compares non-null ready to exact raw deadline inclusively. All ledgers include work throughH. Byte totals count useful transfers once; unique_artifact_bytes=S in both, storage_provision_bytes=N*S repeated /S cold. Each record entry is one boundary, resource row, nested eligible row, task transition or inventory event; metadata/outcomes not entries but serialized bytes still bounded. Keep130000 entries,32MiB record,64MiB pair; first-slice maxima from brief§5.5.

## Independent verifier boundary

`verifyDelivery(record)` returns `{ok,errors,metrics,record_digest,input_digest}`; invalid results have null metrics/digests and named errors. It independently derives universes, owners, eligibility, all per-slot grants/cursors, task transitions, outcomes and metrics. It may import only the contract and canonical/digest utilities transitively; no engine, allocator, projection or engine-generated expectation module. It rejects malformed/oversize records before replay. Compare individual sections with discriminating labels before digest checks. Independent mutation tests must run wrong-cursor and early-local variants, not just conservation.

## Projection and published manifest

Build-time generator runs and independently verifies both arms at1000 and250ms for each public preset. `DELIVERY_STUDY` has schema/version, case name/input/input_digest, primary arms `{record_digest,metrics}`, refinement `{quantum_ms:250,input_digest,arms:{record_digest,metrics},differences}`. No full records shipped. Pair loader checks manifest schema and canonical inputs, both verification results, both digests and exact metrics before replacing accepted pair. Projection consumes only accepted records, makes indices once, and supplies all visible/static quantitative facts. Narration is bound only to exact default identity; phone visible arm is persistent independent view state.

## Authority and outstanding qualification

The Oct13 user request authorizes the educational-site build/push/publication, overriding historical AGENTS publication prohibition in this scope. It does not clear SF HOLD/BLOCKED_MAP_QUALIFICATION, start Austin/power studies, authenticate results or authorize vehicle deployment. Adopt proposed runtime targets; physical and human gates stay open unless actually observed. Pixel probe Oct13 currently returns no attached devices.
