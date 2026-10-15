# FleetLab Round 10 handoff — October 15, 2026

## Scope and owner decisions

Round 10 §7 P1 only: public-reporting notes, staffing-source confirmation, a five-stop presentation path, and an owner-approved contact card. No new lessons, models, fixtures, numerical studies, media, budget limits or P2 work. The existing founder story remains verbatim.

The owner supplied and approved this replacement contact sentence: “I build fleet-operations simulations and network-flow optimization engines to advance my work across Autonomous Vehicles and Physical AI.” The card uses Bo-Huei Lin and the existing `bohueilin@gmail.com` email link. **Standing owner direction: public copy must never describe the owner as seeking a next role.**

## Item-by-item outcome

| Item | Status | Implementation / decision |
|---|---|---|
| P1-1, three field notes | Could not implement all three as written | The exact UK body is added to the region-launch lesson, with the existing public-reporting treatment, full accessible evidence-boundary label, and dated Covington ↗ link. The exact charging and Taiwan wordings remain held for the source gaps below. Existing supported notes remain. |
| P1-2, staffing count | Done | The site already said approximately 3,000 vehicles and about 70 on-duty remote-assistance agents, dated February 2026. Waymo's February 17 statement confirms both. No numerical correction was needed. Remote assistance remains explicitly distinct from modeled depot cleaning. |
| P1-3, Presenting FleetLab | Done | Ordinary semantic content on About & limits, after the introduction: Home concept film → Fleet day → walkthrough verdict → recorded City Explorer shift → dispatch snapshots. Existing card and 44 px link styles are reused. Instructions include preparing the walkthrough and reading the selected run's actual results. |
| P1-4, contact card | Done with owner's replacement wording | The approved sentence, name and email appear above the footer on About & limits. The proposed audit sentence was not published. |

Invented facts, numerical results, models or claims: **none**. P1-3 is a condensation of the supplied demo path. It names five stops rather than promising five literal clicks or a guaranteed runtime. It does not hard-code the audit's 176 unserved requests, 26-minute improvement, 4h56m wait or other run-dependent outcomes. Singapore HD-maps and all P2 items remain held.

## Source decisions

| Claim | Evidence and decision |
|---|---|
| UK registration and permits | [Covington, October 1, 2026](https://www.insideglobaltech.com/2026/10/01/overview-of-eu-and-uk-regulatory-developments-relating-to-autonomous-vehicles/). Its indexed full article supports the brief's late-September wording and separately states that automated-passenger-service permits had not been granted. Published as dated public reporting, not a government record or current legal advice. Direct access returned 403 during research; the full indexed article was available. |
| Waymo staffing | [Waymo, February 17, 2026](https://waymo.com/blog/shorts/advice-not-control-the-role-of-remote-assistance/). The primary statement names a fleet of 3,000 and approximately 70 agents on duty worldwide. No vehicle-per-agent ratio is inferred. |
| Charging, several MW | [NREL report 91571, November 2024, FY2025 series](https://docs.nlr.gov/docs/fy25osti/91571.pdf), printed pages 10 and 17. Supports several-MW loads for multiple trucks/buses and smart charging as a fundamental planning component. It does not establish the exact note's universal “standard mitigation” wording. |
| Charging, 15 MW and factories | [GCN, August 31, 2026](https://gcn.com/electric-truck-depots-across-approaching-megawatts/) is the source of the factories/interconnection-studies assertion. [Port of Long Beach filing, June 11, 2024](https://ceqanet.lci.ca.gov/2024060409) independently supports planned 15 MW electrical infrastructure, but not that factories assertion. Hold the exact note rather than silently substituting narrower copy. |
| Taiwan edge AI | [Auto Connected Car News, June 1, 2026](https://www.autoconnectedcar.com/2026/06/computex-gtc-autonomous-news-nvidia-otobrite-turing-drive-mediatek-aaeon-foretellix-vinfast-autobrains-microip-intel-axelera-brainchip/) describes several exhibitors. [MediaTek, May 28](https://www.mediatek.com/press-room/mediatek-to-empower-the-agentic-ai-era-with-edge-to-cloud-tech-at-computex-2026) supports automotive edge-computing exhibits; [AAEON, May 25](https://www.aaeon.ai/en/news/detail/computex-2026) describes general edge-AI exhibits. These do not establish a national AV-ecosystem preference over full autonomy. Hold the exact note. |

The audit's claim that all three notes had cleared the research bar was treated as a review assertion. Its own uncertainty fence governs the two holds. No unsupported replacement was invented.

## Source trim

The preceding founder-copy release had NF-03 closure **523,495 / 524,288 bytes**, leaving **793 bytes**, not the older 1,033-byte figure.

The stylesheet's 3,868-byte opening catalogue was compacted into a 1,954-byte class inventory: **1,914 bytes recovered from redundant inline prose**. All 132 original class names remain. No CSS declaration, selector, cascade rule or runtime import changed. The original comment is retained in Git history and the local validation evidence.

An initial attempt removed the whole catalogue and failed four existing inventory checks. That attempt was corrected by retaining the inventory; no test was weakened. The corrected focused suite passed 143 tests, with one skip and one TODO. The new hosted content adds 2,516 bytes before final packaging. No ceiling was raised.

| Final measure | Bytes | Unchanged limit | Headroom |
|---|---:|---:|---:|
| Original teaching source + tools | 3,136,281 | 3,153,920 | 17,639 |
| Offline edition | 2,560,130 | 2,571,440 | 11,310 |
| Package metadata | 37,475 | 40,960 | 3,485 |
| Integrated emitted text | 3,103,777 | 3,145,728 | 41,951 |
| Integrated NF-03 dependency closure | 524,097 | 524,288 | **191** |

The final source-bound package proof and independent upload guard pass. The 191-byte NF-03 margin is a concrete constraint on future shared content, not permission to raise the ceiling.

## Validation and release

Validation evidence is under `build/fleetlab-city/validation/design-round10-20261015/`.

- Browser: all five guide links reach the intended existing pages. Returning to About preserves one guide and one contact card. The UK note appears only for its selected lesson. Desktop and 390 px phone layouts have no horizontal overflow; guide links are at least 46 px high. Screenshots cover the guide, contact card and reporting note.
- Source review and independent code review were completed. No actionable code-review findings remained.
- Tests: teaching Node 2,418 pass / 8 skipped / 1 TODO; hosted Node 102 pass; City Python 345 pass; Hermes Python 1,661 pass / 56 skipped. **4,526 passing tests.** After the final link-class change, the focused hosted suite passed 11/11. Ruff and Git whitespace checks pass. Doctor reports 17 PASS, one expected dirty-tree WARN and one optional display NOT_AVAILABLE.
- The owner’s standing FleetLab GitHub/live-publication authorization continues to apply. Website publication has no bearing on real-vehicle operation or deployment authority. SF source/map, physical-device and human qualification remain separate.

### Release identity

- Runtime/source commit: `d233e1baf6387a296e8a6f8690ece270cbf9b87e`, pushed to `github/codex/fleetlab-city-sf`.
- Public site: [FleetLab](https://fleetlab.pages.dev/#/approach).
- Immutable production: [9ffe72c5](https://9ffe72c5.fleetlab.pages.dev/#/approach); deployment `9ffe72c5-945e-4f6f-b451-3bc44c3d3266`.
- Preview: [ae392522](https://ae392522.fleetlab.pages.dev/#/approach); deployment `ae392522-034b-4954-a6d0-43fbd517fa9e`.
- Previous production retained: [1e821956](https://1e821956.fleetlab.pages.dev).
- Current City Explorer path: `city-explorer/releases/34258fef3cb4af33`; scientific baseline remains `c56bda6b509105c5`.
- Packaged teaching source: `network-flows/sources/a086b9311c10664da56d3f732c97f363b68262e6358a4278e872021b482b1097.json.gz` (974,425 bytes).
- Preview full readback: 10,138 / 10,138 served files match. Preview and production headers: 71 / 71 each. Immutable production and previous-production smoke checks: 102 / 102 each. Stable production full readback: **10,138 / 10,138 match**, captured 2026-10-15T22:36:24.908049+00:00. The package contains 10,139 staged files; the host-served inventory contains 10,138.
- Production browser confirms the exact approved contact sentence and the five-stop guide. Proof images: `presenting-production.png` and `contact-production.png` in the validation directory. Phone checks used a browser viewport, not a new physical-Pixel qualification.

The inherited publication receipt contained `files` as a readback-results list instead of the path-to-expectation mapping required by `readback.py --record`. The prior receipt was preserved, its expected inventory normalized for the rollback check, and this release keeps `candidate-smoke.json` separate from result files. The final receipt retains the mapping and passed a fresh `--record` check: **102 / 102 match**. This repairs release bookkeeping without changing runtime or simulation behavior.

### Reproduction entry points

```sh
node --test playground/fleetlab/test/*.test.mjs
node --test apps/fleetlab-city/test/*.test.mjs
bash build/fleetlab-city/validation/design-round10-20261015/build-release.sh
build/fleetlab-city/venv/bin/python apps/fleetlab-city/tools/readback.py --url https://fleetlab.pages.dev --site /private/tmp/fleetlab-design-round10-20261015-release/integrated-release/site --output build/fleetlab-city/validation/design-round10-20261015/production-readback.json
build/fleetlab-city/venv/bin/python apps/fleetlab-city/tools/readback.py --url https://9ffe72c5.fleetlab.pages.dev --record docs/releases/fleetlab-current.json --output build/fleetlab-city/validation/design-round10-20261015/final-receipt-smoke.json
git diff --check
```

Build, test and deployment logs retain both the first inventory-test failure and the corrected passing run. Generated artifacts and unrelated owner assets are not staged. The release receipt and this handoff are committed separately from the already deployed source commit. The temporary deployment worktree was archived after publication; the main checkout and unrelated owner files were preserved.

## Recommendation and next actions

Recommendation: keep the two unsupported exact field notes held; use the linked demo path and the approved contact card for presentations.

Top risk: importing an industry assertion into the site as if it were established model evidence. Mitigation: dated public-reporting labels, direct sources, exact claim review and explicit holds. Shared-code headroom must be measured again before future additions.

Next three actions: review the current live release; obtain stronger primary support before revisiting either held note; keep P2 design work queued until separately authorized.
