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

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from loguru import logger
from pipecat.pipeline.task import PipelineTaskParams

from src.config import load_config
from src.bot import create_bot
from src.persistence import fetch_call_context
from src.call_store import CallStore
from src.call_analyzer import analyze_call

app = FastAPI(title="SahayakAI Voice Server", version="0.1.0")
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

        # Fetch call context from SahayakAI backend
        # __test__ prefix → hardcoded context for live testing
        if outreach_id.startswith("__test__"):
            call_context = _TEST_SCENARIOS.get(
                outreach_id,
                _TEST_SCENARIOS["__test__001"],  # default fallback
            )
            logger.info(f"Using test scenario: {outreach_id} — {call_context.get('reason', '?')}")
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

        # Create and run the Pipecat pipeline
        task = await create_bot(config, call_context, websocket, stream_sid, call_sid=call_sid, call_store=call_store)

        logger.info(f"Bot pipeline started for outreach {outreach_id}")
        run_params = PipelineTaskParams(loop=asyncio.get_running_loop())
        await task.run(run_params)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
        # Fallback: run post-call analysis if disconnect handler didn't fire
        await _post_call_cleanup(outreach_id, call_context, config)
    except Exception as e:
        logger.error(f"Bot pipeline error: {e}")
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
        insights = await analyze_call(call_context, transcript, api_key=cfg.google_api_key)
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

    missing = []
    if not config.sarvam_api_key:
        missing.append("SARVAM_AI_API_KEY")
    if not config.google_api_key:
        missing.append("GOOGLE_GENAI_API_KEY")
    if missing:
        logger.warning(f"Missing API keys: {', '.join(missing)}")

    uvicorn.run(
        "src.main:app",
        host=config.host,
        port=config.port,
        ws_max_size=16 * 1024 * 1024,  # 16MB for audio chunks
    )


if __name__ == "__main__":
    main()
