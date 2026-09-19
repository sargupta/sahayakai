"""Class gate: the publicly-invokable telephony service exposes nothing else.

Cloud Run IAM is the outer gate for `sahayakai-agents` — `roles/run.invoker` is
granted to the Next.js runtime SA and nobody else, so every agent route is
unreachable without a Google-signed token. Vobiz cannot mint one: it dials the
media socket straight from the public internet. Reaching it therefore needs
`allUsers`, which on the agent service would expose every agent endpoint too.

`SAHAYAKAI_TELEPHONY_ONLY` is what makes a second, public deployment of the same
image safe. This test states the property that makes it safe, as a property
rather than as a list: with the flag set, the ONLY non-health route is the
token-gated socket. Someone adding a router next year cannot widen the public
surface without failing here.

Run in a subprocess because the route surface is decided at import time.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SRC = str(Path(__file__).resolve().parents[2] / "src")

_PROBE = """
import json
import sahayakai_agents.main as m
print(json.dumps(sorted(r.path for r in m.app.routes)))
"""

_BASE_ENV = {
    "SAHAYAKAI_AGENTS_ENV": "development",
    "SAHAYAKAI_REQUEST_SIGNING_KEY": "k" * 64,
    "PYTHONPATH": SRC,
}

#: Probes that are safe to expose: they carry no schema and no data.
HEALTH = {"/healthz", "/readyz"}
SOCKET = "/telephony/vobiz/stream"


def _routes(**extra: str) -> list[str]:
    import os

    env = {**os.environ, **_BASE_ENV, **extra}
    out = subprocess.run(
        [sys.executable, "-c", _PROBE], env=env, capture_output=True, text=True, check=True
    )
    return json.loads(out.stdout.strip().splitlines()[-1])


class TestPublicSurface:
    def test_exposes_only_health_and_the_token_gated_socket(self) -> None:
        routes = set(_routes(SAHAYAKAI_TELEPHONY_ONLY="1"))
        assert routes == HEALTH | {SOCKET}, (
            "the public telephony service must expose nothing beyond the health "
            f"probes and the media socket; found {sorted(routes - HEALTH - {SOCKET})}"
        )

    def test_publishes_no_schema_docs_or_agent_card(self) -> None:
        # A public OpenAPI document is free reconnaissance, and it would
        # describe agent endpoints this service does not even serve.
        routes = set(_routes(SAHAYAKAI_TELEPHONY_ONLY="1"))
        for leak in ("/openapi.json", "/docs", "/redoc", "/.well-known/agent.json"):
            assert leak not in routes

    def test_the_flag_is_off_by_default(self) -> None:
        # A missing env var must never silently produce the narrow surface on
        # the agent service, which would take every agent offline.
        routes = set(_routes())
        assert SOCKET in routes
        assert any(r.startswith("/v1/") for r in routes)
        assert "/.well-known/agent.json" in routes

    def test_only_explicit_truthy_values_enable_it(self) -> None:
        # "false" or "0" reading as enabled would take the whole agent service
        # down to three routes.
        for value in ("0", "false", "no", "off", ""):
            assert any(r.startswith("/v1/") for r in _routes(SAHAYAKAI_TELEPHONY_ONLY=value))
        for value in ("1", "true", "TRUE", "yes", "on"):
            assert set(_routes(SAHAYAKAI_TELEPHONY_ONLY=value)) == HEALTH | {SOCKET}


_INVARIANT_PROBE = """
import os
from sahayakai_agents.config import Settings
s = Settings()
try:
    s.assert_prod_invariants()
    print("OK")
except RuntimeError as e:
    print("RAISED:" + str(e).replace("\\n", " | "))
"""


def _invariants(**extra: str) -> str:
    import os

    env = {
        **os.environ,
        "SAHAYAKAI_AGENTS_ENV": "production",
        "SAHAYAKAI_REQUEST_SIGNING_KEY": "k" * 64,
        "PYTHONPATH": SRC,
        **extra,
    }
    for drop in ("SAHAYAKAI_AGENTS_AUDIENCE", "SAHAYAKAI_AGENTS_ALLOWED_INVOKERS"):
        env.pop(drop, None)
    out = subprocess.run(
        [sys.executable, "-c", _INVARIANT_PROBE], env=env, capture_output=True, text=True, check=True
    )
    return out.stdout.strip().splitlines()[-1]


class TestProdInvariantsAreScopedNotWeakened:
    def test_agent_service_still_demands_audience_and_invokers(self) -> None:
        # The guard rail that must not move: on the agent service these remain
        # boot-blocking, because its routes authenticate callers by ID token.
        result = _invariants()
        assert result.startswith("RAISED:")
        assert "SAHAYAKAI_AGENTS_AUDIENCE" in result
        assert "SAHAYAKAI_AGENTS_ALLOWED_INVOKERS" in result

    def test_telephony_service_does_not_need_them(self) -> None:
        # Its only peer is a carrier that cannot mint a Google token, so an
        # audience and an invoker list would have to be invented to satisfy a
        # check that protects routes this deployment does not serve.
        assert _invariants(SAHAYAKAI_TELEPHONY_ONLY="1") == "OK"

    def test_telephony_service_still_demands_a_real_signing_key(self) -> None:
        # The exemption is narrow. The signing key IS the telephony gate, so
        # weakening these would hand out the media socket.
        dev_default = _invariants(
            SAHAYAKAI_TELEPHONY_ONLY="1",
            SAHAYAKAI_REQUEST_SIGNING_KEY="dev-only-change-me",
        )
        assert dev_default.startswith("RAISED:")
        assert "dev default" in dev_default

        too_short = _invariants(
            SAHAYAKAI_TELEPHONY_ONLY="1", SAHAYAKAI_REQUEST_SIGNING_KEY="short"
        )
        assert too_short.startswith("RAISED:")
        assert "32 characters" in too_short
