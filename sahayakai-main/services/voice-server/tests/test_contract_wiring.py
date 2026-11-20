"""CLASS GATE — the web-to-engine contract tests run whenever either side changes.

Independent review #15: the only checks that the engine and the web app agree
(the do-not-call digest, the request-to-talk line, the stream-token format)
ran only on PRs touching voice-server files, and always skipped in the Cloud
Build test step, which uploaded the service directory alone. A web-only change
never ran them.

The class is "a contract check that does not run when the other side changes".
The gate: the voice-server workflow triggers on every web and agents file the
contract tests read and on the web code they pin; CI and the Cloud Build test
step both require the monorepo, so a missing file context fails instead of
skipping; the Cloud Build upload allowlist re-includes every contract file;
and a web-side jest test runs the same contract on every PR.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

import bot_harness
from bot_harness import CONTRACT_FILES, REQUIRE_MONOREPO_ENV, contract_file_or_skip

SERVICE = Path(__file__).resolve().parents[1]
REPO = SERVICE.parents[2]  # the monorepo root
WORKFLOW = REPO / ".github" / "workflows" / "voice-server.yml"
CLOUDBUILD = SERVICE / "cloudbuild.yaml"
IGNORE = SERVICE / "cloudbuild.gcloudignore"
WEB_CONTRACT = REPO / "sahayakai-main" / "src" / "__tests__" / "scripts" / "voice-engine-contract.test.ts"

# The web code the contract pins, beyond the files the tests read.
PINNED_WEB_CODE = (
    "sahayakai-main/src/lib/vobiz/tokens.ts",
    "sahayakai-main/src/app/api/attendance/vobiz/answer/route.ts",
    "sahayakai-main/src/app/api/attendance/call/route.ts",
    "sahayakai-main/src/lib/call-suppression.ts",
)

pytestmark = pytest.mark.skipif(not WORKFLOW.exists(), reason="needs the monorepo checkout")


def _trigger_paths(event: str) -> list[str]:
    text = WORKFLOW.read_text(encoding="utf-8")
    block = re.search(rf"^  {event}:\n(.*?)(?=^  \S|\Z)", text, re.M | re.S).group(1)
    paths = re.search(r"paths:\n((?:\s+- .*\n)+)", block).group(1)
    return [p.strip().lstrip("- ").strip("'\"") for p in paths.splitlines() if p.strip()]


def _covers(pattern: str, path: str) -> bool:
    return path.startswith(pattern[:-2]) if pattern.endswith("/**") else path == pattern


@pytest.mark.parametrize("event", ["pull_request", "push"])
@pytest.mark.parametrize("path", CONTRACT_FILES + PINNED_WEB_CODE)
def test_the_workflow_runs_when_the_other_side_changes(event, path):
    assert any(_covers(p, path) for p in _trigger_paths(event)), f"{event} does not trigger on {path}"


def test_ci_requires_the_monorepo_instead_of_skipping():
    text = WORKFLOW.read_text(encoding="utf-8")
    assert re.search(rf"{REQUIRE_MONOREPO_ENV}:\s*'1'", text)


def test_cloud_build_tests_with_the_contract_files_and_requires_them():
    text = CLOUDBUILD.read_text(encoding="utf-8")
    test_step = re.search(r"- id: test\n(.*?)(?=\n  - id: )", text, re.S).group(1)
    assert "dir: sahayakai-main/services/voice-server" in test_step
    assert f"{REQUIRE_MONOREPO_ENV}=1" in test_step
    assert "--ignore-file=sahayakai-main/services/voice-server/cloudbuild.gcloudignore" in text
    build_step = re.search(r"- id: build\n(.*?)(?=\n  - id: )", text, re.S).group(1)
    assert "- sahayakai-main/services/voice-server\n" in build_step, "the Docker context stays the service directory"


@pytest.mark.parametrize("path", CONTRACT_FILES)
def test_the_cloud_build_upload_includes_every_contract_file(path):
    allowed = [line[2:] for line in IGNORE.read_text(encoding="utf-8").splitlines() if line.startswith("!/")]
    assert any(path == a or (a.endswith("/") and path.startswith(a)) for a in allowed), path
    assert any(a == "sahayakai-main/services/voice-server/" for a in allowed)


def test_a_web_side_contract_test_reads_the_engine_fixtures():
    text = WEB_CONTRACT.read_text(encoding="utf-8")
    for fixture in ("stream_token_format.json", "suppression_digest.json", "call_lines.json"):
        assert fixture in text, fixture
    assert "mintVobizToken" in text, "it must mint with the real web code, not a copy"


def test_a_missing_monorepo_fails_when_required(monkeypatch):
    monkeypatch.setattr(bot_harness, "monorepo_root", lambda: None)
    monkeypatch.setenv(REQUIRE_MONOREPO_ENV, "1")
    with pytest.raises(pytest.fail.Exception):
        contract_file_or_skip(CONTRACT_FILES[0])
    monkeypatch.delenv(REQUIRE_MONOREPO_ENV)
    with pytest.raises(pytest.skip.Exception):
        contract_file_or_skip(CONTRACT_FILES[0])
