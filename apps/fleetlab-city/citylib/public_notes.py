"""Explicit public documentation; never copy private review observations or handoffs."""

import csv
import io
import re
import shutil
from pathlib import Path

PUBLIC_NOTES = frozenset({"SF-REVIEW.md", "SF-METHODS.md", "SF-VISITOR-GUIDE.md"})
WORKSHEETS = frozenset({"sf-inspection-worksheet.csv", "sf-temporal-inspection-worksheet.csv"})
PRIVATE_MARKERS = re.compile(
    r"/(?:Users|home)/|file://|\.wrangler/|Unsent draft|Waymo-facing|"
    r"BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9]{30,}",
    re.I,
)
PUBLIC_ROOT = Path(__file__).resolve().parents[1] / "public-notes"


def check_text(text):
    if PRIVATE_MARKERS.search(text):
        raise ValueError("public documentation contains a private marker")


def check_worksheet(text):
    check_text(text)
    rows = csv.DictReader(io.StringIO(text))
    expected = [
        "obligation",
        "source_url",
        "reviewer",
        "date_time_timezone",
        "capture_revision_sha256",
        "observation",
        "disposition",
        "uncertainty",
    ]
    if rows.fieldnames != expected:
        raise ValueError("public worksheet schema changed")
    for row in rows:
        if (
            set(row) != set(expected)
            or any(row[key] for key in expected[2:] if key != "disposition")
            or row["disposition"] != "NOT_REVIEWED"
        ):
            raise ValueError("only blank inspection worksheets may be published")


def export_notes(out):
    target = out / "notes"
    target.mkdir(exist_ok=True)
    for name in PUBLIC_NOTES:
        source = PUBLIC_ROOT / name
        check_text(source.read_text())
        shutil.copyfile(source, target / name)


def export_worksheet(source, target):
    check_worksheet(source.read_text())
    shutil.copyfile(source, target)


def verify_notes(root):
    notes = root / "notes"
    if not notes.exists():
        return  # Small synthetic test fixtures do not include a reviewer workspace.
    names = {p.name for p in notes.iterdir()}
    if names - PUBLIC_NOTES - WORKSHEETS or not names >= PUBLIC_NOTES:
        raise ValueError("public notes must match the publication allowlist")
    for path in notes.iterdir():
        if not path.is_file() or path.is_symlink():
            raise ValueError("public notes must be regular files")
        text = path.read_text()
        if path.name in WORKSHEETS:
            check_worksheet(text)
        else:
            check_text(text)
            if path.read_bytes() != (PUBLIC_ROOT / path.name).read_bytes():
                raise ValueError("public notes differ from reviewed publication sources")
