"""
Which transcriptions are noise. Pure (standard library only), so that
STTConfidenceFilter, which drops them before the model, and the stop
listener, which must not let one cancel a held "don't call me", use the same
rules.
"""

from __future__ import annotations

import re
from collections import Counter

MIN_CHARS = 2              # Below this = noise artifact
MAX_REPEAT_RATIO = 0.7     # If >70% of chars are the same char, likely noise

# Gibberish: only punctuation/numbers/whitespace, or single repeated char
GIBBERISH_RE = re.compile(r'^[\s\d\W]+$|^(.)\1{2,}$')

# Common STT noise artifacts in Indian languages (Sarvam-specific)
# These are fragments that STT produces from background noise/echo
NOISE_ARTIFACTS = {
    # Hindi noise fragments ("हम्म"/"उम्म" are hums, not the word "हम")
    "हां", "ह", "अ", "उ", "ओ", "आ", "ए", "हम्म", "उम्म",
    # English noise fragments
    "uh", "um", "ah", "oh", "hmm", "hm", "mm", "mhm",
    # Common echo artifacts (STT hearing its own TTS output)
    "thank", "thanks", "okay",
}


def drop_reason(text: object, min_chars: int = MIN_CHARS) -> str | None:
    """Why STTConfidenceFilter drops this transcription, or None if it keeps it."""
    text = text.strip() if isinstance(text, str) else ""
    if len(text) < min_chars:
        return "too short"
    if GIBBERISH_RE.match(text):
        return "gibberish"
    if text.lower() in NOISE_ARTIFACTS:
        return "noise artifact"
    if len(text) >= 3:
        char_counts = Counter(text.lower().replace(" ", ""))
        if char_counts:
            most_common_count = char_counts.most_common(1)[0][1]
            if most_common_count / sum(char_counts.values()) > MAX_REPEAT_RATIO:
                return "repetitive"
    return None
