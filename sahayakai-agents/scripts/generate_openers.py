"""Render the recorded opener each parent hears the instant they pick up.

WHY A RECORDING AT ALL

Measured on the deployed bridge, the gap between the socket opening and the Live
model's first audio is ~3.4s: Firestore context ~490ms, client construction
~345ms, the Vertex Live handshake ~1.7s, and the model's first token ~840ms.
Overlapping everything that can overlap still leaves ~2.5s, because the
handshake and the first token dominate and neither is ours to speed up.

Two and a half seconds of silence after a parent says "hello" is how a call gets
hung up on. So VIDYA says hello from a recording at ~0ms while the live session
warms behind it, and takes over speaking as itself once connected.

Run:
    python scripts/generate_openers.py            # all languages
    python scripts/generate_openers.py Hindi Tamil

Output is raw mu-law 8 kHz — the exact wire format the carrier wants, so the
call path does no conversion at all on the most latency-critical bytes.

TRANSLATION REVIEW: the lines below were drafted for tone, not verified by a
native speaker of each language. They are the FIRST thing a parent hears, so
they should be reviewed by someone who speaks each one before this carries real
calls. Nothing here is generated at runtime, so a correction is a text edit and
a re-run.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from sahayakai_agents.telephony.audio import (  # noqa: E402
    pcm16_to_ulaw,
    pcm24k_to_ulaw8k,
    ulaw_to_pcm16,
)

OUT = Path(__file__).resolve().parents[1] / "src" / "sahayakai_agents" / "telephony" / "openers"

# A greeting, not a question. The parent's reply during the opener cannot be
# heard — the Live session is still connecting — so asking something here would
# mean ignoring their answer, which is worse than the silence it replaces.
OPENERS: dict[str, str] = {
    "English": "Namaste. This is Vidya, calling on behalf of your child's school.",
    "Hindi": "नमस्ते। मैं विद्या बोल रही हूँ, आपके बच्चे के स्कूल की ओर से।",
    "Bengali": "নমস্কার। আমি বিদ্যা বলছি, আপনার সন্তানের স্কুলের পক্ষ থেকে।",
    "Marathi": "नमस्कार. मी विद्या बोलत आहे, आपल्या मुलाच्या शाळेकडून.",
    "Gujarati": "નમસ્તે. હું વિદ્યા બોલું છું, તમારા બાળકની શાળા તરફથી.",
    "Punjabi": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ। ਮੈਂ ਵਿੱਦਿਆ ਬੋਲ ਰਹੀ ਹਾਂ, ਤੁਹਾਡੇ ਬੱਚੇ ਦੇ ਸਕੂਲ ਵੱਲੋਂ।",
    "Kannada": "ನಮಸ್ಕಾರ. ನಾನು ವಿದ್ಯಾ ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ, ನಿಮ್ಮ ಮಗುವಿನ ಶಾಲೆಯಿಂದ.",
    "Tamil": "வணக்கம். நான் வித்யா பேசுகிறேன், உங்கள் குழந்தையின் பள்ளியிலிருந்து.",
    "Telugu": "నమస్కారం. నేను విద్య మాట్లాడుతున్నాను, మీ పిల్లల పాఠశాల నుండి.",
    "Malayalam": "നമസ്കാരം. ഞാൻ വിദ്യ സംസാരിക്കുന്നു, നിങ്ങളുടെ കുട്ടിയുടെ സ്കൂളിൽ നിന്ന്.",
    # Odia has no dedicated TTS voice in several stacks; the app's standing
    # substitution is the Hindi voice over Odia text, matching TWILIO_LANGUAGE_MAP.
    "Odia": "ନମସ୍କାର। ମୁଁ ବିଦ୍ୟା କହୁଛି, ଆପଣଙ୍କ ପିଲାର ବିଦ୍ୟାଳୟ ତରଫରୁ।",
}

VOICE = "Aoede"  # the same voice the live session uses, so the handover is seamless

#: Leave this much silence at the very front. The whole point of the recording
#: is that the parent hears a voice immediately; a quarter second of nothing is
#: the very thing being removed, so the render's own lead-in is trimmed.
LEAD_SILENCE_S = 0.05
#: A little tail keeps the handover from sounding clipped.
TAIL_SILENCE_S = 0.10
#: Peak-normalise so no language arrives noticeably quieter than another. Well
#: under full scale: mu-law has no headroom to spare and a clipped greeting
#: sounds like a bad line.
TARGET_PEAK = 22000


def _trim_and_normalise(ulaw: bytes) -> bytes:
    """Strip the render's lead-in, even the levels out, re-encode."""
    import math
    from array import array

    pcm = ulaw_to_pcm16(ulaw)
    win = 80  # 10 ms at 8 kHz
    env = [
        math.sqrt(sum(float(x) * x for x in pcm[i : i + win]) / win)
        for i in range(0, len(pcm) - win, win)
    ]
    if not env:
        return ulaw
    threshold = max(env) * 0.05
    first = next((i for i, e in enumerate(env) if e > threshold), 0)
    last = len(env) - next((i for i, e in enumerate(reversed(env)) if e > threshold), 0)

    start = max(0, (first * win) - int(LEAD_SILENCE_S * 8000))
    end = min(len(pcm), (last * win) + int(TAIL_SILENCE_S * 8000))
    trimmed = pcm[start:end]

    peak = max((abs(x) for x in trimmed), default=0)
    if peak:
        gain = TARGET_PEAK / peak
        trimmed = array("h", [max(-32768, min(32767, int(x * gain))) for x in trimmed])
    return pcm16_to_ulaw(trimmed)


def render(language: str, text: str) -> int:
    from google import genai
    from google.genai import types

    client = genai.Client(vertexai=True, project="sahayakai-b4248", location="us-central1")
    resp = client.models.generate_content(
        model="gemini-2.5-flash-preview-tts",
        contents=text,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE)
                )
            ),
        ),
    )
    pcm = resp.candidates[0].content.parts[0].inline_data.data
    ulaw, _ = pcm24k_to_ulaw8k(pcm)
    ulaw = _trim_and_normalise(ulaw)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{language}.ulaw").write_bytes(ulaw)
    return len(ulaw)


def main() -> None:
    wanted = sys.argv[1:] or list(OPENERS)
    for language in wanted:
        text = OPENERS.get(language)
        if text is None:
            print(f"  {language}: no opener text defined", file=sys.stderr)
            continue
        size = render(language, text)
        print(f"  {language:<10} {size:>6} bytes  {size / 8000:.2f}s")


if __name__ == "__main__":
    main()
