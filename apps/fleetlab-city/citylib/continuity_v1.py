"""Standalone bounded stop-continuity router and executed-prefix verifier.

Consumes compiled static graph profiles only. No engine integration, conditional
routing, implicit waiting, implicit reversal, or depot connector is implemented.
The verifier scans concatenated executed edges, never the router's search state.
"""

import heapq
import itertools
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from types import MappingProxyType

from .conditional_access_v1 import local_instant
from .contracts import digest, finite
from .pack import distance
from .restrictions import KINDS, validate_profile

PROFILE = "fleetlab.stop-continuity/1.0.0"
INITIAL_PLACEMENT = "DECLARED_INITIAL_NODE_PLACEMENT"
MAX_PREFIX = 257
MAX_CHECKS = 2_000_000


class _Budget:
    def __init__(self, limit):
        if type(limit) is not int or not 1 <= limit <= MAX_CHECKS:
            raise ValueError("unsupported work budget")
        self.remaining = limit

    def spend(self, amount=1):
        self.remaining -= amount
        if self.remaining < 0:
            raise ValueError("restriction work budget exceeded")


@dataclass(frozen=True)
class ArrivalState:
    node: str
    pack_digest: str
    profile: str
    incoming_edge: str | None = None
    restriction_prefix: tuple[str, ...] = ()
    initial_placement: str | None = None
    connector: object = None


@dataclass(frozen=True)
class RoutingContext:
    pack_digest: str
    profile: str
    scenario_digest: str
    departure: datetime
    vehicle_class: str = "passenger_car"
    timezone_name: str = "America/Los_Angeles"


@dataclass(frozen=True)
class RouteResult:
    status: str
    edges: tuple[str, ...] = ()
    seconds: float | None = None
    arrival: ArrivalState | None = None
    reason: str | None = None
    rejected_choices: tuple[tuple[str, str], ...] = ()


@dataclass(frozen=True)
class VerificationResult:
    status: str
    issues: tuple[str, ...]
    executed_edge_count: int


@dataclass(frozen=True)
class _Rule:
    id: str
    kind: str
    from_way: str
    to_way: str
    via: str | None
    sequences: tuple[tuple[str, ...], ...]


def _is_digest(value):
    return (
        isinstance(value, str) and len(value) == 64 and all(c in "0123456789abcdef" for c in value)
    )


def _snapshot(pack):
    """Structural validation shared by consumers; no route decisions here."""
    validate_profile(pack)
    if any("conditional" in str(k) for k in pack):
        raise ValueError("conditional routing is not integrated")
    if len(pack["nodes"]) > 300000 or len(pack["edges"]) > 500000 or len(pack["turns"]) > 10000:
        raise ValueError("graph exceeds standalone bounds")
    nodes = {}
    for node, coordinate in pack["nodes"].items():
        if not isinstance(node, str) or len(coordinate) != 2:
            raise ValueError("invalid node")
        nodes[node] = (finite(coordinate[0], -180, 180), finite(coordinate[1], -90, 90))
    edges = {}
    for e in pack["edges"]:
        if (
            not isinstance(e["id"], str)
            or e["id"] in edges
            or e["u"] not in nodes
            or e["v"] not in nodes
            or e["u"] == e["v"]
            or not isinstance(e["way"], str)
        ):
            raise ValueError("invalid or duplicate directed edge")
        if any("conditional" in str(k) for k in e):
            raise ValueError("conditional routing is not integrated")
        finite(e["seconds"], 0.000001, 86400)
        edges[e["id"]] = MappingProxyType({k: e[k] for k in ("id", "u", "v", "way", "seconds")})
    rules = []
    seen = set()
    for r in pack["turns"]:
        if (
            not isinstance(r["id"], str)
            or not all(isinstance(r.get(k), str) and r[k] for k in ("id", "from", "to"))
            or r["id"] in seen
            or r.get("kind") not in KINDS
            or r.get("conditional")
            or r.get("malformed")
            or any("conditional" in str(k) and k != "conditional" for k in r)
        ):
            raise ValueError("unsupported or duplicate restriction")
        seen.add(r["id"])
        seqs = tuple(tuple(s) for s in r.get("edge_sequences", []))
        if seqs:
            for seq in seqs:
                missing = any(e not in edges for e in seq)
                # A prohibition requiring an absent edge cannot be traversed in
                # this graph. Retain its source sequence; never restore that edge.
                # An only-rule can constrain a reachable prefix even when its
                # required continuation is absent, so it still fails closed here.
                if missing and r["kind"].startswith("only_"):
                    raise ValueError("required compiled restriction edge is absent")
                if any(
                    a in edges and b in edges and edges[a]["v"] != edges[b]["u"]
                    for a, b in zip(seq, seq[1:], strict=False)
                ):
                    raise ValueError("compiled restriction is disconnected")
        elif r.get("via") not in nodes or r.get("via_way") or not r.get("from") or not r.get("to"):
            raise ValueError("invalid node restriction")
        rules.append(_Rule(r["id"], r["kind"], r["from"], r["to"], r.get("via"), seqs))
    if sum(len(s) * (len(s) - 1) // 2 for r in rules for s in r.sequences) > 1_000_000:
        raise ValueError("restriction inventory exceeds bounds")
    return MappingProxyType(nodes), MappingProxyType(edges), tuple(rules)


def _check_context(context, pack_digest, scenario_digest=None):
    if (
        not isinstance(context, RoutingContext)
        or context.pack_digest != pack_digest
        or context.profile != PROFILE
        or not _is_digest(context.scenario_digest)
        or scenario_digest is not None
        and context.scenario_digest != scenario_digest
    ):
        raise ValueError("routing context identity mismatch")
    local_instant(
        context.departure, vehicle_class=context.vehicle_class, timezone_name=context.timezone_name
    )


class ContinuityRouter:
    """On-demand finite-product search over immutable graph data and history.

    Cache size and discovered states are bounded. No prepared all-pairs tables
    are allocated. Arrival history is producer state, independently checked only
    when a complete executed trace is supplied to verify_executed_prefix.
    """

    def __init__(
        self,
        pack,
        *,
        scenario_digest,
        max_states=100000,
        max_cache_entries=4096,
        max_checks=MAX_CHECKS,
        max_cache_edges=100000,
    ):
        if not _is_digest(scenario_digest):
            raise ValueError("scenario identity must be a SHA-256 digest")
        if (
            type(max_states) is not int
            or not 1 <= max_states <= 300000
            or type(max_cache_entries) is not int
            or not 0 <= max_cache_entries <= 4096
            or type(max_cache_edges) is not int
            or not 0 <= max_cache_edges <= 200000
        ):
            raise ValueError("unsupported search or cache budget")
        _Budget(max_checks)
        self.max_checks = max_checks
        self._nodes, self._edges, self._rules = _snapshot(pack)
        self.inactive_no_sequences = tuple(
            (rule.id, seq)
            for rule in self._rules
            for seq in rule.sequences
            if rule.kind.startswith("no_") and any(e not in self._edges for e in seq)
        )
        self.pack_digest = digest(pack)
        self.scenario_digest = scenario_digest
        self.max_states = max_states
        self.max_cache_entries = max_cache_entries
        self._max_cache_edges = max_cache_edges
        self._cached_edges = 0
        out = defaultdict(list)
        for eid, edge in self._edges.items():
            out[edge["u"]].append(eid)
        self._out = MappingProxyType({n: tuple(sorted(ids)) for n, ids in out.items()})
        self._prefixes = frozenset(
            s[:k] for r in self._rules for s in r.sequences for k in range(1, len(s))
        )
        self._max_prefix = max(map(len, self._prefixes), default=0)
        self._max_speed = max(
            (
                distance(self._nodes[e["u"]], self._nodes[e["v"]]) / e["seconds"]
                for e in self._edges.values()
            ),
            default=0.0,
        )
        self._cache = {}

    def context(self, departure):
        local_instant(departure, vehicle_class="passenger_car", timezone_name="America/Los_Angeles")
        return RoutingContext(
            self.pack_digest, PROFILE, self.scenario_digest, departure.astimezone(UTC)
        )

    def initial(self, node):
        if node not in self._nodes:
            raise ValueError("unknown initial placement node")
        return ArrivalState(node, self.pack_digest, PROFILE, initial_placement=INITIAL_PLACEMENT)

    def _validate_arrival(self, start, arrival):
        if (
            not isinstance(arrival, ArrivalState)
            or arrival.pack_digest != self.pack_digest
            or arrival.profile != PROFILE
            or arrival.node != start
            or arrival.connector is not None
        ):
            raise ValueError("arrival identity mismatch or unsupported connector")
        prefix = arrival.restriction_prefix
        if (
            not isinstance(prefix, tuple)
            or len(prefix) > self._max_prefix
            or any(not isinstance(e, str) for e in prefix)
        ):
            raise ValueError("arrival history exceeds supported bounds")
        if arrival.incoming_edge is None:
            if prefix or arrival.initial_placement != INITIAL_PLACEMENT:
                raise ValueError("null incoming state needs initial placement assumption")
        elif (
            arrival.incoming_edge not in self._edges
            or self._edges[arrival.incoming_edge]["v"] != start
            or arrival.initial_placement is not None
        ):
            raise ValueError("incoming edge does not end at start")
        if prefix and (prefix not in self._prefixes or prefix[-1] != arrival.incoming_edge):
            raise ValueError("arrival prefix differs from incoming edge or profile")
        if not prefix and (arrival.incoming_edge,) in self._prefixes:
            raise ValueError("known restriction start is absent from arrival history")
        # Missing history cannot be proved absent here; the independent verifier
        # reconstructs it across the complete per-vehicle trace.

    def _advance(self, incoming, prefix, eid, budget):
        budget.spend(1 + len(self._rules) + self._max_prefix)
        budget.spend(sum(len(s) for r in self._rules for s in r.sequences))
        edge = self._edges[eid]
        if incoming:
            before = self._edges[incoming]
            if edge["v"] == before["u"]:
                return None, "immediate reversal"
            for rule in self._rules:
                if (
                    not rule.sequences
                    and rule.via == edge["u"]
                    and rule.from_way == before["way"]
                    and (
                        (rule.kind.startswith("no_") and edge["way"] == rule.to_way)
                        or (rule.kind.startswith("only_") and edge["way"] != rule.to_way)
                    )
                ):
                    return None, f"node restriction {rule.id}"
        candidate = prefix + (eid,)
        for rule in self._rules:
            if rule.kind.startswith("no_"):
                if any(
                    len(candidate) >= len(s) and candidate[-len(s) :] == s for s in rule.sequences
                ):
                    return None, f"sequence restriction {rule.id}"
            else:
                active = [
                    (s, k)
                    for s in rule.sequences
                    for k in range(1, len(s))
                    if len(prefix) >= k and prefix[-k:] == s[:k]
                ]
                if active and not any(s[k] == eid for s, k in active):
                    return None, f"only sequence restriction {rule.id}"
        suffix = next(
            (
                candidate[-k:]
                for k in range(min(len(candidate), self._max_prefix), 0, -1)
                if candidate[-k:] in self._prefixes
            ),
            (),
        )
        return (eid, suffix), None

    def route(self, start, destination, arrival, context, *, algorithm="astar"):
        """Return ROUTE, NO_MODELED_CONTINUATION, or UNSUPPORTED_CONTEXT."""
        try:
            _check_context(context, self.pack_digest, self.scenario_digest)
            if start not in self._nodes or destination not in self._nodes:
                raise ValueError("unknown route node")
            if algorithm not in {"astar", "dijkstra"}:
                raise ValueError("unsupported search algorithm")
            self._validate_arrival(start, arrival)
        except (ValueError, TypeError, AttributeError) as exc:
            return RouteResult("UNSUPPORTED_CONTEXT", reason=str(exc))
        if start == destination:
            return RouteResult("ROUTE", seconds=0.0, arrival=arrival)
        key = (start, destination, arrival, context, algorithm)
        if key in self._cache:
            return self._cache[key]
        initial = (arrival.incoming_edge, arrival.restriction_prefix)
        best, previous = {initial: 0.0}, {}
        serial = itertools.count()
        heap = [(0.0, 0.0, next(serial), initial)]
        rejected = set()
        budget = _Budget(self.max_checks)
        while heap:
            _, cost, _, state = heapq.heappop(heap)
            if cost != best[state]:
                continue
            node = self._edges[state[0]]["v"] if state[0] else start
            if node == destination:
                path, cursor = [], state
                while cursor != initial:
                    old, eid = previous[cursor]
                    path.append(eid)
                    cursor = old
                result = RouteResult(
                    "ROUTE",
                    tuple(reversed(path)),
                    cost,
                    ArrivalState(destination, self.pack_digest, PROFILE, state[0], state[1]),
                )
                break
            for eid in self._out.get(node, ()):
                try:
                    nxt, why = self._advance(*state, eid, budget)
                except ValueError as exc:
                    return RouteResult("UNSUPPORTED_CONTEXT", reason=str(exc))
                if nxt is None:
                    if len(rejected) < 100:
                        rejected.add((eid, why))
                    continue
                score = cost + self._edges[eid]["seconds"]
                if score >= best.get(nxt, float("inf")):
                    continue
                if nxt not in best and len(best) >= self.max_states:
                    return RouteResult("UNSUPPORTED_CONTEXT", reason="search state budget exceeded")
                best[nxt], previous[nxt] = score, (state, eid)
                heuristic = 0.0
                if algorithm == "astar" and self._max_speed:
                    heuristic = (
                        distance(self._nodes[self._edges[eid]["v"]], self._nodes[destination])
                        / self._max_speed
                    )
                heapq.heappush(heap, (score + heuristic, score, next(serial), nxt))
        else:
            result = RouteResult(
                "NO_MODELED_CONTINUATION",
                reason="no route under retained history",
                rejected_choices=tuple(sorted(rejected)),
            )
        if (
            len(self._cache) < self.max_cache_entries
            and self._cached_edges + len(result.edges) <= self._max_cache_edges
        ):
            self._cache[key] = result
            self._cached_edges += len(result.edges)
        return result


def verify_executed_prefix(
    pack, context, events, *, max_events=100000, max_edges=1000000, max_checks=MAX_CHECKS
):
    """Independent full-history scan; planned suffixes are never driven evidence.

    Events are per-vehicle initial, leg and stop records. Every leg/stop carries
    before/after incoming edge and prefix. Incomplete legs are terminal for that
    vehicle. Connector records are always unsupported in this first contract.
    """
    issues = []
    count = 0
    try:
        budget = _Budget(max_checks)
        nodes, edges, rules = _snapshot(pack)
        _check_context(context, digest(pack))
        if (
            type(max_events) is not int
            or not 1 <= max_events <= 100000
            or type(max_edges) is not int
            or not 1 <= max_edges <= 1000000
            or not isinstance(events, (list, tuple))
            or not events
            or len(events) > max_events
        ):
            raise ValueError("trace resource budget exceeded")
        vehicles = {}
        prefixes = {s[:k] for r in rules for s in r.sequences for k in range(1, len(s))}
        maximum = max(map(len, prefixes), default=0)

        def expected(history):
            # Direct suffix comparison on actual traversals, not router state.
            budget.spend(1 + len(prefixes))
            candidates = [
                p for p in prefixes if len(history) >= len(p) and tuple(history[-len(p) :]) == p
            ]
            return max(candidates, key=len, default=())

        def check_state(event, when, history):
            incoming = history[-1] if history else None
            if f"incoming_{when}" not in event or event[f"incoming_{when}"] != incoming:
                raise ValueError("recorded incoming state reset or mismatch")
            raw = event.get(f"prefix_{when}")
            if not isinstance(raw, list) or len(raw) > maximum or tuple(raw) != expected(history):
                raise ValueError("recorded restriction prefix reset or mismatch")

        for event in events:
            budget.spend()
            if not isinstance(event, dict) or not isinstance(event.get("vehicle"), str):
                raise ValueError("malformed trace event")
            vehicle, kind = event["vehicle"], event.get("kind")
            if kind == "initial":
                if (
                    vehicle in vehicles
                    or event.get("node") not in nodes
                    or event.get("initial_placement") != INITIAL_PLACEMENT
                ):
                    raise ValueError("repeated or unsupported initial placement")
                vehicles[vehicle] = {"node": event["node"], "history": [], "terminal": False}
                continue
            if vehicle not in vehicles or vehicles[vehicle]["terminal"]:
                raise ValueError("missing initialization or traversal after incomplete horizon leg")
            v = vehicles[vehicle]
            if kind not in {"leg", "stop"}:
                raise ValueError("unsupported event or connector transition")
            history = v["history"]
            check_state(event, "before", history)
            if kind == "stop":
                if event.get("node") != v["node"]:
                    raise ValueError("stop moved vehicle")
                check_state(event, "after", history)
                continue
            executed, planned = event.get("executed_edges"), event.get("planned_edges")
            if (
                not isinstance(executed, list)
                or not isinstance(planned, list)
                or len(planned) > max_edges
                or len(executed) + count > max_edges
                or type(event.get("completed")) is not bool
                or any(not isinstance(e, str) for e in executed)
                or executed != planned[: len(executed)]
                or event["completed"]
                and executed != planned
            ):
                raise ValueError("malformed executed prefix or trace edge budget exceeded")
            if event.get("start") != v["node"]:
                raise ValueError("leg starts away from actual arrival")
            for eid in executed:
                edge = edges.get(eid)
                if edge is None or edge["u"] != v["node"]:
                    raise ValueError("unknown or disconnected executed edge")
                budget.spend(1 + len(rules))
                if history:
                    before = edges[history[-1]]
                    if edge["v"] == before["u"]:
                        issues.append("undeclared immediate reversal")
                    for rule in rules:
                        if (
                            not rule.sequences
                            and rule.via == edge["u"]
                            and rule.from_way == before["way"]
                            and (
                                (rule.kind.startswith("no_") and edge["way"] == rule.to_way)
                                or (rule.kind.startswith("only_") and edge["way"] != rule.to_way)
                            )
                        ):
                            issues.append(f"node restriction {rule.id}")
                history.append(eid)
                count += 1
                v["node"] = edge["v"]
                # Scan source sequence prefixes against complete actual history.
                # This does not call _advance, SequenceMachine, or validate_path.
                for rule in rules:
                    for index in range(max(0, len(history) - MAX_PREFIX - 1), len(history)):
                        budget.spend(1 + len(rule.sequences))
                        alternatives = [s for s in rule.sequences if s[0] == history[index]]
                        if not alternatives:
                            continue
                        tail = tuple(history[index:])
                        if rule.kind.startswith("no_"):
                            if any(
                                len(tail) >= len(s) and tail[: len(s)] == s for s in alternatives
                            ):
                                issues.append(f"forbidden sequence {rule.id}")
                        elif not any(tail[: len(s)] == s[: len(tail)] for s in alternatives):
                            issues.append(f"only sequence departed {rule.id}")
            if event.get("end") != v["node"]:
                raise ValueError("leg end differs from actual executed prefix")
            check_state(event, "after", history)
            v["terminal"] = not event["completed"]
    except (ValueError, KeyError, TypeError, AttributeError) as exc:
        issues.append(str(exc))
    return VerificationResult(
        "INVALID_EVIDENCE" if issues else "INTERNALLY_CONSISTENT",
        tuple(dict.fromkeys(issues)),
        count,
    )
