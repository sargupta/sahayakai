"""
Sarvam STT Provider for Pipecat.

Wraps Sarvam Saaras v3 API as a Pipecat-compatible STT service.

IMPORTANT: Sarvam is a batch STT API — it needs a complete utterance, not
streaming audio chunks. Pipecat's STTService calls run_stt() for every 20ms
audio frame, so we override the flow:

  1. run_stt() just buffers incoming audio (no API call)
  2. On VADUserStoppedSpeakingFrame, we send the full buffer to Sarvam
  3. The transcription result is pushed downstream as TranscriptionFrame
"""

import io
import wave
from typing import AsyncGenerator

import httpx
from loguru import logger
from pipecat.frames.frames import (
    Frame,
    TranscriptionFrame,
    ErrorFrame,
    VADUserStartedSpeakingFrame,
    VADUserStoppedSpeakingFrame,
)
from pipecat.services.stt_service import STTService

# Minimum audio duration (seconds) worth transcribing — skip noise bursts
MIN_AUDIO_DURATION_S = 0.4
MIN_AUDIO_BYTES = int(MIN_AUDIO_DURATION_S * 16000 * 2)  # 16kHz 16-bit mono


class SarvamSTTService(STTService):
    """Sarvam Saaras v3 STT — batch API, buffers audio between VAD events."""

    def __init__(self, *, api_key: str, language: str = "hi-IN", **kwargs):
        super().__init__(**kwargs)
        self._api_key = api_key
        self._language = language
        self._base_url = "https://api.sarvam.ai"
        self._http_client: httpx.AsyncClient | None = None
        self._audio_buffer = bytearray()
        self._is_speaking = False

    async def _get_client(self) -> httpx.AsyncClient:
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=15.0)
        return self._http_client

    async def cleanup(self):
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
        await super().cleanup()

    @property
    def language(self) -> str:
        return self._language

    @language.setter
    def language(self, value: str):
        self._language = value

    async def run_stt(self, audio: bytes) -> AsyncGenerator[Frame, None]:
        """Buffer audio — actual transcription happens on VAD stop.

        Pipecat calls this for every ~20ms audio frame. We just accumulate.
        """
        if audio:
            self._audio_buffer.extend(audio)
        # Yield nothing — transcription fires in _handle_vad_user_stopped_speaking
        return
        yield  # Make it a generator

    async def _handle_vad_user_started_speaking(self, frame: VADUserStartedSpeakingFrame):
        """VAD detected speech start — clear buffer for new utterance."""
        await super()._handle_vad_user_started_speaking(frame)
        self._audio_buffer.clear()
        self._is_speaking = True
        logger.debug("VAD: speech started — buffer cleared")

    async def _handle_vad_user_stopped_speaking(self, frame: VADUserStoppedSpeakingFrame):
        """VAD detected speech end — send accumulated audio to Sarvam."""
        await super()._handle_vad_user_stopped_speaking(frame)
        self._is_speaking = False

        audio = bytes(self._audio_buffer)
        self._audio_buffer.clear()

        if len(audio) < MIN_AUDIO_BYTES:
            duration_ms = len(audio) / (16000 * 2) * 1000
            logger.debug(f"VAD: speech too short ({duration_ms:.0f}ms) — skipping STT")
            return

        duration_s = len(audio) / (16000 * 2)
        logger.info(f"VAD: speech ended — {duration_s:.1f}s audio, sending to Sarvam STT")

        async for out_frame in self._transcribe(audio):
            await self.push_frame(out_frame)

    async def _transcribe(self, audio: bytes) -> AsyncGenerator[Frame, None]:
        """Send complete utterance to Sarvam Saaras v3 API."""
        try:
            # Wrap raw PCM in WAV container
            wav_buffer = io.BytesIO()
            with wave.open(wav_buffer, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)  # 16-bit signed PCM
                wf.setframerate(16000)
                wf.writeframes(audio)
            wav_buffer.seek(0)

            client = await self._get_client()
            files = {"file": ("audio.wav", wav_buffer, "audio/wav")}
            data = {
                "model": "saaras:v3",
                "mode": "transcribe",
                "language_code": self._language,
            }
            resp = await client.post(
                f"{self._base_url}/speech-to-text",
                files=files,
                data=data,
                headers={"api-subscription-key": self._api_key},
            )

            if resp.status_code != 200:
                logger.error(f"Sarvam STT error {resp.status_code}: {resp.text[:200]}")
                yield ErrorFrame(f"STT error: {resp.status_code}")
                return

            result = resp.json()
            text = result.get("transcript", "").strip()

            if text:
                logger.info(f"STT [{self._language}]: {text}")
                yield TranscriptionFrame(text=text, user_id="parent", timestamp="")
            else:
                logger.debug("STT: empty transcript (silence/noise)")

        except httpx.TimeoutException:
            logger.error("Sarvam STT timeout")
            yield ErrorFrame("STT timeout")
        except Exception as e:
            logger.error(f"Sarvam STT error: {e}")
            yield ErrorFrame(f"STT error: {e}")
