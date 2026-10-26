import hashlib
import subprocess
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
#: The held Fleet day film must stay outside every commit until its re-render is approved.
HELD_FILM = "apps/fleetlab-city/enhancement-media/FL-V1-one-fleet-day-film.mp4"


def test_gitignore_is_pinned_byte_for_byte() -> None:
    data = (REPOSITORY_ROOT / ".gitignore").read_bytes()

    assert len(data) == 2108
    assert (
        hashlib.sha256(data).hexdigest()
        == "582cda30b42d0e33024c3d6a41c5f2ce42a902c073540368b687961c498d6058"
    )


def test_gitignore_keeps_the_held_fleet_day_film_ignored() -> None:
    result = subprocess.run(
        ["git", "check-ignore", "--no-index", "--verbose", HELD_FILM],
        cwd=REPOSITORY_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.startswith(".gitignore:"), result.stdout
