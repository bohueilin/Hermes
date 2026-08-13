from __future__ import annotations

import hashlib
import shutil
from pathlib import Path

import pytest

pytest.importorskip("streamlit")
from streamlit.testing.v1 import AppTest  # noqa: E402

from hermes.evidence.artifacts import REQUIRED_ARTIFACT_FILES

_RETAINED_SELECTIONS = (
    "handoff-phase5-demo",
    "handoff-p1-collision",
    "handoff-p1-conditional",
    "handoff-p2-metadrive",
    "handoff-p3-cutin-baseline",
    "handoff-p3-lead-baseline",
    "handoff-p3-lead-shielded",
    "handoff-p4-fault",
    "phase1-tampered",
)
_PERSISTENT_TEXT = (
    "Evidence authenticity: NOT_AUTHENTICATED [AUTHENTICITY]",
    "Authorization status: NOT_EVALUATED [ASSUMPTION]",
    "Deployment permission: NONE [RESIDUAL_RISK]",
    "Scope: SIMULATION_ONLY [ASSUMPTION]",
    "Authoritative status: NOT_DEFINED [ASSUMPTION]",
    (
        "A Hermes PASS is only the installed prototype gate verdict for this bounded "
        "simulation. [RESIDUAL_RISK]"
    ),
    "Internal consistency is not independent authenticity. [AUTHENTICITY]",
    (
        "Stored verification does not reexecute the policy or simulator. "
        "[RESIDUAL_RISK]"
    ),
    "Simulation evidence grants no physical-system permission. [RESIDUAL_RISK]",
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


def _select_screen(app: AppTest, screen: str) -> AppTest:
    return app.radio[0].set_value(screen).run(timeout=30)


def _submit_review(app: AppTest, selection: str) -> AppTest:
    app.text_input[0].input(selection).run(timeout=30)
    return app.button[0].click().run(timeout=30)


def _assert_persistent_frame(app: AppTest) -> None:
    assert tuple(item.value for item in app.text[: len(_PERSISTENT_TEXT)]) == (
        _PERSISTENT_TEXT
    )


def test_workbench_initial_state_requires_explicit_verify_and_has_six_screens(
    workbench_root: Path,
) -> None:
    app = _app(workbench_root)

    assert list(app.exception) == []
    assert app.title[0].value == "Hermes — Simulation Evidence Review"
    assert app.radio[0].options == [
        "Intake / verification",
        "Review summary / trust",
        "Findings / evidence coverage",
        "Timeline",
        "Provenance / integrity / limitations",
        "Compatible comparison",
    ]
    assert app.text_input[0].value == ""
    assert any("UNVERIFIED" in item.value for item in app.text)
    assert "review_requested" not in app.session_state.filtered_state
    _assert_persistent_frame(app)


def test_workbench_review_action_pins_last_submitted_selection_and_recaptures(
    workbench_root: Path,
) -> None:
    app = _submit_review(_app(workbench_root), "handoff-phase5-demo")

    assert list(app.exception) == []
    assert app.session_state.filtered_state["submitted_artifact_selection"] == (
        "handoff-phase5-demo"
    )
    app.text_input[0].input("phase1-tampered").run(timeout=30)
    assert app.session_state.filtered_state["submitted_artifact_selection"] == (
        "handoff-phase5-demo"
    )
    app.button[0].click().run(timeout=30)
    assert app.session_state.filtered_state["submitted_artifact_selection"] == (
        "phase1-tampered"
    )
    assert any("INVALID_EVIDENCE" in item.value for item in app.error)


def test_workbench_timeline_filter_changes_only_visible_tracks(
    workbench_root: Path,
) -> None:
    app = _submit_review(_app(workbench_root), "handoff-phase5-demo")
    app = _select_screen(app, "Timeline")

    assert list(app.exception) == []
    assert app.multiselect[0].value == app.multiselect[0].options
    assert "Event total: 40 [OBSERVED]" in [item.value for item in app.text]
    app.multiselect[0].set_value(["candidate_action", "ttc_s"]).run(timeout=30)

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

    app.multiselect[0].set_value(["raw_observation"]).run(timeout=30)
    track_frames = [
        frame.value for frame in app.dataframe if "track ID" in frame.value.columns
    ]
    assert len(track_frames) == 2
    assert all(list(frame["track ID"]) == ["raw_observation"] for frame in track_frames)
    assert "machine value" not in track_frames[-1].columns
    assert track_frames[-1].iloc[0]["availability"] == "NOT_AVAILABLE"

    app.multiselect[0].set_value([]).run(timeout=30)
    assert all("track ID" not in frame.value.columns for frame in app.dataframe)
    assert "Event total: 40 [OBSERVED]" in [item.value for item in app.text]

    app.multiselect[0].set_value(app.multiselect[0].options).run(timeout=30)
    assert app.multiselect[0].value == app.multiselect[0].options
    point_frame = app.dataframe[-1].value
    assert len(point_frame) == 40 * 10
    assert app.session_state.filtered_state["submitted_artifact_selection"] == (
        "handoff-phase5-demo"
    )


def test_workbench_findings_renders_recursive_threshold_and_exact_event_drilldown(
    workbench_root: Path,
) -> None:
    app = _submit_review(_app(workbench_root), "handoff-phase5-demo")
    app = _select_screen(app, "Findings / evidence coverage")

    assert list(app.exception) == []
    threshold_frame = next(
        frame.value for frame in app.dataframe if "node path" in frame.value.columns
    )
    assert list(
        threshold_frame.loc[
            threshold_frame["finding ID"] == "boundary.within_tolerance",
            "node path",
        ]
    ) == ["root", "root.0", "root.1", "root.2"]
    app.button[0].click().run(timeout=30)
    drilldown_frame = app.dataframe[-1].value
    assert {"machine value", "exact value", "display value", "unit"}.issubset(
        drilldown_frame.columns
    )
    assert set(drilldown_frame["sequence"]) == {"0"}


def test_workbench_new_review_resets_prior_event_drilldown_until_explicit_inspect(
    workbench_root: Path,
) -> None:
    app = _submit_review(_app(workbench_root), "handoff-phase5-demo")
    app = _select_screen(app, "Findings / evidence coverage")
    app.number_input[0].set_value(1).run(timeout=30)
    app.button[0].click().run(timeout=30)

    assert app.session_state.filtered_state["inspect_event_requested"] is True
    assert app.session_state.filtered_state["finding_event_sequence"] == 1
    prior_drilldown = next(
        frame.value
        for frame in app.dataframe
        if "point availability" in frame.value.columns
    )
    assert set(prior_drilldown["sequence"]) == {"1"}

    app = _select_screen(app, "Intake / verification")
    app = _submit_review(app, "handoff-p1-collision")

    assert list(app.exception) == []
    assert app.session_state.filtered_state["submitted_artifact_selection"] == (
        "handoff-p1-collision"
    )
    assert app.session_state.filtered_state["inspect_event_requested"] is False
    assert app.session_state.filtered_state["finding_event_sequence"] == 0
    identity_frame = next(
        frame.value
        for frame in app.dataframe
        if "label" in frame.value.columns
        and "Selected relative path" in set(frame.value["label"])
    )
    assert identity_frame.loc[
        identity_frame["label"] == "Selected relative path", "value"
    ].item() == "handoff-p1-collision"

    app = _select_screen(app, "Findings / evidence coverage")

    assert app.session_state.filtered_state["submitted_artifact_selection"] == (
        "handoff-p1-collision"
    )
    assert not any(
        "point availability" in frame.value.columns for frame in app.dataframe
    )

    app.button[0].click().run(timeout=30)
    fresh_drilldown = next(
        frame.value
        for frame in app.dataframe
        if "point availability" in frame.value.columns
    )
    assert set(fresh_drilldown["sequence"]) == {"0"}


@pytest.mark.parametrize("selection", ["handoff-phase5-demo", "phase1-tampered"])
def test_workbench_provenance_renders_inventory_and_safe_diagnostics(
    workbench_root: Path,
    selection: str,
) -> None:
    app = _submit_review(_app(workbench_root), selection)
    app = _select_screen(app, "Provenance / integrity / limitations")

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
    if selection == "phase1-tampered":
        assert any("quarantined" in item.value.lower() for item in app.warning)
        provenance_status = next(
            frame.value
            for frame in app.dataframe
            if "label" in frame.value.columns
            and list(frame.value["label"]) == ["status"]
        )
        assert provenance_status.iloc[0]["value"] == "QUARANTINED"
        assert provenance_status.iloc[0]["availability"] == "NOT_AVAILABLE"
        assert provenance_status.iloc[0]["category"] == "NOT_AVAILABLE"
        diagnostic_frame = next(
            frame.value for frame in app.dataframe if "code" in frame.value.columns
        )
        assert len(diagnostic_frame) > 0
        all_cells = " ".join(
            str(value)
            for frame in app.dataframe
            for value in frame.value.to_numpy().ravel()
        )
        assert "None" not in all_cells


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
    app = _submit_review(_app(workbench_root), selection)

    for screen in app.radio[0].options[:-1]:
        app = _select_screen(app, screen)
        assert list(app.exception) == []
        _assert_persistent_frame(app)
        assert all(
            "Envelope" not in type(value).__name__
            for value in app.session_state.filtered_state.values()
        )
        if screen != "Intake / verification":
            assert len(app.dataframe) >= 1


def test_workbench_compatible_and_incompatible_comparison_render_without_chart_claims(
    workbench_root: Path,
) -> None:
    app = _select_screen(_app(workbench_root), "Compatible comparison")
    app.text_input[0].input("handoff-p3-lead-baseline").run(timeout=30)
    app.text_input[1].input("handoff-p3-lead-shielded").run(timeout=30)
    app.button[0].click().run(timeout=30)

    assert list(app.exception) == []
    assert len(app.dataframe) >= 4
    app.text_input[1].input("handoff-p3-cutin-baseline").run(timeout=30)
    assert app.session_state.filtered_state["submitted_candidate_selection"] == (
        "handoff-p3-lead-shielded"
    )
    app.button[0].click().run(timeout=30)
    assert any("incompatible" in item.value.lower() for item in app.error)
    all_cells = " ".join(
        str(value)
        for frame in app.dataframe
        for value in frame.value.to_numpy().ravel()
    )
    assert "source_type=" not in all_cells
    assert all(
        item.value
        not in {
            "Verdict, hard-failure, and availability summary deltas",
            "Improvements, regressions, unchanged, and descriptive outcomes",
        }
        for item in app.subheader
    )


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
    app = _select_screen(_app(workbench_root), "Compatible comparison")
    app.text_input[0].input(baseline).run(timeout=30)
    app.text_input[1].input(candidate).run(timeout=30)
    app.button[0].click().run(timeout=30)

    assert list(app.exception) == []
    assert any(side in item.value and "INVALID_EVIDENCE" in item.value for item in app.error)
    trust_frame = app.dataframe[0].value
    assert "Gate verdict" in set(trust_frame["dimension"])
    assert "Evidence integrity" in set(trust_frame["dimension"])
    assert set(
        trust_frame.loc[
            trust_frame["dimension"].isin(["Gate verdict", "Evidence integrity"]),
            "value",
        ]
    ) == {"INVALID_EVIDENCE"}


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
    app = _submit_review(_app(workbench_root), selections[0])
    app = _select_screen(app, "Timeline")
    app.number_input[0].increment().run(timeout=30)
    app = _select_screen(app, "Compatible comparison")
    app.text_input[0].input(selections[2]).run(timeout=30)
    app.text_input[1].input(selections[3]).run(timeout=30)
    app.button[0].click().run(timeout=30)

    assert list(app.exception) == []
    assert _hashes(workbench_root, selections) == before


def test_workbench_active_rerun_recaptures_mutated_bundle_and_invalidates_review(
    workbench_root: Path,
) -> None:
    selection = "handoff-phase5-demo"
    app = _submit_review(_app(workbench_root), selection)
    assert list(app.exception) == []
    assert not any("INVALID_EVIDENCE" in item.value for item in app.error)

    metrics_path = workbench_root / selection / "metrics.json"
    metrics_path.write_bytes(metrics_path.read_bytes() + b"\n")
    app = _select_screen(app, "Review summary / trust")

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

    app = _submit_review(_app(workbench_root), "handoff-phase5-demo")
    app = _select_screen(app, "Compatible comparison")
    app.text_input[0].input("handoff-p3-lead-baseline").run(timeout=30)
    app.text_input[1].input("handoff-p3-lead-shielded").run(timeout=30)
    app.button[0].click().run(timeout=30)

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
    app = AppTest.from_string(script, default_timeout=30).run()
    app = _submit_review(app, "handoff-phase5-demo")
    app = _select_screen(app, "Timeline")

    assert list(app.exception) == []
