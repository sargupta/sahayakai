"""Unit tests for the A2A agent card builder (Phase H).

Audit P0 #66 and P0 #67 demanded:

- `protocolVersion` top-level field
- `securitySchemes` + `security` describing how callers authenticate
- skill enumeration covering every sub-agent

These tests pin those guarantees so a future refactor cannot quietly
drop them.
"""
from __future__ import annotations

import pytest

from sahayakai_agents.agent_card import (
    A2A_PROTOCOL_VERSION,
    AGENT_CARD_VERSION,
    build_agent_card,
)
from sahayakai_agents.agents.vidya.registry import (
    INLINE_AGENTS,
    SUB_AGENTS,
)

pytestmark = pytest.mark.unit


class TestAgentCardShape:
    def test_protocol_version_is_present(self) -> None:
        card = build_agent_card(audience="https://example.run.app")
        assert card["protocolVersion"] == A2A_PROTOCOL_VERSION
        assert card["protocolVersion"] == "0.3"

    def test_card_has_supervisor_name(self) -> None:
        card = build_agent_card(audience="https://example.run.app")
        assert card["name"] == "sahayakai-supervisor-agent"

    def test_card_version_pinned(self) -> None:
        card = build_agent_card(audience=None)
        assert card["version"] == AGENT_CARD_VERSION
        # Phase N.1 — bumped from 0.3.0 because the wire schema changed
        # (`followUpSuggestion: str | None` → `plannedActions: list[VidyaAction]`).
        assert card["version"] == "0.4.0"

    def test_audience_falls_back_to_localhost(self) -> None:
        card = build_agent_card(audience=None)
        assert card["url"] == "http://localhost:8080"

    def test_audience_used_when_provided(self) -> None:
        url = "https://sahayakai-agents-prod.example.run.app"
        card = build_agent_card(audience=url)
        assert card["url"] == url


class TestSecuritySchemes:
    def test_two_schemes_present(self) -> None:
        card = build_agent_card(audience=None)
        schemes = card["securitySchemes"]
        assert isinstance(schemes, dict)
        assert "googleIdToken" in schemes
        assert "hmacContentDigest" in schemes

    def test_google_id_token_uses_oidc(self) -> None:
        card = build_agent_card(audience=None)
        schemes = card["securitySchemes"]
        assert isinstance(schemes, dict)
        scheme = schemes["googleIdToken"]
        assert scheme["type"] == "openIdConnect"

    def test_hmac_uses_apikey_in_header(self) -> None:
        card = build_agent_card(audience=None)
        schemes = card["securitySchemes"]
        assert isinstance(schemes, dict)
        scheme = schemes["hmacContentDigest"]
        assert scheme["type"] == "apiKey"
        assert scheme["in"] == "header"
        assert scheme["name"] == "X-Content-Digest"

    def test_hmac_scheme_documents_per_request_nature(self) -> None:
        card = build_agent_card(audience=None)
        schemes = card["securitySchemes"]
        assert isinstance(schemes, dict)
        scheme = schemes["hmacContentDigest"]
        # Description must clarify the digest is recomputed per
        # request — not a static API key. Prevents external A2A
        # consumers from caching the value as if it were a token.
        assert "Per-request HMAC" in scheme["description"]
        # Extended field flagging the per-request semantics. A2A 0.3
        # allows `x-` prefixed fields for vendor-specific metadata.
        assert scheme.get("x-hmac-body-digest") is True

    def test_security_requires_both_schemes(self) -> None:
        card = build_agent_card(audience=None)
        security = card["security"]
        assert isinstance(security, list)
        assert len(security) == 1
        block = security[0]
        # Both keys must be in the same block (AND combination).
        assert "googleIdToken" in block
        assert "hmacContentDigest" in block

    # P3 polish — Phase R.2 added Firebase App Check as a third auth
    # layer. Document it on the card so Postman / Insomnia / external
    # A2A consumers can discover the requirement up-front.

    def test_app_check_scheme_documented(self) -> None:
        card = build_agent_card(audience=None)
        schemes = card["securitySchemes"]
        assert isinstance(schemes, dict)
        assert "firebaseAppCheck" in schemes
        scheme = schemes["firebaseAppCheck"]
        assert scheme["type"] == "apiKey"
        assert scheme["in"] == "header"
        assert scheme["name"] == "X-Firebase-AppCheck"

    def test_app_check_description_explains_optional_dev_mode(self) -> None:
        card = build_agent_card(audience=None)
        scheme = card["securitySchemes"]["firebaseAppCheck"]
        # Description must mention the env-flag escape hatch so external
        # callers don't waste cycles when the requirement is off.
        assert "SAHAYAKAI_REQUIRE_APP_CHECK" in scheme["description"]

    def test_hmac_description_documents_replay_protection(self) -> None:
        card = build_agent_card(audience=None)
        scheme = card["securitySchemes"]["hmacContentDigest"]
        # Operators reading the card must see that replays are
        # rejected, not silently accepted on retries.
        assert "replay" in scheme["description"].lower()
        assert "X-Request-Timestamp" in scheme["description"]
        # Secret rotation guidance must be on the card so a key roll
        # doesn't surprise external A2A consumers with sudden 401s.
        assert "SAHAYAKAI_REQUEST_SIGNING_KEY" in scheme["description"]

    def test_app_check_optional_not_in_required_block(self) -> None:
        card = build_agent_card(audience=None)
        block = card["security"][0]
        # `firebaseAppCheck` is dev-flag-gated; not in the AND block.
        assert "firebaseAppCheck" not in block


class TestSkillCoverage:
    def test_card_includes_supervisor_skills(self) -> None:
        card = build_agent_card(audience=None)
        skills = card["skills"]
        assert isinstance(skills, list)
        ids = {s["id"] for s in skills}
        assert "vidya-orchestrate" in ids
        assert "parent-call-reply" in ids
        assert "parent-call-summary" in ids

    def test_every_registry_sub_agent_has_a_skill(self) -> None:
        card = build_agent_card(audience=None)
        skills = card["skills"]
        assert isinstance(skills, list)
        ids = {s["id"] for s in skills}
        for agent in SUB_AGENTS:
            assert agent.flow in ids, agent

    def test_every_inline_agent_has_a_skill(self) -> None:
        card = build_agent_card(audience=None)
        skills = card["skills"]
        assert isinstance(skills, list)
        ids = {s["id"] for s in skills}
        for agent in INLINE_AGENTS:
            assert agent.flow in ids, agent

    def test_sub_agent_skills_carry_endpoint(self) -> None:
        card = build_agent_card(audience=None)
        skills = card["skills"]
        assert isinstance(skills, list)
        by_id = {s["id"]: s for s in skills}
        for agent in SUB_AGENTS:
            skill = by_id[agent.flow]
            assert skill["endpoint"] == agent.endpoint

    def test_skills_have_descriptions(self) -> None:
        card = build_agent_card(audience=None)
        skills = card["skills"]
        assert isinstance(skills, list)
        for skill in skills:
            assert len(skill["description"]) >= 10


class TestInputOutputModes:
    def test_default_input_modes_include_json(self) -> None:
        card = build_agent_card(audience=None)
        modes = card["defaultInputModes"]
        assert isinstance(modes, list)
        assert "application/json" in modes

    def test_default_output_modes_include_json(self) -> None:
        card = build_agent_card(audience=None)
        modes = card["defaultOutputModes"]
        assert isinstance(modes, list)
        assert "application/json" in modes
