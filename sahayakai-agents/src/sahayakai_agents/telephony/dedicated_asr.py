"""Dedicated speech recognition for Riya on Vobiz: Google Speech-to-Text V2, `chirp_2`, en-IN.

Chosen on the 2026-11-09 benchmark of real Indian-English phone audio (riya-tests/ASR_BENCHMARK_REPORT_2026-11-09.md):
chirp_2 6.6% WER, 0 empty results; the Gemini Live input transcription it replaces as the authority 10.3% with
blank results and invented words.

One StreamingRecognize per call, fed the caller's mu-law 8 kHz frames exactly as Vobiz sends them (no
resampling). Only FINAL results are reported (partials are never used for decisions), each with its lowest
word confidence. Runs in its own thread (the gRPC client is synchronous) and hands finals to the event loop.

Off unless VOBIZ_RIYA_DEDICATED_ASR=chirp_2. Billed per audio second while the call is open
($0.016/min, V2 standard).
"""

from __future__ import annotations

import asyncio
import os
import queue
import threading
import time
from collections.abc import Callable

import structlog

log = structlog.get_logger(__name__)

#: Phrase hints (model adaptation) always on: the school calling vocabulary.
BASE_HINTS = (
    "Riya", "PTM", "parent-teacher meeting", "callback", "call back", "call me back", "out of station",
    "roll number", "wrong number", "class teacher", "guardian", "Haan", "bataiye", "Saturday morning",
)
_CHUNK_BYTES = 800  # 100 ms at 8 kHz mu-law
_FLUSH = b""  # queue sentinel: finish the current utterance now (feed() never queues empty audio)


def dedicated_asr_model() -> str | None:
    v = os.environ.get("VOBIZ_RIYA_DEDICATED_ASR", "").strip().lower()
    return v if v == "chirp_2" else None


def min_confidence() -> float:
    try:
        return float(os.environ.get("VOBIZ_ASR_MIN_CONFIDENCE", "0.4"))
    except ValueError:
        return 0.4


class ChirpStream:
    """Streams one call's caller audio to chirp_2; calls `on_final(text, confidence, at)` on the loop."""

    def __init__(
        self,
        loop: asyncio.AbstractEventLoop,
        on_final: Callable[[str, float | None, float], None],
        hints: list[str],
        *,
        project: str,
        location: str = "asia-southeast1",
        model: str = "chirp_2",
        language: str = "en-IN",
        max_seconds: float = 290.0,  # V2 streaming sessions are limited to ~5 minutes
    ) -> None:
        self._loop = loop
        self._on_final = on_final
        self._hints = [h for h in dict.fromkeys([*BASE_HINTS, *hints]) if h and len(h) <= 100][:200]
        self._project, self._location, self._model, self._language = project, location, model, language
        self._max_seconds = max_seconds
        self._q: queue.Queue[bytes | None] = queue.Queue()
        self._closed = False
        self._stream_t0 = 0.0
        self._sent_since_flush = False
        self.flushes = 0
        self._thread = threading.Thread(target=self._run, name="chirp-asr", daemon=True)
        self.audio_seconds = 0.0
        self.finals = 0
        self.errors = 0

    def start(self) -> None:
        self._thread.start()

    def feed(self, ulaw: bytes) -> None:
        if not self._closed and ulaw:
            self._q.put(ulaw)

    def flush(self) -> None:
        """The bridge heard the parent stop: end this request so chirp_2 returns the final now
        (its own endpointing waits ~1.5 s), then a new request continues with the next audio.
        Nothing is lost: audio that arrives meanwhile waits in the queue."""
        if not self._closed:
            self._q.put(_FLUSH)

    def close(self) -> None:
        if not self._closed:
            self._closed = True
            self._q.put(None)

    # ---- worker thread ---------------------------------------------------------

    def _config(self):  # noqa: ANN202 — protobuf types imported lazily
        from google.cloud.speech_v2.types import cloud_speech as cs

        cfg = cs.RecognitionConfig(
            explicit_decoding_config=cs.ExplicitDecodingConfig(
                encoding=cs.ExplicitDecodingConfig.AudioEncoding.MULAW, sample_rate_hertz=8000, audio_channel_count=1
            ),
            language_codes=[self._language],
            model=self._model,
            features=cs.RecognitionFeatures(
                enable_automatic_punctuation=True, enable_word_confidence=True, enable_word_time_offsets=True
            ),
        )
        if self._hints:
            cfg.adaptation = cs.SpeechAdaptation(phrase_sets=[cs.SpeechAdaptation.AdaptationPhraseSet(
                inline_phrase_set=cs.PhraseSet(phrases=[cs.PhraseSet.Phrase(value=h, boost=10) for h in self._hints])
            )])
        return cs.StreamingRecognizeRequest(
            recognizer=f"projects/{self._project}/locations/{self._location}/recognizers/_",
            streaming_config=cs.StreamingRecognitionConfig(
                config=cfg, streaming_features=cs.StreamingRecognitionFeatures(interim_results=False)
            ),
        )

    def _requests(self, started: float):
        from google.cloud.speech_v2.types import cloud_speech as cs

        yield self._config()
        self._stream_t0 = 0.0
        buf = b""
        while True:
            try:
                item = self._q.get(timeout=1.0)
            except queue.Empty:
                if time.monotonic() - started > self._max_seconds:
                    return
                continue
            if item is None:
                if buf:
                    yield cs.StreamingRecognizeRequest(audio=buf)
                return
            if item == _FLUSH:
                if buf or self._sent_since_flush:
                    if buf:
                        self.audio_seconds += len(buf) / 8000
                        yield cs.StreamingRecognizeRequest(audio=buf)
                    self._sent_since_flush = False
                    self.flushes += 1
                    return  # half-close: the server finalises, _run opens the next request
                continue
            if not self._stream_t0:
                # Wall time of this stream's audio offset 0 (audio arrives in real time).
                self._stream_t0 = time.monotonic() - len(buf) / 8000
            buf += item
            if len(buf) >= _CHUNK_BYTES:
                self.audio_seconds += len(buf) / 8000
                self._sent_since_flush = True
                yield cs.StreamingRecognizeRequest(audio=buf)
                buf = b""
            if time.monotonic() - started > self._max_seconds:
                return

    def _spoke_at(self, alt) -> float:  # noqa: ANN001
        """Monotonic time the parent started saying this final (word offsets), for ordering it
        against Riya's questions: a final can arrive seconds after the words were said."""
        try:
            first = alt.words[0].start_offset
            return self._stream_t0 + first.total_seconds() if self._stream_t0 else time.monotonic()
        except (IndexError, AttributeError):
            return time.monotonic()

    def _run(self) -> None:
        from google.api_core.client_options import ClientOptions
        from google.cloud.speech_v2 import SpeechClient

        endpoint = "speech.googleapis.com" if self._location == "global" else f"{self._location}-speech.googleapis.com"
        client = SpeechClient(client_options=ClientOptions(api_endpoint=endpoint))
        while not self._closed:
            started = time.monotonic()
            try:
                for resp in client.streaming_recognize(requests=self._requests(started)):
                    for r in resp.results:
                        if not r.is_final or not r.alternatives:
                            continue
                        alt = r.alternatives[0]
                        text = (alt.transcript or "").strip()
                        if not text:
                            continue
                        confs = [w.confidence for w in alt.words if w.confidence]
                        conf = min(confs) if confs else (alt.confidence or None)
                        self.finals += 1
                        self._loop.call_soon_threadsafe(self._on_final, text, conf, self._spoke_at(alt))
            except Exception as exc:  # noqa: BLE001 — never take the call down; Live keeps transcribing
                self.errors += 1
                log.warning("telephony.asr_stream_error", error=type(exc).__name__, detail=str(exc)[:160])
                if self.errors >= 3:
                    return
                time.sleep(0.2)
            # A stream that reached its time limit is reopened while the call lasts.
