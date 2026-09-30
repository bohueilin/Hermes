"""Bounded routing with actual time labels; no waiting or time-blind fallback."""

import heapq
import itertools
import math
from collections import OrderedDict, defaultdict
from datetime import timedelta
from types import MappingProxyType
from zoneinfo import ZoneInfo

from .conditional_access_v1 import parse_condition
from .continuity_v1 import PROFILE, ArrivalState, RouteResult, _Budget, _check_context
from .contracts import digest, finite
from .fleet_routing_v2 import FleetRouter
from .temporal_import_v3 import ALLOW, CONTEXT, MODES, validated_graph

MODEL = "fleetlab.graph-resource-temporal/3.0.0"
SCHEMA = "fleetlab.city-temporal-run/3.0.0"


def _active(rule, timestamp):
    local = timestamp.astimezone(ZoneInfo(CONTEXT["timezone"]))
    minute = local.hour * 60 + local.minute
    for a, b in rule.windows:
        if a < b and local.weekday() in rule.weekdays and a <= minute < b:
            return True
        if a > b and (
            (local.weekday() in rule.weekdays and minute >= a)
            or ((local.weekday() - 1) % 7 in rule.weekdays and minute < b)
        ):
            return True
    return False


class TemporalRouter(FleetRouter):
    def __init__(self, pack, spec):
        if (
            spec.get("model") != MODEL
            or spec.get("vehicle_class") != "passenger_car"
            or spec.get("timezone") != CONTEXT["timezone"]
        ):
            raise ValueError("unsupported temporal scenario/class/timezone")
        duration, horizon = spec.get("duration_s"), spec.get("route_horizon_s")
        if (
            type(duration) is not int
            or not 1 <= duration <= 86400 * 7
            or type(horizon) is not int
            or not 1 <= horizon <= 7200
        ):
            raise ValueError("temporal scenario/journey horizon bound")
        graph = validated_graph(pack)
        super().__init__(graph, spec)
        self._cache = OrderedDict()
        self._potential_cache = OrderedDict()
        self._potential_nodes = 0
        self._max_potential_entries = 16
        self._max_potential_nodes = 1_000_000
        self.pack_digest = digest(pack)
        self.horizon_ms = horizon * 1000
        boarding = spec.get("boarding_s", 0)
        if type(boarding) is not int or not 0 <= boarding <= 86400:
            raise ValueError("boarding context bound")
        self.max_departure_s = duration + 2 * horizon + boarding + 2
        self.end = self.start + timedelta(seconds=self.max_departure_s + horizon)
        self._duration_ms = {e["id"]: e["duration_ms"] for e in pack["edges"]}
        self._node_access = {e["node"]: e["tags"] for e in pack["temporal"]["nodes"]}
        # Supported conditionals only add denials. A denial in the most
        # specific base mode therefore cannot become passable at any clock.
        # Retaining it in the relaxed topology can otherwise expand time labels
        # for an unreachable destination behind a permanent gate.
        permanently_closed = {
            node
            for node, tags in self._node_access.items()
            if next((tags[mode] not in ALLOW for mode in MODES if mode in tags), False)
        }
        self._reverse = defaultdict(list)
        for edge in pack["edges"]:
            if edge["u"] not in permanently_closed and edge["v"] not in permanently_closed:
                self._reverse[edge["v"]].append((edge["u"], edge["duration_ms"]))
        self._timed_turns, self._access = defaultdict(list), {}
        self._spans, self._boundaries = {}, set()
        for rule in pack["temporal"]["turns"]:
            self._register(rule["expression"])
            self._timed_turns[(rule["via"], rule["from"])].append(rule)
        for entry in pack["temporal"]["access"]:
            self._access[entry["way"]] = dict(entry["tags"])
            for key, value in entry["tags"].items():
                if key.endswith(":conditional"):
                    self._register(value)
        for tags in self._node_access.values():
            for key, value in tags.items():
                if key.endswith(":conditional"):
                    self._register(value)
        self._boundaries = tuple(sorted(self._boundaries))
        self._schedule_features = []
        for (node, _), rules in self._timed_turns.items():
            for rule in rules:
                self._schedule_features.append((node, node, 0, rule["expression"]))
        for node, tags in self._node_access.items():
            for key, expression in tags.items():
                if key.endswith(":conditional"):
                    self._schedule_features.append((node, node, 0, expression))
        for edge in self.edges.values():
            for key, expression in self._access.get(edge["way"], {}).items():
                if key.endswith(":conditional"):
                    self._schedule_features.append(
                        (edge["u"], edge["v"], self._duration_ms[edge["id"]], expression)
                    )

    def _register(self, expression):
        if expression in self._spans:
            return
        if len(self._spans) >= 128:
            raise ValueError("unique temporal schedule bound")
        rule = parse_condition(expression)
        began = self.start.replace(second=0, microsecond=0)
        cursor, active_from, spans = began, None, []
        while cursor <= self.end + timedelta(minutes=1):
            active = _active(rule, cursor)
            if active and active_from is None:
                active_from = cursor
            if not active and active_from is not None:
                spans.append((active_from, cursor))
                active_from = None
            cursor += timedelta(minutes=1)
        if active_from is not None:
            spans.append((active_from, cursor))
        self._spans[expression] = tuple(spans)
        for a, b in spans:
            self._boundaries.update((a, b))

    def _active_at(self, expression, at):
        return any(a <= at < b for a, b in self._spans[expression])

    def _allowed(self, incoming, eid, at):
        edge = self.edges[eid]
        exit_at = at + timedelta(milliseconds=self._duration_ms[eid])
        for node, point in ((edge["u"], at), (edge["v"], exit_at)):
            tags = self._node_access.get(node, {})
            for mode in MODES:
                raw = tags.get(mode + ":conditional")
                if raw and self._active_at(raw, point):
                    return False
                if mode in tags:
                    if tags[mode] not in ALLOW:
                        return False
                    break
        if incoming:
            for r in self._timed_turns.get((edge["u"], self.edges[incoming]["way"]), ()):
                if r["to"] == edge["way"] and self._active_at(r["expression"], at):
                    return False
        tags = self._access.get(edge["way"])
        if tags:
            exit_at = at + timedelta(milliseconds=self._duration_ms[eid])
            points = {at}
            for key, expression in tags.items():
                if key.endswith(":conditional"):
                    points.update(
                        t for span in self._spans[expression] for t in span if at < t < exit_at
                    )
            for point in points:
                value = "yes"
                for mode in MODES:
                    expression = tags.get(mode + ":conditional")
                    if expression and self._active_at(expression, point):
                        value = "no"
                        break
                    if mode in tags:
                        value = tags[mode]
                        break
                if value not in ALLOW:
                    return False
        return True

    def _lower_distances(self, destination, budget):
        """Reverse potential ignoring turn/scheduled rules, retaining permanent gates.

        It underestimates every feasible time-dependent journey. Completed
        potentials share a separate bounded LRU (16 destinations / 1M labels),
        never an all-pairs table. The graph is fixed for this router; horizon
        remains in the key. Immutable values cannot become route permissions.
        """
        budget.spend()
        key = (self.pack_digest, destination, self.horizon_ms)
        if key in self._potential_cache:
            self._potential_cache.move_to_end(key)
            return self._potential_cache[key]
        lower = {destination: 0}
        heap = [(0, destination)]
        while heap:
            cost, node = heapq.heappop(heap)
            if cost != lower[node]:
                continue
            for previous, duration in self._reverse.get(node, ()):
                budget.spend()
                score = cost + duration
                if score > self.horizon_ms or score >= lower.get(previous, math.inf):
                    continue
                if previous not in lower and len(lower) >= self.max_states:
                    raise ValueError("temporal reverse-potential state budget exceeded")
                lower[previous] = score
                heapq.heappush(heap, (score, previous))
        frozen = MappingProxyType(lower)
        if self._max_potential_entries > 0 and len(lower) <= self._max_potential_nodes:
            while (
                len(self._potential_cache) >= self._max_potential_entries
                or self._potential_nodes + len(lower) > self._max_potential_nodes
            ):
                _, old = self._potential_cache.popitem(last=False)
                self._potential_nodes -= len(old)
            self._potential_cache[key] = frozen
            self._potential_nodes += len(lower)
        return frozen

    def _feasible_upper(self, start, destination, arrival, context, budget, lower_distances):
        """Find only a feasible cost bound; failure/earliest labels prove nothing.

        Every expanded edge obeys actual arrival time and retained static history.
        The exact search below still proves the minimum within this valid bound.
        This pass shares the query work budget and never emits a public route.
        """
        first = (arrival.incoming_edge, arrival.restriction_prefix)
        best = {first: 0}
        serial = itertools.count()
        heap = [(0, 0, next(serial), first)]
        while heap:
            _, cost, _, state = heapq.heappop(heap)
            if best[state] != cost:
                continue
            node = self.edges[state[0]]["v"] if state[0] else start
            if node == destination:
                return cost
            for eid in self._out.get(node, ()):
                nxt, _ = self._advance(*state, eid, budget)
                budget.spend()
                score = cost + self._duration_ms[eid]
                if nxt is None or score > self.horizon_ms or score >= best.get(nxt, math.inf):
                    continue
                if not self._allowed(
                    state[0], eid, context.departure + timedelta(milliseconds=cost)
                ):
                    continue
                if nxt not in best and len(best) >= self.max_states:
                    return None
                best[nxt] = score
                lower = lower_distances.get(self.edges[eid]["v"], math.inf)
                if score + lower > self.horizon_ms:
                    continue
                heapq.heappush(heap, (score + lower, score, next(serial), nxt))
        return None

    def _relevant_boundaries(self, start, context, bound, lower, budget):
        """Conservative change instants on any complete journey within the bound.

        Plain-graph forward/reverse distances ignore restrictions, so they bound
        every feasible prefix and suffix from below. A feature can be occupied
        only between its earliest possible entry and latest possible exit. A
        schedule change outside that interval cannot distinguish two feasible
        route labels. Node passage and turns use a zero-duration point; ways use
        the whole edge interval, including changes during occupancy.
        """
        final = context.departure + timedelta(milliseconds=bound)
        changes = {}
        for expression, spans in self._spans.items():
            budget.spend(len(spans) * 2)
            values = {t for span in spans for t in span if context.departure < t <= final}
            if values:
                changes[expression] = values
        if not changes:
            return ()
        forward = {start: 0}
        heap = [(0, start)]
        while heap:
            cost, node = heapq.heappop(heap)
            if cost != forward[node]:
                continue
            for eid in self._out.get(node, ()):
                budget.spend()
                edge = self.edges[eid]
                score = cost + self._duration_ms[eid]
                if score + lower.get(edge["v"], math.inf) > bound or score >= forward.get(
                    edge["v"], math.inf
                ):
                    continue
                if edge["v"] not in forward and len(forward) >= self.max_states:
                    raise ValueError("temporal forward-potential state budget exceeded")
                forward[edge["v"]] = score
                heapq.heappush(heap, (score, edge["v"]))
        relevant = set()
        for u, v, duration, expression in self._schedule_features:
            budget.spend()
            first = forward.get(u, math.inf)
            last = bound - lower.get(v, math.inf)
            if first + duration > last:
                continue
            for boundary in changes.get(expression, ()):
                budget.spend()
                offset = boundary - context.departure
                if timedelta(milliseconds=first) <= offset <= timedelta(milliseconds=last):
                    relevant.add(boundary)
        return tuple(sorted(relevant))

    def _static_optimum(self, start, destination, arrival, budget, lower, algorithm):
        """Exact lower bound with static history, relaxing only temporal rules.

        Its route may be used only after every temporal traversal is checked.
        If valid at those instants, it attains the relaxed minimum and therefore
        the minimum with temporal constraints as well. No waiting is introduced.
        """
        first = (arrival.incoming_edge, arrival.restriction_prefix)
        best, previous = {first: 0}, {}
        serial = itertools.count()
        heap = [(0, 0, next(serial), first)]
        while heap:
            _, cost, _, state = heapq.heappop(heap)
            if cost != best[state]:
                continue
            node = self.edges[state[0]]["v"] if state[0] else start
            if node == destination:
                path, cursor = [], state
                while cursor != first:
                    old, eid = previous[cursor]
                    path.append(eid)
                    cursor = old
                return cost, tuple(reversed(path)), state
            for eid in self._out.get(node, ()):
                nxt, _ = self._advance(*state, eid, budget)
                score = cost + self._duration_ms[eid]
                remaining = lower.get(self.edges[eid]["v"], math.inf)
                if (
                    nxt is None
                    or score + remaining > self.horizon_ms
                    or score >= best.get(nxt, math.inf)
                ):
                    continue
                if nxt not in best and len(best) >= self.max_states:
                    raise ValueError("temporal static-relaxation state budget exceeded")
                best[nxt], previous[nxt] = score, (state, eid)
                heapq.heappush(
                    heap,
                    (score + (remaining if algorithm == "astar" else 0), score, next(serial), nxt),
                )
        return None

    def _remember(self, key, result):
        # Static proofs and exact-time results share the original total bounds.
        # Eviction changes performance only; it never discards arrival history.
        if self.max_cache_entries == 0 or len(result.edges) > self._max_cache_edges:
            return result
        if key in self._cache:
            self._cached_edges -= len(self._cache.pop(key).edges)
        while (
            len(self._cache) >= self.max_cache_entries
            or self._cached_edges + len(result.edges) > self._max_cache_edges
        ):
            _, old = self._cache.popitem(last=False)
            self._cached_edges -= len(old.edges)
        self._cache[key] = result
        self._cached_edges += len(result.edges)
        return result

    def route(self, start, destination, arrival, context, *, algorithm="astar", _budget=None):
        try:
            _check_context(context, self.pack_digest, self.scenario_digest)
            if (
                start not in self.nodes
                or destination not in self.nodes
                or algorithm not in {"astar", "dijkstra"}
            ):
                raise ValueError("unknown temporal route endpoint or algorithm")
            self._validate_arrival(start, arrival)
            if _budget is not None and (
                not isinstance(_budget, _Budget) or not 0 <= _budget.remaining <= self.max_checks
            ):
                raise ValueError("invalid shared restriction work budget")
            if (
                not self.start
                <= context.departure
                <= self.end - timedelta(milliseconds=self.horizon_ms)
            ):
                raise ValueError("departure outside frozen scenario")
        except (ValueError, TypeError, AttributeError) as exc:
            return RouteResult("UNSUPPORTED_CONTEXT", reason=str(exc))
        if start == destination:
            return RouteResult("ROUTE", seconds=0.0, arrival=arrival)
        key = (start, destination, arrival, context, algorithm, self.horizon_ms)
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]
        budget = _Budget(self.max_checks) if _budget is None else _budget
        static_key = ("STATIC_RELAXATION", start, destination, arrival, algorithm, self.horizon_ms)
        lower_distances = None
        try:
            if static_key in self._cache:
                self._cache.move_to_end(static_key)
                static = self._cache[static_key]
            else:
                lower_distances = self._lower_distances(destination, budget)
                relaxed = (
                    self._static_optimum(
                        start, destination, arrival, budget, lower_distances, algorithm
                    )
                    if start in lower_distances
                    else None
                )
                if relaxed is None:
                    static = RouteResult(
                        "NO_MODELED_CONTINUATION",
                        reason="no static-history route within horizon even without temporal rules",
                    )
                else:
                    cost, path, state = relaxed
                    static = RouteResult(
                        "ROUTE",
                        path,
                        cost / 1000,
                        ArrivalState(destination, self.pack_digest, PROFILE, state[0], state[1]),
                    )
                self._remember(static_key, static)
            # The relaxation has no clock-dependent permission. Its no-route
            # proof remains valid across departures. A path is only a candidate
            # until every actual-time traversal check below passes again.
            if static.status == "NO_MODELED_CONTINUATION":
                return self._remember(key, static)
            offset, incoming, valid = 0, arrival.incoming_edge, True
            for eid in static.edges:
                budget.spend(
                    1
                    + len(
                        self._timed_turns.get(
                            (self.edges[eid]["u"], self.edges[incoming]["way"]), ()
                        )
                    )
                    if incoming
                    else 1
                )
                if not self._allowed(
                    incoming, eid, context.departure + timedelta(milliseconds=offset)
                ):
                    valid = False
                    break
                offset += self._duration_ms[eid]
                incoming = eid
            if valid:
                return self._remember(key, static)
            if lower_distances is None:
                lower_distances = self._lower_distances(destination, budget)
            upper = self._feasible_upper(
                start, destination, arrival, context, budget, lower_distances
            )
        except ValueError as exc:
            return RouteResult("UNSUPPORTED_CONTEXT", reason=str(exc))
        bound = self.horizon_ms if upper is None else upper
        try:
            stable_from = max(
                self._relevant_boundaries(start, context, bound, lower_distances, budget),
                default=context.departure,
            )
        except ValueError as exc:
            return RouteResult("UNSUPPORTED_CONTEXT", reason=str(exc))
        initial = (arrival.incoming_edge, arrival.restriction_prefix, 0)
        best, previous = {initial: 0}, {}
        serial = itertools.count()
        heap = [(0, 0, next(serial), initial)]
        while heap:
            _, cost, _, state = heapq.heappop(heap)
            if best[state] != cost:
                continue
            node = self.edges[state[0]]["v"] if state[0] else start
            if node == destination:
                path, cursor = [], state
                while cursor != initial:
                    old, eid = previous[cursor]
                    path.append(eid)
                    cursor = old
                result = RouteResult(
                    "ROUTE",
                    tuple(reversed(path)),
                    cost / 1000,
                    ArrivalState(destination, self.pack_digest, PROFILE, state[0], state[1]),
                )
                break
            for eid in self._out.get(node, ()):
                try:
                    nxt, _ = self._advance(state[0], state[1], eid, budget)
                    budget.spend(
                        1 + len(self._timed_turns.get((node, self.edges[state[0]]["way"]), ()))
                        if state[0]
                        else 1
                    )
                except ValueError as exc:
                    return RouteResult("UNSUPPORTED_CONTEXT", reason=str(exc))
                score = cost + self._duration_ms[eid]
                if nxt is None or score > bound:
                    continue
                at = context.departure + timedelta(milliseconds=cost)
                if not self._allowed(state[0], eid, at):
                    continue
                lower = lower_distances.get(self.edges[eid]["v"], math.inf)
                if score + lower > bound + 0.000001:
                    continue
                # After the last possible rule change inside the feasible cost
                # bound, the remaining network is static. At the same incoming
                # edge/history, the earlier label then dominates: replaying any
                # later suffix earlier crosses no further boundary. Before that
                # instant, distinct times remain essential because waiting is
                # forbidden. The boundary instant uses its new rule state.
                after = at + timedelta(milliseconds=self._duration_ms[eid])
                # Keep the stable marker distinct from the initial time zero:
                # a legal cycle may return to its incoming edge after a gate
                # opens, when the pre-boundary initial label cannot dominate it.
                nxt = (*nxt, score if after < stable_from else None)
                if score >= best.get(nxt, math.inf):
                    continue
                if nxt not in best and len(best) >= self.max_states:
                    return RouteResult(
                        "UNSUPPORTED_CONTEXT", reason="temporal search state budget exceeded"
                    )
                best[nxt], previous[nxt] = score, (state, eid)
                heapq.heappush(
                    heap, (score + (lower if algorithm == "astar" else 0), score, next(serial), nxt)
                )
        else:
            result = RouteResult(
                "NO_MODELED_CONTINUATION",
                reason="no route within declared temporal journey horizon; no waiting",
            )
        return self._remember(key, result)

    def instant(self, elapsed):
        return self.start + timedelta(seconds=finite(elapsed, 0, self.max_departure_s))

    def plan(self, arrival, destination, elapsed):
        route = super().plan(arrival, destination, elapsed)
        if route is not None:
            offset = 0
            entries = []
            for eid in route["edges"]:
                entries.append(
                    {
                        "edge": eid,
                        "entry_utc": (
                            self.instant(elapsed) + timedelta(milliseconds=offset)
                        ).isoformat(),
                        "exit_utc": (
                            self.instant(elapsed)
                            + timedelta(milliseconds=offset + self._duration_ms[eid])
                        ).isoformat(),
                    }
                )
                offset += self._duration_ms[eid]
            route["temporal_entries"] = entries
        return route
