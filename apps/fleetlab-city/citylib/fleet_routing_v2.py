"""Stateful routing boundary for the versioned operational runner.

Static compiled restrictions only. Fractional positions are terminal observations,
not new graph nodes or permission to reinitialize a vehicle.
"""

import copy
import math
from collections import defaultdict
from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from types import MappingProxyType

from .continuity_v1 import ArrivalState, ContinuityRouter, _Budget
from .contracts import digest, finite

MODEL = "fleetlab.graph-resource-continuity/2.0.0"
SCHEMA = "fleetlab.city-continuity-run/2.0.0"


def start_instant(value):
    if not isinstance(value, str):
        raise ValueError("start_utc must name an aware instant")
    try:
        instant = datetime.fromisoformat(value)
    except ValueError as exc:
        raise ValueError("invalid start_utc") from exc
    if instant.tzinfo is None or instant.utcoffset() is None:
        raise ValueError("start_utc must name an aware instant")
    if instant.utcoffset().total_seconds() != 0:
        raise ValueError("start_utc must use UTC")
    return instant.astimezone(UTC)


def state_dict(state):
    value = asdict(state)
    value["restriction_prefix"] = list(state.restriction_prefix)
    return value


def state_object(value):
    if not isinstance(value, dict) or not isinstance(value.get("restriction_prefix"), list):
        raise ValueError("malformed arrival state")
    return ArrivalState(**{**value, "restriction_prefix": tuple(value["restriction_prefix"])})


def traversed_position(route, edge_map, elapsed):
    """Producer motion projection; verifier reconstructs this independently."""
    finite(elapsed, 0, 86400 * 7)
    completed, partial = [], None
    remaining = elapsed
    for eid in route["edges"]:
        duration = edge_map[eid]["seconds"]
        if remaining >= duration - 1e-10:
            completed.append(eid)
            remaining = max(0.0, remaining - duration)
        elif remaining > 1e-10:
            partial = {"id": eid, "elapsed_s": remaining, "fraction": remaining / duration}
            break
        else:
            break
    return {"completed_edges": completed, "partial_edge": partial}


class FleetRouter(ContinuityRouter):
    def __init__(self, pack, spec):
        self.start = start_instant(spec.get("start_utc"))
        self.spec_digest = digest(spec)
        super().__init__(pack, scenario_digest=self.spec_digest, max_states=250000)
        self.nodes = self._nodes
        self.edges = MappingProxyType(
            {
                edge["id"]: MappingProxyType(
                    {
                        **dict(self._edges[edge["id"]]),
                        "length_m": finite(edge["length_m"], 0.000001, 1000000),
                    }
                )
                for edge in pack["edges"]
            }
        )
        node_rules, no_endings, only_endings = (
            defaultdict(list),
            defaultdict(list),
            defaultdict(list),
        )
        for rule in self._rules:
            if not rule.sequences:
                node_rules[(rule.via, rule.from_way)].append(rule)
            for sequence in rule.sequences:
                if rule.kind.startswith("no_"):
                    no_endings[sequence[-1]].append((rule.id, sequence))
                else:
                    for k in range(1, len(sequence)):
                        only_endings[sequence[k - 1]].append((rule.id, sequence[:k], sequence[k]))
        self._node_rules = MappingProxyType({k: tuple(v) for k, v in node_rules.items()})
        self._no_endings = MappingProxyType({k: tuple(v) for k, v in no_endings.items()})
        self._only_endings = MappingProxyType({k: tuple(v) for k, v in only_endings.items()})
        self.max_speed = self._max_speed
        if not math.isfinite(self.max_speed) or self.max_speed <= 0:
            raise ValueError("positive graph speed required")
        # Prove a narrow structural impossibility, independently of any clock or
        # restriction prefix. If every outgoing edge returns to the sole possible
        # incoming neighbor, every nonempty arrival would require an immediate
        # reversal. Nodes with no outgoing edge are also terminal. Initial
        # placement and zero-length trips are deliberately outside this proof.
        single_exit = {}
        for node, eids in self._out.items():
            neighbor = self.edges[eids[0]]["v"]
            if all(self.edges[eid]["v"] == neighbor for eid in eids):
                single_exit[node] = neighbor
        for edge in self.edges.values():
            if edge["v"] in single_exit and edge["u"] != single_exit[edge["v"]]:
                del single_exit[edge["v"]]
        self._terminal_arrivals = frozenset(single_exit)

    def is_terminal_arrival(self, node):
        return node in self.nodes and (node not in self._out or node in self._terminal_arrivals)

    def _advance(self, incoming, prefix, eid, budget):
        """Same static rule decisions as the reference scan, with bounded indexes."""
        budget.spend()
        edge = self._edges[eid]
        if incoming:
            before = self._edges[incoming]
            if edge["v"] == before["u"]:
                return None, "immediate reversal"
            for rule in self._node_rules.get((edge["u"], before["way"]), ()):
                budget.spend()
                if (rule.kind.startswith("no_") and edge["way"] == rule.to_way) or (
                    rule.kind.startswith("only_") and edge["way"] != rule.to_way
                ):
                    return None, f"node restriction {rule.id}"
        candidate = prefix + (eid,)
        for rid, sequence in self._no_endings.get(eid, ()):
            budget.spend(len(sequence))
            if len(candidate) >= len(sequence) and candidate[-len(sequence) :] == sequence:
                return None, f"sequence restriction {rid}"
        active = defaultdict(set)
        for rid, required_prefix, following in self._only_endings.get(incoming, ()):
            budget.spend(len(required_prefix))
            if (
                len(prefix) >= len(required_prefix)
                and prefix[-len(required_prefix) :] == required_prefix
            ):
                active[rid].add(following)
        for rid, allowed in active.items():
            if eid not in allowed:
                return None, f"only sequence restriction {rid}"
        suffix = ()
        for k in range(min(len(candidate), self._max_prefix), 0, -1):
            budget.spend(k)
            if candidate[-k:] in self._prefixes:
                suffix = candidate[-k:]
                break
        return (eid, suffix), None

    def instant(self, elapsed):
        return self.start + timedelta(seconds=finite(elapsed, 0, 86400 * 7))

    def initial_state(self, node):
        return state_dict(self.initial(node))

    def plan(self, arrival, destination, elapsed):
        before = state_object(arrival)
        context = self.context(self.instant(elapsed))
        result = self.route(before.node, destination, before, context)
        if result.status == "NO_MODELED_CONTINUATION":
            return None
        if result.status != "ROUTE":
            raise ValueError("routing context unavailable: " + str(result.reason))
        ns = [before.node, *[self.edges[e]["v"] for e in result.edges]]
        return {
            "edges": list(result.edges),
            "nodes": ns,
            "seconds": result.seconds,
            "length_m": sum(self.edges[e]["length_m"] for e in result.edges),
            "arrival_before": copy.deepcopy(arrival),
            "arrival_after": state_dict(result.arrival),
            "departure_utc": context.departure.isoformat(),
            "scenario_digest": self.spec_digest,
        }

    def actual_arrival(self, route, completed_edges):
        before = state_object(route["arrival_before"])
        incoming, prefix, node = before.incoming_edge, before.restriction_prefix, before.node
        budget = _Budget(self.max_checks)
        for eid in completed_edges:
            if self.edges[eid]["u"] != node:
                raise ValueError("executed path disconnected")
            next_state, reason = self._advance(incoming, prefix, eid, budget)
            if next_state is None:
                raise ValueError("executed path rejected: " + str(reason))
            incoming, prefix = next_state
            node = self.edges[eid]["v"]
        if not completed_edges:
            return copy.deepcopy(route["arrival_before"])
        return state_dict(ArrivalState(node, self.pack_digest, before.profile, incoming, prefix))
