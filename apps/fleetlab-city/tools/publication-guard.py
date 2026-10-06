#!/usr/bin/env python3
"""Local privacy backstop for staged content and every outgoing commit; not an authority gate."""

import argparse
import fnmatch
import re
import subprocess
import sys
from pathlib import Path

SECRET = re.compile(
    r"gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|"
    r"BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY|/+(?:Users|home)/[^\s/]+/"
)


def git(*args, cwd=None):
    return subprocess.check_output(["git", *args], cwd=cwd).decode("utf-8", errors="replace")


def forbidden_path(name, private=()):
    parts = Path(name).parts
    return (
        ".wrangler" in parts
        or "cf.json" in parts
        or Path(name).name.startswith(".env")
        and Path(name).name != ".env.example"
        or any(
            fnmatch.fnmatchcase(name, pattern.rstrip("/")) or name.startswith(pattern)
            for pattern in private
        )
    )


def inspect_diff(paths, patch, private=()):
    # Return counts only: a rejected private filename or value must not enter logs.
    blocked_paths = sum(forbidden_path(path, private) for path in paths)
    blocked_lines = 0
    in_hunk = False
    for line in patch.splitlines():
        if line.startswith("diff --git "):
            in_hunk = False
        elif line.startswith("@@"):
            in_hunk = True
        elif in_hunk and line.startswith("+"):
            blocked_lines += bool(SECRET.search(line[1:]))
    return blocked_paths, blocked_lines


def check(staged=False, revision=None, cwd=None):
    common = Path(git("rev-parse", "--git-common-dir", cwd=cwd).strip())
    if not common.is_absolute():
        common = Path(cwd or ".") / common
    private_file = common / "info/fleetlab-private-patterns"
    private = (
        [s for s in private_file.read_text().splitlines() if s and not s.startswith("#")]
        if private_file.exists()
        else []
    )
    if staged:
        args = ["diff", "--cached"]
    else:
        args = ["diff-tree", "--root", "-m", "--no-commit-id", "-r", revision]
    paths = git(*args, "--name-only", "--diff-filter=ACMR", "-z", cwd=cwd).split("\0")
    patch = git(*args, "--no-ext-diff", "--unified=0", "-p", cwd=cwd)
    paths = [p for p in paths if p]
    blocked_paths, blocked_lines = inspect_diff(paths, patch, private)
    # Git omits binary hunks, including UTF-16. Inspect those blobs without
    # printing them; zero-byte interleaving must not hide an ASCII secret marker.
    for path in paths:
        reference = f":{path}" if staged else f"{revision}:{path}"
        raw = subprocess.check_output(["git", "show", reference], cwd=cwd)
        if b"\0" in raw:
            text = raw.replace(b"\0", b"").decode("utf-8", errors="replace")
            blocked_lines += bool(SECRET.search(text))
    return blocked_paths, blocked_lines


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--staged", action="store_true")
    parser.add_argument("--pre-push", action="store_true")
    args = parser.parse_args()
    failures = []
    if args.staged:
        failures.append(check(staged=True))
    elif args.pre_push:
        for line in sys.stdin:
            _, local, _, remote = line.split()
            if set(local) == {"0"}:
                continue
            # New remote branches inspect the entire outgoing history, fail closed.
            selection = local if set(remote) == {"0"} else f"{remote}..{local}"
            for revision in git("rev-list", selection).splitlines():
                failures.append(check(revision=revision))
    else:
        parser.error("select --staged or --pre-push")
    if any(a or b for a, b in failures):
        print(
            (
                "Publication guard: private/tool-state paths or sensitive added "
                "lines found; inspect locally."
            ),
            file=sys.stderr,
        )
        return 1
    print("Publication guard: checked content passed. This is not deployment authorization.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
