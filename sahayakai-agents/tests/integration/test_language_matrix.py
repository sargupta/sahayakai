"""Phase O.1 — language-parametrized matrix across all narrative agents.

Forensic finding C5: zero language-parametrized tests in the suite.
The user's "what breaks in Hindi?" review rule has been unenforced.
This file adds 11-language matrices on the 6 narrative agents
(instant-answer, parent-message, lesson-plan, parent-call, vidya,
virtual-field-trip) → 66 new tests.

Each test pops one fake response in the target language's native
script; the agent's behavioural guard
(`assert_script_matches_language`) runs end-to-end. A regression in
one language's Unicode range surfaces as a single failing parameter
(e.g. `language_matrix[ml]`) rather than a silent prod bug.
"""
from __future__ import annotations

import importlib
import json
import sys
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.agents.instant_answer import router as ia_router_mod
from sahayakai_agents.agents.lesson_plan import agent as lesson_plan_agent_mod
from sahayakai_agents.agents.parent_call import router as parent_call_router_module
from sahayakai_agents.agents.parent_message import router as pm_router_mod
from sahayakai_agents.agents.vidya import router as vidya_router_mod
from sahayakai_agents.agents.vidya.schemas import IntentClassification
from sahayakai_agents.agents.virtual_field_trip import router as vft_router_mod
from sahayakai_agents.main import app
from sahayakai_agents.shared.errors import AgentError
from tests.fixtures.parametrized_languages import (
    ALL_LANGUAGES,
    ISO_TO_BCP47,
    ISO_TO_PARENT_LANGUAGE_NAME,
    SAMPLE_SNIPPETS,
)

from ..unit.fake_firestore import make_fake_session_store

pytestmark = pytest.mark.integration


# ── sys.modules hygiene (mirrors test_lesson_plan_router.py) ─────────────


_SENTINEL: object = object()


@pytest.fixture(autouse=True)
def _restore_real_google_genai() -> None:
    """Force the real google.genai modules into sys.modules for this test.

    Other tests in the suite install SimpleNamespace shims at
    ``sys.modules["google.genai"]`` and never restore them. ADK's
    InMemoryRunner (used by the lesson-plan + vidya LoopAgent driver)
    loads ``google.adk.models.google_llm`` which does
    ``from google.genai.errors import ClientError`` at module-import
    time; that fails against a SimpleNamespace.
    """
    import google as _google_pkg  # noqa: PLC0415

    pre_keys = {
        key for key in sys.modules
        if key == "google.genai" or key.startswith("google.genai.")
    }
    pre_state = {key: sys.modules[key] for key in pre_keys}
    pre_genai_attr = getattr(_google_pkg, "genai", _SENTINEL)

    for key in pre_keys:
        del sys.modules[key]
    if hasattr(_google_pkg, "genai"):
        delattr(_google_pkg, "genai")

    importlib.import_module("google.genai")
    importlib.import_module("google.genai.errors")
    importlib.import_module("google.genai.types")
    try:
        yield
    finally:
        post_keys = {
            key for key in sys.modules
            if key == "google.genai" or key.startswith("google.genai.")
        }
        for key in post_keys:
            del sys.modules[key]
        for key, value in pre_state.items():
            sys.modules[key] = value
        if pre_genai_attr is _SENTINEL:
            if hasattr(_google_pkg, "genai"):
                delattr(_google_pkg, "genai")
        else:
            _google_pkg.genai = pre_genai_attr  # type: ignore[attr-defined]


# ── Shared fake plumbing ─────────────────────────────────────────────────


class _FakeUsageMeta:
    input_tokens = 800
    output_tokens = 200
    total_tokens = 1000
    cached_content_tokens = 0


class _FakeGroundingMetadata:
    grounding_chunks: list[Any] = []


class _FakeCandidate:
    def __init__(self, with_grounding: bool) -> None:
        self.grounding_metadata = (
            _FakeGroundingMetadata() if with_grounding else None
        )


class _FakeResult:
    def __init__(self, text: str, with_grounding: bool = False) -> None:
        self.text = text
        self.usage_metadata = _FakeUsageMeta()
        self.candidates: list[Any] = [_FakeCandidate(with_grounding)]


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# =============================================================================
# 1. Instant-answer language matrix (11 tests)
# =============================================================================


class _IAQueueFake:
    def __init__(self) -> None:
        self.queue: list[tuple[str, bool]] = []

    async def generate_content(self, **_kwargs: Any) -> _FakeResult:
        if not self.queue:
            raise AssertionError("IA fake exhausted")
        text, grounded = self.queue.pop(0)
        return _FakeResult(text, grounded)


class _IAFakeAio:
    def __init__(self, models: _IAQueueFake) -> None:
        self.models = models


class _IAFakeClient:
    def __init__(self, models: _IAQueueFake) -> None:
        self.aio = _IAFakeAio(models)
        self.models = models


@pytest.fixture
def fake_ia_genai(monkeypatch: pytest.MonkeyPatch) -> _IAQueueFake:
    """Patch IA's `_call_gemini_grounded` directly. Avoids the sys.modules
    shim which breaks google.genai's internal `_transformers` imports
    when this file imports many production modules eagerly."""
    models = _IAQueueFake()

    async def _fake_call(*, api_key: str, model: str, prompt: str) -> _FakeResult:
        if not models.queue:
            raise AssertionError("IA fake exhausted")
        text, grounded = models.queue.pop(0)
        return _FakeResult(text, grounded)

    monkeypatch.setattr(
        ia_router_mod, "_call_gemini_grounded", _fake_call,
    )
    return models


_IA_BASE_REQUEST: dict[str, Any] = {
    "question": "What is photosynthesis?",
    "language": "en",
    "gradeLevel": "Class 5",
    "subject": "Science",
    "userId": "teacher-uid-1",
}


@pytest.mark.parametrize("language", ALL_LANGUAGES)
def test_instant_answer_language_matrix(
    client: TestClient,
    fake_ia_genai: _IAQueueFake,
    language: str,
) -> None:
    """Phase O.1 — instant-answer happy path across all 11 languages."""
    snippet = SAMPLE_SNIPPETS[language]
    fake_ia_genai.queue = [(json.dumps({
        "answer": snippet,
        "videoSuggestionUrl": None,
        "gradeLevel": "Class 5",
        "subject": "Science",
    }), False)]
    request = {**_IA_BASE_REQUEST, "language": language}
    res = client.post("/v1/instant-answer/answer", json=request)
    assert res.status_code == 200, (
        f"language={language!r} failed: {res.status_code} {res.text}"
    )
    body = res.json()
    assert snippet[:8] in body["answer"], (
        f"language={language!r}: response text drifted"
    )
    assert fake_ia_genai.queue == []


# =============================================================================
# 2. Parent-message language matrix (11 tests)
# =============================================================================


class _PMQueueFake:
    def __init__(self) -> None:
        self.queue: list[str] = []

    async def generate_content(self, **_kwargs: Any) -> _FakeResult:
        if not self.queue:
            raise AssertionError("PM fake exhausted")
        return _FakeResult(self.queue.pop(0))


class _PMFakeAio:
    def __init__(self, models: _PMQueueFake) -> None:
        self.models = models


class _PMFakeClient:
    def __init__(self, models: _PMQueueFake) -> None:
        self.aio = _PMFakeAio(models)
        self.models = models


@pytest.fixture
def fake_pm_genai(monkeypatch: pytest.MonkeyPatch) -> _PMQueueFake:
    """Patch PM's `_call_gemini_structured` directly. Avoids the sys.modules
    shim which breaks google.genai's internal `_transformers` imports."""
    models = _PMQueueFake()

    async def _fake_call(
        *, api_key: str, model: str, prompt: str, response_schema: type,
    ) -> _FakeResult:
        if not models.queue:
            raise AssertionError("PM fake exhausted")
        return _FakeResult(models.queue.pop(0))

    monkeypatch.setattr(
        pm_router_mod, "_call_gemini_structured", _fake_call,
    )
    return models


_PM_BASE_REQUEST: dict[str, Any] = {
    "studentName": "Arav",
    "className": "Class 5",
    "subject": "Mathematics",
    "reason": "consecutive_absences",
    "parentLanguage": "English",
    "consecutiveAbsentDays": 4,
    "teacherName": "Mrs. Sharma",
    "schoolName": "Sunrise Public",
    "userId": "teacher-uid-1",
}


# Per-language ≥15-word messages. The PARENT_MESSAGE_MIN_WORDS guard
# rejects anything shorter.
_PM_MESSAGES: dict[str, str] = {
    "en": (
        "Dear parent. I hope you are well. I wanted to share a brief "
        "update about your child's attendance and progress this week. "
        "We have noticed some changes and would love to discuss them "
        "with you. Please share a convenient time. Warm regards, "
        "Mrs. Sharma."
    ),
    "hi": (
        "नमस्कार। मैं आपके बच्चे की पढ़ाई और उपस्थिति के बारे में एक "
        "छोटा संदेश साझा करना चाहती हूँ। हमने इस सप्ताह कुछ बदलाव "
        "देखे हैं और हम उन पर आपसे बात करना चाहेंगे। कृपया एक उपयुक्त "
        "समय बताइए। आपकी सहयोगी श्रीमती शर्मा।"
    ),
    "ta": (
        "வணக்கம். உங்கள் குழந்தையின் வருகை மற்றும் கற்றல் முன்னேற்றம் "
        "குறித்து சில குறிப்புகளை பகிர விரும்புகிறேன். இந்த வாரம் சில "
        "மாற்றங்களை நாங்கள் கவனித்துள்ளோம் உங்களுடன் பேச விரும்புகிறேன் "
        "தயவுசெய்து உங்களுக்கு வசதியான நேரத்தை தெரிவிக்கவும். "
        "அன்புடன் ஶர்மா மேடம்."
    ),
    "te": (
        "నమస్కారం. మీ పిల్లల హాజరు మరియు చదువు పురోగతి గురించి కొన్ని "
        "విషయాలు పంచుకోవాలనుకుంటున్నాను. ఈ వారం మేము కొన్ని మార్పులు "
        "గమనించాము వాటి గురించి మీతో మాట్లాడాలనుకుంటున్నాను. దయచేసి "
        "మీకు అనుకూలమైన సమయం తెలియజేయండి. ఆత్మీయంగా శర్మ గారు."
    ),
    "kn": (
        "ನಮಸ್ಕಾರ. ನಿಮ್ಮ ಮಗುವಿನ ಹಾಜರಾತಿ ಮತ್ತು ಕಲಿಕೆಯ ಪ್ರಗತಿಯ ಬಗ್ಗೆ "
        "ಕೆಲವು ವಿಷಯಗಳನ್ನು ಹಂಚಿಕೊಳ್ಳಲು ಬಯಸುತ್ತೇನೆ. ಈ ವಾರ ನಾವು "
        "ಕೆಲವು ಬದಲಾವಣೆಗಳನ್ನು ಗಮನಿಸಿದ್ದೇವೆ ಅವುಗಳ ಬಗ್ಗೆ ನಿಮ್ಮೊಂದಿಗೆ "
        "ಮಾತನಾಡಲು ಬಯಸುತ್ತೇನೆ. ದಯವಿಟ್ಟು ನಿಮಗೆ ಅನುಕೂಲಕರ ಸಮಯವನ್ನು "
        "ತಿಳಿಸಿ. ಪ್ರೀತಿಯಿಂದ ಶರ್ಮಾ."
    ),
    "bn": (
        "নমস্কার। আপনার সন্তানের উপস্থিতি এবং পড়াশোনার অগ্রগতি "
        "সম্পর্কে কিছু কথা ভাগ করে নিতে চাইছি। এই সপ্তাহে আমরা কিছু "
        "পরিবর্তন লক্ষ্য করেছি এবং আপনার সঙ্গে সেই বিষয়ে কথা বলতে "
        "চাই। দয়া করে আপনার সুবিধাজনক সময় জানান। আন্তরিক "
        "শুভেচ্ছায় শর্মা ম্যাডাম।"
    ),
    "mr": (
        "नमस्कार। आपल्या मुलाच्या उपस्थिती आणि प्रगतीबद्दल थोडक्यात "
        "माहिती सामायिक करू इच्छिते. या आठवड्यात आम्ही काही बदल "
        "लक्षात घेतले आहेत आणि आपल्याशी त्याबद्दल बोलू इच्छितो. "
        "कृपया आपल्याला सोयीस्कर वेळ सांगा. आपुलकीने श्रीमती शर्मा."
    ),
    "gu": (
        "નમસ્કાર. તમારા બાળકની હાજરી અને અભ્યાસ પ્રગતિ વિશે થોડી "
        "વાત જણાવવા માંગુ છું. આ અઠવાડિયામાં અમે કેટલાક ફેરફાર "
        "નોંધ્યા છે અને તેના વિશે તમારી સાથે વાત કરવા માંગુ છું. "
        "કૃપા કરીને તમને અનુકૂળ સમય જણાવો. પ્રેમપૂર્વક શ્રીમતી શર્મા."
    ),
    "pa": (
        "ਨਮਸਕਾਰ। ਤੁਹਾਡੇ ਬੱਚੇ ਦੀ ਹਾਜ਼ਰੀ ਅਤੇ ਪੜ੍ਹਾਈ ਦੀ ਪ੍ਰਗਤੀ ਬਾਰੇ "
        "ਕੁਝ ਜਾਣਕਾਰੀ ਸਾਂਝੀ ਕਰਨੀ ਚਾਹੁੰਦੀ ਹਾਂ। ਇਸ ਹਫ਼ਤੇ ਅਸੀਂ ਕੁਝ "
        "ਤਬਦੀਲੀਆਂ ਦੇਖੀਆਂ ਹਨ ਅਤੇ ਉਨ੍ਹਾਂ ਬਾਰੇ ਤੁਹਾਡੇ ਨਾਲ ਗੱਲ ਕਰਨੀ "
        "ਚਾਹੁੰਦੀ ਹਾਂ। ਕਿਰਪਾ ਕਰਕੇ ਤੁਹਾਡੇ ਲਈ ਸਹੂਲਤ ਵਾਲਾ ਸਮਾਂ "
        "ਦੱਸੋ। ਸਨੇਹ ਨਾਲ ਸ਼ਰਮਾ ਮੈਡਮ।"
    ),
    "ml": (
        "നമസ്കാരം. നിങ്ങളുടെ കുട്ടിയുടെ ഹാജരിനെയും പഠന "
        "പുരോഗതിയെയും കുറിച്ച് കുറച്ച് വിവരങ്ങൾ പങ്കിടാൻ "
        "ആഗ്രഹിക്കുന്നു. ഈ ആഴ്ച ഞങ്ങൾ ചില മാറ്റങ്ങൾ ശ്രദ്ധിച്ചു "
        "നിങ്ങളുമായി അവയെക്കുറിച്ച് സംസാരിക്കാൻ ആഗ്രഹിക്കുന്നു. "
        "ദയവായി നിങ്ങൾക്ക് സൗകര്യപ്രദമായ സമയം അറിയിക്കുക. "
        "സ്നേഹപൂർവ്വം ശർമ്മ ടീച്ചർ."
    ),
    "or": (
        "ନମସ୍କାର। ଆପଣଙ୍କ ଶିଶୁର ଉପସ୍ଥିତି ଏବଂ ଶିକ୍ଷା ଅଗ୍ରଗତି ବିଷୟରେ "
        "କିଛି କଥା ସେୟାର କରିବାକୁ ଚାହୁଁଛି। ଏହି ସପ୍ତାହରେ ଆମେ କିଛି "
        "ପରିବର୍ତ୍ତନ ଲକ୍ଷ୍ୟ କରିଛୁ ଏବଂ ସେ ବିଷୟରେ ଆପଣଙ୍କ ସହ ଆଲୋଚନା "
        "କରିବାକୁ ଚାହୁଁଛି। ଦୟାକରି ଆପଣଙ୍କୁ ସୁବିଧାଜନକ ସମୟ ଜଣାନ୍ତୁ। "
        "ସ୍ନେହପୂର୍ବକ ଶ୍ରୀମତୀ ଶର୍ମା।"
    ),
}


@pytest.mark.parametrize("language", ALL_LANGUAGES)
def test_parent_message_language_matrix(
    client: TestClient,
    fake_pm_genai: _PMQueueFake,
    language: str,
) -> None:
    """Phase O.1 — parent-message happy path across all 11 languages.

    The router overwrites `languageCode` from the canonical BCP-47
    map regardless of what the model returns; pin parity.
    """
    message = _PM_MESSAGES[language]
    word_count = len(message.split())
    fake_pm_genai.queue = [json.dumps({
        "message": message,
        "languageCode": "XX-YY",
        "wordCount": word_count,
    })]
    request = {
        **_PM_BASE_REQUEST,
        "parentLanguage": ISO_TO_PARENT_LANGUAGE_NAME[language],
    }
    res = client.post("/v1/parent-message/generate", json=request)
    assert res.status_code == 200, (
        f"language={language!r} failed: {res.status_code} {res.text}"
    )
    body = res.json()
    assert body["languageCode"] == ISO_TO_BCP47[language]
    assert body["wordCount"] >= 15
    assert fake_pm_genai.queue == []


# =============================================================================
# 3. Lesson-plan language matrix (11 tests)
# =============================================================================


class _LPQueueFake:
    def __init__(self) -> None:
        self.queue: list[str] = []

    def pop(self) -> str:
        if not self.queue:
            raise AssertionError("LP fake exhausted")
        return self.queue.pop(0)


@pytest.fixture
def fake_lp_genai(monkeypatch: pytest.MonkeyPatch) -> _LPQueueFake:
    fake = _LPQueueFake()

    async def _fake_call(
        *, api_key: str, model: str, prompt: str, response_schema: type,
    ) -> _FakeResult:
        return _FakeResult(fake.pop())

    monkeypatch.setattr(
        lesson_plan_agent_mod, "_call_gemini_structured", _fake_call,
    )
    return fake


def _verdict_json(safety: bool = True) -> str:
    return json.dumps({
        "scores": {
            "grade_level_alignment": 0.9,
            "objective_assessment_match": 0.9,
            "resource_level_realism": 0.9,
            "language_naturalness": 0.9,
            "scaffolding_present": 0.9,
            "inclusion_signals": 0.9,
            "cultural_appropriateness": 0.9,
        },
        "safety": safety,
        "rationale": "auto-generated test verdict",
        "fail_reasons": [],
    })


def _multilang_plan_json(language: str) -> str:
    """Build a `LessonPlanCore` JSON whose script-bound fields are
    in `language`'s native script. The post-orchestration guard
    concatenates and runs script-match at 85% threshold; we pad each
    field via repetition so the alpha-char ratio clears 85% AND the
    total word count clears the 200-word lesson-plan floor.
    """
    snippet = SAMPLE_SNIPPETS[language]
    long_text = " ".join([snippet] * 4)
    objectives = [snippet] * 5
    activities: list[dict[str, Any]] = []
    for phase in ("Engage", "Explore", "Explain", "Elaborate", "Evaluate"):
        activities.append({
            "phase": phase,
            "name": snippet[:80],
            "description": long_text,
            "duration": "10 minutes",
            "teacherTips": None,
            "understandingCheck": None,
        })
    return json.dumps({
        "title": snippet[:60],
        "gradeLevel": "Class 5",
        "duration": "45 minutes",
        "subject": "Science",
        "objectives": objectives,
        "keyVocabulary": None,
        "materials": [snippet[:50]] * 3,
        "activities": activities,
        "assessment": long_text,
        "homework": long_text,
        "language": language,
    })


_LP_BASE_REQUEST: dict[str, Any] = {
    "topic": "Photosynthesis",
    "language": "en",
    "gradeLevels": ["Class 5"],
    "useRuralContext": False,
    "resourceLevel": "low",
    "userId": "teacher-uid-1",
}


@pytest.mark.parametrize("language", ALL_LANGUAGES)
def test_lesson_plan_language_matrix(
    client: TestClient,
    fake_lp_genai: _LPQueueFake,
    language: str,
) -> None:
    """Phase O.1 — lesson-plan happy path across all 11 languages."""
    fake_lp_genai.queue = [
        _multilang_plan_json(language),
        _verdict_json(safety=True),
    ]
    request = {**_LP_BASE_REQUEST, "language": language}
    res = client.post("/v1/lesson-plan/generate", json=request)
    assert res.status_code == 200, (
        f"language={language!r} failed: {res.status_code} {res.text}"
    )
    body = res.json()
    assert body["revisionsRun"] == 0
    assert body["rubric"]["safety"] is True
    assert fake_lp_genai.queue == []


# =============================================================================
# 4. Parent-call language matrix (11 tests)
# =============================================================================


class _PCFakeAioModels:
    def __init__(self, text: str) -> None:
        self._text = text

    async def generate_content(self, **_kwargs: Any) -> _FakeResult:
        return _FakeResult(self._text)


class _PCFakeAio:
    def __init__(self, text: str) -> None:
        self.models = _PCFakeAioModels(text)


class _PCFakeClient:
    def __init__(self, text: str) -> None:
        self.aio = _PCFakeAio(text)
        self.models = _PCFakeAioModels(text)


def _pc_patch_gemini(
    monkeypatch: pytest.MonkeyPatch, reply_json: dict[str, Any],
) -> None:
    """Patch parent-call's `_call_gemini_structured` directly.

    Avoids the `sys.modules["google.genai"] = _FakeGenai()` shim that
    breaks google.genai's internal `from . import _transformers as t`
    imports when this file already loaded other modules eagerly.
    """
    fake_text = json.dumps(reply_json)

    async def _fake_call(
        *, api_key: str, model: str, prompt: str, response_schema: type,
    ) -> _FakeResult:
        return _FakeResult(fake_text)

    monkeypatch.setattr(
        parent_call_router_module, "_call_gemini_structured", _fake_call,
    )


def _pc_patch_session_store(monkeypatch: pytest.MonkeyPatch) -> None:
    store = make_fake_session_store()

    async def _mark_ended(call_sid: str, duration_seconds: float | None = None) -> None:
        store._sync_mark_ended(call_sid, duration_seconds)  # type: ignore[attr-defined]

    store.mark_ended = _mark_ended  # type: ignore[assignment]

    async def _append_turn(turn: Any) -> None:
        store._sync_append_turn(turn)  # type: ignore[attr-defined]

    store.append_turn = _append_turn  # type: ignore[assignment]

    async def _load(_call_sid: str) -> list[Any]:
        return []

    store.load_transcript = _load  # type: ignore[assignment]

    monkeypatch.setattr(parent_call_router_module, "_get_session_store", lambda: store)
    monkeypatch.setattr(parent_call_router_module, "_session_store", store, raising=False)


# Per-language short conversational replies. Parent-call replies are
# 1-5 sentences (`assert_sentence_count_in_range`).
_PC_REPLIES: dict[str, str] = {
    "en": "Thank you. We will follow up if there are any issues.",
    "hi": "धन्यवाद। हम जरूर संपर्क करेंगे।",
    "ta": "நன்றி. நாங்கள் தொடர்பு கொள்வோம்.",
    "te": "ధన్యవాదాలు. మేము ఖచ్చితంగా సంప్రదిస్తాము.",
    "kn": "ಧನ್ಯವಾದಗಳು. ನಾವು ಖಂಡಿತ ಸಂಪರ್ಕಿಸುತ್ತೇವೆ.",
    "bn": "ধন্যবাদ। আমরা অবশ্যই যোগাযোগ করব।",
    "mr": "धन्यवाद। आम्ही नक्की संपर्क साधू.",
    "gu": "આભાર. અમે ચોક્કસ સંપર્ક કરીશું.",
    "pa": "ਧੰਨਵਾਦ। ਅਸੀਂ ਜ਼ਰੂਰ ਸੰਪਰਕ ਕਰਾਂਗੇ।",
    "ml": "നന്ദി. ഞങ്ങൾ തീർച്ചയായും ബന്ധപ്പെടും.",
    "or": "ଧନ୍ୟବାଦ। ଆମେ ନିଶ୍ଚୟ ଯୋଗାଯୋଗ କରିବୁ।",
}

assert set(_PC_REPLIES) == set(SAMPLE_SNIPPETS)


def _pc_base_request() -> dict[str, Any]:
    return {
        "callSid": "CAxxx",
        "turnNumber": 1,
        "studentName": "Arav",
        "className": "Class 5",
        "subject": "Science",
        "reason": "Homework follow-up",
        "teacherMessage": "Please ensure homework is done daily.",
        "parentLanguage": "en",
        "parentSpeech": "Yes, I will check.",
    }


@pytest.mark.parametrize("language", ALL_LANGUAGES)
def test_parent_call_language_matrix(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    language: str,
) -> None:
    """Phase O.1 — parent-call happy path across all 11 languages."""
    _pc_patch_gemini(monkeypatch, {
        "reply": _PC_REPLIES[language],
        "shouldEndCall": False,
        "followUpQuestion": None,
    })
    _pc_patch_session_store(monkeypatch)

    request = _pc_base_request()
    request["parentLanguage"] = language
    # Unique callSid per parameter to avoid OCC conflicts when the
    # parametrized scenarios share state.
    request["callSid"] = f"CAtest_{language}"
    res = client.post("/v1/parent-call/reply", json=request)
    assert res.status_code == 200, (
        f"language={language!r} failed: {res.status_code} {res.text}"
    )
    body = res.json()
    assert body["reply"] == _PC_REPLIES[language]
    assert body["shouldEndCall"] is False


# =============================================================================
# 5. VIDYA language matrix (11 tests)
# =============================================================================


class _VidyaQueueFake:
    def __init__(self) -> None:
        self.queue: list[str] = []

    def pop(self) -> str:
        if not self.queue:
            raise AssertionError("Vidya fake exhausted")
        return self.queue.pop(0)


@pytest.fixture
def fake_vidya_genai(monkeypatch: pytest.MonkeyPatch) -> _VidyaQueueFake:
    """Patch BOTH the classifier path AND the instant-answer delegation
    helper that VIDYA's instantAnswer branch invokes. Avoids the
    sys.modules shim that fights google.genai's `_transformers` import."""
    fake = _VidyaQueueFake()

    async def _fake_runner(
        *, prompt: str, api_key: str,
    ) -> IntentClassification:
        text = fake.pop()
        try:
            return IntentClassification.model_validate_json(text)
        except Exception as exc:
            raise AgentError(
                code="INTERNAL",
                message="Orchestrator returned text that does not match",
                http_status=502,
            ) from exc

    monkeypatch.setattr(
        vidya_router_mod, "_run_orchestrator_via_runner", _fake_runner,
    )

    # The instant-answer sub-call is invoked via `run_answerer` →
    # `_call_gemini_grounded`. Patching the latter on the IA module
    # makes the second queue pop flow through cleanly.
    async def _fake_grounded(
        *, api_key: str, model: str, prompt: str,
    ) -> _FakeResult:
        return _FakeResult(fake.pop(), with_grounding=False)

    monkeypatch.setattr(
        ia_router_mod, "_call_gemini_grounded", _fake_grounded,
    )

    return fake


_VIDYA_BASE_REQUEST: dict[str, Any] = {
    "message": "what is photosynthesis",
    "chatHistory": [],
    "currentScreenContext": {"path": "/dashboard", "uiState": None},
    "teacherProfile": {
        "preferredGrade": "Class 5",
        "preferredSubject": "Science",
        "preferredLanguage": "en",
        "schoolContext": "rural government school",
    },
    "detectedLanguage": "en",
    "userId": "teacher-uid-1",
}


def _vidya_classify_json(intent_type: str, language: str) -> str:
    return json.dumps({
        "type": intent_type,
        "topic": None,
        "gradeLevel": None,
        "subject": None,
        "language": language,
        "plannedActions": [],
    })


@pytest.mark.parametrize("language", ALL_LANGUAGES)
def test_vidya_language_matrix(
    client: TestClient,
    fake_vidya_genai: _VidyaQueueFake,
    language: str,
) -> None:
    """Phase O.1 — VIDYA instantAnswer path across all 11 languages.

    The instantAnswer path uses the response text in the target
    language, runs through the behavioural guard with
    `payload.detectedLanguage` as the script-match basis. Routable-
    action paths use a hardcoded English ack and 502 on non-English
    (covered by `test_quiz_generator_intent_in_hindi`).
    """
    snippet = SAMPLE_SNIPPETS[language]
    fake_vidya_genai.queue = [
        _vidya_classify_json("instantAnswer", language),
        json.dumps({
            "answer": snippet,
            "videoSuggestionUrl": None,
            "gradeLevel": "Class 5",
            "subject": "Science",
        }),
    ]
    request = {
        **_VIDYA_BASE_REQUEST,
        "message": snippet,
        "detectedLanguage": language,
    }
    res = client.post("/v1/vidya/orchestrate", json=request)
    assert res.status_code == 200, (
        f"language={language!r} failed: {res.status_code} {res.text}"
    )
    body = res.json()
    assert body["intent"] == "instantAnswer"
    assert body["action"] is None
    assert snippet[:8] in body["response"], (
        f"language={language!r}: response text drifted"
    )
    assert fake_vidya_genai.queue == []


# =============================================================================
# 6. Virtual-field-trip language matrix (11 tests)
# =============================================================================


class _VFTQueueFake:
    def __init__(self) -> None:
        self.queue: list[str] = []

    async def generate_content(self, **_kwargs: Any) -> _FakeResult:
        if not self.queue:
            raise AssertionError("VFT fake exhausted")
        return _FakeResult(self.queue.pop(0))


class _VFTFakeAio:
    def __init__(self, models: _VFTQueueFake) -> None:
        self.models = models


class _VFTFakeClient:
    def __init__(self, models: _VFTQueueFake) -> None:
        self.aio = _VFTFakeAio(models)
        self.models = models


@pytest.fixture
def fake_vft_genai(monkeypatch: pytest.MonkeyPatch) -> _VFTQueueFake:
    """Patch the agent module's `_call_gemini_structured` helper directly.

    This avoids the `sys.modules["google.genai"] = _FakeGenai()` shim
    pattern which blows up against ADK's eager `_transformers` import.
    """
    models = _VFTQueueFake()

    async def _fake_call(
        *, api_key: str, model: str, prompt: str, response_schema: type,
    ) -> _FakeResult:
        if not models.queue:
            raise AssertionError("VFT fake exhausted")
        return _FakeResult(models.queue.pop(0))

    monkeypatch.setattr(
        vft_router_mod, "_call_gemini_structured", _fake_call,
    )
    return models


def _multilang_trip_json(language: str) -> str:
    """Build a VirtualFieldTripCore JSON in `language`'s native script."""
    snippet = SAMPLE_SNIPPETS[language]
    long_text = " ".join([snippet] * 3)
    stops = []
    for label in ("Stop One", "Stop Two", "Stop Three", "Stop Four"):
        stops.append({
            "name": snippet[:60] + " " + label,
            "description": long_text,
            "educationalFact": long_text,
            "reflectionPrompt": snippet,
            "googleEarthUrl": (
                f"https://earth.google.com/web/search/{label.replace(' ', '+')}"
            ),
            "culturalAnalogy": snippet,
            "explanation": long_text,
        })
    return json.dumps({
        "title": snippet[:60] + " — Field Trip",
        "stops": stops,
        "gradeLevel": "Class 6",
        "subject": "Geography",
    })


_VFT_BASE_REQUEST: dict[str, Any] = {
    "topic": "Volcanoes of the world for class 6",
    "language": "English",
    "gradeLevel": "Class 6",
    "userId": "teacher-uid-1",
}


@pytest.mark.parametrize("language", ALL_LANGUAGES)
def test_virtual_field_trip_language_matrix(
    client: TestClient,
    fake_vft_genai: _VFTQueueFake,
    language: str,
) -> None:
    """Phase O.1 — virtual-field-trip happy path across all 11 languages."""
    fake_vft_genai.queue = [_multilang_trip_json(language)]
    request = {
        **_VFT_BASE_REQUEST,
        "language": ISO_TO_PARENT_LANGUAGE_NAME[language],
    }
    res = client.post("/v1/virtual-field-trip/plan", json=request)
    assert res.status_code == 200, (
        f"language={language!r} failed: {res.status_code} {res.text}"
    )
    body = res.json()
    assert len(body["stops"]) == 4
    assert fake_vft_genai.queue == []
