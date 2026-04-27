"""Per-call timeout tests for `run_resiliently` (Phase J.2 hot-fix).

Forensic finding P0 #6: a single hung Gemini call could block until the
SDK's ~600s default. `max_total_backoff_seconds` only gates BETWEEN
attempts, not DURING. These tests pin down the new
`per_call_timeout_seconds` parameter that wraps each `fn(current_key)`
in `asyncio.wait_for(...)` so we fall over to the next key on hang.
"""
from __future__ import annotations

import asyncio
import time

import pytest

from sahayakai_agents import resilience
from sahayakai_agents.resilience import run_resiliently

pytestmark = pytest.mark.unit


class TestPerCallTimeout:
    @pytest.mark.asyncio
    async def test_per_call_timeout_fires_within_budget(
        self, single_key_pool: tuple[str, ...]
    ) -> None:
        """A hanging fn must time out at ~per_call_timeout_seconds and
        the surfaced error must be `asyncio.TimeoutError`. Total wall
        time stays well under any sane test runner budget.
        """

        async def hanging_fn(_key: str) -> str:
            await asyncio.sleep(10)  # would block ~600s in prod
            return "never"

        start = time.monotonic()
        with pytest.raises(asyncio.TimeoutError):
            await run_resiliently(
                hanging_fn,
                single_key_pool,
                span_name="test.hang",
                max_total_backoff_seconds=5.0,
                per_call_timeout_seconds=1.0,
            )
        elapsed = time.monotonic() - start
        # 3 attempts * 1s budget + tiny overhead. Must NOT come close to
        # the 10s the fn would otherwise burn per attempt.
        assert elapsed < 5.0, (
            f"Total elapsed {elapsed:.2f}s suggests per-call timeout did "
            f"not fire — fn would have run 10s/attempt without it"
        )

    @pytest.mark.asyncio
    async def test_per_call_timeout_then_next_key_succeeds(
        self, test_api_key_pool: tuple[str, ...]
    ) -> None:
        """First attempt hangs → timeout fires → second attempt returns
        immediately. The success path on the second key proves the
        timeout is treated as a retryable failure (not a hard fail).
        """
        call_count = 0

        async def first_hangs_then_succeeds(key: str) -> str:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                await asyncio.sleep(10)
                return "never"
            return f"ok:{key}"

        result = await run_resiliently(
            first_hangs_then_succeeds,
            test_api_key_pool,
            span_name="test.recover",
            max_total_backoff_seconds=5.0,
            per_call_timeout_seconds=0.5,
        )
        assert result.startswith("ok:")
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_per_call_timeout_logs_attempt_timeout_event(
        self,
        single_key_pool: tuple[str, ...],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A timeout must emit a distinct `ai_resilience.attempt_timeout`
        log event with a `latency_ms` field. This is what makes per-key
        hangs observable separately from key-rotation backoff.
        """
        info_calls: list[tuple[str, dict[str, object]]] = []

        original_log = resilience.log

        class CaptureLog:
            def info(self, event: str, **kwargs: object) -> None:
                info_calls.append((event, kwargs))

            def __getattr__(self, name: str) -> object:
                # Pass non-info methods (warning, error) through to the
                # real logger so other code paths are unaffected.
                return getattr(original_log, name)

        monkeypatch.setattr(resilience, "log", CaptureLog())

        async def hanging_fn(_key: str) -> str:
            await asyncio.sleep(10)
            return "never"

        with pytest.raises(asyncio.TimeoutError):
            await run_resiliently(
                hanging_fn,
                single_key_pool,
                span_name="test.observable",
                max_total_backoff_seconds=5.0,
                per_call_timeout_seconds=0.3,
            )

        timeout_events = [
            (event, kwargs)
            for (event, kwargs) in info_calls
            if event == "ai_resilience.attempt_timeout"
        ]
        assert timeout_events, (
            "Expected at least one ai_resilience.attempt_timeout log "
            f"event; got {[e for e, _ in info_calls]!r}"
        )
        first_event, first_kwargs = timeout_events[0]
        assert first_event == "ai_resilience.attempt_timeout"
        assert "latency_ms" in first_kwargs
        assert isinstance(first_kwargs["latency_ms"], int)
        assert first_kwargs["latency_ms"] >= 0
        assert first_kwargs.get("per_call_timeout_seconds") == 0.3
