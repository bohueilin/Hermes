# City Explorer v3 — qualification, learning and launch preparation

Owner request: improve SF map qualification; use the connected Pixel; consider Ojai and Zoox; improve the product presentation and prepare the public launch. Earlier approval of assessment §7 remains the release boundary: prepare a concrete package, retain legacy bytes and headers, and do not switch production automatically.

## Design and implementation

1. Preserve recorded SF v1 runs. Import an explicitly versioned candidate with bounded via-way restriction support, independent path inspection, unsupported-record inventory and district-gap review queue. Prevent candidate fleet execution until restriction history across trip legs has a contract.
2. Research official district variants and mature routing implementations. Quantify differences; never assign gaps to the nearest district silently.
3. Add a welcoming start page with a three-step learning journey, department questions and an interactive vehicle-design gallery. Ojai and Zoox remain sourced references; the recorded fleet remains generic. Visitors should understand the decision, the observed result and the next evidence needed.
4. Present candidate qualification separately from the old recorded map, with source identities, downloads and actionable review locations.
5. Validate the physical Pixel through its mirrored UI as well as desktop and narrow browser layouts. Record device observations separately from a five-person formative study.
6. Build a fresh verified viewer. Stage a content-addressed `/city-explorer/releases/<digest>/` release alongside unchanged legacy assets. Keep the rollback package and a concrete optional navigation patch. Check manifest, same-origin headers, deep links, asset limits and rollback.

## Acceptance

Focused adversarial routing/verifier tests, existing city tests, browser/device interactions and package checks. The existing v1 evidence must remain unchanged. No operator calibration, safety or real-world release authority is inferred. Human map review and participant study are recorded as open unless actually completed. Root regression gates run after heavy map/package work ends.
