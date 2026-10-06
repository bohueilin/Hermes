# FleetLab SF audit decisions — October 6th, 2026

**Owner:** Bo-Huei Lin. **Scope:** Claude's October 6 design audit, plus the complete carried-forward October 5 Muse/Gemini decisions below. These reports are AI feedback, not independent human map observations, visitor sessions or release authority.

**Current disposition:** all ten ranked findings have an accepted or adapted implementation. The update is tested, pushed and live: production `c722398b-e5d4-4414-9080-1d7f8b1b584d`, viewer `4e414aa544653f71`. Both preview and production matched all 10,039 served files and expected hosting headers. Formal SF acceptance remains **HOLD**. Austin remains **NOT_STARTED**.

The auditor's instructions, workflow and claimed agent count were treated as context, not authority to change the product. The user's request authorizes evaluating and implementing agreed findings; earlier explicit authorization covers testing, Git publication and static-site deployment. The generic Phase 6 local-only instructions do not override that separately authorized FleetLab educational publication. Hermes evidence-core boundaries remain unchanged.

## Claude finding-by-finding decisions

| ID | Finding | Decision and actual implementation | Evidence / boundary |
|---|---|---|---|
| C01 | Seek changes facts far above the current viewport | **Accept.** Both exact-event buttons and shift segments use one seek action: pause, draw the recorded moment, focus the status, scroll the replay stage into view. The status now includes exact clock time. | Reproduced on the old live release: status y=−5162.86 after Seek at 09:36:29. Corrected phone status appears in view; desktop shows map and facts together. Keyboard activation follows the same path. No interpolation or event change. |
| C02 | Inspect pair loses the selected repeat/layout context | **Accept, adapt focus.** Navigate to repeat/configuration controls and focus the explanatory pair text, with the selected layout named before the lesson. Explain how to switch sides. Preserve request invalidation and the existing baseline default on original-study selection. | Repeat 9/1009 lands on controls at y≈20; text explicitly says A (one depot), then retains the adverse +30.8-second boarded-wait result. No implied candidate view or inferred winner. No delayed load callback steals focus. |
| C03 | Model limits opens at old scroll depth with no selected tab | **Accept.** Scope & sources joins the existing navigation as its sixth destination, with aria-current. Intentional view changes focus and reveal the page title. Remove the external-link arrow on that internal tab. | Old live page retained scrollY=3731 with no current tab. Corrected limits title is at y≈20 and Scope & sources is current. Six tabs reflow at 375 and 240 px. |
| C04 | +1.11 visually implies a practical win | **Accept, keep the existing comparison contract.** A prominent practical-margin relation appears beside the completion estimate before the interval/details. The relation comes from the existing version-checked completionContext projection. | Unit checks cover below, above, touching/crossing +2 pp and invalid/incompatible/missing results. +1.11 pp and its interval remain below the +2 pp margin; this is not a new gate, map decision or operator recommendation. |
| C05 | Map qualification has no plain first-use definition | **Accept definition; reject the proposed single summary/count.** Add an explanation and ledger link on home and throughout City Explorer. Label the legacy ledger explicitly as recorded SF v1; candidate v2/v3 review remains separately identified in the atlas. | A bare “3 of 9 failed or not run” omits other incomplete states and conflates unlike checks. Source-ID accounting, map semantic review, candidate support, visitor study and deployment authority retain their own states. The previously implemented home recording notice is preserved verbatim. |
| C06 | Phone event table hides Seek offscreen | **Accept.** At ≤520 px, omit the redundant elapsed column visually and fit exact clock, wrapped event description and a 44 px-high action. Desktop retains all columns; all events remain available. | 375 px browser: table and container both 267 px; Seek right edge 302 px; all 56 EV-001 events retained through 15:00. Exact clock still available, no side scrolling required for Seek. |
| C07 | Exact event clock and sampled pose appear contradictory | **Accept with more precise wording.** Relabel facts as exact event clock versus held position/sample state; add the explanation directly beside those facts. Keep times on one line. | 09:36:29 shows current charging queue; held position remains 09:36:15/generic turnaround. Avoid the auditor's unconditional “up to 15 s” promise because gaps are unavailable and pause. Existing lower replay-limits panel remains. |
| C08 | Trust labels are mostly machine tokens | **Accept plain language; reject blanket token deletion/unification.** Add scoped prose at the hosted welcome boundary and City entry, and use plain words in the replay safety note. Keep exact states in source/limits and existing teaching evidence surfaces. | Teaching models are not hash-verified City recordings. Internal consistency, producer authenticity, authorization, deployment permission, scope and practical/map outcomes remain separate; no generic trusted/approved badge. No claim of authenticated teaching outputs. |
| C09 | 100 vehicles may be mistaken for n=100 | **Accept with original-study scope.** Explain the shared input tape and depot resources beside the aggregate fleet introduction; the original study has twelve paired seeds, not 100 independent vehicles or 1,200 independent requests. | Text explicitly says “In the original depot study” so it cannot silently label another protocol as twelve pairs. The stopped power study still has no paired estimate. |
| C10 | Small/light caveats are hard to read | **Accept, validate within the inspected surfaces.** City muted color becomes #566b61; caption floor 12 px; ordinary explanation copy 16 px. Hosted caption changes are additive CSS, preserving all legacy assets and offline bytes. Darken the identified Street lab captions/units and preserve larger lead text. | City muted contrast: 4.94–5.62:1 on the five audited backgrounds. Normal captions ≥4.5:1 on the corrected Street backgrounds. Browser scans found no rendered text under 12 px in all six City views and seven preserved main-site destinations. This is not a site-wide WCAG certification or screen-reader/device pass. |

## Additional audit observations and recommendations

- **Film motion control:** retain the existing “Pause concept film” button, observed in the live DOM. The omitted suggestion that Overview has no motion control is not supported by the current implementation.
- **Fleet-day intent text after Run:** retain the persistent What & why / How we simulate / Learning & ops takeaway frame. A changing run-status sentence is not a replacement for that explanatory frame. A larger teaching-page restructuring is not required to close these ten findings.
- **Supported / excluded / unsupported map labels:** retain the source classification contract and accessible ledger; these colors do not establish present legal access. No data classification was changed to make the map look more complete.
- **Roadmap language, repeated page chrome, cross-lab seed terminology and six experiments on one page:** optional information-architecture work; not SF qualification evidence or a reason to remove existing learning content. The current handoff makes other-city work unstarted and separately authorized.
- **Suggested-vehicle labels:** retain the documented selection rules (first ID, highest completed count, longest queue and median completion). These are explainable examples, not representative independent samples or cherry-picked winners.
- **True 200% zoom, pinch/rotation, screen-reader speech and physical-device tests:** the Claude audit did not perform these. Viewport resizing is recorded as reflow testing only. Previous October 5 device evidence remains historical; new device evidence cannot be inferred from it.

## Implementation review and preservation

The author reproduced the major defects before changing code. The practical-margin tests were observed failing for the absent headline, then passing. The welcome legend test caught an incorrect host selector and was corrected before publication. A fresh code reviewer found additional low-contrast Street selectors; those were corrected in the same bounded pass. No blocking replay, focus, loading-race or trust-state regression was found. Larger introductory prose is retained above the 16 px ordinary-prose floor.

Frozen recordings, maps, source-offer bytes, review requirements/history, comparison and simulation core are preserved. Generated packages, browser evidence and private deployment credentials are excluded from Git. No additional SF evaluation arm, human review observation, source-owner message, calibrated vehicle model, physical maneuver or new city was produced.

The final validation and publication evidence is summarized in [the October 6 handoff](FLEETLAB_HANDOFF_2026-10-06.md). Input hashes, old/new screenshots, test logs and release readbacks are retained locally in `build/fleetlab-city/validation/sf-design-20261006/`.

## Carry-forward: October 5 decisions in full

The following is the complete October 5 record, preserved as historical context. Its “latest/final” descriptions refer to the October 5 release; the October 6 section above governs this update. No earlier rejected fabricated claim becomes accepted through this carry-forward.

---

# FleetLab SF audit decisions — October 5th, 2026

Scope: close the accepted SF presentation, automated validation and static-publication work. Muse and Gemini supplied feedback; the owner authorized implementing the supported findings and publishing. This is an implementation review, not independent human map qualification. Fable is optional later. No new city, research arm, evaluation tape or protocol freeze is included.

## Review method and decision

We checked the reports against the shipped UI, source code, stored-result contracts and the accepted October 4 scope. Neither report provides qualifying human source observations or a physical-device pass. Muse explicitly lacked the handoff for its first pass; Gemini's purported observations include controls, IDs, values and telemetry that do not exist in this implementation. Their severity labels are therefore not accepted without verification.

The resulting changes clarify entry points, model boundaries and intentional empty states. Original models, concept film, 59 catalog lessons, historical outcomes, maps, thresholds and review obligations remain intact.

## Muse disposition

| Finding | Decision | Evidence and action |
|---|---|---|
| F1: phone layout not tested | Validate within available tools | Browser phone-width and narrow reflow checks are required for this release. Earlier October 5 Pixel observations remain separately dated; ADB initially returned no device, then the Pixel reconnected for a bounded production smoke check; exact coverage is in the final handoff. Do not convert either AI's desktop inspection into a phone pass. |
| F2: recorded nature too far from entry | Implement | Home SF CTA now says it browses precomputed experiments and does not launch a new city run. City introduction uses “compare recorded depot experiments”; a visible notice explains the selection controls and separate interactive Model lab. |
| F3: offline edition not discoverable | Implement as download, not another tab | Footer exposes the preserved 2.4 MB standalone HTML. Packaging copies its exact bytes and sets an attachment filename. Scope text distinguishes core teaching labs/catalog from the hosted film and City Explorer. No synchronization promise. |
| F4: lab names insufficient | Implement | A four-card homepage chooser gives each teaching model a question, scope and direct route. These independent models do not share SF vehicle recordings. Existing detailed explanations remain. |
| F5: replay lacks nearby limits section | Implement | A visible panel after the full event history explains operational events, held 15-second poses, shared generic EV traits and absent traffic/sensor/physics evidence; button opens the full scope/source view. |
| F6: unset fares look broken | Implement with state integrity | “Enter your three rates to compute an estimate” replaces the ambiguous default. Invalid rates and missing completed-trip exposure have distinct messages. Explicit zero is accepted; no default fare, invented revenue or missing-evidence zero. |
| F7: suggested-vehicle heuristic | Retain | Suggestions already disclose first ID, most trips, longest queue and middle vehicle by trip count, deduplicated. Values depend on repeat and layout; they are examples, not four independent experiments. |
| F8: possibly truncated “Same riders” | Not reproduced | Full text exists in `playground/fleetlab/src/ui/teaching-frames.js`. Browser inspection at 390px on Scale lab showed the complete paragraph, client height = scroll height and no line clamp. No speculative glossary rewrite. |

## Gemini disposition

| Finding | Decision | Evidence and action |
|---|---|---|
| F01: Run / Variant and scenario ambiguity | Reject alleged control; reinforce actual meaning | Report's selector, seeds 042/043 and SF-v2.1 scenario are not this UI. SF uses recorded repeats 1001–1012, with seed explanations. New entry notice makes the recorded-selection contract explicit; no “re-roll” button that implies a fresh SF run. |
| F02: Fleet day → Street lab deep link loses AV-084 | Reject cross-model trace integration | Claimed anomaly/control and AV-084 path are not reproducible. These are different teaching models with no shared telemetry contract. New chooser states their separation. The real SF fleet → vehicle → operational event path remains within Replay. |
| F03: green utilization card / interval 0.42–1.80 | Reject factual premise; preserve already implemented margin explanation | Actual metric is completion delta in the City notebook, +1.11 pp with approximately +0.70–1.55 pp paired interval. The +2 pp practical margin is adjacent and explicitly above the entire interval. Existing tests cover below/crossing/above and unavailable/incompatible inputs. Do not add a second green/amber/red gate or substitute Gemini's numbers. An additional error-bar chart is optional design, not an outstanding defect. |
| F04: 100 stalls and 50/50 split | Reject unsupported resource counts and deltas | Recorded study has eight ports versus 4+4, 200 kW total and four turnaround slots. Existing capacity illustration, notebook and replay explain equal totals. Gemini's named depot neighborhoods, 48/50 occupancy, −14% deadhead and +32% queue deltas are not evidence. No fabricated per-depot telemetry panel. |
| F05: interpolated keyframes / 10 Hz incident data | Reject | Actual positions are held between 15-second samples; exact operational event time is separate. No hard-braking, incident or 10 Hz sensor stream exists. Nearby replay limits strengthen that distinction. |
| F06: congestion feedback and capacity heatmap | Reject claimed traffic physics; explain actual interaction | Cars share finite depot resources. SF does not model traffic congestion generated by vehicles sharing a road. New replay limits distinguish a modeled depot wait from road congestion. No arbitrary three-car/85% heatmap. |
| F07: unexplained missing fare and certification metrics | Already covered; adapt Muse fare copy | SF Trip summary already exposes viewer fares and explicit unavailable safety metrics, including the warning that missing records do not establish zero rates. Do not claim fleet “physics,” certification or that hardware-in-the-loop alone establishes safety. |
| F08: opaque qualification with 98.4% lane validation | Reject fabricated progress; retain actual ledger | Atlas already separates recorded/candidate maps, per-class budgets, district gaps, review obligations and source evidence. 2,160 temporal and 56 administrative obligations have no human observations. No supported claim of 98.4% lane validation, 14 pending arterial curbs or autonomous geofence approval. |
| F09: dragged route halts at ODD boundary | Reject alleged interaction; accept visible model-limit intent | Reported route dragging and avoidance event are not established. Actual scenario-area and support layers remain. Add replay scope panel; do not invent an autonomous ODD fence or an event the runner never recorded. |
| F10: offline batch sync and engine v4.18.2 | Reject alleged batch/version; fix real discoverability | No such batch or sync contract exists. Exact preserved offline edition is now downloadable with clear scope; it does not import SF recordings into unrelated teaching models. |

## Implementation and validation contract

Changed surfaces are hosted integration/CSS, the offline packaging step, City copy, a replay limits panel, and fare display-state validation. The scientific runner, comparison logic, map/source snapshots and frozen reviewer history are unchanged. No site content was removed to make room for City Explorer.

Meaningful regression checks exercise original-film/catalog preservation, idempotent mounting, chooser destinations, a real byte-identical offline copy and attachment header, and missing/invalid/zero/computed fare states. The focused tests were first observed failing for the absent features, then passing. Release validation includes the full existing suites, visual/functional browser checks, immutable package validation, source/review/science preservation, preview and production readback, and effective hosting headers. Final outcomes and deployment identities belong in the updated [October 5 handoff](FLEETLAB_HANDOFF_2026-10-05.md).

The first deployed preview revealed a hosting contract issue: Cloudflare redirects named HTML URLs to an extensionless address, losing the attachment header scoped only to the original address. The final integration uses the canonical extensionless link, preserves the `.html` download filename, and declares the attachment header at both paths. The initial failed check is retained; final checks read the actual canonical response. The City viewer package did not change.

## Section 6B and remaining responsibility

Section 6B is an optional **AI map/source claim-triage prompt**, not a mandatory next round. No additional Muse, Gemini or Fable review is needed to complete this implementation pass. If the owner chooses to use it later, send the current handoff for context and only the relevant frozen batch/source captures for obligation-level claims. Local paths in a handoff do not transfer those files. A fresh unaided design review should receive the URL before the explanatory handoff.

The accepted non-human implementation and publication work can close while formal SF acceptance stays HOLD. Remaining acceptance work requires actual people or external evidence: source rights/version clarification; capable independent map/GIS observations and conflict resolution; remaining human accessibility tasks; five visitor sessions and independent scoring; and the owner's recorded decision. The tools, frozen assignments, templates and demo guide are prepared. Do not lower or relabel those requirements merely because automated work is finished.

The stopped 200 kW/400 kW research question, calibrated vehicle classes, physical curb maneuvers and higher-fidelity adapters remain explicitly deferred by the October 4 scope. They are neither completed nor blockers on shipping the current educational website. Austin and other City Explorer cities remain NOT_STARTED.

**Recommendation:** close this automated implementation pass after verified publication; use the current live SF experience and this one updated handoff without another required AI review round.

**Top risks + mitigations:** fabricated review observations → verify against source and recordings; polish mistaken for qualification → keep HOLD and evidence limits visible; cross-model confusion → explicit lab chooser and recording labels; missing data mistaken for zero → separate fare/safety states.

**Next 3 actions:** (1) retain the verified release and updated handoff; (2) arrange the remaining human/source sessions when ready; (3) record SF acceptance before authorizing a new city.
