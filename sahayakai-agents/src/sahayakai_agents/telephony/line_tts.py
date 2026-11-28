"""Riya's fixed lines, rendered on the deployed bridge with Cloud Text-to-Speech.

Why this exists. Riya's flow depends on pre-rendered fixed lines (the opener, the
guardian question, the closings): the native-audio Live model does not reliably say a
line "exactly", so the bridge plays these lines itself and tells the model the opener
"has ALREADY been spoken" (RIYA_VOBIZ_QUALITY_2026-11-09, limitation 4). Every tested
call had that cache (VOBIZ_RIYA_OPENER_DIR, filled by scripts/render_riya_opener.py on
the local machine). The Cloud Run bridge never had one, so on a deployed call the model
spoke the opener itself, ran on into the event line, and the pre-verification rail
muted it (staging Plivo call, 2026-11-24 22:03 IST: first audio 3.2 s, privacy_block).

What it does. When a call's record is loaded, the bridge renders that call's fixed
lines into the same cache, under the same key the bridge already looks up
(router.riya_opener_key(text, live voice, live model)). The opener is rendered first
and awaited briefly, before the Live session is configured; the rest render in the
background. Cloud TTS is deterministic text-to-speech: the audio says exactly the text,
so a cached line can never be a hallucination. Chirp 3 HD voices share their names with
the Live voices (Aoede), so the cached lines and the model sound alike.

Off unless VOBIZ_RIYA_LINE_TTS=1 and a cache directory is set. Never raises: a line that
cannot be rendered is simply not cached, and the call behaves exactly as before.
"""

from __future__ import annotations

import asyncio
import base64
import contextlib
import io
import os
import time
import wave
from array import array
from collections.abc import Iterable
from pathlib import Path
from typing import Any

import structlog

from .audio import pcm16_to_ulaw

log = structlog.get_logger(__name__)

TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"
DEFAULT_VOICE = "en-IN-Chirp3-HD-Aoede"
#: Concurrent BACKGROUND renders per process (a call has ~15 fixed lines). Openers
#: never wait behind them: they are the one line a call is waiting for.
_MAX_PARALLEL = 3
#: After a failed render, skip TTS for this long: a broken or hanging endpoint must
#: not cost every following call its opener wait.
_COOLDOWN_S = 60.0
#: Keep the per-instance cache bounded (/tmp is memory on Cloud Run).
_MAX_FILES = 2000
#: Trim the synthesiser's own lead/tail silence down to a natural margin.
_LEAD_MS = 60
_TAIL_MS = 120
_SILENCE_RMS = 300

_inflight: dict[Path, asyncio.Future[bool]] = {}
_sem: asyncio.Semaphore | None = None
_token: tuple[str, float] = ("", 0.0)
_background: set[asyncio.Task[Any]] = set()
_down_until = 0.0
_client: Any = None
_writes = 0


def enabled(cache_dir: str) -> bool:
    return bool(cache_dir) and os.environ.get("VOBIZ_RIYA_LINE_TTS", "").strip() == "1"


def cooling_down() -> bool:
    return time.monotonic() < _down_until


def _shared_client() -> Any:
    """One HTTP client per process: no new TLS handshake inside an opener's wait."""
    global _client
    import httpx

    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=10.0)
    return _client


def voice_name() -> str:
    return os.environ.get("VOBIZ_RIYA_LINE_TTS_VOICE", "").strip() or DEFAULT_VOICE


def _language_code(voice: str) -> str:
    # "en-IN-Chirp3-HD-Aoede" -> "en-IN"
    parts = voice.split("-")
    return "-".join(parts[:2]) if len(parts) >= 2 else "en-IN"


def _semaphore() -> asyncio.Semaphore:
    global _sem
    if _sem is None:
        _sem = asyncio.Semaphore(_MAX_PARALLEL)
    return _sem


async def _access_token() -> str:
    """An OAuth token for the runtime service account, refreshed off the event loop."""
    global _token
    tok, exp = _token
    if tok and exp - time.time() > 120:
        return tok

    def fetch() -> tuple[str, float]:
        import google.auth
        from google.auth.transport.requests import Request

        creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
        creds.refresh(Request())  # type: ignore[no-untyped-call]
        expiry = getattr(creds, "expiry", None)
        return str(creds.token), expiry.timestamp() if expiry is not None else time.time() + 600

    _token = await asyncio.to_thread(fetch)
    return _token[0]


def wav_to_ulaw(wav_bytes: bytes) -> bytes:
    """16-bit mono 8 kHz WAV (Cloud TTS LINEAR16) -> trimmed mu-law 8 kHz."""
    with wave.open(io.BytesIO(wav_bytes)) as w:
        if w.getsampwidth() != 2 or w.getnchannels() != 1 or w.getframerate() != 8000:
            shape = f"{w.getnchannels()} ch, {w.getsampwidth() * 8} bit, {w.getframerate()} Hz"
            raise ValueError(f"unexpected audio: {shape}")
        pcm = array("h", w.readframes(w.getnframes()))
    return trim_silence(pcm16_to_ulaw(pcm))


def trim_silence(ulaw: bytes) -> bytes:
    """Cut leading/trailing silence to a natural margin (20 ms frames)."""
    from .audio import ulaw_to_pcm16

    frame = 160
    frames = [ulaw[i : i + frame] for i in range(0, len(ulaw), frame)]
    if not frames:
        return ulaw

    def loud(chunk: bytes) -> bool:
        samples = ulaw_to_pcm16(chunk)
        n = len(samples)
        return bool(n) and (sum(s * s for s in samples) / n) ** 0.5 > _SILENCE_RMS

    first = next((i for i, f in enumerate(frames) if loud(f)), None)
    if first is None:
        return b""
    last = next(i for i in range(len(frames) - 1, -1, -1) if loud(frames[i]))
    start = max(0, first - _LEAD_MS // 20)
    end = min(len(frames), last + 1 + _TAIL_MS // 20)
    return b"".join(frames[start:end])


async def synthesize(text: str, voice: str | None = None, *, client: Any = None) -> bytes | None:
    """`text` spoken in the call voice, as mu-law 8 kHz. None on any failure."""
    global _down_until
    voice = voice or voice_name()
    body = {
        "input": {"text": text},
        "voice": {"languageCode": _language_code(voice), "name": voice},
        "audioConfig": {"audioEncoding": "LINEAR16", "sampleRateHertz": 8000},
    }
    try:
        # No x-goog-user-project: the runtime service account bills its own project, and
        # that header would need serviceusage.services.use, which it may not hold.
        headers = {"Authorization": f"Bearer {await _access_token()}"}
        c = client if client is not None else _shared_client()
        r = await c.post(TTS_URL, json=body, headers=headers, timeout=10.0)
        r.raise_for_status()
        # Off the event loop: lines render while a call is live, and the outbound pacer
        # must not be delayed by converting and trimming seconds of audio.
        wav = base64.b64decode(r.json()["audioContent"])
        audio = await asyncio.to_thread(wav_to_ulaw, wav)
        return audio or None
    except Exception as exc:  # noqa: BLE001
        _down_until = time.monotonic() + _COOLDOWN_S
        log.warning("telephony.line_tts_failed", error=str(exc)[:200], chars=len(text))
        return None


def _write_atomic(path: Path, data: bytes) -> None:
    global _writes
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(f".{os.getpid()}.tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)
    _writes += 1
    if _writes % 100 == 0:
        _prune(path.parent)


def _prune(folder: Path) -> None:
    """Drop the oldest renders beyond _MAX_FILES (they are re-rendered on demand)."""
    try:
        files = sorted(folder.glob("*.ulaw"), key=lambda f: f.stat().st_mtime)
        for f in files[: max(0, len(files) - _MAX_FILES)]:
            f.unlink(missing_ok=True)
    except Exception as exc:  # noqa: BLE001
        log.warning("telephony.line_cache_prune_failed", error=str(exc)[:160])


async def ensure_line(
    text: str, path: Path, *, client: Any = None, priority: bool = False
) -> bool:
    """`path` holds `text` rendered. True if it does (already, or now). Never raises.

    `priority` (the opener): skips the background queue."""
    if not text:
        return False
    if path.is_file():
        return True
    if cooling_down():
        return False
    pending = _inflight.get(path)
    if pending is not None:
        return await asyncio.shield(pending)
    fut: asyncio.Future[bool] = asyncio.get_running_loop().create_future()
    _inflight[path] = fut
    ok = False
    try:
        async with contextlib.AsyncExitStack() as stack:
            if not priority:
                await stack.enter_async_context(_semaphore())
            t0 = time.monotonic()
            audio = await synthesize(text, client=client)
            if audio:
                await asyncio.to_thread(_write_atomic, path, audio)
                ok = True
                log.info(
                    "telephony.line_rendered",
                    seconds=round(len(audio) / 8000, 2),
                    render_ms=round((time.monotonic() - t0) * 1000),
                )
    except Exception as exc:  # noqa: BLE001
        log.warning("telephony.line_render_failed", error=str(exc)[:200])
    finally:
        _inflight.pop(path, None)
        if not fut.done():
            fut.set_result(ok)
    return ok


async def ensure_lines(lines: Iterable[tuple[str, Path]]) -> int:
    """Render every missing (text, path); returns how many are now cached."""
    results = await asyncio.gather(*(ensure_line(t, p) for t, p in lines), return_exceptions=True)
    return sum(1 for r in results if r is True)


def ensure_lines_later(lines: list[tuple[str, Path]]) -> None:
    """Fire-and-forget `ensure_lines` (the task is kept referenced until done)."""
    if not lines:
        return
    task = asyncio.get_running_loop().create_task(ensure_lines(lines))
    _background.add(task)
    task.add_done_callback(_background.discard)
