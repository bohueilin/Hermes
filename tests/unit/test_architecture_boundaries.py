from __future__ import annotations

import ast
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
