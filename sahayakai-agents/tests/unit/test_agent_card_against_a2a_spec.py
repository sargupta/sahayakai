"""CI guard: validate the agent card against A2A 0.3 invariants.

Phase J.1 hot-fix. Forensic audit P0 #9 — protocolVersion drift.

We don't load the full upstream A2A 0.3 JSON schema (it pulls a
network dependency on every test run and the spec text bumps
patch versions for cosmetic reasons). Instead, we pin the FIVE
structural invariants that any A2A 0.3 card MUST satisfy. If a
future refactor drops one of these, the test fails before the
card ships to production.

The invariants:

1. `protocolVersion` field exists at the top level.
2. `name`, `url`, `securitySchemes`, `skills` exist at the top
   level.
3. `protocolVersion` matches `^0\\.\\d+$` (we're still on the 0.x
   series; once A2A reaches 1.0 we'll bump this regex).
4. Every key referenced inside a `security[]` block must also
   exist as a key in `securitySchemes`. The spec calls this the
   "security reference" rule — referencing a scheme that isn't
   declared is a hard validation error.
5. `skills` is a non-empty list of objects each carrying at
   minimum an `id` and `description`.
"""
from __future__ import annotations

import re

import pytest

from sahayakai_agents.agent_card import build_agent_card

pytestmark = pytest.mark.unit


_PROTOCOL_VERSION_RE = re.compile(r"^0\.\d+$")


class TestA2ASpecInvariants:
    """The five invariants every A2A 0.3 card must satisfy."""

    def test_invariant_1_required_top_level_keys_present(self) -> None:
        card = build_agent_card(audience="https://example.run.app")
        required = {
            "protocolVersion",
            "name",
            "url",
            "securitySchemes",
            "skills",
        }
        missing = required - set(card.keys())
        assert not missing, (
            f"A2A 0.3 invariant violated: card is missing top-level "
            f"keys {sorted(missing)}"
        )

    def test_invariant_2_protocol_version_matches_0_x_regex(self) -> None:
        card = build_agent_card(audience="https://example.run.app")
        version = card["protocolVersion"]
        assert isinstance(version, str), (
            "protocolVersion must be a string (got "
            f"{type(version).__name__})"
        )
        assert _PROTOCOL_VERSION_RE.match(version), (
            f"protocolVersion {version!r} does not match ^0\\.\\d+$ — "
            "if A2A has hit 1.0, update this test deliberately."
        )

    def test_invariant_3_security_references_are_resolved(self) -> None:
        """Every key inside a `security[]` block must exist in
        `securitySchemes`. A2A spec calls this the "security
        reference" rule — referencing an undeclared scheme is a
        hard validation error."""
        card = build_agent_card(audience="https://example.run.app")
        schemes = card["securitySchemes"]
        assert isinstance(schemes, dict)
        scheme_keys = set(schemes.keys())
        security = card.get("security", [])
        assert isinstance(security, list)
        for block in security:
            assert isinstance(block, dict)
            unknown = set(block.keys()) - scheme_keys
            assert not unknown, (
                f"security[] block references undeclared scheme(s) "
                f"{sorted(unknown)}; declared schemes: "
                f"{sorted(scheme_keys)}"
            )

    def test_invariant_4_skills_is_nonempty_list_of_objects(self) -> None:
        card = build_agent_card(audience="https://example.run.app")
        skills = card["skills"]
        assert isinstance(skills, list), (
            "skills must be a list per A2A 0.3 spec"
        )
        assert len(skills) > 0, (
            "skills list is empty — agent card advertises no "
            "capabilities, which defeats the discovery purpose"
        )
        for skill in skills:
            assert isinstance(skill, dict), (
                f"skill entry must be an object, got {type(skill).__name__}"
            )
            assert "id" in skill, f"skill missing id: {skill!r}"
            assert "description" in skill, (
                f"skill {skill.get('id')!r} missing description"
            )

    def test_invariant_5_url_matches_audience(self) -> None:
        """The `url` field is what callers use to reach the agent.
        A2A spec mandates it match the deployed audience exactly so
        ID-token validation works on the receiving side."""
        audience = "https://sahayakai-agents-prod.example.run.app"
        card = build_agent_card(audience=audience)
        assert card["url"] == audience
