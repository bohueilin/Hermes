import subprocess
import sys
from pathlib import Path

from tests.conftest import (
    FIXTURE_DEPENDENT_TESTS,
    FIXTURE_REGISTRY,
    fixture_guard_active,
    read_fixture_dependent_tests,
)

from hermes.fixtures import load_fixture_registry

CI = {"CI": "true"}


def test_fixture_dependent_list_is_sorted_unique_and_well_formed() -> None:
    listed = read_fixture_dependent_tests()

    assert FIXTURE_DEPENDENT_TESTS.parent == Path(__file__).resolve().parents[1]
    assert listed
    assert list(listed) == sorted(set(listed))
    for node_id in listed:
        path, separator, name = node_id.partition("::")
        assert separator and path.startswith("tests/") and path.endswith(".py"), node_id
        assert "::" not in name and name.startswith("test_"), node_id


def test_every_listed_node_id_is_still_collected(repository_root: Path) -> None:
    collected = subprocess.run(
        [sys.executable, "-m", "pytest", "--collect-only", "-q", "-p", "no:cacheprovider"],
        cwd=repository_root,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.splitlines()

    stale = sorted(set(read_fixture_dependent_tests()) - set(collected))
    assert stale == [], "listed but no longer collected; refresh tests/fixture_dependent_tests.txt"


def test_guard_activates_only_on_ci_with_every_registered_fixture_absent(tmp_path: Path) -> None:
    run_ids = load_fixture_registry(FIXTURE_REGISTRY).run_ids
    artifact_root = tmp_path / "artifacts"

    assert fixture_guard_active(CI, FIXTURE_REGISTRY, artifact_root)
    assert not fixture_guard_active({}, FIXTURE_REGISTRY, artifact_root)
    assert not fixture_guard_active({"CI": "1"}, FIXTURE_REGISTRY, artifact_root)
    artifact_root.mkdir()
    (artifact_root / "unregistered-run").mkdir()
    assert fixture_guard_active(CI, FIXTURE_REGISTRY, artifact_root)
    (artifact_root / run_ids[0]).mkdir()
    assert not fixture_guard_active(CI, FIXTURE_REGISTRY, artifact_root)
    for run_id in run_ids[1:]:
        (artifact_root / run_id).mkdir()
    assert not fixture_guard_active(CI, FIXTURE_REGISTRY, artifact_root)


def test_guard_stays_off_when_the_registry_cannot_be_read(tmp_path: Path) -> None:
    malformed = tmp_path / "registry.yaml"
    malformed.write_text('schema_version: "9"\n', encoding="utf-8")

    assert not fixture_guard_active(CI, tmp_path / "missing.yaml", tmp_path / "artifacts")
    assert not fixture_guard_active(CI, malformed, tmp_path / "artifacts")
