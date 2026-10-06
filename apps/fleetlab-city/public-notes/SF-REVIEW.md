# San Francisco: what this study establishes

FleetLab is an independent educational project by Bo-Huei Lin. It is not
affiliated with, endorsed by, or operated by Waymo, Zoox, or their partners.
All fleet operations, demand, vehicles and depots in this experiment are synthetic.

## Read the experiment

The recorded notebook compares one depot with two depots across twelve paired
random seeds (1001–1012). Each arm uses 100 generic EVs, 1,200 generated requests
and an eight-hour shift, 07:00–15:00. A seed is a reproducibility identifier,
not a named scenario or real vehicle observation. The 100 vehicle traces show
different assignments, travel, queues and energy histories within one fleet.
They are not 100 independently tested vehicle designs.

The baseline places eight ports, 200 kW total site power and four turnaround
slots at A. The candidate divides the same resources across A and B: four
ports, 100 kW and two slots at each site. The completion difference is about
+1.11 percentage points with a paired 95% interval of about +0.70 to +1.55.
The entire interval is below the declared 2-point practical margin. This does
not establish a useful improvement under that rule, even before map limitations.
Use the notebook's exact metrics and guardrails, not the rounded values here.

## Keep the evidence separate

- Recorded results use SF v1. New map candidates do not change old recordings.
- SF v2 and the time-aware candidate are separate map/engineering work.
- The 200 kW versus 400 kW study stopped after one of 144 arms. It has no usable
  paired estimate. A proposed isolated-worker study has not been run.
- Vehicle-concept and curb lessons are small teaching models. They do not
  measure Waymo, Ojai, Zoox, or operator performance.
- Viewer-entered fares produce an illustrative gross-fare calculation only.
  Injury crash rates, remote guidance and regulatory qualification are unavailable.

## Qualification remains open

The public website is a learning release. SF map acceptance remains HOLD.
Independent source observations, administrative scope decisions and a five-visitor
comprehension study are still needed. Technical browser/device checks do not
substitute for those observations. Publication does not authorize a vehicle,
policy, or operational deployment.

Inspect the [review requirements](../data/sf-review-requirements.json),
[review status](../data/sf-review-envelope.json),
[current candidate requirements](../data/temporal-review-requirements.json),
[current candidate status](../data/temporal-review-envelope.json), and
[source methods](SF-METHODS.md).

Hashes establish internal consistency against a supplied manifest. They do not
authenticate the producer. Scope: SIMULATION_ONLY. Authenticity: NOT_AUTHENTICATED.
Authorization: NOT_EVALUATED. Deployment permission and decision authority: NONE.
