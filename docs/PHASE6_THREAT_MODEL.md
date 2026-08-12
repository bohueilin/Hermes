# Hermes Phase 6 Threat Model

## 1. Scope

Local, read-only review of stored Hermes simulation artifacts. No remote service, account system, approval workflow, signing implementation, simulator execution, or physical vehicle interface.

## 2. Assets

- source artifact bytes;
- artifact identity and digests;
- recomputed verdict, findings, and metrics;
- trust-state labels;
- review and comparison envelopes;
- reviewer understanding;
- local filesystem boundaries;
- existing verifier and gate semantics.

## 3. Actors

- honest reviewer;
- honest but mistaken artifact producer;
- malicious artifact author;
- local user selecting the wrong or stale artifact;
- attacker controlling artifact strings or structure;
- developer accidentally duplicating gate logic;
- compromised local host or verifier, outside Phase 6 assurance.

## 4. Security objectives

1. Source artifacts remain unchanged.
2. Invalid evidence cannot masquerade as accepted PASS.
3. UI cannot strengthen trust claims.
4. UI cannot become a gate or verifier.
5. Review state is bound to artifact digest.
6. Paths remain inside the allowed root.
7. Artifact content cannot execute code in UI.
8. Public access is not enabled.
9. Missing evidence remains explicit.
10. Comparison remains compatible and bidirectional.

## 5. Threat register

| ID | Threat | Prevention | Detection | Failure behavior | Residual risk |
|---|---|---|---|---|---|
| T1 | Path traversal | containment and canonical resolution | path tests | exit 40 | local filesystem compromise out of scope |
| T2 | Symlink escape | no-follow capture | symlink fixtures | reject or invalid | platform primitive differences |
| T3 | TOCTOU mutation | immutable snapshot and recheck | mutation tests | invalidate session | malicious privileged local actor |
| T4 | Stale cache | digest, tool, and schema key | replacement tests | full reverify | cache library bugs |
| T5 | Stored PASS on corrupt bundle | verify before presentation | tamper fixtures | INVALID and quarantine | coherent full rewrite |
| T6 | Coherent full-bundle forgery | explicit unauthenticated state | not fully detectable | internally consistent but NOT_AUTHENTICATED | requires future signature or trust anchor |
| T7 | False runtime facts | explicit no-reexecution limitation | provenance and review label | no authenticity claim | later attestation or reexecution needed |
| T8 | UI gate drift | one facade and import test | parity and golden tests | fail CI | semantic bug in shared core |
| T9 | Missing evidence shown as zero | typed availability | UI tests | explicit NOT_AVAILABLE | misleading optionality if profile is wrong |
| T10 | Under-specified required evidence | core sufficiency model | profile tests | expose required or unavailable | gate profile design remains human responsibility |
| T11 | Numeric rounding | exact plus display values | threshold-edge tests | show exact detail | human misread still possible |
| T12 | XSS or content injection | escaping and no raw HTML | payload tests | render safe text | framework sanitizer defects |
| T13 | Resource exhaustion | size, event, and depth bounds | large fixtures | bounded error, no partial review | local denial of service within limits |
| T14 | Comparison cherry-picking | mandatory improvements and regressions | mixed-trade-off fixtures | no winner | reviewer bias |
| T15 | Incompatible comparison chart | compatibility first | incompatible fixture | no delta or chart payload | incorrect compatibility core |
| T16 | Stale artifact authority | no automatic latest | artifact identity UI | NOT_DEFINED authority | user can still choose wrong artifact |
| T17 | Provenance and authenticity confusion | separate fields | content tests | NOT_AUTHENTICATED | user ignores label |
| T18 | Public network exposure | loopback-only validation | bind tests | reject | local browser or process access remains |
| T19 | Artifact writes | no write paths and before-after hashes | immutability tests | fail test or stop | framework temp files outside artifact root acceptable |
| T20 | Simulator launch | import boundaries | import and patch tests | fail test or stop | manual external process unrelated to workbench |

## 6. Most credible false-confidence paths

### P0

- UI duplicates gate or verifier semantics.
- Invalid stored PASS remains visually prominent.
- Integrity is presented as authenticity.
- `PASS` is presented as deployment permission.
- Artifact changes after verification but UI uses stale result.

### P1

- Required evidence is inferred by UI.
- Comparison hides mission or comfort regression.
- Rounding hides threshold crossing.
- Recorded provenance is labeled verified origin.
- Stale development artifact is auto-selected.

### P2

- Reviewer overgeneralizes scripted or limited simulation.
- Same-host determinism is generalized cross-platform.
- Optional missing evidence is ignored despite business importance.

## 7. Trust statements required in UI

```text
Internally consistent under installed Hermes verifier
NOT_AUTHENTICATED
Authorization NOT_EVALUATED
Deployment permission NONE
SIMULATION_ONLY
```

## 8. Resource-bound policy

Design freeze must inspect current artifact sizes and select:

- maximum companion file size;
- maximum events;
- maximum findings and metrics;
- maximum nesting depth;
- maximum display string length.

Limits must be configurable, documented, and tested. Exceeding a limit produces no accepted partial review.

## 9. Network policy

Allowed:

- local loopback server.

Forbidden:

- wildcard bind;
- LAN bind;
- cloud tunnel;
- telemetry;
- external assets or CDNs;
- remote artifact fetch.

## 10. Stop conditions

HOLD implementation when any P0 threat lacks prevention, fail-closed behavior, and a regression test.
