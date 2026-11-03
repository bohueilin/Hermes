# FleetLab SF walkthrough and notes release — 5 October 2026

**LIVE AND VERIFIED:** [FleetLab](https://fleetlab.pages.dev/) and
[City Explorer](https://fleetlab.pages.dev/city-explorer/). **SF acceptance remains
HOLD. Austin remains NOT_STARTED.** The [October 4 acceptance record](FLEETLAB_SF_ACCEPTANCE_2026-10-04.md)
still defines the educational milestone and its separate source/map, device,
visitor and owner requirements. This release adds presentation preparation and
repairs document packaging; it changes no UI behavior or scientific result.

## What changed

The [executive walkthrough](FLEETLAB_SF_EXECUTIVE_WALKTHROUGH_2026-10-05.md)
provides a ten-minute presentation, department-specific discussion prompts and
answers about seeds, vehicle identities, queue-hour denominators, unavailable
revenue and safety measures, the practical margin and the incomplete power study.
Its numbers and navigation were inspected in the live browser. It preserves the
original Overview and teaching experiences as the product's front door. Use it
separately from the uncoached visitor study.

The packaged completion handoff and visitor guide referenced four October 4
document links whose targets were absent from the bundle. A local consumer-link
check reproduced that failure. The explicit notes allowlist now includes nine
additional current or supporting documents, including the acceptance record,
release, handoff, device worksheet, resource proposal and presenter guide.
The resulting check resolves 20 relative links across eight current records.
This is a scoped packaging check, not a claim that every historical document or
external web link has been audited. The administrative report gains a historical
scope banner so its old power-study next action cannot override the accepted
deferral. Fuller unresolved district geometry remains local.

## Validation and preservation

Fresh checks: 312 City Python tests; 59 City JavaScript tests; 1,661 Hermes tests
passed with 56 skips; Ruff and whitespace checks passed. Doctor reports 18 PASS
and one optional NOT_AVAILABLE. The tiny allowlist change was inspected by the
primary agent; no new independent human map review is implied.

All viewer source files match the preceding release byte-for-byte. All 4,886
non-catalog data files match, including compressed representations. The catalog's
only semantic difference is measured exporter peak RSS. Twelve frozen scientific
source files, comparison core, 13 protected review/proposal inputs, 96 protected
root assets and the offline edition remain unchanged. No new full-SF arm or
evaluation tape was generated. Existing tiny build fixtures and read-only
verification of retained recordings are separate from scientific execution.

Viewer total: 768,120,440 bytes / 4,960 files including its manifest, +122,951 bytes
versus v9. First-view compressed transfer: 1,906,731 bytes, +1 byte. The largest
file remains 22,272,149 bytes; the largest pair gzip remains 9,869,801 bytes.
All established byte, dependency, integrity and hosting budgets pass.

Actual preview and production browser interaction verified the versioned route,
unchanged +1.11 pp result and +2 pp threshold, first-pair navigation, exact
09:36:29 queue state versus the 09:36:15 held sample, and direct Play/Pause.
Production playback advanced to 13:38:22. No browser warning/error was observed.
Prior responsive checks remain reported in the October 4 release; they were not
rerun as new physical-device evidence. Current ADB still lists no Pixel.

Preview readback matched 10,027/10,027 served payloads and effective headers.
The initial production readback matched only 9,973/10,027: 53 new asset requests
returned the unchanged root HTML, and the temporal-road transfer captured
45,853,070 bytes instead of 22,271,459. The original failed report is retained.
Later spot checks matched. Rollout propagation and stdout accumulation during
curl retries are possible explanations, not established provider diagnostics.
No staged bytes were changed. A fresh complete production readback then matched
**10,027/10,027**, with headers and separate hosting checks passing. This final
verification completed at 2026-10-05 16:41:45 UTC. Range probes returned complete
HTTP 200 bodies, not 206; no partial-content claim is made.

## Identities, Git and rollback

| Item | Identity |
|---|---|
| Source implementation, pushed | `9a2e975ebc7602df18c0734a7b975ee3c30e69c0` on `github/codex/fleetlab-city-sf` |
| Production | `96dc3971-23dc-493e-8b2a-bd86b7c210ee`; [immutable site](https://96dc3971.fleetlab.pages.dev/) |
| Preview | `7f295883-c0de-4798-86b8-5b7587fd2e66`; [immutable preview](https://7f295883.fleetlab.pages.dev/) |
| Viewer | `dist/city-explorer-v10-sf-walkthrough`; `4a2fd0ce412c1b0ba14a73776ccbd11ece909de86ba661c3847290aceb192590` |
| Combined stage | `build/fleetlab-city/launch-integration-v6/site`; 10,028 staged files / 1,616,732,522 bytes; `_headers` is not a served payload |
| Integration manifest | `93b32839cc91ee4792cb7aa1e91a9f8288d70aac2bf5933e3defc1139f90dbf2` |
| Source offer, unchanged | `71872c6f571c644dbc2fbfee4bb308e3ed2f7406c7a54ecb3f70ab0e2e4fc817` |
| Final production readback | `224acdec70fb0a65f8612f51456292c4c5e632fbdc8ebf707fd968614a86af75` |
| Initial failed readback, retained | `847f4a3b4fed6d009cddae7b2fd57e4be1cb0877d49c03bf66ad0535d16a300e` |
| Publication record | `build/fleetlab-city/launch-integration-v6/review/publication-2026-10-05.json`; `371b67e8c59de7b3660ca81c3cea34c2a17958f65ae8ce4a19ed9371a4b882ae` |

Evidence directory: `build/fleetlab-city/validation/sf-walkthrough-20261005/`.
The build captured the working tree based on `1ef5495`; its notes/allowlist changes
were committed as `9a2e975` before publication. This subsequent release record is
a documentation-only commit and is not retroactively inserted into the immutable
bundle. Packaged dated notes retain their captured historical release identities.
For new formal sessions on the current site, bind observations to the full v10
release digest above; the v9 UI was proven byte-identical, but report the actual
release opened. Do not substitute the moving stable URL alone.

The retained v9 viewer `cee47cf4eb126c1a` is staged with compatible data and checked
headers. Full-site rollback uses retained deployment `b009157f-a164-42cc-a0b5-c63ef9d12c57`
and `build/fleetlab-city/launch-integration-v5/site`. A city-only rollback selects
that staged v9 viewer. Production rollback was not performed. Retain prior
deployments and artifacts for at least 30 days. Main was not merged or rewritten;
owner files `.wrangler/` and `FleetLab-ChatGPT-review-and-next-phase.md` were excluded.

**Recommendation:** use the verified site and walkthrough for an educational
executive discussion; keep SF acceptance HOLD until its required evidence exists.

**Top risks + mitigations:** transient wrong asset responses → full post-deployment
readback and retained failure evidence; polished visuals mistaken for qualification
→ explicit scope and separate acceptance matrix; coaching visitors → perform the
unprompted study before sharing the presenter script.

**Next 3 actions:** assign capable source/map reviewers; collect physical-device,
accessibility and five-visitor evidence with two scorers; record the owner's SF
acceptance decision. No Austin work or new scientific campaign was started.
