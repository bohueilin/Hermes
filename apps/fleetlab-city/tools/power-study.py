#!/usr/bin/env python3
"""Explicit local-only frozen power-study lifecycle; never replaces artifacts."""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.power_analysis import analyze_study
from citylib.power_protocol import contained
from citylib.power_study import execute_study, freeze_study, write_new


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["freeze", "preflight", "evaluate", "analyze"])
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument(
        "--output", required=True, type=Path, help="Explicit frozen study directory"
    )
    parser.add_argument("--mode", choices=["preflight", "evaluate"], help="Required for analyze")
    args = parser.parse_args()
    root = args.root.absolute()
    output = contained(root, args.output)
    try:
        if args.command == "freeze":
            result = freeze_study(root, output)
        elif args.command == "analyze":
            if args.mode is None:
                parser.error("--mode required for analyze")
            result = analyze_study(root, output, args.mode)
            write_new(output / f"{args.mode}-analysis.json", result)
        else:
            result = execute_study(root, output, args.command)
        print(json.dumps(result, indent=2, allow_nan=False))
        return (
            0
            if result.get("status", result.get("analysis_status", "COMPLETE")) == "COMPLETE"
            else 2
        )
    except (ValueError, OSError) as exc:
        print(json.dumps({"status": "REFUSED", "reason": str(exc)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
