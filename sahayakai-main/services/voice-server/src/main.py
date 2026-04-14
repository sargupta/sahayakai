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

app = FastAPI(title="SahayakAI Voice Server", version="0.1.0")
config = load_config()


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

    try:
        # Read Twilio's initial events to extract streamSid and outreachId
        stream_sid, outreach_id = await _wait_for_twilio_start(websocket)

        if not stream_sid:
            logger.error("Failed to get streamSid from Twilio")
            await websocket.close(code=1011, reason="No streamSid received")
            return

        if not outreach_id:
            logger.error("No outreachId in Twilio start event — closing")
            await websocket.close(code=1008, reason="Missing outreachId")
            return

        logger.info(f"Twilio stream: sid={stream_sid}, outreachId={outreach_id}")

        # Fetch call context from SahayakAI backend
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
        task = await create_bot(config, call_context, websocket, stream_sid)

        logger.info(f"Bot pipeline started for outreach {outreach_id}")
        run_params = PipelineTaskParams(loop=asyncio.get_event_loop())
        await task.run(run_params)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"Bot pipeline error: {e}")
        try:
            await websocket.close(code=1011, reason="Internal error")
        except Exception:
            pass


async def _wait_for_twilio_start(
    websocket: WebSocket,
    max_messages: int = 5,
) -> tuple[str, str]:
    """Read initial Twilio messages to extract streamSid and outreachId.

    Twilio sends 'connected' then 'start' events. The start event contains:
    - streamSid: the media stream identifier
    - start.customParameters: custom params from <Parameter> TwiML elements

    Returns (stream_sid, outreach_id) — either may be empty on failure.
    """
    stream_sid = ""
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
                # Custom parameters from <Parameter name="outreachId" value="xxx"/>
                custom = msg.get("start", {}).get("customParameters", {})
                outreach_id = custom.get("outreachId", "")
                logger.debug(
                    f"Twilio start: streamSid={stream_sid}, "
                    f"customParams={custom}"
                )
                return stream_sid, outreach_id

        except Exception as e:
            logger.error(f"Error reading Twilio init message: {e}")
            return "", ""

    return stream_sid, outreach_id


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
