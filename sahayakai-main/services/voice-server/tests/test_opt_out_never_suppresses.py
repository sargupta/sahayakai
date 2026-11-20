"""CLASS GATE — the engine never blocks a number; a stop request only reaches the teacher.

Independent re-review rereview-0b (#1, #2, #3, #5, #6): the spoken yes/no
confirmation wrote a PERMANENT call_suppressions record for "yes, call me",
"yes, tomorrow evening", a backchannel heard during the question, and (under
the web test override) for the real parent's number, while natural yeses such
as "yes, please don't call" were dropped. Decision: the engine never writes
call_suppressions. A possible stop is recorded on the outreach as
`optOutRequested: {quote, at, source}`, the teacher's summary leads with the
parent's own words, and the parent hears one honest line ("I will let the
class teacher know you would prefer not to receive these calls").

The class is "an engine code path that can write call_suppressions". The gate:
  * structurally, over every module in src/: nothing outside the kept,
    unused definitions references the suppression writer, the digest, the
    record or the collection, and every Firestore collection the engine names
    resolves to one that is not call_suppressions. Self-tests prove the
    checker rejects each way back;
  * behaviourally, through the real Vobiz handler: every phrase sequence in
    the review's lists (#1 to #6, and the earlier false-stop lists), in every
    language, produces at most one optOutRequested record and never a
    suppression (persist_opt_out is spied too and must never run);
  * a true stop, in each of the ten call languages, produces the record
    (source "live"), the summary note quoting the parent, and the fixed line,
    never "we will not call you again";
  * the post-call analysis records source "analysis" and never suppresses.
"""

from __future__ import annotations

import ast
import asyncio
import re
from collections import defaultdict
from pathlib import Path

import pytest

from bot_harness import (
    RECORDER,
    FakeAsyncFirestore,
    FakeCallStore,
    FrameDirection,
    ScriptedRunner,
    TranscriptionFrame,
    TTSSpeakFrame,
    build_bot,
    import_main,
    run_from_recorder,
    run_vobiz_path,
    stubbed_runtime,
)
from main_ast import RECORD, opt_out_requests, suppressions
from src.call_policy import LANGUAGE_CODES, LANGUAGE_NAMES, load_call_lines
from src.opt_out import is_stop_request

SRC = Path(__file__).resolve().parents[1] / "src"
OID = "OutreachFs0000000001"
SUPPRESSION = "call_suppressions"

# ── structural ───────────────────────────────────────────────────────────────

# Kept in opt_out.py, unused, for a later designed feature. Only their own
# bodies may touch the suppression; nothing may reference them.
KEPT_DEFINITIONS = {"persist_opt_out", "suppression_record", "phone_suppression_id"}
FORBIDDEN_NAMES = KEPT_DEFINITIONS | {"SUPPRESSION_COLLECTION", "persist_opt_out_firestore"}


def _engine_sources() -> dict[str, str]:
    return {str(p.relative_to(SRC)): p.read_text(encoding="utf-8") for p in sorted(SRC.rglob("*.py"))}


def suppression_paths(sources: dict[str, str]) -> list[str]:
    """Every place engine code could reach call_suppressions."""
    trees = {name: ast.parse(src) for name, src in sources.items()}
    constants: dict[str, set[str]] = defaultdict(set)
    for tree in trees.values():
        for node in tree.body:
            if isinstance(node, (ast.Assign, ast.AnnAssign)) and isinstance(node.value, ast.Constant) \
                    and isinstance(node.value.value, str):
                for t in (node.targets if isinstance(node, ast.Assign) else [node.target]):
                    if isinstance(t, ast.Name):
                        constants[t.id].add(node.value.value)

    def resolve(arg: ast.AST | None) -> set[str] | None:
        if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
            return {arg.value}
        if isinstance(arg, ast.Name):
            return constants.get(arg.id) or None
        if isinstance(arg, ast.Attribute):
            return constants.get(arg.attr) or None
        return None

    problems: list[str] = []
    for name, tree in trees.items():
        allowed: set[int] = set()
        if name == "opt_out.py":
            for node in tree.body:
                kept_fn = isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in KEPT_DEFINITIONS
                kept_const = isinstance(node, ast.Assign) and any(
                    isinstance(t, ast.Name) and t.id == "SUPPRESSION_COLLECTION" for t in node.targets)
                if kept_fn or kept_const:
                    allowed.update(id(n) for n in ast.walk(node))
        for node in ast.walk(tree):
            if id(node) in allowed:
                continue
            where = f"{name}:{getattr(node, 'lineno', '?')}"
            if isinstance(node, ast.Name) and node.id in FORBIDDEN_NAMES:
                problems.append(f"{where}: references {node.id}")
            elif isinstance(node, ast.Attribute) and node.attr in FORBIDDEN_NAMES:
                problems.append(f"{where}: references .{node.attr}")
            elif isinstance(node, ast.alias) and node.name.split(".")[-1] in FORBIDDEN_NAMES:
                problems.append(f"{where}: imports {node.name}")
            elif isinstance(node, ast.Constant) and node.value == SUPPRESSION:
                problems.append(f"{where}: names the {SUPPRESSION} collection")
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "collection":
                values = resolve(node.args[0] if node.args else None)
                if values is None:
                    problems.append(f"{where}: collection({ast.unparse(node.args[0]) if node.args else ''}) "
                                    "cannot be resolved to a known collection")
                elif any(SUPPRESSION in v for v in values):
                    problems.append(f"{where}: writes to {SUPPRESSION}")
    return problems


def test_no_engine_code_path_can_reach_call_suppressions():
    assert suppression_paths(_engine_sources()) == []


def test_the_checker_resolves_every_collection_the_engine_uses():
    """Guards against the gate passing because it saw no collection calls at all."""
    sources = _engine_sources()
    calls = [n for src in sources.values() for n in ast.walk(ast.parse(src))
             if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == "collection"]
    assert len(calls) >= 4


def _with(sources: dict[str, str], name: str, old: str, new: str) -> dict[str, str]:
    assert old in sources[name], (name, old)
    return {**sources, name: sources[name].replace(old, new, 1)}


WAYS_BACK = {
    "bot calls the kept writer": ("bot.py", "import asyncio\n",
                                  "import asyncio\nfrom src.opt_out import persist_opt_out\n"),
    "vobiz wraps it again": ("vobiz.py", "async def read_dial_attempt_firestore(",
                             "async def _p(o, p):\n    from src import opt_out\n"
                             "    return await opt_out.persist_opt_out(_db(p), o)\n\n\n"
                             "async def read_dial_attempt_firestore("),
    "a literal collection": ("vobiz.py", '.collection("parent_outreach").document(outreach_id).set(',
                             '.collection("call_suppressions").document(outreach_id).set('),
    "a renamed constant": ("stream_tokens.py", 'CONSUMED_COLLECTION = "vobiz_stream_tokens"',
                           'CONSUMED_COLLECTION = "call_" "suppressions"'),
    "a computed name": ("stream_tokens.py", "db.collection(CONSUMED_COLLECTION)",
                        'db.collection("call_" + kind)'),
    "the record path calls the writer": ("opt_out.py", "    now = now or utc_now_iso()\n    try:\n        fields",
                                         "    now = now or utc_now_iso()\n    await persist_opt_out(db, outreach_id)\n"
                                         "    try:\n        fields"),
}


@pytest.mark.parametrize("way", sorted(WAYS_BACK))
def test_the_checker_rejects_each_way_back(way):
    name, old, new = WAYS_BACK[way]
    assert suppression_paths(_with(_engine_sources(), name, old, new)), way


def test_the_checker_rejects_an_unresolvable_collection():
    bad = _with(_engine_sources(), "vobiz.py", '.collection("parent_outreach").document(outreach_id).set(',
                '.collection(f"call_{kind}").document(outreach_id).set(')
    assert any("cannot be resolved" in p for p in suppression_paths(bad))


# ── behavioural: every phrase in the review lists ───────────────────────────

# (language, utterances in order). The review's own examples where it gave
# them; the third-party sentences for pa, ta, te and ml follow its pattern.
SEQUENCES: list[tuple[str, tuple[str, ...]]] = [
    # #1: "don't call my husband, call me", then "yes, call me" / yes + a time.
    ("Marathi", ("माझ्या नवऱ्याला फोन करू नका, मला करा", "हो, मला फोन करा")),
    ("Gujarati", ("મારા પતિને ફોન ન કરશો, મને કરજો", "હા, ફોન કરજો")),
    ("Punjabi", ("ਮੇਰੇ ਪਤੀ ਨੂੰ ਫ਼ੋਨ ਨਾ ਕਰੋ, ਮੈਨੂੰ ਕਰੋ", "ਹਾਂ ਜੀ, ਫ਼ੋਨ ਕਰੋ")),
    ("Kannada", ("ನನ್ನ ಗಂಡನಿಗೆ ಕರೆ ಮಾಡಬೇಡಿ, ನನಗೆ ಮಾಡಿ", "ಹೌದು, ಕರೆ ಮಾಡಿ")),
    ("Tamil", ("என் கணவருக்கு போன் பண்ணாதீங்க, எனக்கு பண்ணுங்க", "ஆமா, கூப்பிடுங்க")),
    ("Telugu", ("మా ఆయనకి ఫోన్ చేయకండి, నాకు చేయండి", "అవును, ఫోన్ చేయండి")),
    ("Malayalam", ("എന്റെ ഭർത്താവിനെ വിളിക്കരുത്, എന്നെ വിളിക്കൂ", "അതെ, വിളിച്ചോളൂ")),
    ("Hindi", ("दोबारा फ़ोन मत करना", "बिल्कुल फ़ोन कीजिए")),
    ("Hindi", ("फोन मत करो", "हाँ, कल शाम को")),
    ("Hindi", ("फोन मत करो", "ज़रूर फ़ोन कीजिए")),
    ("Hindi", ("फोन मत करो", "हाँ, मुझे फ़ोन करो")),
    ("Hindi", ("phone mat karo", "bilkul call kijiye")),
    ("English", ("Don't call me.", "Sure, call me anytime")),
    ("English", ("Don't call me.", "Yes, tomorrow evening is fine")),
    ("English", ("Don't call me.", "Definitely call me")),
    ("Bengali", ("ফোন করবেন না", "হ্যাঁ, ফোন করবেন")),
    ("Bengali", ("ফোন করবেন না", "অবশ্যই ফোন করবেন")),
    ("Kannada", ("ಫೋನ್ ಮಾಡಬೇಡಿ", "ಹೌದು, ನಾಳೆ ಸಂಜೆ")),
    # #2: a yes during the question's opener, a bystander, the "हां" noise fragment.
    ("Gujarati", ("મારા પતિને ફોન ન કરશો, મને કરજો", "હા")),
    ("Hindi", ("please don't", "call me again", "yes")),
    ("Hindi", ("दोबारा फ़ोन मत करना", "हां")),
    # #3: a parent who means it, saying it again and again (also MEANT_IT below).
    ("Bengali", ("আর ফোন করবেন না", "হ্যাঁ, আর ফোন করবেন না", "বললাম তো, আর ফোন করবেন না",
                 "হ্যাঁ, করবেন না", "আর ফোন করবেন না")),
    ("English", ("Please don't call me again.", "Yes, please do not call", "Yes, please don't call this number again")),
    ("Punjabi", ("ਦੁਬਾਰਾ ਫ਼ੋਨ ਨਾ ਕਰੋ", "ਹਾਂ ਜੀ, ਫ਼ੋਨ ਨਾ ਕਰੋ")),
    ("Tamil", ("இனிமேல் போன் பண்ணாதீங்க", "ஆமா, வேண்டாம்")),
    ("Hindi", ("दोबारा फ़ोन मत करना", "हाँ, स्कूल इस नंबर पर फ़ोन न करे", "जी हाँ, आगे से फ़ोन मत करना")),
    ("English", ("Stop calling me!", "Yes, I would like the school not to call this number again")),
    ("Bengali", ("আর ফোন করবেন না", "হ্যাঁ, স্কুল এই নম্বরে আর ফোন না করুক")),
    ("Gujarati", ("ફરીથી ફોન ન કરશો", "હા, ફોન કરશો નહીં")),
    ("Kannada", ("ಮತ್ತೆ ಫೋನ್ ಮಾಡಬೇಡಿ", "ಹೌದು ಬೇಡ")),
    ("Telugu", ("మళ్ళీ ఫోన్ చేయకండి", "అవును, వద్దు")),
    ("Malayalam", ("ഇനി വിളിക്കരുത്", "അതെ, വേണ്ട")),
    # #4: the negative-interrogative answer.
    ("Kannada", ("ನನ್ನ ಗಂಡನಿಗೆ ಕರೆ ಮಾಡಬೇಡಿ, ನನಗೆ ಮಾಡಿ", "ಹೌದು")),
    ("Telugu", ("మా ఆయనకి ఫోన్ చేయకండి, నాకు చేయండి", "అవును")),
    # #5: the test-override call.
    ("English", ("please don't call me again", "yes")),
    # #6: a reschedule answer, a frequency complaint, a yes to another question.
    ("Hindi", ("ऑफ़िस टाइम में फ़ोन मत करना", "हाँ शाम को कीजिए")),
    ("Hindi", ("इतना फ़ोन मत करो", "हाँ, कल कर लेना")),
    ("English", ("dont call me so often", "yes once a week is fine")),
    ("Hindi", ("बार बार फ़ोन मत करना", "हाँ जी")),
]

# #3's parents meant it: each of these must be recorded, exactly once.
MEANT_IT = [seq for seq in SEQUENCES if seq[1][0] in {
    "আর ফোন করবেন না", "Please don't call me again.", "ਦੁਬਾਰਾ ਫ਼ੋਨ ਨਾ ਕਰੋ", "இனிமேல் போன் பண்ணாதீங்க",
    "दोबारा फ़ोन मत करना", "Stop calling me!", "ફરીથી ફોન ન કરશો", "ಮತ್ತೆ ಫೋನ್ ಮಾಡಬೇಡಿ",
    "మళ్ళీ ఫోన్ చేయకండి", "ഇനി വിളിക്കരുത്",
} and len(seq[1]) > 1 and seq[1][1] not in {"बिल्कुल फ़ोन कीजिए", "हां"}]

# The earlier review's false stops (#5, #8) and missed phrasings (#9).
EARLIER_FALSE_STOPS = [
    "haan dobara call karna na", "kabhi bhi call kar lena na", "phir se call karna na please",
    "अभी फ़ोन बंद कर दो, मैं बाद में बात करूँगा", "ok phone band karo", "Never call me before 10",
    "Please stop calling during work hours", "No more calls today please", "Don't call again today, call tomorrow",
    "आज दोबारा फ़ोन मत करना, कल शाम को करना", "Do not call me again until the exams", "The teacher never call me",
    "उनको दोबारा फ़ोन मत करना, मुझे करना", "मेरे पति को फ़ोन मत करना, मुझे करना",
    "I don't want you to call my husband", "Don't call me, I'll call you", "आप फ़ोन मत करो, मैं ख़ुद फ़ोन कर लूँगा",
    "हाँ, फ़ोन बंद कर दीजिए", "अच्छा ठीक है फ़ोन बंद करो", "phone band karo abhi", "haan kal phir se call karna na",
    "मेरे पति को फोन मत करना, मुझे करना", "আমার স্বামীকে ফোন করবেন না, আমাকে করুন", "unke papa ko phone mat karna",
    "फोन मत कीजिए, मैं खुद स्कूल आ जाऊँगा", "phone mat karo, main khud school aa jaunga",
    "फोन मत करना, मैं ड्राइव कर रहा हूँ", "ওর বাবাকে ফোন করবেন না", "ওকে ফোন করবেন না",
    "বাচ্চে को फोन मत करना", "उसके पापा को फोन मत करना", "তার বাবাকে ফোন করবেন না",
]
MISSED_STOPS = [
    "ફરીથી ફોન કરશો નહીં", "ફોન કરશો નહીં", "दोबारा फ़ोन नहीं करना", "मुझे फ़ोन नहीं करना", "पुन्हा फोन नका करू",
    "ਫੋਨ ਨਹੀਂ ਕਰਨਾ", "ഇനി വിളിക്കണ്ട", "ഇനി ഫോൺ ചെയ്യണ്ട", "আর কল দিবেন না", "আমাকে আর ফোন দেবেন না",
    "do not disturb me", "I don't want to receive any calls",
]
ALL_SEQUENCES = SEQUENCES + [("Hindi", (text, "हाँ")) for text in EARLIER_FALSE_STOPS + MISSED_STOPS]


def _record(language: str) -> dict:
    return {**RECORD, "parentLanguage": language}


def _run_call(language: str, utterances, tmp_path, monkeypatch, *, analysis=None):
    """The real Vobiz handler; the parent says `utterances` while the call is live."""
    db = FakeAsyncFirestore({("parent_outreach", OID): _record(language)})
    persisted: list = []
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()
        from src import bot, opt_out

        real_persist = opt_out.persist_opt_out

        async def spy(*args, **kwargs):
            persisted.append(args)
            return await real_persist(*args, **kwargs)

        monkeypatch.setattr(opt_out, "persist_opt_out", spy)
        if analysis is not None:
            monkeypatch.setattr(bot, "analyze_call", analysis)

        async def hangup(*args):
            return None

        main.hangup_vobiz_call = hangup
        passed: list[str] = []

        async def live():
            run = run_from_recorder()
            guard = run.processor("StopRequestGuard")
            for text in utterances:
                before = len(guard.pushed)
                await guard.process_frame(TranscriptionFrame(text=text), FrameDirection.DOWNSTREAM)
                passed.extend(f.text for f, _ in guard.pushed[before:])
                await asyncio.sleep(0)

        ScriptedRunner.script = live
        main.WorkerRunner = ScriptedRunner
        try:
            asyncio.run(run_vobiz_path(main, db, outreach_id=OID))
        finally:
            ScriptedRunner.script = None
        [task] = RECORDER.instances_of("PipelineTask")
        spoken = [f.text for f in task.queued if isinstance(f, TTSSpeakFrame)]
    return db, persisted, spoken, passed


def _outreach_updates(db) -> list[dict]:
    return [w[3] for w in db.writes if w[0] == "update" and w[1] == "parent_outreach"]


@pytest.mark.parametrize("language,utterances", ALL_SEQUENCES, ids=lambda v: v if isinstance(v, str) else " / ".join(v))
def test_no_phrase_in_the_review_lists_ever_writes_a_suppression(language, utterances, tmp_path, monkeypatch):
    db, persisted, spoken, _passed = _run_call(language, utterances, tmp_path, monkeypatch)
    assert suppressions(db) == [], "a call_suppressions document was written"
    assert persisted == []
    assert len(opt_out_requests(db)) <= 1, "at most one record per call"
    for update in _outreach_updates(db):
        assert set(update) <= {"optOutRequested", "updatedAt"}, update
    for _op, _coll, _doc, data, *_rest in db.writes:
        assert not {"optedOut", "optOutSource"} & set(data), data
    noted = load_call_lines()[LANGUAGE_CODES[language]]["opt_out_noted"]
    assert spoken.count(noted) <= 1, "the line is said at most once"


def test_the_meant_it_list_is_review_3():
    assert len(MEANT_IT) == 11


@pytest.mark.parametrize("language,utterances", MEANT_IT, ids=lambda v: v if isinstance(v, str) else " / ".join(v))
def test_a_parent_who_means_it_is_recorded_once_however_they_say_yes(language, utterances, tmp_path, monkeypatch):
    db, persisted, spoken, passed = _run_call(language, utterances, tmp_path, monkeypatch)
    [request] = opt_out_requests(db)
    assert request["quote"] == utterances[0] and request["source"] == "live"
    assert suppressions(db) == [] and persisted == []
    assert spoken.count(load_call_lines()[LANGUAGE_CODES[language]]["opt_out_noted"]) == 1
    assert list(utterances[1:]) == passed, "after the line, the parent is heard by the model, never dropped"


# ── a true stop, in every call language ──────────────────────────────────────

TRUE_STOPS = {
    "English": "Please don't call me again.",
    "Hindi": "दोबारा फ़ोन मत करना",
    "Bengali": "আর ফোন করবেন না",
    "Marathi": "पुन्हा फोन करू नका",
    "Gujarati": "ફરીથી ફોન ન કરશો",
    "Punjabi": "ਦੁਬਾਰਾ ਫ਼ੋਨ ਨਾ ਕਰੋ",
    "Kannada": "ಮತ್ತೆ ಫೋನ್ ಮಾಡಬೇಡಿ",
    "Tamil": "இனிமேல் போன் பண்ணாதீங்க",
    "Telugu": "మళ్ళీ ఫోన్ చేయకండి",
    "Malayalam": "ഇനി വിളിക്കരുത്",
}

# What the engine used to promise, in every language. None of it may be said.
OLD_PROMISES = [
    "we will not call you again", "हम आपको दोबारा फ़ोन नहीं करेंगे", "আমরা আপনাকে আর ফোন করব না",
    "आम्ही तुम्हाला पुन्हा फोन करणार नाही", "અમે તમને ફરીથી ફોન નહીં કરીએ", "ਅਸੀਂ ਤੁਹਾਨੂੰ ਦੁਬਾਰਾ ਫ਼ੋਨ ਨਹੀਂ ਕਰਾਂਗੇ",
    "ನಾವು ನಿಮಗೆ ಮತ್ತೆ ಕರೆ ಮಾಡುವುದಿಲ್ಲ", "நாங்கள் இனி உங்களை அழைக்க மாட்டோம்", "మేము మీకు మళ్ళీ ఫోన్ చేయము",
    "ഞങ്ങൾ ഇനി നിങ്ങളെ വിളിക്കില്ല",
]


def test_the_true_stops_cover_every_call_language():
    assert {LANGUAGE_CODES[name] for name in TRUE_STOPS} == set(LANGUAGE_NAMES)
    assert all(is_stop_request(text) for text in TRUE_STOPS.values())


@pytest.mark.parametrize("language", sorted(TRUE_STOPS))
def test_a_true_stop_is_recorded_noted_for_the_teacher_and_answered_honestly(language, tmp_path, monkeypatch):
    stop = TRUE_STOPS[language]
    db, persisted, spoken, passed = _run_call(language, (stop,), tmp_path, monkeypatch)
    noted = load_call_lines()[LANGUAGE_CODES[language]]["opt_out_noted"]

    assert suppressions(db) == [] and persisted == []
    [request] = opt_out_requests(db)
    assert request["quote"] == stop and request["source"] == "live"
    assert re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z", request["at"])

    assert spoken[-1] == noted, "the parent hears the fixed line"
    assert not [s for s in spoken for promise in OLD_PROMISES if promise.lower() in s.lower()]
    assert stop not in passed, "the model does not answer the stop itself"

    [result] = [w[3] for w in db.writes if w[0] == "set" and w[1] == "parent_outreach" and "transcript" in w[3]]
    said = [(t["role"], t["text"]) for t in result["transcript"]]
    assert ("parent", stop) in said and ("agent", noted) in said
    note = result["callSummary"]["actionItemsForTeacher"][0]
    assert note.startswith("The parent said they would prefer not to receive these calls")
    assert f'"{stop}"' in note and "Nothing has been blocked" in note
    assert result["callSummary"]["followUpNeeded"] is True


def test_the_note_carries_the_english_translation_from_the_analysis(tmp_path, monkeypatch):
    stop = TRUE_STOPS["Bengali"]
    asked: list = []

    async def analysis(call_context, transcript, api_key=None, **kwargs):
        asked.append(kwargs.get("flagged_words"))
        return {"parentResponse": "The parent asked for no more calls.",
                "optOut": {"requested": True, "quote": stop, "flaggedInEnglish": "Do not call again"}}

    db, *_ = _run_call("Bengali", (stop,), tmp_path, monkeypatch, analysis=analysis)
    assert asked == [stop], "the analysis is asked to translate the words the call noticed"
    [result] = [w[3] for w in db.writes if w[0] == "set" and "callSummary" in w[3]]
    assert '(in English: "Do not call again")' in result["callSummary"]["actionItemsForTeacher"][0]


def test_the_analysis_backstop_records_source_analysis_and_never_suppresses(tmp_path, monkeypatch):
    quote = "we would rather the school did not ring this house"

    async def analysis(call_context, transcript, api_key=None, **kwargs):
        return {"optOut": {"requested": True, "quote": quote, "quoteInEnglish": quote}}

    async def live():
        run_from_recorder().context.add_message({"role": "user", "content": f"Honestly, {quote}."})

    db = FakeAsyncFirestore({("parent_outreach", OID): _record("English")})
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()
        from src import bot

        monkeypatch.setattr(bot, "analyze_call", analysis)
        ScriptedRunner.script = live
        main.WorkerRunner = ScriptedRunner
        try:
            asyncio.run(run_vobiz_path(main, db, outreach_id=OID))
        finally:
            ScriptedRunner.script = None
    assert suppressions(db) == []
    [request] = opt_out_requests(db)
    assert request["quote"] == quote and request["source"] == "analysis"
    [result] = [w[3] for w in db.writes if w[0] == "set" and "callSummary" in w[3]]
    note = result["callSummary"]["actionItemsForTeacher"][0]
    assert note.startswith("The call review found") and quote in note


# ── the lines themselves ─────────────────────────────────────────────────────


def test_the_english_line_is_the_decided_sentence():
    assert load_call_lines()["en-IN"]["opt_out_noted"] == (
        "Thank you, I will let the class teacher know you would prefer not to receive these calls."
    )


def test_no_spoken_line_promises_that_nobody_will_call():
    spoken = [v for entry in load_call_lines().values() for k, v in entry.items() if k != "review"]
    assert not [s for s in spoken for p in OLD_PROMISES if p.lower() in s.lower()]
    # Nor any string the engine code could speak (docstrings and comments aside).
    for name, src in _engine_sources().items():
        for node in ast.walk(ast.parse(src)):
            body = getattr(node, "body", None)
            docstrings = {id(s.value) for s in body if isinstance(s, ast.Expr)} if isinstance(body, list) else set()
            for child in ast.iter_child_nodes(node):
                if isinstance(child, ast.Constant) and isinstance(child.value, str) and id(child) not in docstrings:
                    hits = [p for p in OLD_PROMISES if p.lower() in child.value.lower()]
                    assert not hits, (name, hits)


# ── the call after the line ──────────────────────────────────────────────────


def test_after_the_line_the_call_closes_if_the_parent_says_nothing(monkeypatch):
    with stubbed_runtime():
        from src import bot

        monkeypatch.setattr(bot, "NOTED_CLOSE_AFTER_SILENCE_SECONDS", 0.01)

        async def recorded(quote, source):
            return True

        async def go():
            run = await build_bot({**RECORD, "id": OID}, call_store=FakeCallStore(), on_opt_out_request=recorded)
            guard = run.processor("StopRequestGuard")
            await guard.process_frame(TranscriptionFrame(text="please don't call me again"), FrameDirection.DOWNSTREAM)
            await asyncio.sleep(0.05)
            return run

        run = asyncio.run(go())
    assert [type(f).__name__ for f in run.task.queued] == ["TTSSpeakFrame", "TTSSpeakFrame", "EndFrame"]
    lines = load_call_lines()["hi-IN"]
    assert [f.text for f in run.task.queued[:2]] == [lines["opt_out_noted"], lines["goodbye"]]
    assert run.processor("PhaseInstructor").phase.value == "close"


def test_after_the_line_a_reply_goes_to_the_model_and_nothing_is_said_twice(monkeypatch):
    calls: list = []
    with stubbed_runtime():
        from src import bot

        monkeypatch.setattr(bot, "NOTED_CLOSE_AFTER_SILENCE_SECONDS", 0.01)

        async def recorded(quote, source):
            calls.append((quote, source))
            return True

        async def go():
            run = await build_bot({**RECORD, "id": OID}, call_store=FakeCallStore(), on_opt_out_request=recorded)
            guard = run.processor("StopRequestGuard")
            for text in ("please don't call me again", "no no, I meant call me in the evening", "don't call me"):
                await guard.process_frame(TranscriptionFrame(text=text), FrameDirection.DOWNSTREAM)
            await asyncio.sleep(0.05)
            return run, [f.text for f, _ in guard.pushed]

        run, passed = asyncio.run(go())
    assert calls == [("please don't call me again", "live")]
    assert passed == ["no no, I meant call me in the evening", "don't call me"]
    # No model reply was driven here, so the close timer (not the parent's
    # speech) ends the call, with the line and the goodbye each said once.
    lines = load_call_lines()["hi-IN"]
    assert [(type(f).__name__, getattr(f, "text", None)) for f in run.task.queued] == [
        ("TTSSpeakFrame", lines["opt_out_noted"]), ("TTSSpeakFrame", lines["goodbye"]), ("EndFrame", None)]
