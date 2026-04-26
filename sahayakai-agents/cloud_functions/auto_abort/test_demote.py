"""Unit tests for the auto-abort demotion ladder.

The ladder is the entire safety contract — if `_demote` ever promotes
or skips a step, the function would amplify a failing rollout instead
of dampening it. Pin every rung explicitly here.
"""
from __future__ import annotations

import os

import pytest

# Avoid firebase-admin auto-init at import time.
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "test")

# `cloud_functions/__init__.py` and `cloud_functions/auto_abort/__init__.py`
# make this importable as a package, side-stepping the `main.py` collision
# with `sahayakai_agents.main`.
from cloud_functions.auto_abort import main  # noqa: E402

pytestmark = pytest.mark.unit


class TestDemoteLadder:
    @pytest.mark.parametrize(
        ("from_state", "to_state"),
        [
            (("full", 100), ("canary", 100)),
            (("canary", 100), ("canary", 50)),
            (("canary", 50), ("canary", 25)),
            (("canary", 25), ("canary", 5)),
            (("canary", 5), ("shadow", 25)),
            (("shadow", 25), ("shadow", 5)),
            (("shadow", 5), ("shadow", 1)),
            (("shadow", 1), ("off", 0)),
            (("off", 0), ("off", 0)),
        ],
    )
    def test_each_rung(self, from_state: tuple[str, int], to_state: tuple[str, int]) -> None:
        assert main._demote(*from_state) == to_state

    def test_off_at_floor_is_idempotent(self) -> None:
        # Multiple fires while already at off must stay at off.
        state: tuple[str, int] = ("off", 0)
        for _ in range(5):
            state = main._demote(*state)
        assert state == ("off", 0)

    def test_unknown_mode_falls_to_off(self) -> None:
        # Anything outside the four valid modes is treated as off
        # (defensive — would only happen if the Firestore doc was
        # corrupted).
        assert main._demote("garbage", 50) == ("off", 0)

    def test_offset_percent_collapses_to_lower_rung(self) -> None:
        # Operator manually set 75% — not on the ladder. Demote should
        # drop to the closest LOWER rung within the same mode.
        assert main._demote("canary", 75) == ("canary", 25)

    def test_negative_percent_clamped(self) -> None:
        # Defensive: negative percent treated as 0.
        assert main._demote("shadow", -10) == ("off", 0)

    def test_canary_zero_demotes_to_off_not_shadow_25(self) -> None:
        """Round-2 audit P0 LADDER-1 regression: previously canary/0
        FELL THROUGH to fallback["canary"] = ("shadow", 25), PROMOTING
        the rollout. The fix collapses any below-lowest-rung state to
        ("off", 0) — never promotes."""
        assert main._demote("canary", 0) == ("off", 0)

    def test_canary_negative_clamped_to_off(self) -> None:
        # Regression: canary with bad percent must not bounce up to shadow.
        assert main._demote("canary", -5) == ("off", 0)

    def test_full_zero_demotes_to_off(self) -> None:
        # Regression: full @ 0 (operator paused full mode) → off,
        # not canary @ 100 as the old fallback would have done.
        assert main._demote("full", 0) == ("off", 0)

    def test_above_100_clamped(self) -> None:
        # Defensive: percent > 100 treated as 100.
        assert main._demote("canary", 150) == ("canary", 50)

    def test_one_step_only(self) -> None:
        """The function MUST demote exactly one step per call. A
        cascade of multiple steps would amplify a single transient
        alert into a full off-flip — not what the operator expects.
        """
        # Walk the ladder rung by rung from full / 100 to off / 0
        # and assert exactly nine steps are needed.
        state: tuple[str, int] = ("full", 100)
        steps = 0
        path: list[tuple[str, int]] = [state]
        while state != ("off", 0) and steps < 20:
            state = main._demote(*state)
            path.append(state)
            steps += 1
        assert state == ("off", 0)
        # full → canary100 → canary50 → canary25 → canary5 → shadow25
        # → shadow5 → shadow1 → off  (8 steps + initial = 9 entries)
        assert steps == 8, f"expected 8 demotion steps, got {steps}: {path}"


class TestPolicyExtraction:
    def test_well_formed_alert(self) -> None:
        import base64
        import json

        body = {"incident": {"policy_name": "policies/test-error-rate"}}
        envelope = {"data": base64.b64encode(json.dumps(body).encode()).decode()}
        assert (
            main._extract_policy_name(envelope)
            == "policies/test-error-rate"
        )

    def test_missing_data(self) -> None:
        assert main._extract_policy_name({}) is None

    def test_garbage_data(self) -> None:
        assert main._extract_policy_name({"data": "not-base64!"}) is None

    def test_data_not_json(self) -> None:
        import base64

        envelope = {"data": base64.b64encode(b"not json").decode()}
        assert main._extract_policy_name(envelope) is None

    def test_no_policy_name_in_incident(self) -> None:
        import base64
        import json

        body = {"incident": {}}
        envelope = {"data": base64.b64encode(json.dumps(body).encode()).decode()}
        assert main._extract_policy_name(envelope) is None

    def test_push_subscription_envelope(self) -> None:
        # `{"message": {"data": "<b64>"}}` shape from push subscriptions.
        import base64
        import json

        body = {"incident": {"policy_name": "policies/test"}}
        envelope = {
            "message": {
                "data": base64.b64encode(json.dumps(body).encode()).decode(),
            }
        }
        assert main._extract_policy_name(envelope) == "policies/test"

    def test_webhook_direct_envelope(self) -> None:
        # No `data` wrapper — body delivered directly (HTTP webhook).
        envelope = {"incident": {"policy_name": "policies/webhook-test"}}
        assert main._extract_policy_name(envelope) == "policies/webhook-test"


class TestRecoveryDetection:
    def test_recovery_state_closed_returns_true(self) -> None:
        import base64
        import json

        body = {"incident": {"policy_name": "p", "state": "closed"}}
        envelope = {"data": base64.b64encode(json.dumps(body).encode()).decode()}
        assert main._is_recovery(envelope) is True

    def test_recovery_state_resolved_returns_true(self) -> None:
        import base64
        import json

        body = {"incident": {"policy_name": "p", "state": "resolved"}}
        envelope = {"data": base64.b64encode(json.dumps(body).encode()).decode()}
        assert main._is_recovery(envelope) is True

    def test_ended_at_set_returns_true(self) -> None:
        import base64
        import json

        body = {"incident": {"policy_name": "p", "ended_at": "2026-04-26T00:00:00Z"}}
        envelope = {"data": base64.b64encode(json.dumps(body).encode()).decode()}
        assert main._is_recovery(envelope) is True

    def test_open_incident_returns_false(self) -> None:
        import base64
        import json

        body = {"incident": {"policy_name": "p", "state": "open"}}
        envelope = {"data": base64.b64encode(json.dumps(body).encode()).decode()}
        assert main._is_recovery(envelope) is False

    def test_missing_state_returns_false(self) -> None:
        # Default: treat as fire (not recovery) so we don't accidentally
        # skip a fire that lacks the state field.
        import base64
        import json

        body = {"incident": {"policy_name": "p"}}
        envelope = {"data": base64.b64encode(json.dumps(body).encode()).decode()}
        assert main._is_recovery(envelope) is False


class TestIncidentIdExtraction:
    def test_extract_incident_id(self) -> None:
        import base64
        import json

        body = {"incident": {"policy_name": "p", "incident_id": "0.abc-123"}}
        envelope = {"data": base64.b64encode(json.dumps(body).encode()).decode()}
        assert main._extract_incident_id(envelope) == "0.abc-123"

    def test_missing_incident_id_returns_none(self) -> None:
        import base64
        import json

        body = {"incident": {"policy_name": "p"}}
        envelope = {"data": base64.b64encode(json.dumps(body).encode()).decode()}
        assert main._extract_incident_id(envelope) is None
