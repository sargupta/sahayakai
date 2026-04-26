"""Resilience tests: key-pool failover, telephony-bounded backoff, typed errors,
and cache-metrics extraction.

Review trace:
- P1 #11 total wait MUST stay below `max_total_backoff_seconds`.
- P2 #24 `extract_cache_metrics` must tolerate mixed response shapes.
"""
from __future__ import annotations

import time
from typing import Any

import pytest

from sahayakai_agents.resilience import (
    classify_status,
    extract_cache_metrics,
    run_resiliently,
)
from sahayakai_agents.shared.errors import (
    AIQuotaExhaustedError,
    AISafetyBlockError,
)

pytestmark = pytest.mark.unit


class TestClassifyStatus:
    def test_uses_status_attribute(self) -> None:
        err = Exception("Some text")
        err.status = 429
        assert classify_status(err) == 429

    def test_matches_429_phrases(self) -> None:
        assert classify_status(Exception("RESOURCE_EXHAUSTED")) == 429
        assert classify_status(Exception("429 Too Many Requests")) == 429
        assert classify_status(Exception("Resource exhausted.")) == 429

    def test_matches_401(self) -> None:
        assert classify_status(Exception("401 Unauthorized")) == 401

    def test_matches_400_safety(self) -> None:
        assert classify_status(Exception("400 Invalid")) == 400

    def test_returns_none_on_unknown(self) -> None:
        assert classify_status(Exception("some opaque failure")) is None


class TestExtractCacheMetrics:
    def test_tolerates_missing_usage(self) -> None:
        class Result:
            pass

        assert extract_cache_metrics(Result()) is None

    def test_extracts_from_snake_case_dict(self) -> None:
        result = {
            "usage_metadata": {
                "input_tokens": 1500,
                "output_tokens": 200,
                "total_tokens": 1700,
                "cached_content_tokens": 750,
            }
        }

        class Wrapper:
            def __init__(self, payload: dict[str, Any]) -> None:
                self.usage_metadata = payload["usage_metadata"]

        metrics = extract_cache_metrics(Wrapper(result))
        assert metrics is not None
        assert metrics.input_tokens == 1500
        assert metrics.cached_content_tokens == 750
        assert metrics.cache_hit_ratio == 0.5

    def test_extracts_from_camel_case_object(self) -> None:
        class Usage:
            inputTokens = 100
            outputTokens = 20
            totalTokens = 120
            cachedContentTokenCount = 0

        class Result:
            usage = Usage()

        metrics = extract_cache_metrics(Result())
        assert metrics is not None
        assert metrics.cache_hit_ratio == 0.0

    def test_returns_none_when_input_tokens_zero(self) -> None:
        class Result:
            usage = {"input_tokens": 0, "output_tokens": 0}

        assert extract_cache_metrics(Result()) is None


class TestRunResiliently:
    @pytest.mark.asyncio
    async def test_succeeds_on_first_attempt(self, test_api_key_pool: tuple[str, ...]) -> None:
        async def fn(key: str) -> str:
            return f"ok:{key}"

        result = await run_resiliently(fn, test_api_key_pool, span_name="test.ok")
        assert result.startswith("ok:")

    @pytest.mark.asyncio
    async def test_fails_over_on_429(self, test_api_key_pool: tuple[str, ...]) -> None:
        attempts: list[str] = []

        async def fn(key: str) -> str:
            attempts.append(key)
            if len(attempts) == 1:
                err = Exception("429 RESOURCE_EXHAUSTED")
                err.status = 429
                raise err
            return f"ok:{key}"

        result = await run_resiliently(
            fn, test_api_key_pool, span_name="test.failover", max_total_backoff_seconds=2
        )
        assert result.startswith("ok:")
        assert len(attempts) == 2

    @pytest.mark.asyncio
    async def test_raises_quota_exhausted_on_all_429(
        self, single_key_pool: tuple[str, ...]
    ) -> None:
        async def fn(_key: str) -> str:
            err = Exception("429 RESOURCE_EXHAUSTED")
            err.status = 429
            raise err

        with pytest.raises(AIQuotaExhaustedError) as info:
            await run_resiliently(
                fn, single_key_pool, span_name="test.quota", max_total_backoff_seconds=1
            )
        assert info.value.retry_after_seconds == 60

    @pytest.mark.asyncio
    async def test_fails_fast_on_safety_400(self, test_api_key_pool: tuple[str, ...]) -> None:
        async def fn(_key: str) -> str:
            raise Exception("400 Invalid — blocked by safety filter")

        with pytest.raises(AISafetyBlockError):
            await run_resiliently(
                fn, test_api_key_pool, span_name="test.safety"
            )

    @pytest.mark.asyncio
    async def test_honours_total_backoff_deadline(
        self, single_key_pool: tuple[str, ...]
    ) -> None:
        """Telephony budget: total wait must not exceed max_total_backoff_seconds."""

        async def fn(_key: str) -> str:
            err = Exception("429")
            err.status = 429
            raise err

        budget = 1.0
        start = time.monotonic()
        with pytest.raises(AIQuotaExhaustedError):
            await run_resiliently(
                fn,
                single_key_pool,
                span_name="test.budget",
                max_total_backoff_seconds=budget,
            )
        elapsed = time.monotonic() - start
        # Allow 50% overhead for jitter + final-attempt overhead, but must be well
        # under Twilio's 15s webhook budget.
        assert elapsed < budget + 0.75
