"""Pass-1 fan-out in the assessment-scanner sidecar is bounded and keeps order.

The request schema allows up to ASSESSMENT_MAX_PAGES (15) pages. Every page
must still be extracted (nothing past page 3 dropped), in page order, with no
more than PASS1_MAX_CONCURRENCY model calls in flight at once.
"""
from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any

import pytest

from sahayakai_agents.agents.assessment_scanner import router as sut
from sahayakai_agents.agents.assessment_scanner.schemas import (
    AssessmentScannerRequest,
    PageScan,
)

pytestmark = pytest.mark.unit


def _page(i: int) -> PageScan:
    return PageScan(
        pageIndex=i,
        pageType="answer_only",
        handwritingConfidence=0.9,
        imageQualityIssues=["none"],
        detectedLanguage="en",
        questions=[],
    )


@pytest.mark.parametrize("page_count", [1, 3, 4, 10, 15])
def test_every_page_extracted_in_order_with_bounded_concurrency(
    monkeypatch: pytest.MonkeyPatch, page_count: int,
) -> None:
    in_flight = 0
    peak = 0
    seen: list[int] = []

    async def fake_extract(url: str, i: int, n: int, *_: Any) -> PageScan:
        nonlocal in_flight, peak
        in_flight += 1
        peak = max(peak, in_flight)
        await asyncio.sleep(0.01 * ((i * 7) % 3 + 1))  # finish out of order
        in_flight -= 1
        assert n == page_count
        seen.append(i)
        return _page(i)

    captured: dict[str, Any] = {}

    async def fake_score(pages: list[PageScan], *_: Any) -> Any:
        captured["pass2_pages"] = [p.pageIndex for p in pages]
        return SimpleNamespace(questions=[{"stub": True}])

    def fake_aggregate(payload: Any, pages: list[PageScan], pass2: Any, latency: int) -> Any:
        captured["aggregate_pages"] = [p.pageIndex for p in pages]
        return SimpleNamespace(scorePct=0.0, needsReviewCount=0, status="graded")

    monkeypatch.setattr(sut, "_extract_page", fake_extract)
    monkeypatch.setattr(sut, "_score_assessment", fake_score)
    monkeypatch.setattr(sut, "_aggregate", fake_aggregate)
    monkeypatch.setattr(sut, "get_settings", lambda: SimpleNamespace(genai_keys=("k",)))
    monkeypatch.setattr(sut, "get_pass2_model", lambda: "stub-model")

    payload = AssessmentScannerRequest(
        assessmentId="550e8400-e29b-41d4-a716-446655440000",
        subject="Mathematics",
        gradeLevel="Class 5",
        pageUrls=[f"data:image/jpeg;base64,p{i}" for i in range(page_count)],
        userId="synthetic-teacher",
    )
    asyncio.run(sut.grade_assessment(payload))

    assert sorted(seen) == list(range(page_count))
    assert captured["pass2_pages"] == list(range(page_count))
    assert captured["aggregate_pages"] == list(range(page_count))
    assert peak <= sut.PASS1_MAX_CONCURRENCY
    if page_count > sut.PASS1_MAX_CONCURRENCY:
        assert peak == sut.PASS1_MAX_CONCURRENCY
