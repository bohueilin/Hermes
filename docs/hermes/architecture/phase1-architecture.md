# Hermes Phase 1 Architecture

## Scope and safety boundary

Phase 1 proves the Hermes control and evidence loop using a deterministic architectural test
double. It does not model vehicle physics, establish road safety, grant deployment permission, or
provide certification/compliance evidence. All thresholds are versioned and explicitly labeled
illustrative.

## Dependency direction

```text
domain models and protocols
        ↑
scenario schema ─ policy ─ shield ─ fake adapter
        ↑                         ↑
canonical trace ← orchestrator ──┘
        ↓
pure metrics → independent verifiers → release gate
        ↓
staged evidence bundle → stored-only verifier → atomic publication
```

- `src/hermes/domain/` has no simulator imports.
- `src/hermes/adapters/fake.py` implements bounded deterministic dynamics without graphics,
  networking, MetaDrive, or Panda3D.
- `src/hermes/runtime/orchestrator.py` owns lifecycle and composition; every constructed adapter
  is closed exactly once on success and failure.
- `src/hermes/evidence/verification.py` imports no runtime adapter, policy implementation, external
  MetaDrive package, or Panda3D code. It derives its judgment only from stored bytes. A data-only,
  import-safe compatibility declaration in `src/hermes/simulator_support.py` lets it validate the
  recorded supported simulator profile without loading adapter or simulator runtime code.
- `src/hermes/gates/release.py` consumes structured findings, never mutable simulator state.

## Run lifecycle

1. Validate the lowercase run-ID slug, no-overwrite destination, seed, strict scenario YAML, and
   strict gate YAML.
2. Resolve component identities/configuration and bind their digests, scenario/gate digests,
   verifier suite, seed, frequency, and horizon into every hashed event.
3. Reset the adapter, policy, and shield.
4. For each bounded step, preserve the policy's candidate action, shield-permitted executed action,
   override reasons, post-step state, typed verifier facts, and simulated latency source.
5. Close the adapter unconditionally. Any adapter, policy, shield, or close failure is operational
   exit `40` and creates no completed artifact.
6. Verify the complete trace, compute metrics, run the fixed verifier suite, and apply explicit gate
   precedence.
7. Write all evidence into a uniquely owned temporary directory under `artifacts/`.
8. Run the same stored-only verifier against the staged bytes.
9. Atomically rename the directory only after self-verification, using a native no-replace
   primitive. Existing destinations are never overwritten; an unsupported primitive fails closed.
10. Print a verdict only after publication.

## Strict inputs

Pydantic v2 models use `extra="forbid"`, strict persisted types, finite-number checks, bounded
actions, and required verifier-critical safety fields. The shared YAML loader caps document size
and rejects duplicate keys, aliases, anchors, merge keys, multiple documents, unsafe tags,
non-string mapping keys, unknown fields, invalid types, and contradictory hazard steps.

## Canonical trace

- Event sequences begin at zero and simulation time is derived from the configured control rate.
- The genesis link is 64 zeroes.
- Each `current_hash` is SHA-256 over canonical UTF-8 JSON containing `previous_hash` and every
  evidence field except `current_hash` itself.
- Canonical JSON sorts keys, uses stable separators, normalizes negative zero, and rejects NaN and
  Infinity.
- Run ID, wall-clock time, host duration, and artifact path never enter deterministic events.
- Verification checks sequence/time continuity, a constant run context, all links/hashes, typed
  safety-fact consistency, observation summaries against the initial/prior executed state, no-op
  shield consistency, and exactly one final termination/truncation. A `HORIZON` termination is
  valid only at the recorded bounded horizon.
- Fake/baseline latency is configuration-defined and must remain labeled `simulated`; it is never
  accepted as measured inference performance.

## Bundle contract

```text
manifest.json                  execution provenance and companion digests
execution-context.json         resolved component configs and verifier suite
scenario.resolved.yaml         fully defaulted scenario
gate-config.resolved.yaml      fully resolved illustrative gate rules
events.jsonl                   canonical hash-chained events
metrics.json                   pure recomputation from events
findings.json                  complete structured verifier output
verdict.json                   gate result, rationale, failures, and limitations
trace.sha256                   final event-chain root
bundle.sha256                  detached root over manifest plus companions
```

The manifest cannot contain its own digest without recursion. It inventories every companion; the
detached bundle root then binds the manifest and companion byte identities. Verification requires
the exact directory inventory and rejects symlinks, non-regular files, oversized content, malformed
UTF-8/JSON/YAML, duplicate JSON keys, unsupported schemas, noncanonical JSONL, and any mismatch.
Artifact bytes are captured twice through no-follow, directory-relative file descriptors with
nonblocking opens, metadata and directory-entry stability checks; semantic verification never
reopens them by path. Non-regular entries such as FIFOs are rejected without waiting for a writer.

## Verifiers and gate precedence

The fixed suite contains six findings from `TraceIntegrityVerifier`, `CollisionVerifier`,
`BoundaryVerifier`, `ProgressVerifier` 1.1, and `ComfortVerifier`; comfort acceleration/deceleration
and jerk are separate structured findings. Each finding records its measurement availability,
criterion/invariant, first failure time when event-backed, supporting sequences, and explanation.
Missing, duplicated, identity-mismatched, or unknown findings invalidate the decision.

1. Invalid/inconsistent evidence → `INVALID_EVIDENCE`.
2. Any collision → `HOLD`.
3. Boundary/off-road failure → `HOLD`.
4. Destination not reached, configured progress not reached, or explicitly unavailable required
   progress → configured fail-closed result (`HOLD` in Phase 1).
5. Hard criteria pass but illustrative comfort fails or is `NOT_AVAILABLE` → `CONDITIONAL`,
   requiring human review.
6. All configured criteria pass → `PASS` for only this bounded simulation scenario and seed.

No weighted score can compensate for a hard invariant.

## Integrity limitation

The hash chain and detached root make partial or accidental modification evident. They do not
provide independent authenticity: a party able to rewrite the entire bundle can recompute every
local hash. Signing or an independent append-only trust anchor remains deferred.
