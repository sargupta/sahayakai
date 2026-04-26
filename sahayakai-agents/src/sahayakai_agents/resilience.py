"""Resilience primitives for telephony-grade AI calls.

Python port of `runResiliently` in sahayakai-main/src/ai/genkit.ts, tuned for
telephony:

- Key-pool failover across Gemini API keys.
- Jittered exponential backoff.
- **Total wait capped at `max_total_backoff_seconds`** (default 7s). Twilio
  webhook budget is ~15s; we must return — success or typed error — well
  inside that. This differs from the Next.js version (capped 60s) because
  Next.js also serves non-telephony flows.
- Implicit-cache metric extraction carried forward from Phase 0 design
  (`extract_cache_metrics` mirrors the TypeScript helper).
- Fail-fast on 400 / safety-filter errors.
- Typed `AIQuotaExhaustedError` on final exhaustion with `Retry-After` hint
  so Next.js can drop to the Genkit fallback.

Review trace:
- P1 #11 telephony backoff.
- P1 #16 pinned google-genai makes the error taxonomy stable.
- P2 #24 cache observability from day one.
"""
from __future__ import annotations

import asyncio
import random
import re
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

import structlog

from .shared.errors import (
    AIQuotaExhaustedError,
    AISafetyBlockError,
    UpstreamTimeoutError,
)

log = structlog.get_logger(__name__)

# Status code classification mirrors classifyStatus in genkit.ts.
# Round-2 P1-6 fix: anchor status codes with word boundaries so substrings
# like "4001" or "500ms" in an error body don't get misclassified. Keep the
# keyword branches narrower so "Invalid" doesn't fire on "Invalid chunk"
# network errors.
_STATUS_PATTERNS: tuple[tuple[re.Pattern[str], int], ...] = (
    (re.compile(r"\b429\b|Resource exhausted|RESOURCE_EXHAUSTED", re.IGNORECASE), 429),
    (re.compile(r"\b401\b|Unauthorized", re.IGNORECASE), 401),
    (re.compile(r"\b403\b|Forbidden|denied access", re.IGNORECASE), 403),
    (re.compile(r"\b400\b|API key expired|blocked by safety filter", re.IGNORECASE), 400),
    (re.compile(r"\b500\b|Internal Server Error", re.IGNORECASE), 500),
)


@dataclass(frozen=True)
class CacheMetrics:
    """Extracted token metrics from a Gemini response.

    `cached_content_tokens` > 0 indicates implicit context cache hit. The ratio
    cached/input is the direct cost signal: cached tokens bill at ~0.25x.
    """

    input_tokens: int
    cached_content_tokens: int
    output_tokens: int
    total_tokens: int
    cache_hit_ratio: float


def classify_status(error: Exception) -> int | None:
    """Best-effort HTTP-status extraction from an opaque Gemini SDK error.

    Round-2 P1-6 fix: also inspect `status_code` because google-genai uses
    that attribute name; `.status` was the pre-v0.8 name.
    """
    for attr in ("status", "status_code", "code"):
        value = getattr(error, attr, None)
        if isinstance(value, int):
            return value

    msg = str(error)
    for pattern, code in _STATUS_PATTERNS:
        if pattern.search(msg):
            return code
    return None


def extract_cache_metrics(result: Any) -> CacheMetrics | None:
    """Pull usage / cache metadata from whatever shape Gemini returned.

    Tolerates:
    - `result.usage_metadata` (google-genai native)
    - `result.usage` (ADK / high-level wrapper)
    - snake_case and camelCase field names

    Returns None if nothing usable is present (e.g. tool responses with no usage).
    """
    usage = getattr(result, "usage_metadata", None) or getattr(result, "usage", None)
    if usage is None:
        return None

    # Pydantic objects, dicts, and duck-typed SDK objects all need `getattr`
    # fallback to `dict.get`.
    def pick(obj: Any, *names: str) -> int:
        for name in names:
            if isinstance(obj, dict):
                if name in obj and obj[name] is not None:
                    return int(obj[name])
            else:
                val = getattr(obj, name, None)
                if val is not None:
                    return int(val)
        return 0

    input_tokens = pick(
        usage, "input_tokens", "inputTokens", "prompt_token_count", "promptTokenCount"
    )
    output_tokens = pick(
        usage, "output_tokens", "outputTokens", "candidates_token_count", "candidatesTokenCount"
    )
    total_tokens = pick(
        usage, "total_tokens", "totalTokens", "total_token_count", "totalTokenCount"
    )
    cached = pick(
        usage,
        "cached_content_tokens",
        "cachedContentTokens",
        "cached_content_token_count",
        "cachedContentTokenCount",
    )

    if input_tokens <= 0:
        return None

    if total_tokens <= 0:
        total_tokens = input_tokens + output_tokens

    ratio = (cached / input_tokens) if cached > 0 else 0.0
    return CacheMetrics(
        input_tokens=input_tokens,
        cached_content_tokens=cached,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        cache_hit_ratio=round(ratio, 3),
    )


def _jittered(ms: int) -> int:
    """±25% jitter, minimum 100ms. Matches runResiliently.jittered() behavior."""
    jitter = ms * 0.25 * (random.random() * 2 - 1)
    return max(100, int(round(ms + jitter)))


def _plan_backoff(attempt_index: int, status: int | None, pool_size: int) -> int:
    """Milliseconds to wait before the next attempt.

    Policy matches genkit.ts but with shorter multipliers suited to telephony:
    - single-key 429 → 500ms, 1500ms (never 20s / 40s like Next.js)
    - multi-key 429 → 200ms, 500ms (mostly rotate keys)
    - 401/403 → 100ms, 300ms (auth flips rarely benefit from long waits)
    """
    # Two-axis policy table reads more clearly than a nested ternary; keep
    # the if/else even though ruff would prefer SIM108. The 429 branch
    # has its own pool-size split which would obscure under chaining.
    if status == 429:  # noqa: SIM108 — readability over ternary chain
        base = 500 if pool_size == 1 else 200
    else:
        base = 100
    return _jittered(base * (2**attempt_index))


async def run_resiliently[T](
    fn: Callable[[str], Awaitable[T]],
    key_pool: tuple[str, ...],
    *,
    span_name: str | None = None,
    max_total_backoff_seconds: float = 7.0,
) -> T:
    """Execute `fn(api_key)` with key failover and telephony-bounded backoff.

    Raises `AIQuotaExhaustedError` when 429-exhausted; `AISafetyBlockError` on
    400 safety filter hits; `UpstreamTimeoutError` if we exceeded our total
    budget; the original exception on non-retryable errors.
    """
    if not key_pool:
        raise RuntimeError(
            "AI Configuration Error: Gemini API key pool is empty. "
            "Check Secret Manager (GOOGLE_GENAI_API_KEY)."
        )

    deadline = time.monotonic() + max_total_backoff_seconds
    start = time.monotonic()
    pool_size = len(key_pool)
    start_index = random.randrange(pool_size)
    max_attempts = max(3, min(pool_size, 5))
    last_error: Exception | None = None
    last_429 = False

    for i in range(max_attempts):
        current_index = (start_index + i) % pool_size
        current_key = key_pool[current_index]

        try:
            result = await fn(current_key)
        except Exception as exc:  # noqa: BLE001 — broad by design
            last_error = exc
            status = classify_status(exc)
            last_429 = status == 429

            log.error(
                "ai_resilience.attempt_failed",
                span_name=span_name or "unknown",
                key_index=current_index,
                pool_size=pool_size,
                attempt_number=i + 1,
                max_attempts=max_attempts,
                error_type=exc.__class__.__name__,
                error_status=status,
                error_message=str(exc)[:200],
                latency_ms=int((time.monotonic() - start) * 1000),
            )

            # Non-retryable → fail fast.
            if status not in (429, 401, 403):
                if status == 400:
                    raise AISafetyBlockError(str(exc)) from exc
                raise

            # Final attempt exhausted → synthesise typed error.
            if i == max_attempts - 1:
                break

            # Budget check BEFORE sleeping.
            remaining = deadline - time.monotonic()
            if remaining <= 0.15:
                log.warning(
                    "ai_resilience.budget_exceeded",
                    span_name=span_name,
                    attempt_number=i + 1,
                    remaining_ms=int(remaining * 1000),
                )
                break

            delay_ms = _plan_backoff(i, status, pool_size)
            # Clip the delay so we do not overshoot the deadline.
            delay_ms = min(delay_ms, int(remaining * 1000) - 50)
            if delay_ms > 0:
                await asyncio.sleep(delay_ms / 1000)
            continue

        # Success path. Emit trace + metrics.
        metrics = extract_cache_metrics(result)
        log.info(
            "ai_resilience.attempt_succeeded",
            span_name=span_name or "unknown",
            key_index=current_index,
            attempts=i + 1,
            latency_ms=int((time.monotonic() - start) * 1000),
            **(
                {
                    "input_tokens": metrics.input_tokens,
                    "cached_content_tokens": metrics.cached_content_tokens,
                    "output_tokens": metrics.output_tokens,
                    "total_tokens": metrics.total_tokens,
                    "cache_hit_ratio": metrics.cache_hit_ratio,
                }
                if metrics
                else {}
            ),
        )
        return result

    # Exhausted all attempts.
    if last_429:
        raise AIQuotaExhaustedError(
            "AI service is temporarily overloaded. Please try again in a minute.",
            retry_after_seconds=60,
        ) from last_error
    if last_error is None:
        # Defensive: loop never executed (should be impossible given key_pool check).
        raise UpstreamTimeoutError("No AI attempts made; internal invariant violated.")
    raise last_error
