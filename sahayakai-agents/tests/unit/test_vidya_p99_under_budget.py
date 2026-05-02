"""Phase M.2 — verify VIDYA's tail latency stays under the new 12s
TS dispatcher budget.

Mocks the classifier to return after a configurable delay. Sweeps
delays from 1s to 4s and asserts no timeouts fire within the
12s budget.

Forensic context (P0 #13): the previous 8s TS timeout +
7s default Python backoff yielded p99 ≥ 10s, so tail traffic
flipped to genkit_fallback at 2× cost. Phase M.2 raised the TS
ceiling to 12s and pinned VIDYA's Python budget to 5s backoff +
8s per-call = 10s max. These tests pin that contract.
"""
from __future__ import annotations

import asyncio
import time

import pytest

from sahayakai_agents.resilience import run_resiliently

pytestmark = pytest.mark.unit


@pytest.mark.asyncio
@pytest.mark.parametrize("classifier_delay_s", [1.0, 2.5, 4.0])
async def test_vidya_p99_under_12s_budget(classifier_delay_s: float) -> None:
    """Classifier delays of 1s–4s must succeed within VIDYA's
    Phase M.2 budget (5s backoff + 8s per-call). 4s is the worst
    realistic p99 we want to keep within the 12s TS ceiling.
    """

    async def slow_classifier(api_key: str) -> dict[str, str]:
        await asyncio.sleep(classifier_delay_s)
        return {"type": "lesson-plan"}

    started = time.monotonic()
    result = await run_resiliently(
        slow_classifier,
        ("key1", "key2", "key3"),
        span_name="vidya.test",
        max_total_backoff_seconds=5.0,
        per_call_timeout_seconds=8.0,
    )
    elapsed = time.monotonic() - started

    assert result == {"type": "lesson-plan"}
    # Sanity: a successful run at delay D must not blow past D + a
    # tiny scheduler overhead. If we ever come close to the 12s TS
    # ceiling something is broken upstream.
    assert elapsed < classifier_delay_s + 1.0, (
        f"Classifier at {classifier_delay_s}s took {elapsed:.2f}s — "
        f"unexpected overhead suggests false-positive retry"
    )


@pytest.mark.asyncio
async def test_vidya_per_call_timeout_fires_above_8s() -> None:
    """A classifier that hangs longer than the 8s per-call timeout
    must trigger the per-call timeout, rotate keys, and ultimately
    raise `asyncio.TimeoutError` once attempts are exhausted.

    Models the failure mode the previous 8s TS budget exposed:
    classifier slower than per-call cap → key rotation → exhaustion.
    """
    call_count = 0

    async def hanging_fn(_key: str) -> str:
        nonlocal call_count
        call_count += 1
        await asyncio.sleep(20)  # would block ~600s in prod
        return "never"

    started = time.monotonic()
    with pytest.raises(asyncio.TimeoutError):
        await run_resiliently(
            hanging_fn,
            ("key1", "key2", "key3"),
            span_name="vidya.test.hang",
            max_total_backoff_seconds=5.0,
            per_call_timeout_seconds=1.0,  # tightened for test speed
        )
    elapsed = time.monotonic() - started

    # Each attempt should be capped at per_call_timeout_seconds. With
    # 3 attempts at 1s and no backoff sleep on timeouts, total wall
    # time should be ~3s, never close to the 20s the fn would burn.
    assert elapsed < 5.0, (
        f"Total elapsed {elapsed:.2f}s — per-call timeout did not "
        f"rotate keys correctly"
    )
    # Must rotate through every key in the pool.
    assert call_count == 3, (
        f"Expected 3 attempts (one per key), got {call_count}"
    )


@pytest.mark.asyncio
async def test_vidya_per_call_timeout_then_recovery() -> None:
    """First key hangs past 8s → per-call timeout fires → next key
    succeeds within budget. The total wall time stays under the TS
    12s ceiling. This is the canonical happy-tail path the budget
    bump was designed to keep alive.
    """
    call_count = 0

    async def first_hangs_then_succeeds(key: str) -> dict[str, str]:
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            await asyncio.sleep(20)
            return {"type": "never"}
        return {"type": "lesson-plan"}

    started = time.monotonic()
    result = await run_resiliently(
        first_hangs_then_succeeds,
        ("key1", "key2", "key3"),
        span_name="vidya.test.recover",
        max_total_backoff_seconds=5.0,
        per_call_timeout_seconds=1.0,  # tightened for test speed
    )
    elapsed = time.monotonic() - started

    assert result == {"type": "lesson-plan"}
    assert call_count == 2
    # 1s timeout + immediate retry ≈ 1s. Must stay well under the
    # 12s TS ceiling.
    assert elapsed < 3.0, (
        f"Recovery took {elapsed:.2f}s — exceeds TS budget headroom"
    )
