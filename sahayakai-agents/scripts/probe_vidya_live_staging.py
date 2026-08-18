#!/usr/bin/env python3
"""Deployed-environment probe for the `/v1/vidya-voice/stream` hardening.

Runs the four assertions that actually matter about 829b7866c + 0a6f89a89
against a REAL Cloud Run revision, not a TestClient:

  A1  valid token   -> socket opens and real model audio bytes come back
  A2  garbage token -> rejected AND no `vidya_voice.stream_open` in the logs
  A3  replayed token-> rejected at the `token_replayed` rung (4409)
  A4  7th open/hour -> rejected at the `uid_hourly_rate_limit` rung (4429)

A2 is the whole point of the exercise. The bug being fixed is that the
socket was ACCEPTED before the token was verified, so "the client saw an
error" is entirely compatible with the server having opened, and been
billed for, a Vertex Live session. Only the server's own logs can tell
those apart, so A2 reads Cloud Logging and asserts the ABSENCE of a
`stream_open` event in the window around the rejected handshake — plus the
PRESENCE of the matching `stream_rejected`, without which "no stream_open"
would be vacuously true for a request that never arrived.

--- On close codes, and why this script asserts on logs -------------------

`_admit_stream` rejects with application close codes (4401 / 4409 / 4429 /
4503) BEFORE `ws.accept()`. Under Starlette's TestClient those codes reach
the test. Under uvicorn they DO NOT reach the client: a `websocket.close`
sent while the handshake is still CONNECTING is answered on the wire as
HTTP 403, discarding the code
(`uvicorn/protocols/websockets/websockets_sansio_impl.py`, the
`elif message["type"] == "websocket.close":` branch — `conn.reject(
HTTPStatus.FORBIDDEN, "")`). The same is true of the older
`websockets_impl.py`.

So every rejection rung looks identical from outside: HTTP 403. That is
not a defect in the hardening — nothing is accepted, nothing is billed,
which is what the fix promised — but it does mean a deployed probe cannot
tell 4409 from 4429 by looking at the socket. It has to read the server's
`stream_rejected.reason`, which maps 1:1 onto the codes:

    invalid_stream_token   -> 4401      uid_already_streaming  -> 4409
    token_replayed         -> 4409      uid_hourly_rate_limit  -> 4429
    global_capacity        -> 4503

Each assertion therefore checks BOTH halves: the client-observable
rejection, and the specific rung the server says fired.

--- Cost -----------------------------------------------------------------

Only A1 opens a billable Vertex Live session. A3 and A4 need sockets that
are ADMITTED (to spend the uid's hourly budget) but not billed, so they
close immediately after the handshake: `_await_setup_frame` sees the
disconnect and bails "before the Vertex session exists".

--- Usage ----------------------------------------------------------------

    python scripts/probe_vidya_live_staging.py <staging-url> [--project P]

The URL is required and must contain `-staging`; the script refuses to run
against anything else, so it can never be pointed at production.

Credentials, both read at startup, neither ever printed:
  * Cloud Run IAM ID token, from `gcloud auth print-identity-token`, sent as
    `X-Serverless-Authorization` — NOT `Authorization`, which the app itself
    needs for the stream token. Cloud Run consumes and strips the former.
  * `SAHAYAKAI_REQUEST_SIGNING_KEY`, from the env var of that name if set,
    else from Secret Manager.

Exit status is 0 only if all four assertions pass.
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import hashlib
import hmac
import json
import os
import subprocess
import sys
import time
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

try:
    from websockets.asyncio.client import connect
    from websockets.exceptions import ConnectionClosed, InvalidStatus
except ImportError:  # pragma: no cover - operator-facing
    sys.exit(
        "websockets is not installed. Run this from the sahayakai-agents venv:\n"
        "  .venv/bin/python scripts/probe_vidya_live_staging.py <url>"
    )

STREAM_PATH = "/v1/vidya-voice/stream"
SECRET_NAME = "SAHAYAKAI_REQUEST_SIGNING_KEY"
DEFAULT_PROJECT = "sahayakai-b4248"

# `_MAX_OPENS_PER_UID_PER_HOUR` in router.py. The 7th open in the window is
# the one that must be refused, so A4 spends exactly this many first.
MAX_OPENS_PER_UID_PER_HOUR = 6

# Cloud Logging is not synchronous with the request. Poll rather than sleep a
# flat interval: a fast ingest should not cost the probe two minutes.
LOG_POLL_TIMEOUT_SECONDS = 180.0
LOG_POLL_INTERVAL_SECONDS = 10.0

# A1 asks the model to say one short thing. Native-audio first chunk is
# typically well inside this; the ceiling is for a cold Vertex session.
AUDIO_WAIT_SECONDS = 75.0


# ---- pretty-printing -----------------------------------------------------

_RESULTS: list[tuple[str, bool, str]] = []


def record(name: str, ok: bool, detail: str) -> None:
    _RESULTS.append((name, ok, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}: {detail}", flush=True)


def step(msg: str) -> None:
    print(f"  .. {msg}", flush=True)


# ---- credentials ---------------------------------------------------------


def _run(cmd: list[str]) -> str:
    # check=False: a non-zero exit is reported with its stderr below, which is
    # far more use to an operator than a CalledProcessError traceback.
    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        raise SystemExit(
            f"command failed ({proc.returncode}): {' '.join(cmd)}\n{proc.stderr.strip()}"
        )
    return proc.stdout


def identity_token() -> str:
    """Google ID token for the Cloud Run IAM check (service is not public)."""
    return _run(["gcloud", "auth", "print-identity-token"]).strip()


def signing_key(project: str) -> bytes:
    """Shared HMAC secret the sidecar verifies stream tokens against."""
    env = os.environ.get(SECRET_NAME)
    if env:
        return env.strip().encode()
    out = _run(
        [
            "gcloud", "secrets", "versions", "access", "latest",
            f"--secret={SECRET_NAME}", f"--project={project}",
        ]
    )
    return out.strip().encode()


def mint_stream_token(key: bytes, uid: str, ttl_seconds: int = 120) -> str:
    """Reimplementation of `router.mint_stream_token`.

    Deliberately not imported: the probe must exercise the deployed service
    as an external client does, holding nothing but the shared secret and
    the wire format. If this drifts from the server, A1 fails loudly, which
    is the correct signal.

    Deterministic in (uid, exp) — so callers that need two distinct tokens
    for one uid must vary the TTL, exactly as the docstring in router.py
    says. A4 relies on that.
    """
    exp = int((datetime.now(UTC) + timedelta(seconds=ttl_seconds)).timestamp())
    sig = (
        base64.urlsafe_b64encode(
            hmac.new(key, f"{uid}.{exp}".encode(), hashlib.sha256).digest()
        )
        .rstrip(b"=")
        .decode()
    )
    return f"{uid}.{exp}.{sig}"


# ---- socket helpers ------------------------------------------------------


class Outcome:
    """What a handshake attempt did, flattened for assertions."""

    def __init__(
        self,
        kind: str,
        http_status: int | None = None,
        close_code: int | None = None,
        detail: str = "",
    ) -> None:
        self.kind = kind  # "opened" | "http_reject" | "closed" | "error"
        self.http_status = http_status
        self.close_code = close_code
        self.detail = detail

    def __str__(self) -> str:
        bits = [self.kind]
        if self.http_status is not None:
            bits.append(f"http={self.http_status}")
        if self.close_code is not None:
            bits.append(f"close={self.close_code}")
        if self.detail:
            bits.append(self.detail)
        return " ".join(bits)


def _ws_url(base: str) -> str:
    return base.replace("https://", "wss://").replace("http://", "ws://") + STREAM_PATH


async def open_and_close(base: str, id_tok: str, stream_tok: str) -> Outcome:
    """Attempt a handshake and hang up immediately.

    Used by A3/A4, which need the uid's slot and hourly budget SPENT but no
    Vertex session opened. Closing straight after the handshake makes
    `_await_setup_frame` raise `WebSocketDisconnect`, and the handler bails
    before the `genai.Client` is constructed — an admitted socket that costs
    nothing.
    """
    headers = {
        "X-Serverless-Authorization": f"Bearer {id_tok}",
        "Authorization": f"Bearer {stream_tok}",
    }
    try:
        async with connect(
            _ws_url(base), additional_headers=headers, open_timeout=30
        ) as ws:
            await ws.close()
            return Outcome("opened")
    except InvalidStatus as exc:
        return Outcome("http_reject", http_status=exc.response.status_code)
    except ConnectionClosed as exc:
        code = exc.rcvd.code if exc.rcvd else None
        return Outcome("closed", close_code=code)
    except Exception as exc:  # noqa: BLE001 - operator-facing probe
        return Outcome("error", detail=f"{type(exc).__name__}: {exc}")


# ---- Cloud Logging -------------------------------------------------------


def service_name_from_url(base: str) -> str:
    """Recover the Cloud Run SERVICE name from its `*.run.app` URL.

    `resource.labels.service_name` in Cloud Logging is `sahayakai-agents-staging`,
    but the host is `sahayakai-agents-staging-zwydpvyuca-as.a.run.app` — the
    service name plus a project hash and a region code. Taking the first
    dot-separated label whole (the obvious thing) yields a service name that
    matches NOTHING, and a log filter that matches nothing makes A2's "no
    stream_open appeared" vacuously true. So the two trailing dash segments
    come off. Service names may themselves contain dashes, which is why this
    strips from the right by count rather than splitting.
    """
    host = base.split("//", 1)[-1].split("/", 1)[0]
    label = host.split(".", 1)[0]
    return label.rsplit("-", 2)[0]


def _rfc3339(when: datetime) -> str:
    return when.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def log_filter(
    service: str, event: str, start: datetime, end: datetime | None = None
) -> str:
    parts = [
        'resource.type="cloud_run_revision"',
        f'resource.labels.service_name="{service}"',
        f'jsonPayload.event="{event}"',
        f'timestamp>="{_rfc3339(start)}"',
    ]
    if end is not None:
        parts.append(f'timestamp<="{_rfc3339(end)}"')
    return " AND ".join(parts)


def read_logs(flt: str, project: str, limit: int = 100) -> list[dict[str, Any]]:
    out = _run(
        [
            "gcloud", "logging", "read", flt,
            f"--project={project}", "--format=json",
            f"--limit={limit}", "--freshness=2h",
        ]
    )
    return json.loads(out or "[]")


def poll_for_logs(
    flt: str, project: str, *, want: bool, timeout: float = LOG_POLL_TIMEOUT_SECONDS
) -> list[dict[str, Any]]:
    """Read `flt` until it returns something (want=True) or the timeout.

    With want=False the poll still runs to completion: proving an event is
    ABSENT means giving ingestion the same chance to surface it that a
    presence check gets. Returning early on an empty read would make A2 pass
    simply by asking too soon.
    """
    deadline = time.monotonic() + timeout
    entries: list[dict[str, Any]] = []
    while time.monotonic() < deadline:
        entries = read_logs(flt, project)
        if want and entries:
            return entries
        time.sleep(LOG_POLL_INTERVAL_SECONDS)
    return entries if not want else read_logs(flt, project)


def reasons(entries: list[dict[str, Any]]) -> list[str]:
    return [e.get("jsonPayload", {}).get("reason", "?") for e in entries]


# ---- assertions ----------------------------------------------------------


async def assertion_2_garbage_token(
    base: str, service: str, project: str, id_tok: str
) -> None:
    """Garbage token -> rejected AND no billable session opened.

    Runs FIRST and alone so the log window it inspects contains no traffic
    from the other assertions. A1 legitimately emits `stream_open`; if it
    ran first, "no stream_open in the window" would be untestable.
    """
    print("\n=== A2: garbage token is rejected and opens no session ===", flush=True)
    window_start = datetime.now(UTC) - timedelta(seconds=5)
    step("connecting with a syntactically invalid stream token")
    outcome = await open_and_close(base, id_tok, "not-a-real-token")
    window_end = datetime.now(UTC) + timedelta(seconds=5)

    rejected = outcome.kind == "http_reject" and outcome.http_status == 403
    if not rejected and outcome.kind == "closed" and outcome.close_code == 4401:
        rejected = True  # if a future server surfaces the code, accept it too
    record(
        "A2a client rejected",
        rejected,
        f"handshake outcome: {outcome} (expected HTTP 403 — see module docstring "
        f"on why the 4401 close code does not reach the client under uvicorn)",
    )

    open_filter = log_filter(service, "vidya_voice.stream_open", window_start, window_end)
    rej_filter = log_filter(service, "vidya_voice.stream_rejected", window_start, window_end)
    print(f"\n  log query (A2 — the negative):\n    {open_filter}\n", flush=True)

    step("polling Cloud Logging for stream_rejected (proves the request landed)")
    rej = poll_for_logs(rej_filter, project, want=True)
    got = reasons(rej)
    record(
        "A2b server logged the rejection",
        "invalid_stream_token" in got,
        f"{len(rej)} stream_rejected entr(y|ies) in window, reasons={got or '[]'} "
        "(without this, 'no stream_open' proves nothing — the request might "
        "never have reached the app)",
    )

    step("querying Cloud Logging for stream_open in the same window")
    opened = read_logs(open_filter, project)
    record(
        "A2c no session was opened",
        not opened,
        f"{len(opened)} stream_open entr(y|ies) in window "
        f"[{_rfc3339(window_start)} .. {_rfc3339(window_end)}]"
        + (f" -> {json.dumps([e.get('jsonPayload') for e in opened])}" if opened else ""),
    )


async def assertion_1_valid_token(base: str, key: bytes, id_tok: str) -> None:
    """Valid token -> real audio bytes come back from the model."""
    print("\n=== A1: valid token yields real audio bytes ===", flush=True)
    uid = f"probe-audio-{uuid.uuid4().hex[:8]}"
    token = mint_stream_token(key, uid)
    headers = {
        "X-Serverless-Authorization": f"Bearer {id_tok}",
        "Authorization": f"Bearer {token}",
    }
    audio_bytes = 0
    chunks = 0
    note = ""
    try:
        async with connect(
            _ws_url(base), additional_headers=headers, open_timeout=30
        ) as ws:
            step(f"socket open as uid={uid}; sending setup + a text turn")
            await ws.send(json.dumps({"setup": {
                "grade": "8", "subject": "Science", "language": "en",
                "screenPath": "/dashboard",
            }}))
            await ws.send(json.dumps({"text": "Say hello in one short sentence."}))
            deadline = time.monotonic() + AUDIO_WAIT_SECONDS
            while time.monotonic() < deadline:
                remaining = deadline - time.monotonic()
                raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
                frame = json.loads(raw)
                if "audio" in frame:
                    audio_bytes += len(base64.b64decode(frame["audio"]))
                    chunks += 1
                    if audio_bytes > 0:
                        break
                elif "error" in frame:
                    note = f"server error frame: {frame['error']}"
                    break
            await ws.send(json.dumps({"end": True}))
            await ws.close()
    except InvalidStatus as exc:
        note = f"handshake rejected with HTTP {exc.response.status_code}"
    except TimeoutError:
        note = f"no audio frame within {AUDIO_WAIT_SECONDS:.0f}s"
    except Exception as exc:  # noqa: BLE001
        note = f"{type(exc).__name__}: {exc}"

    record(
        "A1 valid token -> audio",
        audio_bytes > 0,
        f"uid={uid} decoded {audio_bytes} audio bytes across {chunks} chunk(s)"
        + (f"; {note}" if note else ""),
    )


async def assertion_3_replay(
    base: str, service: str, project: str, key: bytes, id_tok: str
) -> None:
    """Replaying a burned token -> refused at the `token_replayed` rung."""
    print("\n=== A3: a replayed token is refused (4409 / token_replayed) ===", flush=True)
    uid = f"probe-replay-{uuid.uuid4().hex[:8]}"
    token = mint_stream_token(key, uid)
    window_start = datetime.now(UTC) - timedelta(seconds=5)

    step("first use of the token (admitted, then hung up before any Vertex session)")
    first = await open_and_close(base, id_tok, token)
    record("A3a first use admitted", first.kind == "opened", f"outcome: {first}")

    await asyncio.sleep(3)  # let the handler's finally release the uid slot

    step("replaying the same token")
    second = await open_and_close(base, id_tok, token)
    record(
        "A3b replay rejected",
        second.kind == "http_reject" and second.http_status == 403,
        f"outcome: {second} (HTTP 403 is how a pre-accept 4409 reaches the wire)",
    )

    flt = log_filter(service, "vidya_voice.stream_rejected", window_start)
    step("confirming the server refused it at the replay rung, not some other one")
    entries = [
        e for e in poll_for_logs(flt, project, want=True)
        if e.get("jsonPayload", {}).get("uid") == uid
    ]
    got = reasons(entries)
    record(
        "A3c rejected as token_replayed (=4409)",
        "token_replayed" in got,
        f"stream_rejected reasons for uid={uid}: {got or '[]'}",
    )


async def assertion_4_hourly_limit(
    base: str, service: str, project: str, key: bytes, id_tok: str
) -> None:
    """The 7th open inside the hour -> refused at the rate-limit rung."""
    print("\n=== A4: 7th socket in the hour is refused (4429 / hourly limit) ===", flush=True)
    uid = f"probe-rate-{uuid.uuid4().hex[:8]}"
    window_start = datetime.now(UTC) - timedelta(seconds=5)

    admitted = 0
    for i in range(MAX_OPENS_PER_UID_PER_HOUR):
        # Vary the TTL: the token is deterministic in (uid, exp), and a
        # repeat would be refused as a replay rather than counted as an open.
        outcome = await open_and_close(
            base, id_tok, mint_stream_token(key, uid, ttl_seconds=120 + i)
        )
        if outcome.kind == "opened":
            admitted += 1
        step(f"open {i + 1}/{MAX_OPENS_PER_UID_PER_HOUR}: {outcome}")
        await asyncio.sleep(3)  # uid concurrency is 1; let the slot clear

    record(
        f"A4a first {MAX_OPENS_PER_UID_PER_HOUR} opens admitted",
        admitted == MAX_OPENS_PER_UID_PER_HOUR,
        f"{admitted}/{MAX_OPENS_PER_UID_PER_HOUR} admitted for uid={uid}",
    )

    step("attempting the 7th")
    seventh = await open_and_close(
        base, id_tok, mint_stream_token(key, uid, ttl_seconds=200)
    )
    record(
        "A4b 7th rejected",
        seventh.kind == "http_reject" and seventh.http_status == 403,
        f"outcome: {seventh} (HTTP 403 is how a pre-accept 4429 reaches the wire)",
    )

    flt = log_filter(service, "vidya_voice.stream_rejected", window_start)
    step("confirming the server refused it at the hourly-limit rung")
    entries = [
        e for e in poll_for_logs(flt, project, want=True)
        if e.get("jsonPayload", {}).get("uid") == uid
    ]
    got = reasons(entries)
    record(
        "A4c rejected as uid_hourly_rate_limit (=4429)",
        "uid_hourly_rate_limit" in got,
        f"stream_rejected reasons for uid={uid}: {got or '[]'} "
        "(note: the guards are per-process, so this holds only while the "
        "uid's sockets land on one Cloud Run instance)",
    )


# ---- main ----------------------------------------------------------------


async def main_async(args: argparse.Namespace) -> int:
    base = args.url.rstrip("/")
    service = args.service or service_name_from_url(base)
    print(f"target service : {service}")
    print(f"target url     : {base}")
    print(f"project        : {args.project}\n")

    # Second net under the URL guard: a service name that lost its suffix in
    # derivation must not be silently accepted either.
    if "-staging" not in service:
        print(
            f"REFUSING TO RUN: derived service name {service!r} is not a staging service.",
            file=sys.stderr,
        )
        return 2

    # A log filter naming a service that does not exist returns zero rows for
    # every query, which would turn A2's negative assertion into a no-op.
    # Prove the filter can see this service before trusting an empty result.
    probe_filter = (
        'resource.type="cloud_run_revision" '
        f'AND resource.labels.service_name="{service}"'
    )
    if not read_logs(probe_filter, args.project, limit=1):
        print(
            f"REFUSING TO RUN: no Cloud Logging entries at all for service "
            f"{service!r} in the last 2h. The log-based assertions would pass "
            "vacuously. Check the service name and your log access.",
            file=sys.stderr,
        )
        return 2

    id_tok = identity_token()
    key = signing_key(args.project)

    # A2 first and alone: its assertion is about the ABSENCE of stream_open in
    # a time window, which only holds if nothing else is opening sockets.
    await assertion_2_garbage_token(base, service, args.project, id_tok)
    await assertion_1_valid_token(base, key, id_tok)
    await assertion_3_replay(base, service, args.project, key, id_tok)
    await assertion_4_hourly_limit(base, service, args.project, key, id_tok)

    print("\n================ SUMMARY ================")
    failed = 0
    for name, ok, detail in _RESULTS:
        print(f"{'PASS' if ok else 'FAIL'}  {name}")
        if not ok:
            failed += 1
            print(f"        {detail}")
    print(f"\n{len(_RESULTS) - failed}/{len(_RESULTS)} checks passed")
    return 1 if failed else 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Probe the deployed vidya-voice stream hardening (STAGING ONLY)."
    )
    parser.add_argument("url", help="staging base URL; must contain '-staging'")
    parser.add_argument("--project", default=DEFAULT_PROJECT)
    parser.add_argument(
        "--service",
        default=None,
        help="Cloud Run service name for the log queries; derived from the URL if omitted",
    )
    args = parser.parse_args()

    # Hard safety boundary. The four assertions deliberately burn a uid's
    # hourly budget and open a real Live session; none of that belongs
    # anywhere near production, and a probe is exactly the sort of script
    # someone edits a URL into at 2am.
    if "-staging" not in args.url:
        print(
            f"REFUSING TO RUN: {args.url!r} does not contain '-staging'.\n"
            "This probe is staging-only by construction. Do not remove this check.",
            file=sys.stderr,
        )
        return 2

    return asyncio.run(main_async(args))


if __name__ == "__main__":
    raise SystemExit(main())
