# Hermes Phase 6 Visual and Accessibility Review Checklist

## Current evidence status

- Automated correctness: `OBSERVED` at the pre-documentation-commit checkpoint: 756 full, 756
  non-MetaDrive, and 506 focused tests passed.
- Browser document object model (DOM) retained-state walkthrough: `OBSERVED` for initial UNVERIFIED,
  nominal PASS, collision HOLD, invalid quarantine/no stored-PASS leak, Timeline/action
  accountability, Provenance/limitations, compatible mixed comparison, incompatible fail-closed
  comparison, and zero exception/leak text.
- Stable second-level heading (H2) anchors: `OBSERVED` in code/tests at `0fe3459` (83 focused plus
  two independent targeted passes) and `OBSERVED — PASS` in narrow browser DOM.
- Local server lifecycle: `OBSERVED` — loopback-only walkthrough, clean Ctrl-C shutdown, port 8501
  listener gone, and tabs finalized.
- Manual visual review: `NOT YET OBSERVED`.
- Accessibility audit: `NOT YET OBSERVED`.
- Human comprehension: `NOT YET OBSERVED`.
- No WCAG conformance claim is made by this checklist or by automated AppTest coverage.

The in-app browser screenshot backend reported visibility false and returned uniformly blank images.
Those images are not pixel/visual evidence. This is an executable evidence-capture protocol for a
backend that can render visible screenshots. Mark a row `OBSERVED — PASS`,
`OBSERVED — FINDING`, or `NOT YET OBSERVED` only after recording the exact browser, viewport,
artifact locator/digest, steps, and evidence location. A screenshot can establish rendered visual
state; it cannot establish screen-reader behavior, comprehension, or WCAG conformance.

## Launch and capture setup

```bash
cd /Users/bohueilin/Documents/GitHub/Hermes
conda activate hermes-dev
python -m pip install -e ".[dev,workbench]"
hermes workbench \
  --artifact-root artifacts \
  --host 127.0.0.1 \
  --port 8501 \
  --no-browser
```

Open `http://127.0.0.1:8501/` locally. Confirm the server is bound only to `127.0.0.1`; do not use
a hostname, LAN/public address, upload, remote artifact, simulator run, or policy run.

For each capture, record:

| Field | Required value |
|---|---|
| Date/time | Actual local timestamp |
| Branch and commit | Exact Git values |
| Worktree state | Exact `git status --short` summary |
| Browser/version | Actual value |
| Operating system | Actual value |
| Viewport | Exact CSS pixels; start at 1440×900, then test 1280×720 and 1024×768 |
| Display scale | Actual value |
| Zoom | 100% unless the row requires 200% |
| Artifact selection | Exact root-relative locator; blank for initial state |
| Manifest run ID | Actual value after verification |
| Bundle digest | Actual computed value after verification |
| Input method | Mouse, keyboard-only, or assistive technology |
| Evidence location | Repository-external or ignored screenshot/note path; never inside a source bundle |

## Required trust copy

Confirm this information remains visible and independent on every primary workflow:

```text
Tier 1 — Decision state
Gate verdict
Evidence integrity

Tier 2 — Authority boundaries
Origin: NOT_AUTHENTICATED
Authorization: NOT_EVALUATED
Deployment permission: NONE
Scope: SIMULATION_ONLY
Authoritative status: NOT_DEFINED

This is a simulation evidence decision, not an approval or deployment authorization.
```

Also confirm that Hermes explains internal consistency without claiming real-world safety or
permission to control physical hardware. A PASS must not visually or verbally collapse the five
authority boundaries.

## Recorded browser DOM structural evidence

At pre-fix HEAD `80439c5`, a real in-app browser DOM walkthrough reproduced a first-Timeline-mount
truth mismatch: the radio indicated `Decision evidence`, but the projection/multiselect contained
`All tracks`. Commit `cbced6e57670ae7aaf63f9ce875122ac7471e348` fixed the seam RED-first.

Recorded closure:

```text
RED: 1 failed — Decision evidence radio vs All tracks projection
GREEN: 1 passed
focused regression: 88 passed
independent targeted confirmation: 2 passed
fresh browser DOM: All tracks radio + exact 16-track multiselect parity
```

Status: `OBSERVED — PASS` for that DOM structural parity only. This does not promote any screenshot
row below and does not establish CSS appearance, visible focus, 200% visual reflow, screen-reader
behavior, contrast, accessibility conformance, or human comprehension.

### Stable heading-anchor closure

A second browser P2 showed that dynamic H2 permalinks could become stale after radio reruns.
`0fe3459ac87b78a023bb477ebf1210b2a9d31792` adds explicit anchors for all seven primary H2s:

```text
select-and-verify
overview
evidence
timeline
provenance
compare
evidence-limitations
```

The targeted regression failed before the fix and passed after it; 83 focused tests and two
independent targeted tests passed, with Ruff/diff clean. Status: `OBSERVED — PASS` for code/test
closure. Fresh cross-section browser DOM also observed Overview href `#overview`, Timeline href
`#timeline`, Compare href `#compare`, and exception-text count 0: `OBSERVED — PASS` for this narrow
DOM closure. Do not promote screenshot/manual visual or accessibility status from this closure.

## Screenshot-state matrix

Each row begins `NOT YET OBSERVED`. Preserve that status until the specified state is rendered and
the evidence location is recorded.

| State | Exact selection / action | Required rendered evidence | Status | Evidence location / notes |
|---|---|---|---|---|
| Initial UNVERIFIED | Launch; leave Review selection blank | `UNVERIFIED`; no accepted gate; blank draft; inert `handoff-phase5-demo` example; independent Tier 2 boundaries | `NOT YET OBSERVED` | |
| Nominal PASS | Verify `handoff-phase5-demo`; open Overview | Selected locator separate from run ID; PASS rationale; `INTERNALLY_CONSISTENT`; PASS does not overpower authority limits | `NOT YET OBSERVED` | |
| Hard-failure HOLD | Verify `handoff-p1-collision`; open Evidence | `HOLD`; collision in Failed required evidence; first supporting event action; progress cannot compensate | `NOT YET OBSERVED` | |
| INVALID_EVIDENCE | Verify `phase1-tampered`; traverse all Review pages | Quarantine diagnostics and safe identity only; no accepted stored PASS/findings/metrics/timeline/provenance | `NOT YET OBSERVED` | |
| Required evidence unavailable | Use a separately approved fixture that truthfully contains the typed state | Plain-language required-unavailable reason, consequence, references; never zero/blank/pass | `NOT YET OBSERVED — NO RETAINED VALID FIXTURE IDENTIFIED` | Do not mutate or fabricate source evidence |
| Timeline action accountability | Verify `handoff-p3-lead-shielded`; choose Timeline → Action accountability | Candidate, permitted, executed actions; override reasons; policy latency; synchronized table | `NOT YET OBSERVED` | |
| Provenance and limitations | Verify `handoff-p2-metadrive`; open Provenance and Evidence limitations | Recorded provenance separate from origin authentication; hashes/details; no reexecution; simulation-only limits | `NOT YET OBSERVED` | |
| Compatible mixed comparison | Compare `handoff-p3-lead-baseline` → `handoff-p3-lead-shielded` | Gate unchanged; time to collision (TTC) improved; route/acceleration/jerk regressed; no winner; mixed trade-off | `NOT YET OBSERVED` | |
| Compatible cut-in comparison | Compare `handoff-p3-cutin-baseline` → `handoff-p3-cutin-shielded` | Same mixed synthesis; unchanged HOLD; scripted-replay limitation; no overall advancement | `NOT YET OBSERVED` | |
| Incompatible comparison | Compare `handoff-p3-lead-baseline` → `handoff-p3-cutin-shielded` | Compatibility reason before deltas; no delta/chart/source payload/winner/advancement claim | `NOT YET OBSERVED` | |
| Visible keyboard focus | Tab from page start through primary navigation, selection, Verify, secondary navigation, and first detail control | Visible focus is never lost or clipped; order follows reading/workflow sequence | `NOT YET OBSERVED` | |

## Keyboard-only review

Use Tab, Shift+Tab, Space, Enter, arrow keys, Escape where supported, and browser-native table
navigation. Do not touch the pointer after starting.

- [ ] `NOT YET OBSERVED` — Reach `Review`, `Compare`, and `Evidence limitations` in logical order.
- [ ] `NOT YET OBSERVED` — Enter a root-relative selection and activate Verify.
- [ ] `NOT YET OBSERVED` — Navigate all five Review secondary destinations.
- [ ] `NOT YET OBSERVED` — Expand/collapse finding detail and activate first-supporting-event jump.
- [ ] `NOT YET OBSERVED` — Change Timeline preset, tracks, page, and exact-event inspection.
- [ ] `NOT YET OBSERVED` — Complete explicit baseline/candidate comparison without side swap.
- [ ] `NOT YET OBSERVED` — Recover from invalid lexical selection without losing the last accepted
  identity or entering a focus dead end.
- [ ] `NOT YET OBSERVED` — Essential trust and decision content requires no pointer hover.

Record initial/final focused element, unexpected focus movement, focus restoration after rerun,
control name/state, and evidence location for every finding.

## Screen-reader review

Record assistive technology, browser, verbosity settings, and exact spoken output where relevant.

- [ ] `NOT YET OBSERVED` — Page title and primary purpose are announced.
- [ ] `NOT YET OBSERVED` — Headings form a coherent hierarchy and support heading navigation.
- [ ] `NOT YET OBSERVED` — Primary and secondary navigation controls have distinct names/states.
- [ ] `NOT YET OBSERVED` — Draft input, submitted locator, and manifest run ID are distinguishable.
- [ ] `NOT YET OBSERVED` — Gate and integrity are announced separately from all five authority
  boundaries.
- [ ] `NOT YET OBSERVED` — Finding groups, status, requiredness, value/unit, rule, consequence, and
  supporting sequence are understandable without visual position or color.
- [ ] `NOT YET OBSERVED` — Timeline and comparison tables expose names, headers, row relationships,
  typed gaps, and side qualification.
- [ ] `NOT YET OBSERVED` — Collapsed/expanded state is announced.
- [ ] `NOT YET OBSERVED` — Invalid evidence does not expose quarantined accepted claims through the
  accessibility tree.

## Focus and announcement review

- [ ] `NOT YET OBSERVED` — Visible focus has adequate visual distinction in default, hover, active,
  selected, disabled, error, and rerun states.
- [ ] `NOT YET OBSERVED` — Verify and Compare announce completion/result without requiring a visual
  scan.
- [ ] `NOT YET OBSERVED` — Lexical/path/configuration error is announced and focus moves to or can
  immediately reach recovery guidance.
- [ ] `NOT YET OBSERVED` — `INVALID_EVIDENCE` and first mismatch are announced as rejection, not a
  warning or low score.
- [ ] `NOT YET OBSERVED` — Finding-to-event navigation announces the Timeline destination and exact
  event sequence.
- [ ] `NOT YET OBSERVED` — New Verify clears stale drill-down/filter state without leaving focus on a
  removed control.

## Non-color and contrast review

This manual review identifies findings; it does not claim a formal contrast audit or WCAG result.

- [ ] `NOT YET OBSERVED` — PASS, CONDITIONAL, HOLD, INVALID_EVIDENCE, UNVERIFIED, unavailable, and
  not-applicable states have visible text labels independent of hue.
- [ ] `NOT YET OBSERVED` — Improvements, regressions, unchanged, unavailable, and not comparable are
  labeled in text.
- [ ] `NOT YET OBSERVED` — Selected navigation and expanded rows remain identifiable in grayscale or
  with color disabled.
- [ ] `NOT YET OBSERVED` — Text, focus indicators, status icons, table borders, and chart marks are
  measured with a documented contrast tool and exact foreground/background values.
- [ ] `NOT YET OBSERVED` — No critical distinction relies on red/green position, saturation, or chart
  shape alone.

## Table alternatives

- [ ] `NOT YET OBSERVED` — Every chart or dense visual has a complete adjacent or reachable table.
- [ ] `NOT YET OBSERVED` — Timeline table stays synchronized with preset, tracks, page, and exact
  event without changing canonical counts or verdict.
- [ ] `NOT YET OBSERVED` — Comparison table preserves exact baseline/candidate values, unit, desired
  direction, partition label, and side-qualified source references.
- [ ] `NOT YET OBSERVED` — `NOT_AVAILABLE` is a typed gap/reason, never a zero data point or flat line.
- [ ] `NOT YET OBSERVED` — Stable row IDs persist through navigation and filtering.

## 200% zoom and reflow

At each row, set browser zoom to exactly 200%, reload if required, and use a 1280×720 CSS-pixel
viewport unless the browser reports a different effective viewport; record the actual value.

| Surface | Required checks | Status | Evidence location / notes |
|---|---|---|---|
| Overview | Identity, gate/rationale, integrity, five authority boundaries, unavailable summary, limitations, and Provenance cue remain present and ordered | `NOT YET OBSERVED` | |
| Evidence | Six finding groups, hard failure, availability copy, exact values/rules, detail controls, and supporting-event action reflow without overlap | `NOT YET OBSERVED` | |
| Timeline | Preset, manual tracks, paging, exact-event controls, and synchronized table remain operable; essential content is not horizontally scroll-dependent | `NOT YET OBSERVED` | |
| Compare | Persistent sides, compatibility, all eight synthesis sections, exact tables, and no-winner limitation reflow without side ambiguity | `NOT YET OBSERVED` | |

Also test 1024×768 at 100% and record any clipped, overlapped, occluded, off-screen, or
horizontal-scroll-dependent essential content.

## Bounded inert content

Automated unit coverage exists, but there is no approved renderable adversarial fixture or harness
for these rows. Do not mutate retained source evidence, invent a render route, or infer a manual
result from unit tests.

- [ ] `NOT YET OBSERVED — NO APPROVED RENDERABLE FIXTURE` — `<script>`, `<img>`, SVG,
  Markdown/JavaScript-looking strings, ANSI, and
  Unicode Cc/Cf content render as inert visible text.
- [ ] `NOT YET OBSERVED — NO APPROVED RENDERABLE FIXTURE` — No artifact string becomes raw HTML,
  link navigation, external image, or executable content.
- [ ] `NOT YET OBSERVED — NO APPROVED RENDERABLE FIXTURE` — A value beyond 1,024 input scalars
  displays explicit truncation and
  original-length metadata while canonical JSON remains exact.
- [ ] `NOT YET OBSERVED — NO APPROVED RENDERABLE FIXTURE` — Very long locator/run/rationale/
  reference text cannot obscure Tier 1 or Tier 2 trust content.

## Abbreviation expansion

For each primary destination and Review subsection, read visible content from the first heading to
the last table. Inventory every abbreviation, confirm it is expanded at first visible use on that
surface (for example, time to collision (TTC)), and record any term whose meaning requires prior
Hermes knowledge.

- [ ] `NOT YET OBSERVED` — Every abbreviation is expanded at first visible use on Review.
- [ ] `NOT YET OBSERVED` — Every abbreviation is expanded at first visible use on Compare.
- [ ] `NOT YET OBSERVED` — Every abbreviation is expanded at first visible use on Evidence
  limitations.
- [ ] `NOT YET OBSERVED` — Screen-reader output preserves the expanded form before later shorthand.

## Capture closeout

After capture:

1. record the exact status and evidence location for each executed row;
2. leave every unexecuted row `NOT YET OBSERVED`;
3. classify each finding by severity, owner, and retest criterion;
4. confirm every representative artifact file hash is unchanged;
5. stop the local server cleanly;
6. confirm `third_party/metadrive` and the source worktree were not modified by review; and
7. keep these four conclusions separate:

```text
Automated correctness: OBSERVED or NOT YET OBSERVED
Manual visual review: OBSERVED or NOT YET OBSERVED
Accessibility audit: OBSERVED or NOT YET OBSERVED
Human comprehension: OBSERVED or NOT YET OBSERVED
```
