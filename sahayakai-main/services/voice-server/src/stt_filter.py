"""
STT quality filter for noisy Indian phone environments.

Real-world audio challenges this handles:
  - Family gatherings: multiple people talking, STT picks up wrong person
  - Street/market: continuous background chatter, honking
  - Vehicle: engine noise + wind
  - TV/radio: clear speech from non-parent source
  - Echo: phone speaker output fed back into mic

Strategy: multi-layer filtering + noise environment detection.
If too many transcriptions get filtered in a row, inject a
"please repeat" prompt instead of silence.

Sits between STT and user aggregator:
  stt → STTConfidenceFilter → context_aggregator.user()
"""

import re
import time

from loguru import logger
from pipecat.frames.frames import Frame, TranscriptionFrame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

# ── Filter thresholds and noise rules: src/stt_noise.py (pure, shared with
# the stop listener, which must not let a hum cancel a held "don't call me") ──
from src.stt_noise import GIBBERISH_RE as _GIBBERISH_RE  # noqa: E402,F401
from src.stt_noise import MAX_REPEAT_RATIO, MIN_CHARS, drop_reason  # noqa: E402,F401
from src.stt_noise import NOISE_ARTIFACTS as _NOISE_ARTIFACTS  # noqa: E402,F401

# Rapid-fire threshold: if N transcriptions arrive within T seconds,
# likely picking up background conversation (not parent)
RAPID_FIRE_WINDOW = 3.0     # seconds
RAPID_FIRE_COUNT = 4         # transcriptions in window = noisy

# After this many consecutive filtered transcriptions, tell parent to repeat
CONSECUTIVE_FILTER_THRESHOLD = 3

# Cooldown after "please repeat" — don't spam it
REPEAT_PROMPT_COOLDOWN = 8.0  # seconds


class STTConfidenceFilter(FrameProcessor):
    """Filters low-quality STT transcriptions from noisy environments.

    Pipeline position: stt → STTConfidenceFilter → context_aggregator.user()

    Multi-layer filtering:
    1. Length check: < MIN_CHARS → drop
    2. Gibberish regex: only punctuation/numbers/repeated chars → drop
    3. Known noise artifacts: common STT noise words → drop
    4. Rapid-fire detection: too many transcriptions too fast → noisy environment
    5. Consecutive filter tracking: if too many dropped, inject "repeat" prompt

    All non-TranscriptionFrame frames pass through untouched.
    """

    def __init__(
        self,
        *,
        min_chars: int = MIN_CHARS,
        repeat_prompt: str = "ज़रा दोबारा बोलिए, आवाज़ ठीक से नहीं आ रही।",
        **kwargs,
    ):
        super().__init__(**kwargs)
        self._min_chars = min_chars
        self._repeat_prompt = repeat_prompt

        # Tracking state
        self._filtered_count = 0           # total filtered
        self._consecutive_filtered = 0     # in a row
        self._recent_timestamps: list[float] = []  # for rapid-fire detection
        self._last_repeat_prompt_time = 0.0
        self._noisy_environment = False    # True if rapid-fire detected

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if not isinstance(frame, TranscriptionFrame):
            await self.push_frame(frame, direction)
            return

        text = frame.text.strip() if frame.text else ""
        now = time.monotonic()

        # Track timing for rapid-fire detection
        self._recent_timestamps.append(now)
        # Keep only timestamps within the window
        self._recent_timestamps = [
            t for t in self._recent_timestamps
            if now - t < RAPID_FIRE_WINDOW
        ]

        # Detect noisy environment: too many transcriptions too fast
        if len(self._recent_timestamps) >= RAPID_FIRE_COUNT:
            if not self._noisy_environment:
                self._noisy_environment = True
                logger.warning(
                    f"Noisy environment detected: {len(self._recent_timestamps)} "
                    f"transcriptions in {RAPID_FIRE_WINDOW}s"
                )

        # ── Layers 1-4: length, gibberish, known noise artifacts, repeat ratio ──
        reason = drop_reason(text, self._min_chars)
        if reason is not None:
            self._on_filtered(text, reason)
            return

        # ── Passed all filters ──
        self._consecutive_filtered = 0
        self._noisy_environment = False  # Reset — got a good transcription
        logger.debug(f"STT accepted: {text!r}")
        await self.push_frame(frame, direction)

    def _on_filtered(self, text: str, reason: str):
        """Handle a filtered transcription."""
        self._filtered_count += 1
        self._consecutive_filtered += 1
        logger.debug(
            f"STT filtered ({reason}): {text!r} "
            f"[consecutive={self._consecutive_filtered}, total={self._filtered_count}]"
        )

        # If too many consecutive filtered, we should prompt parent to repeat.
        # But we don't inject frames from here — CallManager or the prompt handles it.
        # We just log the situation for now; the "unclear speech" rule in the
        # system prompt ("ज़रा दोबारा बोलिए") handles the LLM side.
        if self._consecutive_filtered >= CONSECUTIVE_FILTER_THRESHOLD:
            now = time.monotonic()
            if now - self._last_repeat_prompt_time > REPEAT_PROMPT_COOLDOWN:
                self._last_repeat_prompt_time = now
                logger.warning(
                    f"STT: {self._consecutive_filtered} consecutive filtered — "
                    f"parent may be in noisy environment"
                )
