from __future__ import annotations

import ast
import subprocess
import sys
from pathlib import Path

import pytest


def _imported_modules(source_path: Path) -> set[str]:
    tree = ast.parse(source_path.read_text(encoding="utf-8"), filename=str(source_path))
    modules: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module is not None:
            modules.add(node.module)
    return modules


@pytest.mark.parametrize("layer", ["evidence", "gates", "verifiers"])
def test_stored_decision_layers_do_not_import_simulator_adapters(
    repository_root: Path,
    layer: str,
) -> None:
    layer_root = repository_root / "src" / "hermes" / layer
    violations: list[str] = []

    for source_path in sorted(layer_root.rglob("*.py")):
        for module in sorted(_imported_modules(source_path)):
            if module == "hermes.adapters" or module.startswith("hermes.adapters."):
                violations.append(f"{source_path.relative_to(repository_root)} -> {module}")
            if module == "metadrive" or module.startswith("metadrive."):
                violations.append(f"{source_path.relative_to(repository_root)} -> {module}")

    assert violations == []


def test_review_layer_never_imports_runtime_simulator_or_workbench(
    repository_root: Path,
) -> None:
    review_root = repository_root / "src" / "hermes" / "review"
    forbidden = (
        "hermes.adapters",
        "hermes.policies",
        "hermes.runtime",
        "hermes.workbench",
        "metadrive",
        "streamlit",
    )
    violations: list[str] = []

    for source_path in sorted(review_root.rglob("*.py")):
        for module in sorted(_imported_modules(source_path)):
            if any(module == prefix or module.startswith(prefix + ".") for prefix in forbidden):
                violations.append(f"{source_path.relative_to(repository_root)} -> {module}")

    assert violations == []


def test_cli_has_no_top_level_runtime_simulator_or_review_imports(
    repository_root: Path,
) -> None:
    source_path = repository_root / "src" / "hermes" / "cli.py"
    tree = ast.parse(source_path.read_text(encoding="utf-8"), filename=str(source_path))
    forbidden = (
        "hermes.adapters",
        "hermes.policies",
        "hermes.runtime",
        "hermes.review",
        "hermes.shields",
        "metadrive",
    )
    violations: list[str] = []

    for node in tree.body:
        modules: list[str] = []
        if isinstance(node, ast.Import):
            modules.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module is not None:
            modules.append(node.module)
        for module in modules:
            if any(module == prefix or module.startswith(prefix + ".") for prefix in forbidden):
                violations.append(module)

    assert violations == []


_IMPORT_BOMB_PREFIXES = (
    "hermes.adapters",
    "hermes.policies",
    "hermes.runtime",
    "metadrive",
)


def _run_import_bomb(repository_root: Path, action: str) -> subprocess.CompletedProcess[str]:
    script = f"""
import importlib.abc
import sys

PREFIXES = {_IMPORT_BOMB_PREFIXES!r}

class Blocked(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if any(fullname == prefix or fullname.startswith(prefix + '.') for prefix in PREFIXES):
            raise RuntimeError('forbidden import: ' + fullname)
        return None

sys.meta_path.insert(0, Blocked())

if {action!r} == 'review-import':
    import hermes.review
elif {action!r} == 'cli-import':
    import hermes.cli
else:
    from typer.testing import CliRunner
    from hermes.cli import app
    arguments = (
        [
            'review-artifact', 'handoff-phase5-demo',
            '--artifact-root', 'artifacts', '--format', 'json',
        ]
        if {action!r} == 'review-artifact'
        else [
            'review-compare',
            'handoff-p3-lead-baseline', 'handoff-p3-lead-shielded',
            '--artifact-root', 'artifacts', '--format', 'json',
        ]
    )
    result = CliRunner().invoke(app, arguments)
    if result.exit_code != 0:
        message = f'command failed {{result.exit_code}}: {{result.output}}'
        raise RuntimeError(message) from result.exception
"""
    return subprocess.run(
        [sys.executable, "-c", script],
        cwd=repository_root,
        text=True,
        capture_output=True,
        check=False,
    )


@pytest.mark.parametrize(
    "action",
    ["review-import", "cli-import", "review-artifact", "review-compare"],
)
def test_review_surfaces_bomb_runtime_and_simulator_imports(
    repository_root: Path,
    action: str,
) -> None:
    result = _run_import_bomb(repository_root, action)

    assert result.returncode == 0, result.stderr or result.stdout
