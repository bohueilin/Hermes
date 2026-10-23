#!/usr/bin/env python3
"""Prepare review work or validate actual observations without modifying map packs."""

import argparse
import json
import sys
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
ROOT = APP.parents[1]
sys.path.insert(0, str(APP))
from citylib.contracts import load_json, read_bundle  # noqa: E402
from citylib.map_review_v1 import validate_review  # noqa: E402
from citylib.review_workspace_v1 import candidate_identity, prepare_review  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_subparsers(dest="mode", required=True)
    prepare = modes.add_parser("prepare")
    prepare.add_argument("--out", type=Path, required=True)
    review = modes.add_parser("validate")
    review.add_argument("--requirements", type=Path, required=True)
    review.add_argument("--history", type=Path, required=True)
    review.add_argument("--checkpoint", help="Independently retained manifest digest")
    args = parser.parse_args()
    if args.mode == "prepare":
        result = prepare_review(ROOT, args.out)
    else:
        candidate = read_bundle(ROOT / "build/fleetlab-city/packs/sf-v2")
        requirements = load_json(args.requirements, 2 * 1024 * 1024)
        if requirements.get("candidate") != candidate_identity(candidate):
            raise ValueError("requirements name a different candidate/source snapshot")
        result = validate_review(
            args.history,
            requirements,
            args.checkpoint,
            {
                "source_accounting": "PASS"
                if candidate["coverage.json"]["accounting_complete"]
                else "HOLD",
                "class_budgets": "HOLD",
                "district_scope": "HOLD",
                "continuity": "NOT_RUN",
            },
        )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
