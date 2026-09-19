# FleetLab homepage film

## Creative direction

An original, silent 3D concept film introduces the human purpose of fleet operations: a pleasant ride depends on a vehicle being ready. Bay-inspired waterfront scenery, friendly unbranded electric AVs, people on a promenade and a small charging depot connect the ride to the work between rides. The concept uses a restrained coastal palette, warm sunlight, readable vehicle silhouettes and smooth movement. It does not depict a measured simulation run or actual fleet performance.

The visual reference is [Wayve's homepage](https://wayve.ai/), inspected September 19, 2026: expansive motion, concise typography and an immediate next action. No Wayve footage, logos, vehicle designs or other site assets are reused. This project's film is an original Blender scene.

Headline: **Every great ride starts with a ready fleet.** The next action remains **Run a fleet day**. Supporting copy explains what FleetLab lets visitors learn; the interactive depot explainer stays available below the introduction.

## Delivery contract

- Hosted film: `playground/fleetlab/media/fleet-film.mp4`, silent H.264, 1280 × 720 or higher, approximately 12–18 seconds, no more than 4 MiB.
- Poster: `playground/fleetlab/media/fleet-film-poster.webp`, no more than 200 KiB.
- Autoplay is muted and inline, only while the homepage film is visible. Pause is reachable by keyboard. Leaving Overview, scrolling away or hiding the tab pauses it. A user pause persists across navigation.
- Reduced-motion and data-saving preferences start on the poster, without downloading the film. The visitor can deliberately choose playback. If autoplay or decoding fails, the poster and product actions remain usable.
- The offline single-file edition embeds the poster and retains all simulation tools; the optional film is omitted. It makes no external media request. The existing 2.5 MiB offline/app budget remains unchanged; the hosted film has a separate explicit media budget.
- Only these two named, regular media files may enter the static package. Reject symbolic links, unexpected media, wrong formats and oversized media. Hosted CSP adds same-origin media only. The checker must continue scanning all code and interface copy.
- Film rendering is an authoring tool only. No Blender runtime, new frontend dependency, analytics, remote video service or third-party network request is added to the website.

## Scope and authorization

The user requested a front-page AV film and previously explicitly authorized feature-branch GitHub publication and Cloudflare deployment. Those instructions govern this public, static FleetLab enhancement and override the historical Phase 6 local-only/publication restriction for this site. The Hermes evidence workbench and Python core remain untouched. No real vehicle, production fleet, safety or regulatory claim is introduced.

## Acceptance

Inspect the rendered frames and loop, then verify desktop and mobile layout, actual video playback, pause/resume, navigation cleanup, poster fallback, and offline packaging. Run the relevant UI/packaging tests and repository checks. Record measured media size, format, hashes and publication outcome in the release handoff.

## Product rationale and interview use

The film earns its place by introducing the rider outcome, then pointing directly into an inspectable operational model. It is a short introduction to the product's question, not the evidence for its answer. The following workflow demonstrates the substance:

1. Open **Fleet day**, run the default scenario, and select a vehicle. Connect its passenger trips to its battery and service work.
2. Change one depot resource and inspect completed trips alongside queueing and vehicle readiness.
3. Open **Street lab** to show how a downtown queue can change pickup time and empty travel. Explain that the street and depot engines have distinct scopes.

A concise introduction: “I built FleetLab to make the work behind a ride visible. It lets a reviewer explore how demand, street congestion and depot resources constrain service, inspect an individual vehicle, and compare operational choices. The film introduces that human purpose; the tools expose the assumptions and trade-offs.”

This is a proposed communication improvement, not a measured conversion, comprehension or user-study result. A useful next evaluation is whether a first-time visitor can explain the decision FleetLab helps explore and start a scenario without guidance.

## Authoring source

The reproducible scene and rendering instructions are in [`tools/fleet-film`](../tools/fleet-film/README.md), outside the dependency-free browser application. The scene uses original generic vehicle concepts and a composed Bay-inspired environment; it does not reproduce the selected simulator's real-map routes or a manufacturer's engineering model.
