# R7 update sharing — proposed model contract

Date: October 14, 2026. Status: DRAFT FOR OWNER REVIEW; no numerical implementation. Sequence: R1 → R3 → R2 → R7. All workloads, links and encounters below are proposed synthetic assumptions resolving build-spec §4.

## Question and correction to the teaching claim

Route `/network-flows/ota-sharing/`. Title: **How does the update reach every car?** Forty vehicles need the same package. Learn when encounters reduce repeated cloud work and when short contacts or disconnected groups leave cars waiting. Amend the brief's unconditional “sharing beats re-downloading” to **sharing trades cloud work for dependence on useful encounters**. Display “package complete,” not “safely updated”: delivery is not installation, authenticity, rollout permission or activation.

This is a deterministic byte-transfer model. It does not implement vehicle communications, IPFS, installation, signatures, secure boot or fleet rollout. No live connections.

## Frozen inputs v1

Vehicles ev-001..ev-040; 1,200-second observation. Each begins with zero package bytes; source has the complete package at t=0. One package contains20 ordered chunks, each1,000,000 bytes (decimal), IDs00..19. Package identity/version is fixed. All cars can reach a shared cloud link throughout the observation. Aggregate cloud capacity1,000,000 bytes/s, no individual cap beyond that. A single car can receive cloud and V2V concurrently, but cannot receive the same chunk on both paths. V2V directed transfer capacity1,000,000 bytes/s per active pair. Each car participates in at most one peer encounter at a time. These are application-goodput assumptions, not radio throughput claims.

Two frozen encounter traces, chosen explicitly before the study:

**Connected contacts:** at t=60k for k=1..19, contacts last20 seconds [60k,60k+20). For odd k, pairs (1,2),(3,4),…,(39,40). For even k, pairs (2,3),(4,5),…,(38,39),(40,1). IDs are numerical here; canonical output sorts the smaller ID first. The ring does not connect every car instantaneously.

**Short, separated contacts:** same start times, duration5 seconds; two rings {1..20} and {21..40}. Odd k pairs adjacent starting at1/21; even k pairs adjacent starting at2/22 and closes (20,1)/(40,21). No bridge between rings. This fixture can expose incomplete delivery with poorly placed seeds. It is not a statistical sample of connectivity.

Manual cloud seeds are an exact chosen subset of the40 IDs, size0..40. Default4 evenly spaced seeds: ev-001,ev-011,ev-021,ev-031. Optional cloud rescue time is disabled or t=600. Trace, seeds and rescue setting form normalized input shared by policy pairs where applicable. Viewer may choose any seeds; no hidden automatic seed placement.

## Transfer and scheduling semantics

Simulation quantum1 second; all rates/chunk sizes/contact boundaries are integers. Preserve partial chunk bytes between contacts. Only complete chunks may be forwarded. Store-and-forward: a chunk completed at t becomes available for scheduling over [t,t+1); never forwarded in the interval that produced it. At each integer boundary: finish previous transfers and mark completed chunks/packages; close contacts; open contacts; activate rescue if configured; schedule cloud; schedule peers; snapshot. Horizon completions at1200 count; no new transfer begins there.

**Cloud scheduler:** one shared server transfers at most1MB per second to one vehicle's next missing chunk. A partial chunk resumes first, otherwise lowest missing chunk ID. Eligible vehicles are sorted by ID and round-robin at one chunk completion, resuming the cursor after the served ID. Partial chunks may require fractional completion within a tick in general tests, but this contract's rates and sizes consume exactly one tick; reject nonconforming rate/chunk inputs in v1 rather than invent subsecond behavior. If a missing chunk is already reserved by an active peer direction for that tick, select the next missing chunk. Scheduler sees current complete/partial inventory only, never future contacts. Do not reserve beyond one tick.

**Peer scheduler:** process disjoint active pairs in sorted ID order. Cloud assignments for that tick are already reserved. Each pair has one half-duplex direction per tick. Enumerate `(sender,receiver,chunk)` where sender has a complete chunk, receiver lacks it, and receiver's cloud assignment is not that chunk. Prefer receiver's most-progressed partial chunk, then lowest chunk ID, then lowest receiver ID, then sender ID. Transfer up to1MB, capped by remaining chunk bytes. If no useful candidate, idle. No duplicate-byte transfer counts as new progress. Senders keep their copies. Direction may change at the next tick. No inference from concept-film timing.

## Policies and controlled comparisons

**Cloud only:** every unfinished vehicle is cloud-eligible; peer transfers off. Seeds/rescue fields are normalized but inactive, and disclosed as such.

**Seed then share:** only selected seeds are cloud-eligible initially; useful peer transfers operate during contacts. Once the optional rescue time arrives, every unfinished car becomes cloud-eligible. The cloud stays idle if no eligible missing chunk exists. No assumed completion and no auto-rescue after the horizon.

Default view compares cloud-only with4-seed sharing on connected contacts, rescue disabled. Explicit controls select another trace/seed set/rescue setting and reconstruct a fresh matched study. Pending changes do not alter accepted outcomes. A failed candidate leaves the prior complete study displayed with its input label. Show actual outcomes, even if the sharing arm is slower or incomplete. A separate disclosure compares0seeds without rescue (no dissemination) and40seeds (cloud eligibility matches the baseline, peers may still change completion timing). These are domain-edge teaching examples, not recommended deployment policies.

## Metrics, evidence and conservation

- Package-complete cars /40 over time; useful unique bytes held /800,000,000 demanded bytes is a separate chart. Never confuse partial bytes with updated vehicles.
- Per-car completion time or unavailable/censored at horizon; fleet100% completion time unavailable unless all40 finish.
- Cloud bytes sent, peer bytes sent, unique receiver bytes acquired, wasted/duplicate bytes (must be0 under v1 scheduler), active and unused capacity.
- Cloud-work reduction = (baseline cloud bytes − candidate cloud bytes)/baseline cloud bytes; accompany it with completion fraction and time. It is not a latency benefit by itself.
- Contact utilization = peer bytes / sum(contact seconds × directional pair capacity). The half-duplex denominator counts each pair once. Cloud utilization = cloud bytes / (1MB/s ×1,200s).
- Preserve incomplete cars, complete chunk inventories, partial byte counts, pair ownership and current cursor. Receiver conservation: final unique bytes = initial bytes + useful receipts, never above20MB per car. Sender copies persist; aggregate replicas need not conserve a single copy's size.

Records bind full normalized input, trace formula/version AND expanded encounter list, policy, scheduling version, quantum, every transfer, completion event and stop time. Producer-independent verifier reconstructs scheduler choices, inventory availability, mandatory useful-transfer opportunities, capacities and complete event coverage. Counterexamples include forwarded incomplete chunk, same-tick forwarding, missing contact closure, double peer participation, overcapacity, rehashed foreign contact trace, false fleet completion, wrong cloud cursor and absent incompletes. Pair completeness does not excuse common-input mismatch.

## Visitor experience and tests

Code-built40-cell fleet grid (every cell a real modeled ID), shared cloud link, only currently active contact edges, byte-progress and package-complete charts. Clean transitions interpolate layout only; exact accepted tick controls the numbers. NF-08 beside the sharing chart has the standard muted, looping, playsinline player, explicit Play/Pause, poster, visibility pause and reduced-motion handling. Caption: `Concept illustration · not simulation output`. Six chapters: repeated work → seed → encounter budget → ripple → isolated cars → try a mix. Technical “gossip/epidemic” vocabulary stays in documentation, not lesson copy.

Analytical tests before full40-car outcomes: two cars, one complete20MB seed, one20s contact at1MB/s fills the receiver exactly;5s contact supplies5MB and does not complete it; zero seeds/cloud disabled never starts; simultaneous cloud/peer reservation cannot duplicate the same chunk; last byte at horizon counts. Test empty/all seeds, short contacts, partition, rescue boundary, pause/resume and stale result rejection. Bound input40cars,20chunks,380pair contacts and1,200ticks; reject extra fields or larger domain. Bounds include the expanded trace and inventories before hashing/parsing.

## Research and trust boundary

[Sghaier et al., author-hosted manuscript, April20,2026](https://www.lre.epita.fr/dload/papers/sghaier.26.vtc.pdf), checked October14, describes a dual V2N/V2V architecture with differential packages, IPFS and orchestration. It reports results from its own experimental setup. R7 omits these system components; do not import its reported latency reduction as a target or imply conference acceptance from the filename. Venue remains unconfirmed. This contract models only dissemination; it is not a software-release system.

Fences: `Synthetic scenario · not operational data`; concept caption above. Package digest consistency is not independent authenticity. Download permission, verification, installation authorization and activation are separate states; all operational authorities are NOT_EVALUATED/NONE. Background downloading does not itself make a vehicle VOR. This lesson has no driving/dispatch tape, so COD/VOR/readiness are unavailable rather than fabricated from transfer progress. A short vocabulary panel explains that limitation.

Establish hosted-only ownership, source capture and media hashes before payload. Measure real bytes against existing limits; future budget changes require separate review. Do not modify software-delivery's accepted study to manufacture a chain of results.

## Recommendation

Approve the conditional takeaway, package-complete language and short-contact counterexample. These corrections prevent the new lesson from teaching that peer delivery automatically makes a fleet ready.

## Top risks + mitigations

- A pleasing ripple hides undelivered cars:40 counted cells, censored completion and partial inventory.
- Sharing wins through extra unreported resources: display cloud and peer capacities and byte work separately.
- “Updated” implies activation or trust: delivery-only metrics and explicit absent installation/authenticity evidence.

## Next 3 actions

1. Review encounter trace, seed controls, scheduling priorities and vocabulary correction.
2. Build bounded model and independent verifier; inspect results before freezing story copy.
3. Build responsive counted visuals, run release validation and publish after contract approval.
