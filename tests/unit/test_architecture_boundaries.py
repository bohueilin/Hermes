from __future__ import annotations

import ast
import importlib.metadata
import importlib.util
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
        "subprocess",
        "hermes.adequacy",
        "hermes.adapters",
        "hermes.provenance",
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


def test_adequacy_contract_modules_have_no_authority_or_process_imports(
    repository_root: Path,
) -> None:
    forbidden = (
        "subprocess",
        "hermes.provenance",
        "hermes.review",
        "hermes.evidence",
        "hermes.gates",
        "hermes.runtime",
        "hermes.adapters",
        "hermes.policies",
        "hermes.shields",
        "hermes.faults",
        "metadrive",
    )
    adequacy_root = repository_root / "src" / "hermes" / "adequacy"
    violations: list[str] = []
    for source_path in sorted(adequacy_root.rglob("*.py")):
        for module in _imported_modules(source_path):
            if any(module == prefix or module.startswith(prefix + ".") for prefix in forbidden):
                violations.append(f"{source_path.relative_to(repository_root)} -> {module}")
    assert violations == []


def test_adequacy_loader_has_no_review_process_or_simulator_imports(
    repository_root: Path,
) -> None:
    modules = _imported_modules(repository_root / "src/hermes/adequacy/loader.py")
    forbidden = (
        "subprocess",
        "hermes.provenance",
        "hermes.review",
        "hermes.gates",
        "hermes.runtime",
        "hermes.adapters",
        "hermes.policies",
        "hermes.shields",
        "hermes.faults",
        "metadrive",
    )
    assert not any(
        module == prefix or module.startswith(prefix + ".")
        for module in modules
        for prefix in forbidden
    )


def test_adequacy_models_import_without_process_or_provenance_boundary(
    repository_root: Path,
) -> None:
    script = """
import importlib.abc

class Blocked(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname == 'subprocess' or fullname.startswith('hermes.provenance'):
            raise RuntimeError('forbidden import: ' + fullname)
        return None

import sys
sys.meta_path.insert(0, Blocked())
import hermes.adequacy.models
"""
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=repository_root,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout


def test_adequacy_assessment_imports_without_io_authority_or_runtime_boundaries(
    repository_root: Path,
) -> None:
    script = """
import importlib.abc

PREFIXES = (
    'subprocess',
    'hermes.provenance',
    'hermes.review',
    'hermes.evidence',
    'hermes.gates',
    'hermes.runtime',
    'hermes.adapters',
    'hermes.policies',
    'hermes.shields',
    'hermes.faults',
    'metadrive',
)

class Blocked(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if any(fullname == prefix or fullname.startswith(prefix + '.') for prefix in PREFIXES):
            raise RuntimeError('forbidden import: ' + fullname)
        return None

import sys
sys.meta_path.insert(0, Blocked())
import hermes.adequacy.assessment
"""
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=repository_root,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout


def test_adequacy_initializer_has_no_import_or_executable_statement(
    repository_root: Path,
) -> None:
    source_path = repository_root / "src/hermes/adequacy/__init__.py"
    tree = ast.parse(source_path.read_text(encoding="utf-8"), filename=str(source_path))
    assert len(tree.body) == 1
    node = tree.body[0]
    assert isinstance(node, ast.Expr)
    assert isinstance(node.value, ast.Constant)
    assert isinstance(node.value.value, str)


def test_provenance_initializer_is_documentation_only(repository_root: Path) -> None:
    source_path = repository_root / "src/hermes/provenance/__init__.py"
    tree = ast.parse(source_path.read_text(encoding="utf-8"), filename=str(source_path))
    assert len(tree.body) == 1
    node = tree.body[0]
    assert isinstance(node, ast.Expr)
    assert isinstance(node.value, ast.Constant)
    assert isinstance(node.value.value, str)


def test_provenance_git_is_the_only_new_process_boundary(
    repository_root: Path,
) -> None:
    source_path = repository_root / "src/hermes/provenance/git.py"
    modules = _imported_modules(source_path)
    assert "subprocess" in modules
    forbidden = (
        "hermes.review",
        "hermes.evidence",
        "hermes.gates",
        "hermes.runtime",
        "hermes.adapters",
        "hermes.policies",
        "hermes.shields",
        "hermes.faults",
        "hermes.workbench",
        "metadrive",
    )
    assert not any(
        module == prefix or module.startswith(prefix + ".")
        for module in modules
        for prefix in forbidden
    )

    tree = ast.parse(source_path.read_text(encoding="utf-8"), filename=str(source_path))
    subprocess_calls = {
        node.func.attr
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "subprocess"
    }
    assert "Popen" in subprocess_calls
    assert "run" not in subprocess_calls


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


def _workbench_import_violations(source_path: Path) -> list[str]:
    if source_path.name == "app.py":
        allowed_exact = {"hermes.review"}
        streamlit_allowed = True
    elif source_path.name == "launcher.py":
        allowed_exact = {"hermes.review"}
        streamlit_allowed = False
        allowed_for_file = {"subprocess"}
    elif source_path.name == "__init__.py":
        allowed_exact = {"hermes.workbench.launcher"}
        streamlit_allowed = False
        allowed_for_file = set()
    else:
        allowed_exact = set()
        streamlit_allowed = False
        allowed_for_file = set()
    if source_path.name == "app.py":
        allowed_for_file = set()
    forbidden_stdlib = {
        "asyncio",
        "ftplib",
        "http",
        "socket",
        "smtplib",
        "subprocess",
        "urllib",
        "webbrowser",
    }
    violations: list[str] = []
    for module in sorted(_imported_modules(source_path)):
        root = module.split(".", 1)[0]
        allowed = (
            root in sys.stdlib_module_names
            and root not in forbidden_stdlib
            or module in allowed_for_file
            or root == "streamlit"
            and streamlit_allowed
            or module in allowed_exact
        )
        if not allowed or module.startswith("hermes.review."):
            violations.append(module)
    return violations


@pytest.mark.parametrize(
    "module",
    ["requests", "boto3", "hermes.review.models", "urllib.request", "http.client"],
)
def test_workbench_import_allowlist_rejects_arbitrary_third_party_and_private_review(
    tmp_path: Path,
    module: str,
) -> None:
    source_path = tmp_path / "probe.py"
    source_path = source_path.with_name("app.py")
    source_path.write_text(f"import {module}\n", encoding="utf-8")

    assert _workbench_import_violations(source_path) == [module]


@pytest.mark.parametrize(
    ("file_name", "module"),
    [
        ("app.py", "hermes.workbench.launcher"),
        ("launcher.py", "streamlit"),
        ("__init__.py", "streamlit"),
        ("__init__.py", "hermes.review"),
    ],
)
def test_workbench_import_allowlist_is_specific_to_each_package_file(
    tmp_path: Path,
    file_name: str,
    module: str,
) -> None:
    source_path = tmp_path / file_name
    source_path.write_text(f"import {module}\n", encoding="utf-8")

    assert _workbench_import_violations(source_path) == [module]


def test_workbench_modules_import_only_public_review_streamlit_or_standard_library(
    repository_root: Path,
) -> None:
    workbench_root = repository_root / "src" / "hermes" / "workbench"
    violations: list[str] = []

    for source_path in sorted(workbench_root.rglob("*.py")):
        for module in _workbench_import_violations(source_path):
            violations.append(f"{source_path.relative_to(repository_root)} -> {module}")

    assert violations == []


def _unsafe_workbench_calls(source_path: Path) -> list[str]:
    tree = ast.parse(source_path.read_text(encoding="utf-8"), filename=str(source_path))
    allowed_streamlit = {
        "button",
        "caption",
        "column_config",
        "dataframe",
        "error",
        "header",
        "info",
        "multiselect",
        "number_input",
        "radio",
        "session_state",
        "set_page_config",
        "stop",
        "subheader",
        "text",
        "text_input",
        "title",
        "warning",
    }
    forbidden_methods = {
        "open",
        "read_text",
        "read_bytes",
        "write_text",
        "write_bytes",
        "iterdir",
        "glob",
        "rglob",
        "unlink",
        "rename",
        "replace",
        "mkdir",
        "touch",
        "listdir",
        "scandir",
        "walk",
    }
    violations: list[str] = []
    streamlit_aliases: set[str] = set()
    streamlit_direct_aliases: dict[str, str] = {}
    forbidden_direct_aliases: set[str] = set()

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name == "streamlit":
                    streamlit_aliases.add(alias.asname or alias.name)
        elif isinstance(node, ast.ImportFrom) and node.module == "streamlit":
            for alias in node.names:
                streamlit_direct_aliases[alias.asname or alias.name] = alias.name
                if alias.name not in allowed_streamlit:
                    forbidden_direct_aliases.add(alias.asname or alias.name)
        elif isinstance(node, ast.ImportFrom) and node.module in {"builtins", "io", "os"}:
            for alias in node.names:
                if alias.name in forbidden_methods:
                    forbidden_direct_aliases.add(alias.asname or alias.name)

    if any(
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "open"
        for node in ast.walk(tree)
    ):
        violations.append("open")

    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id in forbidden_direct_aliases
        ):
            violations.append(node.func.id)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            value = node.func.value
            root = value
            while isinstance(root, ast.Attribute):
                root = root.value
            if isinstance(root, ast.Name) and root.id in streamlit_aliases:
                allowed_nested_calls = {
                    ("column_config", "TextColumn"),
                    ("session_state", "get"),
                }
                nested_call = (
                    (value.attr, node.func.attr)
                    if isinstance(value, ast.Attribute)
                    else None
                )
                if (
                    nested_call is not None
                    and nested_call not in allowed_nested_calls
                    or nested_call is None
                    and node.func.attr not in allowed_streamlit
                ):
                    violations.append(f"{root.id}.{node.func.attr}")
            if isinstance(root, ast.Name) and root.id in streamlit_direct_aliases:
                namespace = streamlit_direct_aliases[root.id]
                if (namespace, node.func.attr) != ("column_config", "TextColumn"):
                    violations.append(f"{root.id}.{node.func.attr}")
            if node.func.attr in forbidden_methods:
                violations.append(node.func.attr)
        if isinstance(node, ast.keyword) and node.arg == "unsafe_allow_html":
            violations.append("unsafe_allow_html")

    imports = _imported_modules(source_path)
    for prefix in ("json", "yaml", "socket", "subprocess", "webbrowser"):
        if any(module == prefix or module.startswith(prefix + ".") for module in imports):
            violations.append(prefix)

    return violations


@pytest.mark.parametrize(
    "source",
    [
        "import streamlit as ui\nui.markdown('unsafe')\n",
        "from streamlit import markdown as render\nrender('unsafe')\n",
        "from pathlib import Path\nPath('x').read_text()\n",
        "open('x')\n",
        "from builtins import open as expose\nexpose('x')\n",
        "from io import open as expose\nexpose('x')\n",
        "from os import listdir as expose\nexpose('.')\n",
        "import os as platform_io\nplatform_io.scandir('.')\n",
        "import os\nnext(os.walk('.'))\n",
        "from streamlit import image as expose\nexpose('x')\n",
        "import streamlit as ui\nui.link_button('unsafe', 'https://example.com')\n",
        "import streamlit as ui\nui.sidebar.markdown('unsafe')\n",
        "from streamlit import sidebar\nsidebar.markdown('unsafe')\n",
        "from streamlit import column_config\ncolumn_config.LinkColumn('unsafe')\n",
        "import subprocess\nsubprocess.run(['x'])\n",
    ],
)
def test_unsafe_workbench_call_scanner_rejects_aliases_and_direct_imports(
    tmp_path: Path,
    source: str,
) -> None:
    source_path = tmp_path / "probe.py"
    source_path.write_text(source, encoding="utf-8")

    assert _unsafe_workbench_calls(source_path)


def test_workbench_app_avoids_unsafe_streamlit_filesystem_network_and_process_apis(
    repository_root: Path,
) -> None:
    source_path = repository_root / "src" / "hermes" / "workbench" / "app.py"

    assert _unsafe_workbench_calls(source_path) == []


def test_workbench_primary_headers_have_unique_stable_explicit_anchors(
    repository_root: Path,
) -> None:
    source_path = repository_root / "src" / "hermes" / "workbench" / "app.py"
    tree = ast.parse(source_path.read_text(encoding="utf-8"), filename=str(source_path))
    observed: list[tuple[int, str, str | None]] = []

    for node in ast.walk(tree):
        if not (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id == "st"
            and node.func.attr == "header"
            and node.args
            and isinstance(node.args[0], ast.Constant)
            and isinstance(node.args[0].value, str)
        ):
            continue
        anchor_keyword = next(
            (keyword.value for keyword in node.keywords if keyword.arg == "anchor"),
            None,
        )
        anchor = (
            anchor_keyword.value
            if isinstance(anchor_keyword, ast.Constant)
            and isinstance(anchor_keyword.value, str)
            else None
        )
        observed.append((node.lineno, node.args[0].value, anchor))

    mappings = [(label, anchor) for _line, label, anchor in sorted(observed)]
    assert mappings == [
        ("Select & Verify", "select-and-verify"),
        ("Overview", "overview"),
        ("Evidence", "evidence"),
        ("Timeline", "timeline"),
        ("Provenance", "provenance"),
        ("Compare", "compare"),
        ("Evidence limitations", "evidence-limitations"),
    ]
    assert len({anchor for _label, anchor in mappings}) == len(mappings)


def test_workbench_widget_vocabulary_has_no_execution_mutation_or_approval_actions(
    repository_root: Path,
) -> None:
    source_path = repository_root / "src" / "hermes" / "workbench" / "app.py"
    tree = ast.parse(source_path.read_text(encoding="utf-8"), filename=str(source_path))
    widget_calls = {
        "button",
        "multiselect",
        "number_input",
        "radio",
        "text_input",
    }
    forbidden_vocabulary = {
        "approve",
        "annotate",
        "deploy",
        "download",
        "edit",
        "export",
        "fault",
        "migrate",
        "normalize",
        "policy",
        "promote",
        "release",
        "repair",
        "run",
        "shield",
        "sign",
        "simulate",
        "simulator",
        "threshold",
        "upload",
    }
    violations: list[str] = []

    for node in ast.walk(tree):
        if not (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr in widget_calls
            and node.args
            and isinstance(node.args[0], ast.Constant)
            and isinstance(node.args[0].value, str)
        ):
            continue
        label = node.args[0].value.lower()
        if any(word in label.split() for word in forbidden_vocabulary):
            violations.append(label)

    assert violations == []


@pytest.mark.parametrize(
    "label",
    ["Deploy result", "Repair bundle", "Edit threshold", "Run simulator"],
)
def test_workbench_widget_vocabulary_oracle_rejects_forbidden_action_labels(
    label: str,
) -> None:
    forbidden_vocabulary = {
        "approve",
        "annotate",
        "deploy",
        "download",
        "edit",
        "export",
        "fault",
        "migrate",
        "normalize",
        "policy",
        "promote",
        "release",
        "repair",
        "run",
        "shield",
        "sign",
        "simulate",
        "simulator",
        "threshold",
        "upload",
    }

    assert any(word in label.lower().split() for word in forbidden_vocabulary)


def test_cli_imports_workbench_only_inside_workbench_handler(
    repository_root: Path,
) -> None:
    source_path = repository_root / "src" / "hermes" / "cli.py"
    tree = ast.parse(source_path.read_text(encoding="utf-8"), filename=str(source_path))
    importing_functions: list[str] = []

    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        imports = set()
        for child in ast.walk(node):
            if isinstance(child, ast.Import):
                imports.update(alias.name for alias in child.names)
            elif isinstance(child, ast.ImportFrom) and child.module is not None:
                imports.add(child.module)
        if any(
            module == "hermes.workbench" or module.startswith("hermes.workbench.")
            for module in imports
        ):
            importing_functions.append(node.name)

    assert importing_functions == ["workbench_command"]


def test_workbench_optional_dependency_is_isolated_and_exact() -> None:
    metadata = importlib.metadata.metadata("hermes-autonomy")
    requirements = metadata.get_all("Requires-Dist") or []

    assert not any(
        requirement.lower().startswith("streamlit") and "extra ==" not in requirement
        for requirement in requirements
    )
    assert [
        requirement
        for requirement in requirements
        if requirement.lower().startswith("streamlit")
    ] == ['streamlit<2,>=1.37; extra == "workbench"']


def test_workbench_package_modules_are_discoverable_without_importing_app() -> None:
    assert importlib.util.find_spec("hermes.workbench") is not None
    assert importlib.util.find_spec("hermes.workbench.app") is not None


def test_workbench_package_and_cli_help_import_when_streamlit_is_bombed(
    repository_root: Path,
) -> None:
    script = """
import importlib.abc
import sys

class Blocked(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname == 'streamlit' or fullname.startswith('streamlit.'):
            raise RuntimeError('forbidden streamlit import: ' + fullname)
        return None

sys.meta_path.insert(0, Blocked())
import hermes.workbench
from typer.testing import CliRunner
from hermes.cli import app
result = CliRunner().invoke(app, ['workbench', '--help'])
if result.exit_code != 0:
    raise RuntimeError(result.output) from result.exception
"""
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=repository_root,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
