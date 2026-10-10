"""Voice evaluation harness for SahayakAI parent phone calls.

README
======
Compares candidate voices for the Vobiz parent-call bridge on the path a parent
actually hears: synthesis -> 8 kHz mu-law (the carrier format) -> decoded PCM.

Candidates
  * Gemini Live (`gemini-live-2.5-flash` @ global, the bridge's model) across its
    prebuilt voices, with and without an "Indian English accent" instruction,
    plus any native-audio Live model Vertex accepts in this project.
  * Sarvam Bulbul TTS (REST streaming endpoint), several models / speakers.

Per clip it records time-to-first-audio and total synthesis time, writes the
original WAV and the phone-path WAV, transcribes the phone-path WAV with
`gemini-2.5-flash` (a different model from the one under test) for WER/CER, and
asks `gemini-2.5-pro` to rate it as an audio judge. Judge scores are LLM-judge
scores, NOT human ratings.

Run (Git Bash, from the repo's `sahayakai-agents` directory):

    PYTHONUTF8=1 PYTHONPATH=src python scripts/telephony_voice_eval.py \
        --out /path/to/voice-eval --phases probe,synth,drift,asr,judge,report

Phases: probe (which models/voices/locations exist), synth (one fresh Live session
per line; a single long session re-speaks earlier lines), drift (6 turns in ONE
session, pitch per turn), asr, judge (per-clip + holistic), report (results.json
and the auto tables inside <out>/REPORT.md).

Phases are resumable: each clip's result is cached under `<out>/clips/<cand>/`
and is skipped on rerun unless `--force` is given. `--only` restricts to
candidate ids (comma separated, substring match).

Credentials
  * Vertex AI: Application Default Credentials (`gcloud auth application-default
    login`), project from `--project` (default sahayakai-b4248).
  * Sarvam: the key is read at runtime from Secret Manager (`SARVAM_AI_API_KEY`)
    via `gcloud secrets versions access` into memory only, or from the env var
    SARVAM_API_KEY if set. It is never printed or written.

Cost: each candidate speaks ~10 short lines (~40 s of audio). A full run is a
few hundred short Vertex requests plus ~10k Sarvam characters.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import io
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import time
import unicodedata
import wave
from array import array
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from sahayakai_agents.telephony.audio import pcm16_to_ulaw, pcm24k_to_ulaw8k, ulaw_to_pcm16
from sahayakai_agents.telephony.conformance import _median_f0

# --------------------------------------------------------------------------
# Fixed script set: identical for every candidate.
# lang: "en" = Indian English, "mix" = Hindi-English code-mixed (romanised).
# --------------------------------------------------------------------------
SCRIPTS: list[dict[str, str]] = [
    {"id": "L01", "lang": "en", "text": "Namaste, I am calling from Ravi's school about his progress in Class 7 Section B."},
    {"id": "L02", "lang": "en", "text": "Lakshmi Narayanan scored 34 out of 50 in the science unit test."},
    {"id": "L03", "lang": "en", "text": "Priyanka Deshpande was absent on 3rd and 4th October, so her attendance is now 88 percent."},
    {"id": "L04", "lang": "en", "text": "Mohammed Irfan, roll number 23, has not submitted his maths homework this week."},
    {"id": "L05", "lang": "en", "text": "The parent-teacher meeting is on Saturday, 18th October, at 10:30 in the morning."},
    {"id": "L06", "lang": "en", "text": "Could you please make sure he revises the chapters before the next unit test?"},
    {"id": "L07", "lang": "en", "text": "Her marks in English have improved by 12 percent since the last term, which is very good."},
    {"id": "L08", "lang": "mix", "text": "Haan ji, Ravi ka science test thoda weak tha, but he is trying hard."},
    {"id": "L09", "lang": "mix", "text": "Achha, theek hai, main teacher ko bata dungi."},
    {"id": "L10", "lang": "mix", "text": "Aap please Priyanka ko roz homework karwa dijiye, bas aadha ghanta."},
]

PROJECT = "sahayakai-b4248"

# --------------------------------------------------------------------------
# Candidate definitions
# --------------------------------------------------------------------------
HALF_CASCADE = "gemini-live-2.5-flash"
PROBE_VOICES = ["Aoede", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Zephyr",
                "Achernar", "Sulafat", "Gacrux", "NotARealVoice"]
NATIVE_AUDIO_PROBE = [
    ("gemini-live-2.5-flash-native-audio", "global"),
    ("gemini-live-2.5-flash-native-audio", "us-central1"),
    ("gemini-live-2.5-flash-preview-native-audio-09-2025", "us-central1"),
    ("gemini-2.5-flash-native-audio-preview-09-2025", "us-central1"),
    ("gemini-live-2.5-flash-native-audio", "asia-south1"),
    # Listed as GA and "recommended" on the Vertex Live API page (Oct 2026).
    ("gemini-3.8-live", "global"),
    ("gemini-3.8-live", "us-central1"),
    ("gemini-3.8-live", "asia-south1"),
]
#: Is the bridge's model offered anywhere other than `global`? (residency)
HALF_CASCADE_LOCATIONS = ["asia-south1", "us-central1"]
_SHORT = {"gemini-live-2.5-flash-native-audio": "native25", "gemini-3.8-live": "g38live"}

BASE_INSTRUCTION = (
    "You are the voice of a school calling a parent in India. When the user sends "
    "a line, speak exactly that line, word for word, once, and nothing else. Do not "
    "add greetings, comments, questions or answers. Do not translate it."
)
ACCENT_INSTRUCTION = (
    " Speak with a natural Indian English accent, like a warm Indian school teacher "
    "on the phone. Pronounce Indian names (Ravi, Lakshmi Narayanan, Priyanka "
    "Deshpande, Mohammed Irfan) the Indian way. Say Hindi words in the line as "
    "natural Hindi. Speak at a calm, clear pace."
)


@dataclass
class Candidate:
    id: str
    provider: str  # gemini_live | sarvam
    model: str
    voice: str
    accent: bool = False
    location: str = "global"
    language_code: str | None = None  # Gemini SpeechConfig.language_code
    codec: str = "pcm24k"  # sarvam: pcm24k (through the repo resampler) | mulaw8k (native)


def gemini_candidates(probe: dict[str, Any], accent_voices: list[str],
                      native_voices: list[str]) -> list[Candidate]:
    out: list[Candidate] = []
    ok_voices = [v for v, r in probe.get("half_cascade_voices", {}).items()
                 if r.get("ok") and v != "NotARealVoice"]
    for v in ok_voices:
        out.append(Candidate(f"gl25f-{v}-plain", "gemini_live", HALF_CASCADE, v))
    for v in accent_voices:
        if v in ok_voices:
            out.append(Candidate(f"gl25f-{v}-accent", "gemini_live", HALF_CASCADE, v, accent=True))
    if probe.get("language_code_en_IN", {}).get("ok") and "Aoede" in ok_voices:
        out.append(Candidate("gl25f-Aoede-accent-enIN", "gemini_live", HALF_CASCADE, "Aoede",
                             accent=True, language_code="en-IN"))
    seen: set[str] = set()
    for native in probe.get("native_audio_models", []):
        if not native.get("ok") or native["model"] in seen:
            continue
        seen.add(native["model"])
        tag = _SHORT.get(native["model"], native["model"])
        for v in native_voices:
            out.append(Candidate(f"{tag}-{v}-accent", "gemini_live", native["model"], v,
                                 accent=True, location=native["location"]))
        if native_voices:
            v = native_voices[0]
            out.append(Candidate(f"{tag}-{v}-plain", "gemini_live", native["model"], v,
                                 location=native["location"]))
    return out


SARVAM_CANDIDATES = [
    Candidate("sarvam-v3-priya", "sarvam", "bulbul:v3", "priya"),
    Candidate("sarvam-v3-kavya", "sarvam", "bulbul:v3", "kavya"),
    Candidate("sarvam-v3-rohan", "sarvam", "bulbul:v3", "rohan"),
    Candidate("sarvam-v4f-simran_enhi_customer", "sarvam", "bulbul:v4-flash", "simran_enhi_customer"),
    Candidate("sarvam-v4f-ishita_en_customer", "sarvam", "bulbul:v4-flash", "ishita_en_customer"),
    Candidate("sarvam-v4f-ritu_en_edtech", "sarvam", "bulbul:v4-flash", "ritu_en_edtech"),
    Candidate("sarvam-v4f-shubh_enhi_banking", "sarvam", "bulbul:v4-flash", "shubh_enhi_banking"),
    Candidate("sarvam-v4f-simran_enhi_customer-mulaw8k", "sarvam", "bulbul:v4-flash",
              "simran_enhi_customer", codec="mulaw8k"),
]


# --------------------------------------------------------------------------
# Audio helpers
# --------------------------------------------------------------------------
def write_wav(path: Path, pcm: bytes, rate: int) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)


def phone_path_from_24k(pcm24: bytes, chunk: int = 4800) -> tuple[bytes, bytes]:
    """Run 24 kHz PCM through the bridge's resampler in streaming-sized chunks.

    Returns (ulaw8k, decoded pcm16 8k bytes).
    """
    state = None
    ulaw = bytearray()
    for i in range(0, len(pcm24), chunk):
        part, state = pcm24k_to_ulaw8k(pcm24[i:i + chunk], state)
        ulaw.extend(part)
    return bytes(ulaw), ulaw_to_pcm16(bytes(ulaw)).tobytes()


def f0_of(pcm8k: bytes) -> float:
    samples = array("h")
    samples.frombytes(pcm8k)
    try:
        return round(_median_f0(samples, 8000, lo=70, hi=400), 1)
    except Exception:
        return 0.0


# --------------------------------------------------------------------------
# Gemini Live synthesis
# --------------------------------------------------------------------------
def vertex_client(location: str):
    from google import genai
    return genai.Client(vertexai=True, project=PROJECT, location=location)


def live_config(c: Candidate | None, voice: str, accent: bool, language_code: str | None):
    from google.genai import types as T
    instr = BASE_INSTRUCTION + (ACCENT_INSTRUCTION if accent else "")
    sc_kwargs: dict[str, Any] = {
        "voice_config": T.VoiceConfig(prebuilt_voice_config=T.PrebuiltVoiceConfig(voice_name=voice))
    }
    if language_code:
        sc_kwargs["language_code"] = language_code
    return T.LiveConnectConfig(
        response_modalities=[T.Modality.AUDIO],
        system_instruction=T.Content(parts=[T.Part(text=instr)]),
        speech_config=T.SpeechConfig(**sc_kwargs),
        output_audio_transcription=T.AudioTranscriptionConfig(),
    )


async def live_turn(session: Any, text: str, timeout: float = 40.0) -> dict[str, Any]:
    from google.genai import types as T
    t0 = time.perf_counter()
    await session.send_client_content(
        turns=T.Content(role="user", parts=[T.Part(text=f"Line: {text}")]),
        turn_complete=True,
    )
    audio = bytearray()
    first = None
    transcript: list[str] = []

    async def pump() -> None:
        nonlocal first
        async for msg in session.receive():
            sc = msg.server_content
            if sc is None:
                continue
            if sc.model_turn:
                for p in sc.model_turn.parts or []:
                    if p.inline_data and p.inline_data.data:
                        if first is None:
                            first = time.perf_counter() - t0
                        audio.extend(p.inline_data.data)
            if sc.output_transcription and sc.output_transcription.text:
                transcript.append(sc.output_transcription.text)
            if sc.turn_complete:
                return

    await asyncio.wait_for(pump(), timeout)
    return {
        "pcm24": bytes(audio),
        "ttfa_ms": round(first * 1000) if first is not None else None,
        "total_ms": round((time.perf_counter() - t0) * 1000),
        "self_transcript": "".join(transcript).strip(),
    }


async def probe_live(model: str, location: str, voice: str, language_code: str | None = None) -> dict[str, Any]:
    client = vertex_client(location)
    t0 = time.perf_counter()
    try:
        async with client.aio.live.connect(model=model, config=live_config(None, voice, False, language_code)) as s:
            connect_ms = round((time.perf_counter() - t0) * 1000)
            r = await live_turn(s, "Hello, this is a short test.", timeout=30)
        pcm24 = r["pcm24"]
        if not pcm24:
            return {"ok": False, "error": "connected but no audio", "connect_ms": connect_ms}
        _, pcm8 = phone_path_from_24k(pcm24)
        return {"ok": True, "connect_ms": connect_ms, "ttfa_ms": r["ttfa_ms"],
                "audio_s": round(len(pcm24) / 48000, 2), "f0_hz": f0_of(pcm8),
                "said": r["self_transcript"]}
    except Exception as e:  # record rejection reason verbatim (no secrets involved)
        return {"ok": False, "error": f"{type(e).__name__}: {str(e)[:300]}"}


async def synth_gemini(c: Candidate, lines: list[dict], clip_dir: Path, force: bool, conc: int = 4) -> None:
    """One fresh Live session per line.

    A single session fed one text turn per line was tried first: from the fifth
    turn the model re-spoke every earlier line before the new one (audio grew to
    30 s by line 10), so per-line sessions are the only clean TTS measurement.
    Consequence: TTFA is measured on an already-open session (connect time is
    recorded separately), and the f0 spread is ACROSS sessions, not within one.
    """
    todo = [ln for ln in lines if _needs(clip_dir, ln, force)]
    if not todo:
        return
    client = vertex_client(c.location)
    sem = asyncio.Semaphore(conc)

    async def one(ln: dict) -> None:
        async with sem:
            t0 = time.perf_counter()
            try:
                async with client.aio.live.connect(
                        model=c.model, config=live_config(c, c.voice, c.accent, c.language_code)) as s:
                    connect_ms = round((time.perf_counter() - t0) * 1000)
                    r = await live_turn(s, ln["text"])
            except Exception as e:
                save_meta(clip_dir, ln, {"error": f"{type(e).__name__}: {str(e)[:300]}"})
                print(f"  {c.id} {ln['id']} ERROR {e}")
                return
        if not r["pcm24"]:
            save_meta(clip_dir, ln, {"error": "no audio"})
            return
        write_wav(clip_dir / f"{ln['id']}.orig24k.wav", r["pcm24"], 24000)
        _, pcm8 = phone_path_from_24k(r["pcm24"])
        write_wav(clip_dir / f"{ln['id']}.phone8k.wav", pcm8, 8000)
        save_meta(clip_dir, ln, {
            "ttfa_ms": r["ttfa_ms"], "total_ms": r["total_ms"], "session_connect_ms": connect_ms,
            "audio_s": round(len(pcm8) / 16000, 2), "f0_hz": f0_of(pcm8),
            "self_transcript": r["self_transcript"],
            "ttfa_note": "first audio chunk after the text turn on an already-open session",
        })
        print(f"  {c.id} {ln['id']} connect={connect_ms}ms ttfa={r['ttfa_ms']}ms total={r['total_ms']}ms")

    await asyncio.gather(*(one(ln) for ln in todo))


DRIFT_TURNS = 6


async def drift_gemini(c: Candidate, clip_dir: Path, force: bool) -> None:
    """Within-ONE-session pitch stability (the router's native-audio concern).

    Six turns in one session; the median f0 of each turn is recorded. Content is
    not scored here: the model may re-speak earlier lines in a long session (see
    `synth_gemini`), which does not invalidate a pitch measurement.
    """
    dest = clip_dir / "drift.json"
    if dest.exists() and not force:
        prev = json.loads(dest.read_text(encoding="utf-8"))
        if not any(t.get("error") for t in prev["turns"]):
            return
    client = vertex_client(c.location)
    turns = []
    try:
        async with client.aio.live.connect(
                model=c.model, config=live_config(c, c.voice, c.accent, c.language_code)) as s:
            for ln in SCRIPTS[:DRIFT_TURNS]:
                r = await live_turn(s, ln["text"])
                _, pcm8 = phone_path_from_24k(r["pcm24"]) if r["pcm24"] else (b"", b"")
                turns.append({"line_id": ln["id"], "f0_hz": f0_of(pcm8) if pcm8 else 0.0,
                              "audio_s": round(len(pcm8) / 16000, 2), "ttfa_ms": r["ttfa_ms"]})
    except Exception as e:
        turns.append({"error": f"{type(e).__name__}: {str(e)[:200]}"})
    f0s = [t["f0_hz"] for t in turns if t.get("f0_hz")]
    out = {"turns": turns,
           "f0_spread_x": round(max(f0s) / min(f0s), 2) if len(f0s) >= 2 else None,
           "f0_stdev": round(statistics.stdev(f0s), 1) if len(f0s) >= 2 else None,
           "passes_conformance_1_15x": (max(f0s) / min(f0s) <= 1.15) if len(f0s) >= 3 else None}
    dest.write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"  drift {c.id}: {[t.get('f0_hz') for t in turns]} spread={out['f0_spread_x']}")


# --------------------------------------------------------------------------
# Sarvam synthesis
# --------------------------------------------------------------------------
_SARVAM_KEY: str | None = None


def sarvam_key() -> str:
    global _SARVAM_KEY
    if _SARVAM_KEY is None:
        k = os.environ.get("SARVAM_API_KEY")
        if not k:
            gc = shutil.which("gcloud.cmd") or shutil.which("gcloud") or "gcloud"
            k = subprocess.run(
                [gc, "secrets", "versions", "access", "latest", "--secret", "SARVAM_AI_API_KEY",
                 "--project", PROJECT], capture_output=True, text=True, check=True).stdout.strip()
        _SARVAM_KEY = k
    return _SARVAM_KEY


SARVAM_STREAM_URL = "https://api.sarvam.ai/text-to-speech/stream"


def sarvam_request(client: Any, c: Candidate, ln: dict) -> dict[str, Any]:
    body = {
        "text": ln["text"],
        "target_language_code": "hi-IN" if ln["lang"] == "mix" else "en-IN",
        "model": c.model,
        "speaker": c.voice,
        "speech_sample_rate": 8000 if c.codec == "mulaw8k" else 24000,
        "output_audio_codec": "mulaw" if c.codec == "mulaw8k" else "linear16",
    }
    t0 = time.perf_counter()
    first = None
    buf = bytearray()
    with client.stream("POST", SARVAM_STREAM_URL, headers={"api-subscription-key": sarvam_key()},
                       json=body, timeout=60) as r:
        if r.status_code != 200:
            r.read()
            raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
        ctype = r.headers.get("content-type")
        for ch in r.iter_bytes():
            if ch and first is None:
                first = time.perf_counter() - t0
            buf.extend(ch)
    return {"data": bytes(buf), "ttfa_ms": round(first * 1000) if first else None,
            "total_ms": round((time.perf_counter() - t0) * 1000), "content_type": ctype,
            "request": {k: v for k, v in body.items() if k != "text"}}


def synth_sarvam(c: Candidate, lines: list[dict], clip_dir: Path, force: bool) -> None:
    import httpx
    todo = [ln for ln in lines if _needs(clip_dir, ln, force)]
    if not todo:
        return
    sarvam_key()  # fetch the key before any timing starts
    with httpx.Client(http2=False) as client:
        # Warm the keep-alive connection so line 1 is not charged a TLS handshake
        # (a live bridge would hold a warm connection too).
        try:
            sarvam_request(client, c, {"text": "Namaste.", "lang": "en"})
        except Exception as e:
            print(f"  {c.id} warm-up failed: {e}")
        for ln in todo:
            try:
                r = sarvam_request(client, c, ln)
            except Exception as e:
                save_meta(clip_dir, ln, {"error": f"{type(e).__name__}: {str(e)[:300]}"})
                print(f"  {c.id} {ln['id']} ERROR {e}")
                continue
            data = r["data"]
            if c.codec == "mulaw8k":
                # The carrier's own format straight from the API: no resampling.
                pcm8 = ulaw_to_pcm16(data).tobytes()
                write_wav(clip_dir / f"{ln['id']}.orig_mulaw8k_decoded.wav", pcm8, 8000)
            else:
                data = data[: len(data) - len(data) % 2]
                write_wav(clip_dir / f"{ln['id']}.orig24k.wav", data, 24000)
                _, pcm8 = phone_path_from_24k(data)
            write_wav(clip_dir / f"{ln['id']}.phone8k.wav", pcm8, 8000)
            save_meta(clip_dir, ln, {
                "ttfa_ms": r["ttfa_ms"], "total_ms": r["total_ms"], "content_type": r["content_type"],
                "request": r["request"], "chars": len(ln["text"]),
                "audio_s": round(len(pcm8) / 16000, 2), "f0_hz": f0_of(pcm8),
                "ttfa_note": "first response byte of the HTTP streaming endpoint (keep-alive connection)",
            })
            print(f"  {c.id} {ln['id']} ttfa={r['ttfa_ms']}ms total={r['total_ms']}ms")


def _needs(clip_dir: Path, ln: dict, force: bool) -> bool:
    """Synthesise unless a successful clip is cached (failed ones are retried)."""
    p = clip_dir / f"{ln['id']}.json"
    if force or not p.exists():
        return True
    return bool(json.loads(p.read_text(encoding="utf-8")).get("error"))


def save_meta(clip_dir: Path, ln: dict, extra: dict) -> None:
    if extra.get("error"):
        # Keep a history of failures (e.g. Live handshake timeouts) even after a
        # retry succeeds, so flakiness shows up in the report.
        with open(clip_dir / "errors.log", "a", encoding="utf-8") as fh:
            fh.write(json.dumps({"line_id": ln["id"], "at": time.strftime("%H:%M:%S"),
                                 "error": extra["error"]}) + "\n")
    (clip_dir / f"{ln['id']}.json").write_text(
        json.dumps({"line_id": ln["id"], "lang": ln["lang"], "script": ln["text"], **extra},
                   ensure_ascii=False, indent=1), encoding="utf-8")


# --------------------------------------------------------------------------
# ASR + metrics
# --------------------------------------------------------------------------
ASR_MODEL = "gemini-2.5-flash"
JUDGE_MODEL = "gemini-2.5-pro"
ASR_PROMPT = (
    "Transcribe this phone-line audio verbatim. Output only the words spoken, nothing else. "
    "Write English in English. Write any Hindi words in romanised Latin script (Hinglish), "
    "not Devanagari. Write numbers as digits (e.g. 34, 3rd, 10:30)."
)

_ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
         "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
         "nineteen"]
_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
_ORD = {"one": "first", "two": "second", "three": "third", "five": "fifth", "eight": "eighth",
        "nine": "ninth", "twelve": "twelfth"}


def _num_words(n: int) -> str:
    if n < 20:
        return _ONES[n]
    if n < 100:
        return _TENS[n // 10] + ("" if n % 10 == 0 else " " + _ONES[n % 10])
    if n < 1000:
        rest = n % 100
        return _ONES[n // 100] + " hundred" + ("" if rest == 0 else " " + _num_words(rest))
    return str(n)


def _ordinal(n: int) -> str:
    words = _num_words(n).split()
    last = words[-1]
    if last in _ORD:
        last = _ORD[last]
    elif last.endswith("y"):
        last = last[:-1] + "ieth"
    else:
        last += "th"
    return " ".join(words[:-1] + [last])


# Spelling variants that are the same spoken word (transliteration / orthography).
_EQUIV = {
    "ok": "okay", "percent": "percent", "%": " percent", "mohammad": "mohammed", "muhammad": "mohammed",
    "achha": "acha", "accha": "acha", "acchha": "acha", "thik": "theek", "hain": "hai", "haanji": "haan ji",
    "ha": "haan", "han": "haan", "maths": "math", "math": "math", "parentteacher": "parent teacher",
    "dungi": "dungi", "dungee": "dungi", "karwa": "karva", "dijiye": "dijiye", "dijie": "dijiye",
    "aadha": "adha", "roj": "roz", "namaskar": "namaste",
}


def _translit_fold(w: str) -> str:
    """Collapse common romanisation variants (aa/a, ee/i, oo/u, w/v, z/j...)."""
    w = w.replace("aa", "a").replace("ee", "i").replace("oo", "u").replace("w", "v")
    w = w.replace("z", "j").replace("ph", "f").replace("kh", "k").replace("th", "t")
    w = re.sub(r"(.)\1+", r"\1", w)
    return w


def normalise(text: str, fold: bool) -> list[str]:
    t = unicodedata.normalize("NFKC", text).lower()
    t = t.replace("%", " percent ")
    t = re.sub(r"(\d+):(\d+)", lambda m: f"{m.group(1)} {m.group(2)}", t)
    t = re.sub(r"(\d+)(st|nd|rd|th)\b", lambda m: _ordinal(int(m.group(1))), t)
    t = re.sub(r"\d+", lambda m: _num_words(int(m.group(0))), t)
    t = t.replace("-", " ").replace("'s", "").replace("\u2019s", "")
    t = re.sub(r"[^\w\s]", " ", t)
    words = []
    for w in t.split():
        w = _EQUIV.get(w, w)
        words.extend(w.split())
    if fold:
        words = [_translit_fold(w) for w in words]
    return words


def _edit(a: list, b: list) -> int:
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i] + [0] * len(b)
        for j, y in enumerate(b, 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y))
        prev = cur
    return prev[-1]


def wer_cer(ref: str, hyp: str, fold: bool) -> tuple[float, float]:
    r, h = normalise(ref, fold), normalise(hyp, fold)
    wer = _edit(r, h) / max(1, len(r))
    rc, hc = list("".join(r)), list("".join(h))
    cer = _edit(rc, hc) / max(1, len(rc))
    return round(wer, 3), round(cer, 3)


async def gen_audio(client: Any, model: str, wav: bytes | None, prompt: str, schema: Any = None,
                    temperature: float = 0.0) -> str:
    from google.genai import types as T
    cfg = T.GenerateContentConfig(temperature=temperature)
    if schema is not None:
        cfg.response_mime_type = "application/json"
        cfg.response_schema = schema
    for attempt in range(4):
        try:
            resp = await client.aio.models.generate_content(
                model=model,
                contents=[T.Content(role="user", parts=(
                    [T.Part.from_bytes(data=wav, mime_type="audio/wav")] if wav else []) + [T.Part(text=prompt)])],
                config=cfg)
            return (resp.text or "").strip()
        except Exception as e:
            if attempt == 3:
                raise
            await asyncio.sleep(3 * (attempt + 1))
            last = e  # noqa: F841
    return ""


async def run_asr(clip_dirs: list[Path], force: bool, conc: int = 8) -> None:
    client = vertex_client("global")
    sem = asyncio.Semaphore(conc)

    async def one(meta_path: Path) -> None:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        wav = meta_path.with_name(f"{meta['line_id']}.phone8k.wav")
        if meta.get("error") or not wav.exists() or ("asr" in meta and not force):
            return
        async with sem:
            try:
                hyp = await gen_audio(client, ASR_MODEL, wav.read_bytes(), ASR_PROMPT)
            except Exception as e:
                print(f"  ASR fail {meta_path}: {e}")
                return
        raw_hyp = None
        if re.search(r"[\u0900-\u097F]", hyp):
            # The ASR sometimes answers in Devanagari despite the prompt. Romanise
            # it (text-only call) so it can be compared with the romanised script.
            raw_hyp = hyp
            async with sem:
                hyp = await gen_audio(client, ASR_MODEL, None,
                                      "Transliterate this into romanised Hinglish (Latin script). Keep English "
                                      "words in English spelling. Output only the transliteration.\n\n" + raw_hyp)
        fold = meta["lang"] == "mix"
        w, c = wer_cer(meta["script"], hyp, fold)
        meta["asr"] = {"model": ASR_MODEL, "text": hyp, "wer": w, "cer": c, "translit_folded": fold}
        if raw_hyp:
            meta["asr"]["devanagari_original"] = raw_hyp
        meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")

    await asyncio.gather(*(one(p) for d in clip_dirs for p in sorted(d.glob("L*.json"))))


JUDGE_PROMPT = """You are an expert listener evaluating a text-to-speech clip that was sent over an
8 kHz telephone line (mu-law). The clip is meant to be a school calling an Indian parent.
The intended script was:
"{script}"
Rate the audio 1-5 (5 best) on:
- accent: how natural the Indian-English accent sounds to an Indian listener (5 = sounds like a natural Indian speaker; 1 = clearly foreign/robotic)
- names: pronunciation of the Indian names in it (if none, rate general word pronunciation)
- numbers: clarity of numbers, dates and class/roll numbers (if none, rate general clarity)
- naturalness: overall naturalness and pleasantness as a phone voice
Also: verbatim = true if the speech matches the script word for word (ignore minor fillers).
Give a one-line justification. Be strict and consistent; do not reward a voice just for being clear."""


def judge_schema():
    from google.genai import types as T
    return T.Schema(type=T.Type.OBJECT, properties={
        "accent": T.Schema(type=T.Type.INTEGER), "names": T.Schema(type=T.Type.INTEGER),
        "numbers": T.Schema(type=T.Type.INTEGER), "naturalness": T.Schema(type=T.Type.INTEGER),
        "verbatim": T.Schema(type=T.Type.BOOLEAN), "justification": T.Schema(type=T.Type.STRING),
    }, required=["accent", "names", "numbers", "naturalness", "verbatim", "justification"])


async def run_judge(clip_dirs: list[Path], force: bool, conc: int = 6) -> None:
    client = vertex_client("global")
    sem = asyncio.Semaphore(conc)
    schema = judge_schema()

    async def one(meta_path: Path) -> None:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        wav = meta_path.with_name(f"{meta['line_id']}.phone8k.wav")
        if meta.get("error") or not wav.exists() or ("judge" in meta and not force):
            return
        async with sem:
            try:
                raw = await gen_audio(client, JUDGE_MODEL, wav.read_bytes(),
                                      JUDGE_PROMPT.format(script=meta["script"]), schema)
                meta["judge"] = {"model": JUDGE_MODEL, **json.loads(raw)}
            except Exception as e:
                print(f"  judge fail {meta_path}: {e}")
                return
        meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")

    await asyncio.gather(*(one(p) for d in clip_dirs for p in sorted(d.glob("L*.json"))))


HOLISTIC_PROMPT = """You are an expert listener for Indian telephone voice agents. The audio is ONE
synthetic voice reading these {n} lines in order, separated by short pauses, after passing through an
8 kHz mu-law telephone line. It is a school calling an Indian parent.
{lines}
Judge the voice as a whole, 1-5 (5 best), using the full scale and being strict:
- accent: does it sound like a natural Indian-English speaker to an Indian parent? (1 = clearly American/British/foreign or robotic)
- names: pronunciation of Ravi, Lakshmi Narayanan, Priyanka Deshpande, Mohammed Irfan
- numbers: clarity of 34 out of 50, 3rd and 4th October, 88 percent, roll number 23, 18th October, 10:30, 12 percent
- codemix: how natural the Hindi/Hinglish lines (last three) sound
- naturalness: overall human-likeness and pleasantness on a phone call
Give a two-sentence justification naming specific strengths/defects."""


def holistic_schema():
    from google.genai import types as T
    props = {k: T.Schema(type=T.Type.INTEGER) for k in ("accent", "names", "numbers", "codemix", "naturalness")}
    props["justification"] = T.Schema(type=T.Type.STRING)
    return T.Schema(type=T.Type.OBJECT, properties=props, required=list(props))


def concat_phone(d: Path) -> bytes | None:
    pcm = bytearray()
    gap = b"\x00\x00" * 4800  # 0.6 s at 8 kHz
    for ln in SCRIPTS:
        w = d / f"{ln['id']}.phone8k.wav"
        if not w.exists():
            return None
        with wave.open(str(w)) as r:
            pcm.extend(r.readframes(r.getnframes()))
        pcm.extend(gap)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(8000)
        w.writeframes(bytes(pcm))
    return buf.getvalue()


async def run_holistic(clip_dirs: list[Path], force: bool, samples: int = 4, conc: int = 6) -> None:
    """Whole-voice judgement over all ten lines. Per-clip judging proved noisy
    (the same voice scored accent 1 and 5 on adjacent lines), so each candidate
    is also judged as one ~50 s recording, `samples` times at temperature 0.7,
    and the samples are averaged. Even so, two samples of the same recording
    differed by up to 3 points, so treat small differences as noise.

    Samples are topped up (not recomputed) when `samples` grows, and discarded
    when the clips underneath have changed."""
    client = vertex_client("global")
    sem = asyncio.Semaphore(conc)
    lines = "\n".join(f"{i + 1}. {ln['text']}" for i, ln in enumerate(SCRIPTS))
    prompt = HOLISTIC_PROMPT.format(n=len(SCRIPTS), lines=lines)

    async def one(d: Path) -> None:
        dest = d / "holistic.json"
        wav = concat_phone(d)
        if wav is None:
            return
        sig = len(wav)
        runs: list[dict] = []
        if dest.exists() and not force:
            prev = json.loads(dest.read_text(encoding="utf-8"))
            if prev.get("clips_sig") in (None, sig):
                runs = prev["samples"]
        if len(runs) >= samples:
            return
        (d / "all_lines.phone8k.wav").write_bytes(wav)
        for _ in range(samples - len(runs)):
            async with sem:
                try:
                    runs.append(json.loads(await gen_audio(client, JUDGE_MODEL, wav, prompt,
                                                           holistic_schema(), temperature=0.7)))
                except Exception as e:
                    print(f"  holistic fail {d.name}: {e}")
        if runs:
            dest.write_text(json.dumps({"model": JUDGE_MODEL, "clips_sig": sig, "samples": runs},
                                       ensure_ascii=False, indent=1),
                            encoding="utf-8")
            print(f"  holistic {d.name}: {[{k: v for k, v in r.items() if k != 'justification'} for r in runs]}")

    await asyncio.gather(*(one(d) for d in clip_dirs))


# --------------------------------------------------------------------------
# Aggregation
# --------------------------------------------------------------------------
def _p95(xs: list[float]) -> float | None:
    if not xs:
        return None
    xs = sorted(xs)
    return xs[min(len(xs) - 1, round(0.95 * (len(xs) - 1)))]


def _mean(xs: list[float]) -> float | None:
    return round(statistics.mean(xs), 3) if xs else None


def aggregate(cands: list[Candidate], out: Path) -> list[dict[str, Any]]:
    rows = []
    for c in cands:
        d = out / "clips" / c.id
        metas = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(d.glob("L*.json"))] if d.exists() else []
        good = [m for m in metas if not m.get("error")]
        if not metas:
            continue
        ttfa = [m["ttfa_ms"] for m in good if m.get("ttfa_ms") is not None]
        f0s = [m["f0_hz"] for m in good if m.get("f0_hz")]
        js = [m["judge"] for m in good if "judge" in m]
        asr = [m["asr"] for m in good if "asr" in m]
        asr_en = [m["asr"] for m in good if "asr" in m and m["lang"] == "en"]
        asr_mix = [m["asr"] for m in good if "asr" in m and m["lang"] == "mix"]
        row = {
            **asdict(c),
            "clips_ok": len(good), "clips_failed": len(metas) - len(good),
            "errors": sorted({m["error"] for m in metas if m.get("error")}),
            "transient_errors_retried": (len((d / "errors.log").read_text(encoding="utf-8").splitlines())
                                         if (d / "errors.log").exists() else 0),
            "ttfa_mean_ms": _mean(ttfa) and round(_mean(ttfa)), "ttfa_p95_ms": _p95(ttfa),
            "total_mean_ms": _mean([m["total_ms"] for m in good]) and round(_mean([m["total_ms"] for m in good])),
            "session_connect_mean_ms": _mean([m["session_connect_ms"] for m in good if m.get("session_connect_ms")]),
            "audio_s_total": round(sum(m.get("audio_s", 0) for m in good), 1),
            "wer_mean": _mean([a["wer"] for a in asr]), "cer_mean": _mean([a["cer"] for a in asr]),
            "wer_median": float(statistics.median([a["wer"] for a in asr])) if asr else None,
            "wer_en": _mean([a["wer"] for a in asr_en]), "wer_mix": _mean([a["wer"] for a in asr_mix]),
            "f0_median_hz": statistics.median(f0s) if f0s else None,
            "f0_spread_x": round(max(f0s) / min(f0s), 2) if len(f0s) >= 2 else None,
        }
        for k in ("accent", "names", "numbers", "naturalness"):
            row[f"judge_{k}"] = _mean([float(j[k]) for j in js])
        row["judge_overall"] = _mean([row[f"judge_{k}"] for k in ("accent", "names", "numbers", "naturalness")
                                      if row[f"judge_{k}"] is not None])
        hp = d / "holistic.json"
        if hp.exists():
            hs = json.loads(hp.read_text(encoding="utf-8"))["samples"]
            for k in ("accent", "names", "numbers", "codemix", "naturalness"):
                row[f"holistic_{k}"] = _mean([float(h[k]) for h in hs])
            row["holistic_overall"] = _mean([row[f"holistic_{k}"] for k in
                                             ("accent", "names", "numbers", "codemix", "naturalness")])
            per_sample = [statistics.mean(float(h[k]) for k in ("accent", "names", "numbers", "codemix",
                                                                 "naturalness")) for h in hs]
            row["holistic_samples"] = len(hs)
            row["holistic_overall_sd"] = round(statistics.stdev(per_sample), 2) if len(hs) > 1 else None
            row["holistic_justification"] = [h["justification"] for h in hs]
        dp = d / "drift.json"
        if dp.exists():
            dj = json.loads(dp.read_text(encoding="utf-8"))
            row["drift_f0_per_turn"] = [t.get("f0_hz") for t in dj["turns"]]
            row["drift_f0_spread_x"] = dj.get("f0_spread_x")
            row["drift_passes_1_15x"] = dj.get("passes_conformance_1_15x")
        row["judge_verbatim_rate"] = _mean([1.0 if j.get("verbatim") else 0.0 for j in js])
        rows.append(row)
    return rows


def write_results(rows: list[dict], probe: dict, out: Path) -> None:
    per_clip = {}
    for r in rows:
        d = out / "clips" / r["id"]
        per_clip[r["id"]] = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(d.glob("L*.json"))]
    (out / "results.json").write_text(json.dumps({
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "scripts": SCRIPTS, "probe": probe, "candidates": rows, "clips": per_clip,
        "notes": {"judge": f"{JUDGE_MODEL} LLM-judge scores (1-5), not human ratings",
                  "asr": f"{ASR_MODEL}; WER/CER after case/punctuation/number normalisation; "
                         "code-mixed lines additionally folded for romanisation variants"},
    }, ensure_ascii=False, indent=1), encoding="utf-8")


AUTO_BEGIN = "<!-- AUTO-TABLES:BEGIN (regenerated by telephony_voice_eval.py --phases report) -->"
AUTO_END = "<!-- AUTO-TABLES:END -->"


def _rank_key(r: dict) -> float:
    return -((r.get("holistic_overall") or 0) + (r.get("judge_overall") or 0))


def markdown_tables(rows: list[dict], probe: dict) -> str:
    f = lambda v, n=0: "-" if v is None else (f"{v:.{n}f}" if isinstance(v, float) else str(v))  # noqa: E731
    out = ["### Candidates (ranked by holistic + per-clip LLM-judge overall)", "",
           "| # | candidate | model @ location | voice | accent instr. | clips | mean TTFA ms | p95 TTFA ms | "
           "mean WER (median) | mean CER | WER en / mix | clip-judge acc/names/num/nat (overall) | "
           "holistic acc/names/num/codemix/nat (overall) | judge verbatim | f0 median Hz (spread x) |",
           "|" + "---|" * 15]
    for i, r in enumerate(sorted(rows, key=_rank_key), 1):
        acc = "y" if r["accent"] else "n"
        if r.get("language_code"):
            acc += f" + language_code={r['language_code']}"
        if r["provider"] == "sarvam":
            acc = "n/a (" + ("native mulaw 8k" if r["codec"] == "mulaw8k" else "24k PCM -> bridge resampler") + ")"
        out.append(
            f"| {i} | {r['id']} | {r['model']} @ {r['location'] if r['provider'] == 'gemini_live' else 'api.sarvam.ai'} "
            f"| {r['voice']} | {acc} | {r['clips_ok']}/{r['clips_ok'] + r['clips_failed']} "
            f"| {f(r['ttfa_mean_ms'])} | {f(r['ttfa_p95_ms'])} | {f(r['wer_mean'], 3)} ({f(r.get('wer_median'), 3)}) | {f(r['cer_mean'], 3)} "
            f"| {f(r['wer_en'], 3)} / {f(r['wer_mix'], 3)} "
            f"| {f(r['judge_accent'], 1)}/{f(r['judge_names'], 1)}/{f(r['judge_numbers'], 1)}/"
            f"{f(r['judge_naturalness'], 1)} ({f(r['judge_overall'], 2)}) "
            f"| {f(r.get('holistic_accent'), 1)}/{f(r.get('holistic_names'), 1)}/{f(r.get('holistic_numbers'), 1)}/"
            f"{f(r.get('holistic_codemix'), 1)}/{f(r.get('holistic_naturalness'), 1)} ({f(r.get('holistic_overall'), 2)} ±{f(r.get('holistic_overall_sd'), 2)}, n={f(r.get('holistic_samples'))}) "
            f"| {f(r['judge_verbatim_rate'], 2)} | {f(r['f0_median_hz'], 0)} ({f(r['f0_spread_x'], 2)}) |")
    out += ["", "### Gemini Live session connect time (fresh session per line)", "",
            "| candidate | mean connect ms |", "|---|---|"]
    for r in sorted(rows, key=_rank_key):
        if r["provider"] == "gemini_live":
            out.append(f"| {r['id']} | {f(r.get('session_connect_mean_ms'), 0)} |")
    out += ["", "### Pitch stability within ONE Live session (6 turns; repo gate is <= 1.15x)", "",
            "| candidate | median f0 per turn (Hz) | spread | <= 1.15x |", "|---|---|---|---|"]
    for r in sorted(rows, key=_rank_key):
        if "drift_f0_per_turn" in r:
            out.append(f"| {r['id']} | {', '.join(f(x, 0) for x in r['drift_f0_per_turn'])} "
                       f"| {f(r['drift_f0_spread_x'], 2)} | {r['drift_passes_1_15x']} |")
    out += ["", "### Holistic judge justifications (LLM judge, 2 samples each)", ""]
    for r in sorted(rows, key=_rank_key):
        for j in r.get("holistic_justification") or []:
            out.append(f"- **{r['id']}**: {j}")
    out += ["", "### Availability probe (empirical, this project)", ""]
    for v, rr in (probe.get("half_cascade_voices") or {}).items():
        out.append(f"- `{HALF_CASCADE}` @ global, voice `{v}`: " + ("accepted" if rr.get("ok") else f"REJECTED ({rr.get('error')})"))
    lc = probe.get("language_code_en_IN")
    if lc:
        out.append(f"- `{HALF_CASCADE}` @ global, SpeechConfig.language_code=en-IN: " + ("accepted" if lc.get("ok") else f"REJECTED ({lc.get('error')})"))
    for loc, rr in (probe.get("half_cascade_other_locations") or {}).items():
        out.append(f"- `{HALF_CASCADE}` @ {loc}: " + ("accepted" if rr.get("ok") else f"NOT AVAILABLE ({rr.get('error')})"))
    for m in probe.get("native_audio_models") or []:
        out.append(f"- `{m['model']}` @ {m['location']}: " + ("accepted" if m.get("ok") else f"NOT AVAILABLE ({m.get('error')})"))
    for v, rr in (probe.get("native_voices") or {}).items():
        out.append(f"- native-audio voice `{v}`: " + ("accepted" if rr.get("ok") else f"REJECTED ({rr.get('error')})"))
    for m, rr in ((probe.get("sarvam") or {}).get("models") or {}).items():
        out.append(f"- Sarvam `{m}`: " + ("HTTP 200" if rr["status"] == 200 else f"HTTP {rr['status']} ({rr['error']})"))
    return "\n".join(out)


def write_report(rows: list[dict], probe: dict, out: Path) -> None:
    path = out / "REPORT.md"
    block = f"{AUTO_BEGIN}\n{markdown_tables(rows, probe)}\n{AUTO_END}"
    if path.exists():
        cur = path.read_text(encoding="utf-8")
        if AUTO_BEGIN in cur and AUTO_END in cur:
            pre, rest = cur.split(AUTO_BEGIN, 1)
            post = rest.split(AUTO_END, 1)[1]
            path.write_text(pre + block + post, encoding="utf-8")
            return
    path.write_text("# Telephony voice evaluation\n\n" + block + "\n", encoding="utf-8")


def print_table(rows: list[dict]) -> None:
    hdr = f"{'candidate':46} {'ok':>3} {'ttfa':>6} {'p95':>6} {'wer':>6} {'cer':>6} {'acc':>4} {'nam':>4} {'num':>4} {'nat':>4} {'all':>5} {'hol':>5} {'f0x':>5}"
    print(hdr)
    for r in sorted(rows, key=_rank_key):
        f = lambda v, n=0: "-" if v is None else (f"{v:.{n}f}" if isinstance(v, float) else str(v))  # noqa: E731
        print(f"{r['id']:46} {r['clips_ok']:>3} {f(r['ttfa_mean_ms']):>6} {f(r['ttfa_p95_ms']):>6} "
              f"{f(r['wer_mean'], 3):>6} {f(r['cer_mean'], 3):>6} {f(r['judge_accent'], 1):>4} "
              f"{f(r['judge_names'], 1):>4} {f(r['judge_numbers'], 1):>4} {f(r['judge_naturalness'], 1):>4} "
              f"{f(r['judge_overall'], 2):>5} {f(r.get('holistic_overall'), 2):>5} {f(r['f0_spread_x'], 2):>5}")


# --------------------------------------------------------------------------
# Probe phase
# --------------------------------------------------------------------------
async def run_probe(out: Path) -> dict[str, Any]:
    probe: dict[str, Any] = {"half_cascade_voices": {}, "native_audio_models": []}
    for v in PROBE_VOICES:
        r = await probe_live(HALF_CASCADE, "global", v)
        probe["half_cascade_voices"][v] = r
        print(f"  {HALF_CASCADE} voice {v}: {r}")
    probe["language_code_en_IN"] = await probe_live(HALF_CASCADE, "global", "Aoede", "en-IN")
    print("  language_code en-IN:", probe["language_code_en_IN"])
    probe["half_cascade_other_locations"] = {}
    for loc in HALF_CASCADE_LOCATIONS:
        r = await probe_live(HALF_CASCADE, loc, "Aoede")
        probe["half_cascade_other_locations"][loc] = r
        print(f"  {HALF_CASCADE} @ {loc}: {r}")
    for model, loc in NATIVE_AUDIO_PROBE:
        r = await probe_live(model, loc, "Aoede")
        probe["native_audio_models"].append({"model": model, "location": loc, **r})
        print(f"  native {model} @ {loc}: {r}")
    native = next((m for m in probe["native_audio_models"] if m.get("ok")), None)
    if native:
        probe["native_voices"] = {}
        for v in ["Kore", "Puck", "Zephyr", "NotARealVoice"]:
            r = await probe_live(native["model"], native["location"], v)
            probe["native_voices"][v] = r
            print(f"  native voice {v}: {r}")
    probe["sarvam"] = probe_sarvam()
    (out / "probe.json").write_text(json.dumps(probe, ensure_ascii=False, indent=1), encoding="utf-8")
    return probe


def probe_sarvam() -> dict[str, Any]:
    """Which Bulbul model IDs exist: the API's own validation error lists them."""
    import httpx
    res: dict[str, Any] = {"models": {}}
    with httpx.Client() as client:
        for m in ["bulbul:v3", "bulbul:v4-flash", "bulbul:v3-beta", "bulbul:v2", "bulbul:v4", "bulbul:v3-flash"]:
            r = client.post("https://api.sarvam.ai/text-to-speech",
                            headers={"api-subscription-key": sarvam_key()},
                            json={"text": "Namaste.", "target_language_code": "en-IN", "model": m},
                            timeout=60)
            msg = "" if r.status_code == 200 else r.json().get("error", {}).get("message", r.text)[:400]
            res["models"][m] = {"status": r.status_code, "error": msg}
            print(f"  sarvam {m}: {r.status_code} {msg[:160]}")
    return res


# --------------------------------------------------------------------------
def main() -> None:
    global PROJECT
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", required=True)
    ap.add_argument("--phases", default="probe,synth,drift,asr,judge,report")
    ap.add_argument("--drift-only", default="gl25f-Aoede-plain,gl25f-Zephyr-plain,native25-,g38live-",
                    help="Gemini candidates (substring match) to run the one-session pitch-drift test on")
    ap.add_argument("--only", default="")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--accent-voices", default="Aoede,Zephyr,Fenrir",
                    help="half-cascade voices to also run with the Indian-English accent instruction")
    ap.add_argument("--native-voices", default="Aoede,Kore,Puck")
    ap.add_argument("--project", default=PROJECT)
    args = ap.parse_args()
    PROJECT = args.project
    out = Path(args.out)
    (out / "clips").mkdir(parents=True, exist_ok=True)
    phases = set(args.phases.split(","))

    probe_path = out / "probe.json"
    if "probe" in phases and (args.force or not probe_path.exists()):
        print("== probe")
        probe = asyncio.run(run_probe(out))
    else:
        probe = json.loads(probe_path.read_text(encoding="utf-8")) if probe_path.exists() else {}

    cands = gemini_candidates(probe, [v for v in args.accent_voices.split(",") if v],
                              [v for v in args.native_voices.split(",") if v]) + SARVAM_CANDIDATES
    if args.only:
        keys = args.only.split(",")
        cands = [c for c in cands if any(k in c.id for k in keys)]
    print("candidates:", [c.id for c in cands])

    if "synth" in phases:
        print("== synth")
        for c in cands:
            d = out / "clips" / c.id
            d.mkdir(parents=True, exist_ok=True)
            (d / "candidate.json").write_text(json.dumps(asdict(c), indent=1), encoding="utf-8")
            try:
                if c.provider == "gemini_live":
                    asyncio.run(synth_gemini(c, SCRIPTS, d, args.force))
                else:
                    synth_sarvam(c, SCRIPTS, d, args.force)
            except Exception as e:
                print(f"  {c.id} FAILED: {type(e).__name__}: {str(e)[:300]}")
    if "drift" in phases:
        print("== drift (one session, %d turns)" % DRIFT_TURNS)
        keys = [k for k in args.drift_only.split(",") if k]
        dc = [c for c in cands if c.provider == "gemini_live" and any(k in c.id for k in keys)]

        async def _all() -> None:
            # Opening ~10 Live sessions at once produced handshake timeouts; cap it.
            sem = asyncio.Semaphore(3)

            async def _one(c: Candidate) -> None:
                async with sem:
                    await drift_gemini(c, out / "clips" / c.id, args.force)

            await asyncio.gather(*(_one(c) for c in dc))

        for c in dc:
            (out / "clips" / c.id).mkdir(parents=True, exist_ok=True)
        asyncio.run(_all())
    dirs = [out / "clips" / c.id for c in cands if (out / "clips" / c.id).exists()]
    if "asr" in phases:
        print("== asr")
        asyncio.run(run_asr(dirs, args.force))
    if "judge" in phases:
        print("== judge")
        asyncio.run(run_judge(dirs, args.force))
        asyncio.run(run_holistic(dirs, args.force))
    if "report" in phases:
        rows = aggregate(cands, out)
        write_results(rows, probe, out)
        write_report(rows, probe, out)
        print_table(rows)
        print(f"wrote {out / 'results.json'}")


if __name__ == "__main__":
    main()
