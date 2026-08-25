from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

import pytest

from hermes.adapters.metadrive import MetaDriveAdapter, MetaDriveDependencies
from hermes.adas.config import load_adas_config
from hermes.adas.policy import AdasLongitudinalPolicy
from hermes.domain.enums import IntegrityStatus
from hermes.evidence.artifacts import bundle_digest
from hermes.evidence.canonical import canonical_json_bytes, sha256_hex
from hermes.evidence.verification import verify_artifact
from hermes.runtime.orchestrator import RunConfigurationError, execute_metadrive_run

SIMULATOR_COMMIT = "85e5dadc6c7436d324348f6e3d8f8e680c06b4db"


class _Lane:
    def local_coordinates(self, position: list[float]) -> tuple[float, float]:
        return float(position[0]), float(position[1])


class _Navigation:
    route_completion = 0.0


class _Agent:
    def __init__(self) -> None:
        self.position = [5.0, 0.0]
        self.speed = 0.0
        self.lane = _Lane()
        self.navigation = _Navigation()


class _TrackingEnv:
    instances: list[_TrackingEnv] = []

    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config
        self.agent = _Agent()
        self.steps = 0
        self.closed = False
        self.reset_called = False
        type(self).instances.append(self)

    def reset(self, *, seed: int):
        assert seed == 7
        self.reset_called = True
        return [], {"route_completion": 0.0}

    def step(self, action):
        self.steps += 1
        self.agent.speed = self.steps * 0.3
        self.agent.position = [5.0 + self.steps * 0.03, 0.0]
        self.agent.navigation.route_completion = self.steps / 2
        terminal = self.steps == 2
        return [], 0.0, terminal, False, {
            "action": action,
            "route_completion": self.agent.navigation.route_completion,
            "crash": False,
            "out_of_road": False,
            "arrive_dest": terminal,
            "max_step": False,
        }

    def close(self) -> None:
        self.closed = True


class _IDM:
    def __init__(self, control_object, seed: int) -> None:
        del control_object, seed

    def act(self):
        return [0.0, 0.5]

    def destroy(self) -> None:
        pass


class _IdentityPolicy:
    def __init__(self, name: str, version: str) -> None:
        self.name = name
        self.version = version
        self.reset_called = False

    @property
    def evidence_config(self):
        raise AssertionError("wrong-identity policy evidence must not be read")

    @property
    def simulated_latency_ms(self):
        raise AssertionError("wrong-identity policy latency must not be read")

    def reset(self, scenario, seed: int) -> None:
        del scenario, seed
        self.reset_called = True
        raise AssertionError("wrong-identity policy must not be reset")

    def act(self, observation):
        del observation
        raise AssertionError("wrong-identity policy must not act")


class _TrackingAdapter(MetaDriveAdapter):
    def __init__(self, *, dependencies: MetaDriveDependencies) -> None:
        super().__init__(dependencies=dependencies)
        self.reset_called = False
        self.close_count = 0

    def reset(self, scenario, seed: int):
        self.reset_called = True
        return super().reset(scenario, seed)

    def close(self) -> None:
        self.close_count += 1
        super().close()


def _dependencies(repository_root: Path) -> MetaDriveDependencies:
    return MetaDriveDependencies(
        environment_factory=_TrackingEnv,
        idm_policy_factory=_IDM,
        action_array=lambda values: list(values),
        simulator_version="0.4.3",
        simulator_commit=SIMULATOR_COMMIT,
        simulator_source=(
            repository_root
            / "third_party"
            / "metadrive"
            / "metadrive"
            / "__init__.py"
        ),
    )


def _observation_fault_scenario(tmp_path: Path) -> Path:
    path = tmp_path / "metadrive-adas-observation-delay.yaml"
    path.write_text(
        """\
schema_version: "4.0"
name: metadrive_adas_observation_delay_probe
version: "1.0"
description: Exact policy-identity eligibility probe for observation delay.
adapter: metadrive
control:
  frequency_hz: 10
  horizon_steps: 3
  target_speed_mps: 0.6
  # Simulator-measured 20 m/s full-brake peak from
  # evidence/calibration/metadrive-brake-curve-0.4.3.json.
  max_braking_mps2: 12.982444763183452
initial_state:
  speed_mps: 0.0
  lateral_offset_m: 0.0
road:
  destination_distance_m: 20.0
  boundary_tolerance_m: 1.5
hazards: {}
faults:
  schema_version: "1.0"
  name: observation_delay_probe
  version: "1.0"
  label: illustrative_simulation_faults_not_real_vehicle_limits
  observation_delay_steps: 1
adas:
  enabled:
    - fcw
    - aeb
  expected_fcw:
    kind: none
  expected_aeb:
    kind: forbidden
""",
        encoding="utf-8",
    )
    return path


def _control_only_scenario(tmp_path: Path) -> Path:
    path = tmp_path / "metadrive-idm-control-delay.yaml"
    path.write_text(
        """\
schema_version: "3.0"
name: metadrive_idm_control_delay_probe
version: "1.0"
description: IDM remains eligible for control-side faults.
adapter: metadrive
control:
  frequency_hz: 10
  horizon_steps: 3
  target_speed_mps: 0.6
initial_state:
  speed_mps: 0.0
  lateral_offset_m: 0.0
road:
  destination_distance_m: 20.0
  boundary_tolerance_m: 1.5
hazards: {}
faults:
  schema_version: "1.0"
  name: control_delay_probe
  version: "1.0"
  label: illustrative_simulation_faults_not_real_vehicle_limits
  control_delay_steps: 1
  max_brake: 0.5
""",
        encoding="utf-8",
    )
    return path


def _adapter(repository_root: Path) -> MetaDriveAdapter:
    return MetaDriveAdapter(dependencies=_dependencies(repository_root))


def test_default_idm_rejects_observation_fault_before_adapter_construction(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    constructed = False

    def adapter_factory():
        nonlocal constructed
        constructed = True
        raise AssertionError("default IDM rejection must precede adapter construction")

    artifacts = tmp_path / "default-artifacts"
    artifacts.mkdir()
    with pytest.raises(RunConfigurationError, match="observation faults require policy"):
        execute_metadrive_run(
            scenario_path=_observation_fault_scenario(tmp_path),
            gate_config_path=repository_root / "config" / "gates.adas.yaml",
            seed=7,
            run_id="default-idm-observation-fault",
            artifact_root=artifacts,
            repository_root=repository_root,
            adapter_factory=adapter_factory,
        )

    assert constructed is False
    assert list(artifacts.iterdir()) == []


@pytest.mark.parametrize(
    ("policy_name", "policy_version"),
    [
        ("metadrive-idm", "1.0"),
        ("arbitrary-custom-policy", "1.0"),
        ("adas-longitudinal", "2.0"),
    ],
)
def test_custom_wrong_policy_identity_rejects_before_any_reset_and_closes_adapter(
    repository_root: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    policy_name: str,
    policy_version: str,
) -> None:
    def forbid_fault_reset(*args, **kwargs):
        del args, kwargs
        raise AssertionError("wrong-identity policy must reject before fault reset")

    monkeypatch.setattr(
        "hermes.runtime.orchestrator.DeterministicFaultInjector.reset",
        forbid_fault_reset,
    )
    _TrackingEnv.instances.clear()
    policy = _IdentityPolicy(policy_name, policy_version)
    adapter = _TrackingAdapter(dependencies=_dependencies(repository_root))
    artifacts = tmp_path / f"wrong-{policy_name}-{policy_version}"
    artifacts.mkdir()

    with pytest.raises(RunConfigurationError, match="observation faults require policy"):
        execute_metadrive_run(
            scenario_path=_observation_fault_scenario(tmp_path),
            gate_config_path=repository_root / "config" / "gates.adas.yaml",
            seed=7,
            run_id="wrong-policy-observation-fault",
            artifact_root=artifacts,
            repository_root=repository_root,
            adapter_factory=lambda: adapter,
            policy_factory=lambda _adapter: policy,
        )

    assert policy.reset_called is False
    assert adapter.reset_called is False
    assert adapter.close_count == 1
    assert _TrackingEnv.instances == []
    assert list(artifacts.iterdir()) == []


def test_wrong_policy_identity_and_close_failure_remain_cli_visible_configuration_error(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    _TrackingEnv.instances.clear()

    class CloseFailingAdapter(_TrackingAdapter):
        def close(self) -> None:
            super().close()
            raise RuntimeError("synthetic adapter cleanup failure")

    policy = _IdentityPolicy("arbitrary-custom-policy", "1.0")
    adapter = CloseFailingAdapter(dependencies=_dependencies(repository_root))
    artifacts = tmp_path / "wrong-policy-close-failure"
    artifacts.mkdir()

    with pytest.raises(RunConfigurationError) as raised:
        execute_metadrive_run(
            scenario_path=_observation_fault_scenario(tmp_path),
            gate_config_path=repository_root / "config" / "gates.adas.yaml",
            seed=7,
            run_id="wrong-policy-close-failure",
            artifact_root=artifacts,
            repository_root=repository_root,
            adapter_factory=lambda: adapter,
            policy_factory=lambda _adapter: policy,
        )

    rendered = str(raised.value)
    assert "observation faults require policy" in rendered
    assert "adapter close also failed" in rendered
    assert "RuntimeError: synthetic adapter cleanup failure" in rendered
    assert policy.reset_called is False
    assert adapter.reset_called is False
    assert adapter.close_count == 1
    assert _TrackingEnv.instances == []
    assert list(artifacts.iterdir()) == []


def test_idm_control_only_faults_remain_legal(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    artifacts = tmp_path / "idm-control-artifacts"
    artifacts.mkdir()

    outcome = execute_metadrive_run(
        scenario_path=_control_only_scenario(tmp_path),
        gate_config_path=repository_root / "config" / "gates.phase2.yaml",
        seed=7,
        run_id="idm-control-only",
        artifact_root=artifacts,
        repository_root=repository_root,
        adapter_factory=lambda: _adapter(repository_root),
    )

    assert outcome.verification.integrity is IntegrityStatus.INTERNALLY_CONSISTENT


def test_exact_adas_policy_can_publish_truthful_observation_delay(
    repository_root: Path,
    tmp_path: Path,
) -> None:
    artifacts = tmp_path / "adas-delay-artifacts"
    artifacts.mkdir()
    config = load_adas_config(repository_root / "config" / "adas" / "baseline.yaml")

    outcome = execute_metadrive_run(
        scenario_path=_observation_fault_scenario(tmp_path),
        gate_config_path=repository_root / "config" / "gates.adas.yaml",
        seed=7,
        run_id="adas-observation-delay",
        artifact_root=artifacts,
        repository_root=repository_root,
        adapter_factory=lambda: _adapter(repository_root),
        policy_factory=lambda _adapter: AdasLongitudinalPolicy(config),
    )

    assert outcome.verification.integrity is IntegrityStatus.INTERNALLY_CONSISTENT
    assert verify_artifact(outcome.artifact_path).integrity is IntegrityStatus.INTERNALLY_CONSISTENT


def _write_canonical(path: Path, payload: object) -> None:
    path.write_bytes(canonical_json_bytes(payload) + b"\n")


def _refresh_envelope(bundle: Path) -> None:
    manifest_path = bundle / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for filename in manifest["file_digests"]:
        manifest["file_digests"][filename] = sha256_hex((bundle / filename).read_bytes())
    _write_canonical(manifest_path, manifest)
    payloads = {
        path.name: path.read_bytes()
        for path in bundle.iterdir()
        if path.name != "bundle.sha256"
    }
    (bundle / "bundle.sha256").write_text(bundle_digest(payloads) + "\n", encoding="ascii")


def _rewrite_policy_identity(bundle: Path, field: str, value: str) -> None:
    context_path = bundle / "execution-context.json"
    context = json.loads(context_path.read_text(encoding="utf-8"))
    context["policy"][field] = value
    context["run_context"][f"policy_{field}"] = value
    _write_canonical(context_path, context)

    manifest_path = bundle / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest[f"policy_{field}"] = value
    _write_canonical(manifest_path, manifest)

    events = [
        json.loads(line)
        for line in (bundle / "events.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    previous = "0" * 64
    for event in events:
        event["run_context"][f"policy_{field}"] = value
        event["previous_hash"] = previous
        material = dict(event)
        material.pop("current_hash", None)
        event["current_hash"] = sha256_hex(canonical_json_bytes(material))
        previous = event["current_hash"]
    (bundle / "events.jsonl").write_bytes(
        b"".join(canonical_json_bytes(event) + b"\n" for event in events)
    )
    (bundle / "trace.sha256").write_text(previous + "\n", encoding="ascii")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["trace_digest"] = previous
    _write_canonical(manifest_path, manifest)
    _refresh_envelope(bundle)


@pytest.mark.parametrize(
    ("field", "value"),
    [("name", "arbitrary-custom-policy"), ("version", "2.0")],
)
def test_stored_observation_fault_bundle_requires_exact_adas_policy_identity(
    repository_root: Path,
    tmp_path: Path,
    field: str,
    value: str,
) -> None:
    artifacts = tmp_path / f"stored-source-{field}"
    artifacts.mkdir()
    config = load_adas_config(repository_root / "config" / "adas" / "baseline.yaml")
    source = execute_metadrive_run(
        scenario_path=_observation_fault_scenario(tmp_path),
        gate_config_path=repository_root / "config" / "gates.adas.yaml",
        seed=7,
        run_id="stored-policy-source",
        artifact_root=artifacts,
        repository_root=repository_root,
        adapter_factory=lambda: _adapter(repository_root),
        policy_factory=lambda _adapter: AdasLongitudinalPolicy(config),
    ).artifact_path
    tampered = tmp_path / f"stored-policy-{field}"
    shutil.copytree(source, tampered)
    _rewrite_policy_identity(tampered, field, value)

    result = verify_artifact(tampered)

    assert result.integrity is IntegrityStatus.INVALID
    assert any(
        "MetaDrive observation faults require policy adas-longitudinal 1.0" in error
        for error in result.errors
    )
