#!/usr/bin/env python3
"""Make a separately identified security projection of a retained viewer; never edit its source."""

import argparse
import gzip
import importlib.util
import json
import shutil
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "launch", Path(__file__).with_name("prepare-launch.py")
)
launch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launch)
from citylib.public_notes import WORKSHEETS, export_notes, export_worksheet  # noqa: E402


def harden(source, out):
    source, out = Path(source), Path(out)
    if (
        out.exists()
        or source.resolve() == out.resolve()
        or source.resolve() in out.resolve().parents
    ):
        raise ValueError("new output must be separate and absent")
    before = launch.inventory(source)
    release = json.loads((source / "release.json").read_text())
    if release["files"] != {k: v for k, v in before.items() if k != "release.json"}:
        raise ValueError("prior inventory mismatch")
    launch.safe_copy(source, out, before)
    # Remove only the new copy's notes; originals are retained privately for history.
    if (out / "notes").exists():
        shutil.rmtree(out / "notes")
    export_notes(out)
    for name in WORKSHEETS:
        if (source / "notes" / name).exists():
            export_worksheet(source / "notes" / name, out / "notes" / name)
    public_web = Path(__file__).resolve().parents[1] / "web"
    for name in ("qualification-progress.mjs", "qualification.mjs", "temporal-candidate.mjs"):
        shutil.copyfile(public_web / name, out / name)
    app = (out / "app.mjs").read_text()
    replacements = {
        "if (!titles[view]) return;": "if (!Object.hasOwn(titles, view)) view = 'welcome';",
        "if (titles[view] && view !== currentView)": (
            "if (Object.hasOwn(titles, view) && view !== currentView)"
        ),
        "titles[location.hash.slice(1)]?": "Object.hasOwn(titles, location.hash.slice(1))?",
    }
    for old, new in replacements.items():
        if old not in app:
            raise ValueError("prior route contract changed; inspect before projecting")
        app = app.replace(old, new)
    (out / "app.mjs").write_text(app)
    index = (out / "index.html").read_text()
    old = "An independent simulation project within Hermes. Built with AI assistance."
    if old not in index:
        raise ValueError("prior footer contract changed")
    index = index.replace(
        old,
        (
            "An independent educational project by Bo-Huei Lin. Not "
            "affiliated with or endorsed by Waymo, Zoox, or their partners."
        ),
    )
    (out / "index.html").write_text(index)
    release["security_projection_of"] = before["release.json"]["sha256"]
    release["publication_semantics"] = (
        "Build-time state only. Educational scope; see /publication.json "
        "for hosting selection. No operational authority."
    )
    for path in list(out.rglob("*.gz")):
        original = Path(str(path)[:-3])
        if original.is_file():
            path.write_bytes(gzip.compress(original.read_bytes(), mtime=0))
    release["files"] = {k: v for k, v in launch.inventory(out).items() if k != "release.json"}
    launch.write_json(out / "release.json", release)
    launch.verify_viewer(out, "security rollback")
    after = launch.inventory(out)
    # Every data byte, including catalogue and compressed files, must be unchanged.
    if any(after.get(k) != v for k, v in before.items() if k.startswith("data/")):
        raise ValueError("security projection changed scientific data")
    if launch.inventory(source) != before:
        raise ValueError("prior source mutated")
    return {
        "source_manifest": before["release.json"]["sha256"],
        "manifest": launch.sha_file(out / "release.json"),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    print(json.dumps(harden(**vars(parser.parse_args())), indent=2))
