"""The evaluation must catch controllers that are broken on purpose.

This is the acceptance test for the gate and the triage agent together, and it is the one
test in the repository designed to fail if the *evaluation* regresses rather than if the
controller does.

It also produces the agent-quality metric: the proportion of seeded defects for which the
triage agent proposed the correct failure category. That number is computed deterministically
from stored evidence, so it is a measurement rather than an impression.

Marked ``metadrive`` because each case is a real physics episode.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from hermes.adas.seeded_defects import load_seeded_defects
from hermes.agents import ToolContext, triage_run
from hermes.domain.enums import FindingStatus, Verdict

pytestmark = pytest.mark.metadrive

SUITE = Path("config") / "phase8-seeded-defects.yaml"
GATE = Path("config") / "gates.adas.yaml"


def _requires_metadrive(repository_root: Path) -> None:
    if not (repository_root / "third_party" / "metadrive" / "metadrive").is_dir():
        pytest.skip("vendored third_party/metadrive is unavailable")


def _run(repository_root: Path, artifact_root: Path, run_id: str, defect) -> Path:
    from hermes.adas.config import load_adas_config
    from hermes.adas.policy import AdasLongitudinalPolicy
    from hermes.runtime.orchestrator import execute_metadrive_run

    config = load_adas_config(repository_root / defect.policy_config)
    execute_metadrive_run(
        scenario_path=repository_root / defect.scenario,
        gate_config_path=repository_root / GATE,
        seed=7,
        run_id=run_id,
        artifact_root=artifact_root,
        repository_root=repository_root,
        policy_factory=lambda _adapter: AdasLongitudinalPolicy(config),
    )
    return artifact_root / run_id


def _findings(bundle: Path) -> dict[str, dict]:
    document = json.loads((bundle / "findings.json").read_text(encoding="utf-8"))
    items = document["findings"] if isinstance(document, dict) else document
    return {item["finding_id"]: item for item in items}


def test_the_baseline_controller_passes_every_hard_adas_finding(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    """The control case. Without it, "the gate caught it" could just mean "the gate always fails"."""
    _requires_metadrive(repository_root)
    from hermes.adas.seeded_defects import SeededDefect

    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()
    for index, scenario in enumerate(
        ("scenarios/adas/aeb_lead_hard_brake.yaml", "scenarios/adas/adas_nominal_slow_closing.yaml")
    ):
        baseline = SeededDefect(
            defect_id="baseline",
            description="Reference controller.",
            policy_config="config/adas/baseline.yaml",
            scenario=scenario,
            expected_failing_finding="none",
            expected_triage_category="NO_FAILURE",
        )
        bundle = _run(repository_root, artifact_root, f"baseline-{index}", baseline)
        findings = _findings(bundle)

        failing_adas = [
            finding_id
            for finding_id, item in findings.items()
            if finding_id.startswith("adas") and item["status"] == FindingStatus.FAIL.value
        ]
        assert failing_adas == [], f"{scenario}: {failing_adas}"


@pytest.mark.parametrize(
    "defect_id", ["late_braking", "no_aeb", "over_braking"]
)
def test_each_seeded_defect_is_caught_by_its_own_criterion(
    repository_root: Path,
    tmp_path: Path,
    defect_id: str,
) -> None:
    """Not merely "the run failed" - the *named* finding for that defect must fail.

    A defect that trips some unrelated invariant is caught by luck. Requiring the specific
    criterion is what shows the evaluation discriminates between failure modes rather than
    just registering that something went wrong.
    """
    _requires_metadrive(repository_root)
    suite = load_seeded_defects(repository_root / SUITE)
    defect = next(item for item in suite.defects if item.defect_id == defect_id)
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()

    run_id = f"defect-{defect_id.replace('_', '-')}"
    bundle = _run(repository_root, artifact_root, run_id, defect)
    findings = _findings(bundle)
    verdict = json.loads((bundle / "verdict.json").read_text(encoding="utf-8"))["verdict"]

    assert defect.expected_failing_finding in findings
    assert findings[defect.expected_failing_finding]["status"] == FindingStatus.FAIL.value
    assert verdict in {Verdict.HOLD.value, Verdict.CONDITIONAL.value}


def test_triage_proposes_the_correct_category_for_every_seeded_defect(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    """The agent-quality metric: proposals scored against a deterministic ground truth.

    "The triage agent is helpful" is an opinion. "The triage agent proposed the correct
    category for 3 of 3 seeded defects, and the deterministic classifier agreed in every
    case" is a number, recomputable from stored evidence by anyone.
    """
    _requires_metadrive(repository_root)
    suite = load_seeded_defects(repository_root / SUITE)
    artifact_root = tmp_path / "artifacts"
    artifact_root.mkdir()
    context = ToolContext(repository_root=repository_root, artifact_root=artifact_root)

    correct = 0
    for defect in suite.defects:
        run_id = f"triage-{defect.defect_id.replace('_', '-')}"
        _run(repository_root, artifact_root, run_id, defect)
        proposal = triage_run(context, run_id)

        assert proposal.deterministic_category.value == defect.expected_triage_category, (
            f"{defect.defect_id}: deterministic classifier said "
            f"{proposal.deterministic_category.value}"
        )
        assert proposal.citations, f"{defect.defect_id}: proposal carries no citations"
        if proposal.category.value == defect.expected_triage_category:
            correct += 1

    assert correct == len(suite.defects), f"triage accuracy {correct}/{len(suite.defects)}"
