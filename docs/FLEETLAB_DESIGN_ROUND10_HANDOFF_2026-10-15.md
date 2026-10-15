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

## Validation and release

Validation evidence is under `build/fleetlab-city/validation/design-round10-20261015/`. Final package measurements and deployment identities are recorded below after the release checks finish.

- Browser: all five guide links reach the intended existing pages. Returning to About preserves one guide and one contact card. The UK note appears only for its selected lesson. Desktop and 390 px phone layouts have no horizontal overflow; guide links are at least 46 px high. Screenshots cover the guide, contact card and reporting note.
- Source review and independent code review were completed. No actionable code-review findings remained.
- Tests: teaching Node 2,418 pass / 8 skipped / 1 TODO; hosted Node 102 pass; City Python 345 pass; Hermes Python 1,661 pass / 56 skipped. **4,526 passing tests.** After the final link-class change, the focused hosted suite passed 11/11. Ruff and Git whitespace checks pass. Doctor reports 17 PASS, one expected dirty-tree WARN and one optional display NOT_AVAILABLE.
- The owner’s standing FleetLab GitHub/live-publication authorization continues to apply. Website publication has no bearing on real-vehicle operation or deployment authority. SF source/map, physical-device and human qualification remain separate.

## Recommendation and next actions

Recommendation: keep the two unsupported exact field notes held; use the linked demo path and the approved contact card for presentations.

Top risk: importing an industry assertion into the site as if it were established model evidence. Mitigation: dated public-reporting labels, direct sources, exact claim review and explicit holds. Shared-code headroom must be measured again before future additions.

Next three actions: review the current live release; obtain stronger primary support before revisiting either held note; keep P2 design work queued until separately authorized.
