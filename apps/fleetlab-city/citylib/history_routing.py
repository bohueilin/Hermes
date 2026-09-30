"""A* and prepared SciPy Dijkstra over the same finite edge/prefix product graph."""

import heapq
import math
from collections import defaultdict

from .pack import distance
from .restrictions import SequenceMachine


class HistoryRouter:
    def __init__(self, graph):
        self.graph = graph
        self.machine = SequenceMachine(graph.pack["turns"])
        self.prepared = None
        self.cache = {}

    def successor(self, state, edge):
        incoming, active = state
        before = self.graph.edges.get(incoming)
        if before:
            if edge["v"] == before["u"]:
                return None
            for r in self.graph.rules[(before["v"], before["way"])]:
                if (r["kind"].startswith("no_") and edge["way"] == r["to"]) or (
                    r["kind"].startswith("only_") and edge["way"] != r["to"]
                ):
                    return None
        updated = self.machine.advance(active, edge["id"])
        return None if updated is None else (edge["id"], updated)

    def result(self, start, path, seconds):
        edges = self.graph.edges
        return {
            "nodes": [start] + [edges[e]["v"] for e in path],
            "edges": path,
            "seconds": seconds,
            "length_m": sum(edges[e]["length_m"] for e in path),
        }

    def route(self, start, end):
        start, end = str(start), str(end)
        if start not in self.graph.nodes or end not in self.graph.nodes:
            return None
        if start == end:
            return self.result(start, [], 0.0)
        if (start, end) in self.cache:
            return self.cache[start, end]
        if self.prepared and start in self.prepared["sources"]:
            return self.prepared_route(start, end)
        initial = ("", ())
        heap = [(0.0, 0.0, initial)]
        best, previous = {initial: 0.0}, {}
        while heap:
            _, cost, state = heapq.heappop(heap)
            if cost > best.get(state, math.inf):
                continue
            node = self.graph.edges[state[0]]["v"] if state[0] else start
            if node == end:
                path = []
                found = state
                while state != initial:
                    path.append(state[0])
                    state = previous[state]
                result = self.result(start, path[::-1], best[found])
                break
            for edge in self.graph.out[node]:
                nxt = self.successor(state, edge)
                score = cost + edge["seconds"]
                if nxt is not None and score < best.get(nxt, math.inf):
                    best[nxt], previous[nxt] = score, state
                    h = (
                        distance(self.graph.nodes[edge["v"]], self.graph.nodes[end])
                        / self.graph.max_speed
                    )
                    heapq.heappush(heap, (score + h, score, nxt))
        else:
            result = None
        if len(self.cache) < 150000:
            self.cache[start, end] = result
        return result

    def prepare(self, sources):
        import numpy as np
        from scipy.sparse import csr_matrix
        from scipy.sparse.csgraph import dijkstra

        sources = sorted(set(str(s) for s in sources))
        if any(s not in self.graph.nodes for s in sources):
            raise ValueError("unknown routing source node")
        states, index = [], {}

        def add(state):
            if state not in index:
                if len(states) >= 1_000_000:
                    raise ValueError("routing product exceeds one million states")
                index[state] = len(states)
                states.append(state)
            return index[state]

        # Every directed edge can start a route; close this set under legal transitions.
        for eid in sorted(self.graph.edges):
            add((eid, self.machine.advance((), eid)))
        rows, cols, weights = [], [], []
        incoming = defaultdict(list)
        cursor = 0
        while cursor < len(states):
            state = states[cursor]
            node = self.graph.edges[state[0]]["v"]
            incoming[node].append(cursor)
            for edge in self.graph.out[node]:
                nxt = self.successor(state, edge)
                if nxt is not None:
                    rows.append(cursor)
                    cols.append(add(nxt))
                    weights.append(edge["seconds"])
            cursor += 1
        count = len(states)
        estimated = (count + len(sources)) * len(sources) * 12
        if estimated > 2_000_000_000:
            raise ValueError("routing table exceeds 2 GB working budget")
        for j, source in enumerate(sources):
            for edge in self.graph.out[source]:
                rows.append(count + j)
                cols.append(index[(edge["id"], self.machine.advance((), edge["id"]))])
                weights.append(edge["seconds"])
        matrix = csr_matrix((weights, (rows, cols)), shape=(count + len(sources),) * 2)
        distances, previous = dijkstra(
            matrix,
            directed=True,
            indices=np.arange(count, count + len(sources)),
            return_predecessors=True,
        )
        self.prepared = {
            "sources": {s: i for i, s in enumerate(sources)},
            "states": states,
            "incoming": incoming,
            "distances": distances,
            "previous": previous,
            "state_count": count,
            "estimated_table_bytes": estimated,
        }
        self.cache.clear()

    def prepared_route(self, start, end):
        p = self.prepared
        row = p["sources"][start]
        ends = p["incoming"].get(end, [])
        target = min(ends, key=lambda i: (p["distances"][row, i], i)) if ends else None
        if target is None or not math.isfinite(p["distances"][row, target]):
            return None
        path, at = [], target
        while 0 <= at < len(p["states"]):
            path.append(p["states"][at][0])
            at = int(p["previous"][row, at])
        if at != len(p["states"]) + row:
            raise ValueError("routing predecessor chain is invalid")
        result = self.result(start, path[::-1], float(p["distances"][row, target]))
        if len(self.cache) < 150000:
            self.cache[start, end] = result
        return result
