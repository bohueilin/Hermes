"""Bind the published open-obligation view to the frozen reviewer workspace."""

from .contracts import digest, load_json, save_json
from .map_review_v1 import validate_review
from .public_notes import export_notes, export_worksheet
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
    export_notes(out)
    export_worksheet(
        workspace / "inspection-worksheet.csv", out / "notes/sf-inspection-worksheet.csv"
    )
    return envelope
