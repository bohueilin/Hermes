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
