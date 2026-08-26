"""Exact evidence-schema model families.

Schema 3.0 is produced for the ``adas_p0_longitudinal`` and
``adas_p0_longitudinal_fault`` ADAS profiles. Artifact parsing, verification, metrics,
consumers, and runtime production are schema-aware.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from hermes.domain.models import (
    ArtifactManifest,
    ArtifactManifestV2,
    ArtifactManifestV3,
    ExecutionContext,
    ExecutionContextV2,
    ExecutionContextV3,
    FindingsDocument,
    FindingsDocumentV2,
    FindingsDocumentV3,
    RunContext,
    RunContextV2,
    RunContextV3,
    RunMetrics,
    RunMetricsV2,
    RunMetricsV3,
    TraceEvent,
    TraceEventV2,
    TraceEventV3,
)

_ModelT = TypeVar("_ModelT", bound=BaseModel)


class EvidenceSchemaRegistryError(ValueError):
    """A declared evidence version cannot select and validate one exact model."""


RUN_METRICS_BY_EVIDENCE_SCHEMA: Mapping[str, type[BaseModel]] = MappingProxyType(
    {"1.0": RunMetrics, "2.0": RunMetricsV2, "3.0": RunMetricsV3}
)
RUN_CONTEXT_BY_EVIDENCE_SCHEMA: Mapping[str, type[BaseModel]] = MappingProxyType(
    {"1.0": RunContext, "2.0": RunContextV2, "3.0": RunContextV3}
)
EXECUTION_CONTEXT_BY_EVIDENCE_SCHEMA: Mapping[str, type[BaseModel]] = MappingProxyType(
    {"1.0": ExecutionContext, "2.0": ExecutionContextV2, "3.0": ExecutionContextV3}
)
TRACE_EVENT_BY_EVIDENCE_SCHEMA: Mapping[str, type[BaseModel]] = MappingProxyType(
    {"1.0": TraceEvent, "2.0": TraceEventV2, "3.0": TraceEventV3}
)
ARTIFACT_MANIFEST_BY_EVIDENCE_SCHEMA: Mapping[str, type[BaseModel]] = MappingProxyType(
    {"1.0": ArtifactManifest, "2.0": ArtifactManifestV2, "3.0": ArtifactManifestV3}
)
FINDINGS_DOCUMENT_BY_EVIDENCE_SCHEMA: Mapping[str, type[BaseModel]] = MappingProxyType(
    {"1.0": FindingsDocument, "2.0": FindingsDocumentV2, "3.0": FindingsDocumentV3}
)


def validate_declared_evidence_model(
    payload: object,
    *,
    registry: Mapping[str, type[_ModelT]],
    document_name: str,
) -> _ModelT:
    """Validate one decoded object with the exact class its declared version selects."""
    if not isinstance(payload, dict):
        raise EvidenceSchemaRegistryError(f"{document_name} must contain an object")
    if "evidence_schema_version" not in payload:
        raise EvidenceSchemaRegistryError(
            f"{document_name} is missing required evidence_schema_version"
        )
    version: Any = payload["evidence_schema_version"]
    if not isinstance(version, str) or version not in registry:
        supported = ", ".join(registry)
        raise EvidenceSchemaRegistryError(
            f"{document_name} evidence schema {version!r} is unsupported; "
            f"supported versions: {supported}"
        )
    model_type = registry[version]
    try:
        parsed = model_type.model_validate(payload)
    except ValidationError as exc:
        raise EvidenceSchemaRegistryError(
            f"{document_name} schema validation failed: {exc}"
        ) from exc
    if type(parsed) is not model_type:
        raise EvidenceSchemaRegistryError(
            f"{document_name} did not return the exact declared-version model"
        )
    return parsed
