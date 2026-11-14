"""Riya workflow on the Vobiz bridge (telephony/riya.py), synthetic data only."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from sahayakai_agents.telephony import riya as R
from sahayakai_agents.telephony.riya import Act, RiyaCall, RiyaStage

WF = R.load_workflow()

PURPOSE_NODES = {
    "event_invitation": "Event Invitation Chat",
    "ptm_invitation": "PTM Invitation Chat",
    "holiday_notice": "Holiday Notice Chat",
    "exam_schedule_notice": "Exam Schedule Chat",
    "absence_notice": "Absence Notice Chat",
    "emergency_closure": "Emergency Closure Chat",
    "academic_performance": "Academic Performance Chat",
    "classroom_behaviour": "Classroom Behaviour Chat",
    "homework_followup": "Homework Follow-Up Chat",
    "student_achievement": "Student Achievement Chat",
    "student_support": "Student Support Follow-Up Chat",
}

BASE = {
    "school_name": "Sahayak Demo School",
    "student_name": "Aarav",
    "class_name": "Grade-Five",
    "section_name": "Rose",
    "event_name": "Annual Day",
    "event_date": "14th November",
    "event_time": "10 AM",
    "holiday_dates": "20th to 22nd November",
    "exam_schedule": "Maths on 1st December",
    "absence_date": "6th November",
    "closure_date": "8th November",
    "closure_reason": "heavy rain",
    "academic_update": "Good progress in reading",
    "behaviour_summary": "Finds it hard to focus after lunch",
    "assignment_details": "Science project due Friday",
    "achievement_details": "First prize in the quiz",
    "followup_details": "Extra reading support on Tuesdays",
}


def call(purpose: str = "ptm_invitation", ctx: str = "sampark", **extra: str) -> RiyaCall:
    return RiyaCall({**BASE, "call_purpose": purpose, **extra}, product_context=ctx)


def to_delivered(c: RiyaCall) -> RiyaCall:
    c.on_agent(c.first_message())
    assert c.on_parent("Yes, sure").act is Act.NONE
    c.on_agent("Thank you. I'm calling about X. Am I speaking with the parent or guardian of Aarav?")
    assert c.on_parent("Yes, I'm his mother").act is Act.UNLOCK
    c.on_agent("I'm calling to invite you to the meeting on 14th November at 10 AM.")
    return c


# ---- extraction and routing ------------------------------------------------------


def test_resource_has_no_elevenlabs_runtime_or_numbers() -> None:
    raw = Path(R._WORKFLOW_PATH).read_text(encoding="utf-8")
    for banned in ("voice_id", "eleven_", "scribe_realtime", "agent_id", "phone_number"):
        assert banned not in raw
    assert "node_athithi_guest_feedback" not in WF["nodes"]


@pytest.mark.parametrize(("purpose", "label"), PURPOSE_NODES.items())
def test_every_purpose_routes_to_its_node(purpose: str, label: str) -> None:
    c = call(purpose)
    assert c.node["label"] == label
    assert c.route.label == f"sampark / {purpose}"


def test_unmatched_purpose_goes_to_general_and_missing_context_to_safe_exit() -> None:
    assert call("something_else").node["label"].startswith("Sampark General")
    assert call(ctx="").is_safe_exit
    assert call(ctx="whatever").is_safe_exit


def test_excluded_hotel_branch_is_sent_to_safe_exit_not_another_persona() -> None:
    c = call(ctx="athithi")
    assert c.is_safe_exit and c.route.excluded


def test_route_order_matches_the_export() -> None:
    assert [r["label"] for r in WF["routes"]][0] == "athithi"
    assert WF["routes"][-1]["when"] == {}


# ---- opening, variables, privacy ------------------------------------------------


def test_first_message_is_riyas_and_resolves_school() -> None:
    first = call().first_message()
    assert first.startswith("Hello, I'm Riya, an AI assistant calling on behalf of Sahayak Demo School")
    assert first.endswith("Is this a good time to talk?") and "{{" not in first


@pytest.mark.parametrize("purpose", PURPOSE_NODES)
def test_locked_instruction_never_contains_purpose_details(purpose: str) -> None:
    c = call(purpose)
    text = c.instruction()
    assert "{{" not in text
    for var in c.locked_vars():
        if BASE.get(var):
            assert BASE[var] not in text, var
    assert "Aarav" in text  # Riya's verification question names the child


def test_unlock_cue_carries_only_this_nodes_details() -> None:
    cue = call("holiday_notice").unlock_cue()
    assert "20th to 22nd November" in cue and "heavy rain" not in cue


def test_empty_detail_renders_empty_never_a_placeholder() -> None:
    c = call("holiday_notice", holiday_dates="")
    assert "{{" not in c.instruction() and "(not provided)" in c.unlock_cue()


def test_emergency_closure_may_state_the_date_before_verification() -> None:
    c = call("emergency_closure")
    assert "8th November" in c.instruction()  # its busy branch says it, by design
    assert "heavy rain" not in c.instruction()


# ---- stages and branches ---------------------------------------------------------


def test_happy_path_stage_order() -> None:
    c = to_delivered(call())
    assert c.stage is RiyaStage.DELIVERED
    assert [e["detail"] for e in c.events if e["event"] == "stage"] == [
        "good time to talk",
        "guardian question asked",
        "guardian confirmed",
        "details shared",
    ]


@pytest.mark.parametrize("reply", ["No, I'm busy", "Not now please", "I'm driving, call me later", "no"])
def test_not_a_good_time_asks_when_to_call_back(reply: str) -> None:
    """Sampark parity (callback_requested_time): busy no longer hangs up at once."""
    c = call()
    d = c.on_parent(reply)
    assert d.act is Act.SAY and d.line == R.CALLBACK_ASK_LINE
    assert c.stage is RiyaStage.CALLBACK and c.good_time_to_talk == "no"
    assert c.may_end() == (False, "callback_in_progress")


@pytest.mark.parametrize("reply", ["No need, thank you", "No"])
def test_declining_a_callback_closes_with_the_nodes_line(reply: str) -> None:
    c = call()
    c.on_parent("I'm busy")
    d = c.on_parent(reply)
    assert d.act is Act.CLOSE and d.branch == "busy"
    assert d.line == "No problem. Thank you for your time. Have a good day."
    assert c.may_end() == (True, "busy") and "callback_requested_time" not in c.state_answers()


@pytest.mark.parametrize("purpose", PURPOSE_NODES)
def test_every_busy_line_is_in_its_node_prompt(purpose: str) -> None:
    c = call(purpose)
    line = c.busy_line().replace("8th November", "{{closure_date}}")
    assert line in c.node["additional_prompt"]


def test_absence_busy_branch_asks_parent_to_contact_school() -> None:
    c = call("absence_notice")
    c.on_parent("Not a good time")
    d = c.on_parent("no need")
    assert "contact the school as soon as you can" in d.line


def test_emergency_closure_busy_still_gives_the_urgent_line() -> None:
    d = call("emergency_closure").on_parent("Not a good time")
    assert d.act is Act.CLOSE and "8th November" in d.line


def test_wrong_person_closes_without_unlocking() -> None:
    c = call()
    c.on_parent("Yes")
    c.on_agent("Am I speaking with the parent or guardian of Aarav?")
    d = c.on_parent("No, wrong number")
    assert d.act is Act.CLOSE and d.branch == "wrong_person"
    assert d.line == R.WRONG_PERSON_LINE and c.identity_state == "denied"


def test_bare_yes_before_the_question_is_not_verification() -> None:
    c = call()
    c.on_parent("Yes")  # availability
    assert c.on_parent("yes okay").act is Act.NONE  # question not asked yet
    assert c.identity_state == "unknown"


def test_explicit_guardian_statement_verifies_even_before_the_question() -> None:
    c = call()
    assert c.on_parent("Yes, go ahead. I am his mother.").act is Act.UNLOCK
    assert c.good_time_to_talk == "yes" and c.identity_state == "confirmed"
    c2 = call()
    c2.on_parent("Yes")
    assert c2.on_parent("This is his father").act is Act.UNLOCK


def test_locked_prompt_forbids_stating_any_detail() -> None:
    assert "never state or guess one" in call().instruction()


def test_unclear_identity_twice_closes_unverified() -> None:
    c = call()
    c.on_parent("okay")
    c.on_agent("Am I speaking with the parent or guardian of Aarav?")
    # First unclear answer: the guardian question again (cached line), never silence.
    assert c.on_parent("hmm blah").act is Act.REASK
    d = c.on_parent("what blah blah")
    assert d.act is Act.CLOSE and d.branch == "unverified"


def test_fragments_of_one_utterance_count_once() -> None:
    c = call()
    c.on_parent("okay")
    c.on_agent("Am I speaking with the parent or guardian of Aarav?")
    c.on_parent("umm", new_utterance=True)
    assert c.on_parent("umm well", new_utterance=False).act is Act.NONE
    assert c.on_parent("umm well yes I am his mother", new_utterance=False).act is Act.UNLOCK


@pytest.mark.parametrize("stage_setup", ["opening", "delivered"])
def test_stop_or_opt_out_closes_from_any_stage(stage_setup: str) -> None:
    c = call() if stage_setup == "opening" else to_delivered(call())
    d = c.on_parent("Please don't call me again")
    assert d.act is Act.CLOSE and d.branch == "stop"


def test_ai_question_and_repeat_are_recorded_not_closing() -> None:
    c = to_delivered(call())
    assert c.on_parent("Are you a robot?").act is Act.NONE
    assert c.on_parent("Sorry, can you repeat that?").act is Act.NONE
    kinds = [e["detail"] for e in c.events if e["event"] == "parent"]
    assert "asked_if_ai" in kinds and "repeat_request" in kinds


def test_safe_exit_closes_on_first_words() -> None:
    d = call(ctx="").on_parent("Hello?")
    assert d.act is Act.CLOSE and d.line == R.SAFE_EXIT_LINE


# ---- end_call validation (Riya's CALL / NEVER CALL rules) --------------------------


def test_end_call_refused_before_the_purpose_is_reached() -> None:
    c = call()
    assert c.on_end_call() == (False, "purpose_not_reached")


def test_end_call_refused_right_after_delivery() -> None:
    c = to_delivered(call())
    assert c.on_end_call() == (False, "parent_not_yet_responded")


def test_end_call_refused_while_parent_question_is_open() -> None:
    c = to_delivered(call())
    c.on_parent("Can my husband come instead?")
    assert c.on_end_call() == (False, "parent_question_open")


@pytest.mark.parametrize("ack", ["okay", "thank you", "yes", "sure"])
def test_short_acknowledgement_is_not_an_ending(ack: str) -> None:
    c = to_delivered(call())
    c.on_agent("Will you be able to attend at that time?")
    c.on_parent(ack)
    assert c.on_end_call()[0] is False


def test_end_call_allowed_after_riyas_goodbye() -> None:
    c = to_delivered(call())
    c.on_parent("Yes I will come")
    c.on_agent("Thank you for your time. Have a good day.")
    assert c.on_end_call() == (True, "conversation_completed")


def test_end_call_allowed_when_parent_ends() -> None:
    c = to_delivered(call())
    c.on_parent("Okay that's all, bye")
    assert c.on_end_call() == (True, "parent_ended")


def test_declines_are_counted() -> None:
    c = call()
    c.on_end_call()
    c.on_end_call()
    assert c.end_call_declined == 2


# ---- silence, budget, duration -------------------------------------------------------


def test_silence_reprompts_once_then_closes() -> None:
    c = to_delivered(call())
    assert c.on_silence(3) == "none"
    assert c.on_silence(7.2) == "reprompt"
    c.on_agent("Are you still there?")
    assert c.on_silence(7.5) == "close"
    assert c.close_branch == "silence"


def test_parent_speech_resets_the_reprompt() -> None:
    c = to_delivered(call())
    assert c.on_silence(7.5) == "reprompt"
    c.on_parent("yes I'm here")
    assert c.on_silence(7.5) == "reprompt"


def test_long_silence_alone_closes() -> None:
    assert to_delivered(call()).on_silence(15.1) == "close"


def test_question_budget_note_after_two_questions() -> None:
    c = to_delivered(call())
    c.on_agent("Will you be able to attend at that time?")
    assert c.budget_note() is None
    c.on_agent("What day and time would suit you better?")
    assert c.budget_note() is not None


def test_timings_come_from_the_export() -> None:
    c = call()
    assert (c.turn_timeout, c.silence_end_call_timeout, c.max_seconds) == (7.0, 15.0, 120)
    assert RiyaCall({**BASE, "call_purpose": "ptm_invitation"}, product_context="sampark",
                    max_seconds_override=60).max_seconds == 60
    assert c.max_duration_message.startswith("This call has reached its time limit.")


# ---- data collection and the persisted record --------------------------------------


@pytest.mark.parametrize(
    ("purpose", "fields"),
    [
        ("ptm_invitation", {"good_time_to_talk", "ptm_attendance", "ptm_preferred_time", "ptm_meeting_mode"}),
        ("absence_notice", {"good_time_to_talk", "expected_return_date"}),
        ("academic_performance", {"good_time_to_talk"}),
    ],
)
def test_data_collection_fields_per_purpose(purpose: str, fields: set[str]) -> None:
    got = call(purpose).data_collection_fields()
    assert set(got) == fields | set(R.SAMPARK_FIELDS)
    assert got["good_time_to_talk"]["enum"] == ["yes", "no", "no_answer"]


def test_record_is_json_and_holds_no_purpose_details() -> None:
    c = to_delivered(call())
    rec = json.dumps(c.record())
    assert "14th November" not in rec and "Aarav" not in rec
    assert c.record()["identity"] == "confirmed"


# ---- classifiers ---------------------------------------------------------------------


@pytest.mark.parametrize(
    ("text", "want"),
    [("yes go ahead", "yes"), ("haan ji boliye", "yes"), ("no problem, tell me", "yes"),
     ("I'm busy right now", "no"), ("nope", "no"), ("who is this", "unclear"), ("", "unclear")],
)
def test_availability(text: str, want: str) -> None:
    assert R.availability(text) == want


@pytest.mark.parametrize(
    ("text", "want"),
    [("yes speaking", "yes"), ("I am his mother", "yes"), ("this is her father", "yes"),
     ("no, I'm not the parent", "no"), ("wrong number", "no"), ("who?", "unclear")],
)
def test_identity(text: str, want: str) -> None:
    assert R.identity(text) == want


def test_a_bridge_close_makes_end_call_acceptable() -> None:
    c = to_delivered(call())
    c.on_agent("What day and time would suit you better?")
    assert c.on_end_call()[0] is False
    c._close("max_duration", c.max_duration_message)
    assert c.on_end_call() == (True, "max_duration")


def test_riya_guard_allows_the_guardian_question_but_not_details() -> None:
    from sahayakai_agents.telephony.router import _riya_protected

    c = call(event_date="14th November")
    guard = _riya_protected(c)
    assert not guard.leaks(
        "Thank you. I'm calling about an upcoming parent-teacher meeting. "
        "Am I speaking with the parent or guardian of Aarav?"
    )
    assert guard.leaks("The meeting is on 14th November at 10 AM.")


# ---- 2026-11-07 handset-call regressions -------------------------------------------


@pytest.mark.parametrize("purpose", PURPOSE_NODES)
def test_guardian_question_is_never_treated_as_a_detail(purpose: str) -> None:
    c = call(purpose)
    q = c.guardian_question()
    assert "Aarav" in q and "parent or guardian" in q
    assert not R.reveals_detail(q, c.pre_verification_allowed()), q


@pytest.mark.parametrize("line", ["Am I speaking with the parent or guardian of Aarav?",
                                  "Hello, I'm Riya. Is this a good time to talk?"])
def test_am_is_not_a_time(line: str) -> None:
    assert not R.reveals_detail(line, "Aarav Sahayak Demo School")


@pytest.mark.parametrize("line", ["The meeting is on 15th November.", "It is on Saturday",
                                  "at 10 a.m.", "class 5 section B"])
def test_details_are_caught_before_verification(line: str) -> None:
    assert R.reveals_detail(line, "Aarav Sahayak Demo School")


def test_emergency_busy_line_may_state_its_date() -> None:
    c = call("emergency_closure")
    assert not R.reveals_detail(c.busy_line(), c.pre_verification_allowed())


def test_invented_date_or_time_is_flagged_after_verification() -> None:
    c = call(event_date="14th November", event_time="10 AM")
    assert c.detail_mismatch("on November 14th at 10 AM") is None
    assert c.detail_mismatch("on the 14th of November at 10 a.m.") is None
    assert c.detail_mismatch("on November 15th at 10 AM") == "15 nov"
    assert c.detail_mismatch("at 11 AM") is not None


def test_parent_goodbye_after_delivery_triggers_the_close_path() -> None:
    c = to_delivered(call())
    d = c.on_parent("Thank you, good bye.")
    assert d.act is Act.PARENT_DONE and d.line == R.CLOSING_LINE


def test_end_call_uses_the_latest_parent_words_not_the_debounced_verdict() -> None:
    c = to_delivered(call())
    c.on_parent("Saturday morning")
    c.on_agent("Thank you for your time. Have a good day.")
    assert c.on_end_call(parent_last="Can you repeat the date?") == (False, "parent_question_open")
    assert c.on_end_call(parent_last="Thank you, good bye.")[0] is True


def test_end_call_reads_the_turn_still_being_spoken() -> None:
    c = to_delivered(call())
    c.on_parent("Yes I can come")
    c.on_agent("Will you be able to attend at that time?")
    assert c.on_end_call(pending="Thank you for your time. Have a good day.")[0] is True


def test_riya_goodbye_before_verification_may_end() -> None:
    c = call()
    c.on_parent("I'm baby")  # garbled "I'm busy": the model understood, the transcript did not
    assert c.on_end_call(pending="No problem. Thank you for your time. Have a good day.") == (
        True, "riya_closed_before_verification")
    assert call().on_end_call(pending="Is this a good time?")[0] is False


def test_soft_end_does_not_lock_the_stage() -> None:
    c = to_delivered(call())
    c.on_parent("yes I will come")
    c.on_agent("Thank you for your time. Have a good day.")
    assert c.on_end_call() == (True, "conversation_completed")
    assert c.stage is RiyaStage.DELIVERED  # the parent may still speak
    c.confirm_soft_end("conversation_completed")
    assert c.stage is RiyaStage.CLOSING


@pytest.mark.parametrize(("said", "ok"), [("wait one second", True), ("hmm what", False)])
def test_skip_turn_only_when_the_parent_asked_to_wait(said: str, ok: bool) -> None:
    c = to_delivered(call())
    assert c.skip_allowed(said)[0] is ok


def test_guardian_confirming_gets_a_thank_you_not_silence() -> None:
    # 2026-11-10: silence while the answer was checked was ~2.5 s of dead air on every call.
    c = call()
    c.on_parent("yes")
    c.on_agent("Am I speaking with the parent or guardian of Aarav?")
    assert c.skip_allowed("Yes, I'm his mother") == (False, "acknowledge")


@pytest.mark.parametrize(("text", "want"), [("हां, बताइए", "yes"), ("Ha. Bataiye.", "yes"),
                                            ("ಹೌದು, ಹೇಳಿ", "yes"), ("Haan do hi", "yes")])
def test_hindi_and_kannada_permission(text: str, want: str) -> None:
    assert R.availability(text) == want


@pytest.mark.parametrize("text", ["हा, मैं उसकी मां हूं।", "main uski maa hoon", "ನಾನು ಅವನ ತಾಯಿ"])
def test_hindi_and_kannada_guardian_statements(text: str) -> None:
    c = call()
    c.on_parent("yes")
    assert c.on_parent(text).act is Act.UNLOCK


def test_wrong_number_before_the_guardian_question() -> None:
    d = call().on_parent("Wrong number.")
    assert d.act is Act.CLOSE and d.branch == "wrong_person"


def test_fixed_lines_cover_every_close() -> None:
    lines = call().fixed_lines()
    for line in (R.CLOSING_LINE, R.WRONG_PERSON_LINE, call().busy_line(), call().guardian_question()):
        assert line in lines


@pytest.mark.parametrize("garbled", ["ha do, nona one-shot", "ok", "sure", "fine", "How the helium"])
def test_loose_words_never_verify_a_guardian(garbled: str) -> None:
    assert R.identity(garbled) == "unclear"


@pytest.mark.parametrize("clear", ["Yes", "yes speaking", "haan ji", "हां", "ಹೌದು", "I am his mother", "Ha mein uski maa hoon"])
def test_clear_yes_verifies(clear: str) -> None:
    assert R.identity(clear) == "yes"


# ---- 2026-11-09 handset call: "You are?" before verification, cannot-attend ----


def _at_identity() -> RiyaCall:
    c = call()
    c.on_parent("Yes, tell me.")
    c.on_agent(c.guardian_question())
    assert c.stage is RiyaStage.IDENTITY_ASKED
    return c


@pytest.mark.parametrize("said", ["You are?", "Who is this?", "Who's calling?", "What is this about?", "Which school?"])
def test_who_is_calling_is_answered_by_the_bridge_with_the_guardian_question(said: str) -> None:
    c = _at_identity()
    d = c.on_parent(said)
    assert d.act is Act.REASK
    assert "parent or guardian of Aarav" in d.line and "Sahayak Demo School" in d.line
    assert not R.reveals_detail(d.line, c.pre_verification_allowed())
    assert c.identity_state != "confirmed"


def test_reask_lines_are_detail_free_and_prerendered() -> None:
    c = call()
    for line in (c.who_line(), c.confirm_line()):
        assert not R.reveals_detail(line, c.pre_verification_allowed())
        assert line in c.fixed_lines()
        assert R._ASKS_GUARDIAN.search(line.lower())


def test_yes_after_a_muted_fragment_does_not_verify() -> None:
    """Handset 2026-11-09: guard muted Riya, parent heard "I'm …", said "Yes sir."."""
    c = _at_identity()
    d = c.on_privacy_block()
    assert d.act is Act.REASK
    c.on_agent("I'm …", interrupted=True)
    d = c.on_parent("Yes sir.")
    assert d.act is Act.REASK and c.identity_state != "confirmed"
    c.on_agent(d.line)  # the bridge played it in full
    assert c.on_parent("Yes sir.").act is Act.UNLOCK


def test_yes_after_a_heard_guardian_question_verifies() -> None:
    c = _at_identity()
    assert c.on_parent("Yes sir.").act is Act.UNLOCK


def test_explicit_guardian_statement_verifies_even_after_a_fragment() -> None:
    c = _at_identity()
    c.on_agent("I'm calling", interrupted=True)
    assert c.on_parent("Yes, I am his father.").act is Act.UNLOCK


def test_reasks_are_capped_then_unverified() -> None:
    c = _at_identity()
    for _ in range(2):
        d = c.on_parent("Who is this?")
        assert d.act is Act.REASK
        c.on_agent(d.line)
    d = c.on_parent("Who is this?")
    assert d.act is Act.CLOSE and d.branch == "unverified"


def _delivered() -> RiyaCall:
    c = _at_identity()
    assert c.on_parent("Yes.").act is Act.UNLOCK
    c.on_agent(
        "I'm calling to invite you to the parent-teacher meeting for your child's class, 5, section B, "
        "on 14th November at 10 AM. Will you be able to attend at that time?"
    )
    assert c.stage is RiyaStage.DELIVERED
    return c


def test_cannot_attend_without_time_cues_the_preferred_time_question_once() -> None:
    c = _delivered()
    c.on_parent("No, I would not and I would like to file a complaint against a teacher.")
    c.on_agent("I understand. Please contact the school about that. Is there anything else about the meeting?")
    cue = c.time_followup_cue()
    assert cue and "What day and time would suit you better?" in cue
    assert c.time_followup_cue() is None


def test_no_cue_when_riya_already_asked_for_a_time() -> None:
    c = _delivered()
    c.on_parent("I can't come that day.")
    c.on_agent("No problem. What day and time would suit you better?")
    assert c.time_followup_cue() is None


def test_no_cue_when_parent_named_an_alternative() -> None:
    c = _delivered()
    c.on_parent("I can't make it on the 14th, maybe Saturday morning?")
    c.on_agent("Saturday morning, noted. I will discuss this with the school authorities.")
    assert c.preferred_time_given and c.time_followup_cue() is None


def test_meeting_own_slot_is_not_an_alternative() -> None:
    c = _delivered()
    c.on_parent("I cannot attend on 14th November at 10 AM.")
    assert c.cannot_attend and not c.preferred_time_given


@pytest.mark.parametrize("said", ["Yes, I will come.", "No problem, I'll attend.", "Sure, I can make it."])
def test_can_attend_never_cues(said: str) -> None:
    c = _delivered()
    c.on_parent(said)
    c.on_agent("Sure, thank you for letting me know.")
    assert not c.cannot_attend and c.time_followup_cue() is None


def test_no_cue_after_parent_said_goodbye() -> None:
    c = _delivered()
    c.on_parent("No I can't. Bye.")
    c.on_agent("Thank you for your time. Have a good day.")
    assert c.time_followup_cue() is None



# ---- callback flow (Sampark parity) ------------------------------------------


def test_callback_tomorrow_asks_time_then_confirms() -> None:
    c = call()
    d = c.on_parent("I'm busy right now, call me tomorrow.")
    assert d.act is Act.SAY and d.line == R.CALLBACK_TIME_LINE
    d = c.on_parent("Around 6 PM.")
    assert d.act is Act.CUE and "tomorrow" in d.line and "6 PM" in d.line.upper()
    c.on_agent("So, tomorrow around 6 PM. Is that right?")
    d = c.on_parent("Yes.")
    assert d.act is Act.CLOSE and d.branch == "callback" and d.line == R.CALLBACK_DONE_LINE
    assert c.state_answers()["callback_requested_time"].lower().startswith("tomorrow")
    assert c.may_end() == (True, "callback")


def test_callback_with_day_and_time_in_one_breath_goes_straight_to_confirm() -> None:
    c = call()
    d = c.on_parent("Not now, call me after 6 PM tomorrow.")
    assert d.act is Act.CUE and c.callback_state == "confirming"


def test_callback_correction_reconfirms() -> None:
    c = call()
    c.on_parent("Call me back in the evening.")
    c.on_agent("So, this evening. Is that right?")
    d = c.on_parent("No, make it tomorrow at 7 PM.")
    assert d.act is Act.CUE and "7" in d.line and "tomorrow" in d.line
    assert c.callback_state == "confirming"


def test_callback_never_overrides_do_not_call() -> None:
    c = call()
    c.on_parent("I'm busy")
    d = c.on_parent("Don't call me again.")
    assert d.act is Act.CLOSE and d.branch == "stop"
    assert c.state_answers().get("stop_requested") == "yes"
    assert "callback_requested_time" not in c.state_answers()


def test_callback_requested_after_the_update() -> None:
    c = _delivered()
    d = c.on_parent("I'm driving, can you call me back later?")
    assert d.act is Act.SAY and c.stage is RiyaStage.CALLBACK


def test_callback_lines_are_detail_free_and_prerendered() -> None:
    c = call()
    for line in (R.CALLBACK_ASK_LINE, R.CALLBACK_TIME_LINE, R.CALLBACK_DONE_LINE):
        assert line in c.fixed_lines()
        assert not R.reveals_detail(line, c.pre_verification_allowed())
        assert "booked" not in line and "scheduled" not in line


def test_state_answers_report_identity() -> None:
    c = _at_identity()
    c.on_parent("Yes, I'm his mother.")
    assert c.state_answers()["recipient_confirmed"] == "yes"


# ---- Sampark link (Vobiz provider for Sampark) ----------------------------------


def test_sampark_refs_are_recognised_strictly() -> None:
    from sahayakai_agents.telephony import sampark_link as L

    assert L.is_sampark("sampark~org_1~" + "a" * 32)
    for bad in ("sampark~org~short", "riyatest123", "sampark~a.b~" + "a" * 32, "", None):
        assert not L.is_sampark(bad)


def test_sampark_signature_and_token_formats(monkeypatch: pytest.MonkeyPatch) -> None:
    import base64, hashlib, hmac  # noqa: E401
    from sahayakai_agents.telephony import sampark_link as L

    monkeypatch.setattr(L, "_key", lambda: b"k3y")
    hdr = L.sign_body('{"a":1}', now=1700000000)
    t, v1 = hdr.split(",")
    mac = base64.urlsafe_b64encode(hmac.new(b"k3y", b'1700000000.{"a":1}', hashlib.sha256).digest()).rstrip(b"=").decode()
    assert t == "t=1700000000" and v1 == f"v1={mac}"
    ref = "sampark~org~" + "b" * 32
    tok = L.mint_context_token(ref)
    assert tok.startswith(ref + ".") and tok.count(".") == 2


# ---- 2026-11-09 synthetic suite: behaviour call with an upset parent -------------


def _behaviour_delivered() -> RiyaCall:
    c = call("classroom_behaviour", behaviour_summary="difficulty paying attention during class")
    c.on_parent("Yes, go ahead.")
    c.on_agent(c.guardian_question())
    assert c.on_parent("Yes, I am his father.").act is Act.UNLOCK
    c.on_agent("I'm calling to share that your child has been having difficulty paying attention during class.")
    return c


def test_riya_may_not_close_right_after_the_parent_disagrees() -> None:
    """s04: 'He is not like that.' was answered with a goodbye."""
    c = _behaviour_delivered()
    c.on_parent("Why are you always complaining about my son? He is not like that.")
    ok, why = c.may_end("I understand your concern. Thank you for your time. Have a good day.",
                        parent_last="Why are you always complaining about my son? He is not like that.")
    assert not ok and why in ("parent_still_engaged", "parent_question_open", "answered_check_anything_else")


def test_short_wrap_up_lets_riya_close() -> None:
    c = _behaviour_delivered()
    c.on_parent("Okay, I will talk to him.")
    c.on_agent("Thank you for understanding. Thank you for your time. Have a good day.")
    assert c.may_end(parent_last="Okay, I will talk to him.") == (True, "conversation_completed")


@pytest.mark.parametrize("said", ["Can the teacher call me and explain properly?", "Could someone call me tomorrow?"])
def test_asking_for_a_teacher_call_starts_a_callback(said: str) -> None:
    c = _behaviour_delivered()
    d = c.on_parent(said)
    assert c.stage is RiyaStage.CALLBACK and d.act in (Act.SAY, Act.CUE)


def test_a_long_no_about_something_else_is_not_a_wrong_number() -> None:
    """s14: 'No, I won't be able to come that day.' closed the call as a wrong number."""
    c = _at_identity()
    d = c.on_parent("No, I won't be able to come that day.")
    assert d.act is not Act.CLOSE and c.identity_state != "denied"


def test_unclear_guardian_answer_is_reasked_once_in_the_cached_voice() -> None:
    c = _at_identity()
    d = c.on_parent("yet, her")
    assert d.act is Act.REASK and d.line == c.confirm_line()


def test_uncached_opener_is_spoken_by_the_model_not_skipped() -> None:
    """Sampark e2e: an unrendered school name made Riya skip the AI disclosure."""
    c = call()
    assert "ALREADY been spoken" in c.instruction()
    told = c.instruction(opener_spoken=False)
    assert "ALREADY been spoken" not in told
    assert f'Begin the call by saying exactly this, word for word, and nothing else: "{c.first_message()}"' in told


def test_repeating_the_parents_own_proposed_time_is_not_a_hallucination() -> None:
    """Real Sampark-Vobiz call 2026-11-09 (bc2c8ae0): '17 5:00 p.m.' was 'corrected' to 10 AM."""
    c = _delivered()
    c.on_parent("No, I will not be able to attend.")
    c.on_parent("17 5:00 p.m.")
    assert c.detail_mismatch("So, the 17th at 5:00 p.m. I will discuss this with the school.") is None
    # A time nobody said is still caught.
    assert c.detail_mismatch("The meeting is at 3 PM.") == "3:00 pm"


def test_unclear_availability_is_asked_again_not_guessed() -> None:
    """Real call 19:22: 'No, you're not allowed 10 to 12' — misheard; stored as 'no'."""
    c = call()
    d = c.on_parent("No, you're not allowed 10 to 12.")
    assert d.act is Act.REASK and d.line == R.AVAILABILITY_REASK_LINE
    assert c.good_time_to_talk == "no_answer" and c.stage is RiyaStage.OPENING
    assert R.AVAILABILITY_REASK_LINE in c.fixed_lines()
    assert c.state_answers()["good_time_to_talk"] == "no_answer"


def test_good_time_is_yes_when_the_parent_went_on_to_verify() -> None:
    c = call()
    c.on_parent("hmm")
    c.on_agent(c.guardian_question())
    c.on_parent("Yes, I am his mother.")
    assert c.state_answers()["good_time_to_talk"] == "yes"
