"""
Transcript persistence — syncs call transcript to SahayakAI backend.

Calls POST /api/attendance/transcript-sync on the Next.js server
after each conversation turn and on call completion.
"""

import httpx
from loguru import logger


async def sync_transcript(
    api_url: str,
    internal_key: str,
    outreach_id: str,
    transcript: list[dict],
    turn_count: int,
    call_status: str | None = None,
):
    """Push transcript update to the SahayakAI backend."""
    if not api_url or not internal_key:
        logger.warning("Transcript sync skipped — API URL or key not configured")
        return

    body: dict = {
        "outreachId": outreach_id,
        "transcript": transcript,
        "turnCount": turn_count,
    }
    if call_status:
        body["callStatus"] = call_status

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{api_url}/api/attendance/transcript-sync",
                json=body,
                headers={"x-internal-key": internal_key},
            )

        if resp.status_code == 200:
            logger.debug(f"Transcript synced: turn {turn_count}")
        else:
            logger.error(f"Transcript sync failed: {resp.status_code} {resp.text[:200]}")

    except Exception as e:
        logger.error(f"Transcript sync error: {e}")


async def fetch_call_context(
    api_url: str,
    internal_key: str,
    outreach_id: str,
) -> dict | None:
    """Fetch the outreach record context from the SahayakAI backend.

    Calls GET /api/attendance/call-context (internal endpoint,
    authenticated via x-internal-key, returns full call context).
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{api_url}/api/attendance/call-context",
                params={"outreachId": outreach_id},
                headers={"x-internal-key": internal_key},
            )

        if resp.status_code == 200:
            return resp.json()
        else:
            logger.error(f"Failed to fetch call context: {resp.status_code}")
            return None

    except Exception as e:
        logger.error(f"Call context fetch error: {e}")
        return None
