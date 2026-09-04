"""Pins for FleetLab's characterization digests.

A moved pin is a deliberate re-baseline recorded in the commit and in the source of truth,
never a drive-by update.
"""

from hermes.fleet.cli import fleet_005_spec
from hermes.fleet.experiment import run_experiment

FLEET_005_RECORD_DIGEST = "84ff1c91b600f29e3d3661d988339e1654db419d6ba500e7d79e616a58706e7f"
FLEET_005_SPEC_DIGEST = "b68f75d295e4ace1c4f3e470e52fde828a8b433eec2682f66596dbebbd5360c2"


def test_the_fleet_005_demo_record_digest_is_pinned() -> None:
    assert run_experiment(fleet_005_spec()).record_digest() == FLEET_005_RECORD_DIGEST


def test_the_fleet_005_spec_digest_is_pinned() -> None:
    assert fleet_005_spec().spec_digest() == FLEET_005_SPEC_DIGEST
