"""
Sarvam TTS Provider for Pipecat.

Wraps Sarvam Bulbul v3 API as a Pipecat-compatible TTS service.
Receives text frames, synthesizes speech audio, and outputs audio frames.
"""

import base64
import io
import wave
from typing import AsyncGenerator

import httpx
from loguru import logger
from pipecat.frames.frames import (
    Frame,
    TTSAudioRawFrame,
    ErrorFrame,
)
from pipecat.services.tts_service import TTSService

# Sarvam BCP-47 codes for supported languages
SARVAM_TTS_LANGUAGES = {
    "bn-IN", "en-IN", "gu-IN", "hi-IN", "kn-IN",
    "ml-IN", "mr-IN", "od-IN", "pa-IN", "ta-IN", "te-IN",
}

# Max chars per Sarvam TTS request
MAX_CHARS = 2500


class SarvamTTSService(TTSService):
    """Sarvam Bulbul v3 TTS — API-based, no GPU needed."""

    def __init__(
        self,
        *,
        api_key: str,
        language: str = "hi-IN",
        speaker: str = "priya",
        sample_rate: int = 16000,
        **kwargs,
    ):
        super().__init__(sample_rate=sample_rate, **kwargs)
        self._api_key = api_key
        self._language = language
        self._speaker = speaker
        self._output_sample_rate = sample_rate
        self._base_url = "https://api.sarvam.ai"
        self._http_client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=10.0)
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

    async def run_tts(self, text: str, context_id: str = "") -> AsyncGenerator[Frame, None]:
        """Synthesize speech from text via Sarvam API.

        Requests WAV format and extracts raw PCM for TTSAudioRawFrame.
        """
        if not text or not text.strip():
            return

        lang = self._language
        if lang not in SARVAM_TTS_LANGUAGES:
            if lang == "or-IN":
                lang = "od-IN"
            else:
                lang = "en-IN"  # fallback

        # Create audio context for pipecat's TTS pipeline tracking
        await self.create_audio_context(context_id)

        chunks = _chunk_text(text, MAX_CHARS)

        for chunk in chunks:
            try:
                client = await self._get_client()
                resp = await client.post(
                    f"{self._base_url}/text-to-speech",
                    headers={
                        "api-subscription-key": self._api_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "text": chunk,
                        "target_language_code": lang,
                        "model": "bulbul:v3",
                        "speaker": self._speaker,
                        "pace": 0.92,
                        "output_audio_codec": "wav",
                        "speech_sample_rate": str(self._output_sample_rate),
                    },
                )

                if resp.status_code != 200:
                    logger.error(f"Sarvam TTS error {resp.status_code}: {resp.text[:200]}")
                    yield ErrorFrame(f"TTS error: {resp.status_code}")
                    return

                data = resp.json()
                audio_b64 = data.get("audios", [None])[0]
                if not audio_b64:
                    logger.error("Sarvam TTS returned empty audio")
                    yield ErrorFrame("TTS: empty audio")
                    return

                # Decode WAV and extract raw PCM
                wav_bytes = base64.b64decode(audio_b64)
                pcm_data, actual_rate = _extract_pcm_from_wav(wav_bytes)

                if actual_rate != self._output_sample_rate:
                    logger.warning(
                        f"TTS sample rate mismatch: requested {self._output_sample_rate}, "
                        f"got {actual_rate}"
                    )

                logger.debug(f"TTS [{lang}]: {len(pcm_data)} bytes PCM for {len(chunk)} chars")

                yield TTSAudioRawFrame(
                    audio=pcm_data,
                    sample_rate=actual_rate,
                    num_channels=1,
                    context_id=context_id,
                )

            except httpx.TimeoutException:
                logger.error("Sarvam TTS timeout")
                yield ErrorFrame("TTS timeout")
            except Exception as e:
                logger.error(f"Sarvam TTS error: {e}")
                yield ErrorFrame(f"TTS error: {e}")


def _extract_pcm_from_wav(wav_bytes: bytes) -> tuple[bytes, int]:
    """Extract raw PCM data and sample rate from a WAV file."""
    buf = io.BytesIO(wav_bytes)
    with wave.open(buf, "rb") as wf:
        sample_rate = wf.getframerate()
        pcm_data = wf.readframes(wf.getnframes())
    return pcm_data, sample_rate


def _chunk_text(text: str, max_len: int) -> list[str]:
    """Split text into chunks on sentence boundaries."""
    if len(text) <= max_len:
        return [text]

    chunks = []
    remaining = text

    while remaining:
        if len(remaining) <= max_len:
            chunks.append(remaining)
            break

        # Find last sentence boundary within limit
        slice_ = remaining[:max_len]
        split_idx = -1
        for i in range(len(slice_) - 1, len(slice_) // 2, -1):
            if slice_[i] in ".?!।|":
                split_idx = i + 1
                break

        if split_idx == -1:
            split_idx = slice_.rfind(" ")
            if split_idx == -1:
                split_idx = max_len

        chunks.append(remaining[:split_idx].strip())
        remaining = remaining[split_idx:].strip()

    return [c for c in chunks if c]
