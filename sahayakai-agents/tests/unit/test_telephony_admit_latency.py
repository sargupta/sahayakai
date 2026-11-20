"""Answer-to-socket latency: the signal that would have caught the 10-08 outage.

On 2026-10-08 the telephony service cold-started and accepted the media socket
about 10 s after the parent answered; the carrier had already hung up and the
parent heard dead air. Nothing in the logs said so. The bridge now logs
`answer_to_socket_ms` on every admission, and a warning above 3 s.
"""

from __future__ import annotations

import re
import time
from pathlib import Path

import pytest

from sahayakai_agents.telephony import router as telephony
from sahayakai_agents.telephony.tokens import STREAM_TOKEN_TTL_SECONDS, token_minted_at

_WEB_TOKENS = (
    Path(__file__).resolve().parents[3] / "sahayakai-main" / "src" / "lib" / "vobiz" / "tokens.ts"
)


def test_stream_ttl_matches_the_web_app() -> None:
    if not _WEB_TOKENS.exists():
        pytest.skip("sahayakai-main not checked out alongside")
    source = _WEB_TOKENS.read_text(encoding="utf-8")
    match = re.search(r"export const VOBIZ_TOKEN_TTL_SECONDS = (\d+);", source)
    assert match, "VOBIZ_TOKEN_TTL_SECONDS not found in the web token module"
    assert int(match.group(1)) == STREAM_TOKEN_TTL_SECONDS


def test_mint_time_is_expiry_minus_ttl() -> None:
    assert token_minted_at(f"o1.{1000 + STREAM_TOKEN_TTL_SECONDS}.sig") == 1000
    assert token_minted_at(None) is None
    assert token_minted_at("o1.notanumber.sig") is None
    assert token_minted_at("too.many.dots.here") is None


def _events(caplog_records: list[tuple[str, dict[str, object]]]) -> list[str]:
    return [name for name, _ in caplog_records]


def test_a_cold_start_is_logged_as_a_slow_admit(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: list[tuple[str, dict[str, object]]] = []

    class _Log:
        def info(self, event: str, **kw: object) -> None:
            seen.append((event, kw))

        def warning(self, event: str, **kw: object) -> None:
            seen.append((event, kw))

    monkeypatch.setattr(telephony, "log", _Log())
    now = int(time.time())

    # Minted (= answered) 10 s ago: the 10-08 cold start.
    telephony._log_admit_latency("o1", f"o1.{now - 10 + STREAM_TOKEN_TTL_SECONDS}.sig")
    # Minted just now: a warm instance.
    telephony._log_admit_latency("o2", f"o2.{now + STREAM_TOKEN_TTL_SECONDS}.sig")

    assert _events(seen) == ["telephony.slow_admit", "telephony.admitted"]
    assert int(seen[0][1]["answer_to_socket_ms"]) >= 9000  # type: ignore[call-overload]
