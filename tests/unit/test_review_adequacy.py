from __future__ import annotations

import ast
import hashlib
from dataclasses import fields
from pathlib import Path

import pytest

import hermes.review as public_review
import hermes.review.facade as facade_module
from hermes.comparison.compare import ArtifactComparison
from hermes.comparison.compare import compare_artifacts as compare_core
from hermes.review import canonical_envelope_bytes
from hermes.review.models import ComparisonEnvelope, ReviewEnvelope


def test_private_pair_retains_each_exact_current_capture_and_core_result_once(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = repository_root / "artifacts"
    service = facade_module._ReviewFacade()
    reviewed: list[str] = []
    captures: list[object] = []
    compared_snapshots: list[tuple[object, object]] = []
    comparisons: list[ArtifactComparison] = []
    real_review = facade_module._ReviewFacade._review_result
    real_capture = facade_module._inspect_artifact_under_root_capture

    def record_review(self, artifact_root: Path, selection: str):
        reviewed.append(selection)
        return real_review(self, artifact_root, selection)

    def record_capture(*args, **kwargs):
        capture = real_capture(*args, **kwargs)
        captures.append(capture)
        return capture

    def record_compare(
        baseline_snapshot: object,
        candidate_snapshot: object,
    ) -> ArtifactComparison:
        compared_snapshots.append((baseline_snapshot, candidate_snapshot))
        comparison = compare_core(baseline_snapshot, candidate_snapshot)
        comparisons.append(comparison)
        return comparison

    monkeypatch.setattr(facade_module._ReviewFacade, "_review_result", record_review)
    monkeypatch.setattr(
        facade_module,
        "_inspect_artifact_under_root_capture",
        record_capture,
    )
    monkeypatch.setattr(facade_module, "compare_artifacts", record_compare)

    pair = service._review_pair(
        root,
        "handoff-p3-lead-baseline",
        "handoff-p3-lead-shielded",
    )

    assert reviewed == ["handoff-p3-lead-baseline", "handoff-p3-lead-shielded"]
    assert len(captures) == 2
    assert pair.baseline.capture is captures[0]
    assert pair.candidate is not None
    assert pair.candidate.capture is captures[1]
    assert compared_snapshots == [
        (
            captures[0].inspection.snapshot,
            captures[1].inspection.snapshot,
        )
    ]
    assert pair.comparison is comparisons[0]
    assert tuple(field.name for field in fields(pair)) == (
        "baseline",
        "candidate",
        "comparison",
    )
    assert not hasattr(public_review, "_ReviewedArtifactPair")
    assert not hasattr(public_review, "_review_pair")


def test_private_pair_returns_invalid_baseline_without_candidate_capture_or_comparison(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = facade_module._ReviewFacade()
    reviewed: list[str] = []
    real_review = facade_module._ReviewFacade._review_result

    def record_review(self, artifact_root: Path, selection: str):
        reviewed.append(selection)
        return real_review(self, artifact_root, selection)

    def forbidden_compare(*args: object) -> ArtifactComparison:
        raise AssertionError(f"invalid baseline reached comparison: {args!r}")

    monkeypatch.setattr(facade_module._ReviewFacade, "_review_result", record_review)
    monkeypatch.setattr(facade_module, "compare_artifacts", forbidden_compare)

    pair = service._review_pair(
        repository_root / "artifacts",
        "phase1-tampered",
        "phase1-tampered",
    )

    assert reviewed == ["phase1-tampered"]
    assert pair.baseline.envelope.verification.integrity == "INVALID_EVIDENCE"
    assert pair.candidate is None
    assert pair.comparison is None


def test_private_pair_returns_invalid_candidate_after_one_valid_baseline(
    repository_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = facade_module._ReviewFacade()
    reviewed: list[str] = []
    real_review = facade_module._ReviewFacade._review_result

    def record_review(self, artifact_root: Path, selection: str):
        reviewed.append(selection)
        return real_review(self, artifact_root, selection)

    def forbidden_compare(*args: object) -> ArtifactComparison:
        raise AssertionError(f"invalid candidate reached comparison: {args!r}")

    monkeypatch.setattr(facade_module._ReviewFacade, "_review_result", record_review)
    monkeypatch.setattr(facade_module, "compare_artifacts", forbidden_compare)

    pair = service._review_pair(
        repository_root / "artifacts",
        "handoff-phase5-demo",
        "phase1-tampered",
    )

    assert reviewed == ["handoff-phase5-demo", "phase1-tampered"]
    assert pair.baseline.envelope.verification.integrity == "INTERNALLY_CONSISTENT"
    assert pair.candidate is not None
    assert pair.candidate.envelope.verification.integrity == "INVALID_EVIDENCE"
    assert pair.comparison is None


def test_private_pair_returns_existing_incompatible_comparison_without_new_authority(
    repository_root: Path,
) -> None:
    pair = facade_module._ReviewFacade()._review_pair(
        repository_root / "artifacts",
        "handoff-p3-lead-baseline",
        "handoff-p3-cutin-baseline",
    )

    assert pair.candidate is not None
    assert pair.comparison is not None
    assert pair.comparison.compatibility.comparable is False
    assert pair.comparison.compatibility.reasons

    facade_path = Path(facade_module.__file__)
    tree = ast.parse(facade_path.read_text(encoding="utf-8"), filename=str(facade_path))
    imports = {
        node.module
        for node in ast.walk(tree)
        if isinstance(node, ast.ImportFrom) and node.module is not None
    }
    imports.update(
        alias.name
        for node in ast.walk(tree)
        if isinstance(node, ast.Import)
        for alias in node.names
    )
    forbidden = ("hermes.adequacy", "hermes.provenance", "subprocess")
    assert not any(
        module == prefix or module.startswith(f"{prefix}.")
        for module in imports
        for prefix in forbidden
    )


def test_public_review_and_compare_models_and_canonical_bytes_remain_frozen(
    repository_root: Path,
) -> None:
    root = repository_root / "artifacts"
    results = (
        (
            public_review.review_artifact(root, "handoff-phase5-demo"),
            ReviewEnvelope,
            "e0d985d0d74d3a5c9ad4616b76f66b27ad7e24a8010491c1b78b82a5ccdf8a9f",
        ),
        (
            public_review.compare_review_artifacts(
                root,
                "handoff-p3-lead-baseline",
                "handoff-p3-lead-shielded",
            ),
            ComparisonEnvelope,
            "391d2a9021e1bd72f36ba3f10db8fba39fe8e4221ac917f8a99217c05c9f83b1",
        ),
        (
            public_review.compare_review_artifacts(
                root,
                "handoff-p3-lead-baseline",
                "handoff-p3-cutin-baseline",
            ),
            ComparisonEnvelope,
            "32b04be00d8b371fc25bebabbcf8ec68df65316e4a61386e891f59b852c63aec",
        ),
        (
            public_review.compare_review_artifacts(
                root,
                "phase1-tampered",
                "handoff-phase5-demo",
            ),
            ReviewEnvelope,
            "f03e4f1598e19c896e2fb3c027fc494bde2cc9108b4096152f6565691b80916f",
        ),
    )

    for result, expected_type, expected_sha256 in results:
        assert type(result) is expected_type
        assert hashlib.sha256(canonical_envelope_bytes(result)).hexdigest() == (
            expected_sha256
        )
