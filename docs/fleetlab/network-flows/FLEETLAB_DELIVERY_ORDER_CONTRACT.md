# Delivery order contract — October 13, 2026

Scope: synthetic teaching only; not authenticated, not evidence of real-world safety, no operational or deployment authority. This companion does not alter NF04 numerical semantics.

## Domain and objective

`fleetlab.delivery-order-input/1.0.0` wraps a normalized NF04 input with domain `cold-serial-known-at-copy/1.0.0`. One empty-cache depot, one 12,000,000,000-byte artifact available at zero, 1–4 unique vehicles, at least one request at zero, all applied arrivals by 96,000 ms. WAN aggregate/cap 125,000,000 B/s; local aggregate/cap 250,000,000 B/s. Each vehicle checks for 60,000 ms, passes, then activates for 30,000 ms. P=0, H=2,400,000 ms, q=1,000 or 250 ms. Unsupported fields, rates, inventory, failures, horizons, availability and arrivals are rejected.

Policy `serial-local/1.0.0`: one uninterrupted full-rate local receipt at a time, no idle gaps; downstream tasks overlap other vehicles' receipts. Fetch ends at 96,000 ms. Position k (1-based) receives during [96,000+48,000(k−1),96,000+48,000k), then checks and activates; ready at 186,000+48,000k. Raw deadlines are inclusive. Minimize `(missed_count, late_ms_total)` lexicographically, retaining every tie. Maximum individual lateness is reported, not optimized secretly.

## Records, checking and identity

A record contains schema/policy version, normalized input and digest, order, fetch, ID-sorted vehicle intervals, integer metrics and record digest. The independent verifier uses fixed-position equations, exact fields and denominator checks, not producer scheduling functions. Invalid verification exposes null metrics/digests.

A study contains schema/domain/policy/quantum, one normalized input and digest, every record, all best orders, an ASCII-smallest representative and study digest. Every candidate must match the study's complete normalized input, digest, domain, policy and quantum before coverage is considered. Completeness uses unique consecutive Lehmer ranks 0…n!−1, independently of producer recursion. Record arrays and best-order arrays are canonical ASCII permutation order. A complete permutation set with a valid foreign-workload record is invalid.

Canonicalization uses sorted object keys, preserved array order, plain own enumerable data, safe integers and existing NF04 canonical/digest utilities. Unknown fields, accessors, inherited values, sparse arrays, cycles and oversized data are rejected. Input ≤64 KiB, individual record ≤16 KiB, study ≤256 KiB. A record digest excludes only its own `record_digest`; study digest excludes only its own `study_digest` and includes the candidate record digests. Digests establish internal consistency, not independent authenticity.

## Published examples

| Case; V1/V2/V3/V4 targets in seconds | FCFS on time / late seconds | Best order | Best on time / late seconds |
|---|---|---|---|
| Different: 480/340/290/240 | 2/4 / 178 | V4,V3,V2,V1 | 4/4 / 0 |
| Impossible: 220/340/290/240 | 1/4 / 192 | V4,V3,V2,V1 | 3/4 / 158 |
| Close: 235/280/328/480 | 2/4 / 4 | V1,V3,V2,V4 | 3/4 / 50 |
| Equal: 480/480/480/480 | 4/4 / 0 | All 24 tie | 4/4 / 0 |

All public arrivals are 0/30/60/90 seconds. Primary/refinement inputs and resulting identities differ; the same objective and readiness results reproduce at both quanta. Equal-share references are rebuilt with unchanged NF04 producer/checker against these inputs, not relabeled old records. They are outside the serial policy class.

## UI acceptance and playback

Entry performs no computation. Compare reconstructs and checks the complete study when its input/version is not accepted; otherwise it selects an already checked record. Reordering changes pending order only. Accepted metrics never follow pending labels. Show best preserves the saved user order and does not play. Initial two arms match with zero delta. An explicit worked-example guide is bound to the default FCFS-versus-best identity; arbitrary orders use computed static explanations. Phone arm switching changes only the view.

Cancelled, timed-out, incomplete, mismatched or stale jobs cannot replace accepted results. Navigation pauses and terminates active work; returning never starts it automatically. Restricted motion/data uses the same six held snapshots and tables. All figures describe model readiness, not installation permission or safe-to-drive authority.
