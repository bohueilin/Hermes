"""A* over source-node/previous-edge states, preserving node-via turn restrictions."""

import heapq
from collections import defaultdict

from .contracts import digest
from .pack import distance


class Graph:
    def __init__(self, pack):
        from .restrictions import validate_profile

        profile = validate_profile(pack)
        self.pack = pack
        self._construction_digest = digest({k: pack[k] for k in ("nodes", "edges", "turns")})
        self.nodes = pack["nodes"]
        self.out = defaultdict(list)
        self.edges = {e["id"]: e for e in pack["edges"]}
        self.rules = defaultdict(list)
        self.max_speed = max((e["speed_mps"] for e in pack["edges"]), default=1)
        self.cache = {}
        self.prepared = None
        for e in pack["edges"]:
            self.out[e["u"]].append(e)
        for es in self.out.values():
            es.sort(key=lambda e: e["id"])
        for r in pack["turns"]:
            if "edge_sequences" not in r:
                self.rules[(r["via"], r["from"])].append(r)
        self.history = None
        if profile == "edge-sequence/2.0.0":
            from .history_routing import HistoryRouter

            self.history = HistoryRouter(self)

    def assert_fleet_compatible(self, pack):
        """Bind a reused router's actual fields and construction to the execution pack."""
        from .restrictions import validate_profile

        if validate_profile(self.pack) != "node-via/1.0.0" or self.history is not None:
            raise ValueError("supplied graph uses unqualified routing semantics")
        expected_digest = digest({k: pack[k] for k in ("nodes", "edges", "turns")})
        if expected_digest != self._construction_digest:
            raise ValueError("supplied graph digest differs from execution pack")
        edges = {e["id"]: e for e in pack["edges"]}
        outgoing = defaultdict(list)
        rules = defaultdict(list)
        for edge in pack["edges"]:
            outgoing[edge["u"]].append(edge)
        for values in outgoing.values():
            values.sort(key=lambda edge: edge["id"])
        for rule in pack["turns"]:
            rules[(rule["via"], rule["from"])].append(rule)
        if (
            self.nodes != pack["nodes"]
            or self.edges != edges
            or {k: v for k, v in self.out.items() if v} != outgoing
            or {k: v for k, v in self.rules.items() if v} != rules
            or self.max_speed != max((e["speed_mps"] for e in edges.values()), default=1)
        ):
            raise ValueError("supplied graph runtime fields differ from execution pack")

    def route(self, start, end):
        if self.history is not None:
            return self.history.route(start, end)
        key = (str(start), str(end))
        start, end = key
        if key in self.cache:
            return self.cache[key]
        if self.prepared is not None and start in self.prepared["sources"]:
            return self._prepared_route(start, end)
        if start not in self.nodes or end not in self.nodes:
            return None
        initial = (start, "")
        best = {initial: 0.0}
        previous = {}
        heap = [(0.0, 0.0, start, "")]
        found = None
        while heap:
            _, cost, node, incoming = heapq.heappop(heap)
            state = (node, incoming)
            if cost > best.get(state, float("inf")):
                continue
            if node == end:
                found = state
                break
            before = self.edges.get(incoming)
            for edge in self.out[node]:
                if before:
                    if edge["v"] == before["u"]:
                        continue
                    rules = self.rules[(node, before["way"])]
                    if any(
                        (r["kind"].startswith("no_") and edge["way"] == r["to"])
                        or (r["kind"].startswith("only_") and edge["way"] != r["to"])
                        for r in rules
                    ):
                        continue
                new = (edge["v"], edge["id"])
                score = cost + edge["seconds"]
                if score < best.get(new, float("inf")):
                    best[new] = score
                    previous[new] = (state, edge["id"])
                    h = distance(self.nodes[edge["v"]], self.nodes[end]) / self.max_speed
                    heapq.heappush(heap, (score + h, score, edge["v"], edge["id"]))
        if found is None:
            result = None
        else:
            path = []
            state = found
            while state != initial:
                state, eid = previous[state]
                path.append(eid)
            path.reverse()
            result = {
                "nodes": [start] + [self.edges[e]["v"] for e in path],
                "edges": path,
                "seconds": best[found],
                "length_m": sum(self.edges[e]["length_m"] for e in path),
            }
        if len(self.cache) < 150000:
            self.cache[key] = result
        return result

    def prepare(self, sources):
        """Pinned SciPy Dijkstra on incoming-edge states; no relaxation of turn rules."""
        if self.history is not None:
            self.history.prepare(sources)
            self.prepared = self.history.prepared
            return
        import numpy as np
        from scipy.sparse import csr_matrix
        from scipy.sparse.csgraph import dijkstra

        order = sorted(self.edges)
        index = {eid: i for i, eid in enumerate(order)}
        sources = sorted(set(sources))
        count = len(order)
        estimated = (count + len(sources)) * len(sources) * 12
        if estimated > 2_000_000_000:
            raise ValueError("routing table exceeds 2 GB working budget")
        rows = []
        cols = []
        weights = []
        incoming = defaultdict(list)
        for i, eid in enumerate(order):
            e = self.edges[eid]
            incoming[e["v"]].append(i)
            for nxt in self.out[e["v"]]:
                if nxt["v"] == e["u"]:
                    continue
                if any(
                    (r["kind"].startswith("no_") and nxt["way"] == r["to"])
                    or (r["kind"].startswith("only_") and nxt["way"] != r["to"])
                    for r in self.rules[(e["v"], e["way"])]
                ):
                    continue
                rows.append(i)
                cols.append(index[nxt["id"]])
                weights.append(nxt["seconds"])
        for j, node in enumerate(sources):
            for e in self.out[node]:
                rows.append(count + j)
                cols.append(index[e["id"]])
                weights.append(e["seconds"])
        matrix = csr_matrix(
            (weights, (rows, cols)), shape=(count + len(sources), count + len(sources))
        )
        distances, previous = dijkstra(
            matrix,
            directed=True,
            indices=np.arange(count, count + len(sources)),
            return_predecessors=True,
        )
        self.prepared = {
            "sources": {n: i for i, n in enumerate(sources)},
            "order": order,
            "incoming": incoming,
            "distances": distances,
            "previous": previous,
        }
        self.cache.clear()

    def _prepared_route(self, start, end):
        import math

        p = self.prepared
        key = (start, end)
        if start == end:
            return {"nodes": [start], "edges": [], "seconds": 0.0, "length_m": 0.0}
        row = p["sources"][start]
        ends = p["incoming"].get(end, [])
        target = min(ends, key=lambda i: (p["distances"][row, i], i)) if ends else None
        if target is None or not math.isfinite(p["distances"][row, target]):
            result = None
        else:
            at = target
            path = []
            while 0 <= at < len(p["order"]):
                path.append(p["order"][at])
                at = int(p["previous"][row, at])
            if at != len(p["order"]) + row:
                raise ValueError("routing predecessor chain is invalid")
            path.reverse()
            result = {
                "nodes": [start] + [self.edges[e]["v"] for e in path],
                "edges": path,
                "seconds": float(p["distances"][row, target]),
                "length_m": sum(self.edges[e]["length_m"] for e in path),
            }
        if len(self.cache) < 150000:
            self.cache[key] = result
        return result
