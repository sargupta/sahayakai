"""
Pipecat Bot Pipeline for Parent Call.

Orchestrates: Twilio audio → Sarvam STT → Gemini LLM → Sarvam TTS → Twilio audio
Handles conversation flow, turn management, and transcript persistence.
"""

import asyncio

from loguru import logger
from pipecat.frames.frames import TextFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.task import PipelineTask, PipelineParams
from pipecat.transports.websocket.fastapi import (
    FastAPIWebsocketTransport,
    FastAPIWebsocketParams,
)
from pipecat.serializers.twilio import TwilioFrameSerializer
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams

from src.config import Config
from src.providers.stt_sarvam import SarvamSTTService
from src.providers.llm_gemini import GeminiLLMService
from src.providers.tts_sarvam import SarvamTTSService
from src.prompts.agent_reply import get_greetings
from src.persistence import sync_transcript

# Twilio Media Streams language code mapping
TWILIO_LANG_MAP = {
    "English": "en-IN",
    "Hindi": "hi-IN",
    "Kannada": "kn-IN",
    "Tamil": "ta-IN",
    "Telugu": "te-IN",
    "Malayalam": "ml-IN",
    "Bengali": "bn-IN",
    "Marathi": "mr-IN",
    "Gujarati": "gu-IN",
    "Punjabi": "pa-IN",
    "Odia": "en-IN",  # Odia TTS not available, fallback
}


async def create_bot(
    config: Config,
    call_context: dict,
    websocket,
    stream_sid: str,
) -> PipelineTask:
    """Create and configure the Pipecat pipeline for a parent call.

    Args:
        config: Server configuration
        call_context: Outreach record from Firestore (student, language, message, etc.)
        websocket: WebSocket connection from Twilio Media Streams (already accepted)
        stream_sid: Twilio Media Stream SID (extracted from Twilio's 'start' event
            before the transport starts — the serializer only handles 'media' and
            'dtmf' events, so consuming 'connected'/'start' is safe)
    """
    parent_language = call_context.get("parentLanguage", "Hindi")
    lang_code = TWILIO_LANG_MAP.get(parent_language, "en-IN")
    outreach_id = call_context.get("id", "")

    logger.info(f"Creating bot for outreach {outreach_id}, language: {parent_language} ({lang_code})")

    # ── Serializer: Twilio mu-law codec ──
    serializer = TwilioFrameSerializer(
        stream_sid=stream_sid,
        params=TwilioFrameSerializer.InputParams(
            twilio_sample_rate=8000,
            sample_rate=16000,  # Pipeline internal rate for STT
            auto_hang_up=False,
        ),
    )

    # ── Transport: Twilio Media Streams via WebSocket ──
    transport = FastAPIWebsocketTransport(
        websocket=websocket,
        params=FastAPIWebsocketParams(
            serializer=serializer,
            audio_in_enabled=True,
            audio_in_sample_rate=16000,
            audio_out_enabled=True,
            audio_out_sample_rate=16000,
            vad_analyzer=SileroVADAnalyzer(
                params=VADParams(
                    min_volume=0.3,
                    start_secs=0.2,
                    stop_secs=1.2,  # Tuned for phone: shorter to reduce latency
                ),
            ),
        ),
    )

    # ── STT: Sarvam Saaras v3 ──
    stt = SarvamSTTService(
        api_key=config.sarvam_api_key,
        language=lang_code,
    )

    # ── Mid-call transcript sync callback (non-blocking) ──
    async def _sync_turn(transcript: list[dict], turn_number: int):
        """Persist transcript after each LLM turn — fire-and-forget."""
        asyncio.ensure_future(sync_transcript(
            api_url=config.sahayakai_api_url,
            internal_key=config.sahayakai_internal_key,
            outreach_id=outreach_id,
            transcript=transcript,
            turn_count=turn_number,
        ))

    # ── LLM: Gemini 2.0 Flash ──
    llm = GeminiLLMService(
        api_key=config.google_api_key,
        call_context=call_context,
        on_turn_complete=_sync_turn,
    )

    # ── TTS: Sarvam Bulbul v3 ──
    tts = SarvamTTSService(
        api_key=config.sarvam_api_key,
        language=lang_code,
        sample_rate=16000,  # Pipeline rate; serializer handles downsample to 8kHz
    )

    # ── Pipeline ──
    pipeline = Pipeline([
        transport.input(),
        stt,
        llm,
        tts,
        transport.output(),
    ])

    params = PipelineParams(
        allow_interruptions=True,
        audio_in_sample_rate=16000,   # Twilio mu-law resampled to 16kHz by serializer
        audio_out_sample_rate=16000,  # TTS produces 16kHz; serializer downsamples to 8kHz mu-law
    )
    task = PipelineTask(pipeline, params=params)

    # ── Event handlers ──

    @transport.event_handler("on_client_connected")
    async def on_connected(transport_instance, websocket):
        """Play greeting when call connects."""
        greetings = get_greetings(lang_code)
        teacher_message = call_context.get("generatedMessage", "")
        greeting_text = f"{greetings['greeting']} {teacher_message} {greetings['invite']}"

        llm.add_transcript_turn("agent", greeting_text)

        # Push greeting through pipeline — TextFrame goes through
        # LLM (passes through as non-TranscriptionFrame) → TTS → transport output
        logger.info(f"Playing greeting ({len(greeting_text)} chars)")
        await task.queue_frames([TextFrame(text=greeting_text)])

    @transport.event_handler("on_client_disconnected")
    async def on_disconnected(transport_instance, websocket):
        """Persist final transcript when call ends."""
        logger.info(f"Call ended. Turns: {llm.turn_number}, Transcript: {len(llm.transcript)} entries")
        await sync_transcript(
            api_url=config.sahayakai_api_url,
            internal_key=config.sahayakai_internal_key,
            outreach_id=outreach_id,
            transcript=llm.transcript,
            turn_count=llm.turn_number,
            call_status="completed",
        )

    return task
