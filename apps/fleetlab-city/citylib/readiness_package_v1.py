"""Bind the published open-obligation view to the frozen reviewer workspace."""

import shutil

from .contracts import digest, load_json, save_json
from .map_review_v1 import validate_review
from .review_workspace_v1 import candidate_identity

REQUIREMENTS = "b32ab2e295c67c22a820b65b4a9a8fab4b347a2ea3ed230e252b4fabc98d98d8"
CHECKPOINT = "b1f184bdf132ebd64074333a6036ce747ac33816b5f310822c6b34f90b548ffb"


def export_readiness(root, candidate, out):
    workspace = root / "build/fleetlab-city/reviews/sf-v2-review-r1"
    requirements = load_json(workspace / "requirements.json", 2 * 1024 * 1024)
    if digest(requirements) != REQUIREMENTS or requirements["candidate"] != candidate_identity(
        candidate
    ):
        raise ValueError("review requirements differ from frozen candidate/checkpoint")
    gates = {
        "source_accounting": "PASS"
        if candidate["coverage.json"]["accounting_complete"]
        else "HOLD",
        "class_budgets": "HOLD",
        "district_scope": "HOLD",
        "continuity": "NOT_RUN",
    }
    envelope = validate_review(workspace / "history.json", requirements, CHECKPOINT, gates)
    save_json(out / "data/sf-review-envelope.json", envelope)
    save_json(out / "data/sf-review-requirements.json", requirements)
    (out / "notes").mkdir(exist_ok=True)
    shutil.copyfile(
        workspace / "inspection-worksheet.csv", out / "notes/sf-inspection-worksheet.csv"
    )
    for name in (
        "FLEETLAB_CONTINUITY_IMPLEMENTATION_V1.md",
        "FLEETLAB_VEHICLE_CURB_READINESS_V1.md",
        "FLEETLAB_SF_VALIDATION_SESSION.md",
        "FLEETLAB_SF_COMPLETION_STATUS_2026-09-29.md",
    ):
        shutil.copyfile(root / "docs" / name, out / "notes" / name)
    return envelope
