# Hermes Phase 6 UX and Information Architecture

## 1. Persistent frame and navigation

The reviewer-comprehension iteration freezes this top-level navigation:

1. `Review`
2. `Compare`
3. `Evidence limitations`

Within `Review`, secondary navigation is, in order:

1. `Select & Verify`
2. `Overview`
3. `Evidence`
4. `Timeline`
5. `Provenance`

After an explicit verification submission, the selected root-relative locator remains visible on
every Review subpage. The workbench does not infer, recommend, rank, or automatically select an
artifact.

Every artifact and comparison surface presents the trust state as independent text values in two
tiers. Color and icons are supplemental only.

~~~text
Tier 1 — Decision state
Gate verdict: PASS | CONDITIONAL | HOLD | INVALID_EVIDENCE
Evidence integrity: UNVERIFIED | INTERNALLY_CONSISTENT | INVALID_EVIDENCE

Tier 2 — Authority boundaries
Origin: NOT_AUTHENTICATED
Authorization: NOT_EVALUATED
Deployment permission: NONE
Scope: SIMULATION_ONLY
Authoritative status: NOT_DEFINED
~~~

The fields must not be merged into a single trust badge. The following sentence persists across
the workbench exactly as written:

> This is a simulation evidence decision, not an approval or deployment authorization.

There is no run, upload, edit, repair, migrate, annotate, threshold, sign, approve, promote,
release, or deploy control.

## 2. Select & Verify

- Purpose: submit one exact directory below the configured root and verify it before exposing an
  accepted gate result.
- Selection control: a blank-by-default root-relative manual text entry followed by the explicit
  `Verify selected artifact` action. With configured root `artifacts`, show the inert example
  `handoff-phase5-demo`; the configured root name is excluded from the submitted value.
- Confirmation: distinguish the draft entry from the last submitted selection. After verification,
  display the submitted directory separately from the manifest `run_id`, and keep that selected
  locator visible throughout Review.
- Recovery copy: on a path or configuration error, explain that the reviewer should enter one exact
  root-relative directory, omit the configured root name, confirm the intended directory, and
  submit Verify again. Do not imply that Hermes can discover or repair the intended artifact.
- Source fields: selected relative path and directory name are OBSERVED locator data; accepted
  manifest identity and inventory are OBSERVED; computed digests and integrity are COMPUTED;
  authenticity is AUTHENTICITY.
- Initial state: UNVERIFIED with no gate badge and the sentence “Evidence has not yet been checked
  by the installed Hermes verifier.”
- Valid state: INTERNALLY_CONSISTENT with the selected directory and manifest `run_id` clearly
  separated. Detailed digests and ten-file inventory belong in Provenance.
- Invalid state: use the strict quarantine described in section 6.
- Prohibited: newest/official/latest/recommended/authoritative selection, accepted PASS before
  verification, upload, drag-and-drop ingestion, or a raw path outside the configured root.
- Accessibility: keyboard-accessible exact text input, explicit Verify action, announced errors,
  visible focus, and a text/table alternative to any status visual.

### Picker and autocomplete decision

A picker, directory list, and validated autocomplete are rejected for this iteration. The public
review facade verifies one already-known lexical selection; it has no descriptor-safe root
discovery API. UI-side `Path.iterdir`, `os.listdir`, globbing, or cached directory discovery would
create a second filesystem path outside the no-follow capture boundary. A safe review-layer
discovery API would be new authority and would require containment, symlink, replacement-race,
lexical-order, no-default, and non-authority-language tests.

Listing or autocomplete could materially increase selection volume and therefore triggers the
previously accepted P2 predecessor: a deterministic synchronized bounded LRU must be implemented
before that scale increase. Until both prerequisites are explicitly designed and approved, the
safe route remains blank root-relative manual entry, an inert example, submitted-selection
confirmation, explicit Verify, and recovery copy.

## 3. Overview

Overview answers the review questions in this exact order:

1. **Artifact reviewed:** selected root-relative path, selected directory name, manifest `run_id`,
   and creation time/schema when available.
2. **Gate decision:** the Tier 1 gate verdict.
3. **Why:** recomputed gate rationale and controlling hard/soft finding identifiers from the
   envelope, without new UI gate logic.
4. **Integrity:** the Tier 1 evidence-integrity state, followed by the five independent Tier 2
   authority boundaries.
5. **Required unavailable evidence:** count and named items, including consequence; never substitute
   zero, false, blank, infinity, or success.
6. **What this does not establish:** internal consistency is not independent authenticity; stored
   verification does not reexecute the policy or simulator; simulation evidence does not establish
   real-world safety, authorization, certification, or permission to control physical hardware.
7. **Technical identity cue:** direct the reviewer to Provenance for hashes, tool/gate versions,
   schema details, and captured source inventory.

Detailed hashes, versions, and inventory must not compete with the decision narrative in Overview.
The gate, integrity, authenticity, authorization, deployment permission, scope, and authoritative
status remain independent. Accepted content retains its evidence category: OBSERVED, COMPUTED,
GATE_DECISION, ASSUMPTION, NOT_AVAILABLE, AUTHENTICITY, or RESIDUAL_RISK.

Empty state: no Overview result until explicit verification finishes. Invalid state: render only
the section 6 quarantine content. Prohibited language includes safe, trusted, approved, certified,
road-ready, deployable, Level 4, overall safety score, or green trust banner.

## 4. Evidence findings and sufficiency

The Evidence page groups existing typed findings and sufficiency items in this exact order:

1. `Failed required evidence`
2. `Required but unavailable`
3. `Soft failures and warnings`
4. `Passing required evidence`
5. `Optional evidence`
6. `Not applicable`

Grouping is presentation-only and uses the envelope’s status, requiredness, hard-invariant/severity,
and sufficiency items. It does not evaluate a threshold, infer profile membership, change gate
semantics, or mutate the envelope. Required failures and required-unavailable items take precedence
over later groups.

A collapsed finding row initially shows human-readable label, status, requiredness, display value
and unit, short structured threshold/rule, gate consequence, and first supporting event when one is
available. Progressive disclosure may show finding ID, verifier/version, exact canonical value,
the full structured threshold expression, source references, every supporting sequence, and audit
text. The UI renders the structured threshold supplied by the core; it never parses audit text or
recomputes pass/fail. Metrics remain separate technical evidence and do not precede findings.

Availability explanations are frozen as follows:

### Required evidence unavailable

> This signal was required by the selected verifier profile but could not be computed from the stored evidence.

Show the typed reason, gate consequence, and source references.

### Optional evidence unavailable

> This signal could not be computed from the stored evidence. It does not control the current gate verdict, but it remains a review limitation.

### Not applicable to this evidence profile

> This verifier is not required or evaluated under the selected profile.

The sufficiency labels remain exactly Required / available, Required / unavailable, Optional /
available, Optional / unavailable, and Not applicable. Missing evidence is never rendered as zero,
blank, false, infinity, a flat line, or pass. Invalid evidence exposes no accepted finding,
sufficiency, metric, or threshold content.

## 5. Timeline

The timeline preserves the full 16-track contract and all source data. A preset control precedes
manual track filtering and offers these presentation-only presets in order:

1. `Decision evidence` — collision count, off-road, route progress, TTC, and
   verifier-triggering findings.
2. `Action accountability` — candidate action, permitted action, executed action, override reasons,
   and policy latency.
3. `Fault behavior` — raw observation, delivered observation, result observation, observation-fault
   reasons, control-fault reasons, and latency.
4. `All tracks` — all tracks in registry order.

Unavailable schema-specific tracks stay explicitly NOT_AVAILABLE; they are not inferred. Filtering
changes only visible presentation tracks and cannot change the envelope, findings, counts, or gate.

Each finding with supporting events has an explicit `Open first supporting event in Timeline`
action. It selects the first stored supporting-event sequence, opens Timeline, moves to the page
containing that exact sequence, and activates relevant tracks, including
`verifier_triggering_findings` where needed. If no supporting event is stored, show a truthful
unavailable notice and do not invent a sequence. A new Verify submission resets all stale
preset/filter/jump state.

The synchronized data table is a first-class accessibility surface. Preserve exact sequence,
time/value, typed gaps, stable row identifiers, keyboard navigation, visible focus, non-color track
labels, and SourceReference drill-down. Do not interpolate, semantically decimate, infer schema-1
permission/observation distinctions, or provide simulator playback.

## 6. Provenance, limitations, and invalid-evidence quarantine

Provenance contains the technical detail moved out of Overview: selected path versus manifest
`run_id`; recorded Hermes/repository, adapter/simulator/source, policy/shield/fault/gate/scenario
identity; schema and tool versions; observed and computed config/trace/bundle digests; source
inventory; integrity checks; and source references. Null remains explicit NOT_AVAILABLE with its
reason, never blank. Presentation consumes the immutable captured envelope and never reopens a
source file.

Evidence limitations explains, in full, internal consistency versus authenticity, no policy or
simulator reexecution, simulation-only scope, no authorization or deployment permission, and known
operational limitations. Detailed limitation copy also appears in Overview for the selected review.

### Strict invalid quarantine

When verification returns INVALID_EVIDENCE, every Review subpage uses one quarantine presentation.
It may show only:

- the selected locator;
- safely captured partial manifest identity;
- Tier 1 gate/integrity state and the five Tier 2 authority-boundary values;
- integrity diagnostics and the first mismatch when available; and
- safe next steps: confirm the intended directory, select another artifact, or contact the artifact
  producer.

It must not show an accepted stored PASS, CONDITIONAL, or HOLD; accepted rationale, findings,
metrics, normal timeline, accepted provenance, comparison deltas, repair, migration, editing, or
override controls.

Safely captured inventory is a capture diagnostic, not accepted provenance. It is excluded from
Overview and every normal invalid-result view. If a technical Provenance diagnostic displays it,
the inventory must remain isolated in diagnostic context and every value must be labeled
`CAPTURED_DIAGNOSTIC`, never OBSERVED/accepted provenance. It cannot be used to restore or imply an
accepted result.

## 7. Compare

Compare requires blank-by-default, explicit root-relative baseline and candidate selections plus an
explicit Compare action. Baseline and candidate labels remain visible. The facade independently
verifies both sides, and compatibility is shown before any delta.

Every compatible comparison renders these sections in order:

1. `Gate outcome`
2. `Hard-failure change`
3. `What improved`
4. `What regressed`
5. `What was unchanged`
6. `What was not comparable`
7. `Evidence availability changes`
8. `Advancement interpretation`

The sections partition existing typed comparison-envelope lists directly and preserve exact side
values, units, desired direction, and side-qualified source references. The UI does not reclassify
a dimension or create a score. Intervention count is always described as descriptive, never
ordinal.

When improvements and regressions coexist, Advancement interpretation must state that the result is
a mixed trade-off and Hermes makes no overall advancement claim. For the retained lead and cut-in
cases, the truthful synthesis is:

> Minimum TTC improved. Route completion, acceleration, and jerk regressed. The gate verdict did not improve. This is a mixed trade-off and does not establish overall advancement.

The comparison must never generate a winner, overall safety/composite score, “candidate is safer,”
“recommended policy,” promotion conclusion, or authority claim.

On incompatibility, show `Comparison unavailable`, reasons, warnings, and limitations. State that
both artifacts may be reviewed independently but no winner, metric change, or advancement claim is
shown. Do not render deltas, charts, or source-link delta payload. An invalid side remains
quarantined and cannot produce comparison deltas.

## 8. Content and network security

Artifact text uses Streamlit text/table/chart APIs only. No `unsafe_allow_html`, raw HTML,
executable Markdown links, external images/assets, telemetry, external API, upload, or database is
allowed. Control characters render visibly and long strings obey the 1,024-character bound.

The launcher accepts only numeric loopback literals validated by `ipaddress`. It rejects hostnames,
`0.0.0.0`, `::`, LAN, link-local, and public addresses. Telemetry is disabled.

## 9. Human comprehension and accessibility gates

Human comprehension, manual visual review, and accessibility audit are all `NOT YET OBSERVED`.
Automated tests cannot change those statuses. Do not claim reviewer comprehension, visual quality,
WCAG conformance, or gate completion without actual recorded observation.

The eventual human package must include an observation template and task protocol covering exact
artifact identity/digest, gate rationale, hard failure, unavailable evidence, shield change,
improvements and regressions, authenticity, and physical deployment permission. Any false answer
that PASS means authenticated, safe, approved, or deployable is a comprehension defect.

Manual accessibility review must cover ordered headings, keyboard-only navigation and finding
expansion, visible focus, announced validation/invalid-evidence errors, screen reader behavior,
200% zoom/reflow, contrast, non-color status, stable row IDs, full table alternatives for charts,
the synchronized timeline table, and inert bounded artifact strings. Essential trust and decision
content must not depend on horizontal scrolling. No ambiguous abbreviation or raw HTML is allowed.

Future tracked documents are `docs/PHASE6_USABILITY_TEST_PLAN.md`,
`docs/PHASE6_HUMAN_OBSERVATION_TEMPLATE.md`, and `docs/PHASE6_VISUAL_REVIEW_CHECKLIST.md`. Their
status remains `NOT YET OBSERVED` until a real reviewer or auditor records evidence.

## 10. Frozen reviewer-comprehension implementation delta

Checkpoint `90fb7d8` remains the validated six-screen predecessor. The next production iteration
must map its existing renderers into the primary/secondary hierarchy in section 1 without changing
the public review facade or portable envelopes:

| Predecessor screen | Frozen destination |
| --- | --- |
| Intake / verification | Review → Select & Verify |
| Review summary / trust | Review → Overview |
| Findings / evidence coverage | Review → Evidence |
| Timeline | Review → Timeline |
| Provenance / integrity / limitations | Review → Provenance and Evidence limitations |
| Compatible comparison | Compare |

The existing exact-selection facade, fresh capture on explicit submission, independent comparison
verification, 50-event deterministic paging, full timeline contract, comparison partitions, safe
text projection, and invalid-envelope quarantine remain authoritative. This design iteration adds
presentation hierarchy, progressive disclosure, task-oriented presets/jumps, and mandatory
comparison synthesis; it does not add review, gate, verifier, threshold, comparison, or filesystem
discovery semantics.

No production implementation or tests are part of this design-freeze change. Human comprehension,
manual visual review, and accessibility audit remain `NOT YET OBSERVED`.
