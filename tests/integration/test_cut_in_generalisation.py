"""The oracle was written against a lead-brake scenario. Does it generalise?

`verifiers/adas.py` never inspects ``challenge.kind``. It computes required deceleration
from the observed gap and closing speed and labels a threat from that alone. If that is
genuinely geometry-driven rather than tuned to one manoeuvre, a near-field cut-in must be
classified correctly with no ADAS code change - and a distant one must not.

That claim is cheap to assert and easy to get wrong, which is why it is a test rather than a
sentence in a design document.

Marked ``metadrive`` because every case is a real physics episode.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from hermes.domain.enums import FindingStatus

pytestmark = pytest.mark.metadrive

GATE = Path("config") / "gates.adas.yaml"
NEAR = Path("scenarios") / "adas" / "adas_cut_in_near.yaml"
FAR = Path("scenarios") / "adas" / "adas_cut_in_far.yaml"


def _requires_metadrive(repository_root: Path) -> None:
    if not (repository_root / "third_party" / "metadrive" / "metadrive").is_dir():
        pytest.skip("vendored third_party/metadrive is unavailable")


def _run(repository_root: Path, artifact_root: Path, run_id: str, scenario: Path, config: str):
    from hermes.adas.config import load_adas_config
    from hermes.adas.policy import AdasLongitudinalPolicy
    from hermes.runtime.orchestrator import execute_metadrive_run

    controller = load_adas_config(repository_root / "config" / "adas" / f"{config}.yaml")
    execute_metadrive_run(
        scenario_path=repository_root / scenario,
        gate_config_path=repository_root / GATE,
        seed=7,
        run_id=run_id,
        artifact_root=artifact_root,
        repository_root=repository_root,
        policy_factory=lambda _adapter: AdasLongitudinalPolicy(controller),
    )
    return artifact_root / run_id


def _findings(bundle: Path) -> dict[str, dict]:
    document = json.loads((bundle / "findings.json").read_text(encoding="utf-8"))
    items = document["findings"] if isinstance(document, dict) else document
    return {item["finding_id"]: item for item in items}


def _failing_adas(bundle: Path) -> set[str]:
    return {
        finding_id
        for finding_id, item in _findings(bundle).items()
        if finding_id.startswith("adas.") and item["status"] == FindingStatus.FAIL.value
    }


def test_the_oracle_separates_the_cut_in_pair_by_geometry_alone(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    """Same challenge kind, opposite classification - so the split cannot be kind-driven.

    The near case must carry oracle-labelled threat steps and the far case must carry none.
    If both were labelled the same way, the pair would be testing the manoeuvre rather than
    the geometry, and one of the two scenarios would be redundant.
    """
    _requires_metadrive(repository_root)
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()

    near = _findings(_run(repository_root, artifact_root, "gen-near", NEAR, "baseline"))
    far = _findings(_run(repository_root, artifact_root, "gen-far", FAR, "baseline"))

    near_threat = near["adas.aeb.threat_response"]["measurement"]["value"]
    far_threat = far["adas.aeb.threat_response"]["measurement"]["value"]

    assert near_threat > 0, "the near cut-in must present a genuine threat, or it tests nothing"
    assert far_threat == 0, "the far cut-in must present no threat, or it is not a nominal case"
    assert near["adas.aeb.threat_response"]["status"] == FindingStatus.PASS.value
    assert far["adas.aeb.no_false_intervention"]["status"] == FindingStatus.PASS.value


def test_the_cut_in_pair_is_complementary_rather_than_redundant(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    """Each scenario must *pass* the defect the other one catches.

    The seeded-defect suite already asserts that the near case catches a controller which
    never intervenes, and the far case catches one which intervenes constantly. This asserts
    the other diagonal, which is what makes the pair worth its simulation time: a scenario
    that failed every defective controller would be adding cost without adding information.
    """
    _requires_metadrive(repository_root)
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()

    over_on_near = _run(repository_root, artifact_root, "gen-ob", NEAR, "defect_over_braking")
    none_on_far = _run(repository_root, artifact_root, "gen-na", FAR, "defect_no_aeb")

    assert _failing_adas(over_on_near) == set(), (
        "braking hard at a real threat is correct behaviour; the threat scenario must not "
        "penalise it"
    )
    assert _failing_adas(none_on_far) == set(), (
        "not braking when there is no threat is correct behaviour; the nominal scenario must "
        "not penalise it"
    )
