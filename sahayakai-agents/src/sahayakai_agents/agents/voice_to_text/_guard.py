"""Behavioural guard for voice-to-text agent (Phase I).

Three checks:

1. **Language ISO allow-list** — the model must return one of our 11
   supported language codes, or `null`. Anything else (e.g. "fr",
   "es", or a 5-letter BCP-47 like "hi-IN") is rejected. Genkit had
   no enforcement here — it accepted any string.
2. **Forbidden-phrase scan** on the transcription — same hardened set
   as parent-call / lesson-plan (no AI self-references, no Sahayak
   mentions). Defends the rare case where the audio contains
   prompt-injection content the model parrots back verbatim.
3. **No script-match** — speech-to-text must accept any language
   regardless of the speaker's `detectedLanguage` hint, by definition.
"""
from __future__ import annotations

from ..._behavioural import assert_no_forbidden_phrases
from .schemas import ALLOWED_LANGUAGE_ISO_CODES


def assert_language_iso_allowed(language: str | None) -> None:
    """Reject any language code outside the supported set.

    `None` is allowed — the model is told to leave it null when
    uncertain rather than guessing.
    """
    if language is None:
        return
    code = language.strip().lower()
    assert code in ALLOWED_LANGUAGE_ISO_CODES, (
        f"language={language!r} not in supported set "
        f"{sorted(ALLOWED_LANGUAGE_ISO_CODES)}"
    )


def assert_voice_to_text_response_rules(
    *,
    text: str,
    language: str | None,
) -> None:
    """Composite assertion."""
    assert_language_iso_allowed(language)
    assert_no_forbidden_phrases(text)


__all__ = [
    "assert_language_iso_allowed",
    "assert_voice_to_text_response_rules",
]
