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
from typing import Awaitable, Callable

from loguru import logger
from pipecat.frames.frames import CancelFrame, EndFrame, TTSSpeakFrame
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
from src.call_policy import LANGUAGE_CODES, is_positive_feedback, lang_code_for, plan_call
from src.conversation_state import PhaseInstructor
from src.stt_filter import STTConfidenceFilter
from src.stop_guard import StopRequestGuard
from src.opt_out import ANALYSIS, LIVE, StopListener, backstop_quote, utc_now_iso
from src.gemini_backend import resolve_gemini_backend
from src.persistence import sync_transcript
from src.call_store import CallStore
from src.call_analyzer import analyze_call, bounded_analysis

# Parent language → speech code. Lives in call_policy (pure) so the
# language-coverage test enumerates the same map; kept under its old name.
TWILIO_LANG_MAP = LANGUAGE_CODES

# Sarvam TTS voice mapping — male and female options
# See: https://docs.sarvam.ai/api-reference-docs/text-to-speech
# After a stop request the engine says its one line and moves to the closing
# phase. If the parent then says nothing for this long, the call is closed.
NOTED_CLOSE_AFTER_SILENCE_SECONDS = 10.0
# If the parent made a sound but the model never answered (a backchannel the
# STT filter or the turn aggregator threw away), wait at most this many
# windows in all before the timer closes the call itself.
NOTED_CLOSE_MAX_WINDOWS = 3
# Every graceful ending (the last turn, the CLOSE goodbye, the close after the
# opt-out line) is bounded: if the task has not finished this long after the
# ending began, the call is finished and the pipeline forced down. pipecat
# waits for an EndFrame with no timeout, so one stuck processor (a Gemini
# stream that never completes) would otherwise hold the call until Cloud
# Run's request timeout.
ENDING_BOUND_SECONDS = 20.0

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
    serializer=None,
    on_call_end=None,
    on_opt_out_request: Callable[[str, str], Awaitable[bool]] | None = None,
) -> tuple[PipelineTask, Callable[[], Awaitable[None]]]:
    """Create the streaming Pipecat pipeline for a parent call.

    Returns (task, finalize). `finalize` runs the end-of-call bookkeeping
    exactly once, whichever of the client-disconnect event or the caller gets
    there first; main.py awaits it after the pipeline ends, because when the
    bot ends the call itself the transport may not report a disconnect.

    `on_opt_out_request(quote, source)` RECORDS, on this call's outreach,
    that the parent may prefer not to be called (`optOutRequested`); it never
    blocks a number. It runs the moment the parent says so ("live"), or after
    the call when the analysis finds their words ("analysis"), and a failed
    live write is retried once at the end of the call. The caller passes it
    ONLY when it has authenticated the outreach id. With no writer the stop
    check is left out entirely: the engine must not tell a parent "I will let
    the class teacher know" when nothing will tell them.

    Nothing in the engine writes call_suppressions (src/opt_out.py says why).

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
    lang_code = lang_code_for(parent_language)
    outreach_id = call_context.get("id", "")
    positive = is_positive_feedback(call_context)

    logger.info(
        f"Creating streaming bot for outreach {outreach_id}, "
        f"language: {parent_language} ({lang_code}), "
        f"mode: {'positive_feedback' if positive else 'request_to_talk'}"
    )

    # ── What this call may say ──
    # Decided by call_policy.plan_call (below, once the parent history is
    # known). Only positive_feedback speaks the teacher's generatedMessage;
    # every other reason, including a missing or unknown one, opens with the
    # fixed request-to-talk line and the model never sees the concern.

    # ── Serializer ──
    # Provider-specific mu-law codec + call-control. The caller may pass one in
    # (the Vobiz/Plivo path does); otherwise default to Twilio for back-compat.
    # auto_hang_up=True requires call_sid + Twilio creds so the serializer can
    # POST to the Twilio REST API to end the call when EndFrame fires.
    if serializer is None:
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

    # RNNoise needs an optional native dep (pyrnnoise). If it is not installed,
    # run without denoise rather than crashing the call mid-stream.
    try:
        audio_in_filter = RNNoiseFilter()
    except Exception as _rnnoise_err:  # noqa: BLE001
        logger.warning(f"RNNoise unavailable — running without denoise: {_rnnoise_err}")
        audio_in_filter = None

    # ── Transport: Media Streams via WebSocket ──
    # SmartTurn REMOVED — adds 1-3s of deliberation after silence.
    # VAD alone with stop_secs=0.6 is fast enough for phone calls.
    # (0.6s silence = user paused → send to LLM immediately)
    transport = FastAPIWebsocketTransport(
        websocket=websocket,
        params=FastAPIWebsocketParams(
            serializer=serializer,
            audio_in_enabled=True,
            audio_in_sample_rate=16000,
            audio_in_filter=audio_in_filter,  # Denoise phone audio (None if unavailable)
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
    # Parent history is built from earlier calls' reasons and concerns, so a
    # request-to-talk call does not even read it; positive_feedback uses it as
    # before.
    parent_history = None
    if call_store and positive:
        parent_phone = call_context.get("parentPhone", "")
        parent_history = call_store.build_parent_context(parent_phone)
        if parent_history:
            logger.info(f"Parent history injected for outreach {outreach_id} ({len(parent_history)} chars)")

    plan = plan_call(call_context, parent_history=parent_history)
    greeting_text = plan.greeting
    system_instruction = plan.system_instruction

    llm_settings = dict(
        model="gemini-2.0-flash",
        temperature=0.2,  # Very low = focused, deterministic, stays in character
        max_tokens=40,  # CallManager truncates to 1st sentence anyway
        system_instruction=system_instruction,
    )
    gemini = resolve_gemini_backend(config)
    if gemini.is_vertex:
        # Vertex AI as the runtime service account (ADC), billed to the
        # project; no API key. See src/gemini_backend.py.
        from pipecat.services.google.vertex.llm import GoogleVertexLLMService

        llm = GoogleVertexLLMService(
            project_id=gemini.project,
            location=gemini.location,
            settings=GoogleVertexLLMService.Settings(**llm_settings),
        )
    else:
        llm = GoogleLLMService(
            api_key=config.google_api_key,
            settings=GoogleLLMService.Settings(**llm_settings),
        )
    logger.info(f"Gemini backend: {gemini.describe()}")

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

    # ── Ending: every graceful end is bounded ──
    ending = {"watching": False}

    async def _watch_ending(why: str):
        """Called as a graceful ending starts; bounds it by ENDING_BOUND_SECONDS."""
        if ending["watching"]:
            return
        ending["watching"] = True
        asyncio.ensure_future(_force_end_if_still_running(why))

    async def _force_end_if_still_running(why: str):
        await asyncio.sleep(ENDING_BOUND_SECONDS)
        has_finished = getattr(task, "has_finished", None)
        if callable(has_finished) and has_finished() is True:
            return
        logger.warning(f"Outreach {outreach_id}: {why} did not end the call in time; finishing it and forcing the pipeline down")
        await _force_down(f"{why} did not end the call in time")

    async def _force_down(why: str):
        # The record, the summary and the hang-up must not wait on a stuck
        # pipeline: start the bookkeeping now (it is shared and idempotent).
        _start_finalize()
        await _cancel_pipeline(why)
        # task.cancel() only queues a CancelFrame on the task's push queue,
        # BEHIND an EndFrame that is stuck, so on its own it never runs. A
        # CancelFrame is a system frame: put straight into the pipeline it
        # skips the queues, reaches the sink and lets runner.run() return.
        try:
            await task.pipeline.queue_frame(CancelFrame())
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Could not inject a CancelFrame for outreach {outreach_id}: {e}")

    async def _cancel_pipeline(why: str):
        try:
            await task.cancel()
            logger.info(f"Pipeline cancelled for outreach {outreach_id}: {why}")
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Pipeline cancel failed for outreach {outreach_id}: {e}")

    # ── Phase Instructor: injects turn-specific instructions before LLM ──
    phase_instructor = PhaseInstructor(guidance=plan.phase_guidance)

    # ── Call Manager: turn counting, transcript, call lifecycle ──
    call_manager = CallManager(
        context=context,
        call_context=plan.manager_context,
        max_turns=6,
        on_turn_complete=_sync_turn,
        on_ending=_watch_ending,
        phase_instructor=phase_instructor,
        ai_reveal_pattern=plan.ai_reveal_pattern,
        ai_reveal_line=plan.ai_reveal_line,
        closing_line=plan.goodbye,
        # A model sentence about future calls is replaced by this line and the
        # call goes on. The model side never records an opt-out.
        future_calls_line=plan.future_calls,
    )

    # ── TTS: Sarvam Bulbul v3 (WebSocket streaming) ──
    # Pick voice gender based on teacher name
    teacher_name = call_context.get("teacherName", "")
    tts_voice = _pick_voice(teacher_name)
    logger.info(f"TTS voice: {tts_voice}")

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

    # ── Do-not-call ──
    # The parent's own words are checked before the model sees them. The first
    # possible stop of the call is recorded for the teacher at once (not at
    # hangup, so a dropped line cannot lose it), answered with the one fixed
    # line in the call language, and from then on the parent hears only fixed
    # text: CallManager drops all model output and replaces the next model
    # reply with the fixed goodbye, which ends the call; if the parent says
    # nothing, the close timer says the goodbye and ends it. Nothing is
    # blocked. See src/opt_out.py.
    opt_out: dict = {"heard": False, "source": None, "quote": None, "at": None, "write": None}

    async def _record_request(quote: str, source: str) -> bool:
        if on_opt_out_request is None:
            logger.error(f"Opt-out request for {outreach_id} NOT recorded: no writer configured")
            return False
        try:
            saved = bool(await on_opt_out_request(quote, source))
        except Exception as e:  # noqa: BLE001
            logger.error(f"Opt-out request write raised for {outreach_id}: {type(e).__name__}")
            saved = False
        if not saved:
            logger.error(f"Opt-out request for {outreach_id} NOT recorded; the teacher will not see it")
        return saved

    async def _on_stop_heard(utterance: str, quote: str):
        if opt_out["heard"]:
            return
        opt_out.update(heard=True, source=LIVE, quote=quote, at=utc_now_iso())
        # CallManager owns the ending only if the model replies after this.
        opt_out["turn_at_notice"] = call_manager.turn_number
        # The parent's words and the line go into the conversation: the
        # transcript the teacher reads shows both, and the model's closing
        # reply knows what was said.
        context.add_message({"role": "user", "content": utterance})
        context.add_message({"role": "assistant", "content": plan.opt_out_noted})
        logger.info(f"Possible stop request (outreach {outreach_id}); recording it for the teacher and closing")
        opt_out["write"] = asyncio.ensure_future(_record_request(quote, LIVE))
        phase_instructor.skip_to_close()
        call_manager.close_with_fixed_goodbye()
        await task.queue_frames([TTSSpeakFrame(text=plan.opt_out_noted)])
        asyncio.ensure_future(_close_if_silent())

    async def _close_if_silent():
        # The model "actually replied" only when CallManager counted a turn
        # after the notice (it then said the goodbye and ended the call).
        # Speech alone proves nothing: the STT filter and the turn aggregator
        # drop backchannels before the model sees them (final-0b #3). So a
        # sound only buys another window, and the timer always closes in the
        # end.
        for window in range(1, NOTED_CLOSE_MAX_WINDOWS + 1):
            await asyncio.sleep(NOTED_CLOSE_AFTER_SILENCE_SECONDS)
            has_finished = getattr(task, "has_finished", None)
            if callable(has_finished) and has_finished() is True:
                return
            if call_manager.turn_number > opt_out["turn_at_notice"]:
                # The model replied: CallManager said the goodbye and owns the
                # ending. Bound it anyway, in case it never reaches _end_call
                # (a no-op when its own ending already armed the watchdog).
                await _watch_ending("the close after the opt-out line")
                return
            if stop_guard is None or not stop_guard.spoken_since_notice or window == NOTED_CLOSE_MAX_WINDOWS:
                break
            stop_guard.spoken_since_notice = False  # the parent spoke: give the model one more window
        if not call_manager.take_goodbye():
            # CallManager already said it and is ending the call; bound that too.
            await _watch_ending("the close after the opt-out line")
            return
        logger.info(f"Outreach {outreach_id}: no reply after the opt-out line; closing the call")
        context.add_message({"role": "assistant", "content": plan.goodbye})
        await task.queue_frames([TTSSpeakFrame(text=plan.goodbye), EndFrame()])
        await _watch_ending("the close after the opt-out line")

    if on_opt_out_request is not None:
        # A possible "don't call me again" is answered by the engine, not the model.
        stop_guard = StopRequestGuard(listener=StopListener(), on_stop=_on_stop_heard)
        stop_stages = [stop_guard]
    else:
        stop_guard = None
        stop_stages = []
        logger.warning(f"Outreach {outreach_id}: no authenticated opt-out writer — do-not-call handling is off for this call")

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            *stop_stages,
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
        # Length only: the greeting can carry the teacher's own message.
        logger.info(f"Playing greeting ({len(greeting_text)} chars, {plan.mode})")
        # TTSSpeakFrame is standalone — flushes immediately to TTS
        # (TextFrame waits for LLMFullResponseEndFrame to flush, causing silence)
        await task.queue_frames([TTSSpeakFrame(text=greeting_text)])

    async def _finalize_once():
        """Persist final transcript and run post-call analysis."""
        # A plain stop still held when the call ended (the parent said "don't
        # call me" and hung up): it stands, so it is recorded like any other.
        if stop_guard is not None and not opt_out["heard"]:
            held = stop_guard.take_pending()
            if held is not None:
                utterance, quote = held
                opt_out.update(heard=True, source=LIVE, quote=quote, at=utc_now_iso())
                context.add_message({"role": "user", "content": utterance})
                opt_out["write"] = asyncio.ensure_future(_record_request(quote, LIVE))
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

        # A stop heard on the call: make sure it was recorded (one retry)
        # BEFORE anything slow, so the record never waits on the analysis.
        if on_opt_out_request is not None and opt_out["heard"] and opt_out["source"] == LIVE:
            saved = await opt_out["write"] if opt_out["write"] is not None else False
            if not saved:
                logger.warning(f"Retrying the opt-out request record for {outreach_id}")
                await _record_request(opt_out["quote"], LIVE)

        # Post-call analysis, bounded: it is a second call to the same Gemini
        # API whose stall may be why the call ended badly, and the record,
        # the summary and the handler's slot must not wait on it
        # (final-0b #5; call_analyzer.ANALYSIS_TIMEOUT_SECONDS).
        insights = None
        if transcript:
            try:
                insights = await bounded_analysis(analyze_call(
                    call_context, transcript, api_key=config.google_api_key,
                    backend=gemini,
                    # The teacher's note quotes these words; ask for them in English.
                    flagged_words=opt_out["quote"] if opt_out["source"] == LIVE else None,
                ))
                if insights and call_store:
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

        # Do-not-call: let the post-call analysis catch a stop the phrase
        # check missed, but only on the parent's own quoted words. Either way
        # it is only recorded for the teacher; nothing is blocked.
        if on_opt_out_request is None:
            pass  # unauthenticated route: nothing may be written for this id
        elif not opt_out["heard"]:
            quote = backstop_quote(insights, transcript)
            if quote is not None:
                logger.warning(f"Post-call analysis found a possible stop request ({outreach_id}); recording it for the teacher")
                opt_out.update(heard=True, source=ANALYSIS, quote=quote, at=utc_now_iso())
                await _record_request(quote, ANALYSIS)

        # Provider-specific finalisation. The Vobiz path uses this to write the
        # transcript + summary to Firestore (for the modal) and to end the leg
        # over Vobiz REST — the Twilio serializer hangs up on its own instead.
        if opt_out["heard"] and on_opt_out_request is not None:
            # The summary leads with it even when the analysis is missing.
            analysis_opt_out = (insights or {}).get("optOut") if isinstance(insights, dict) else None
            analysis_opt_out = analysis_opt_out if isinstance(analysis_opt_out, dict) else {}
            in_english = analysis_opt_out.get("flaggedInEnglish" if opt_out["source"] == LIVE else "quoteInEnglish")
            insights = dict(insights or {})
            insights["optOutRequested"] = {
                "quote": opt_out["quote"], "source": opt_out["source"], "at": opt_out["at"],
                "inEnglish": in_english if isinstance(in_english, str) else "",
            }
        if on_call_end:
            try:
                await on_call_end(transcript, turns, insights)
            except Exception as e:
                logger.error(f"on_call_end hook failed: {e}")

    finalizing: dict = {"task": None}

    def _start_finalize():
        if finalizing["task"] is None:
            finalizing["task"] = asyncio.ensure_future(_finalize_once())
        return finalizing["task"]

    async def finalize():
        # Shared future: a second caller waits for the first run instead of
        # repeating it, and cannot cancel it by going away.
        await asyncio.shield(_start_finalize())

    @transport.event_handler("on_client_disconnected")
    async def on_disconnected(transport_instance, websocket):
        # The far end is gone: the parent hung up or the carrier ended the
        # stream. Start the bookkeeping FIRST (it owns the opt-out retry and
        # runs as its own shielded task, so cancelling the pipeline cannot cut
        # it short), then stop the pipeline at once. Left alone it idles until
        # pipecat's idle timeout, about 5 minutes, holding an instance slot
        # with CPU always allocated (seen live on 2026-11-16). Forced down,
        # not just cancelled: a graceful ending already stuck on its EndFrame
        # would hold task.cancel() behind it.
        pending = _start_finalize()
        await _force_down("far end disconnected")
        await asyncio.shield(pending)

    return task, finalize
