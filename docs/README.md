# Docs folder guide

What lives where under `docs/`. Status and plans are not kept here: they live in `HERMES_SOURCE_OF_TRUTH.md` at the repository root, which every agent reads first.

| Folder | What it holds |
|---|---|
| `hermes/architecture/` | Hermes core: the Phase 1 to 4 architecture notes, the decision log, the implementation map, the demo runbook and unattended execution |
| `hermes/phase6/` to `hermes/phase9/` | Each phase's design, review and handoff documents |
| `hermes/pm/` | Product-management learning notes |
| `fleetlab/publishing/` | How FleetLab is published (the owner-run Cloudflare procedure), the repository recommendation and release reports |
| `fleetlab/handoffs/` | Dated project-wide handoffs and proposals |
| `fleetlab/playground/` | The Playground: simulation guide, Scale, Street and Bay Area labs, vehicle profiles, regional power |
| `fleetlab/city-explorer/` | City Explorer: the `CITY_*`, `SF_*`, temporal and power documents, map and continuity contracts |
| `fleetlab/network-flows/` | Network Flows: specs, handoffs, the Step A and Step B documents, `NF04_*`, delivery order and the R1 to R7 model contracts |
| `fleetlab/depot/` | The depot lab |
| `fleetlab/design/` | Design rounds and audits, artwork, visitor and visual handoffs |
| `releases/` | The public record of the live FleetLab release; the release tools read this path |
| `plans/` | Dated design and build plans; `labels.test.mjs` reads one of them |
| `superpowers/` | Agent execution plans |
| `archive/` | Earlier agent instruction sets: `phase5-instructions/` and `phase6-pack/` |
| `assets/` | Images the README uses |

Five FleetLab documents stay at the top of `docs/` because other files name their exact paths: `FLEETLAB_STREET_MAP_DATA.md` (named in shipped code), `FLEETLAB_HANDOFF_2026-10-06.md` and `FLEETLAB_NETWORK_FLOWS_HANDOFF_2026-10-09.md` (named in a shipped input manifest), `FLEETLAB_DEPOT_LAB_IMPLEMENTATION_HANDOFF_2026-10-24.md` (named in the public release record) and `FLEETLAB_N2_V2_DESIGN_FEEDBACK.md` (named in test data).
