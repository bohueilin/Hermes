"""Command-line interface for Hermes."""

from collections import Counter
from functools import partial
from pathlib import Path
from typing import Annotated, Any, NoReturn
from unicodedata import category as unicode_category

import typer
from rich.console import Console
from rich.table import Table
from rich.text import Text
from typer.core import TyperGroup, _click

from hermes.cli_errors import CliErrorCode, render_cli_error
from hermes.doctor import (
    CheckResult,
    CheckStatus,
    collect_doctor_checks,
    discover_hermes_repository_root,
)
from hermes.domain.enums import Verdict
from hermes.domain.models import ArtifactVerification
from hermes.evidence.canonical import canonical_json_bytes

EXIT_CODES = {
    Verdict.PASS: 0,
    Verdict.CONDITIONAL: 10,
    Verdict.HOLD: 20,
    Verdict.INVALID_EVIDENCE: 30,
}
SCOPE_BANNER = (
    "SIMULATION-ONLY PROTOTYPE — illustrative thresholds; not road-safety, certification, "
    "compliance, or deployment evidence."
)
_REVIEW_TEXT_SCALAR_LIMIT = 1_024


class HermesTyperGroup(TyperGroup):
    """Map Click/Typer usage failures into the Hermes operational contract."""

    def main(self, *args: Any, **kwargs: Any) -> Any:
        standalone_mode = kwargs.pop("standalone_mode", True)
        try:
            result = super().main(*args, standalone_mode=False, **kwargs)
        except _click.exceptions.UsageError as exc:
            render_cli_error(
                CliErrorCode.USAGE_ERROR,
                exc.format_message(),
                40,
            )
            if standalone_mode:
                raise SystemExit(40) from exc
            return 40
        except _click.exceptions.ClickException as exc:
            render_cli_error(
                CliErrorCode.USAGE_ERROR,
                exc.format_message(),
                40,
            )
            if standalone_mode:
                raise SystemExit(40) from exc
            return 40
        if standalone_mode:
            raise SystemExit(result if isinstance(result, int) else 0)
        return result


app = typer.Typer(
    name="hermes",
    help="Hermes SIMULATION-ONLY autonomy evidence tooling.",
    no_args_is_help=True,
    cls=HermesTyperGroup,
)


@app.callback()
def main() -> None:
    """Run Hermes commands."""


def render_doctor_checks(checks: list[CheckResult], console: Console | None = None) -> None:
    """Render doctor results without changing their truth status."""
    output = console or Console(highlight=False)
    table = Table(title="Hermes Phase 0 environment doctor")
    table.add_column("Status", no_wrap=True)
    table.add_column("Check", style="bold")
    table.add_column("Observed result", overflow="fold")

    status_styles = {
        CheckStatus.PASS: "bold green",
        CheckStatus.WARN: "bold yellow",
        CheckStatus.FAIL: "bold red",
        CheckStatus.NOT_AVAILABLE: "bold magenta",
    }
    for check in checks:
        table.add_row(
            Text(check.status.value, style=status_styles[check.status]),
            Text(check.name, style="bold"),
            Text(check.details),
        )

    output.print(table)
    for check in checks:
        if check.remediation:
            action = Text(f"Action — {check.name}: ", style="bold")
            action.append(check.remediation, style="not bold")
            output.print(action)

    counts = Counter(check.status for check in checks)
    output.print(
        "Summary: "
        + ", ".join(
            f"{counts[status]} {status.value}"
            for status in CheckStatus
            if counts[status]
        )
    )


@app.command()
def doctor() -> None:
    """Inspect the Phase 0 development environment without launching the simulator."""
    checks = collect_doctor_checks()
    render_doctor_checks(checks)
    if any(check.status is CheckStatus.FAIL for check in checks):
        raise typer.Exit(code=1)


def _phase_console() -> Console:
    return Console(highlight=False, markup=False, soft_wrap=True)


def _review_console() -> Console:
    return Console(
        highlight=False,
        markup=False,
        soft_wrap=True,
        color_system=None,
        force_terminal=False,
    )


def _neutralize_artifact_text(value: object) -> str:
    """Render every Cc/Cf control as visible uppercase ASCII text."""

    text = str(value)
    rendered: list[str] = []
    for character in text:
        if unicode_category(character) not in {"Cc", "Cf"}:
            rendered.append(character)
            continue
        codepoint = ord(character)
        rendered.append(
            f"\\u{codepoint:04X}"
            if codepoint <= 0xFFFF
            else f"\\U{codepoint:08X}"
        )
    return "".join(rendered)


def _bounded_artifact_text(value: object) -> str:
    """Return one bounded, visibly inert human-display scalar."""

    from hermes.review import truncate_display_text

    text = str(value)
    projection = truncate_display_text(text, limit=_REVIEW_TEXT_SCALAR_LIMIT)
    displayed = _neutralize_artifact_text(text[:_REVIEW_TEXT_SCALAR_LIMIT])
    if not projection.truncated:
        return displayed
    return (
        f"{displayed} [truncated=true; "
        f"original_length={projection.original_length}]"
    )


def execute_fake_run(**kwargs: Any) -> Any:
    """Lazy legacy monkeypatch seam for fake execution."""

    from hermes.runtime.orchestrator import execute_fake_run as implementation

    return implementation(**kwargs)


def execute_metadrive_run(**kwargs: Any) -> Any:
    """Lazy legacy monkeypatch seam for MetaDrive execution."""

    from hermes.runtime.orchestrator import execute_metadrive_run as implementation

    return implementation(**kwargs)


def run_metadrive_smoke(**kwargs: Any) -> Any:
    """Lazy legacy monkeypatch seam for the MetaDrive smoke probe."""

    from hermes.runtime.orchestrator import run_metadrive_smoke as implementation

    return implementation(**kwargs)


def _raise_cli_error(
    code: CliErrorCode,
    message: str,
    *,
    exit_code: int = 40,
    details: dict[str, Any] | None = None,
    json_output: bool = False,
) -> NoReturn:
    render_cli_error(
        code,
        message,
        exit_code,
        details=details,
        json_output=json_output,
        console=_phase_console(),
    )
    raise typer.Exit(code=exit_code)


def _render_artifact_verification(result: ArtifactVerification) -> None:
    console = _phase_console()
    console.print(SCOPE_BANNER)
    console.print(f"Artifact integrity: {result.integrity.value}")
    console.print(f"Authenticity: {result.authenticity.value}")
    console.print(f"Verdict: {result.verdict.value}")
    console.print(f"Artifact: {result.artifact_path}")
    if result.trace_digest:
        console.print(f"Trace digest: {result.trace_digest}")
    if result.first_mismatch_sequence is not None:
        console.print(f"First mismatched event sequence: {result.first_mismatch_sequence}")
    for rationale in result.rationale:
        console.print(f"Rationale: {rationale}")
    if result.supporting_finding_ids:
        console.print("Supporting findings: " + ", ".join(result.supporting_finding_ids))
    for limitation in result.residual_limitations:
        console.print(f"Limitation: {limitation}")
    for error in result.errors:
        console.print(f"Verification error: {error}", style="red")


@app.command("run")
def run_command(
    simulator: Annotated[
        str, typer.Option("--simulator", help="Simulator adapter: fake or metadrive.")
    ],
    scenario: Annotated[Path, typer.Option("--scenario", help="Strict scenario YAML path.")],
    policy: Annotated[
        str, typer.Option("--policy", help="Candidate policy: baseline or metadrive-idm.")
    ],
    seed: Annotated[int, typer.Option("--seed", help="Signed 32-bit deterministic seed.")],
    run_id: Annotated[str, typer.Option("--run-id", help="Unique lowercase artifact slug.")],
    gate_config: Annotated[
        Path | None,
        typer.Option("--gate-config", help="Strict illustrative release-gate YAML."),
    ] = None,
    headless: Annotated[
        bool,
        typer.Option("--headless", help="Require physics-only MetaDrive execution."),
    ] = False,
    shield: Annotated[
        str,
        typer.Option("--shield", help="Runtime shield: noop or deterministic."),
    ] = "noop",
    shield_config: Annotated[
        Path | None,
        typer.Option("--shield-config", help="Versioned deterministic shield YAML."),
    ] = None,
) -> None:
    """Run one bounded simulation-only scenario and publish verified evidence."""
    from hermes.runtime.orchestrator import RunConfigurationError, RunOperationalError
    from hermes.shields.config import ShieldConfigError, load_shield_config
    from hermes.shields.deterministic import DeterministicSafetyShield
    from hermes.shields.noop import NoOpShield

    console = _phase_console()
    if simulator not in {"fake", "metadrive"}:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            f"unsupported simulator {simulator!r}",
        )
    expected_policy = "baseline" if simulator == "fake" else "metadrive-idm"
    if policy != expected_policy:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            f"simulator {simulator!r} requires policy {expected_policy!r}",
        )
    if simulator == "metadrive" and not headless:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            "MetaDrive execution requires --headless",
        )
    if shield not in {"noop", "deterministic"}:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            f"unsupported shield {shield!r}",
        )
    if shield == "noop" and shield_config is not None:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            "--shield-config requires deterministic shield",
        )
    repository_root = discover_hermes_repository_root()
    if repository_root is None:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            "Hermes repository root is unavailable",
        )
    default_gate = "gates.phase1.yaml" if simulator == "fake" else "gates.phase2.yaml"
    resolved_gate = gate_config or repository_root / "config" / default_gate
    resolved_artifacts = repository_root / "artifacts"
    shield_factory = NoOpShield
    if shield == "deterministic":
        resolved_shield = shield_config or repository_root / "config" / "shield.phase3.yaml"
        try:
            deterministic_config = load_shield_config(resolved_shield)
        except ShieldConfigError as exc:
            _raise_cli_error(CliErrorCode.CONFIGURATION_ERROR, str(exc))
        shield_factory = partial(DeterministicSafetyShield, deterministic_config)
    try:
        runner = execute_fake_run if simulator == "fake" else execute_metadrive_run
        outcome = runner(
            scenario_path=scenario,
            gate_config_path=resolved_gate,
            seed=seed,
            run_id=run_id,
            artifact_root=resolved_artifacts,
            repository_root=repository_root,
            shield_factory=shield_factory,
        )
    except RunConfigurationError as exc:
        _raise_cli_error(CliErrorCode.CONFIGURATION_ERROR, str(exc))
    except RunOperationalError as exc:
        _raise_cli_error(CliErrorCode.OPERATIONAL_ERROR, str(exc))
    except Exception as exc:
        _raise_cli_error(
            CliErrorCode.OPERATIONAL_ERROR,
            f"{type(exc).__name__}: {exc}",
        )

    _render_artifact_verification(outcome.verification)
    if simulator == "fake":
        console.print(
            "Adapter: fake (deterministic architectural test double, not vehicle physics)"
        )
    else:
        console.print("Adapter: metadrive (headless MetaDrive 0.4.3 vehicle physics)")
    exit_code = EXIT_CODES[outcome.verdict]
    if exit_code:
        raise typer.Exit(code=exit_code)


@app.command("sim-smoke")
def sim_smoke_command(
    headless: Annotated[
        bool,
        typer.Option("--headless", help="Require physics-only MetaDrive execution."),
    ] = False,
) -> None:
    """Probe MetaDrive reset/IDM/step/close without publishing release evidence."""
    from hermes.runtime.orchestrator import RunConfigurationError, RunOperationalError

    console = _phase_console()
    if not headless:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            "MetaDrive smoke requires --headless",
        )
    repository_root = discover_hermes_repository_root()
    if repository_root is None:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            "Hermes repository root is unavailable",
        )
    try:
        outcome = run_metadrive_smoke(
            scenario_path=repository_root / "scenarios" / "metadrive_nominal.yaml",
            seed=7,
            repository_root=repository_root,
        )
    except RunConfigurationError as exc:
        _raise_cli_error(CliErrorCode.CONFIGURATION_ERROR, str(exc))
    except RunOperationalError as exc:
        _raise_cli_error(CliErrorCode.OPERATIONAL_ERROR, str(exc))
    except Exception as exc:
        _raise_cli_error(
            CliErrorCode.OPERATIONAL_ERROR,
            f"{type(exc).__name__}: {exc}",
        )

    console.print(SCOPE_BANNER)
    console.print("Smoke status: OK")
    console.print(
        f"Simulator: {outcome.simulator_name} {outcome.simulator_version} "
        f"({outcome.simulator_commit})"
    )
    console.print(f"Headless steps completed: {outcome.steps_completed}")


@app.command("verify-artifact")
def verify_artifact_command(
    artifact_dir: Annotated[
        Path, typer.Argument(help="Stored evidence-bundle directory.")
    ],
) -> None:
    """Verify stored evidence and recompute its verdict without rerunning a simulator."""
    from hermes.evidence.verification import verify_artifact as verify_stored_artifact

    try:
        result = verify_stored_artifact(artifact_dir)
    except Exception as exc:
        _raise_cli_error(
            CliErrorCode.OPERATIONAL_ERROR,
            f"artifact verifier crashed: {type(exc).__name__}: {exc}",
        )
    _render_artifact_verification(result)
    if result.verdict is Verdict.INVALID_EVIDENCE:
        _raise_cli_error(
            CliErrorCode.INVALID_EVIDENCE,
            "Stored artifact failed integrity verification.",
            exit_code=30,
        )
    exit_code = EXIT_CODES[result.verdict]
    if exit_code:
        raise typer.Exit(code=exit_code)


def _review_record_json(value: object) -> str:
    payload = value.model_dump(mode="json") if hasattr(value, "model_dump") else value

    def project_scalars(record: object) -> object:
        if isinstance(record, str):
            from hermes.review import truncate_display_text

            projection = truncate_display_text(
                record,
                limit=_REVIEW_TEXT_SCALAR_LIMIT,
            )
            if not projection.truncated:
                return record
            return {
                "displayed_text": record[:_REVIEW_TEXT_SCALAR_LIMIT],
                "original_length": projection.original_length,
                "truncated": True,
            }
        if isinstance(record, dict):
            from hermes.review import truncate_display_text

            projected: dict[object, object] = {}
            for key_index, key in enumerate(sorted(record)):
                item = record[key]
                displayed_key = key
                if isinstance(key, str):
                    key_projection = truncate_display_text(
                        key,
                        limit=_REVIEW_TEXT_SCALAR_LIMIT,
                    )
                    if key_projection.truncated:
                        displayed_key = (
                            key[:_REVIEW_TEXT_SCALAR_LIMIT]
                            + " [truncated=true; "
                            + f"original_length={key_projection.original_length}; "
                            + f"key_index={key_index}]"
                        )
                projected[displayed_key] = project_scalars(item)
            return projected
        if isinstance(record, (list, tuple)):
            return [project_scalars(item) for item in record]
        return record

    text = canonical_json_bytes(project_scalars(payload)).decode("utf-8")
    replacements = {
        "\\b": "\\u0008",
        "\\t": "\\u0009",
        "\\n": "\\u000A",
        "\\f": "\\u000C",
        "\\r": "\\u000D",
    }
    normalized: list[str] = []
    index = 0
    while index < len(text):
        character = text[index]
        if character == "\\" and index + 1 < len(text):
            short = text[index : index + 2]
            if short in {"\\\\", '\\"', "\\/"}:
                normalized.append(short)
                index += 2
                continue
            if short in replacements:
                normalized.append(replacements[short])
                index += 2
                continue
            if index + 5 < len(text) and text[index + 1] == "u":
                hexadecimal = text[index + 2 : index + 6]
                if all(value in "0123456789abcdefABCDEF" for value in hexadecimal):
                    codepoint = int(hexadecimal, 16)
                    if codepoint <= 0x1F or 0x7F <= codepoint <= 0x9F:
                        normalized.append(f"\\u{codepoint:04X}")
                        index += 6
                        continue
        normalized.append(_neutralize_artifact_text(character))
        index += 1
    return "".join(normalized)


def _digest_text(digest: object | None) -> str:
    return "NOT_AVAILABLE" if digest is None else _bounded_artifact_text(digest.value)


def _optional_artifact_text(value: object | None) -> str:
    return "NOT_AVAILABLE" if value is None else _bounded_artifact_text(value)


def _render_review_envelope_text(envelope: object) -> None:
    console = _review_console()
    artifact = envelope.artifact
    identity = artifact.manifest_identity
    console.print(SCOPE_BANNER)
    console.print(
        "Review authority: stored simulation evidence only; not an approval, "
        "certification, or deployment grant."
    )
    console.print(
        "Selected artifact: "
        + _bounded_artifact_text(artifact.locator.selected_relative_path)
    )
    console.print(
        "Selected directory: "
        + _bounded_artifact_text(artifact.locator.selected_directory_name)
    )
    console.print("Manifest run ID: " + _optional_artifact_text(identity.run_id))
    console.print("Created at: " + _optional_artifact_text(identity.created_at_utc))
    console.print(
        "Evidence schema: "
        + _optional_artifact_text(identity.evidence_schema_version)
    )
    console.print(
        "Scenario schema: "
        + _optional_artifact_text(identity.scenario_schema_version)
    )
    console.print("Observed bundle digest: " + _digest_text(artifact.observed_bundle_digest))
    console.print("Computed bundle digest: " + _digest_text(artifact.computed_bundle_digest))
    console.print("Observed trace digest: " + _digest_text(artifact.observed_trace_digest))
    console.print("Computed trace digest: " + _digest_text(artifact.computed_trace_digest))
    console.print("Source inventory:")
    for item in artifact.source_inventory:
        console.print("  " + _review_record_json(item))

    console.print(
        "Evidence integrity: "
        + _bounded_artifact_text(envelope.verification.integrity)
    )
    console.print("Gate verdict: " + _bounded_artifact_text(envelope.gate.verdict))
    console.print(
        "Stored claims quarantined: "
        + _bounded_artifact_text(
            envelope.verification.stored_claims_quarantined
        )
    )
    trust_labels = {
        "authenticity": "Authenticity",
        "authorization": "Authorization",
        "deployment_permission": "Deployment permission",
        "scope": "Scope",
        "authoritative_status": "Authoritative status",
    }
    for record in envelope.trust.records:
        label = trust_labels[record.dimension]
        console.print(f"{label}: " + _bounded_artifact_text(record.value))
        console.print(
            f"  {label} explanation: "
            + _bounded_artifact_text(record.explanation)
        )

    console.print("Gate decision:")
    console.print("  " + _review_record_json(envelope.gate))
    console.print("Verification diagnostics:")
    for diagnostic in envelope.verification.errors:
        console.print("  " + _review_record_json(diagnostic))
    for diagnostic in envelope.diagnostics:
        console.print("  " + _review_record_json(diagnostic))

    console.print("Evidence sufficiency:")
    console.print("  Summary: " + _review_record_json(envelope.evidence_sufficiency.summary))
    for item in envelope.evidence_sufficiency.items:
        console.print("  " + _review_record_json(item))
    console.print("Findings:")
    for item in envelope.findings:
        console.print("  " + _review_record_json(item))
    console.print("Metrics:")
    for item in envelope.metrics:
        console.print("  " + _review_record_json(item))
    console.print("Timeline:")
    console.print(
        "  Event count: " + _bounded_artifact_text(envelope.timeline.event_count)
    )
    console.print(
        "  Simulation range: "
        + _optional_artifact_text(envelope.timeline.simulation_start_s)
        + " -> "
        + _optional_artifact_text(envelope.timeline.simulation_end_s)
    )
    for track in envelope.timeline.tracks:
        console.print(
            "  Track: "
            + _bounded_artifact_text(track.track_id)
            + " | availability="
            + _bounded_artifact_text(track.availability)
            + " | reason="
            + _bounded_artifact_text(track.unavailable_reason)
            + " | value_kind="
            + _bounded_artifact_text(track.value_kind)
            + " | points="
            + _bounded_artifact_text(len(track.points))
        )

    console.print(
        "Recorded provenance: "
        + _bounded_artifact_text(envelope.provenance.recorded.status)
    )
    console.print("  " + _review_record_json(envelope.provenance))
    console.print("Assumptions:")
    for item in envelope.assumptions:
        console.print("  " + _review_record_json(item))
    console.print("Unavailable evidence:")
    for item in envelope.unavailable_evidence:
        console.print("  " + _review_record_json(item))
    console.print("Residual limitations:")
    for item in envelope.residual_limitations:
        console.print("  " + _review_record_json(item))


def _render_comparison_side(console: Console, label: str, side: object) -> None:
    console.print(
        f"{label} artifact: "
        + _bounded_artifact_text(side.artifact.locator.selected_relative_path)
    )
    console.print(
        f"{label} manifest run ID: "
        + _bounded_artifact_text(side.artifact.manifest_identity.run_id)
    )
    console.print(
        f"{label} bundle digest: "
        + _digest_text(side.artifact.computed_bundle_digest)
    )
    console.print(
        f"{label} trace digest: "
        + _digest_text(side.artifact.computed_trace_digest)
    )
    console.print(f"{label} integrity: " + _bounded_artifact_text(side.integrity))
    console.print(f"{label} gate: " + _bounded_artifact_text(side.gate_verdict))


def _render_comparison_partition(
    console: Console,
    label: str,
    values: tuple[object, ...],
) -> None:
    console.print(label + ":")
    for value in values:
        console.print("  " + _review_record_json(value))


def _render_comparison_envelope_text(envelope: object) -> None:
    console = _review_console()
    console.print(SCOPE_BANNER)
    console.print("Authenticity: NOT_AUTHENTICATED")
    console.print("Authorization: NOT_EVALUATED")
    console.print("Deployment permission: NONE")
    console.print("Scope: SIMULATION_ONLY")
    console.print("Authoritative status: NOT_DEFINED")
    _render_comparison_side(console, "Baseline", envelope.baseline)
    _render_comparison_side(console, "Candidate", envelope.candidate)
    console.print(
        "Compatibility: " + _bounded_artifact_text(envelope.compatibility.status)
    )
    for reason in envelope.compatibility.reasons:
        console.print("Incompatibility: " + _bounded_artifact_text(reason))
    for warning in envelope.compatibility.warnings:
        console.print("Compatibility warning: " + _bounded_artifact_text(warning))
    console.print("Verdict delta: " + _review_record_json(envelope.verdict_delta))
    console.print(
        "Hard-failure delta: " + _review_record_json(envelope.hard_failure_delta)
    )
    console.print(
        "Evidence-availability summary delta: "
        + _review_record_json(envelope.availability_summary_delta)
    )
    _render_comparison_partition(console, "Improvements", envelope.improvements)
    _render_comparison_partition(console, "Regressions", envelope.regressions)
    _render_comparison_partition(
        console, "Unchanged outcomes", envelope.unchanged_outcomes
    )
    _render_comparison_partition(console, "Not comparable", envelope.not_comparable)
    _render_comparison_partition(
        console, "Availability details", envelope.availability_deltas
    )
    _render_comparison_partition(console, "Chart series", envelope.chart_series)
    _render_comparison_partition(
        console, "Residual limitations", envelope.residual_limitations
    )


def _review_format_or_error(output_format: str) -> None:
    if output_format not in {"text", "json"}:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            f"unsupported format {output_format!r}",
        )


@app.command("review-artifact")
def review_artifact_command(
    selection: Annotated[
        str,
        typer.Argument(help="Exact relative evidence-bundle selection below the root."),
    ],
    artifact_root: Annotated[
        Path,
        typer.Option("--artifact-root", help="Allowed local artifact root."),
    ],
    output_format: Annotated[
        str,
        typer.Option("--format", help="Output format: text or json."),
    ] = "text",
) -> None:
    """Review one stored bundle without executing a simulator or policy."""
    from hermes.review import (
        ReviewEnvelope,
        ReviewUnavailableError,
        canonical_envelope_bytes,
        review_artifact,
    )

    _review_format_or_error(output_format)
    try:
        result = review_artifact(artifact_root, selection)
        if not isinstance(result, ReviewEnvelope):
            raise TypeError("review facade returned an unsupported result")
    except ReviewUnavailableError as exc:
        _raise_cli_error(
            CliErrorCode.REVIEW_UNAVAILABLE,
            _bounded_artifact_text(exc.message),
            details={"reason": exc.reason.value},
            json_output=output_format == "json",
        )
    except ValueError as exc:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            _bounded_artifact_text(exc),
            json_output=output_format == "json",
        )
    except Exception as exc:
        _raise_cli_error(
            CliErrorCode.OPERATIONAL_ERROR,
            _bounded_artifact_text(f"{type(exc).__name__}: {exc}"),
            json_output=output_format == "json",
        )

    if output_format == "json":
        typer.echo(canonical_envelope_bytes(result).decode("utf-8"))
    else:
        _render_review_envelope_text(result)
    if result.verification.integrity == "INVALID_EVIDENCE":
        raise typer.Exit(code=30)


@app.command("review-compare")
def review_compare_command(
    baseline_selection: Annotated[
        str,
        typer.Argument(help="Exact relative baseline selection below the root."),
    ],
    candidate_selection: Annotated[
        str,
        typer.Argument(help="Exact relative candidate selection below the root."),
    ],
    artifact_root: Annotated[
        Path,
        typer.Option("--artifact-root", help="Allowed local artifact root."),
    ],
    output_format: Annotated[
        str,
        typer.Option("--format", help="Output format: text or json."),
    ] = "text",
) -> None:
    """Compare two independently reviewed stored bundles without execution."""
    from hermes.review import (
        ComparisonEnvelope,
        ReviewEnvelope,
        ReviewUnavailableError,
        canonical_envelope_bytes,
        compare_review_artifacts,
    )

    _review_format_or_error(output_format)
    try:
        result = compare_review_artifacts(
            artifact_root,
            baseline_selection,
            candidate_selection,
        )
        if not isinstance(result, (ComparisonEnvelope, ReviewEnvelope)):
            raise TypeError("comparison review facade returned an unsupported result")
    except ReviewUnavailableError as exc:
        _raise_cli_error(
            CliErrorCode.REVIEW_UNAVAILABLE,
            _bounded_artifact_text(exc.message),
            details={"reason": exc.reason.value},
            json_output=output_format == "json",
        )
    except ValueError as exc:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            _bounded_artifact_text(exc),
            json_output=output_format == "json",
        )
    except Exception as exc:
        _raise_cli_error(
            CliErrorCode.OPERATIONAL_ERROR,
            _bounded_artifact_text(f"{type(exc).__name__}: {exc}"),
            json_output=output_format == "json",
        )

    if isinstance(result, ReviewEnvelope):
        invalid_selection = result.artifact.locator.selected_relative_path
        if invalid_selection == baseline_selection:
            side = "BASELINE"
        elif invalid_selection == candidate_selection:
            side = "CANDIDATE"
        else:
            _raise_cli_error(
                CliErrorCode.OPERATIONAL_ERROR,
                "comparison facade returned an unknown artifact locator",
                json_output=output_format == "json",
            )
        details = {"side": side, "review": result.model_dump(mode="json")}
        if output_format == "text":
            _review_console().print("Invalid comparison side: " + side)
            _render_review_envelope_text(result)
        _raise_cli_error(
            CliErrorCode.INVALID_EVIDENCE,
            "One stored artifact failed integrity verification.",
            exit_code=30,
            details=details,
            json_output=output_format == "json",
        )

    if result.compatibility.status == "INCOMPATIBLE":
        details = {"comparison": result.model_dump(mode="json")}
        if output_format == "text":
            _render_comparison_envelope_text(result)
        _raise_cli_error(
            CliErrorCode.INCOMPATIBLE_EVIDENCE,
            "Stored artifacts are not comparable.",
            details=details,
            json_output=output_format == "json",
        )
    if output_format == "json":
        typer.echo(canonical_envelope_bytes(result).decode("utf-8"))
    else:
        _render_comparison_envelope_text(result)


@app.command("workbench")
def workbench_command(
    artifact_root: Annotated[
        Path,
        typer.Option(
            "--artifact-root",
            help="Required allowed root containing stored simulation evidence.",
        ),
    ],
    host: Annotated[
        str,
        typer.Option("--host", help="Numeric loopback bind address only."),
    ] = "127.0.0.1",
    port: Annotated[
        int,
        typer.Option("--port", help="Explicit local TCP port from 1 through 65535."),
    ] = 8501,
    no_browser: Annotated[
        bool,
        typer.Option("--no-browser", help="Do not ask Streamlit to open a browser."),
    ] = False,
) -> None:
    r"""Launch the local-only, read-only, simulation-only UI; install .\[workbench]."""
    from hermes.workbench import launch_workbench

    try:
        status = launch_workbench(
            artifact_root,
            host=host,
            port=port,
            no_browser=no_browser,
        )
    except ValueError as exc:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            _neutralize_artifact_text(exc),
        )
    except Exception as exc:
        _raise_cli_error(
            CliErrorCode.OPERATIONAL_ERROR,
            _neutralize_artifact_text(f"{type(exc).__name__}: {exc}"),
        )
    if status != 0:
        _raise_cli_error(
            CliErrorCode.OPERATIONAL_ERROR,
            f"workbench process exited with status {status}",
        )


@app.command("compare")
def compare_command(
    baseline_dir: Annotated[Path, typer.Argument(help="Baseline evidence bundle.")],
    candidate_dir: Annotated[Path, typer.Argument(help="Candidate evidence bundle.")],
    output_format: Annotated[
        str,
        typer.Option("--format", help="Output format: table or json."),
    ] = "table",
) -> None:
    """Compare two independently verified, compatible stored evidence bundles."""
    from hermes.comparison.compare import compare_artifacts
    from hermes.evidence.verification import inspect_artifact

    console = _phase_console()
    if output_format not in {"table", "json"}:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            f"unsupported format {output_format!r}",
        )
    try:
        baseline = inspect_artifact(baseline_dir)
        candidate = inspect_artifact(candidate_dir)
    except Exception as exc:
        _raise_cli_error(
            CliErrorCode.OPERATIONAL_ERROR,
            f"artifact inspection crashed: {type(exc).__name__}: {exc}",
        )

    invalid = [
        inspection
        for inspection in (baseline, candidate)
        if inspection.snapshot is None
    ]
    if invalid:
        details = {
            "artifacts": [
                inspection.verification.model_dump(mode="json")
                for inspection in invalid
            ]
        }
        if output_format == "json":
            _raise_cli_error(
                CliErrorCode.INVALID_EVIDENCE,
                "One or more stored artifacts failed verification.",
                exit_code=30,
                details=details,
                json_output=True,
            )
        else:
            render_cli_error(
                CliErrorCode.INVALID_EVIDENCE,
                "One or more stored artifacts failed verification.",
                30,
                details=details,
                console=console,
            )
            for inspection in invalid:
                _render_artifact_verification(inspection.verification)
        raise typer.Exit(code=30)

    assert baseline.snapshot is not None
    assert candidate.snapshot is not None
    comparison = compare_artifacts(baseline.snapshot, candidate.snapshot)
    if output_format == "json":
        comparison_payload = comparison.model_dump(mode="json")
        if not comparison.compatibility.comparable:
            _raise_cli_error(
                CliErrorCode.INCOMPATIBLE_EVIDENCE,
                "Stored artifacts are not comparable.",
                details={"comparison": comparison_payload},
                json_output=True,
            )
        typer.echo(
            canonical_json_bytes(comparison_payload).decode("utf-8")
        )
    else:
        console.print(SCOPE_BANNER)
        console.print(
            "Comparable: "
            + ("YES" if comparison.compatibility.comparable else "NO")
        )
        for reason in comparison.compatibility.reasons:
            console.print(f"Incompatibility: {reason}", style="red")
        for warning in comparison.compatibility.warnings:
            console.print(f"Warning: {warning}", style="yellow")
        if comparison.compatibility.comparable:
            table = Table(title="Stored evidence comparison")
            table.add_column("Dimension")
            table.add_column("Status")
            table.add_column("Baseline", overflow="fold")
            table.add_column("Candidate", overflow="fold")
            table.add_column("Explanation", overflow="fold")
            for dimension in comparison.dimensions:
                table.add_row(
                    dimension.name,
                    dimension.status.value,
                    str(dimension.baseline_value),
                    str(dimension.candidate_value),
                    dimension.explanation,
                )
            console.print(table)
    if not comparison.compatibility.comparable:
        _raise_cli_error(
            CliErrorCode.INCOMPATIBLE_EVIDENCE,
            "Stored artifacts are not comparable.",
        )


fixtures_app = typer.Typer(
    name="fixtures",
    help="Regenerate the SIMULATION-ONLY evidence fixtures the test suite depends on.",
    no_args_is_help=True,
    cls=HermesTyperGroup,
)
app.add_typer(fixtures_app, name="fixtures")


def _fixture_registry_path(repository_root: Path, registry: Path | None) -> Path:
    return registry or repository_root / "config" / "phase8-fixture-registry.yaml"


def _resolved_repository_root() -> Path:
    repository_root = discover_hermes_repository_root()
    if repository_root is None:
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            "Hermes repository root is unavailable",
        )
    return repository_root


@fixtures_app.command("list")
def fixtures_list_command(
    registry: Annotated[
        Path | None,
        typer.Option("--registry", help="Strict fixture-registry YAML path."),
    ] = None,
) -> None:
    """List every registered fixture and whether it is present locally."""
    from hermes.fixtures import FixtureRegistryError, load_fixture_registry

    console = _phase_console()
    repository_root = _resolved_repository_root()
    artifact_root = repository_root / "artifacts"
    try:
        loaded = load_fixture_registry(_fixture_registry_path(repository_root, registry))
    except FixtureRegistryError as exc:
        _raise_cli_error(CliErrorCode.CONFIGURATION_ERROR, str(exc))

    table = Table(title="SIMULATION-ONLY evidence fixtures")
    table.add_column("Run ID")
    table.add_column("Present")
    table.add_column("Needs simulator")
    table.add_column("Description", overflow="fold")
    for recipe in loaded.fixtures:
        table.add_row(
            recipe.run_id,
            "yes" if (artifact_root / recipe.run_id).is_dir() else "NO",
            "yes" if recipe.requires_simulator else "no",
            recipe.description,
        )
    console.print(table)


@fixtures_app.command("regenerate")
def fixtures_regenerate_command(
    registry: Annotated[
        Path | None,
        typer.Option("--registry", help="Strict fixture-registry YAML path."),
    ] = None,
    only: Annotated[
        list[str] | None,
        typer.Option("--only", help="Regenerate just this fixture; repeatable."),
    ] = None,
    force: Annotated[
        bool,
        typer.Option("--force", help="Replace fixtures that already exist."),
    ] = False,
    simulator: Annotated[
        bool,
        typer.Option(
            "--simulator/--no-simulator",
            help="Include fixtures that require a real local MetaDrive installation.",
        ),
    ] = True,
    allow_dirty: Annotated[
        bool,
        typer.Option(
            "--allow-dirty",
            help="Regenerate even though the worktree is dirty (records dirty provenance).",
        ),
    ] = False,
) -> None:
    """Rebuild evidence fixtures deterministically from committed inputs."""
    from hermes.fixtures import (
        FixtureRegistryError,
        load_fixture_registry,
        regenerate_fixture,
        select_recipes,
    )
    from hermes.fixtures.registry import repository_worktree_is_dirty

    console = _phase_console()
    repository_root = _resolved_repository_root()
    artifact_root = repository_root / "artifacts"
    artifact_root.mkdir(parents=True, exist_ok=True)
    try:
        loaded = load_fixture_registry(_fixture_registry_path(repository_root, registry))
        selected = select_recipes(loaded, only=only or None, include_simulator=simulator)
    except FixtureRegistryError as exc:
        _raise_cli_error(CliErrorCode.CONFIGURATION_ERROR, str(exc))

    if not allow_dirty and repository_worktree_is_dirty(repository_root):
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            "the worktree is dirty, so regenerated fixtures would record dirty provenance and "
            "diverge from the stored ones; commit or stash first, or pass --allow-dirty",
        )
    console.print(
        "SIMULATION-ONLY PROTOTYPE — regenerated fixtures are test inputs, not release evidence."
    )
    rebuilt = 0
    failures: list[str] = []
    for recipe in selected:
        destination = artifact_root / recipe.run_id
        if destination.exists() and not force:
            console.print(f"Skipped (already present): {recipe.run_id}")
            continue
        if recipe.derived_from is not None and recipe.derived_from in failures:
            failures.append(recipe.run_id)
            console.print(
                f"Skipped: {recipe.run_id} (its source {recipe.derived_from} failed)",
                style="red",
            )
            continue
        try:
            regenerate_fixture(
                recipe,
                registry=loaded,
                artifact_root=artifact_root,
                repository_root=repository_root,
                force=force,
            )
        except FixtureRegistryError as exc:
            # One unavailable simulator must not deny the caller every other fixture.
            failures.append(recipe.run_id)
            console.print(f"Failed: {recipe.run_id}: {exc}", style="red")
            continue
        rebuilt += 1
        console.print(f"Regenerated: {recipe.run_id}")
    console.print(f"Fixtures regenerated: {rebuilt} of {len(selected)} selected")
    if failures:
        _raise_cli_error(
            CliErrorCode.OPERATIONAL_ERROR,
            "these fixtures could not be regenerated: " + ", ".join(failures),
        )


@fixtures_app.command("verify")
def fixtures_verify_command(
    registry: Annotated[
        Path | None,
        typer.Option("--registry", help="Strict fixture-registry YAML path."),
    ] = None,
) -> None:
    """Report registered fixtures that are absent from the local artifact root."""
    from hermes.fixtures import FixtureRegistryError, load_fixture_registry, missing_fixtures

    console = _phase_console()
    repository_root = _resolved_repository_root()
    try:
        loaded = load_fixture_registry(_fixture_registry_path(repository_root, registry))
    except FixtureRegistryError as exc:
        _raise_cli_error(CliErrorCode.CONFIGURATION_ERROR, str(exc))

    absent = missing_fixtures(loaded, repository_root / "artifacts")
    if absent:
        console.print(f"Missing fixtures: {', '.join(absent)}")
        _raise_cli_error(
            CliErrorCode.CONFIGURATION_ERROR,
            "run `hermes fixtures regenerate` to restore the evidence fixtures",
        )
    console.print(f"All {len(loaded.fixtures)} registered fixtures are present.")


if __name__ == "__main__":
    app()
