"""Shared helper for building per-call key-pinned Gemini wrappers (Phase L).

ADK's stock `Gemini` class lazily constructs `genai.Client()` with no
args, which means it picks up `GOOGLE_API_KEY` from the env at first
access and caches it on the instance forever. That breaks the sidecar's
key-pool failover (concurrent requests would race on the env var, and
the cached client would never rotate).

Workaround: subclass `Gemini`, pre-populate the `api_client`
cached_property with a `genai.Client(api_key=...)` instance built from
an explicit key. ADK then uses our pre-populated client for every call
instead of constructing one from env.

Lifted out of `agents/vidya/router.py` (Phase L.1) so L.3 lesson-plan
LoopAgent + L.4 quiz/visual-aid + L.5 voice-to-text can share the same
helper instead of each duplicating the subclass.

Local imports keep tests that don't exercise ADK fast — the heavy
`google.genai` machinery only loads on the hot path.
"""
from __future__ import annotations

from typing import Any, Callable


def _resolve_model_name(template_model: Any) -> str:
    """Pull the model identifier out of a cached `LlmAgent.model` field.

    ADK types `LlmAgent.model` as `Union[str, BaseLlm]`. Our agent
    factories always set a string, but the type system doesn't know
    that — this coercion keeps the call sites tidy.
    """
    if isinstance(template_model, str):
        return template_model
    # `BaseLlm` (and our `_KeyedGemini` subclass) carries the model id on
    # the `.model` attribute.
    return template_model.model  # type: ignore[no-any-return]


def build_keyed_gemini_from_template(
    template_factory: Callable[[], Any],
    api_key: str,
) -> Any:
    """Per-call key-pinned Gemini wrapper, sourcing the model name from
    a cached agent template.

    Phase L.6 — dedupe. Four routers (parent_message, vidya, rubric,
    teacher_training) had effectively identical 14-line wrappers that
    each called their respective `build_X_agent()` factory just to read
    `.model`. This consolidates them: pass the factory and the key, get
    the keyed Gemini.

    Args:
        template_factory: The per-agent `build_X_agent` factory. Called
            ONCE per invocation; the factory itself is expected to be
            cheap / cached (`functools.lru_cache` on the factory side).
        api_key: The Gemini API key for this single call.

    Returns:
        A `Gemini` instance whose `api_client` is pre-populated.
    """
    template_model = template_factory().model
    model_name = _resolve_model_name(template_model)
    return build_keyed_gemini(model_name=model_name, api_key=api_key)


def build_keyed_gemini(*, model_name: str, api_key: str) -> Any:
    """Build a `Gemini` model wrapper pinned to a specific api_key.

    Args:
        model_name: The Gemini model identifier (e.g. ``"gemini-2.5-flash"``).
        api_key: The Gemini API key for this single call. Different keys
            on different calls is the whole point — that's how the
            sidecar's key-pool failover rotates between attempts.

    Returns:
        A ``Gemini`` instance whose ``api_client`` property is already
        populated with a ``genai.Client(api_key=...)`` so ADK never
        falls back to env-based client construction.
    """
    from google.adk.models.google_llm import Gemini  # noqa: PLC0415
    from google.genai import Client  # noqa: PLC0415
    from google.genai import types as genai_types  # noqa: PLC0415

    class _KeyedGemini(Gemini):
        """Per-call Gemini wrapper with explicit api_key."""

    instance = _KeyedGemini(model=model_name)
    # Pre-populate the api_client cached_property. cached_property
    # writes to instance.__dict__ on first access; we just write
    # directly so the lazy construction never fires.
    pinned_client = Client(
        api_key=api_key,
        http_options=genai_types.HttpOptions(
            headers=instance._tracking_headers(),
        ),
    )
    object.__setattr__(
        instance,
        "__dict__",
        {**instance.__dict__, "api_client": pinned_client},
    )
    return instance


__all__ = ["build_keyed_gemini", "build_keyed_gemini_from_template"]
