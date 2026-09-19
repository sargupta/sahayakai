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

import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from sahayakai_agents.telephony.audio import (  # noqa: E402
    pcm16_to_ulaw,
    pcm24k_to_ulaw8k,
    ulaw_to_pcm16,
)

OUT = Path(__file__).resolve().parents[1] / "src" / "sahayakai_agents" / "telephony" / "openers"

# THE OPENER TEXT IS NOT WRITTEN HERE.
#
# It comes from `CALL_MENU_PROMPTS` in the web runtime
# (sahayakai-main/src/types/attendance.ts), exported to call_prompts.json. That
# copy is already translated into every language the app calls in, and it has
# already been spoken to real parents on the Twilio path.
#
# The first version of this file invented its own English lines and had them
# machine-translated by the TTS model, which was wrong twice over: it produced a
# second, unreviewed set of words for the most sensitive moment of the call, and
# it introduced a persona name ("This is Vidya") that the shipped prompt
# explicitly forbids — the caller is THE SCHOOL, never a named assistant.
#
# To change what a parent hears, edit CALL_MENU_PROMPTS and re-export. One
# source of truth, already reviewed.
PROMPTS = json.loads((Path(__file__).resolve().parents[1] / "src" / "sahayakai_agents"
                      / "telephony" / "call_prompts.json").read_text())

#: App language -> the BCP-47 key CALL_MENU_PROMPTS is indexed by. Odia has no
#: entry and falls back to Hindi, exactly as TWILIO_LANGUAGE_MAP does.
LANG_KEYS: dict[str, str] = {
    "English": "en-IN", "Hindi": "hi-IN", "Kannada": "kn-IN", "Tamil": "ta-IN",
    "Telugu": "te-IN", "Malayalam": "ml-IN", "Bengali": "bn-IN", "Marathi": "mr-IN",
    "Gujarati": "gu-IN", "Punjabi": "pa-IN", "Odia": "hi-IN",
}

OPENERS: dict[str, str] = {
    language: PROMPTS[key]["greeting"] for language, key in LANG_KEYS.items()
}

VOICE = "Aoede"

#: Rendered by the SAME model that will carry the conversation.
#:
#: The first version used the batch TTS model with the same voice NAME, on the
#: assumption that "Aoede" is one voice. It is not: measured on the same
#: sentence, batch TTS came back at rms 2486 / zcr 1487 Hz and the live model at
#: rms 4580 / zcr 1077 Hz — nearly twice as loud and audibly darker. The parent
#: heard one person say hello and a different person start talking, which is
#: exactly what "the voice keeps changing" meant.
#:
#: Rendering through the live model makes the handover identical by
#: construction, and it stays identical if the voice or model is ever changed,
#: because both come from the same two constants.
LIVE_MODEL = os.environ.get("VOBIZ_LIVE_MODEL", "gemini-live-2.5-flash-native-audio")
LIVE_LOCATION = os.environ.get("VOBIZ_LIVE_LOCATION", "us-central1")

_ECHO_INSTRUCTION = (
    "Repeat the user's text back EXACTLY, word for word, in the same language "
    "and script. Add nothing, omit nothing, and say nothing else."
)

#: Leave this much silence at the very front. The whole point of the recording
#: is that the parent hears a voice immediately; a quarter second of nothing is
#: the very thing being removed, so the render's own lead-in is trimmed.
LEAD_SILENCE_S = 0.05
#: A little tail keeps the handover from sounding clipped.
TAIL_SILENCE_S = 0.10


#: Ceiling for the greeting. mu-law has little headroom and the live model's own
#: output ranges from ~18k to ~32k peak between languages — Odia came back at
#: 32124, a whisker from full scale, which on a phone is heard as a hot,
#: slightly distorted line.
#:
#: This LIMITS rather than normalises: anything above the ceiling is brought
#: down, anything below is left exactly as the model produced it. Normalising
#: everything to one level was the old behaviour and it is wrong here, because
#: the conversation that follows is not normalised either — matching the voice
#: means leaving its natural dynamics alone.
PEAK_CEILING = 26000


def _trim_only(ulaw: bytes) -> bytes:
    """Strip the lead-in and tail, and limit anything too hot for a phone line."""
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
    if peak > PEAK_CEILING:
        gain = PEAK_CEILING / peak
        trimmed = array("h", [int(x * gain) for x in trimmed])
    return pcm16_to_ulaw(trimmed)


async def _speak_via_live(text: str) -> bytes:
    """Have the live conversation model say this line, and capture the audio."""
    from google import genai
    from google.genai import types

    client = genai.Client(vertexai=True, project="sahayakai-b4248", location=LIVE_LOCATION)
    config = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE)
            )
        ),
        system_instruction=types.Content(parts=[types.Part(text=_ECHO_INSTRUCTION)]),
    )
    pcm = b""
    async with client.aio.live.connect(model=LIVE_MODEL, config=config) as session:
        await session.send_client_content(
            turns=types.Content(role="user", parts=[types.Part(text=text)]),
            turn_complete=True,
        )
        async for resp in session.receive():
            if getattr(resp, "data", None):
                pcm += resp.data
    return pcm


def render(language: str, text: str) -> int:
    pcm = asyncio.run(_speak_via_live(text))
    if not pcm:
        raise RuntimeError(f"{language}: live model returned no audio")
    ulaw, _ = pcm24k_to_ulaw8k(pcm)
    # Trim the lead-in only. Level is left exactly as the model produced it:
    # normalising here would make the greeting a different loudness from the
    # conversation that follows, reintroducing the seam this is meant to remove.
    ulaw = _trim_only(ulaw)
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
