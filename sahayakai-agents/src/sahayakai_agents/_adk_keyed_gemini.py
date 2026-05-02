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

from typing import Any


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


__all__ = ["build_keyed_gemini"]
