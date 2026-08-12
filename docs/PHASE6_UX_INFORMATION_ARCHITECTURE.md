# Hermes Phase 6 UX and Information Architecture

## 1. UX objective

Help a reviewer understand evidence without presenting a stronger claim than the verified core supports.

## 2. Persistent page frame

Every artifact and comparison view includes:

```text
Hermes — Simulation Evidence Review
Scope: SIMULATION_ONLY
Evidence authenticity: NOT_AUTHENTICATED
Deployment permission: NONE
```

Do not hide these behind a tooltip.

## 3. Navigation

```text
Review artifact
Compare artifacts
About evidence and limitations
```

No “run,” “create,” “approve,” “promote,” or “deploy” navigation.

## 4. Artifact intake

### Purpose

Select one exact artifact under the configured root and verify it before showing an accepted gate result.

### Required fields

- relative artifact path;
- run ID;
- bundle digest after capture;
- file inventory;
- verification state;
- schema versions.

### States

#### Unverified

```text
Evidence has not yet been independently checked by the installed Hermes verifier.
```

#### Internally consistent

```text
The bundle is internally consistent under the installed Hermes verifier.
```

#### Invalid evidence

```text
Evidence verification failed. Stored verdict and findings are quarantined.
```

### Prohibitions

- No automatic newest-artifact selection.
- No accepted PASS badge before verification.
- No upload control.
- No edit or repair action.

## 5. Review summary

### Trust strip

Display six independent fields:

1. Gate verdict.
2. Evidence integrity.
3. Evidence authenticity.
4. Authorization status.
5. Deployment permission.
6. Scope.

### Gate section

- recomputed verdict;
- concise rationale;
- hard failures;
- soft failures;
- supporting finding IDs;
- gate profile, version, and digest.

### Evidence-sufficiency section

Show counts and drill-down for:

- required and available;
- required but unavailable;
- optional and available;
- optional and unavailable;
- not applicable.

### Residual-limitations section

Always visible, including authenticity and no-reexecution limitations.

## 6. Findings view

### Table columns

- finding ID;
- verifier and version;
- category;
- status and severity;
- value and unit;
- threshold and operator;
- first failure time;
- supporting event count;
- gate consequence;
- availability.

### Drill-down

- full explanation;
- exact canonical value;
- source references;
- event sequences;
- related metric;
- related gate rule.

### Visual semantics

Use text, icon, and color. Color alone is insufficient.

`NOT_AVAILABLE` is a distinct state, not neutral gray zero.

## 7. Timeline view

### Tracks

- raw observation;
- delivered observation;
- result observation;
- candidate action;
- permitted action;
- executed action;
- shield reasons;
- fault reasons;
- collision and off-road;
- speed;
- route progress;
- TTC;
- simulated latency;
- verifier-triggering events.

### Interaction

- select event sequence;
- show exact event facts from captured source reference;
- link back to findings;
- filter tracks without altering verdict or finding counts.

### Unavailable data

Use gaps and explicit labels. Never interpolate or substitute zero.

## 8. Provenance and integrity view

### Recorded provenance

- Hermes version, commit, and dirty state;
- adapter, simulator, version, and source commit;
- scenario, policy, shield, fault, and gate versions;
- schema versions;
- configuration digests;
- trace root;
- bundle root.

### Authenticated origin

```text
Status: NOT_AUTHENTICATED
```

Explain that recorded provenance is not a signed identity claim.

### Authority

```text
Authoritative status: NOT_DEFINED
```

No “official” or “latest” designation.

## 9. Invalid-evidence page

Primary content:

- `INVALID_EVIDENCE`;
- first failure or mismatch;
- affected file or sequence;
- artifact identity when safely known;
- trust limitations;
- source file inventory.

Do not show a green stored PASS. If useful, show:

```text
Stored verdict claim: quarantined and not accepted
```

## 10. Comparison view

### Header

- baseline identity and digest;
- candidate identity and digest;
- compatibility status;
- both verification states.

### Sections

- verdict delta;
- hard-failure delta;
- improvements;
- regressions;
- unchanged outcomes;
- evidence-availability deltas;
- intervention details;
- residual limitations.

### Prohibitions

- no winner score;
- no “candidate is safer” summary unless a specific supported dimension is named;
- no chart after incompatibility;
- no hidden regressions.

### Example truthful summary

```text
Minimum TTC improved. Route completion, acceleration, and jerk regressed. The gate verdict did not improve. This run does not demonstrate overall advancement.
```

## 11. About and limitations

Explain:

- simulation scope;
- gate semantics;
- internal consistency;
- authenticity limitation;
- no policy or simulator re-execution;
- no deployment permission;
- ODD and simulator limitations;
- local-only behavior.

## 12. Accessibility

- keyboard navigable controls;
- text labels for statuses;
- sufficient contrast;
- tables readable without charts;
- chart data available as a table;
- no color-only meaning;
- errors announced clearly;
- long evidence text expandable.

## 13. Content security

- escape artifact-derived content;
- no raw HTML rendering;
- sanitize Markdown if supported;
- bound long strings;
- render control characters visibly and safely.

## 14. Human-comprehension gate

A reviewer should answer:

- exact artifact identity;
- reason for verdict;
- hard failure;
- unavailable evidence;
- shield changes;
- improvements and regressions;
- authenticity;
- deployment permission.

Record real observations only.
