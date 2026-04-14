"""
Gemini LLM Provider for Pipecat.

Custom FrameProcessor that receives TranscriptionFrame from STT,
calls Gemini 2.0 Flash for agent reasoning, and emits TextFrame for TTS.

Handles transcript tracking, turn management, and call-specific context.
"""

import json
from typing import AsyncGenerator, Callable, Awaitable

import httpx
from loguru import logger
from pipecat.frames.frames import (
    Frame,
    TextFrame,
    ErrorFrame,
    EndFrame,
    TranscriptionFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

from src.prompts.agent_reply import AGENT_REPLY_SYSTEM_PROMPT, build_agent_context


class GeminiLLMService(FrameProcessor):
    """Google Gemini 2.0 Flash — API-based, used for parent call agent reasoning.

    Receives TranscriptionFrame (from STT) and pushes TextFrame (to TTS).
    """

    # Callback fired after each turn — (transcript, turn_number) → None
    OnTurnComplete = Callable[[list[dict], int], Awaitable[None]]

    def __init__(
        self,
        *,
        api_key: str,
        call_context: dict,
        model: str = "gemini-2.0-flash",
        on_turn_complete: "GeminiLLMService.OnTurnComplete | None" = None,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self._api_key = api_key
        self._model = model
        self._call_context = call_context
        self._transcript: list[dict] = []
        self._turn_number = 1
        self._http_client: httpx.AsyncClient | None = None
        self._on_turn_complete = on_turn_complete

    async def _get_client(self) -> httpx.AsyncClient:
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=15.0)
        return self._http_client

    async def cleanup(self):
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
        await super().cleanup()

    def add_transcript_turn(self, role: str, text: str):
        self._transcript.append({"role": role, "text": text})

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        """Process incoming frames — handle TranscriptionFrame, pass others through."""
        await super().process_frame(frame, direction)

        if isinstance(frame, TranscriptionFrame):
            text = frame.text.strip()
            if text:
                async for out_frame in self._generate_reply(text):
                    await self.push_frame(out_frame)
        else:
            await self.push_frame(frame, direction)

    async def _generate_reply(self, text: str) -> AsyncGenerator[Frame, None]:
        """Generate agent reply given parent's speech text."""
        context_msg = build_agent_context(
            student_name=self._call_context.get("studentName", ""),
            class_name=self._call_context.get("className", ""),
            subject=self._call_context.get("subject", ""),
            reason=self._call_context.get("reason", ""),
            teacher_message=self._call_context.get("generatedMessage", ""),
            parent_language=self._call_context.get("parentLanguage", "Hindi"),
            transcript=self._transcript,
            parent_speech=text,
            turn_number=self._turn_number,
            teacher_name=self._call_context.get("teacherName", ""),
            school_name=self._call_context.get("schoolName", ""),
        )

        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self._model}:generateContent"

            payload = {
                "contents": [
                    {"role": "user", "parts": [{"text": context_msg}]},
                ],
                "systemInstruction": {
                    "parts": [{"text": AGENT_REPLY_SYSTEM_PROMPT}],
                },
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 300,
                    "responseMimeType": "application/json",
                },
            }

            client = await self._get_client()
            resp = await client.post(
                url,
                params={"key": self._api_key},
                json=payload,
            )

            if resp.status_code != 200:
                logger.error(f"Gemini error {resp.status_code}: {resp.text[:300]}")
                yield ErrorFrame(error=f"LLM error: {resp.status_code}")
                return

            data = resp.json()
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]

            # Parse JSON response
            try:
                parsed = json.loads(raw_text)
                reply = parsed.get("reply", raw_text)
                follow_up = parsed.get("follow_up_question", "")
                should_end = parsed.get("should_end_call", False)
            except json.JSONDecodeError:
                reply = raw_text
                follow_up = ""
                should_end = False

            full_reply = reply
            if follow_up and not should_end:
                full_reply = f"{reply} {follow_up}"

            # Track transcript
            self.add_transcript_turn("parent", text)
            self.add_transcript_turn("agent", full_reply)
            self._turn_number += 1

            logger.info(f"LLM reply (turn {self._turn_number - 1}): {full_reply[:80]}...")
            yield TextFrame(text=full_reply)

            # Fire mid-call transcript sync (non-blocking)
            if self._on_turn_complete:
                try:
                    await self._on_turn_complete(self._transcript, self._turn_number)
                except Exception as e:
                    logger.warning(f"Turn sync callback failed: {e}")

            # End pipeline after final reply so Twilio hangs up cleanly
            if should_end or self._turn_number > 6:
                logger.info("Call ending — emitting EndFrame")
                yield EndFrame()

        except httpx.TimeoutException:
            logger.error("Gemini timeout")
            yield TextFrame(text=self._error_fallback_text())
        except Exception as e:
            logger.error(f"Gemini error: {e}")
            yield TextFrame(text=self._error_fallback_text())

    def _error_fallback_text(self) -> str:
        """Spoken fallback when LLM fails — in parent's language if possible."""
        lang = self._call_context.get("parentLanguage", "Hindi")
        fallbacks = {
            "Hindi": "क्षमा करें, तकनीकी समस्या हो रही है। शिक्षक का संदेश दिया जा चुका है। धन्यवाद।",
            "Kannada": "ಕ್ಷಮಿಸಿ, ತಾಂತ್ರಿಕ ಸಮಸ್ಯೆ ಉಂಟಾಗಿದೆ. ಶಿಕ್ಷಕರ ಸಂದೇಶವನ್ನು ತಲುಪಿಸಲಾಗಿದೆ. ಧನ್ಯವಾದ.",
            "Tamil": "மன்னிக்கவும், தொழில்நுட்ப சிக்கல் ஏற்பட்டுள்ளது. ஆசிரியரின் செய்தி அனுப்பப்பட்டது. நன்றி.",
            "Telugu": "క్షమించండి, సాంకేతిక సమస్య వచ్చింది. ఉపాధ్యాయుని సందేశం అందించబడింది. ధన్యవాదాలు.",
        }
        return fallbacks.get(lang, "We apologize for the technical issue. The teacher's message has been delivered. Thank you.")

    @property
    def transcript(self) -> list[dict]:
        return self._transcript

    @property
    def turn_number(self) -> int:
        return self._turn_number
