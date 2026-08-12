# Hermes Phase 6 UX and Information Architecture

## 1. Persistent frame

Every artifact and comparison surface displays, as text:

~~~
Hermes — Simulation Evidence Review
Evidence authenticity: NOT_AUTHENTICATED
Authorization status: NOT_EVALUATED
Deployment permission: NONE
Scope: SIMULATION_ONLY
~~~

Artifact review also displays Gate verdict and Evidence integrity. Authoritative status is
NOT_DEFINED on intake, summary, and provenance. Color is supplemental; status text, icon, and table
values remain understandable without color.

Navigation is Review artifact, Compare artifacts, and Evidence limitations. There is no run,
upload, edit, repair, migrate, annotate, threshold, sign, approve, promote, release, or deploy
control.

## 2. Artifact intake and verification

- Purpose: select one exact directory below the configured root and verify it before exposing an
  accepted gate result.
- Source fields: selected relative path/directory name are OBSERVED locator data; manifest run_id,
  creation time, schemas, inventory, and observed digests are OBSERVED; computed digests and
  integrity are COMPUTED; authenticity is AUTHENTICITY.
- Initial state: UNVERIFIED with no gate badge and the sentence “Evidence has not yet been checked
  by the installed Hermes verifier.”
- Valid state: INTERNALLY_CONSISTENT with selected directory, manifest run_id, both bundle roots,
  trace roots, and ten-file inventory.
- Invalid state: INVALID_EVIDENCE, first diagnostics, mismatch identity, and “Stored verdict,
  findings, and metrics are quarantined and not accepted.”
- Error state: path/configuration error with no evidence verdict and actionable correction.
- Prohibited: newest/official/latest/authoritative selection, accepted PASS before verification,
  upload, drag-and-drop ingestion, raw path outside root.
- Drill-down: portable inventory size/digests from the captured snapshot only. Filesystem device,
  inode, mode, mtime, and ctime remain private facade state and are never rendered or serialized.
- Accessibility: keyboard-selectable directory list, explicit verify action, announced errors,
  table alternative to status graphics.

## 3. Review summary

- Purpose: answer what was tested, what gate decided, why, and what the result does not establish.
- Source fields: artifact/provenance OBSERVED; integrity/metrics COMPUTED; gate GATE_DECISION;
  trust AUTHENTICITY or RESIDUAL_RISK; missing fields NOT_AVAILABLE.
- Required content: exact identity/digests; six independent trust dimensions plus authoritative
  status; gate profile/version/digest; recomputed rationale; hard and soft failure IDs; five-state
  sufficiency counts; persistent limitations.
- Empty state: no summary until verification finishes.
- Invalid state: gate INVALID_EVIDENCE only; no stored PASS, findings, metric cards, or timeline.
- Prohibited: safe, trusted, approved, certified, road-ready, deployable, Level 4, overall safety
  score, green trust banner.
- Drill-down: gate IDs link to finding rows and captured source references.
- Accessibility: ordered heading structure, text rationale, full table for summary cards.

Required wording:

~~~
A Hermes PASS is only the installed prototype gate verdict for this bounded simulation.
Internal consistency is not independent authenticity.
Stored verification does not reexecute the policy or simulator.
Simulation evidence grants no physical-system permission.
~~~

## 4. Findings and evidence sufficiency

- Purpose: expose pass/fail/unavailable evidence, requiredness, threshold basis, source events, and
  gate consequence.
- Source fields: finding values and status COMPUTED; threshold projection COMPUTED from verified
  GATE_CONFIG/SCENARIO; gate consequence GATE_DECISION; missing items NOT_AVAILABLE.
- Columns: finding ID; verifier/version; evidence category; core status; severity; requiredness;
  exact/display value and unit; structured operator/threshold; first failure time; supporting
  sequence count; availability; gate consequence.
- Empty state: “No accepted findings are available” with reason; never imply pass.
- Invalid state: findings table absent and quarantine explanation visible.
- Prohibited: parsing threshold_source_text, recomputing pass/fail, treating soft WARNING severity
  as a fourth core finding status, substituting zero.
- Drill-down: exact canonical value, compound threshold tree, original threshold text for audit
  only, explanation, verified profile assignment, source references, event sequences.
- Accessibility: text status/severity, sortable table with stable row IDs, keyboard expansion, no
  color-only requiredness or availability.

Sufficiency labels are exactly Required / available, Required / unavailable, Optional / available,
Optional / unavailable, and Not applicable. UI never infers a bucket.

## 5. Event and action timeline

- Purpose: show what was observed, proposed, permitted, executed, and returned without inventing
  distinctions absent from the source schema.
- Source fields: track points are OBSERVED; derived TTC/metrics are COMPUTED; unavailable tracks
  are NOT_AVAILABLE.
- Schema 1.0 tracks: candidate action and executed action available; separate permitted action,
  raw observation, delivered observation, and result observation NOT_AVAILABLE. Observation
  summary and post-step vehicle state/raw facts remain available under their actual names.
- Schema 2.0 tracks: candidate/permitted/executed actions and raw/delivered/result observations
  available, plus shield/fault reasons and source/execution timing.
- Common tracks: collision/off-road, speed, route progress, TTC availability/value, latency, and
  verifier-trigger sequences when supported.
- Empty state: explicit no-event or unsupported-track reason; never a flat zero line.
- Invalid state: timeline absent; diagnostic sequence may be shown only as a captured invalidity
  reference.
- Prohibited: interpolation, semantic decimation, inferred permission for schema 1, inferred raw/
  delivered/result observations, control actions, simulator playback.
- Drill-down: exact sequence/time/value and SourceReference into the captured snapshot.
- Accessibility: keyboard point navigation, synchronized data table, textual gaps, chart legend
  text/icons, sufficient contrast.

Filtering changes only visible tracks. It cannot change envelope gate, findings, counts, or
comparison partition.

## 6. Provenance, integrity, and limitations

- Purpose: distinguish recorded origin claims, internal consistency, authenticity, authority, and
  residual risk.
- Source fields: recorded manifest/context values OBSERVED; digest/verification results COMPUTED;
  authenticated origin AUTHENTICITY; limitations RESIDUAL_RISK.
- Required content: Hermes/repository state; adapter/simulator/source commit; policy/shield/fault/
  gate/scenario profiles; schema versions; config, trace, and bundle roots; selected path versus
  manifest run_id; source inventory.
- Empty/unavailable: null plus explicit NOT_AVAILABLE reason, never blank.
- Invalid: only safely captured identity/inventory and diagnostics; unverified provenance stays
  quarantined.
- Prohibited: verified producer, official artifact, authoritative/latest, signed, tamper-proof.
- Drill-down: source inventory and references only; no source reopen.
- Accessibility: definition list plus downloadable-equivalent text/JSON view.

Exact labels:

~~~
Evidence integrity: INTERNALLY_CONSISTENT | INVALID_EVIDENCE
Evidence authenticity: NOT_AUTHENTICATED
Authoritative status: NOT_DEFINED
~~~

## 7. Compatible comparison

- Purpose: compare two exact independently verified artifacts without collapsing mixed effects.
- Source fields: both artifact identities/integrities OBSERVED/COMPUTED; compatibility and deltas
  COMPUTED by existing compare_artifacts; unchanged gate verdict GATE_DECISION; limitations
  RESIDUAL_RISK.
- Required content: identities/digests; both integrity states; compatibility reasons/warnings;
  verdict and hard-failure delta; improvements; regressions; unchanged; NOT_COMPARABLE descriptive
  dimensions; separate availability deltas; intervention detail.
- Empty state: require explicit baseline and candidate; never auto-fill newest.
- Invalid state: identify invalid side, exit 30, no comparison claim.
- Incompatible state: reasons only, exit 40, and no deltas, winner, metric chart, or source-link
  payload.
- Prohibited: winner score, overall safety score, hidden regression, ranked intervention count,
  “candidate is safer” without naming a supported dimension.
- Drill-down: exact baseline/candidate values and references to each independently captured
  snapshot.
- Accessibility: improvements/regressions/unchanged have text and icons; every chart has a full
  comparison table.

Representative truthful summary:

~~~
Minimum TTC improved. Route completion, acceleration, and jerk regressed. The gate verdict did
not change. Intervention count is descriptive. This comparison does not demonstrate overall
advancement.
~~~

## 8. Content and network security

Artifact text uses Streamlit text/table/chart APIs only. No unsafe_allow_html, raw HTML, executable
Markdown links, external images/assets, telemetry, external API, upload, or database is allowed.
Control characters render visibly and long strings obey the 1,024-character bound.

The launcher accepts only numeric loopback literals validated by ipaddress. It rejects hostnames,
0.0.0.0, ::, LAN, link-local, and public addresses. Telemetry is disabled.

## 9. Human comprehension gate

Record actual reviewer observations only. The reviewer must identify exact artifact/digest, gate
rationale, hard failure, unavailable evidence, shield change, improvements and regressions,
authenticity, and physical deployment permission. Any false answer that PASS means authenticated,
safe, approved, or deployable is a comprehension defect to fix before completion.
