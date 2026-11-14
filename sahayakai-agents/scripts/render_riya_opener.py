"""Pre-render Riya's opening line in the call's own Live voice (mu-law 8 kHz).

    python scripts/render_riya_opener.py "<school name>" <out_dir> [<student name> <call_purpose>]

Renders every fixed line of the call (RiyaCall.fixed_lines): the opening, the
node's guardian question and the closing lines.

The bridge plays <out_dir>/<key>.ulaw at pick-up (VOBIZ_RIYA_OPENER_DIR) so the
parent hears Riya at once instead of ~3 s of silence while Live connects. Same
model and voice as the call (VOBIZ_RIYA_LIVE_MODEL / _LOCATION / VOBIZ_RIYA_VOICE).
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from sahayakai_agents.telephony.audio import DecimatorState, pcm24k_to_ulaw8k
from sahayakai_agents.telephony.riya import RiyaCall
from sahayakai_agents.telephony.router import _riya_live_settings, riya_opener_key


def trim_silence(ulaw: bytes, lead_ms: int = 60, tail_ms: int = 120, level: int = 300) -> bytes:
    """Cut the model's leading/trailing silence down to a natural margin, so the
    parent's turn starts as soon as Riya's question ends."""
    from sahayakai_agents.telephony.audio import ulaw_to_pcm16

    frame = 160
    frames = [ulaw[i : i + frame] for i in range(0, len(ulaw), frame)]

    def loud(chunk: bytes) -> bool:
        pcm = ulaw_to_pcm16(chunk)
        n = len(bytes(pcm)) // 2
        if not n:
            return False
        samples = memoryview(bytes(pcm)).cast("h")
        return (sum(s * s for s in samples) / n) ** 0.5 > level

    first = next((i for i, f in enumerate(frames) if loud(f)), 0)
    last = next((i for i in range(len(frames) - 1, -1, -1) if loud(frames[i])), len(frames) - 1)
    start = max(0, first - lead_ms // 20)
    end = min(len(frames), last + 1 + tail_ms // 20)
    return b"".join(frames[start:end])


async def main(school: str, out_dir: str, student: str = "", purpose: str = "ptm_invitation") -> None:
    call = RiyaCall(
        {"school_name": school, "student_name": student, "call_purpose": purpose},
        product_context="sampark",
    )
    for text in call.fixed_lines():
        await render_line(text, out_dir)


async def render_line(text: str, out_dir: str) -> None:
    from google import genai
    from google.genai import types as T

    model, location, voice = _riya_live_settings()
    client = genai.Client(
        vertexai=True, project=os.environ["GOOGLE_CLOUD_PROJECT"], location=location
    )
    cfg = T.LiveConnectConfig(
        response_modalities=[T.Modality.AUDIO],
        system_instruction=T.Content(
            parts=[T.Part(text="You are Riya, a warm school calling assistant. Natural Indian English.")]
        ),
        speech_config=T.SpeechConfig(
            voice_config=T.VoiceConfig(prebuilt_voice_config=T.PrebuiltVoiceConfig(voice_name=voice))
        ),
        output_audio_transcription=T.AudioTranscriptionConfig(),
    )
    pcm = b""
    said = ""
    async with client.aio.live.connect(model=model, config=cfg) as s:
        await s.send_client_content(
            turns=T.Content(role="user", parts=[T.Part(text=f'Say exactly this, and nothing else: "{text}"')]),
            turn_complete=True,
        )
        async for m in s.receive():
            if m.data:
                pcm += m.data
            sc = m.server_content
            if sc and sc.output_transcription and sc.output_transcription.text:
                said += sc.output_transcription.text
            if sc and sc.turn_complete:
                break
    state = DecimatorState()
    ulaw, _ = pcm24k_to_ulaw8k(pcm, state)
    ulaw = trim_silence(ulaw)
    out = Path(out_dir) / f"{riya_opener_key(text, voice, model)}.ulaw"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(ulaw)
    print(f"{out.name}: {len(ulaw) / 8000:.1f}s | spoken: {said.strip()}")


if __name__ == "__main__":
    asyncio.run(main(*sys.argv[1:]))
