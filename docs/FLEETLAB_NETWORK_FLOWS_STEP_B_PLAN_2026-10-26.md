# FleetLab network flows, Step B: the five priority fixes

**Date:** 2026-10-26. **Base:** `main` at `f043995e39b4e9f9208ee80bdc5b573d98e046ea` (Step A merged). The site inputs at this base equal the live release `a1b79cd`.
**Branch:** `codex/fleetlab-network-flows-step-b`.
**Status:** written before any product edit. Each commit below names its allowed files.

Step B is the first product change of the network-flows redesign. It makes five priority fixes, plus the decided riders, inside the bounds recorded by Step A ([Step A spec](FLEETLAB_NETWORK_FLOWS_STEP_A_SPEC_2026-10-25.md)).

**What Step B never does:**
- raise a byte ceiling, or move headroom between closures;
- add media, or use the reserved eighth enhancement slot;
- touch A2 or the held Fleet day film;
- change the offline edition, which stays pinned at 2,565,111 B, `313fa3f1…`;
- paraphrase boundary copy.

Publication stays an owner action, after re-inspection and the design verdict.

## 1. Owner decisions (2026-10-26)

| | Decision |
|---|---|
| D1 | **Depot-page "Deeper experiment" eyebrow: deferred to Scope 2.** It would break the Step A depot route-local pin (+82 B measured, and the pin allows none). The hub sentence and the new Dispatch nav already label the experiment "Deeper experiment, outside the five questions". |
| D2 | **Hub meta lines adopted.** The five corrected lines from the v3.2 review mockup: "Compare: Base vs one change: different rule, more bandwidth, or more power"; "Compare: Repeated download vs cold shared cache (one depot copy)"; "Compare: First come vs your order (or best of 24)"; "Compare: Reactive vs forecast repositioning"; "Compare: Closest-first vs planned together". Card 04's line carries the one allowed "forecast". |
| D3 | **One "cannot run" language.** "Comparison unavailable" inside the Rebalancing and Dispatch primary buttons; "Unavailable: <reason>" as the Delivery Order badge; the Dispatch busy label "Checking the dispatch comparison…". |
| D4 | **End-of-run reason.** "Observation complete" inside the Rebalancing "Apply moves" and Dispatch "Apply" buttons once the run has ended. The idle labels return when not ended. |
| D5 | **Delivery Order copy and behaviour:**<br>• **Copy.** "Reset to First come"; the card-2 fine line "Your order starts as First come. Move a vehicle, then choose Compare my order."; the failure and cancel tail "Published summary remains available."; the editor label "Your service order".<br>• **No false "edited".** "Your edited order is pending" shows only after a real edit, never after an unedited scenario switch.<br>• **Worked-example failure.** If it fails after an earlier check, the earlier scenario is restored, so the editor and the cards agree.<br>• **Screen readers.** Failures and cancels are announced. |
| D6 | **Defect (c) deferred to Scope 2.** It covers Rebalancing's static pre-run text and Dispatch's empty takeaway box. It is named in the design verdict. |

**Settled by earlier owner rulings or by engineering judgement:**
- uppercase "LESSON n OF 5" eyebrow lines;
- the plain "Network Flows" breadcrumb on Capacity;
- "Back to hub";
- the Capacity art tint `#f1ebe2`, which is not warm under the colour lock;
- FL-A4 eager with high priority only at 768 px and wider;
- no shimmer on the Capacity and Dispatch heroes;
- the pause fix through the Rebalancing lesson module;
- one sequence source inside `software-delivery-package.mjs`.

## 2. Commits, in order, with their allowed files

Every commit stages named paths only. Bytes are measured after each commit, on a clean tree, with the Step A gates; a dirty tree reads 9 B low per sidecar. Any overrun stops that item with an itemised owner request. The route sidecars regenerate on every build, so no manual re-fingerprint step exists.

### C1. Text-only Dispatch hero

**Allowed:**
- `apps/fleetlab-city/hosted/visitor.mjs` (the Dispatch hero entry; the chapter-copy lookup);
- `apps/fleetlab-city/hosted/visitor.css` (the dead `#main>.hero>.visitor-ambient-art` rules only);
- `apps/fleetlab-city/test/visitor-design.test.mjs`.

**Changes:**
- Remove the hero copy and its dead art rules.
- Scope the body lookup to `.bench>#chapter-copy`. `#lesson #chapter-copy` would also match Rebalancing.
- Net −252 B per closure.

**Tests:**
- Move the ambient-art assertion off Capacity.
- Add `class="bench"` and a Rebalancing negative case.
- Add a failure-state test: one D-05 node in every state, including navigation during failure; Next and the chapter tabs stay enabled on failure; another chapter hides the body copy.

**Accepted residual:** D-05 shows only in chapter 0.

### C2. Explore catalog order and card 05

**Allowed:**
- `apps/fleetlab-city/hosted/visitor.mjs` (the catalog re-append list);
- `apps/fleetlab-city/hosted/network-hub.html` (card 05 body);
- `apps/fleetlab-city/hosted/integration.mjs` (the catalog card 05 sentence);
- a new order test.

**Changes:**
- Delete the three lesson links from the re-append list (−96 B per closure), giving the order 01→05.
- In both places, the card 05 sentence becomes "Compare closest-first assignment with planned-together matching." The live remainder of the hub sentence is kept.

### C3. Capacity hero

**Allowed:**
- `apps/fleetlab-city/hosted/visitor.mjs` (remove the Capacity hero-loop entry, then tidy the loop now that both Capacity and Dispatch are gone);
- `apps/fleetlab-city/hosted/enhancement-media.mjs` (the Capacity block only; `figure()` and the A2 call stay byte-identical);
- `apps/fleetlab-city/hosted/visitor.css` (the dead `.capacity-hero>.visitor-ambient-art` rules only);
- `playground/fleetlab/capacity/visual.css`;
- new `apps/fleetlab-city/test/capacity-hero.test.mjs` and `capacity-hero-browser.test.mjs`.

**Changes:**
- **No D-01 decoy.** The D-01 decoy is never built or fetched on Capacity, and the dead fallback removal goes.
- **Width-only priority.** FL-A4 is `loading="eager"` with `fetchpriority="high"` only when `(min-width:768px)` matches at insertion, the two-column layout in which it sits beside the intro. Below 768 px it stacks under the intro and stays lazy. That does not always keep it out of the first viewport: a tall narrow viewport such as 767×1000 shows its top (at 737 px). Priority is deliberately width-only, per the owner ruling.
- **Reserved, tinted space.** A tinted placeholder (`#f1ebe2`) reserves the 16:9 art space before injection, through a `::after` hidden once `#enhancement-capacity` exists. The specificity is strictly above the hosted `.enhancement-visual` rule.
- **No shimmer** on the hero art.

**Never edited:** `enhancement-media.css`. The A2 golden pins it whole.

### C4. Global pause reaches the Rebalancing lesson video

**Allowed:**
- `playground/fleetlab/src/ui/rebalancing-concept.js`;
- `apps/fleetlab-city/hosted/visitor.mjs` (a user-pause-only signal);
- tests in `apps/fleetlab-city/test/r1-concept-loop.test.mjs` and `visitor-design.test.mjs`.

**Changes:**
- The lesson module honours the visitor's global "Pause visual motion" choice. A lesson Play request made while the pause holds starts on Resume.
- The hosted signal marks a pause the visitor chose, and clears while reduced motion disables the global control, so reduced-motion Play keeps working.
- Measured cost: +279 B on Rebalancing, and +75 B in each closure for the signal.
- **Evidence bar:** in the AFTER browser record, r1-nf05 is paused within 1 s of pressing the control (paused, with at most 0.1 s of playback). BEFORE: still playing, with 1.007 s of playback in the 1 s wait.

### C5. One lesson sequence and its navigation (atomic)

**Allowed:**
- `playground/fleetlab/tools/software-delivery-package.mjs` (exported `LESSON_SEQUENCE` and the JS generator);
- `apps/fleetlab-city/tools/integrate-site.py` (reads the same sequence as text; the generator; the caller list, adding `network-flows/delivery-order/index.html` and `network-flows/dispatch/index.html`);
- `apps/fleetlab-city/tests/test_integration.py`;
- `playground/fleetlab/rebalancing/index.html`;
- `playground/fleetlab/dispatch/index.html`;
- `playground/fleetlab/src/ui/depot-capacity-page.js`;
- `playground/fleetlab/src/ui/software-delivery-page.js`;
- `playground/fleetlab/src/ui/delivery-order-page.js` (the label only);
- `apps/fleetlab-city/hosted/network-hub.html` (the D2 meta lines);
- test updates (`rebalancing-package.test.mjs`, `software-delivery-package.test.mjs`);
- a new `apps/fleetlab-city/test/lesson-sequence.test.mjs` with a JS/Python generator parity check.

**Changes:**
- **Sequence.** One sequence, 01 Capacity → 02 Software Delivery → 03 Delivery Order → 04 Rebalancing → 05 Dispatch. The depot experiment stays outside it.
- **Labels.** "LESSON n OF 5" on each lesson. On Capacity the label is its own element, so the pinned eyebrow stays first. Software Delivery's "04" is removed.
- **Navigation:**
  - Rebalancing gets Previous;
  - Delivery Order gets Next;
  - Dispatch's final nav is a source edit with Previous, "Back to hub", and the depot link labelled outside the five, reusing the live hub wording;
  - the Capacity breadcrumb becomes "Network Flows".
- **Hub.** The five meta lines are added.
- **Anchor.** The exact-match anchor changes in all four places together.

The City Python suite runs locally; it is outside CI.

### C6. One disabled and loading language

**Allowed:**
- the five lesson `visual.css` files;
- `playground/fleetlab/rebalancing/index.html` and `dispatch/index.html`;
- `playground/fleetlab/src/ui/rebalancing-app.js`, `dispatch-app.js` and `depot-capacity-page.js`;
- new `apps/fleetlab-city/test/css-cascade.mjs` and `disabled-state-parity.test.mjs`.

**Never edited:** `styles.css` and `display-text.js`, both in the offline edition.

The rules are set by the component spec in section 3.

### C7. Delivery Order states

**Allowed:**
- `playground/fleetlab/src/ui/delivery-order-page.js`;
- `playground/fleetlab/delivery-order/visual.css`;
- new `playground/fleetlab/test/delivery-order-states.test.mjs`.

The states are set by section 4.

### Final steps, after C7

1. The stage check in `after` mode on the committed candidate.
2. The browser-evidence runner, AFTER.
3. The viewport check.
4. Re-inspection at 1280, 768, 390 and 320 px, with the network panel on Capacity and Dispatch.
5. The design verdict (section 5).
6. The deploy-ready proof package.

The physical-phone check runs on the release candidate and is an owner action.

## 3. Component spec: lesson control states v1

**Scope.** Capacity, Software Delivery, Delivery Order, Rebalancing and Dispatch. Excluded: the depot experiment (its route-local bound stays unchanged, and it is outside the five) and the hosted chrome (`.visitor-motion-control`).

**States.**

1. **Default primary.** Unchanged: forest-green fill, white label.
2. **Hover and active while enabled.** Unchanged.
3. **Focus.** The lesson focus rings are unchanged and visible in every state, including a focused `aria-disabled` button.
4. **Disabled.** Any `button`, `select` or text-bearing input (`input` of type number or text) under the lesson root that matches `:disabled` or `[aria-disabled=true]` gets:
   - opacity 1, never an opacity mute;
   - fill and border `#dce2d7`;
   - label `#465d52` (5.39:1 on that opaque fill);
   - `cursor: not-allowed`;
   - `transform: none` in every pointer state;
   - `transition: none`, so the fill and the label change together;
   - no hover change.

   A disabled range input has no text, so it gets opacity .55 and `cursor: not-allowed`.
5. **Loading.** Disabled, plus the reason, plus the existing progress cue (the trailing "…", the existing progress bar, or Capacity's "cell n of 4"). No new progress element.
6. **Reason.**
   - A primary disabled by busy or unavailable work says why, either inside its own label or in the text element right after its action row.
   - That text must reach at least 4.5:1 over its real surface.
   - Reason text inside a button exists only while the button is disabled; the exact idle label returns when it is enabled.
   - Dependent controls share the disabled look and the lesson's single status line.
   - Chapter-boundary nav buttons use the disabled look with no reason line.

**Per lesson.**

| Lesson | Reason placement and labels |
|---|---|
| Rebalancing | Reason inside `#watch`: "Loading the recorded comparison…" while loading, "Comparison unavailable" on failure. "Observation complete" on "Apply moves" once ended. |
| Dispatch | Reason inside `#watch`: "Checking the dispatch comparison…" while busy, "Comparison unavailable" on failure. "Observation complete" on "Apply" once ended. |
| Capacity | The status line moves to directly after the action row. |
| Delivery Order | The status line is already directly after the action row. |
| Software Delivery | The primary never disables; only boundary nav takes the disabled look. |

**Cascade rule.** Each lesson's `visual.css` loads before `/brand.css`, which imports `visitor.css`, which imports `enhancement-media.css`. Equal specificity therefore loses silently. Every disabled rule is scoped by the lesson root id: `#main`, `#order-root`, `#delivery-root` or `#capacity-root`. That gives specificity (1,1,1), strictly above:
- the hosted hover lift and active scale (0,3,1);
- the hosted input skin (0,3,1);
- the .55 input mute (0,2,1);
- the Capacity `aria-disabled` rule (0,2,0);
- the studio hover (0,2,0);
- the Delivery Order primary hover (0,2,1).

Text-bearing inputs join the same rule as `input:where([type=number],[type=text])`. `:where()` adds no specificity, so the rule stays (1,1,1). Rebalancing's Vehicles count is the only such input in the five lessons, so only Rebalancing's rule lists it.

No `!important`.

**Measured contrast:**

| Control | Before | After |
|---|---|---|
| Rebalancing primary | 12.51:1, and looked enabled | 5.39:1 for every disabled text-bearing control |
| Dispatch primary | 2.94 | |
| Delivery Order primary | 2.26 | |
| Capacity primary | 3.69 | |
| Dispatch hosted selects | 2.86–2.95 | |

After, the reason and status lines read 10.52 (Rebalancing), 10.19 (Dispatch), 6.26 (Delivery Order) and 11.61 (Capacity).

**Parity test.** It parses `styles.css`, each lesson's `visual.css` and the hosted `visitor.css` together. It applies cascade order and specificity, resolves `var()`, and composites opacity over the real surface. It covers `aria-disabled` and every disabled non-range input, which fails unless it takes the full disabled look in both cascades. It checks that reason text inside a button disappears when not busy.

## 4. Delivery Order states

The figures are the truth table confirmed against source in Step A. Badges are separate elements in the small-caps label style, never a pinned card label and never a button look.

**Cards.** Card 1 is always "First come". Card 2 is "Your order", or "Best permitted order" in best mode.

**States:**

| State | Figures | Labels and status |
|---|---|---|
| First paint, every scenario | The published first-come summary. | Labelled "Published order", with no "pending" language. The card-2 fine line keeps "Compare my order". |
| Pre-run scenario switch (nothing accepted) | That scenario's own published first-come figures. | Status: "Published summary · no calculation has started." |
| Edit, nothing accepted | Published figures stay. | The editor carries "Your edited order is pending". |
| Edit after an accepted check | The accepted figures stay. They are current, checked results and are never labelled "previous". | The editor badge shows only when the order differs from the last compared order for that scenario. An unedited scenario switch shows no "edited" badge. |
| Success | | Status "Checked 24 of 24 permitted orders · <name>". The result is "<name> · checked complete study". The figures label is "Your order", "Worked example" or "Best of 24". A new mode variable tells Worked example from Best of 24. |
| Failure | Previous or published figures are kept and labelled. | Badge "Unavailable: <reason>", using the reasons from source. Status "Unable to accept this comparison." with the tail "Published summary remains available." when nothing was ever accepted. No "retained" claim unless something was accepted. A Worked example failure after an acceptance restores the earlier scenario. Failures and cancels are announced. |
| Cancel | | A Cancel row exists before and after acceptance. The suspend states stay as pinned. |

**Tests:**
- Pinned tests kept: `design-round4` :25, :26 and :27; `delivery-order-page` :6, :8–:12 and :16–:18.
- A real re-render test replaces the captured-node check.
- The truth-table test from Step A stays green.

## 5. Gates and the design verdict

**Gates, on the committed candidate:**
- every Step A bound;
- the colour lock (no warm additions);
- the hub-copy test, now with one "forecast" in card 04;
- the A2 golden;
- the offline pin;
- the viewport check, where the depot 320 px exception stays the only overflow;
- the three Node suites, pytest and ruff;
- the City Python suite, run locally.

**Design verdict.** It is reported beside the byte report, and rates three things plainly:
- **Craft:** does it look world-class?
- **Comprehension:** does a visitor get each lesson's choice in one pass?
- **Honesty in words:** does every caption, badge and figure say only what the evidence supports?

A result that fails any of the three is not ready to go live.

**Residuals named in advance:**
- the Rebalancing, Software Delivery and Delivery Order heroes (`.r1-hero`, `.delivery-hero`, `#order-root .hero`) keep the motion-respecting shimmer until the Scope 2 hero template;
- D-05 shows only in chapter 0;
- the depot experiment keeps its own disabled style, and its 320 px overflow;
- the re-enable direction still runs the hosted 180 ms background fade (hosted `visitor.css`, Scope 2);
- Rebalancing's status line says "Study unavailable: <error>" while its button says "Comparison unavailable";
- the offline depot-flow eyebrows still compete;
- the Capacity breadcrumb differs from the Explore collection name;
- only Dispatch links back to the hub;
- Previous wording and placement are not unified across lessons;
- defect (c) is deferred (D6);
- the depot-page eyebrow is deferred (D1);
- forced-colours styling for the focused `aria-disabled` Capacity primary is deferred.

**Fixed after the re-judge (W1, W2):** Capacity takes the house link rule Software Delivery, Rebalancing and Dispatch use (`a{color:inherit;text-underline-offset:4px}`; Delivery Order colours its links `var(--teal)`), so its "Release source and record fingerprints" link no longer renders in the browser-default blue, and a sweep pins that no link on the hub or the five lessons keeps the browser default; Rebalancing's recorded-playback selects follow the comparison as Dispatch's arm and view selects do: disabled while it loads, when it fails and when the Worker cannot start (W2); the Next-nav test measures the border box and pins zero block padding and margins; the `capacity-hero-browser.test.mjs` comment states the corrected C3 premise.

**Residuals found by the design verdict and not fixed by V1 to V3 or W1:**
- the Software Delivery concept art is titled "Same work. Different order." (the Delivery Order premise, set in the hosted `brand.mjs`), so lessons 02 and 03 show the same label in a row;
- the Delivery Order figures badge sits over card 1 and reads as its heading; in Your order mode it repeats card 2's label;
- Delivery Order "Unavailable" reasons can show raw verifier codes, such as "Returned record rejected: candidate-rejected:0:record-metrics", with no full stop;
- "Show best of 24" clears a "Your edited order is pending" whose order was never compared, and "Watch worked example" drops a pending edit without saying so;
- the Rebalancing lesson Play waits silently under the global pause: it stays "Play", with no status, until Resume;
- the hosted "Pause visual motion" pill covers text: the last line of hub card 05 at 1280×900 (introduced by C2, whose longer card 05 sentence wraps one more line; BEFORE it cleared the pill), and Capacity's help line and the Delivery Order scenario buttons at 390;
- "LESSON n OF 5" stacks with a second eyebrow (a third on Rebalancing) and renders in four type styles across the five lessons;
- the hub Compare lines float in flow instead of sitting at the card bottom (82 px ragged at 1280);
- end-of-lesson navigation is not unified (Next sits after the lesson footer on Capacity, Software Delivery and Delivery Order; Delivery Order's footer links run together at 390), and lesson titles differ across surfaces (lesson 1 has four names);
- the Delivery Order move buttons and alternatives row stay enabled during a check, and pressing one cancels or replaces it;
- "All ready" is never defined beside "ready by target";
- Dispatch failure states use the calm green status box of success above a grandfathered amber-bordered alert, and "Retry comparison" (which reloads the scenario on screen, not the one that failed) sits beside the alert's "Reload to reconstruct the comparison";
- the Dispatch "From the field" Reuters statistic was not re-verified (no network access); it is fenced as public reporting and now sits in the first viewport;
- before any calculation, "Selected vehicle V1: 0 s difference between matching orders." still sits under "Published summary · no calculation has started." (the pinned first-paint state; V2 hides it only after an edit);
- Delivery Order card 2 keeps the First come figures under "Your order" after an edit, its four-button alternatives row competes with the primary, and the pre-run wording is not one phrase across the lessons;
- the "cannot run" visuals differ by lesson: Rebalancing's button and status line, Dispatch's status band, alert and Retry, and Delivery Order's left-ruled badge;
- the Chrome-default blue progress bar shows on Dispatch while busy, a broken-image icon and alt text sit over the Capacity tint if FL-A4 fails, the Delivery Order result heading takes the browser focus ring, and the Dispatch H1 orphans "takes" at 320;
- Scope 2 template work: the Software Delivery, Delivery Order and Dispatch heroes leave the right half empty at 1280, the Software Delivery primary is teal, and focus-ring colours vary by lesson;
- after a failed Dispatch scenario switch, "Comparison unavailable." sits above the earlier comparison, which stays shown and usable; the page never names the scenario that failed or says the shown results are still the checked ones (it understates; saying so needs new words);
- the Delivery Order equal-share result, success or failure, never reaches the `role=status` live region, so a failure is silent to screen readers;
- "Restore my order" stays enabled after the first accepted check even when that order is already on screen (kept so focus never lands on a button that disables itself), and while disabled it carries no reason (a secondary control; §3.6 does not require one);
- the Delivery Order disabled primary fill `#dce2d7` sits close to the enabled sage secondary, told apart mainly by label colour and cursor; at 390 the scenario buttons sit flush against the paragraph above;
- the equal-share status reuses the existing "Rebuilding and independently checking the NF04 equal-share record…", including the internal code "NF04";
- Dispatch's hidden Later and Retry controls are not disabled when the Worker cannot start; visitors cannot reach them;
- the Capacity placeholder reserves the 16:9 image box but not the caption: at 390 px the preview slot moves 108 px down when FL-A4 lands, at 1280 px the tinted box sits 42 px lower than the art that replaces it, and at 450 px and below its 18 px radius differs from the art's 12 px (Scope 2 hero template);
- width-only priority leaves FL-A4 lazy at Low on tall narrow viewports where it is the LCP element (767×1000: top at 737 px), unchanged from BEFORE;
- Delivery Order's focus ring is amber `#907025`, so a warm colour marks interactive state; it is grandfathered by the colour lock but breaks "amber = human demand only" (Scope 2);
- the FL-A4 caption "Twelve visits, three shared lanes." sits directly above the preview heading "One depot. Two shared resources.", a three-versus-two count a first-time visitor has to reconcile, and at 1280 the Capacity eyebrow breaks inside "90-" / "MINUTE OBSERVATION" (both pre-existing; FL-A4 is now the LCP element from 768 px, so the caption is read first);
- not exercised by the verdict: the hosted `_headers` and CSP, and the physical-phone check (an owner action); its FCP and LCP figures are single loopback runs.
