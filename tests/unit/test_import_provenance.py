"""Guard that the suite exercises this checkout's Hermes, not another one."""

from __future__ import annotations

from pathlib import Path

import hermes


def test_hermes_package_resolves_inside_this_repository(repository_root: Path) -> None:
    """Fail loudly when an editable install points the suite at a different checkout.

    Every Phase 0-6 evidence, gate, and comparison contract is asserted against the
    ``hermes`` package that happens to be importable. If an environment's editable
    install resolves elsewhere, the suite silently validates code that is not in this
    working tree and every green result becomes meaningless.
    """
    imported = Path(hermes.__file__).resolve().parent
    expected = (repository_root / "src" / "hermes").resolve()

    assert imported == expected, (
        "the imported hermes package is not this checkout's source tree: "
        f"imported={imported}, expected={expected}. "
        "Install this repository in editable mode (`python -m pip install -e \".[dev]\"`) "
        f'or run pytest with PYTHONPATH="{repository_root / "src"}".'
    )
