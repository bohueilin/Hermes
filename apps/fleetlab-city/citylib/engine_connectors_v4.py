"""Connector fleet entry point; ordinary recorded movement accounts for all cost."""

from .connector_routing_v4 import ConnectorRouter
from .depot_connectors_v1 import MODEL, SCHEMA
from .engine_continuity_v2 import _run_arm


def run_arm(pack, inputs, spec, stop_at=None):
    return _run_arm(pack, inputs, spec, ConnectorRouter(pack, spec), MODEL, SCHEMA, stop_at)
