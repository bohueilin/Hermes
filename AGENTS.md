# Agent instructions for this repository

This repository is public. Hermes is a simulation-only lab; FleetLab (https://fleetlab.pages.dev)
is its public teaching website.

Start with HERMES_SOURCE_OF_TRUTH.md: the "Start here" block at the top of its newest dated
section, then the reading order it gives. That file is the only status and plan document;
this one only points to it and lists the rules that most often bite.

- Permission: never push, open or edit a pull request, merge, upload or go live without the
  owner's own message naming the exact branch and commit. Agents never hold Cloudflare credentials.
- Staging: stage named paths only, never `git add -A`. Private material never enters this
  repository, and committed files carry no local paths.
- Protected files: do not edit Makefile, .gitignore (byte-pinned), pyproject.toml, .github/ or
  src/hermes/ without an owner-approved, reviewed change; the R6 boundary test fails otherwise.
- Do not move product code (playground/fleetlab/, apps/fleetlab-city/, tools/fleetlab-traffic/),
  config/, scenarios/, evidence/, LICENSE or SIMULATOR_COMMIT: shipped bytes, evidence digests
  and tests bind their paths.
- Record only checks you ran, with their output. Never raise a byte bound or pin.
- Simulation only: no real vehicle, CAN bus or public-road connection; no certification,
  compliance or deployment claim; no language model in a real-time control loop.

Earlier instruction sets are archived in docs/archive/ (Phase 5 and Phase 6).
