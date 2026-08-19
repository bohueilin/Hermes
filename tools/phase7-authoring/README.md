# Phase 7A authoring and discovery drivers — as executed, unreviewed

**Status: historical record, not supported tooling. Do not run these.**

These fourteen scripts produced the Phase 7A evidence of record: the five protocol
versions, the five discovery ledgers, the pair plans, and the primary pairs. They are
committed here verbatim because Fable's round-1 review (F-02) found that **the process
which produced the evidence was not in the repository at all**, and evidence whose
producer cannot be inspected is a weaker claim than it appears.

## What you must know before trusting anything they produced

**They were repository-external when they ran.** They lived in a session scratchpad
(`/private/tmp/.../scratchpad/authoring/`) that would have been lost. The ledgers'
`command_argv` fields still point there.

**They were never reviewed and are not tested.** No test in this repository exercises
them. They are not importable as a package and have absolute paths baked in.

**The ledger was not appended per attempt.** `DISCOVERY_RESULTS.md` and the handoffs
describe an append-only ledger. In fact each runner accumulated entries in memory and
wrote the file once, after every attempt completed (`run_discovery_v5.py`, the final
`write_bytes`). The *content* is a faithful record of every attempt in order — verified
by recomputation against the stored artifacts — but the append-only property was a
property of the intent, not of the code.

**The amendment's CLI was never built.** `PHASE7_TASK7_AND_TASK8_CONTRACT_AMENDMENT.md`
§5.7 specifies a `hermes materialize-evaluation-plan` command and §9.3 lists `cli.py`
among the files to modify. Neither happened. `git diff 0caed90..cb6d669` shows `cli.py`
untouched.

**The preflight had no production caller.** `require_frozen_simulator_identity` is
invoked by `run_discovery_v*.py` here, and by tests — but by nothing under `src/`.

## Consequence

**The tracked tree cannot currently regenerate the Phase 7A ledgers.** Reproducing the
evidence of record means running these scripts, with their absolute paths corrected.

Building a tracked, tested `hermes materialize-evaluation-plan` and a discovery driver
that genuinely appends per attempt is scheduled Phase 8 work. It was deliberately not
done in the same change that disclosed this, because that would have produced a second
untested path to evidence generation while the first is still the one that made the
record.

## What is verified despite the above

Every one of the 83 ledger entries recomputes against its stored artifacts — bundle
digest, trace digest, and the selection observation recomputed with the assessor's own
scanner. That check now runs on every assessment
(`hermes.adequacy.api._verify_discovery_ledger`). The record is honest; what these
scripts lacked was reviewability, not accuracy.
