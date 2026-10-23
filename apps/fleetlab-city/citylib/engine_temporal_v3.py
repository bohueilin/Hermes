"""Versioned temporal fleet entry point; retains the tested resource clock."""

from .engine_continuity_v2 import _run_arm
from .temporal_routing_v3 import MODEL, SCHEMA, TemporalRouter


def run_arm(pack, inputs, spec, stop_at=None):
    router = TemporalRouter(pack, spec)
    return _run_arm(pack, inputs, spec, router, MODEL, SCHEMA, stop_at)
