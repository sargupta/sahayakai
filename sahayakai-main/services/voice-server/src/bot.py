"""
Pipecat Bot Pipeline for Parent Call — V2 Streaming.

Full streaming pipeline with native Pipecat services:
  Twilio audio → RNNoise → Sarvam STT (WebSocket streaming)
               → Gemini LLM (streaming tokens)
               → Sarvam TTS (WebSocket streaming)
               → Twilio audio

Key features:
  - RNNoise audio filter: removes phone echo/background noise
  - allow_interruptions=True: bot stops when parent speaks
  - First-sentence truncation: CallManager caps LLM output to 1 sentence
  - VAD tuned for phone: min_volume=0.6, start_secs=0.3 (filters echo)
"""

import asyncio

from loguru import logger
from pipecat.frames.frames import TTSSpeakFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.task import PipelineTask, PipelineParams
from pipecat.transports.websocket.fastapi import (
    FastAPIWebsocketTransport,
    FastAPIWebsocketParams,
)
from pipecat.serializers.twilio import TwilioFrameSerializer
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.audio.filters.rnnoise_filter import RNNoiseFilter

# Universal LLM context (replaces deprecated GoogleLLMContext)
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.turns.user_turn_strategies import UserTurnStrategies
from pipecat.turns.user_start import MinWordsUserTurnStartStrategy

# Native Pipecat services — streaming WebSocket/API
from pipecat.services.sarvam.stt import SarvamSTTService
from pipecat.services.sarvam.tts import SarvamTTSService
from pipecat.services.google.llm import GoogleLLMService


from src.config import Config
from src.call_manager import CallManager
from src.conversation_state import PhaseInstructor
from src.stt_filter import STTConfidenceFilter
from src.prompts.agent_reply import build_system_instruction, get_greetings
from src.persistence import sync_transcript
from src.call_store import CallStore
from src.call_analyzer import analyze_call

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

# Sarvam TTS voice mapping — male and female options
# See: https://docs.sarvam.ai/api-reference-docs/text-to-speech
SARVAM_VOICE_FEMALE = "priya"   # Female voice — for female teacher names
SARVAM_VOICE_MALE = "rahul"     # Male voice — for male teacher names
                                # bulbul:v3 male voices (verified 2026-04):
                                # aditya, ashutosh, rahul, rohan, amit, dev, ratan, varun,
                                # manan, sumit, kabir, aayan, shubh, advait, anand, tarun,
                                # sunny, mani, gokul, vijay, mohit
                                # (arvind, abhilash NOT supported in bulbul:v3)

# Female name indicators (Indian names) — used to pick voice gender
_FEMALE_INDICATORS = {
    "ms.", "mrs.", "miss", "ma'am", "madam", "maam",
    "devi", "kumari", "bai", "ben", "amma",
    # Common female name endings
}


def _pick_voice(teacher_name: str) -> str:
    """Pick male or female TTS voice based on teacher name."""
    name_lower = teacher_name.lower().strip()

    # Check explicit female indicators
    for indicator in _FEMALE_INDICATORS:
        if indicator in name_lower:
            return SARVAM_VOICE_FEMALE

    # Default to male (majority of teacher names in test scenarios)
    # In production, this would come from teacher profile data
    return SARVAM_VOICE_MALE


async def create_bot(
    config: Config,
    call_context: dict,
    websocket,
    stream_sid: str,
    call_sid: str = "",
    call_store: CallStore | None = None,
) -> PipelineTask:
    """Create the streaming Pipecat pipeline for a parent call.

    Architecture:
      transport.input()
        → stt (Sarvam WebSocket streaming)
        → context_aggregator.user() (manages LLM conversation context)
        → llm (Gemini streaming tokens)
        → call_manager (transcript tracking, turn management, call ending)
        → tts (Sarvam WebSocket streaming, sentence-level aggregation)
        → transport.output()
        → context_aggregator.assistant() (captures agent responses)
    """
    parent_language = call_context.get("parentLanguage", "Hindi")
    lang_code = TWILIO_LANG_MAP.get(parent_language, "en-IN")
    outreach_id = call_context.get("id", "")

    logger.info(
        f"Creating streaming bot for outreach {outreach_id}, "
        f"language: {parent_language} ({lang_code})"
    )

    # ── Build greeting text ──
    # The generatedMessage IS the greeting — teacher intro + student mention.
    # No generic "important message from school" prefix (sounds like robocall).
    # Fallback to language-specific generic greeting only if no message provided.
    teacher_message = call_context.get("generatedMessage", "")
    if teacher_message:
        greeting_text = teacher_message
    else:
        greetings = get_greetings(lang_code)
        greeting_text = greetings["greeting"]

    # ── Serializer: Twilio mu-law codec ──
    # auto_hang_up=True requires call_sid + Twilio creds so the serializer can
    # POST to the Twilio REST API to end the call when EndFrame fires.
    serializer = TwilioFrameSerializer(
        stream_sid=stream_sid,
        call_sid=call_sid,
        account_sid=config.twilio_account_sid,
        auth_token=config.twilio_auth_token,
        params=TwilioFrameSerializer.InputParams(
            twilio_sample_rate=8000,
            sample_rate=16000,  # Pipeline internal rate
            auto_hang_up=bool(call_sid and config.twilio_account_sid and config.twilio_auth_token),
        ),
    )

    # ── Transport: Twilio Media Streams via WebSocket ──
    # SmartTurn REMOVED — adds 1-3s of deliberation after silence.
    # VAD alone with stop_secs=0.6 is fast enough for phone calls.
    # (0.6s silence = user paused → send to LLM immediately)
    transport = FastAPIWebsocketTransport(
        websocket=websocket,
        params=FastAPIWebsocketParams(
            serializer=serializer,
            audio_in_enabled=True,
            audio_in_sample_rate=16000,
            audio_in_filter=RNNoiseFilter(),  # Denoise phone audio — reduces echo/background noise
            audio_out_enabled=True,
            audio_out_sample_rate=16000,
            vad_analyzer=SileroVADAnalyzer(
                params=VADParams(
                    min_volume=0.6,  # Filter phone echo (echo is lower amplitude)
                    start_secs=0.3,  # 300ms sustained speech to trigger (filters echo bursts)
                    stop_secs=0.5,  # 0.5s silence → end of turn
                ),
            ),
        ),
    )

    # ── STT: Sarvam Saaras v3 (WebSocket streaming) ──
    stt = SarvamSTTService(
        api_key=config.sarvam_api_key,
        settings=SarvamSTTService.Settings(
            model="saaras:v3",
            language=lang_code,
        ),
    )

    # ── Save call to local store ──
    if call_store:
        call_store.create_call(outreach_id, call_context)

    # ── Build system instruction with parent history ──
    parent_history = None
    if call_store:
        parent_phone = call_context.get("parentPhone", "")
        parent_history = call_store.build_parent_context(parent_phone)
        if parent_history:
            logger.info(f"Parent history injected for {parent_phone}")

    system_instruction = build_system_instruction(
        call_context, greeting_text, parent_history=parent_history,
    )

    llm = GoogleLLMService(
        api_key=config.google_api_key,
        settings=GoogleLLMService.Settings(
            model="gemini-2.0-flash",
            temperature=0.2,  # Very low = focused, deterministic, stays in character
            max_tokens=40,  # CallManager truncates to 1st sentence anyway
            system_instruction=system_instruction,
        ),
    )

    # ── LLM Context + Universal Aggregator ──
    # Universal LLMContext uses OpenAI-style dicts — GeminiLLMAdapter
    # converts to Google Content objects at inference time.
    context = LLMContext()
    # Seed greeting into context so LLM knows what was said to the parent
    context.add_message({"role": "assistant", "content": greeting_text})

    # MinWordsUserTurnStartStrategy: require 3+ words to interrupt bot.
    # Filters backchannel ("haan", "ji") from triggering interruption.
    # When bot is NOT speaking, any 1 word triggers (normal turn-taking).
    user_params = LLMUserAggregatorParams(
        user_turn_strategies=UserTurnStrategies(
            start=[MinWordsUserTurnStartStrategy(min_words=3)],
        ),
    )
    context_aggregator = LLMContextAggregatorPair(
        context, user_params=user_params,
    )

    # ── Transcript sync callback (non-blocking) ──
    async def _sync_turn(transcript: list[dict], turn_number: int):
        # Save to local store (always works)
        if call_store:
            call_store.update_transcript(outreach_id, transcript, turn_number)
        # Also try backend sync (may fail if backend is down)
        await sync_transcript(
            api_url=config.sahayakai_api_url,
            internal_key=config.sahayakai_internal_key,
            outreach_id=outreach_id,
            transcript=transcript,
            turn_count=turn_number,
        )

    # ── Phase Instructor: injects turn-specific instructions before LLM ──
    phase_instructor = PhaseInstructor(call_context=call_context)

    # ── Call Manager: turn counting, transcript, call lifecycle ──
    call_manager = CallManager(
        context=context,
        call_context=call_context,
        max_turns=6,
        on_turn_complete=_sync_turn,
        phase_instructor=phase_instructor,
    )

    # ── TTS: Sarvam Bulbul v3 (WebSocket streaming) ──
    # Pick voice gender based on teacher name
    teacher_name = call_context.get("teacherName", "")
    tts_voice = _pick_voice(teacher_name)
    logger.info(f"TTS voice: {tts_voice} (teacher: {teacher_name})")

    tts = SarvamTTSService(
        api_key=config.sarvam_api_key,
        sample_rate=16000,
        settings=SarvamTTSService.Settings(
            model="bulbul:v3",
            voice=tts_voice,
            language=lang_code,
            pace=0.92,
        ),
    )

    # ── Pipeline ──
    # NOTE: No assistant aggregator in pipeline — it consumes LLM frames
    # (LLMTextFrame, LLMFullResponseStartFrame, LLMFullResponseEndFrame)
    # and does NOT pass them downstream, starving TTS of input.
    # Instead, CallManager adds model responses to context directly.
    # ── STT Quality Filter: drop garbled/empty transcriptions ──
    stt_filter = STTConfidenceFilter()

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            stt_filter,               # Filter noise/gibberish before aggregator
            context_aggregator.user(),
            phase_instructor,          # Inject phase-specific instructions before LLM
            llm,
            call_manager,
            tts,
            transport.output(),
        ]
    )

    params = PipelineParams(
        allow_interruptions=True,  # Let parent interrupt bot — essential for natural conversation
        audio_in_sample_rate=16000,
        audio_out_sample_rate=16000,
    )
    task = PipelineTask(pipeline, params=params)

    # ── Event handlers ──

    @transport.event_handler("on_client_connected")
    async def on_connected(transport_instance, websocket):
        """Play greeting when call connects.

        TextFrame bypasses STT/LLM and goes directly to TTS for synthesis.
        The greeting text is already included in the LLM system instruction
        so the LLM knows what was said when the parent responds.

        Delay: Twilio trial accounts play a ~15s disclaimer before audio
        connects. We wait 2s for the pipeline to be fully ready, then
        send the greeting.
        """
        logger.info(f"Waiting for pipeline warmup before greeting...")
        await asyncio.sleep(1)  # Minimal warmup — speed matters
        logger.info(f"Playing greeting ({len(greeting_text)} chars): {greeting_text[:60]}...")
        # TTSSpeakFrame is standalone — flushes immediately to TTS
        # (TextFrame waits for LLMFullResponseEndFrame to flush, causing silence)
        await task.queue_frames([TTSSpeakFrame(text=greeting_text)])

    @transport.event_handler("on_client_disconnected")
    async def on_disconnected(transport_instance, websocket):
        """Persist final transcript and run post-call analysis."""
        transcript = call_manager.transcript
        turns = call_manager.turn_number
        logger.info(f"Call ended. Turns: {turns}, Transcript: {len(transcript)} entries")

        # Save to local store
        if call_store:
            call_store.complete_call(
                outreach_id, transcript, turns,
                call_status="completed",
            )

        # Try backend sync
        await sync_transcript(
            api_url=config.sahayakai_api_url,
            internal_key=config.sahayakai_internal_key,
            outreach_id=outreach_id,
            transcript=transcript,
            turn_count=turns,
            call_status="completed",
        )

        # Run post-call analysis (async, non-blocking)
        if call_store and transcript:
            try:
                insights = await analyze_call(
                    call_context, transcript, api_key=config.google_api_key,
                )
                if insights:
                    call_store.save_insights(outreach_id, insights)
                    parent_phone = call_context.get("parentPhone", "")
                    # Save structured concerns
                    if parent_phone and insights.get("concerns"):
                        call_store.record_concerns(
                            outreach_id, parent_phone, insights["concerns"],
                        )
                    # Save follow-up tasks
                    if insights.get("followUps"):
                        call_store.create_follow_ups(
                            outreach_id, parent_phone, insights["followUps"],
                        )
                    logger.info(
                        f"Post-call analysis saved for {outreach_id}: "
                        f"sentiment={insights.get('parentSentiment')}, "
                        f"concerns={len(insights.get('concerns', []))}, "
                        f"followUps={len(insights.get('followUps', []))}"
                    )
            except Exception as e:
                logger.error(f"Post-call analysis failed: {e}")

    return task
