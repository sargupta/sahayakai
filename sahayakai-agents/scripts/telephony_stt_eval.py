"""Speech-recognition evaluation for parent calls, on the phone path.

Why: on the 2026-10-11 handset call, parent replies were saved as
"connection matlab in English x ^ 6Y" and "Villa". This measures which
recogniser, and which settings, survive what a parent's voice goes through:

    synthetic parent speech (several Indian voices, English + code-mixed)
      -> 300-3400 Hz band limit -> handset level -> line noise -> 8 kHz mu-law
      -> recogniser -> WER/CER against the reference

Recognisers compared:
  * gemini-live: the bridge's current path (Gemini Live input transcription,
    the same language hints the bridge sends).
  * sarvam-*: Sarvam `saaras:v3-realtime` over its realtime WebSocket, with
    language/mode variants.

No real parent audio is used or stored. Synthetic clips and results go to --out.

Run (Git Bash, from sahayakai-agents):
    PYTHONUTF8=1 PYTHONPATH=src python scripts/telephony_stt_eval.py --out <dir>
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import io
import json
import math
import random
import re
import subprocess
import time
import unicodedata
import wave
from array import array
from pathlib import Path
from typing import Any

import httpx

from sahayakai_agents.telephony.audio import pcm16_to_ulaw, ulaw8k_to_pcm16k

PROJECT = "sahayakai-b4248"

#: (id, language for the TTS voice, text spoken, reference for scoring)
UTTERANCES = [
    ("yes_mother", "en", "Yes, I am Ravi's mother.", "yes i am ravi's mother"),
    ("haan_boliye", "hi", "हाँ जी, बोलिए।", "haan ji boliye"),
    (
        "attendance_q",
        "en",
        "How has his attendance been lately?",
        "how has his attendance been lately",
    ),
    ("marks_q", "en", "What marks did he get in science?", "what marks did he get in science"),
    ("wait", "en", "Wait, wait, one minute please.", "wait wait one minute please"),
    ("attendance_hi", "hi", "अच्छा, उसका attendance कैसा है?", "achha uska attendance kaisa hai"),
    ("hindi_q", "hi", "क्या आप मेरी हिंदी समझ सकते हो?", "kya aap meri hindi samajh sakte ho"),
    ("goodbye", "en", "Okay, thank you so much, bye.", "okay thank you so much bye"),
    ("wrong_number", "en", "No, this is the wrong number.", "no this is the wrong number"),
    ("speak_hindi", "en", "Can you please speak in Hindi?", "can you please speak in hindi"),
    (
        "homework_q",
        "en",
        "Has he submitted his homework this week?",
        "has he submitted his homework this week",
    ),
    (
        "busy",
        "en",
        "I am driving right now, call me later.",
        "i am driving right now call me later",
    ),
]

VOICES = {
    "en": ["en-IN-Neural2-A", "en-IN-Neural2-B", "en-IN-Wavenet-D"],
    "hi": ["hi-IN-Neural2-A", "hi-IN-Neural2-B", "hi-IN-Wavenet-C"],
}

# ---- romanisation so Devanagari output can be scored against Latin refs ----

_DEV = {
    "अ": "a",
    "आ": "aa",
    "इ": "i",
    "ई": "ee",
    "उ": "u",
    "ऊ": "oo",
    "ए": "e",
    "ऐ": "ai",
    "ओ": "o",
    "औ": "au",
    "क": "k",
    "ख": "kh",
    "ग": "g",
    "घ": "gh",
    "च": "ch",
    "छ": "chh",
    "ज": "j",
    "झ": "jh",
    "ट": "t",
    "ठ": "th",
    "ड": "d",
    "ढ": "dh",
    "ण": "n",
    "त": "t",
    "थ": "th",
    "द": "d",
    "ध": "dh",
    "न": "n",
    "प": "p",
    "फ": "ph",
    "ब": "b",
    "भ": "bh",
    "म": "m",
    "य": "y",
    "र": "r",
    "ल": "l",
    "व": "v",
    "श": "sh",
    "ष": "sh",
    "स": "s",
    "ह": "h",
    "ा": "aa",
    "ि": "i",
    "ी": "ee",
    "ु": "u",
    "ू": "oo",
    "े": "e",
    "ै": "ai",
    "ो": "o",
    "ौ": "au",
    "ं": "n",
    "ँ": "n",
    "्": "",
    "़": "",
    "ः": "h",
    "ृ": "ri",
}


def romanise(text: str) -> str:
    out = []
    for i, ch in enumerate(text):
        r = _DEV.get(ch)
        if r is None:
            out.append(ch)
            continue
        out.append(r)
        # consonant without matra/virama gets an inherent 'a' except word-final
        if "क" <= ch <= "ह":
            nxt = text[i + 1] if i + 1 < len(text) else " "
            if (
                not ("ा" <= nxt <= "्" or nxt in "ंँ़")
                and nxt.strip()
                and unicodedata.category(nxt).startswith("L")
            ):
                out.append("a")
    return "".join(out)


def norm(text: str) -> list[str]:
    t = romanise(text.lower())
    t = re.sub(r"[^a-z0-9' ]+", " ", t)
    t = t.replace("aa", "a").replace("ee", "i").replace("oo", "u")  # loose vowel length
    return t.split()


def edit_distance(a: list[Any], b: list[Any]) -> int:
    dp = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        prev, dp[0] = dp[0], i
        for j in range(1, len(b) + 1):
            cur = dp[j]
            dp[j] = min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] != b[j - 1]))
            prev = cur
    return dp[-1]


def wer(ref: str, hyp: str) -> float:
    r, h = norm(ref), norm(hyp)
    return edit_distance(r, h) / max(1, len(r))


# ---- synthesis and phone path -------------------------------------------


def gcloud(*args: str) -> str:
    return subprocess.run(["gcloud.cmd", *args], capture_output=True, text=True).stdout.strip()


def synth(text: str, voice: str, token: str) -> array[int]:
    body = {
        "input": {"text": text},
        "voice": {"languageCode": voice[:5], "name": voice},
        "audioConfig": {"audioEncoding": "LINEAR16", "sampleRateHertz": 8000},
    }
    r = httpx.post(
        "https://texttospeech.googleapis.com/v1/text:synthesize",
        json=body,
        timeout=30,
        headers={"Authorization": f"Bearer {token}", "x-goog-user-project": PROJECT},
    )
    r.raise_for_status()
    with wave.open(io.BytesIO(base64.b64decode(r.json()["audioContent"]))) as w:
        return array("h", w.readframes(w.getnframes()))


def phone_path(pcm: array[int], *, level_dbov: float, snr_db: float, seed: int) -> bytes:
    """Band-limit to 300-3400 Hz, set the speech level, add line noise, mu-law."""
    x = [float(s) for s in pcm]
    # one-pole high-pass ~300 Hz and low-pass ~3400 Hz at 8 kHz
    a_hp = math.exp(-2 * math.pi * 300 / 8000)
    a_lp = math.exp(-2 * math.pi * 3400 / 8000)
    y, prev_x, prev_y, lp = [], 0.0, 0.0, 0.0
    for s in x:
        hp = a_hp * (prev_y + s - prev_x)
        prev_x, prev_y = s, hp
        lp = (1 - a_lp) * hp + a_lp * lp
        y.append(lp)
    active = [v for v in y if abs(v) > 50] or y
    rms = math.sqrt(sum(v * v for v in active) / len(active)) or 1.0
    gain = (32768 * 10 ** (level_dbov / 20)) / rms
    rng = random.Random(seed)
    noise_rms = 32768 * 10 ** ((level_dbov - snr_db) / 20)
    pad = [0.0] * 4000  # 0.5 s of line before and after
    out = [v * gain for v in pad + y + pad]
    out = [max(-32767, min(32767, v + rng.gauss(0, noise_rms))) for v in out]
    return pcm16_to_ulaw(array("h", (int(v) for v in out)))


# ---- recognisers ---------------------------------------------------------


async def sarvam_transcribe(ulaw: bytes, key: str, *, language: str, mode: str) -> dict[str, Any]:
    import websockets

    url = (
        "wss://api.sarvam.ai/speech-to-text-realtime/ws?model=saaras:v3-realtime"
        f"&language_code={language}&mode={mode}&encoding=linear16&sample_rate=16000"
        "&stream_type=balanced"
    )
    pcm16k = ulaw8k_to_pcm16k(ulaw)
    finals: list[str] = []
    events: list[str] = []
    t0 = time.monotonic()
    speech_start_at = None
    async with websockets.connect(
        url, additional_headers={"Api-Subscription-Key": key}, open_timeout=20, max_size=None
    ) as ws:

        async def send() -> None:
            step = 640  # 20 ms at 16 kHz
            for i in range(0, len(pcm16k), step):
                await ws.send(
                    json.dumps(
                        {
                            "event": "audio_input",
                            "audio": base64.b64encode(pcm16k[i : i + step]).decode(),
                        }
                    )
                )
                await asyncio.sleep(0.02)
            silence = b"\x00" * step
            for _ in range(75):  # 1.5 s trailing silence for the endpointer
                await ws.send(
                    json.dumps(
                        {"event": "audio_input", "audio": base64.b64encode(silence).decode()}
                    )
                )
                await asyncio.sleep(0.02)

        sender = asyncio.create_task(send())
        try:
            while True:
                raw = await asyncio.wait_for(ws.recv(), timeout=8)
                m = json.loads(raw)
                ev = m.get("event")
                events.append(ev)
                if ev == "vad.speech_start" and speech_start_at is None:
                    speech_start_at = time.monotonic() - t0
                if ev == "transcript.final":
                    finals.append(m.get("text", ""))
                if ev == "error":
                    events.append(f"error:{m.get('code')}:{m.get('message')}")
                    break
                if ev == "transcript.final" and sender.done():
                    break
        except TimeoutError:
            pass
        sender.cancel()
    return {
        "text": " ".join(finals),
        "speech_start_s": speech_start_at,
        "events": sorted(set(e for e in events if e)),
    }


async def gemini_live_transcribe(ulaw: bytes, client: Any) -> dict[str, Any]:
    from google.genai import types as t

    from sahayakai_agents.telephony.prompt import stt_language_hints

    cfg = t.LiveConnectConfig(
        response_modalities=[t.Modality.AUDIO],
        system_instruction=t.Content(parts=[t.Part(text="Listen. Reply with one word: okay.")]),
        input_audio_transcription=t.AudioTranscriptionConfig(
            language_codes=stt_language_hints("English")
        ),
    )
    heard: list[str] = []
    async with client.aio.live.connect(model="gemini-live-2.5-flash", config=cfg) as s:
        pcm16k = ulaw8k_to_pcm16k(ulaw)

        async def send() -> None:
            step = 640
            for i in range(0, len(pcm16k), step):
                await s.send_realtime_input(
                    audio=t.Blob(data=pcm16k[i : i + step], mime_type="audio/pcm;rate=16000")
                )
                await asyncio.sleep(0.02)
            for _ in range(75):
                await s.send_realtime_input(
                    audio=t.Blob(data=b"\x00" * step, mime_type="audio/pcm;rate=16000")
                )
                await asyncio.sleep(0.02)

        sender = asyncio.create_task(send())
        try:

            async def collect() -> None:
                while True:
                    async for m in s.receive():
                        sc = m.server_content
                        if sc and sc.input_transcription and sc.input_transcription.text:
                            heard.append(sc.input_transcription.text)
                        if sc and sc.turn_complete and sender.done():
                            return

            await asyncio.wait_for(collect(), timeout=15)
        except TimeoutError:
            pass
        sender.cancel()
    return {"text": "".join(heard).strip()}


# ---- main ------------------------------------------------------------------

CONDITIONS = {
    "normal": {"level_dbov": -24.0, "snr_db": 30.0},
    "quiet_noisy": {"level_dbov": -36.0, "snr_db": 15.0},
}

RECOGNISERS = [
    "gemini-live",
    "sarvam-en-IN-transcribe",
    "sarvam-auto-codemix",
    "sarvam-en-IN-codemix",
]


async def main() -> None:
    from google import genai

    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--recognisers", default=",".join(RECOGNISERS))
    args = ap.parse_args()
    out = Path(args.out)
    (out / "clips").mkdir(parents=True, exist_ok=True)
    # Results are appended as they come and a rerun skips what is done: a long
    # run outlives one access token (the first run died at a 401 after ~1 h).
    jsonl = out / "stt-results.jsonl"
    done = set()
    if jsonl.exists():
        for line in jsonl.read_text(encoding="utf-8").splitlines():
            if line.strip():
                d = json.loads(line)
                done.add((d["utt"], d["voice"], d["cond"], d["rec"]))
    key = gcloud(
        "secrets",
        "versions",
        "access",
        "latest",
        "--secret",
        "SARVAM_AI_API_KEY",
        "--project",
        PROJECT,
    )
    client = genai.Client(vertexai=True, project=PROJECT, location="global")
    recs = args.recognisers.split(",")
    for uid, lang, text, ref in UTTERANCES:
        for vi, voice in enumerate(VOICES[lang]):
            todo = [(c, r) for c in CONDITIONS for r in recs if (uid, voice, c, r) not in done]
            if not todo:
                continue
            pcm = synth(text, voice, gcloud("auth", "print-access-token"))
            for cond, p in CONDITIONS.items():
                ulaw = phone_path(pcm, seed=vi, **p)
                (out / "clips" / f"{uid}__{voice}__{cond}.ulaw").write_bytes(ulaw)
                for rec in recs:
                    if (uid, voice, cond, rec) in done:
                        continue
                    try:
                        if rec == "gemini-live":
                            r = await gemini_live_transcribe(ulaw, client)
                        else:
                            language, mode = rec.removeprefix("sarvam-").rsplit("-", 1)
                            r = await sarvam_transcribe(ulaw, key, language=language, mode=mode)
                    except Exception as exc:  # noqa: BLE001
                        r = {"text": "", "error": f"{type(exc).__name__}: {exc}"[:200]}
                    row = {
                        "utt": uid,
                        "voice": voice,
                        "cond": cond,
                        "rec": rec,
                        "ref": ref,
                        "hyp": r.get("text", ""),
                        "wer": round(wer(ref, r.get("text", "")), 3),
                        **{k: v for k, v in r.items() if k != "text"},
                    }
                    with jsonl.open("a", encoding="utf-8") as fh:
                        fh.write(json.dumps(row, ensure_ascii=False) + chr(10))
                    print(json.dumps(row, ensure_ascii=False), flush=True)
    rows = [json.loads(x) for x in jsonl.read_text(encoding="utf-8").splitlines() if x.strip()]
    print("\nMEAN WER by recogniser x condition")
    for rec in recs:
        for cond in CONDITIONS:
            ws = [r["wer"] for r in rows if r["rec"] == rec and r["cond"] == cond]
            cm = [
                r["wer"]
                for r in rows
                if r["rec"] == rec
                and r["cond"] == cond
                and r["utt"] in ("haan_boliye", "attendance_hi", "hindi_q")
            ]
            print(
                f"  {rec:28} {cond:12} WER {sum(ws) / max(1, len(ws)):.3f}  code-mixed {sum(cm) / max(1, len(cm)):.3f}  n={len(ws)}"
            )


if __name__ == "__main__":
    asyncio.run(main())
