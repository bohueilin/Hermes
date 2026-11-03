# FleetLab SF executive walkthrough — 5 October 2026

**Purpose:** demonstrate how a fleet question becomes a controlled experiment,
an inspectable result and a decision about the next evidence to collect.
The educational site is live. SF acceptance remains **HOLD**; Austin has not started.
This is a presenter guide, not a script to coach the independent visitor study.

## Opening in twenty seconds

> FleetLab explores the work between rides: where vehicles spend their time,
> which resources constrain service, and whether a proposed change is worth
> testing further. This San Francisco example compares one depot with two while
> keeping total resources fixed. You can inspect the fleet result and trace it
> to one vehicle, including the model's gaps and unavailable evidence.

## Ten-minute route

| Time | Open / action | Say and show | Decision to carry forward |
|---|---|---|---|
| 0:00–1:00 | [Overview](https://fleetlab.pages.dev/#/overview). Show the film, then the navigation. | The film is a concept illustration. Fleet day, Street lab, Four-area experiments, Scale lab and Learning catalog remain distinct teaching experiences. City Explorer adds recorded SF experiments. | Choose a model for the operational question; do not combine metrics across models. |
| 1:00–2:00 | [City Explorer](https://fleetlab.pages.dev/city-explorer/#welcome) → Open the experiment. | One site has 8 ports, 200 kW and 4 turnaround slots. Two sites split those same totals: 4+4 ports, 100+100 kW and 2+2 slots. Both use 100 generic EVs over 07:00–15:00. | This tests location and resource distribution under fixed aggregate capacity. |
| 2:00–4:00 | [Decision notebook](https://fleetlab.pages.dev/city-explorer/#compare). Show the result, twelve pairs and stress cases. | Completion improves by +1.11 percentage points, with a 95% paired interval of approximately +0.70 to +1.55. The whole interval is below the existing +2 pp practical threshold. Empty distance per completed trip improves, but map qualification remains open. Show the adverse lower-demand sensitivity too. | A favorable direction is insufficient for the declared practical margin or a city recommendation. |
| 4:00–5:30 | First row, seed 1001 → Inspect pair. Keep configuration A. Read “100 vehicles. One shared system.” | 627 trips completed. Median vehicle: 4 trips; mean: 6.27. Depot queues consume 394.5 of 800 vehicle-hours, or 49.3%. All other time includes empty travel, charging and other states. | Shared constraints explain why fleet size alone is not service capacity. |
| 5:30–7:00 | [Replay studio](https://fleetlab.pages.dev/city-explorer/#replay). Select EV-001, A, seed 1001. Seek the charging-port wait, then Play/Pause. | At 09:36:29 the operational state is waiting for a port. The held position sample is from 09:36:15 and records the earlier turnaround state. These clocks intentionally answer different questions. EV-001 completes 4 trips, drives 29.85 miles and ends charging; whole-shift totals stay fixed during scrubbing. | Follow a causal explanation without treating one vehicle as an independent experiment or the markers as continuous driving. |
| 7:00–8:30 | [City atlas](https://fleetlab.pages.dev/city-explorer/#atlas). Compare recorded map and current temporal candidate; inspect qualification. | Sourced geography, modeled route support and independent source qualification are distinct. The candidate improves support but does not replace the map underlying the original notebook results. Fictional depot squares do not identify operator facilities. | Better source accounting is progress; it cannot supply missing human review or validate road operation. |
| 8:30–9:15 | [Model lab](https://fleetlab.pages.dev/city-explorer/#models), then Scope & sources. | Anonymous arithmetic lessons explore assumptions. The Ojai and Zoox references are design questions, not calibrated simulated operator vehicles. Physical curb/depot maneuvers remain deferred. | Add fidelity when a specific decision requires it and inputs can be validated. |
| 9:15–10:00 | Return to the result and state the next evidence. | The optional power/location study is incomplete. Source/map review, physical-device accessibility, visitor comprehension and owner acceptance remain open. | Complete the defined SF educational acceptance before expanding to another city. |

The labels above were rehearsed against the live October 4 UI on October 5.
That UI release is `cee47cf4eb126c1a14892bad0568ed73f3171611626580281a026f29980fce35`;
the [immutable recording view](https://b009157f.fleetlab.pages.dev/city-explorer/releases/cee47cf4eb126c1a/#compare)
provides a stable reference. A subsequent notes-only package may have another
release identity without changing this UI or scientific data. Always record
the actual release used for a formal device or visitor session.

## Answers to likely questions

**What are seeds 1001–1012?** A seed fixes synthetic arrivals and initial
positions. Each paired repeat gives both layouts the same inputs. The twelve
paired repeats are the study's replication units; they are not twelve named
driving scenarios. A changed scenario is a separate declared condition.

**Why show 100 vehicles?** They share one generic vehicle model and compete for
resources. Their identities let us explain different assignments, travel and
queues. Start with the aggregate distribution, then a suggested story. Do not
present 100 interacting vehicles as 100 independent statistical repeats.

**What did the experiment find?** Across the twelve original pairs, two sites
produce a small completion gain below the practical margin, with less empty
distance per completed trip and lower average p90 boarded wait. This does not
mean every repeat or neighborhood improves. Seed 1009, for example, completes
15 more trips but has a 30.8-second longer p90 boarded wait. The one-seed
lower-demand sensitivity completes 581 versus 569 trips: an adverse result,
kept separate from the twelve-pair interval. Wait describes boarded riders;
completion accounts for every created request.

**Why does a vehicle stop serving rides?** Inspect its actual state and queue.
For A / EV-001 / seed 1001, a long charging-port queue is followed by charging
that continues at the eight-hour recording end. A stationary marker is not an
omitted customer trip. Playback compresses eight recorded hours into about one
minute at 480×; the 15-second position sampling is not the recording duration.

**Is the revenue credible?** It remains unavailable until the viewer supplies
all three nonnegative USD rates, including explicit zeros where appropriate.
The calculation uses completed trips and their passenger distance/time. It is
a gross-fare illustration excluding costs, taxes, fees and other pricing rules.
Use the viewer's assumptions openly; no operator fare or profit is inferred.

**What does this establish about safety?** The model does not simulate injury
crashes, remote guidance or minimum-risk driving maneuvers. Those rates are
unavailable, not zero. Stored verification supports internal consistency under
the installed model/verifier. It does not authenticate the producer, evaluate
authorization or permit deployment to a vehicle.

**Would the power study settle SF acceptance?** No. The stopped study ran one
of 144 scheduled evaluation arms and has no paired primary estimate. A future
study could address power × location under its declared model and still be
inconclusive. Map qualification, devices and visitor evidence remain separate.
The [resource spike](FLEETLAB_RESOURCE_SPIKE_PROPOSAL_2026-10-04.md) is a proposal,
not approval to resume the study, raise a memory ceiling or freeze r3.

## Tailor the discussion to the audience

| Audience | Show | Useful next question |
|---|---|---|
| Engineering | Source identity, intervals, held samples and verification | Which missing input or verifier would change confidence in this decision? |
| Product | Completion, practical margin, all twelve repeats and adverse cases | What improvement is worth pursuing, and which rider groups could lose? |
| Operations | Fleet queue time followed by a vehicle timeline | Which bottleneck and service-time measurement should we investigate first? |
| Fleet management | Charging queues, energy target and unfinished shift states | Is usable charging capacity available at the places and times it is needed? |
| Sales | Viewer-entered fares and completed-trip exposure | Which customer-provided assumptions are needed before estimating value? |
| Depot partnerships | Equal-resource layouts and route/queue trade-offs | Which location, utility capacity and service constraints need site-specific evidence? |

## Prepare the room

1. Open Overview, notebook, replay and atlas before presenting; wait for loaded
   states. Keep the selected repeat and depot configuration visible. Present
   the default recorded experiment, not an unprepared new simulation.
2. Use the fleet aggregate before opening the full 100-ID selector. Keep the
   +2 pp practical threshold visible with the gain and interval. Show one
   adverse or mixed result before drawing a conclusion.
3. Keep the [acceptance record](FLEETLAB_SF_ACCEPTANCE_2026-10-04.md),
   [release evidence](FLEETLAB_SF_CLARITY_RELEASE_2026-10-04.md),
   [physical-device worksheet](FLEETLAB_SF_DEVICE_ACCEPTANCE_2026-10-04.md) and
   [independent visitor guide](FLEETLAB_SF_VALIDATION_SESSION.md) available.
   Run visitors before giving them this walkthrough: coaching would invalidate
   the intended unprompted comprehension evidence.

**Recommendation:** lead with the decision and controlled comparison, then
connect the fleet result to a trace. Use the visual polish to make the evidence
accessible while keeping the acceptance HOLD visible.

**Top risks + mitigations:** confusing models → name the selected experience;
cherry-picking → show all pairs and a mixed/adverse case; treating a replay as
safety validation → explain its sampling and model limits; coaching visitors
→ keep this presentation separate from the unprompted study.

**Next 3 actions:** rehearse this route; assign and collect the missing SF
source/map, physical-device and visitor evidence; record the owner acceptance
decision. Do not begin Austin.
