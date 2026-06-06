"""Unit-coverage tests for `quiz.agent` helpers — prompt loading,
data-URI parsing, variant state key, and the wrapper's exception-eating
behaviour (Q2-B lane-F).

The existing `test_quiz_adk.py` covers the ADK ParallelAgent shape;
this file fills the helper + wrapper gaps.
"""
from __future__ import annotations

import base64
from pathlib import Path
from typing import Any

import pytest

from sahayakai_agents.agents.quiz import agent as sut

pytestmark = pytest.mark.unit


def _clear() -> None:
    sut._compile_generator_template.cache_clear()
    sut.get_generator_model.cache_clear()
    sut.build_quiz_agent.cache_clear()
    sut.build_variant_agent.cache_clear() if hasattr(
        sut.build_variant_agent, "cache_clear"
    ) else None


# ---- Prompt resolution -------------------------------------------------


def test_load_generator_prompt() -> None:
    _clear()
    text = sut.load_generator_prompt()
    assert isinstance(text, str) and "{{" in text


def test_load_prompt_missing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SAHAYAKAI_PROMPTS_DIR", str(tmp_path))
    _clear()
    with pytest.raises(FileNotFoundError, match="Quiz prompt missing"):
        sut.load_generator_prompt()


def test_resolve_prompts_dir_env(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SAHAYAKAI_PROMPTS_DIR", str(tmp_path))
    assert sut._resolve_prompts_dir() == tmp_path / "quiz"


def test_resolve_prompts_dir_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SAHAYAKAI_PROMPTS_DIR", raising=False)
    assert sut._resolve_prompts_dir().name == "quiz"


def test_render_generator_prompt() -> None:
    _clear()
    out = sut.render_generator_prompt({"topic": "fractions"})
    assert isinstance(out, str)


def test_get_generator_model_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SAHAYAKAI_QUIZ_MODEL", raising=False)
    _clear()
    assert sut.get_generator_model().startswith("gemini-")


def test_get_generator_model_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SAHAYAKAI_QUIZ_MODEL", "gemini-q")
    _clear()
    assert sut.get_generator_model() == "gemini-q"


# ---- variant_state_key ------------------------------------------------


@pytest.mark.parametrize("d", ["easy", "medium", "hard"])
def test_variant_state_key(d: str) -> None:
    assert sut.variant_state_key(d) == f"variant_{d}"


# ---- parse_data_uri_optional ------------------------------------------


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def test_parse_data_uri_optional_none_returns_none() -> None:
    assert sut.parse_data_uri_optional(None) is None
    assert sut.parse_data_uri_optional("") is None


def test_parse_data_uri_optional_jpeg() -> None:
    raw = b"jpegbytes"
    uri = f"data:image/jpeg;base64,{_b64(raw)}"
    res = sut.parse_data_uri_optional(uri)
    assert res == ("image/jpeg", raw)


def test_parse_data_uri_optional_with_codec_param() -> None:
    raw = b"png"
    uri = f"data:image/png;param=v;base64,{_b64(raw)}"
    res = sut.parse_data_uri_optional(uri)
    assert res is not None
    assert res[0] == "image/png"


def test_parse_data_uri_optional_rejects_no_match() -> None:
    with pytest.raises(sut.InvalidDataURIError):
        sut.parse_data_uri_optional("garbage")


def test_parse_data_uri_optional_rejects_non_image() -> None:
    uri = f"data:application/pdf;base64,{_b64(b'pdf')}"
    with pytest.raises(sut.InvalidDataURIError, match="image/"):
        sut.parse_data_uri_optional(uri)


def test_parse_data_uri_optional_rejects_invalid_b64() -> None:
    with pytest.raises(sut.InvalidDataURIError, match="base64"):
        sut.parse_data_uri_optional("data:image/png;base64,!!!")


def test_parse_data_uri_optional_rejects_empty_body() -> None:
    with pytest.raises(sut.InvalidDataURIError):
        sut.parse_data_uri_optional("data:image/png;base64,")


# ---- build_variant_agent --------------------------------------------


def test_build_variant_agent_shape() -> None:
    from google.adk.agents import LlmAgent

    a = sut.build_variant_agent("easy")
    assert isinstance(a, LlmAgent)
    assert a.name == "quiz_variant_easy"
    assert a.name.isidentifier()
    assert a.output_key == "variant_easy"


# ---- variant wrapper eats exceptions --------------------------------


@pytest.mark.asyncio
async def test_variant_wrapper_eats_inner_exception() -> None:
    """ParallelAgent runs sub-agents under TaskGroup — any raise would
    cancel siblings. The wrapper must catch and exit cleanly."""

    class _RaisingInner:
        name = "quiz_variant_easy"
        sub_agents: list[Any] = []

        async def run_async(self, ctx: Any):  # noqa: ANN001
            raise RuntimeError("boom")
            yield  # pragma: no cover

    wrapper = sut.build_variant_wrapper("easy", inner_override=_RaisingInner())
    events = []
    async for ev in wrapper._run_async_impl(ctx=None):  # type: ignore[arg-type]
        events.append(ev)
    assert events == []  # wrapper yielded nothing on error


@pytest.mark.asyncio
async def test_variant_wrapper_passes_through_events() -> None:
    sentinel = object()

    class _Inner:
        name = "quiz_variant_medium"
        sub_agents: list[Any] = []

        async def run_async(self, ctx: Any):  # noqa: ANN001
            yield sentinel

    wrapper = sut.build_variant_wrapper(
        "medium", inner_override=_Inner(),
    )
    events = []
    async for ev in wrapper._run_async_impl(ctx=None):  # type: ignore[arg-type]
        events.append(ev)
    assert events == [sentinel]
