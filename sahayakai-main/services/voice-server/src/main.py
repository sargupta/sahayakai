"""
SahayakAI Voice Server — Pipecat-based parent call orchestrator.

Handles Twilio Media Streams WebSocket connections and runs the
STT → LLM → TTS pipeline for each active call.

Endpoints:
  GET  /health          — Health check
  WS   /ws/call         — Twilio Media Streams WebSocket
"""

import asyncio
import json

from loguru import logger

from src.log_setup import configure_logging

# First, before pipecat or anything else logs: production runs at INFO, never
# loguru's DEBUG default (which logs the whole model context). src/log_setup.py.
configure_logging(logger)

import uvicorn  # noqa: E402
from fastapi import FastAPI, WebSocket, WebSocketDisconnect  # noqa: E402
from pipecat.workers.runner import WorkerRunner

from src.config import load_config
from src.bot import create_bot
from src.persistence import fetch_call_context
from src.call_store import CallStore
from src.call_analyzer import analyze_call, bounded_analysis
from src.vobiz import (
    verify_stream_token,
    fetch_context_firestore,
    write_call_result_firestore,
    hangup_vobiz_call,
    record_opt_out_request_firestore,
    consume_stream_token_firestore,
    read_dial_attempt_firestore,
)
from src.stream_tokens import StreamUse, is_call_uuid
from src.log_redaction import with_redaction
from src.gemini_backend import resolve_gemini_backend
from src.opt_out import opt_out_note

# After the pipeline ends on its own (last turn, or a stop request) the final
# sentence may still be playing from the carrier's buffer: the transport sends
# audio faster than real time. Wait this long before ending the leg.
_HANGUP_GRACE_SECONDS = 2.0

app = FastAPI(title="SahayakAI Voice Server", version="0.1.0")


def _is_test_scenario(outreach_id: str) -> bool:
    return outreach_id.startswith("__test__")


def _opt_out_request_writer(authenticated_outreach_id: str):
    """What create_bot calls when this call's parent may not want these calls.

    It only RECORDS the request on the outreach (`optOutRequested`, for the
    teacher); nothing in the engine blocks a number. Even so it writes to an
    outreach record, so it may only ever be built for an outreach id the
    handler has AUTHENTICATED (today: the signed stream token on the Vobiz
    route). Never pass an id read from an unauthenticated handshake.
    tests/test_opt_out_auth.py enforces this over every handler in this file.
    """
    async def _record(quote: str, source: str) -> bool:
        if _is_test_scenario(authenticated_outreach_id):
            logger.info(f"Test call {authenticated_outreach_id}: opt-out request heard, nothing persisted")
            return True
        return await record_opt_out_request_firestore(
            authenticated_outreach_id, config.google_cloud_project, quote, source,
        )

    return _record


async def run_pipeline(task) -> None:
    """Run one call's pipeline to its end. Every handler runs its call through this.

    Pipecat 1.12 moved the event loop onto the runner and dropped the `loop`
    kwarg from the task params (PipelineTaskParams is now a bare alias of
    WorkerParams). A WorkerRunner owns the loop and runs the pipeline to its
    EndFrame; handle_sigint is off because this runs on a uvicorn worker loop,
    not the main thread, where signal handlers fail.

    src/smoke_check.py runs this exact function against the real pipecat in
    the built image, so a runner API change fails the build, not a call.
    """
    runner = WorkerRunner(handle_sigint=False, loop=asyncio.get_running_loop())
    await runner.add_workers(task)
    await runner.run()


async def _finish(finalize) -> None:
    """Run create_bot's end-of-call bookkeeping on every way out of a handler.

    It records an opt-out request heard during the call (retrying a failed
    write),
    the transcript and the summary. Idempotent and shielded, so running it
    after the disconnect event already did is harmless. Never raises.
    """
    if finalize is None:
        return  # create_bot never returned; there is no call to finish
    try:
        await finalize()
    except Exception as e:  # noqa: BLE001
        logger.error(f"End-of-call bookkeeping failed: {e}")


config = load_config()
call_store = CallStore()  # SQLite — initialized once, shared across calls

# ── Test scenarios for local testing ──
# Use outreachId=__test__001, __test__002, etc. in TwiML
_TEST_SCENARIOS: dict[str, dict] = {
    # Scenario 1: Low attendance
    # Greeting: teacher introduces self, mentions child absent, asks gently
    "__test__001": {
        "studentName": "Aarav",
        "className": "Class 5",
        "subject": "Mathematics",
        "reason": "Low attendance — absent for several days",
        "generatedMessage": "नमस्ते जी, मैं शर्मा मैम बोल रही हूँ दिल्ली पब्लिक स्कूल से। आरव बेटा पिछले कुछ दिनों से स्कूल नहीं आ रहा, तो आपसे बात करनी थी।",
        "parentLanguage": "Hindi",
        "teacherName": "Ms. Sharma",
        "schoolName": "Delhi Public School",
    },
    # Scenario 2: Poor exam performance (18/100 in Science)
    # Greeting: does NOT mention score — eases in with "padhai mein thodi dikkat"
    "__test__002": {
        "studentName": "Priya",
        "className": "Class 8",
        "subject": "Science",
        "reason": "Poor exam performance — scored 18/100 in Science mid-term",
        "generatedMessage": "नमस्ते जी, मैं राजेश गुप्ता बोल रहा हूँ केंद्रीय विद्यालय से। प्रिया बेटी की पढ़ाई को लेकर आपसे बात करनी थी।",
        "parentLanguage": "Hindi",
        "teacherName": "Rajesh Gupta",
        "schoolName": "Kendriya Vidyalaya",
    },
    # Scenario 3: Behavioral issues — fighting, not listening
    # Greeting: does NOT say "fighting/behavior" — just "baat karni thi"
    # Dumping complaints upfront makes parents defensive instantly
    "__test__003": {
        "studentName": "Rohit",
        "className": "Class 7",
        "subject": "",
        "reason": "Behavioral issues — fighting with classmates, not listening to teachers",
        "generatedMessage": "नमस्ते जी, मैं सुनीता देवी बोल रही हूँ गवर्नमेंट सीनियर सेकेंडरी स्कूल से। रोहित बेटे के बारे में आपसे बात करनी थी।",
        "parentLanguage": "Hindi",
        "teacherName": "Sunita Devi",
        "schoolName": "Government Senior Secondary School",
    },
    # Scenario 4: Kannada language — homework + fees
    # Greeting: does NOT mention fees or homework — just intro + "mataadbekittu"
    # Fees are extremely sensitive — ease in during conversation
    "__test__004": {
        "studentName": "Kavya",
        "className": "Class 4",
        "subject": "English",
        "reason": "Homework not submitted for 2 weeks, pending fee for this quarter",
        "generatedMessage": "ನಮಸ್ಕಾರ, ನಾನು ಲಕ್ಷ್ಮೀ ಮೇಡಂ, ವಿದ್ಯಾ ಮಂದಿರ ಶಾಲೆಯಿಂದ ಮಾತಾಡ್ತಿದ್ದೀನಿ. ಕಾವ್ಯ ಬಗ್ಗೆ ನಿಮ್ಮ ಜೊತೆ ಮಾತಾಡಬೇಕಿತ್ತು.",
        "parentLanguage": "Kannada",
        "teacherName": "Lakshmi Ma'am",
        "schoolName": "Vidya Mandir School",
    },
}


@app.get("/health")
async def health():
    """Health check for the voice pipeline."""
    return {
        "status": "ok",
        "service": "voice-server",
        "providers": {
            "stt": "sarvam" if config.sarvam_api_key else "not_configured",
            "llm": "gemini" if config.google_api_key else "not_configured",
            "tts": "sarvam" if config.sarvam_api_key else "not_configured",
        },
        "call_store": call_store.get_stats(),
    }


@app.get("/readyz")
async def readyz():
    """Cloud Run startup probe target."""
    return {"status": "ready"}


@app.get("/healthz")
async def healthz():
    """Cloud Run liveness probe target."""
    return {"status": "ok"}


@app.websocket("/ws/call")
async def handle_call(websocket: WebSocket):
    """Handle a Twilio Media Streams WebSocket connection.

    Twilio opens this WebSocket when a call connects with <Connect><Stream>.
    We receive raw audio, process through the pipeline, and send audio back.

    Protocol: Twilio sends a 'connected' event first, then 'start' with
    metadata (streamSid, customParameters), then 'media' events with audio.

    NOTE: Twilio strips query parameters from the Stream URL. Custom params
    like outreachId are sent inside the 'start' event's customParameters
    field, populated from <Parameter> elements in the TwiML.
    """
    await websocket.accept()
    logger.info("WebSocket connected — waiting for Twilio handshake")

    outreach_id = ""
    call_context: dict = {}
    finalize = None

    try:
        # Read Twilio's initial events to extract streamSid, callSid and outreachId
        stream_sid, call_sid, outreach_id = await _wait_for_twilio_start(websocket)

        if not stream_sid:
            logger.error("Failed to get streamSid from Twilio")
            await websocket.close(code=1011, reason="No streamSid received")
            return

        if not outreach_id:
            logger.error("No outreachId in Twilio start event — closing")
            await websocket.close(code=1008, reason="Missing outreachId")
            return

        logger.info(f"Twilio stream: sid={stream_sid}, callSid={call_sid}, outreachId={outreach_id}")

        # The built-in scenarios need no record and no credential, so on this
        # unauthenticated route they would start a billed STT/LLM/TTS
        # pipeline for anyone. Refused unless SAHAYAKAI_ALLOW_TEST_SCENARIOS
        # is set (default off, never in production), before anything is built.
        if _is_test_scenario(outreach_id) and not config.allow_test_scenarios:
            logger.warning(f"Refused test scenario {outreach_id}: SAHAYAKAI_ALLOW_TEST_SCENARIOS is off")
            await websocket.close(code=1008, reason="Test scenarios disabled")
            return

        # Fetch call context from SahayakAI backend
        # __test__ prefix → hardcoded context for live testing (only reached
        # when SAHAYAKAI_ALLOW_TEST_SCENARIOS is on; refused above otherwise)
        if _is_test_scenario(outreach_id):
            call_context = _TEST_SCENARIOS.get(
                outreach_id,
                _TEST_SCENARIOS["__test__001"],  # default fallback
            )
            logger.info(f"Using test scenario: {outreach_id}")
        else:
            call_context = await fetch_call_context(
                api_url=config.sahayakai_api_url,
                internal_key=config.sahayakai_internal_key,
                outreach_id=outreach_id,
            )

        if not call_context:
            logger.error(f"Could not fetch context for outreach {outreach_id}")
            await websocket.close(code=1011, reason="Failed to load call context")
            return

        call_context["id"] = outreach_id

        # Create and run the Pipecat pipeline.
        #
        # on_opt_out_request=None ON PURPOSE. This route is unauthenticated:
        # the outreachId comes from the stream's own `start` event, so anyone
        # who can open the socket can name any outreach. Without a writer
        # create_bot leaves the stop check out rather than tell a parent "I
        # will let the class teacher know" when nothing will. To enable it,
        # authenticate the route first (a signed token from the web app's
        # TwiML, verified like the Vobiz route, or Twilio's
        # X-Twilio-Signature with TWILIO_AUTH_TOKEN), then pass
        # _opt_out_request_writer(<that id>).
        task, finalize = await create_bot(
            config, call_context, websocket, stream_sid,
            call_sid=call_sid, call_store=call_store,
            on_opt_out_request=None,
        )

        logger.info(f"Bot pipeline started for outreach {outreach_id}")
        await run_pipeline(task)
        await _finish(finalize)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
        await _finish(finalize)
        # Fallback: run post-call analysis if disconnect handler didn't fire
        await _post_call_cleanup(outreach_id, call_context, config)
    except Exception as e:
        logger.error(f"Bot pipeline error: {e}")
        await _finish(finalize)
        await _post_call_cleanup(outreach_id, call_context, config)
        try:
            await websocket.close(code=1011, reason="Internal error")
        except Exception:
            pass


async def _post_call_cleanup(outreach_id: str, call_context: dict, cfg):
    """Fallback post-call analysis when disconnect handler doesn't fire."""
    try:
        call = call_store.get_call(outreach_id)
        if not call or call.get("call_status") != "completed":
            return  # Already handled or not a real call

        transcript = call.get("transcript", [])
        if not transcript or len(transcript) < 2:
            return

        # Check if insights already exist
        if call_store.has_insights(outreach_id):
            return  # Already analyzed

        logger.info(f"Running fallback post-call analysis for {outreach_id}")
        insights = await bounded_analysis(analyze_call(
            call_context, transcript, api_key=cfg.google_api_key, backend=resolve_gemini_backend(cfg),
        ))
        if insights:
            call_store.save_insights(outreach_id, insights)
            parent_phone = call_context.get("parentPhone", "")
            if parent_phone and insights.get("concerns"):
                call_store.record_concerns(outreach_id, parent_phone, insights["concerns"])
            if insights.get("followUps"):
                call_store.create_follow_ups(outreach_id, parent_phone, insights["followUps"])
            logger.info(
                f"Fallback analysis complete: {outreach_id} — "
                f"sentiment={insights.get('parentSentiment')}"
            )
    except Exception as e:
        logger.error(f"Fallback post-call cleanup error: {e}")


@app.websocket("/telephony/vobiz/stream")
async def handle_vobiz_call(websocket: WebSocket):
    """Handle a Vobiz (Plivo-protocol) media stream.

    The web app's answer webhook points Vobiz here with a signed URL:
      wss://<sidecar>/telephony/vobiz/stream?t=<token>&cuid=<CallUUID>&lang=<lang>
    Unlike Twilio, the outreachId is carried by the signed token (verified
    against SAHAYAKAI_REQUEST_SIGNING_KEY), not by the stream 'start' event.
    """
    await websocket.accept()
    qp = websocket.query_params
    token = qp.get("t", "")
    call_uuid = qp.get("cuid", "")

    # The call UUID is not signed and becomes a path segment of an
    # authenticated Vobiz REST DELETE. Anything but a call UUID is refused
    # before it is used for anything.
    if not is_call_uuid(call_uuid):
        logger.error("Vobiz stream rejected — cuid is not a call UUID")
        await websocket.close(code=1008, reason="Bad call id")
        return

    outreach_id = verify_stream_token(token, config.request_signing_key)
    if not outreach_id:
        logger.error("Vobiz stream rejected — bad or expired token")
        await websocket.close(code=1008, reason="Unauthorized")
        return
    if _is_test_scenario(outreach_id) and not config.allow_test_scenarios:
        logger.warning(f"Refused test scenario {outreach_id}: SAHAYAKAI_ALLOW_TEST_SCENARIOS is off")
        await websocket.close(code=1008, reason="Test scenarios disabled")
        return
    # Single use. A genuine token stays valid until it expires, and the
    # stream URL that carries it is in Vobiz's answer XML and the request
    # log, so a replay would hear this call's greeting and write onto its
    # record. The first connection consumes the token; any later one is
    # refused here, before any call context is loaded.
    # One stream per DIAL ATTEMPT, not per token: a replayed answer webhook
    # mints new tokens, but the dial attempt (stamped by the web call route
    # from Vobiz's response) stays the same. src/stream_tokens.stream_use_id.
    dial_attempt = None
    if not _is_test_scenario(outreach_id):
        dial_attempt = await read_dial_attempt_firestore(outreach_id, config.google_cloud_project)
        if dial_attempt is None:
            logger.warning(f"Outreach {outreach_id} has no dial attempt stamped; single use falls back to the token")
    use = await consume_stream_token_firestore(
        token, outreach_id, config.google_cloud_project, dial_attempt=dial_attempt,
    )
    if use is not StreamUse.FIRST:
        logger.error(f"Vobiz stream refused for outreach {outreach_id}: token {use.value}")
        await websocket.close(
            code=1008 if use is StreamUse.REPLAY else 1011,
            reason="Stream already used" if use is StreamUse.REPLAY else "Could not verify stream",
        )
        return
    logger.info(f"Vobiz stream authorized: outreach={outreach_id}, cuid={call_uuid}")

    # Load context. __test__ ids use the built-in scenarios; real ids read the
    # outreach record straight from Firestore (no web internal key needed).
    if _is_test_scenario(outreach_id):
        call_context = _TEST_SCENARIOS.get(outreach_id, _TEST_SCENARIOS["__test__001"])
    else:
        call_context = await fetch_context_firestore(outreach_id, config.google_cloud_project)
    if not call_context:
        logger.error(f"Could not load context for outreach {outreach_id}")
        await websocket.close(code=1011, reason="Failed to load call context")
        return
    call_context["id"] = outreach_id

    # Plivo/Vobiz handshake — read the initial event(s) to get the stream id.
    stream_id = await _wait_for_plivo_start(websocket)
    if not stream_id:
        logger.error("Vobiz stream: no streamId in handshake — closing")
        await websocket.close(code=1011, reason="No streamId received")
        return
    logger.info(f"Vobiz stream started: streamId={stream_id}, outreach={outreach_id}")

    # Plivo serializer. auto_hang_up is OFF: it would POST to Plivo's own REST
    # host, but Vobiz lives at api.vobiz.ai — we end the leg ourselves below.
    from pipecat.serializers.plivo import PlivoFrameSerializer

    serializer = PlivoFrameSerializer(
        stream_id=stream_id,
        params=PlivoFrameSerializer.InputParams(
            plivo_sample_rate=8000,
            sample_rate=16000,
            auto_hang_up=False,
        ),
    )

    hung_up = False

    async def _hangup_once():
        nonlocal hung_up
        if hung_up:
            return
        hung_up = True
        await hangup_vobiz_call(call_uuid, config.vobiz_auth_id, config.vobiz_auth_token)

    async def _on_call_end(transcript: list[dict], turns: int, insights: dict | None):
        summary = _to_call_summary(insights) if insights else None
        if not outreach_id.startswith("__test__"):
            await write_call_result_firestore(
                outreach_id, config.google_cloud_project, transcript, summary
            )
        await _hangup_once()

    finalize = None
    try:
        # outreach_id here is the one verify_stream_token returned above:
        # authenticated, so this route may record a parent's opt-out request.
        task, finalize = await create_bot(
            config,
            call_context,
            websocket,
            stream_sid=stream_id,
            call_sid=call_uuid,
            call_store=call_store,
            serializer=serializer,
            on_call_end=_on_call_end,
            on_opt_out_request=_opt_out_request_writer(outreach_id),
        )
        logger.info(f"Vobiz bot pipeline started for outreach {outreach_id}")
        await run_pipeline(task)
        # The pipeline has ended: the last turn, a stop request, or the parent
        # hanging up. When the bot ends the call itself, on_client_disconnected
        # may never fire (in the pipecat source we could read, 0.0.108, it only
        # fires when the FAR end disconnects), and keepCallAlive=true means a
        # closed socket alone leaves the parent on a silent line. So end the
        # leg here, then run the end-of-call bookkeeping; both are no-ops if
        # the disconnect event already ran them.
        await asyncio.sleep(_HANGUP_GRACE_SECONDS)
        await _hangup_once()
        await _finish(finalize)
    except WebSocketDisconnect:
        logger.info("Vobiz stream disconnected")
        await _finish(finalize)
    except Exception as e:
        logger.error(f"Vobiz bot pipeline error: {e}")
        await _finish(finalize)
        try:
            await websocket.close(code=1011, reason="Internal error")
        except Exception:
            pass


async def _wait_for_plivo_start(websocket: WebSocket, max_messages: int = 5) -> str:
    """Read initial Plivo/Vobiz events and return the stream id.

    Plivo sends a 'start' event carrying start.streamId (some deployments send a
    'connected' event first). Any 'media' before 'start' is skipped. The raw
    first frames are logged so a protocol difference surfaces on the first call.
    """
    for _ in range(max_messages):
        try:
            raw = await websocket.receive_text()
        except Exception:
            return ""
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            continue
        event = msg.get("event", "")
        logger.debug(f"Vobiz handshake event={event!r}: {raw[:220]}")
        if event == "start":
            start = msg.get("start", {}) or {}
            return (
                start.get("streamId")
                or start.get("stream_id")
                or msg.get("streamId")
                or msg.get("stream_id")
                or ""
            )
    return ""


def _to_call_summary(insights: dict) -> dict:
    """Map post-call analysis insights onto the parent_outreach.callSummary shape
    the Contact-Parent modal renders (src/types/attendance CallSummary)."""
    summary = _summary_from_insights(insights)
    request = insights.get("optOutRequested")
    if isinstance(request, dict):
        # First thing the teacher reads, with the parent's own words.
        note = opt_out_note(request, request.get("inEnglish"))
        summary["actionItemsForTeacher"] = [note, *summary["actionItemsForTeacher"]]
        summary["parentResponse"] = summary["parentResponse"] or "The parent may prefer not to receive these calls."
        summary["followUpNeeded"] = True
    return summary


def _summary_from_insights(insights: dict) -> dict:
    follow_ups = insights.get("followUps") or []
    return {
        "parentResponse": insights.get("parentResponse") or insights.get("summary") or "",
        "parentConcerns": insights.get("concerns", []),
        "parentCommitments": insights.get("commitments", []),
        "actionItemsForTeacher": insights.get("actionItems") or insights.get("actionItemsForTeacher") or [],
        "guidanceGiven": insights.get("guidanceGiven", []),
        "followUpNeeded": bool(follow_ups) or bool(insights.get("followUpNeeded")),
        "followUpSuggestion": (follow_ups[0] if follow_ups else insights.get("followUpSuggestion", "")),
        "parentSentiment": insights.get("parentSentiment", ""),
    }


async def _wait_for_twilio_start(
    websocket: WebSocket,
    max_messages: int = 5,
) -> tuple[str, str]:
    """Read initial Twilio messages to extract streamSid and outreachId.

    Twilio sends 'connected' then 'start' events. The start event contains:
    - streamSid: the media stream identifier
    - start.customParameters: custom params from <Parameter> TwiML elements

    Returns (stream_sid, call_sid, outreach_id) — any may be empty on failure.
    """
    stream_sid = ""
    call_sid = ""
    outreach_id = ""

    for _ in range(max_messages):
        try:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            event = msg.get("event", "")

            if event == "connected":
                logger.debug(f"Twilio connected: protocol={msg.get('protocol')}")
                continue

            if event == "start":
                stream_sid = (
                    msg.get("streamSid", "")
                    or msg.get("start", {}).get("streamSid", "")
                )
                # Twilio includes callSid (CA...) alongside streamSid
                call_sid = (
                    msg.get("start", {}).get("callSid", "")
                    or msg.get("callSid", "")
                )
                # Custom parameters from <Parameter name="outreachId" value="xxx"/>
                custom = msg.get("start", {}).get("customParameters", {})
                outreach_id = custom.get("outreachId", "")
                logger.debug(
                    f"Twilio start: streamSid={stream_sid}, callSid={call_sid}, "
                    f"customParams={custom}"
                )
                return stream_sid, call_sid, outreach_id

        except Exception as e:
            logger.error(f"Error reading Twilio init message: {e}")
            return "", "", ""

    return stream_sid, call_sid, outreach_id


def main():
    """Entry point for the voice server."""
    logger.info(f"Starting voice server on {config.host}:{config.port}")

    # A misconfigured Gemini backend must stop the server before it takes a
    # call (the candidate revision then never passes its startup probe),
    # not fall back to the AI Studio key at the first parent reply.
    gemini = resolve_gemini_backend(config)
    logger.info(f"Gemini backend: {gemini.describe()}")

    missing = []
    if not config.sarvam_api_key:
        missing.append("SARVAM_AI_API_KEY")
    if not config.google_api_key and not gemini.is_vertex:
        missing.append("GOOGLE_GENAI_API_KEY")
    if missing:
        logger.warning(f"Missing API keys: {', '.join(missing)}")

    # uvicorn logs each accepted WebSocket with its query string, which on
    # the Vobiz route carries the signed stream token; redact it before any
    # handler writes it (src/log_redaction.py).
    from uvicorn.config import LOGGING_CONFIG

    uvicorn.run(
        "src.main:app",
        host=config.host,
        port=config.port,
        ws_max_size=16 * 1024 * 1024,  # 16MB for audio chunks
        log_config=with_redaction(LOGGING_CONFIG),
    )


if __name__ == "__main__":
    main()
