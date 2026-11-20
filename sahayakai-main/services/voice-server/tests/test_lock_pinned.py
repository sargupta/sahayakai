"""CLASS GATE — the lock is the package set production ran, and nobody re-resolves it by accident.

Re-review rereview-0b #9/#10: requirements.lock was resolved at
--exclude-newer 2026-10-03T06:40:00Z, revision 00037's creation time, not the
time its image was built, so it carried google-genai 2.28.0 and firestore
2.34.0, released after 00037's image was built. And PROMOTE.md and the
cloudbuild.yaml header told the operator to run scripts/lock.sh, which had no
date pin and would resolve that day's pipecat and google-genai, as a step of
every promotion.

The class is "the dependency set changes without anyone deciding it". The gate:
  * scripts/lock.sh never resolves without --exclude-newer, pins one cutoff
    (PINNED_CUTOFF), and resolves for the image's target with hashes;
  * PROMOTE.md and the cloudbuild.yaml header name that same cutoff and say
    not to regenerate the lock to promote;
  * the committed lock was resolved at exactly that cutoff. In the Cloud
    Build test step (VOICE_SERVER_REQUIRE_PINNED_LOCK=1) a mismatch fails the
    build; elsewhere it is reported as an expected failure until the lock is
    regenerated (that needs PyPI access).
"""

from __future__ import annotations

import os
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
LOCK_SH = (ROOT / "scripts" / "lock.sh").read_text(encoding="utf-8")
PROMOTE = (ROOT / "PROMOTE.md").read_text(encoding="utf-8")
CLOUDBUILD = (ROOT / "cloudbuild.yaml").read_text(encoding="utf-8")
LOCK = ROOT / "requirements.lock"
REQUIRE_PINNED_LOCK_ENV = "VOICE_SERVER_REQUIRE_PINNED_LOCK"
ISO = r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ"


def pinned_cutoff(script: str) -> str | None:
    m = re.search(rf'^PINNED_CUTOFF="({ISO})"$', script, re.M)
    return m.group(1) if m else None


def lock_script_problems(script: str) -> list[str]:
    problems: list[str] = []
    if pinned_cutoff(script) is None:
        problems.append("lock.sh pins no PINNED_CUTOFF")
    code = [line for line in script.splitlines() if not line.lstrip().startswith("#")]
    joined = " ".join(code).replace("\\", " ")
    resolvers = re.findall(r"(?:uv pip compile|pip-compile|pip install|uv lock|uv add)[^;&|]*", joined)
    if not resolvers:
        problems.append("lock.sh runs no resolver")
    for cmd in resolvers:
        if not cmd.startswith("uv pip compile"):
            problems.append(f"lock.sh resolves with something other than uv pip compile: {cmd[:60]}")
            continue
        for flag in ('--exclude-newer "$CUTOFF"', "--generate-hashes", "--python-version 3.12",
                     "--python-platform x86_64-manylinux_2_28", "-o requirements.lock"):
            if flag not in cmd:
                problems.append(f"lock.sh's resolve lacks {flag}")
    if 'CUTOFF="${1:-$PINNED_CUTOFF}"' not in script:
        problems.append("lock.sh does not default to the pinned cutoff")
    return problems


def lock_cutoff(text: str) -> str | None:
    header = "\n".join(text.splitlines()[:3])
    m = re.search(rf"--exclude-newer ({ISO})", header)
    return m.group(1) if m else None


def test_lock_sh_always_resolves_at_a_pinned_time():
    assert lock_script_problems(LOCK_SH) == []


@pytest.mark.parametrize("bad", [
    ('PINNED_CUTOFF="2026-10-01T10:36:44Z"', 'PINNED_CUTOFF=""'),
    ('--exclude-newer "$CUTOFF" ', ""),
    ("uv pip compile requirements.in", "pip-compile requirements.in"),
    ('CUTOFF="${1:-$PINNED_CUTOFF}"', 'CUTOFF="${1:-}"'),
], ids=["no pin", "no exclude-newer", "pip-compile", "no default"])
def test_the_script_checker_rejects_an_unpinned_resolve(bad):
    old, new = bad
    assert old in LOCK_SH
    assert lock_script_problems(LOCK_SH.replace(old, new, 1))


def test_the_old_unpinned_script_is_rejected():
    old = '''set -euo pipefail
cd "$(dirname "$0")/.."
docker run --rm --platform linux/amd64 -v "$PWD":/src -w /src python:3.12-slim bash -ceu '
  pip install --quiet --no-cache-dir pip-tools==7.4.1
  pip-compile --quiet --generate-hashes --allow-unsafe --strip-extras \\
    --output-file requirements.lock requirements.in
'
'''
    assert lock_script_problems(old)


def test_the_docs_name_the_same_cutoff_and_say_not_to_regenerate():
    cutoff = pinned_cutoff(LOCK_SH)
    assert cutoff
    assert f"`{cutoff}`" in PROMOTE and "do not regenerate it as part of a" in PROMOTE.replace("\n   ", " ")
    header = CLOUDBUILD.split("\nsteps:", 1)[0]
    assert cutoff in header and "Do not regenerate it to promote" in header
    for text in (PROMOTE, header):
        assert "regenerate with scripts/lock.sh" not in text and "Generate it with `scripts/lock.sh`" not in text


def test_the_build_requires_the_pinned_lock():
    test_step = CLOUDBUILD.split("\n  - id: test", 1)[1].split("\n  - id: ", 1)[0]
    assert f"{REQUIRE_PINNED_LOCK_ENV}=1" in test_step


def test_the_committed_lock_was_resolved_at_the_pinned_cutoff():
    if not LOCK.exists():
        pytest.skip("requirements.lock not generated yet; the image build fails closed until it is")
    cutoff, pinned = lock_cutoff(LOCK.read_text(encoding="utf-8")), pinned_cutoff(LOCK_SH)
    if cutoff != pinned and os.environ.get(REQUIRE_PINNED_LOCK_ENV) != "1":
        pytest.xfail(f"requirements.lock was resolved at {cutoff}, not the pinned {pinned}: regenerate it with "
                     "scripts/lock.sh (needs PyPI access); the candidate build's test step fails until then")
    assert cutoff == pinned, f"requirements.lock was resolved at {cutoff}, not the pinned {pinned}"
