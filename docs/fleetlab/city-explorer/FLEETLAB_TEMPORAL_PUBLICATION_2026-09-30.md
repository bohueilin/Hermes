# SF temporal atlas publication — 30 September 2026

Implementation: `cce2d72`. The update is live at [FleetLab City Explorer](https://fleetlab.pages.dev/city-explorer/#atlas). Preview and production each passed **10,001/10,001 exact file comparisons** and effective security-header checks.

City Explorer adds a third atlas version, **Time-aware candidate · SF v3**. The original recorded map and earlier static candidate remain selectable. Decision notebook, Replay studio, the root Overview animation, Fleet day, Street lab, Learning catalog and offline artifact retain their existing content.

The new explanatory panel separates three lessons: preserving route history through a stop, applying time-dependent rules at traversal time, and inspecting source evidence. It presents the completed 100-vehicle, 1,200-request, eight-hour engineering case as one software/resource check. It is not a new depot experiment, a calibrated vehicle comparison or an operator prediction. The atlas shows source support; it does not evaluate live road access.

## Evidence and review

- Full candidate bundle: `8a927cba063febeb9edaf99f4ab0e0c05f9a8fe349fd192da9afcbc46355f198`.
- Full graph: `426201012c7caae963fd71215b38967fbaa46ff18ce43376f729bbd212961de3`.
- Current review requirements: `4d43fb2d932b01da27d16055774dfe1b6de141ce342e1a74d9f0248b689c5ac8`.
- 2,160 obligations; 200 source-way samples and 100 OD pairs; zero human observations.
- 175 timed turn rules and 32 way-access schedules. Unsupported eligible length is 0.9869755871%; all class budgets pass. District scope remains unresolved; acceptance remains HOLD.

The complete map database, candidate-specific review workspace, unchanged engineering recording, captured sources and transformation software are offered for download. The old adverse verifier report is published as `verify-report.public.json`: only its private traceback is removed, with explicit original SHA-256 and projection metadata. The original bytes remain locally unchanged; the public projection cannot reproduce the original report's byte hash. Its findings and the corrected verification remain visible.

Integration verifies the offered database manifest and every constituent against the viewer's selected bundle. Review found one broken relative source-download link; a versioned-path regression failed before the fix and now passes. No minor findings remain in this bounded review.

## Completed validation

293 City Python tests; 54 City JavaScript tests; 1,661 repository Python tests with 56 skips; Ruff and whitespace checks pass. Doctor reports 17 PASS, 1 environment WARN and 1 optional NOT_AVAILABLE. All twelve frozen power-study sources are unchanged.

Responsive checks at 390, 1024 and 1280 CSS pixels retain document width. Phone-width map controls stack above the map; the coverage table scrolls within its container. These are browser layout checks. ADB reports no Pixel, and no physical-device or human-comprehension pass is claimed.

## Remaining San Francisco acceptance work

1. Adopt a source-supported, versioned district/boundary policy and bind any changed map to fresh requirements. Existing boundary differences remain visible.
2. Obtain actual independent map observations, visitor sessions and physical-device evidence; never populate those checks from automated tests.
3. Resolve calibrated vehicle and maneuver inputs, and any separately approved scientific amendment. The 144-arm power evaluation remains stopped after its one approved retry; packaging does not rerun it.

Austin follows SF acceptance. Las Vegas remains later. Static publication does not change simulation-only scope, authenticity or deployment authority.

## Release identities

- Viewer release: `14dc0191dd7684d0ea9807f8a4d68e018a8be58a2349440ce0b4a801c0af51ad`.
- Combined stage: `build/fleetlab-city/launch-integration-v4/site`; 10,002 staged / 10,001 served files, 1,590,225,823 bytes.
- Integration manifest: `1d4338407bdaf15a4a8126fca82808df1a9333a04529b81b5b510e547fa32830`.
- Source-offer manifest: `71872c6f571c644dbc2fbfee4bb308e3ed2f7406c7a54ecb3f70ab0e2e4fc817`.
- Preview: `db37ee8b-3e90-47d8-8b17-f5a869de47bd`, <https://db37ee8b.fleetlab.pages.dev/>.
- Retained prior production: `a9f05880-a7c7-426f-b5ee-567a39cf0fce`; prior stage `launch-integration-v3/site`.
- Compatible rollback viewer is included at `city-explorer/releases/7d062d3e51fab0d2/`.

The 96 protected root files and offline HTML remain byte-identical. Only the already approved root navigation/header integration changes from the established pre-City site are applied. No branch push or PR merge occurs in this static publication.

Deployment uses the existing pinned Wrangler 4.135.0 with its previously documented serial upload transport patch; authorization, API destinations and payload hashes are unchanged. Preview uploaded 44 changed assets and reused 9,957; no retry was needed. The public diagnostic projection is a documented privacy decision, not a replacement for the original local evidence.

## Production verification and handoff

Production: `e37b4a7b-c60d-4a42-b705-ec6c0bf730e2`, immutable URL <https://e37b4a7b.fleetlab.pages.dev/>. The stable site is <https://fleetlab.pages.dev/>. Production reused all 10,001 already verified assets. No deployment retry was required.

- Preview and production: 10,001/10,001 exact payload matches; root, versioned City, rollback and source-offer headers pass.
- Production readback SHA-256: `f686372a24f884d1198838d985a73278571386ef050b726b671caf690a0d000c`.
- Production hosting report SHA-256: `c8427a8697d015e241a8cd3e1844fcd39448263b8b47ffa7dfd6c030f20edef7`.
- Publication record: `build/fleetlab-city/launch-integration-v4/review/publication.json`; SHA-256 `6e4bd5ef182f3518879796ecbe9fc3cb344649e4603234d81e74a1970eed2658`.
- Production direct Play reached the full 15:00 end of the eight-hour recording; playback stopped automatically. Hosted preview direct Play advanced 07:00 → 09:37. The retained rollback viewer advanced 07:00 → 08:57 locally. Revenue stays unavailable without all three visitor-entered fare rates.
- Selecting the temporal map disables fictional-depot/scenario controls; returning to the recorded map restores the controls, and one-depot mode shows only A. Source-download links resolve from the versioned viewer to the shared complete offer.
- Overview film was playing with readyState 4; original navigation and owner contact remain. All prior data hashes, protected root files and offline bytes match.

No production rollback was performed. Effective hosted Range requests return a complete matching HTTP 200 body; no 206 capability is claimed. Pre-publication notes in the immutable viewer retain their build-time state; this document and the publication record are the current handoff. No City acceptance, human observations, calibrated operator claim or new scientific execution is implied.

**Recommendation:** use the live atlas and original recorded study for the demonstration, with qualification boundaries visible.

**Top risks + mitigations:** district policy and independent observations remain missing; keep SF on HOLD. The power study remains incomplete; preserve its retained arm and seek a separately measured amendment before any new evaluation.

**Next 3 actions:** (1) resolve district adoption under an explicit source/scope policy; (2) complete the independent map, visitor and physical-device sessions using the current worksheet; (3) record SF acceptance before starting Austin, with Las Vegas later.
