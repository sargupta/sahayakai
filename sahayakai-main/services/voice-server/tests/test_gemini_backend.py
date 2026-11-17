"""The Gemini backend switch: AI Studio by default, Vertex AI when asked.

Production fact (2026-11-16): the AI Studio key behind GOOGLE_GENAI_API_KEY
ran out of prepaid credit (402 RESOURCE_EXHAUSTED), so the conversation model
and the post-call analysis both failed. SAHAYAKAI_GEMINI_BACKEND=vertex moves
BOTH Gemini clients to Vertex AI as the runtime service account. These tests
pin that the default is exactly the old behaviour (the positive-feedback golden
also covers the LLM settings), that Vertex mode really reaches both clients
with no key, and that a misconfiguration stops the server instead of quietly
falling back to the depleted key.
"""

from __future__ import annotations

import asyncio
import sys
import types
from dataclasses import replace
from types import SimpleNamespace

import pytest

from bot_harness import RECORDER, build_bot, import_main, make_config, stubbed_runtime
from src.gemini_backend import AI_STUDIO, VERTEX, resolve_gemini_backend

PROJECT = "sahayakai-b4248"
CTX = {"id": "OutreachFs0000000001", "studentName": "Aarav", "reason": "consecutive_absences",
       "parentLanguage": "Hindi", "teacherName": "Ms. Sharma", "schoolName": "Demo Public School"}


def cfg(**kw):
    return replace(make_config(), **kw)


# ── resolution ───────────────────────────────────────────────────────────────


def test_default_is_the_ai_studio_key_as_before():
    b = resolve_gemini_backend(cfg(google_api_key="k-test"))
    assert b.kind == AI_STUDIO and b.genai_client_kwargs() == {"api_key": "k-test"}


def test_vertex_uses_the_project_and_asia_south1_by_default():
    b = resolve_gemini_backend(cfg(gemini_backend="vertex", google_cloud_project=PROJECT, google_api_key="k"))
    assert b.kind == VERTEX
    assert b.genai_client_kwargs() == {"vertexai": True, "project": PROJECT, "location": "asia-south1"}
    assert "api_key" not in b.genai_client_kwargs()


def test_the_vertex_region_can_be_moved():
    b = resolve_gemini_backend(cfg(gemini_backend=" Vertex ", google_cloud_project=PROJECT, vertex_location="us-central1"))
    assert b.location == "us-central1"


@pytest.mark.parametrize("bad", [
    {"gemini_backend": "vertx"},
    {"gemini_backend": "openai"},
    {"gemini_backend": "vertex", "google_cloud_project": ""},
])
def test_a_misconfiguration_is_an_error_not_a_silent_fallback(bad):
    with pytest.raises(ValueError):
        resolve_gemini_backend(cfg(**bad))


def test_load_config_reads_the_switch_with_safe_defaults(monkeypatch):
    from src.config import load_config

    monkeypatch.delenv("SAHAYAKAI_GEMINI_BACKEND", raising=False)
    monkeypatch.delenv("SAHAYAKAI_VERTEX_LOCATION", raising=False)
    c = load_config()
    assert (c.gemini_backend, c.vertex_location) == ("ai_studio", "asia-south1")
    monkeypatch.setenv("SAHAYAKAI_GEMINI_BACKEND", "vertex")
    monkeypatch.setenv("SAHAYAKAI_VERTEX_LOCATION", "asia-southeast1")
    c = load_config()
    assert (c.gemini_backend, c.vertex_location) == ("vertex", "asia-southeast1")


# ── the conversation LLM (bot.py) ────────────────────────────────────────────


def test_default_builds_the_ai_studio_llm_with_the_key():
    with stubbed_runtime():
        run = asyncio.run(build_bot(CTX, config_overrides={"google_api_key": "k-test"}))
        llm = RECORDER.named("pipecat.services.google.llm.GoogleLLMService")
        vertex = RECORDER.named("pipecat.services.google.vertex.llm.GoogleVertexLLMService")
    assert len(llm) == 1 and llm[0][2]["api_key"] == "k-test"
    assert vertex == []
    assert run.llm_settings == {"model": "gemini-2.0-flash", "temperature": 0.2, "max_tokens": 40}


def test_vertex_builds_the_vertex_llm_with_the_same_settings_and_no_key():
    with stubbed_runtime():
        run = asyncio.run(build_bot(CTX, config_overrides={
            "gemini_backend": "vertex", "google_cloud_project": PROJECT, "google_api_key": "k-test"}))
        vertex = RECORDER.named("pipecat.services.google.vertex.llm.GoogleVertexLLMService")
        studio = RECORDER.named("pipecat.services.google.llm.GoogleLLMService")
    assert studio == []
    assert len(vertex) == 1
    kwargs = vertex[0][2]
    assert kwargs["project_id"] == PROJECT and kwargs["location"] == "asia-south1"
    assert "api_key" not in kwargs and "credentials" not in kwargs, "Vertex must run as the service account (ADC)"
    assert run.llm_settings == {"model": "gemini-2.0-flash", "temperature": 0.2, "max_tokens": 40}
    assert run.system_instruction.startswith("You are calling a parent from Demo Public School")


# ── the post-call analyzer (call_analyzer.py) ────────────────────────────────


def _install_fake_genai(clients: list) -> None:
    google = types.ModuleType("google")
    google.__path__ = []
    genai = types.ModuleType("google.genai")

    class Client:
        def __init__(self, **kwargs):
            clients.append(kwargs)

            async def generate_content(model, contents, config):
                clients.append({"model": model})
                return SimpleNamespace(text='{"parentSentiment": "cooperative"}')

            self.aio = SimpleNamespace(models=SimpleNamespace(generate_content=generate_content))

    genai.Client = Client
    genai.types = SimpleNamespace(GenerateContentConfig=lambda **kw: kw)
    google.genai = genai
    sys.modules["google"] = google
    sys.modules["google.genai"] = genai


TRANSCRIPT = [{"role": "agent", "text": "hello"}, {"role": "parent", "text": "yes"}]


@pytest.mark.parametrize("mode", ["ai_studio", "vertex"])
def test_the_analyzer_follows_the_backend(mode, monkeypatch):
    monkeypatch.delenv("GOOGLE_GENAI_API_KEY", raising=False)
    clients: list = []
    with stubbed_runtime():
        _install_fake_genai(clients)
        from src.call_analyzer import analyze_call

        if mode == "vertex":
            backend = resolve_gemini_backend(cfg(gemini_backend="vertex", google_cloud_project=PROJECT))
            insights = asyncio.run(analyze_call(CTX, TRANSCRIPT, api_key="", backend=backend))
        else:
            backend = resolve_gemini_backend(cfg(google_api_key="k-test"))
            insights = asyncio.run(analyze_call(CTX, TRANSCRIPT, api_key="k-test", backend=backend))
    assert insights == {"parentSentiment": "cooperative"}
    if mode == "vertex":
        assert clients[0] == {"vertexai": True, "project": PROJECT, "location": "asia-south1"}
    else:
        assert clients[0] == {"api_key": "k-test"}
    assert clients[1] == {"model": "gemini-2.0-flash"}


def test_the_analyzer_without_a_backend_behaves_as_before(monkeypatch):
    monkeypatch.delenv("GOOGLE_GENAI_API_KEY", raising=False)
    clients: list = []
    with stubbed_runtime():
        _install_fake_genai(clients)
        from src.call_analyzer import analyze_call

        assert asyncio.run(analyze_call(CTX, TRANSCRIPT, api_key="")) is None, "no key, no Vertex: skipped as before"
        asyncio.run(analyze_call(CTX, TRANSCRIPT, api_key="k-old"))
    assert clients[0] == {"api_key": "k-old"}


# ── startup ──────────────────────────────────────────────────────────────────


def test_a_misconfigured_backend_stops_the_server_before_it_listens(tmp_path, monkeypatch):
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        started = []
        main.uvicorn.run = lambda *a, **k: started.append(k)
        main.config = replace(main.config, gemini_backend="vertx")
        with pytest.raises(ValueError):
            main.main()
    assert started == []


def test_the_deploy_spec_runs_on_vertex():
    """Class gate: production calls must not depend on the AI Studio prepaid key.

    16 Nov 2026: that key returned 402 RESOURCE_EXHAUSTED and every live parent call
    died after one turn. The live engine's one deploy definition runs it on
    Vertex AI as its service account.
    """
    from pathlib import Path

    spec = (Path(__file__).resolve().parents[1] / "cloudbuild.yaml").read_text(encoding="utf-8")
    env_lines = [ln for ln in spec.splitlines() if ln.strip().startswith("- --set-env-vars=")]
    assert len(env_lines) == 1
    assert "SAHAYAKAI_GEMINI_BACKEND=vertex" in env_lines[0]
