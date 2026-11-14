"""Dedicated recogniser (chirp_2) for Riya on Vobiz: switch, request stream, stop phrases. No network."""

import asyncio

import pytest

from sahayakai_agents.telephony import dedicated_asr as D
from sahayakai_agents.telephony import riya as R


def test_off_unless_explicitly_chirp_2(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("VOBIZ_RIYA_DEDICATED_ASR", raising=False)
    assert D.dedicated_asr_model() is None
    monkeypatch.setenv("VOBIZ_RIYA_DEDICATED_ASR", "telephony")
    assert D.dedicated_asr_model() is None
    monkeypatch.setenv("VOBIZ_RIYA_DEDICATED_ASR", "chirp_2")
    assert D.dedicated_asr_model() == "chirp_2"


def test_request_stream_is_mulaw_8k_en_in_and_chunks_100ms() -> None:
    loop = asyncio.new_event_loop()
    try:
        s = D.ChirpStream(loop, lambda *a: None, ["Sargvision", "Aarav"], project="p")
        for _ in range(12):
            s.feed(b"\xff" * 160)  # 12 x 20 ms
        s.close()
        reqs = list(s._requests(started=__import__("time").monotonic()))
        cfg = reqs[0].streaming_config.config
        assert reqs[0].recognizer == "projects/p/locations/asia-southeast1/recognizers/_"
        assert cfg.model == "chirp_2" and list(cfg.language_codes) == ["en-IN"]
        assert cfg.explicit_decoding_config.sample_rate_hertz == 8000
        assert cfg.explicit_decoding_config.encoding.name == "MULAW"
        assert reqs[0].streaming_config.streaming_features.interim_results is False  # finals only
        phrases = [p.value for p in cfg.adaptation.phrase_sets[0].inline_phrase_set.phrases]
        assert "Sargvision" in phrases and "Aarav" in phrases and "PTM" in phrases
        audio = [len(r.audio) for r in reqs[1:]]
        assert audio == [800, 800, 320]  # 100 ms chunks, then the remainder on close
    finally:
        loop.close()


@pytest.mark.parametrize("said", ["Remove my number from your list.", "Please take my number off", "Do not contact me", "No more calls please"])
def test_stop_requests_close_the_call(said: str) -> None:
    c = R.RiyaCall({"school_name": "S", "student_name": "A", "call_purpose": "ptm_invitation"}, product_context="sampark")
    d = c.on_parent(said)
    assert d.act is R.Act.CLOSE and d.branch == "stop"


def test_goodbye_while_asked_for_a_callback_time_closes_politely() -> None:
    c = R.RiyaCall({"school_name": "S", "student_name": "A", "call_purpose": "ptm_invitation"}, product_context="sampark")
    c.on_parent("I'm busy right now.")
    d = c.on_parent("Okay, thank you. Bye.")
    assert d.act is R.Act.CLOSE and d.branch == "busy" and c.callback_state == "declined"


def test_model_correction_only_when_hearing_differs() -> None:
    from sahayakai_agents.telephony.router import _words_differ
    assert not _words_differ("Yes, tell me.", "Yes tell me")
    assert _words_differ("No, wrong number.", "No problem")
    assert _words_differ("Around 6 in the evening", "")
    assert not _words_differ("", "anything")


def test_default_threshold_matches_the_benchmark(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("VOBIZ_ASR_MIN_CONFIDENCE", raising=False)
    assert D.min_confidence() == 0.4  # catches 0.36 ("No, no, ma'am"); correct lines were >= 0.43


def test_end_call_waits_for_a_final_still_in_flight() -> None:
    import asyncio
    import time as _t
    from types import SimpleNamespace
    from sahayakai_agents.telephony.router import _await_asr_final

    now = _t.monotonic()
    b = SimpleNamespace(last_parent_voice_at=now, last_transcript_at=now - 1, asr_inflight=0, stop=False)

    async def land() -> None:
        await asyncio.sleep(0.3)
        b.last_transcript_at = _t.monotonic()

    async def run() -> float:
        t0 = _t.monotonic()
        await asyncio.gather(_await_asr_final(b), land())
        return _t.monotonic() - t0

    took = asyncio.run(run())
    assert 0.25 < took < 1.5


def test_end_call_does_not_wait_when_parent_is_quiet() -> None:
    import asyncio
    import time as _t
    from types import SimpleNamespace
    from sahayakai_agents.telephony.router import _await_asr_final

    b = SimpleNamespace(last_parent_voice_at=_t.monotonic() - 10, last_transcript_at=0.0, asr_inflight=0, stop=False)
    t0 = _t.monotonic(); asyncio.run(_await_asr_final(b))
    assert _t.monotonic() - t0 < 0.1


def _delivered_call() -> "R.RiyaCall":
    c = R.RiyaCall({"school_name": "S", "student_name": "A", "call_purpose": "ptm_invitation",
                    "event_date": "14 November", "event_time": "10 AM"}, product_context="sampark")
    c.on_parent("Yes, tell me.")
    c.on_agent("Am I speaking with the parent or guardian of A?")
    c.on_parent("Yes, you are.")
    c.on_agent("I'm calling to invite you to the parent-teacher meeting on 14 November at 10 AM. Will you be able to attend?")
    return c


def test_an_answer_in_progress_closes_the_parents_question() -> None:
    # Real call 2026-11-09: refused, goodbye muted, then 44 s of silence.
    c = _delivered_call()
    c.on_parent("How much I'll do in class?")
    ok, why = c.may_end(
        pending="I don't have information about your child's performance. Please contact the school for details. Have a good day.",
        parent_last="How much I'll do in class?",
    )
    assert why != "parent_question_open"


def test_a_bare_goodbye_does_not_answer_a_question() -> None:
    c = _delivered_call()
    c.on_parent("What time is the meeting?")
    ok, why = c.may_end(pending="Thank you for your time. Have a good day.", parent_last="What time is the meeting?")
    assert not ok and why == "parent_question_open"


def test_can_attend_pattern_uses_word_boundaries() -> None:
    assert R._CAN_ATTEND.search("yes i can come")
    assert R._CAN_ATTEND.search("we'll be there")
    assert "\x08" not in open(R.__file__, encoding="utf-8").read()


def test_silent_refusals_cue_then_close() -> None:
    from types import SimpleNamespace
    from sahayakai_agents.telephony import router as RT

    c = _delivered_call()
    spawned: list[str] = []
    b = SimpleNamespace(silent_refusals=0, refusal_agent_turns=-1, riya_net_armed=False, timeline=[],
                        call_started=0.0, outreach_id="t")
    orig = RT._spawn
    RT._spawn = lambda bridge, coro: (spawned.append(coro.__qualname__), coro.close())
    try:
        for i in range(4):
            if i == 3:
                b.first_silent_refusal_at -= 10  # the refusals spread over more than 6 s
            RT._riya_unstick(b, None, c)
    finally:
        RT._spawn = orig
    assert spawned == ["_send_director", "_riya_close_net"]
    assert c.close_branch == "stalled" and b.riya_net_armed


def test_speech_between_refusals_resets_the_count() -> None:
    from types import SimpleNamespace
    from sahayakai_agents.telephony import router as RT

    c = _delivered_call()
    spawned: list[str] = []
    b = SimpleNamespace(silent_refusals=0, refusal_agent_turns=-1, riya_net_armed=False, timeline=[],
                        call_started=0.0, outreach_id="t")
    orig = RT._spawn
    RT._spawn = lambda bridge, coro: (spawned.append(coro.__qualname__), coro.close())
    try:
        RT._riya_unstick(b, None, c)
        c.on_agent("The meeting is at 10 AM.")
        RT._riya_unstick(b, None, c)
    finally:
        RT._spawn = orig
    assert spawned == [] and b.silent_refusals == 1


import pytest as _pytest


@_pytest.mark.parametrize("said", [
    "What if I say I am not? Would you still convey me the message?",   # real call 2026-11-09
    "What if I said I am?",
    "Suppose I am, what then?",
    "Am I the parent?",
    "Is it about my son?",
    "Why do you want to know if I am his mother?",
    "I am not sure.",
    "I'm not his mother but I can pass it on.",
    "Would you still tell me if I am not?",
])
def test_hypotheticals_and_questions_never_verify_identity(said: str) -> None:
    """Class gate: only a clear answer may unlock a child's details."""
    assert R.identity(said) != "yes"


@_pytest.mark.parametrize("said", ["Yes, I am.", "Yes, I'm his mother.", "Yeah, speaking.", "Yes, you are.", "Yes. Why?"])
def test_clear_confirmations_still_verify(said: str) -> None:
    assert R.identity(said) == "yes"


def test_hypothetical_does_not_unlock_details() -> None:
    c = R.RiyaCall({"school_name": "S", "student_name": "A", "call_purpose": "ptm_invitation"}, product_context="sampark")
    c.on_parent("Yeah, tell me.")
    c.on_agent("Thank you. I'm calling about an upcoming parent-teacher meeting. Am I speaking with the parent or guardian of A?")
    d = c.on_parent("What if I say I am not? Would you still convey me the message?")
    assert d.act is not R.Act.UNLOCK and c.stage is not R.RiyaStage.VERIFIED


def test_denial_after_delivery_closes_as_wrong_person() -> None:
    c = _delivered_call()
    d = c.on_parent("I am not the parent of A.")
    assert d.act is R.Act.CLOSE and d.branch == "wrong_person"
    assert c.state_answers().get("recipient_confirmed") == "no" or c.identity_state == "denied"
    assert c.may_end()[0]


def _bridge_at_guardian_question(q_at: float):
    from types import SimpleNamespace
    c = R.RiyaCall({"school_name": "S", "student_name": "A", "call_purpose": "ptm_invitation"}, product_context="sampark")
    c.on_parent("Yes, go ahead.")
    c.on_agent("Thank you. I'm calling about an upcoming parent-teacher meeting. Am I speaking with the parent or guardian of A?")
    return SimpleNamespace(riya=c, guardian_q_at=q_at)


def test_a_late_final_said_before_the_guardian_question_cannot_verify() -> None:
    """Class gate: an answer to an EARLIER question, delivered late by the recogniser, never verifies identity."""
    from sahayakai_agents.telephony.router import _stale_identity_answer
    b = _bridge_at_guardian_question(100.0)
    assert _stale_identity_answer(b, "Yes, go ahead.", spoke_at=98.0)
    assert not _stale_identity_answer(b, "Yes, I'm his mother.", spoke_at=103.0)
    # a stop request is honoured whenever it was said
    assert not _stale_identity_answer(b, "Yes, go ahead. Please don't call me again.", spoke_at=98.0)


def test_word_offsets_are_requested() -> None:
    import asyncio
    s = D.ChirpStream(asyncio.new_event_loop(), lambda *a: None, [], project="p")
    assert s._config().streaming_config.config.features.enable_word_time_offsets


def test_attendance_followup_after_a_tangent() -> None:
    c = _delivered_call()
    c.on_parent("Can you dance?")
    c.on_agent("I can't dance, I'm an AI.")
    cue = c.attendance_followup_cue()
    assert cue and "attend" in cue and "14 November" in cue
    assert c.attendance_followup_cue() is None  # once only


def test_no_attendance_followup_when_answered_or_riya_asked_a_question() -> None:
    c = _delivered_call()
    c.on_parent("Yes, I can come.")
    c.on_agent("Great, thank you.")
    assert c.attendance_followup_cue() is None
    d = _delivered_call()
    d.on_parent("Can you dance?")
    d.on_agent("I can't dance. Will you be able to attend the meeting?")
    assert d.attendance_followup_cue() is None


def _guard_bridge(**kw):
    import asyncio
    from types import SimpleNamespace
    c = _delivered_call()
    b = SimpleNamespace(stop=False, closing=False, riya=c, asr_seq=1, model_turn_open=False, out=asyncio.Queue(),
                        model_last_audio=0.0, riya_line_until=0.0, riya_drop_turn=False, riya_reask_at=-1,
                        parent_said=["x"], timeline=[], call_started=0.0, outreach_id="t", last_activity=0.0,
                        vad_speaking=False, last_parent_speech_end=0.0, last_turn_interrupted=False, live_heard=[])
    for k, v in kw.items():
        setattr(b, k, v)
    return b


def _run_guard(b, said="Can you dance?", conf=0.8):
    import asyncio
    from sahayakai_agents.telephony import router as RT
    sent: list[str] = []

    async def fake_director(session, text):
        sent.append(text)

    orig, RT._send_director = RT._send_director, fake_director
    orig_grace, RT._ASR_REPLY_GRACE = RT._ASR_REPLY_GRACE, 0.01
    try:
        asyncio.run(RT._asr_reply_guard(b, None, said, conf, 1, 10.0))
    finally:
        RT._send_director, RT._ASR_REPLY_GRACE = orig, orig_grace
    return sent


def test_reply_guard_makes_riya_answer_when_gemini_stays_quiet() -> None:
    sent = _run_guard(_guard_bridge())
    assert sent and "Can you dance?" in sent[0]


def test_reply_guard_resumes_after_noise_cut_her_off() -> None:
    b = _guard_bridge()
    b.riya.last_agent_cut = True
    sent = _run_guard(b, said="What we get the back?", conf=0.49)
    assert sent and "cut off" in sent[0]


def test_reply_guard_stays_out_when_riya_is_already_replying() -> None:
    assert _run_guard(_guard_bridge(model_turn_open=True)) == []
    assert _run_guard(_guard_bridge(model_last_audio=11.0)) == []
    assert _run_guard(_guard_bridge(asr_seq=2)) == []  # the parent spoke again


def test_flush_ends_the_request_and_keeps_later_audio() -> None:
    import asyncio
    import time as _t
    s = D.ChirpStream(asyncio.new_event_loop(), lambda *a: None, [], project="p")
    s.feed(b"\x7f" * 800)
    s.flush()
    s.feed(b"\x7f" * 400)
    reqs = list(s._requests(_t.monotonic()))
    assert len(reqs) == 2 and reqs[1].audio  # config + the audio, then the request ends
    assert s.flushes == 1
    s.close()
    rest = list(s._requests(_t.monotonic()))
    assert len(rest) == 2 and len(rest[1].audio) == 400  # nothing lost across the flush


def test_flush_in_silence_does_not_end_an_empty_request() -> None:
    import asyncio
    import time as _t
    s = D.ChirpStream(asyncio.new_event_loop(), lambda *a: None, [], project="p")
    s.flush()
    s.close()
    assert len(list(s._requests(_t.monotonic()))) == 1 and s.flushes == 0


def test_goodbye_after_a_question_in_the_same_utterance_ends() -> None:
    c = _delivered_call()
    d = c.on_parent("Can I join online instead? Okay, thank you. Bye.")
    assert c.parent_signalled_end and d.act is R.Act.PARENT_DONE
    assert c.attendance_answered


def test_no_silence_once_the_details_cue_is_sent() -> None:
    c = R.RiyaCall({"school_name": "S", "student_name": "A", "call_purpose": "ptm_invitation"}, product_context="sampark")
    c.on_parent("Yes, tell me.")
    c.on_agent("Am I speaking with the parent or guardian of A?")
    c.on_parent("Yes, sir.")
    assert c.stage is R.RiyaStage.VERIFIED
    assert c.skip_allowed("Yes, sir.")[0]          # before the cue: the details are on their way
    c.unlock_cue_sent = True
    assert c.skip_allowed("Yes, sir.") == (False, "deliver_details")


def test_denial_split_across_two_finals_still_closes() -> None:
    c = _delivered_call()
    c.on_parent("Wait, actually")
    d = c.on_parent("Wait, actually I am not the parent of A.", new_utterance=False)
    assert d.act is R.Act.CLOSE and d.branch == "wrong_person"


def test_reply_guard_waits_while_the_parent_is_still_talking() -> None:
    assert _run_guard(_guard_bridge(vad_speaking=True)) == []


def test_trouble_line_is_prerendered_with_the_others() -> None:
    c = R.RiyaCall({"school_name": "S", "student_name": "A", "call_purpose": "ptm_invitation"}, product_context="sampark")
    assert R.LINE_TROUBLE_LINE in c.fixed_lines()


def test_reply_guard_leaves_gemini_alone_when_it_heard_the_parent() -> None:
    assert _run_guard(_guard_bridge(live_heard=["Yes, go ahead."])) == []


def test_no_goodbye_before_verification_once_the_parent_agreed_to_talk() -> None:
    c = R.RiyaCall({"school_name": "S", "student_name": "A", "call_purpose": "ptm_invitation"}, product_context="sampark")
    c.on_parent("Yes, go ahead.")
    ok, why = c.may_end(pending="I will discuss this with the school authorities. Thank you for your time. Have a good day.")
    assert not ok and why == "purpose_not_reached"


def test_busy_parent_can_still_be_closed_before_verification() -> None:
    c = R.RiyaCall({"school_name": "S", "student_name": "A", "call_purpose": "ptm_invitation"}, product_context="sampark")
    c.on_parent("Hmm, uh")  # no clear yes: the model's own goodbye may still end it
    ok, why = c.may_end(pending="No problem. Have a good day.")
    assert ok and why == "riya_closed_before_verification"


def test_no_who_are_you_is_not_cannot_attend() -> None:
    c = _delivered_call()
    c.on_parent("No, who are you?")
    assert not c.cannot_attend and not c.attendance_answered


def test_line_noise_finals_are_recognised() -> None:
    from sahayakai_agents.telephony.router import _asr_noise
    assert _asr_noise("1 2 3 4 5 6 7 8 9 10", 0.31)
    assert _asr_noise("1", 0.36)
    assert not _asr_noise("I can come on Saturday", 0.35)   # real words, even if unsure
    assert not _asr_noise("7th", 0.68)


def test_every_refusal_that_needs_words_makes_riya_speak() -> None:
    from types import SimpleNamespace
    from sahayakai_agents.telephony.router import _end_call_refusal
    c = _delivered_call()
    for why in ("parent_still_engaged", "parent_question_open", "attendance_unanswered",
                "update_not_delivered", "callback_in_progress"):
        text, speak = _end_call_refusal(SimpleNamespace(goodbye_muted_note=False), c, why)
        assert speak and text
    # waiting for the parent is fine to do silently...
    assert _end_call_refusal(SimpleNamespace(goodbye_muted_note=False), c, "riya_question_open")[1] is False
    # ...but never after the parent heard her goodbye cut off (the one-minute stall)
    text, speak = _end_call_refusal(SimpleNamespace(goodbye_muted_note=True), c, "riya_question_open")
    assert speak and "NOT played" in text


def test_reply_recovery_cues_then_closes() -> None:
    import asyncio
    import time as _t
    from types import SimpleNamespace
    from sahayakai_agents.telephony import router as RT
    c = _delivered_call()
    b = SimpleNamespace(reply_owed_since=_t.monotonic() - 10, reply_owed_said="Can you dance?", recover_level=0,
                        closing=False, stop=False, out=asyncio.Queue(), vad_speaking=False, riya_line_until=0.0,
                        riya_drop_turn=False, model_turn_open=False, riya=c, riya_net_armed=False, timeline=[],
                        call_started=0.0, outreach_id="t", last_turn_interrupted=False)
    sent, spawned = [], []

    async def fake_director(session, text):
        sent.append(text)

    o1, o2 = RT._send_director, RT._spawn
    RT._send_director = fake_director
    RT._spawn = lambda bridge, coro: (spawned.append(coro.__qualname__), coro.close())
    try:
        for _ in range(3):
            b.reply_owed_since = _t.monotonic() - 10
            asyncio.run(RT._riya_reply_recovery(b, None))
    finally:
        RT._send_director, RT._spawn = o1, o2
    assert len(sent) == 2 and "Can you dance?" in sent[0]
    assert spawned == ["_riya_close_net"] and c.close_branch == "stalled"


def test_reply_recovery_waits_while_audio_is_playing() -> None:
    import asyncio
    import time as _t
    from types import SimpleNamespace
    from sahayakai_agents.telephony import router as RT
    q = asyncio.Queue(); q.put_nowait(b"x")
    b = SimpleNamespace(reply_owed_since=_t.monotonic() - 10, reply_owed_said="x", recover_level=0, closing=False,
                        stop=False, out=q, vad_speaking=False, riya_line_until=0.0, riya_drop_turn=False,
                        model_turn_open=False, riya=_delivered_call(), timeline=[], call_started=0.0, outreach_id="t")
    asyncio.run(RT._riya_reply_recovery(b, None))
    assert b.recover_level == 0


def test_org_opener_cache_round_trip(tmp_path, monkeypatch) -> None:
    from sahayakai_agents.telephony import router as RT
    monkeypatch.setattr(RT, "_RIYA_OPENER_DIR", str(tmp_path))
    assert RT._org_of("sampark~sargvision-local~abc") == "sargvision-local"
    assert RT._org_of("riyasimfoo") == ""
    RT._remember_org_opener("sargvision-local", "Hello, I'm Riya ... Sargvision ...")
    assert RT._org_opener_text("sargvision-local").startswith("Hello, I'm Riya")
    assert RT._org_opener_text("other") == ""


def test_only_model_failures_are_resumed() -> None:
    import asyncio
    from types import SimpleNamespace
    from starlette.websockets import WebSocketDisconnect
    from sahayakai_agents.telephony.router import _live_resumable

    async def boom(exc):
        raise exc

    async def check(exc, **kw):
        t = asyncio.create_task(boom(exc))
        with contextlib.suppress(BaseException):
            await t
        b = SimpleNamespace(riya=object(), closing=False, stop=False, resume_handle="h", resumes=0)
        for k, v in kw.items():
            setattr(b, k, v)
        return _live_resumable(b, t)

    import contextlib
    assert asyncio.run(check(RuntimeError("1011 Resource exhausted")))
    assert not asyncio.run(check(WebSocketDisconnect()))                     # the parent hung up
    assert not asyncio.run(check(RuntimeError("x"), resume_handle=None))     # nothing to resume with
    assert not asyncio.run(check(RuntimeError("x"), resumes=2))              # limit
    assert not asyncio.run(check(RuntimeError("x"), closing=True))           # goodbye already under way


def test_hello_over_the_opener_is_not_an_unclear_answer() -> None:
    c = R.RiyaCall({"school_name": "S", "student_name": "A", "call_purpose": "ptm_invitation"}, product_context="sampark")
    for hello in ("Hello.", "Hello?", "Hello, hello?", "Haan, hello?", "Hi"):
        d = c.on_parent(hello)
        assert d.act is not R.Act.REASK, hello


def test_answered_question_then_goodbye_asks_anything_else() -> None:
    c = _delivered_call()
    c.on_parent("Yes, I can come.")
    c.on_agent("Great, thank you.")
    c.on_parent("How long will the meeting take?")
    ok, why = c.may_end(pending="It usually takes about fifteen minutes. Thank you for your time. Have a good day.",
                        parent_last="How long will the meeting take?")
    assert not ok and why == "answered_check_anything_else"
