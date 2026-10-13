# NF04-A contract and atomic package proof Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for implementation and a fresh final review. Track each verified deliverable below.

**Goal:** Resolve revision-3 audit M1–M4 and publish a source-reproducible teaching release without starting NF04-B.

**Architecture:** Preserve the existing deduplicated teaching graph, source sidecar and one atomic Cloudflare release. Add a bounded source offer and independently checked packaging receipt at integration, preserving legacy and offline caps. Use Cloudflare immutable deployment hosts for generation isolation; do not introduce another deployment pipeline.

**Tech Stack:** Node native modules, existing Python 3.11 integration tooling, Cloudflare Pages.

**Spec:** Owner-supplied FLEETLAB_REV3_NF04_A_DESIGN_AUDIT_2026-10-10.md, M1–M4, with the existing NF04-A contract.

## Global Constraints

- Current user explicitly authorizes build, validation, Git push and live publication; this overrides generic AGENTS §19 only for this educational website release.
- NF04-B engine, new cities, simulator experiments and physical vehicle control remain outside this release.
- Existing hosted teaching text ≤2,621,440 B; offline ≤2,621,440 B with 50,000 B reserve.
- Proof gates: raw text/build tools and prospective emitted aggregate ≤3,145,728 B each; NF03 full closure ≤524,288 B; source offer compressed and extracted ≤4,194,304 B each; teaching text plus compressed offer ≤7,340,032 B; complete teaching generation ≤14,360,576 B.
- All original inputs and build tools remain available. Extra source files, media and physical retained copies have explicit owners and counts.
- Preserve all SF current/rollback/source-offer bytes and qualification HOLD. Preserve owner's four untracked Oct9 documents.

## Review Focus

1. Resealed mutations must fail checkout-bound reproduction, not pass because hashes were recomputed.
2. All shared dependencies count in each route closure and only once per physical aggregate path.
3. Source-offer compressed size cannot hide excessive extracted size or omit required media.
4. Integration must reject changed source/client/offline or pointer and preserve the entire City inventory.
5. Legacy discovery growth remains in the legacy gate; a future link is measured as a fixture, never advertised as a working lesson.

### Task 1: contract amendments

**Files:** New Oct12 contract and experience spec, audit decisions; preserve Oct10 history.
- [x] Resolve M1 selected/shared rates and limiting causes; M2 common preload P/availability; M3 N×S/S storage.
- [x] Select B-lite, distinguish present enforced gates from future route capacity; retain V1 and physical/human acceptance.
- [x] Review analytical fixtures and audit decisions; no prose-only tests.

### Task 2: source package and accounting

**Files:** `playground/fleetlab/tools/package-proof.mjs`, `playground/fleetlab/test/package-proof.test.mjs`.
**Interface:** CLI `--site DIR --playground DIR --offline FILE --source-commit SHA --out DIR`, produces only `downloads/teaching-package.json` and immutable `network-flows/sources/<sha256>.json.gz`; checker reconstructs the expected files against the frozen checkout.
- [x] RED: real source/pack fixture tests reject changed payload, source, pointer, closure, missing/extra files, resealed HTML and mixed release; test shared graph and archive accounting with tiny literal graphs.
- [x] GREEN: closed no-follow source capture, exact source commit/tool binding, gzip source offer plus pinned media, complete route closures and byte gates; source and emitted inventories checked against existing builder.
- [x] Measure the exact eventual discovery-link fixture without publishing a dead control. Record legacy headroom and any required recovery honestly.
- [x] Run focused tests and source reproduction, including source archive unpack/rebuild in scratch.

### Task 3: integrate and validate

**Files:** `apps/fleetlab-city/tools/integrate-site.py`, integration tests, runbook.
- [x] RED: optional source package cannot be attached to a different teaching source or offline artifact.
- [x] GREEN: explicit `--teaching-package` integration opt-in, add only checked receipt/immutable source files, bind to final inventory; existing releases remain compatible.
- [x] Run teaching Node, City Node/Python, Hermes pytest/Ruff/doctor, publication guard and diff checks after source freezes.
- [x] Fresh reviewer assesses patch and resolves material findings before source commit.

### Task 4: publish and handoff

**Files:** Oct12 handoff, `docs/releases/fleetlab-current.json`, `CODEX_HANDOFF.md`.
- [x] Commit source, build from exact commit in clean managed release worktree, integrate unchanged City and offline, measure whole site.
- [x] Push authorized branch, preview publish, full byte/header/browser checks; reuse same artifact for production and repeat readback.
- [x] Record actual identities, counts, decisions and residuals; copy final Oct12 feedback documents to Downloads; commit/push receipt.
