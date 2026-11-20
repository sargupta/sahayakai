"""End-to-end check of hands-free VIDYA voice against the REAL stack.

    this script ──ws──► local sidecar /v1/vidya-voice/stream (ADK run_live)
                         ──► Vertex Gemini Live (real model, native audio)

Plays pre-recorded 16 kHz speech WAVs into the socket AT REAL-TIME PACE
(40 ms chunks every 40 ms, continuous silence between utterances — exactly
what a live microphone produces). There is no "send"/end-of-turn signal from
this client: the model's own VAD decides when each turn ends.

Turn 3 is sent WHILE VIDYA is still speaking turn 2's answer, to exercise
barge-in (expects `{"interrupted": true}` and a fresh answer).

Prints timings + transcripts; saves VIDYA's received audio per turn as WAV.
Reads the local stream-token key from sahayakai-main/.env.development.local.

    .venv/Scripts/python.exe scripts/e2e_voice_live.py <dir-with-turn1..4.wav> [ws-url]
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import sys
import time
import wave
from pathlib import Path

import websockets

ROOT = Path(__file__).resolve().parents[1]
WEB_ENV = ROOT.parent / "sahayakai-main" / ".env.development.local"
CHUNK = 640  # samples @16k = 40 ms
OUT_RATE = 24000


def key() -> bytes:
    for line in WEB_ENV.read_text(encoding="utf-8").splitlines():
        if line.startswith("SAHAYAKAI_REQUEST_SIGNING_KEY="):
            return line.split("=", 1)[1].strip().encode()
    raise SystemExit("no key")


def mint(uid: str) -> str:
    exp = int(time.time()) + 120
    sig = base64.urlsafe_b64encode(hmac.new(key(), f"{uid}.{exp}".encode(), hashlib.sha256).digest()).rstrip(b"=").decode()
    return f"{uid}.{exp}.{sig}"


def pcm_of(path: Path) -> bytes:
    with wave.open(str(path), "rb") as w:
        assert w.getframerate() == 16000 and w.getsampwidth() == 2 and w.getnchannels() == 1, path
        return w.readframes(w.getnframes())


class Run:
    def __init__(self) -> None:
        self.t0 = time.perf_counter()
        self.events: list[str] = []
        self.turn = 0
        self.speech_end: dict[int, float] = {}
        self.first_audio: dict[int, float] = {}
        self.audio: dict[int, bytearray] = {}
        self.transcripts: dict[int, dict[str, str]] = {}
        self.tool_calls: list[dict] = []
        self.interrupted_at: float | None = None
        self.barge_start: float | None = None
        self.turn_complete: dict[int, float] = {}
        self.ready_at: float | None = None
        # Simulated speaker: when would the audio received so far finish playing?
        self.play_end = 0.0
        self.last_audio_at = 0.0

    def speaking(self) -> bool:
        return self.now() < self.play_end

    def vidya_done(self) -> bool:
        # Finished = nothing left to play and no new audio for 1.2 s.
        return not self.speaking() and self.last_audio_at > 0 and self.now() - self.last_audio_at > 1.2

    def now(self) -> float:
        return time.perf_counter() - self.t0

    def log(self, msg: str) -> None:
        line = f"{self.now():7.2f}s  {msg}"
        self.events.append(line)
        print(line, flush=True)


async def main() -> None:
    wav_dir = Path(sys.argv[1])
    url = sys.argv[2] if len(sys.argv) > 2 else "ws://127.0.0.1:8080/v1/vidya-voice/stream"
    utts = [pcm_of(wav_dir / f"turn{i}.wav") for i in (1, 2, 3, 4)]
    run = Run()
    silence = b"\x00\x00" * CHUNK
    token = mint("e2e-local-tester")

    t_conn = time.perf_counter()
    async with websockets.connect(url, subprotocols=["vidya.v1", f"bearer.{token}"], max_size=None) as ws:
        run.log(f"socket open ({(time.perf_counter() - t_conn) * 1000:.0f} ms), subprotocol={ws.subprotocol}")
        await ws.send(json.dumps({"setup": {"grade": "Class 8", "subject": "Science", "language": "en", "screenPath": "/"}}))

        async def reader() -> None:
            async for raw in ws:
                f = json.loads(raw)
                t = run.turn
                if f.get("ready"):
                    run.ready_at = run.now()
                    run.log(f"READY engine={f.get('engine')} model={f.get('model')}")
                elif "audio" in f:
                    b = base64.b64decode(f["audio"])
                    run.audio.setdefault(t, bytearray()).extend(b)
                    run.play_end = max(run.play_end, run.now()) + len(b) / 2 / OUT_RATE
                    run.last_audio_at = run.now()
                    if t not in run.first_audio:
                        run.first_audio[t] = run.now()
                        gap = (run.first_audio[t] - run.speech_end[t]) * 1000 if t in run.speech_end else float("nan")
                        run.log(f"turn {t}: FIRST AUDIO  ({gap:.0f} ms after the utterance ended)")
                elif f.get("interrupted"):
                    run.play_end = run.now()  # the browser flushes its queue here
                    run.interrupted_at = run.now()
                    lag = (run.interrupted_at - run.barge_start) * 1000 if run.barge_start else float("nan")
                    run.log(f"turn {t}: INTERRUPTED by server VAD ({lag:.0f} ms after barge-in speech began)")
                elif f.get("turnComplete"):
                    run.turn_complete[t] = run.now()
                    secs = len(run.audio.get(t, b"")) / 2 / OUT_RATE
                    run.log(f"turn {t}: turnComplete (received {secs:.1f} s of VIDYA audio)")
                elif "toolCall" in f:
                    run.tool_calls.append(f["toolCall"])
                    run.log(f"turn {t}: TOOL CALL {f['toolCall']['name']} {f['toolCall'].get('args')}")
                elif "transcript" in f:
                    tr = f["transcript"]
                    d = run.transcripts.setdefault(t, {"user": "", "vidya": ""})
                    if tr.get("final") and tr["role"] == "user":
                        d["user"] = tr["text"]
                    elif tr["role"] == "vidya" and not tr.get("final"):
                        d["vidya"] += tr["text"]
                    elif tr["role"] == "user" and not d["user"]:
                        d["user_partial"] = d.get("user_partial", "") + tr["text"]
                elif "error" in f:
                    run.log(f"ERROR frame: {f['error']}")

        rtask = asyncio.create_task(reader())

        async def stream(pcm: bytes) -> None:
            for i in range(0, len(pcm), CHUNK * 2):
                await ws.send(json.dumps({"audio": base64.b64encode(pcm[i:i + CHUNK * 2]).decode()}))
                await asyncio.sleep(0.04)

        async def silence_until(pred, max_s: float) -> None:
            end = time.perf_counter() + max_s
            while time.perf_counter() < end and not pred():
                await ws.send(json.dumps({"audio": base64.b64encode(silence).decode()}))
                await asyncio.sleep(0.04)

        await silence_until(lambda: run.ready_at is not None, 15)

        # Turn 1 and 2: speak, then keep the "mic" open (silence) until VIDYA has finished speaking.
        for n in (1, 2):
            run.turn = n
            run.last_audio_at = 0.0
            run.log(f"turn {n}: teacher speaks ({len(utts[n-1]) / 32000:.1f} s)")
            await stream(utts[n - 1])
            run.speech_end[n] = run.now()
            if n == 1:
                await silence_until(run.vidya_done, 40)
                run.log(f"turn 1: VIDYA finished speaking (simulated playback)")
                await silence_until(lambda: False, 0.8)
            else:
                # Barge-in: wait until VIDYA has been AUDIBLY speaking ~1.5 s and still has >1.5 s left.
                await silence_until(lambda: 2 in run.first_audio, 20)
                await silence_until(lambda: run.now() - run.first_audio[2] > 1.5, 5)
        remaining = run.play_end - run.now()
        run.turn = 3
        run.last_audio_at = 0.0
        run.barge_start = run.now()
        run.log(f"turn 3: teacher INTERRUPTS while VIDYA is speaking ({remaining:.1f} s of her answer still unplayed)")
        audio_before = len(run.audio.get(2, b""))
        await stream(utts[2])
        run.speech_end[3] = run.now()
        await silence_until(run.vidya_done, 40)
        run.log("turn 3: VIDYA finished speaking (simulated playback)")
        await silence_until(lambda: False, 0.8)

        run.turn = 4
        run.last_audio_at = 0.0
        run.log("turn 4: teacher speaks")
        await stream(utts[3])
        run.speech_end[4] = run.now()
        await silence_until(run.vidya_done, 40)
        run.log("turn 4: VIDYA finished speaking (simulated playback)")

        await ws.send(json.dumps({"end": True}))
        await asyncio.sleep(0.5)
        rtask.cancel()

    print("\n==== SUMMARY ====")
    print(f"ready after {run.ready_at:.2f} s" if run.ready_at else "never READY")
    for t in (1, 2, 3, 4):
        fa = run.first_audio.get(t)
        gap = (fa - run.speech_end[t]) * 1000 if fa and t in run.speech_end else None
        secs = len(run.audio.get(t, b"")) / 2 / OUT_RATE
        tr = run.transcripts.get(t, {})
        print(f"turn {t}: first-audio gap={gap and round(gap)} ms, vidya audio={secs:.1f} s, "
              f"heard={tr.get('user') or tr.get('user_partial', '')!r}")
        print(f"         vidya said: {tr.get('vidya', '')!r}")
    print(f"interrupted frame: {'yes' if run.interrupted_at else 'NO'}"
          + (f" ({(run.interrupted_at - run.barge_start) * 1000:.0f} ms after barge-in began)" if run.interrupted_at and run.barge_start else ""))
    print(f"turn-2 audio received before interruption: {audio_before / 2 / OUT_RATE:.1f} s; unplayed at barge-in: {remaining:.1f} s")
    print(f"tool calls: {run.tool_calls}")
    out = wav_dir / "received"
    out.mkdir(exist_ok=True)
    for t, b in run.audio.items():
        with wave.open(str(out / f"vidya_turn{t}.wav"), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(OUT_RATE); w.writeframes(bytes(b))


asyncio.run(main())
