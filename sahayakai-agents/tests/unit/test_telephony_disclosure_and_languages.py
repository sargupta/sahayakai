"""Policy switches for parent calls: AI disclosure and two-way languages.

Both default OFF so production behaviour is unchanged until someone decides:

- `VOBIZ_DISCLOSE_AI` makes the first turn say this is an automated assistant
  (today it says so only when asked).
- `VOBIZ_TWO_WAY_LANGUAGES` limits full conversations to languages whose phone
  recognition is trusted; any other language gets delivery mode, where the
  message is spoken and the call closes.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from sahayakai_agents.telephony import router as telephony
from sahayakai_agents.telephony.prompt import CallContext, build_parent_call_instruction

_CTX = CallContext(
    language="Tamil",
    school_name="GHS Madurai",
    teacher_name="Mrs Lakshmi",
    student_name="Arun",
    message="Arun did very well in the science test.",
)


class TestPrompt:
    def test_defaults_add_no_policy_sections(self) -> None:
        text = build_parent_call_instruction(_CTX)
        assert "DISCLOSURE" not in text
        assert "DELIVERS THE MESSAGE ONLY" not in text
        assert text == build_parent_call_instruction(_CTX, disclose_ai=False, two_way=True)

    def test_disclosure_section_is_added_in_the_call_language(self) -> None:
        text = build_parent_call_instruction(_CTX, disclose_ai=True)
        assert "DISCLOSURE — REQUIRED ON THIS CALL" in text
        assert "automated assistant" in text
        assert "in Tamil" in text

    def test_delivery_mode_tells_the_model_to_deliver_and_close(self) -> None:
        text = build_parent_call_instruction(_CTX, two_way=False)
        assert "THIS CALL DELIVERS THE MESSAGE ONLY" in text
        assert 'reason "message_delivered"' in text
        # The teacher's message is still there to deliver.
        assert "Arun did very well in the science test." in text


class TestSwitches:
    def test_disclosure_is_off_unless_set(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("VOBIZ_DISCLOSE_AI", raising=False)
        assert telephony.disclose_ai() is False
        for value in ("1", "true", "YES"):
            monkeypatch.setenv("VOBIZ_DISCLOSE_AI", value)
            assert telephony.disclose_ai() is True
        monkeypatch.setenv("VOBIZ_DISCLOSE_AI", "false")
        assert telephony.disclose_ai() is False

    def test_every_language_is_two_way_when_unset(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("VOBIZ_TWO_WAY_LANGUAGES", raising=False)
        assert telephony.is_two_way("Tamil")
        monkeypatch.setenv("VOBIZ_TWO_WAY_LANGUAGES", " ")
        assert telephony.is_two_way("Odia")

    def test_only_listed_languages_are_two_way(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("VOBIZ_TWO_WAY_LANGUAGES", "English, hindi")
        assert telephony.is_two_way("English")
        assert telephony.is_two_way("Hindi")
        assert not telephony.is_two_way("Tamil")


class _Session:
    def __init__(self) -> None:
        self.responses: list[Any] = []

    async def send_tool_response(self, **kw: Any) -> None:
        self.responses.append(kw)


def _end_call(reason: str) -> Any:
    return SimpleNamespace(
        function_calls=[SimpleNamespace(id="1", name="end_call", args={"reason": reason})]
    )


@pytest.mark.asyncio
class TestMessageDeliveredEnding:
    def _bridge(self, *, delivery_only: bool) -> Any:
        b = telephony._Bridge(SimpleNamespace(), "o1", call_uuid="")  # type: ignore[arg-type]
        b.delivery_only = delivery_only
        return b

    async def test_honoured_at_once_in_delivery_mode(self) -> None:
        bridge = self._bridge(delivery_only=True)
        await telephony._handle_tool_call(bridge, _Session(), _end_call("message_delivered"))
        assert bridge.closing
        for task in list(bridge.background):
            task.cancel()

    async def test_declined_on_a_two_way_call_before_any_conversation(self) -> None:
        bridge = self._bridge(delivery_only=False)
        await telephony._handle_tool_call(bridge, _Session(), _end_call("message_delivered"))
        assert not bridge.closing
