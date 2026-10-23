"""Explicit source-edge circulation before a matched depot departure."""

import copy
from datetime import timedelta

from .continuity_v1 import PROFILE, ArrivalState, _Budget
from .contracts import digest
from .depot_connectors_v1 import MODEL, registry, scenario_core
from .fleet_routing_v2 import state_dict, state_object
from .temporal_routing_v3 import MODEL as TEMPORAL_MODEL
from .temporal_routing_v3 import TemporalRouter


class ConnectorRouter(TemporalRouter):
    def __init__(self, pack, spec):
        if spec.get("model") != MODEL:
            raise ValueError("connector model identity required")
        # The temporal graph/profile is unchanged; the complete original scenario
        # identity is restored before any route, cache entry or state is created.
        super().__init__(pack, {**scenario_core(spec), "model": TEMPORAL_MODEL})
        self.spec_digest = self.scenario_digest = digest(spec)
        self._connectors = {key: (d, review) for key, d, review in registry(pack, spec)}

    def plan(self, arrival, destination, elapsed):
        before = state_object(arrival)
        self._validate_arrival(before.node, before)
        matched = self._connectors.get(
            (before.node, before.incoming_edge, before.restriction_prefix)
        )
        if before.node == destination or matched is None:
            route = super().plan(arrival, destination, elapsed)
            if route is not None:
                route["connector_transition"] = None
            return route
        declaration, review = matched
        incoming, prefix, offset = before.incoming_edge, before.restriction_prefix, 0
        budget = _Budget(self.max_checks)
        departure = self.instant(elapsed)
        entries = []
        for eid in declaration["edges"]:
            nxt, _ = self._advance(incoming, prefix, eid, budget)
            budget.spend(
                1
                + len(
                    self._timed_turns.get((self.edges[eid]["u"], self.edges[incoming]["way"]), ())
                )
            )
            at = departure + timedelta(milliseconds=offset)
            if nxt is None or not self._allowed(incoming, eid, at):
                return None
            end = at + timedelta(milliseconds=self._duration_ms[eid])
            entries.append({"edge": eid, "entry_utc": at.isoformat(), "exit_utc": end.isoformat()})
            incoming, prefix = nxt
            offset += self._duration_ms[eid]
        after = state_dict(ArrivalState(before.node, self.pack_digest, PROFILE, incoming, prefix))
        context = self.context(self.instant(elapsed + offset / 1000))
        result = super().route(
            before.node, destination, state_object(after), context, _budget=budget
        )
        if result.status == "NO_MODELED_CONTINUATION":
            return None
        if result.status != "ROUTE":
            raise ValueError("routing context unavailable: " + str(result.reason))
        total_ms = offset + sum(self._duration_ms[e] for e in result.edges)
        if total_ms > self.horizon_ms:
            return None
        clock = offset
        for eid in result.edges:
            at = departure + timedelta(milliseconds=clock)
            clock += self._duration_ms[eid]
            entries.append(
                {
                    "edge": eid,
                    "entry_utc": at.isoformat(),
                    "exit_utc": (departure + timedelta(milliseconds=clock)).isoformat(),
                }
            )
        path = declaration["edges"] + list(result.edges)
        route = {
            "edges": path,
            "nodes": [before.node] + [self.edges[e]["v"] for e in path],
            "seconds": total_ms / 1000,
            "length_m": sum(self.edges[e]["length_m"] for e in path),
            "departure_utc": departure.isoformat(),
            "arrival_before": copy.deepcopy(arrival),
            "arrival_after": state_dict(result.arrival),
            "temporal_entries": entries,
            "scenario_digest": self.spec_digest,
        }
        route["connector_transition"] = {
            "evidence": "PLANNED_PREFIX",
            "id": declaration["id"],
            "declaration_digest": digest(declaration),
            "review_digest": digest(review),
            "pack_digest": self.pack_digest,
            "scenario_core_digest": declaration["scenario_core_digest"],
            "arrival_before": copy.deepcopy(arrival),
            "arrival_after": after,
            "duration_ms": offset,
            "length_m": declaration["length_m"],
            "provenance": copy.deepcopy(declaration["provenance"]),
        }
        return route
