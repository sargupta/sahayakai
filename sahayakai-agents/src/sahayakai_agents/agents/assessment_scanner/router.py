"""FastAPI sub-router for the assessment-scanner agent.

Two-pass orchestration:
  PASS 1 -- per-page extraction, run in parallel via `asyncio.gather`
            with `return_exceptions=True` so one bad page doesn't kill
            the whole scan. Pages that fail to FETCH (Storage URL 404,
            expired token) raise `AssessmentPageUnreadableError` and
            surface as HTTP 422 naming the offending page.
  PASS 2 -- single rubric-grounded scoring call across all pages.

Aggregation + status classification + concept-mastery rollup happen
in-process after Pass-2 (the heavy lifting). NCERT chapter context is
resolved BY THE TS DISPATCHER (it owns the NCERT data tree) and
passed in via `ncertContext`. When omitted the sidecar uses a generic
fallback string.
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any

import httpx
import structlog
from fastapi import APIRouter
from google import genai
from google.genai import types as genai_types

from ...config import get_settings
from ...resilience import run_resiliently
from ...shared.errors import (
    AgentError,
    AISafetyBlockError,
    AssessmentEmptyExtractionError,
    AssessmentPageUnreadableError,
)
from ...shared.gemini_schema import gemini_response_schema
from ...shared.prompt_safety import sanitize, sanitize_optional
from .agent import (
    confidence_guidance_for,
    get_pass1_model,
    get_pass2_model,
    letter_grade_for,
    render_pass1_prompt,
    render_pass2_prompt,
    rubric_for,
)
from .schemas import (
    AssessmentScannerRequest,
    AssessmentScannerResponse,
    ConceptMastery,
    GradedQuestion,
    PageScan,
    Pass2Output,
    resolve_subject_family,
)

log = structlog.get_logger(__name__)

assessment_scanner_router = APIRouter(
    prefix="/v1/assessment-scanner",
    tags=["assessment-scanner"],
)

SIDECAR_VERSION = "phase-w.alpha"

# Per-call timeout: Pass-1 is multimodal + per-page so each call gets
# its own 30s budget; Pass-2 consumes JSON only but the response may be
# large so 45s.
_PASS1_PER_CALL_TIMEOUT_S = 30.0
_PASS2_PER_CALL_TIMEOUT_S = 45.0

# Image fetch timeout -- Storage download URLs should resolve in <5s
# even on a poor connection; anything longer is an outage signal.
_IMAGE_FETCH_TIMEOUT_S = 10.0


# ---- Image fetching ------------------------------------------------------


async def _fetch_page_bytes(
    page_url: str,
    page_index: int,
) -> tuple[str, bytes]:
    """Fetch one page URL -> (mime, bytes). Mirrors fetchImageAsBase64.

    `data:` URIs are decoded inline. Storage HTTPS URLs are fetched
    with a short timeout. ANY failure here is fatal for the page --
    we wrap it in `AssessmentPageUnreadableError` so the route returns
    a 422 naming the 1-based page number.
    """
    if page_url.startswith("data:"):
        # Inline data URI: data:image/jpeg;base64,XXXX
        try:
            header, body = page_url.split(",", 1)
            mime = header.split(":", 1)[1].split(";", 1)[0]
            import base64
            return mime, base64.b64decode(body, validate=True)
        except Exception as exc:
            raise AssessmentPageUnreadableError(page_index + 1, exc) from exc

    try:
        async with httpx.AsyncClient(timeout=_IMAGE_FETCH_TIMEOUT_S) as client:
            resp = await client.get(page_url)
            resp.raise_for_status()
            mime = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
            return mime, resp.content
    except Exception as exc:
        log.error(
            "assessment_scanner.page_fetch_failed",
            page_number=page_index + 1,
            error=str(exc),
        )
        raise AssessmentPageUnreadableError(page_index + 1, exc) from exc


# ---- Gemini call helpers -------------------------------------------------


async def _call_gemini_structured(
    *,
    api_key: str,
    model: str,
    contents: Any,
    response_schema: type,
) -> Any:
    """One structured-output Gemini call. Mirrors lesson_plan/agent.py."""
    client = genai.Client(api_key=api_key)
    return await client.aio.models.generate_content(
        model=model,
        contents=contents,
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=gemini_response_schema(response_schema),
            temperature=0.3,
        ),
    )


def _extract_text(result: Any) -> str:
    text = getattr(result, "text", None)
    if text:
        return str(text)
    candidates = getattr(result, "candidates", None) or []
    for cand in candidates:
        content = getattr(cand, "content", None)
        parts = getattr(content, "parts", None) or []
        for part in parts:
            t = getattr(part, "text", None)
            if t:
                return str(t)
    raise AgentError(
        code="INTERNAL",
        message="Gemini returned empty response",
        http_status=502,
    )


# ---- PASS 1 -------------------------------------------------------------


async def _extract_page(
    page_url: str,
    page_index: int,
    page_count: int,
    payload: AssessmentScannerRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> PageScan:
    """Pass-1 for ONE page. Fetch + render + call Gemini."""
    mime, image_bytes = await _fetch_page_bytes(page_url, page_index)

    prompt = render_pass1_prompt({
        "pageIndex": page_index,
        "pageCount": page_count,
        "subject": sanitize(payload.subject, max_length=100),
        "gradeLevel": sanitize(payload.gradeLevel, max_length=50),
        "language": sanitize(payload.language, max_length=20),
    })

    image_part = genai_types.Part.from_bytes(data=image_bytes, mime_type=mime)
    contents = genai_types.Content(
        role="user",
        parts=[image_part, genai_types.Part(text=prompt)],
    )
    model = get_pass1_model()

    async def _do(api_key: str) -> Any:
        return await _call_gemini_structured(
            api_key=api_key,
            model=model,
            contents=contents,
            response_schema=PageScan,
        )

    try:
        result = await run_resiliently(
            _do,
            api_keys,
            span_name=f"assessment_scanner.pass1.page{page_index}",
            max_total_backoff_seconds=settings.max_total_backoff_seconds,
            per_call_timeout_seconds=_PASS1_PER_CALL_TIMEOUT_S,
        )
    except AISafetyBlockError:
        raise
    except Exception as exc:
        # Synthesise a minimal "unreadable" page so Pass 2 still gets a
        # valid structure -- failing the whole flow because one page
        # choked is too brittle. Matches the TS extractPage behaviour.
        log.warning(
            "assessment_scanner.pass1.page_failed",
            page_index=page_index,
            error=str(exc),
        )
        return PageScan(
            pageIndex=page_index,
            pageType="unreadable",
            handwritingConfidence=0.0,
            imageQualityIssues=["none"],
            detectedLanguage="unknown",
            questions=[],
        )

    text = _extract_text(result)
    try:
        page = PageScan.model_validate_json(text)
    except Exception as exc:
        log.warning(
            "assessment_scanner.pass1.json_parse_failed",
            page_index=page_index,
            raw_excerpt=text[:200],
            error=str(exc),
        )
        return PageScan(
            pageIndex=page_index,
            pageType="unreadable",
            handwritingConfidence=0.0,
            imageQualityIssues=["none"],
            detectedLanguage="unknown",
            questions=[],
        )
    # Pin the page index even if the model echoed a different value.
    return page.model_copy(update={"pageIndex": page_index})


# ---- PASS 2 -------------------------------------------------------------


def _default_ncert_context(payload: AssessmentScannerRequest) -> str:
    """Fallback when the TS dispatcher didn't ship NCERT context."""
    return (
        "(NCERT chapter context not provided by the dispatcher. "
        f"Grade against general knowledge of the {payload.subject} "
        f"{payload.gradeLevel} NCERT syllabus.)"
    )


async def _score_assessment(
    pages: list[PageScan],
    payload: AssessmentScannerRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> Pass2Output:
    family = resolve_subject_family(payload.subject)
    ncert_context = (
        payload.ncertContext
        if payload.ncertContext
        else _default_ncert_context(payload)
    )

    prompt = render_pass2_prompt({
        "subject": sanitize(payload.subject, max_length=100),
        "gradeLevel": sanitize(payload.gradeLevel, max_length=50),
        "language": sanitize(payload.language, max_length=20),
        # JSON-encode the extracted pages; the model will reason over
        # this structured blob.
        "extractedPages": json.dumps(
            [p.model_dump(mode="json") for p in pages],
            indent=2,
        ),
        "ncertContext": ncert_context,
        "teacherAnswerKeyText": sanitize_optional(
            payload.teacherAnswerKeyText, max_length=20000,
        ),
        "educationBoard": sanitize_optional(
            payload.educationBoard, max_length=100,
        ),
        "subjectRubric": rubric_for(family),
        "confidenceGuidance": confidence_guidance_for(family),
    })

    model = get_pass2_model()
    contents = genai_types.Content(
        role="user", parts=[genai_types.Part(text=prompt)],
    )

    async def _do(api_key: str) -> Any:
        return await _call_gemini_structured(
            api_key=api_key,
            model=model,
            contents=contents,
            response_schema=Pass2Output,
        )

    try:
        result = await run_resiliently(
            _do,
            api_keys,
            span_name=f"assessment_scanner.pass2.{family}",
            max_total_backoff_seconds=settings.max_total_backoff_seconds,
            per_call_timeout_seconds=_PASS2_PER_CALL_TIMEOUT_S,
        )
    except AISafetyBlockError:
        raise
    except Exception as exc:
        log.error(
            "assessment_scanner.pass2.failed",
            family=family,
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message="Pass-2 scoring failed",
            http_status=502,
        ) from exc

    text = _extract_text(result)
    try:
        return Pass2Output.model_validate_json(text)
    except Exception as exc:
        log.error(
            "assessment_scanner.pass2.json_parse_failed",
            raw_excerpt=text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message="Pass-2 returned text that does not match Pass2Output",
            http_status=502,
        ) from exc


# ---- Aggregation --------------------------------------------------------


def _image_quality_warnings(pages: list[PageScan]) -> list[str]:
    warnings: list[str] = []
    for p in pages:
        issues = [i for i in p.imageQualityIssues if i != "none"]
        if issues:
            warnings.append(f"Page {p.pageIndex + 1}: {', '.join(issues)}")
        if p.handwritingConfidence < 0.5:
            pct = int(p.handwritingConfidence * 100)
            warnings.append(
                f"Page {p.pageIndex + 1}: handwriting hard to read "
                f"(confidence {pct}%) -- consider re-shooting."
            )
    return warnings


def _aggregate(
    payload: AssessmentScannerRequest,
    pages: list[PageScan],
    pass2: Pass2Output,
    latency_ms: int,
) -> AssessmentScannerResponse:
    gradable = pass2.questions
    total_awarded = sum(q.marksAwarded for q in gradable)
    inferred_max = sum(q.marksMax for q in gradable)
    total_max = float(payload.totalMaxMarks) if payload.totalMaxMarks else inferred_max
    score_pct = (total_awarded / total_max * 100.0) if total_max > 0 else 0.0

    # Concept-mastery rollup by ncertChapterId. We don't have NCERT
    # chapter titles in the sidecar (they live in the TS data tree);
    # fall back to `conceptTested` as the title.
    by_chapter: dict[str, dict[str, float | str]] = {}
    for q in gradable:
        if not q.ncertChapterId:
            continue
        bucket = by_chapter.setdefault(
            q.ncertChapterId,
            {"earned": 0.0, "max": 0.0, "title": q.conceptTested},
        )
        bucket["earned"] = float(bucket["earned"]) + q.marksAwarded
        bucket["max"] = float(bucket["max"]) + q.marksMax

    concept_mastery: list[ConceptMastery] = []
    for chapter_id, v in by_chapter.items():
        earned = float(v["earned"])
        cap = float(v["max"])
        mastery_pct = (earned / cap * 100.0) if cap > 0 else 0.0
        concept_mastery.append(ConceptMastery(
            chapterId=chapter_id,
            chapterTitle=str(v["title"]),
            masteryPct=mastery_pct,
            weakestConcept=None,
        ))

    needs_review = sum(1 for q in gradable if q.needsTeacherReview)
    any_unreadable = any(p.pageType == "unreadable" for p in pages)
    status = (
        "failed" if not gradable
        else "partial" if any_unreadable
        else "graded"
    )

    return AssessmentScannerResponse(
        assessmentId=payload.assessmentId,
        status=status,
        pageCount=len(pages),
        totalAwardedMarks=total_awarded,
        totalMaxMarks=total_max,
        scorePct=score_pct,
        letterGrade=letter_grade_for(score_pct),
        questions=gradable,
        classAverageAtScan=None,
        conceptMastery=concept_mastery,
        recommendedNextSteps=list(pass2.recommendedNextSteps),
        studentRecommendations=list(pass2.studentRecommendations),
        needsReviewCount=needs_review,
        imageQualityWarnings=_image_quality_warnings(pages),
        teacherEditedAt=None,
        errorMessage=None,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        modelUsed=get_pass2_model(),
    )


# ---- Endpoint -----------------------------------------------------------


@assessment_scanner_router.post(
    "/grade", response_model=AssessmentScannerResponse,
)
async def grade_assessment(
    payload: AssessmentScannerRequest,
) -> AssessmentScannerResponse:
    settings = get_settings()
    api_keys = settings.genai_keys
    started = time.perf_counter()

    page_count = len(payload.pageUrls)

    # PASS 1 -- per-page extraction in parallel. `return_exceptions=True`
    # so one page raising `AssessmentPageUnreadableError` doesn't cancel
    # siblings; we surface the FIRST such error after the gather
    # completes (matching the TS Promise.allSettled hardening).
    pass1_results = await asyncio.gather(
        *[
            _extract_page(url, i, page_count, payload, api_keys, settings)
            for i, url in enumerate(payload.pageUrls)
        ],
        return_exceptions=True,
    )

    # If any page failed to fetch, surface that specifically.
    for r in pass1_results:
        if isinstance(r, AssessmentPageUnreadableError):
            raise r

    pages: list[PageScan] = []
    for i, r in enumerate(pass1_results):
        if isinstance(r, PageScan):
            pages.append(r)
        elif isinstance(r, AISafetyBlockError):
            raise r
        else:
            # Transient model/parse error on this page -- placeholder.
            pages.append(PageScan(
                pageIndex=i,
                pageType="unreadable",
                handwritingConfidence=0.0,
                imageQualityIssues=["none"],
                detectedLanguage="unknown",
                questions=[],
            ))

    # PASS 2 -- single scoring call.
    try:
        pass2 = await _score_assessment(pages, payload, api_keys, settings)
    except AISafetyBlockError as exc:
        log.warning("assessment_scanner.safety_block", reason=str(exc))
        raise

    # If every page came back unreadable AND Pass-2 produced no
    # gradable questions, the scan extracted nothing -- surface a
    # specific "re-upload clearer photos" error.
    all_unreadable = bool(pages) and all(
        p.pageType == "unreadable" for p in pages
    )
    if not pass2.questions and all_unreadable:
        log.error(
            "assessment_scanner.empty_extraction",
            user_id=payload.userId,
            assessment_id=payload.assessmentId,
            page_count=len(pages),
        )
        raise AssessmentEmptyExtractionError()

    latency_ms = int((time.perf_counter() - started) * 1000)
    response = _aggregate(payload, pages, pass2, latency_ms)

    log.info(
        "assessment_scanner.graded",
        latency_ms=latency_ms,
        page_count=page_count,
        question_count=len(pass2.questions),
        score_pct=response.scorePct,
        needs_review_count=response.needsReviewCount,
        status=response.status,
        model_used=get_pass2_model(),
    )
    return response


__all__ = ["assessment_scanner_router"]


# Avoid "imported but unused" on GradedQuestion -- it's referenced
# implicitly via Pass2Output.questions but keeping the explicit re-
# export here lets future test files import it from the router.
_ = GradedQuestion
