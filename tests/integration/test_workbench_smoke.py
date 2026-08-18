from __future__ import annotations

import hashlib
import json
import shutil
import sys
from pathlib import Path

import pytest

pytest.importorskip("streamlit")
from streamlit.testing.v1 import AppTest  # noqa: E402

from hermes.evidence.artifacts import REQUIRED_ARTIFACT_FILES
from hermes.review import review_artifact
from hermes.runtime.orchestrator import execute_fake_run

_RETAINED_SELECTIONS = (
    "handoff-phase5-demo",
    "handoff-p1-collision",
    "handoff-p1-conditional",
    "handoff-p2-metadrive",
    "handoff-p3-cutin-baseline",
    "handoff-p3-cutin-shielded",
    "handoff-p3-lead-baseline",
    "handoff-p3-lead-shielded",
    "handoff-p4-fault",
    "phase1-tampered",
)
_PERSISTENT_TEXT = (
    "Origin: NOT_AUTHENTICATED [AUTHENTICITY]",
    "Authorization: NOT_EVALUATED [ASSUMPTION]",
    "Deployment permission: NONE [RESIDUAL_RISK]",
    "Scope: SIMULATION_ONLY [ASSUMPTION]",
    "Authoritative status: NOT_DEFINED [ASSUMPTION]",
    (
        "This is a simulation evidence decision, not an approval or deployment "
        "authorization."
    ),
)
_NON_CAUSAL_COMPARISON_LIMITATION = (
    "Stored deltas are descriptive; comparison alone does not establish challenge "
    "engagement or causal treatment effect"
)


def _app(root: Path) -> AppTest:
    script = (
        "from hermes.workbench.app import main\n"
        f"main(('--artifact-root', {str(root)!r}))\n"
    )
    return AppTest.from_string(script, default_timeout=30).run()


def _hashes(root: Path, selections: tuple[str, ...]) -> dict[str, str]:
    return {
        f"{selection}/{file_name}": hashlib.sha256(
            (root / selection / file_name).read_bytes()
        ).hexdigest()
        for selection in selections
        for file_name in REQUIRED_ARTIFACT_FILES
    }


def _copy_artifacts(
    repository_root: Path,
    tmp_path: Path,
    selections: tuple[str, ...],
) -> Path:
    source_root = repository_root / "artifacts"
    target_root = tmp_path / "artifacts"
    target_root.mkdir()
    for selection in selections:
        shutil.copytree(source_root / selection, target_root / selection)
    return target_root.resolve()


@pytest.fixture
def workbench_root(repository_root: Path, tmp_path: Path) -> Path:
    return _copy_artifacts(repository_root, tmp_path, _RETAINED_SELECTIONS)


def _workflow(app: AppTest, value: str) -> AppTest:
    return app.radio(key="primary_workflow").set_value(value).run(timeout=30)


def _review_section(app: AppTest, value: str) -> AppTest:
    return app.radio(key="review_section").set_value(value).run(timeout=30)


def _verify(app: AppTest, selection: str) -> AppTest:
    app.text_input(key="artifact_selection_draft").input(selection).run(timeout=30)
    return app.button(key="verify_selected_artifact").click().run(timeout=30)


def _compare(app: AppTest, baseline: str, candidate: str) -> AppTest:
    app.text_input(key="comparison_baseline_draft").input(baseline).run(timeout=30)
    app.text_input(key="comparison_candidate_draft").input(candidate).run(timeout=30)
    return app.button(key="compare_stored_evidence").click().run(timeout=30)


def _visible_text(app: AppTest) -> str:
    return "\n".join(
        str(item.value)
        for collection in (
            app.title,
            app.header,
            app.subheader,
            app.text,
            app.caption,
            app.info,
            app.warning,
            app.error,
        )
        for item in collection
    )


def _review_snapshot(root: Path, selection: str) -> dict[str, str]:
    envelope = review_artifact(root, selection)
    return {
        "envelope": envelope.model_dump_json(),
        "gate": envelope.gate.model_dump_json(),
        "findings": json.dumps(
            [item.model_dump(mode="json") for item in envelope.findings],
            sort_keys=True,
        ),
        "event_count": str(envelope.timeline.event_count),
        "track_count": str(len(envelope.timeline.tracks)),
    }


def _assert_persistent_frame(app: AppTest) -> None:
    visible = _visible_text(app)
    for expected in _PERSISTENT_TEXT:
        assert expected in visible


def _assert_no_envelope(app: AppTest) -> None:
    assert all(
        "Envelope" not in type(value).__name__
        for value in app.session_state.filtered_state.values()
    )


def test_workbench_initial_review_flow_requires_explicit_verify_and_has_no_selection(
    workbench_root: Path,
) -> None:
    app = _app(workbench_root)

    assert list(app.exception) == []
    assert app.title[0].value == "Hermes — Simulation Evidence Review"
    assert app.radio(key="primary_workflow").options == [
        "Review",
        "Compare",
        "Evidence limitations",
    ]
    assert app.radio(key="review_section").options == [
        "Select & Verify",
        "Overview",
        "Evidence",
        "Timeline",
        "Provenance",
    ]
    assert app.text_input(key="artifact_selection_draft").value == ""
    assert any("UNVERIFIED" in item.value for item in app.text)
    assert "review_requested" not in app.session_state.filtered_state
    _assert_persistent_frame(app)
    _assert_no_envelope(app)


def test_workbench_review_action_pins_last_submitted_selection_and_recaptures(
    workbench_root: Path,
) -> None:
    app = _verify(_app(workbench_root), "handoff-phase5-demo")

    assert list(app.exception) == []
    assert app.session_state.filtered_state["submitted_artifact_selection"] == (
        "handoff-phase5-demo"
    )
    app.text_input(key="artifact_selection_draft").input("phase1-tampered").run(timeout=30)
    assert app.session_state.filtered_state["submitted_artifact_selection"] == (
        "handoff-phase5-demo"
    )
    app.button(key="verify_selected_artifact").click().run(timeout=30)
    assert app.session_state.filtered_state["submitted_artifact_selection"] == (
        "phase1-tampered"
    )
    assert any("INVALID_EVIDENCE" in item.value for item in app.error)


def test_workbench_timeline_filter_changes_only_visible_tracks(
    workbench_root: Path,
) -> None:
    app = _verify(_app(workbench_root), "handoff-phase5-demo")
    app = _review_section(app, "Timeline")

    assert list(app.exception) == []
    assert app.multiselect[0].value == app.multiselect[0].options
    assert "Event total: 40 [OBSERVED]" in [item.value for item in app.text]
    app.multiselect(key="visible_timeline_tracks").set_value(
        ["candidate_action", "ttc_s"]
    ).run(timeout=30)

    assert list(app.exception) == []
    point_frame = app.dataframe[-1].value
    assert set(point_frame["track ID"]) == {"candidate_action", "ttc_s"}
    assert list(point_frame["track ID"][:4]) == [
        "candidate_action",
        "ttc_s",
        "candidate_action",
        "ttc_s",
    ]
    assert "Event total: 40 [OBSERVED]" in [item.value for item in app.text]
    assert app.session_state.filtered_state["visible_timeline_tracks"] == [
        "candidate_action",
        "ttc_s",
    ]
    assert all(
        "Envelope" not in type(value).__name__
        for value in app.session_state.filtered_state.values()
    )

    app.multiselect(key="visible_timeline_tracks").set_value(["raw_observation"]).run(
        timeout=30
    )
    track_frames = [
        frame.value for frame in app.dataframe if "track ID" in frame.value.columns
    ]
    assert len(track_frames) == 2
    assert all(list(frame["track ID"]) == ["raw_observation"] for frame in track_frames)
    assert "machine value" not in track_frames[-1].columns
    assert track_frames[-1].iloc[0]["availability"] == "NOT_AVAILABLE"

    app.multiselect(key="visible_timeline_tracks").set_value([]).run(timeout=30)
    assert all("track ID" not in frame.value.columns for frame in app.dataframe)
    assert "Event total: 40 [OBSERVED]" in [item.value for item in app.text]

    tracks = app.multiselect(key="visible_timeline_tracks").options
    app.multiselect(key="visible_timeline_tracks").set_value(tracks).run(timeout=30)
    assert app.multiselect(key="visible_timeline_tracks").value == tracks
    point_frame = app.dataframe[-1].value
    assert len(point_frame) == 40 * 10
    assert app.session_state.filtered_state["submitted_artifact_selection"] == (
        "handoff-phase5-demo"
    )


def test_workbench_first_timeline_mount_uses_all_tracks_control_and_projection(
    workbench_root: Path,
) -> None:
    app = _verify(_app(workbench_root), "handoff-phase5-demo")
    # Model the preset widget's first mount after Verify reset state on another page.
    del app.session_state["timeline_preset"]

    app = _review_section(app, "Timeline")

    expected_tracks = [
        "raw_observation",
        "delivered_observation",
        "result_observation",
        "candidate_action",
        "permitted_action",
        "executed_action",
        "override_reasons",
        "observation_fault_reasons",
        "control_fault_reasons",
        "collision_count",
        "offroad",
        "speed_mps",
        "route_progress_pct",
        "ttc_s",
        "policy_latency_ms",
        "verifier_triggering_findings",
    ]
    assert list(app.exception) == []
    assert app.radio(key="timeline_preset").value == "All tracks"
    assert app.multiselect(key="visible_timeline_tracks").options == expected_tracks
    assert app.multiselect(key="visible_timeline_tracks").value == expected_tracks


def test_workbench_findings_renders_recursive_threshold_and_exact_event_drilldown(
    workbench_root: Path,
) -> None:
    app = _verify(_app(workbench_root), "handoff-phase5-demo")
    app = _review_section(app, "Evidence")

    assert list(app.exception) == []
    app.radio(key="finding_group").set_value("Passing required evidence").run(timeout=30)
    app.radio(key="selected_finding_id").set_value("boundary.within_tolerance").run(
        timeout=30
    )
    threshold_frame = next(
        frame.value for frame in app.dataframe if "node path" in frame.value.columns
    )
    assert list(
        threshold_frame.loc[
            threshold_frame["finding ID"] == "boundary.within_tolerance",
            "node path",
        ]
    ) == ["root", "root.0", "root.1", "root.2"]
    app.button(key="inspect_exact_event").click().run(timeout=30)
    drilldown_frame = app.dataframe[-1].value
    assert {"machine value", "exact value", "display value", "unit"}.issubset(
        drilldown_frame.columns
    )
    assert set(drilldown_frame["sequence"]) == {"0"}


def test_workbench_new_review_resets_prior_event_drilldown_until_explicit_inspect(
    workbench_root: Path,
) -> None:
    app = _verify(_app(workbench_root), "handoff-phase5-demo")
    app = _review_section(app, "Evidence")
    app.number_input(key="finding_event_sequence").set_value(1).run(timeout=30)
    app.button(key="inspect_exact_event").click().run(timeout=30)

    assert app.session_state.filtered_state["inspect_event_requested"] is True
    assert app.session_state.filtered_state["finding_event_sequence"] == 1
    prior_drilldown = next(
        frame.value
        for frame in app.dataframe
        if "point availability" in frame.value.columns
    )
    assert set(prior_drilldown["sequence"]) == {"1"}

    app = _review_section(app, "Select & Verify")
    app = _verify(app, "handoff-p1-collision")

    assert list(app.exception) == []
    assert app.session_state.filtered_state["submitted_artifact_selection"] == (
        "handoff-p1-collision"
    )
    assert app.session_state.filtered_state["inspect_event_requested"] is False
    assert app.session_state.filtered_state["finding_event_sequence"] == 0
    assert app.session_state.filtered_state["finding_group"] == "Failed required evidence"
    assert app.session_state.filtered_state["selected_finding_id"] == ""
    assert app.session_state.filtered_state["timeline_preset"] == "All tracks"
    assert app.session_state.filtered_state["timeline_preset_applied"] == ""
    assert app.session_state.filtered_state["selected_timeline_sequence"] == -1
    assert "Selected directory: handoff-p1-collision [OBSERVED]" in _visible_text(app)

    app = _review_section(app, "Evidence")

    assert app.session_state.filtered_state["submitted_artifact_selection"] == (
        "handoff-p1-collision"
    )
    assert not any(
        "point availability" in frame.value.columns for frame in app.dataframe
    )

    app.button(key="inspect_exact_event").click().run(timeout=30)
    fresh_drilldown = next(
        frame.value
        for frame in app.dataframe
        if "point availability" in frame.value.columns
    )
    assert set(fresh_drilldown["sequence"]) == {"0"}


def test_workbench_provenance_renders_inventory_and_safe_diagnostics(
    workbench_root: Path,
) -> None:
    app = _verify(_app(workbench_root), "handoff-phase5-demo")
    app = _review_section(app, "Provenance")

    assert list(app.exception) == []
    inventory_frame = next(
        frame.value for frame in app.dataframe if "file name" in frame.value.columns
    )
    assert tuple(inventory_frame["file name"]) == REQUIRED_ARTIFACT_FILES
    assert {
        "file name",
        "size bytes",
        "file category",
        "SHA-256",
        "digest category",
    }.issubset(inventory_frame.columns)
    assert set(inventory_frame["file category"]) == {"OBSERVED"}
    assert set(inventory_frame["digest category"]) == {"COMPUTED"}
    assert all(len(value) == 64 for value in inventory_frame["SHA-256"])


@pytest.mark.parametrize(
    "selection",
    [
        "handoff-phase5-demo",
        "handoff-p1-collision",
        "handoff-p1-conditional",
        "handoff-p2-metadrive",
        "handoff-p4-fault",
        "phase1-tampered",
    ],
)
def test_workbench_all_review_screens_render_without_exception_and_never_store_envelope(
    workbench_root: Path,
    selection: str,
) -> None:
    app = _verify(_app(workbench_root), selection)

    for screen in app.radio(key="review_section").options:
        app = _review_section(app, screen)
        assert list(app.exception) == []
        _assert_persistent_frame(app)
        _assert_no_envelope(app)
        if screen != "Select & Verify":
            assert f"Selected directory: {selection} [OBSERVED]" in _visible_text(app)


def test_workbench_compatible_and_incompatible_comparison_render_without_chart_claims(
    workbench_root: Path,
) -> None:
    app = _workflow(_app(workbench_root), "Compare")
    app = _compare(app, "handoff-p3-lead-baseline", "handoff-p3-lead-shielded")

    assert list(app.exception) == []
    assert len(app.dataframe) >= 4
    ordered = list(app)
    limitation_index = next(
        index
        for index, item in enumerate(ordered)
        if isinstance(getattr(item, "value", None), str)
        and item.value == _NON_CAUSAL_COMPARISON_LIMITATION
    )
    compatibility_index = next(
        index
        for index, item in enumerate(ordered)
        if hasattr(getattr(item, "value", None), "columns")
        and "label" in item.value.columns
        and "Compatibility" in set(item.value["label"])
    )
    gate_index = next(
        index
        for index, item in enumerate(ordered)
        if isinstance(getattr(item, "value", None), str)
        and item.value == "Gate outcome"
    )
    assert compatibility_index < limitation_index < gate_index
    app.text_input(key="comparison_candidate_draft").input(
        "handoff-p3-cutin-baseline"
    ).run(timeout=30)
    assert app.session_state.filtered_state["submitted_candidate_selection"] == (
        "handoff-p3-lead-shielded"
    )
    app.button(key="compare_stored_evidence").click().run(timeout=30)
    assert any("comparison unavailable" in item.value.lower() for item in app.error)
    ordered = list(app)
    limitation_index = next(
        index
        for index, item in enumerate(ordered)
        if isinstance(getattr(item, "value", None), str)
        and item.value == _NON_CAUSAL_COMPARISON_LIMITATION
    )
    error_index = next(
        index
        for index, item in enumerate(ordered)
        if isinstance(getattr(item, "value", None), str)
        and item.value == "Comparison unavailable"
    )
    dataframe_indices = [
        index
        for index, item in enumerate(ordered)
        if hasattr(getattr(item, "value", None), "columns")
    ]
    assert max(dataframe_indices) < limitation_index < error_index
    all_cells = " ".join(
        str(value)
        for frame in app.dataframe
        for value in frame.value.to_numpy().ravel()
    )
    assert "source_type=" not in all_cells
    assert "dimension ID" not in {
        column for frame in app.dataframe for column in frame.value.columns
    }
    assert all(
        item.value
        not in {
            "Gate outcome",
            "Hard-failure change",
            "What improved",
            "What regressed",
            "What was unchanged",
            "What was not comparable",
            "Evidence availability changes",
            "Advancement interpretation",
            "Descriptive comparison interpretation",
        }
        for item in app.subheader
    )
    assert _NON_CAUSAL_COMPARISON_LIMITATION in _visible_text(app)


def test_comparison_invalid_selection_preserves_last_accepted_submitted_sides(
    workbench_root: Path,
) -> None:
    baseline = "handoff-p3-lead-baseline"
    candidate = "handoff-p3-lead-shielded"
    app = _compare(_workflow(_app(workbench_root), "Compare"), baseline, candidate)
    assert "Minimum TTC improved" in _visible_text(app)

    app.text_input(key="comparison_baseline_draft").input("../outside").run(timeout=30)
    app = app.button(key="compare_stored_evidence").click().run(timeout=30)

    assert list(app.error)
    assert app.session_state.filtered_state["submitted_baseline_selection"] == baseline
    assert app.session_state.filtered_state["submitted_candidate_selection"] == candidate
    assert app.session_state.filtered_state["comparison_requested"] is True
    assert f"Submitted baseline: {baseline} [OBSERVED]" in _visible_text(app)
    assert f"Submitted candidate: {candidate} [OBSERVED]" in _visible_text(app)
    assert "Minimum TTC improved" in _visible_text(app)


@pytest.mark.parametrize(
    ("baseline", "candidate", "side"),
    [
        ("phase1-tampered", "handoff-phase5-demo", "BASELINE"),
        ("handoff-phase5-demo", "phase1-tampered", "CANDIDATE"),
        ("phase1-tampered", "phase1-tampered", "BASELINE"),
    ],
)
def test_workbench_invalid_comparison_identifies_side_and_quarantines_claims(
    workbench_root: Path,
    baseline: str,
    candidate: str,
    side: str,
) -> None:
    app = _workflow(_app(workbench_root), "Compare")
    app = _compare(app, baseline, candidate)

    assert list(app.exception) == []
    assert any(side in item.value and "INVALID_EVIDENCE" in item.value for item in app.error)
    visible = _visible_text(app)
    assert "Gate verdict: INVALID_EVIDENCE [GATE_DECISION]" in visible
    assert "Evidence integrity: INVALID_EVIDENCE [COMPUTED]" in visible


def test_workbench_review_and_comparison_preserve_every_source_bundle_byte(
    workbench_root: Path,
) -> None:
    selections = (
        "handoff-phase5-demo",
        "phase1-tampered",
        "handoff-p3-lead-baseline",
        "handoff-p3-lead-shielded",
    )
    before = _hashes(workbench_root, selections)
    app = _verify(_app(workbench_root), selections[0])
    app = _review_section(app, "Timeline")
    app.number_input(key="timeline_page").increment().run(timeout=30)
    app = _workflow(app, "Compare")
    app = _compare(app, selections[2], selections[3])

    assert list(app.exception) == []
    assert _hashes(workbench_root, selections) == before


def test_workbench_active_rerun_recaptures_mutated_bundle_and_invalidates_review(
    workbench_root: Path,
) -> None:
    selection = "handoff-phase5-demo"
    app = _verify(_app(workbench_root), selection)
    assert list(app.exception) == []
    assert not any("INVALID_EVIDENCE" in item.value for item in app.error)

    metrics_path = workbench_root / selection / "metrics.json"
    metrics_path.write_bytes(metrics_path.read_bytes() + b"\n")
    app = _review_section(app, "Overview")

    assert list(app.exception) == []
    assert any("INVALID_EVIDENCE" in item.value for item in app.error)
    assert all(
        "Envelope" not in type(value).__name__
        for value in app.session_state.filtered_state.values()
    )


def test_workbench_apptest_performs_no_network_browser_or_child_process(
    workbench_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import socket
    import subprocess
    import webbrowser

    def bomb(*args: object, **kwargs: object) -> object:
        raise AssertionError("workbench AppTest attempted forbidden external action")

    monkeypatch.setattr(socket, "create_connection", bomb)
    monkeypatch.setattr(socket.socket, "bind", bomb)
    monkeypatch.setattr(socket.socket, "connect", bomb)
    monkeypatch.setattr(subprocess, "run", bomb)
    monkeypatch.setattr(subprocess, "Popen", bomb)
    monkeypatch.setattr(webbrowser, "open", bomb)

    app = _verify(_app(workbench_root), "handoff-phase5-demo")
    app = _workflow(app, "Compare")
    app = _compare(app, "handoff-p3-lead-baseline", "handoff-p3-lead-shielded")

    assert list(app.exception) == []


def test_workbench_apptest_bombs_runtime_simulator_policy_and_adapter_imports(
    workbench_root: Path,
) -> None:
    script = f"""
import importlib.abc
import sys

PREFIXES = (
    'hermes.adapters', 'hermes.policies', 'hermes.runtime', 'metadrive',
)

class Blocked(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if any(fullname == prefix or fullname.startswith(prefix + '.') for prefix in PREFIXES):
            raise RuntimeError('forbidden import: ' + fullname)
        return None

sys.meta_path.insert(0, Blocked())
from hermes.workbench.app import main
main(('--artifact-root', {str(workbench_root)!r}))
"""
    # AppTest.from_string executes the script in this process, so the script's
    # meta-path blocker would otherwise leak into every later test in the session
    # and fail any legitimate adapter, policy, runtime, or MetaDrive import.
    original_meta_path = list(sys.meta_path)
    try:
        app = AppTest.from_string(script, default_timeout=30).run()
        app = _verify(app, "handoff-phase5-demo")
        app = _review_section(app, "Timeline")

        assert list(app.exception) == []
    finally:
        sys.meta_path[:] = original_meta_path


def test_workbench_information_architecture_uses_workflow_then_review_section(
    workbench_root: Path,
) -> None:
    app = _app(workbench_root)

    assert app.radio(key="primary_workflow").options == [
        "Review",
        "Compare",
        "Evidence limitations",
    ]
    assert app.radio(key="review_section").options == [
        "Select & Verify",
        "Overview",
        "Evidence",
        "Timeline",
        "Provenance",
    ]
    assert app.button(key="verify_selected_artifact").label == "Verify selected artifact"


def test_selected_artifact_identity_persists_across_all_review_sections(
    workbench_root: Path,
) -> None:
    app = _verify(_app(workbench_root), "handoff-phase5-demo")
    manifest_run_id = review_artifact(
        workbench_root, "handoff-phase5-demo"
    ).artifact.manifest_identity.run_id

    for section in app.radio(key="review_section").options:
        app = _review_section(app, section)
        visible = _visible_text(app)
        assert "Selected directory: handoff-phase5-demo [OBSERVED]" in visible
        assert f"Manifest run ID: {manifest_run_id} [OBSERVED]" in visible
        _assert_no_envelope(app)


@pytest.mark.parametrize(
    ("selection", "verdict", "integrity"),
    [
        ("handoff-phase5-demo", "PASS", "INTERNALLY_CONSISTENT"),
        ("handoff-p1-collision", "HOLD", "INTERNALLY_CONSISTENT"),
        ("phase1-tampered", "INVALID_EVIDENCE", "INVALID_EVIDENCE"),
    ],
)
def test_persistent_trust_strip_separates_decision_state_from_authority_boundaries(
    workbench_root: Path,
    selection: str,
    verdict: str,
    integrity: str,
) -> None:
    app = _review_section(_verify(_app(workbench_root), selection), "Overview")
    visible = _visible_text(app)

    assert "Decision state" in visible
    assert f"Gate verdict: {verdict} [GATE_DECISION]" in visible
    assert f"Evidence integrity: {integrity} [COMPUTED]" in visible
    assert "Authority boundaries" in visible
    _assert_persistent_frame(app)


def test_selection_workflow_is_empty_lexical_and_requires_explicit_verification(
    workbench_root: Path,
) -> None:
    app = _app(workbench_root)
    assert app.text_input(key="artifact_selection_draft").value == ""
    assert "handoff-phase5-demo" in _visible_text(app)
    assert "review_requested" not in app.session_state.filtered_state

    app.text_input(key="artifact_selection_draft").input("handoff-phase5-demo").run(
        timeout=30
    )
    assert "review_requested" not in app.session_state.filtered_state
    app = app.button(key="verify_selected_artifact").click().run(timeout=30)
    assert app.session_state.filtered_state["submitted_artifact_selection"] == (
        "handoff-phase5-demo"
    )
    app.text_input(key="artifact_selection_draft").input("../outside").run(timeout=30)
    app = app.button(key="verify_selected_artifact").click().run(timeout=30)
    assert app.session_state.filtered_state["submitted_artifact_selection"] == (
        "handoff-phase5-demo"
    )
    assert "Selected directory: handoff-phase5-demo [OBSERVED]" in _visible_text(app)
    assert list(app.error)
    app.text_input(key="artifact_selection_draft").input("handoff-p1-collision").run(
        timeout=30
    )
    assert app.session_state.filtered_state["submitted_artifact_selection"] == (
        "handoff-phase5-demo"
    )


@pytest.mark.parametrize(
    ("selection", "verdict"),
    [("handoff-phase5-demo", "PASS"), ("handoff-p1-collision", "HOLD")],
)
def test_overview_orders_identity_gate_rationale_integrity_sufficiency_limitations_then_technical_identity(  # noqa: E501
    workbench_root: Path,
    selection: str,
    verdict: str,
) -> None:
    app = _review_section(_verify(_app(workbench_root), selection), "Overview")
    headings = [item.value for item in app.subheader]

    assert headings == [
        "Artifact reviewed",
        "Gate decision",
        "Why",
        "Integrity",
        "Required unavailable evidence",
        "What this does not establish",
        "Technical identity",
    ]
    assert f"Gate verdict: {verdict} [GATE_DECISION]" in _visible_text(app)
    all_cells = " ".join(
        str(value)
        for frame in app.dataframe
        for value in frame.value.to_numpy().ravel()
    )
    assert "Observed bundle digest" not in all_cells


def test_evidence_screen_renders_grouped_first_pass_rows_and_exact_details_on_inspection(
    workbench_root: Path,
) -> None:
    app = _review_section(_verify(_app(workbench_root), "handoff-p1-collision"), "Evidence")

    assert app.radio(key="finding_group").options == [
        "Failed required evidence",
        "Required but unavailable",
        "Soft failures and warnings",
        "Passing required evidence",
        "Optional evidence",
        "Not applicable",
    ]
    assert app.radio(key="finding_group").value == "Failed required evidence"
    compact = next(
        frame.value
        for frame in app.dataframe
        if "first supporting event" in frame.value.columns
    )
    assert list(compact["finding ID"]) == ["collision.zero", "progress.required"]
    detail = next(
        frame.value
        for frame in app.dataframe
        if "verifier version" in frame.value.columns
        and "supporting sequences" in frame.value.columns
    )
    assert detail.iloc[0]["finding ID"] == "collision.zero"
    assert detail.iloc[0]["supporting sequences"] == "12"
    assert app.button(key="jump_to_timeline").label == (
        "Open first supporting event in Timeline"
    )


def test_failed_required_group_remains_visible_after_evidence_filter_changes(
    workbench_root: Path,
) -> None:
    app = _review_section(_verify(_app(workbench_root), "handoff-p1-collision"), "Evidence")
    app = app.radio(key="finding_group").set_value("Optional evidence").run(timeout=30)

    finding_frames = [
        frame.value for frame in app.dataframe if "finding ID" in frame.value.columns
    ]
    visible_ids = [
        value
        for frame in finding_frames
        for value in frame["finding ID"]
    ]
    assert "collision.zero" in visible_ids
    assert visible_ids.count("collision.zero") == 1
    assert "Canonical accepted finding total: 6 [COMPUTED]" in _visible_text(app)


def test_workbench_timeline_preset_and_finding_jump_preserve_review_snapshot(
    workbench_root: Path,
) -> None:
    selection = "handoff-p1-collision"
    before = _review_snapshot(workbench_root, selection)
    app = _review_section(_verify(_app(workbench_root), selection), "Evidence")
    app = app.button(key="jump_to_timeline").click().run(timeout=30)

    assert app.radio(key="review_section").value == "Timeline"
    assert app.radio(key="timeline_preset").value == "Decision evidence"
    assert app.number_input(key="timeline_page").value == 1
    assert app.session_state.filtered_state["selected_timeline_sequence"] == 12
    assert app.multiselect(key="visible_timeline_tracks").value == [
        "collision_count",
        "verifier_triggering_findings",
    ]
    selected = next(
        frame.value
        for frame in app.dataframe
        if "point source reference" in frame.value.columns
    )
    assert set(selected["sequence"]) == {"12"}
    event_sources = selected.loc[
        selected["track ID"] != "verifier_triggering_findings",
        "point source reference",
    ]
    assert all("source_type=EVENT" in value for value in event_sources)
    assert all("event_sequence=12" in value for value in event_sources)
    assert _review_snapshot(workbench_root, selection) == before
    _assert_no_envelope(app)


def test_invalid_verify_resets_all_presentation_state_and_retains_last_accepted_review(
    workbench_root: Path,
) -> None:
    selection = "handoff-p1-collision"
    app = _review_section(_verify(_app(workbench_root), selection), "Evidence")
    app.radio(key="finding_group").set_value("Optional evidence").run(timeout=30)
    app.radio(key="selected_finding_id").set_value("comfort.jerk").run(timeout=30)
    app.number_input(key="finding_event_sequence").set_value(3).run(timeout=30)
    app.button(key="inspect_exact_event").click().run(timeout=30)
    app = _review_section(app, "Timeline")
    app.radio(key="timeline_preset").set_value("Action accountability").run(timeout=30)
    app.multiselect(key="visible_timeline_tracks").set_value(["executed_action"]).run(
        timeout=30
    )
    app.session_state["selected_timeline_sequence"] = 12

    app = _review_section(app, "Select & Verify")
    app.text_input(key="artifact_selection_draft").input("../outside").run(timeout=30)
    app = app.button(key="verify_selected_artifact").click().run(timeout=30)

    state = app.session_state.filtered_state
    assert list(app.error)
    assert state["submitted_artifact_selection"] == selection
    assert state["review_requested"] is True
    assert state["finding_group"] == "Failed required evidence"
    assert state["selected_finding_id"] == ""
    assert state["finding_event_sequence"] == 0
    assert state["inspect_event_requested"] is False
    assert state["timeline_preset"] == "All tracks"
    assert state["timeline_preset_applied"] == ""
    assert state["visible_timeline_tracks"] == [
        "raw_observation",
        "delivered_observation",
        "result_observation",
        "candidate_action",
        "permitted_action",
        "executed_action",
        "override_reasons",
        "observation_fault_reasons",
        "control_fault_reasons",
        "collision_count",
        "offroad",
        "speed_mps",
        "route_progress_pct",
        "ttc_s",
        "policy_latency_ms",
        "verifier_triggering_findings",
    ]
    assert state["timeline_page"] == 1
    assert state["selected_timeline_sequence"] == -1
    assert f"Selected directory: {selection} [OBSERVED]" in _visible_text(app)


@pytest.mark.parametrize(
    ("baseline", "candidate"),
    [
        ("handoff-p3-lead-baseline", "handoff-p3-lead-shielded"),
        ("handoff-p3-cutin-baseline", "handoff-p3-cutin-shielded"),
    ],
)
def test_compatible_comparison_requires_explicit_mixed_outcome_synthesis_without_winner(
    workbench_root: Path,
    baseline: str,
    candidate: str,
) -> None:
    app = _compare(_workflow(_app(workbench_root), "Compare"), baseline, candidate)
    headings = [item.value for item in app.subheader]

    assert headings[:8] == [
        "Gate outcome",
        "Hard-failure change",
        "What improved",
        "What regressed",
        "What was unchanged",
        "What was not comparable",
        "Evidence availability changes",
        "Descriptive comparison interpretation",
    ]
    visible = _visible_text(app)
    assert _NON_CAUSAL_COMPARISON_LIMITATION in visible
    assert "Advancement interpretation" not in headings
    assert (
        "Minimum TTC improved. Route completion, acceleration, and jerk regressed. "
        "The gate verdict did not improve. This is a mixed trade-off and does not "
        "establish overall advancement."
    ) in visible
    assert "winner" not in visible.lower()
    assert "overall safety score" not in visible.lower()
    for forbidden in ("ranked candidate", "candidate is safer", "recommended policy"):
        assert forbidden not in visible.lower()
    for forbidden in (
        "the challenge engaged",
        "the shield caused",
        "caused the higher",
        "causal effect was established",
    ):
        assert forbidden not in visible.lower()
    assert not any(
        "adequacy" in key.lower()
        for key in app.session_state.filtered_state
    )


def test_invalid_evidence_quarantine_hides_accepted_gate_findings_metrics_timeline_and_provenance(
    workbench_root: Path,
) -> None:
    app = _review_section(_verify(_app(workbench_root), "phase1-tampered"), "Provenance")
    visible = _visible_text(app)
    all_columns = {
        column for frame in app.dataframe for column in frame.value.columns
    }

    assert "Invalid evidence quarantine" in visible
    assert "Confirm the intended directory" in visible
    assert "first mismatch" in visible.lower()
    assert "finding ID" not in all_columns
    assert "metric ID" not in all_columns
    assert "track ID" not in all_columns
    assert "file name" not in all_columns
    assert "Recorded provenance" not in visible
    assert "Accepted gate rationale" not in visible
    assert "Configured illustrative prototype criteria passed" not in visible
    assert "TraceIntegrityVerifier" not in visible
    assert "collision count 0 meets required maximum" not in visible
    partial_identity = next(
        frame.value
        for frame in app.dataframe
        if "Selected relative path" in set(frame.value["label"])
    )
    assert "category" in partial_identity.columns
    assert set(partial_identity["category"]).issubset({"OBSERVED", "NOT_AVAILABLE"})


def test_invalid_evidence_quarantine_is_consistent_across_every_review_section(
    workbench_root: Path,
) -> None:
    app = _verify(_app(workbench_root), "phase1-tampered")

    for section in app.radio(key="review_section").options:
        app = _review_section(app, section)
        visible = _visible_text(app)
        columns = {column for frame in app.dataframe for column in frame.value.columns}
        assert "INVALID_EVIDENCE — Invalid evidence quarantine" in visible
        assert "Gate verdict: INVALID_EVIDENCE [GATE_DECISION]" in visible
        assert "Confirm the intended directory" in visible
        assert {"finding ID", "metric ID", "track ID", "file name"}.isdisjoint(columns)
        assert "Recorded provenance" not in visible
        _assert_no_envelope(app)


def test_phase7_availability_fixture_workbench_matches_review_envelope(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    root = tmp_path / "artifacts"
    root.mkdir()
    run_id = "handoff-p7-evidence-availability"
    execute_fake_run(
        scenario_path=repository_root / "scenarios" / "fake_evidence_availability.yaml",
        gate_config_path=repository_root / "config" / "gates.phase1.yaml",
        seed=7,
        run_id=run_id,
        artifact_root=root,
        repository_root=repository_root,
    )
    envelope = review_artifact(root, run_id)
    before = _hashes(root, (run_id,))

    app = _review_section(_verify(_app(root.resolve()), run_id), "Evidence")
    assert list(app.exception) == []
    visible = _visible_text(app)
    assert "Gate verdict: HOLD [GATE_DECISION]" in visible
    assert "Canonical accepted finding total: 6 [COMPUTED]" in visible
    frames = [frame.value for frame in app.dataframe]
    sufficiency = next(frame for frame in frames if "evidence ID" in frame.columns)
    progress = sufficiency.loc[sufficiency["evidence ID"] == "progress.required"].iloc[0]
    jerk = sufficiency.loc[sufficiency["evidence ID"] == "comfort.jerk"].iloc[0]
    not_applicable = sufficiency.loc[
        sufficiency["evidence ID"] == "fault.coverage.required"
    ].iloc[0]
    assert progress["availability"] == "NOT_AVAILABLE"
    assert progress["reason"] == "route progress explicitly unavailable"
    assert progress["gate consequence"] == "CONFIGURED_MISSING_REQUIRED_EVIDENCE"
    assert jerk["availability"] == "NOT_AVAILABLE"
    assert jerk["reason"] == "at least two events are required to compute jerk"
    assert jerk["gate consequence"] == "CONDITIONAL"
    assert not_applicable["availability"] == "NOT_APPLICABLE"
    assert not_applicable["reason"] == "Not applicable to the legacy verifier profile"

    metrics = next(frame for frame in frames if "metric ID" in frame.columns)
    for metric_id, reason in (
        ("route_completion_pct", "route progress explicitly unavailable"),
        (
            "minimum_ttc_s",
            "front-object TTC evidence is unavailable for this trace",
        ),
        (
            "max_abs_jerk_mps3",
            "at least two events are required to compute jerk",
        ),
    ):
        row = metrics.loc[metrics["metric ID"] == metric_id].iloc[0]
        assert row["availability"] == "NOT_AVAILABLE"
        assert row["unavailable reason"] == reason

    app = _review_section(app, "Timeline")
    assert list(app.exception) == []
    assert "Event total: 1 [OBSERVED]" in _visible_text(app)
    assert "Track total: 16; available tracks: 10 [OBSERVED]" in _visible_text(app)
    frames = [frame.value for frame in app.dataframe]
    metadata = next(
        frame
        for frame in frames
        if {"track ID", "source reference count", "availability"}.issubset(frame.columns)
    )
    unavailable = metadata.loc[metadata["availability"] == "NOT_AVAILABLE"]
    assert set(unavailable["track ID"]) == {
        "raw_observation",
        "delivered_observation",
        "result_observation",
        "permitted_action",
        "observation_fault_reasons",
        "control_fault_reasons",
    }
    points = next(
        frame
        for frame in frames
        if {"track ID", "sequence", "display value", "unavailable reason"}.issubset(
            frame.columns
        )
    )
    route = points.loc[points["track ID"] == "route_progress_pct"].iloc[0]
    assert route["availability"] == "NOT_AVAILABLE"
    assert route["display value"] == "NOT_AVAILABLE"
    assert route["unavailable reason"] == "route progress explicitly unavailable"
    ttc = points.loc[points["track ID"] == "ttc_s"].iloc[0]
    assert ttc["availability"] == "NOT_AVAILABLE"
    assert ttc["unavailable reason"] == "no paired closing front-object evidence"
    assert _hashes(root, (run_id,)) == before
    assert envelope.model_dump_json() == review_artifact(root, run_id).model_dump_json()
