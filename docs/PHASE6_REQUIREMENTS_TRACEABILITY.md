# Hermes Phase 6 Requirements Traceability

This is the initial matrix. Codex must replace planned module and test names with actual names during design freeze and implementation.

| Requirement | Owner component | Milestone | Test or evidence | Envelope or UI field | Failure result |
|---|---|---|---|---|---|
| Exact artifact selection | artifact selector | review core | traversal and root tests | artifact identity | exit 40 |
| Immutable capture | existing capture plus facade | review core | before-after digests and TOCTOU | verification and source inventory | invalid or exit 30 |
| Existing verification source of truth | verification facade | review core | parity and golden tests | verification and gate | fail CI |
| Separate trust states | review model | design and core | schema tests | trust | contract error |
| Invalid stored PASS quarantine | review assembler | review core | corrupt PASS fixture | verification quarantine | invalid or exit 30 |
| Evidence sufficiency | core mapping | review core | profile cases | evidence sufficiency | fail closed or explicit unavailable |
| Exact metric semantics | review projection | review core | threshold-edge tests | metrics and findings | fail test |
| Source event references | source-reference service | review core | event-link tests | findings and event index | explicit unavailable if unsupported |
| Review JSON | review CLI | review core | CLI parse and golden | entire envelope | exit 30 or 40 as applicable |
| Comparison compatibility | comparison facade | comparison | incompatible fixture | compatibility | exit 40, no deltas |
| Improvements and regressions | comparison facade | comparison | lead and cut-in cases | comparison lists | fail test |
| No winner score | comparison contract | comparison and UI | schema and content test | absent field | fail test |
| Read-only UI | workbench | UI | control inventory and immutability | all screens | stop |
| Local-only bind | launcher | UI | host tests | runtime config | exit 40 |
| No simulator launch | import boundary | all | import and patch tests | not applicable | stop |
| XSS-safe rendering | UI projection and render | UI | payload fixtures | text fields | fail test |
| `NOT_AVAILABLE` visible | projection and UI | UI | missing TTC fixture | metrics and findings | fail test |
| Mandatory trust strip | summary view | UI | render tests | trust | fail test |
| Event timeline | timeline projection and view | UI | schema 1 and 2 fixtures | event index and tracks | explicit unsupported state |
| Artifact identity visible | summary and provenance | UI | render test | artifact identity | fail test |
| No automatic latest | selector and UI | UI | selection test | not applicable | fail test |
| Human comprehension | demo and review | final | actual scripted walkthrough | all | conditional hold |
| Authenticity design only | docs | design | document review | NOT_AUTHENTICATED | no signing code |

## P0 acceptance

Every P0 row must have:

- implementation owner;
- automated test;
- envelope field or explicit non-UI result;
- fail-closed behavior;
- residual limitation.
