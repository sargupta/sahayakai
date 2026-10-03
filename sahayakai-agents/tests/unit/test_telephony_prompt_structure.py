"""Class gates for the sectioned live-call prompt and its personas.

The key phrases below were taken from the monolithic `_BASE` BEFORE it was
restructured, so a rule cannot be dropped by a later edit without a failing
test naming it.
"""

from __future__ import annotations

import re

import pytest

from sahayakai_agents.telephony.personas import (
    PERSONAS,
    REASON_TO_PERSONA,
    SUPPORTED_LANGUAGES,
    persona_for_reason,
)
from sahayakai_agents.telephony.prompt import (
    _LANGUAGE_CODES,
    CallContext,
    build_parent_call_instruction,
)

#: attendance.ts OutreachReason.
OUTREACH_REASONS = (
    "consecutive_absences",
    "poor_performance",
    "behavioral_concern",
    "positive_feedback",
)

SECTION_ORDER = [
    "Personality",
    "Goal",
    "Conversation flow",
    "Tools",
    "Guardrails",
    "Language",
]

# Native-script instruction: the same sentence for every language.
NATIVE_SCRIPT_PHRASE = "in its own native script, never Latin transliteration"


def _flat(text: str) -> str:
    return re.sub(r"\s+", " ", text)


def _sections(text: str) -> dict[str, str]:
    """Split on top-level `# ` headings (not `## `)."""
    parts = re.split(r"(?m)^# (.+)$", text)
    # parts = [preamble, name1, body1, name2, body2, ...]
    return {parts[i].strip(): _flat(parts[i + 1]) for i in range(1, len(parts), 2)}


def _render(language: str = "English", reason: str | None = None, **kw: object) -> str:
    return build_parent_call_instruction(
        CallContext(
            student_name="Aarav",
            teacher_name="Mrs Rao",
            school_name="Darjeeling Public School",
            language=language,
            reason=reason,
            message="Aarav is doing well.",
            **kw,  # type: ignore[arg-type]
        )
    )


#: (key phrase from the OLD prompt, sections it may live in). Whitespace-normalised.
OLD_RULES: list[tuple[str, tuple[str, ...]]] = [
    # Who you are / disclosure
    ("Never introduce yourself with a product or assistant name", ("Guardrails",)),
    ("never call yourself Sahayak, SahayakAI or a bot", ("Guardrails",)),
    ("do not pretend to be one", ("Guardrails",)),
    ("you are an assistant calling for the teacher", ("Guardrails",)),
    ("Do not volunteer it otherwise", ("Guardrails",)),
    ("Never give yourself a personal name", ("Guardrails", "Conversation flow")),
    ("never claim to be the teacher", ("Guardrails", "Conversation flow")),
    # Language
    ("Speak English, and keep speaking English", ("Language",)),
    ("NOT a request to switch", ("Language",)),
    ("not mixed, in its own native script, never Latin transliteration", ("Language",)),
    ("is a complete failure", ("Language",)),
    ("8 kHz phone line", ("Language",)),
    ("never reply in any other language", ("Language",)),
    # How to talk
    ("REACT FIRST", ("Conversation flow",)),
    ("THREE OR FOUR SHORT SENTENCES AT MOST", ("Conversation flow",)),
    ("ONE IDEA AT A TIME", ("Conversation flow",)),
    ("VALIDATE it first, then offer ONE practical suggestion", ("Conversation flow",)),
    ("NEVER narrate the mechanics of the call", ("Conversation flow",)),
    ("If they interrupt with a real question, stop and answer THAT", ("Conversation flow",)),
    ("slow down and say it again in ONE simpler sentence", ("Conversation flow",)),
    # Introduce once
    ("do NOT start again with the school and the teacher", ("Conversation flow",)),
    # Did not understand
    ("do NOT invent an answer and do NOT carry on with your message", ("Conversation flow",)),
    ("say you could not hear clearly and ask them to say it again", ("Conversation flow",)),
    # Opening
    ("TWO STEPS, NOT ONE", ("Conversation flow",)),
    ("do not say namaste again", ("Conversation flow",)),
    ("the school by name, and the teacher by name", ("Conversation flow",)),
    ("Then STOP and wait", ("Conversation flow",)),
    ("Let them invite you, THEN speak", ("Conversation flow",)),
    ("ESSENTIALLY AS WRITTEN", ("Conversation flow",)),
    ("You may NOT summarise it, shorten it, reorder it", ("Conversation flow",)),
    ("that specific thing must be spoken", ("Conversation flow",)),
    # Go ahead
    ("NOT asking for it again", ("Conversation flow",)),
    ("Never re-deliver the message in response", ("Conversation flow",)),
    ("moves the conversation on", ("Conversation flow",)),
    # Sounding like a person
    ("DO NOT ask a question at the end of every turn", ("Conversation flow",)),
    ("Vary how you begin", ("Conversation flow",)),
    ('Never "furthermore"', ("Conversation flow",)),
    ("four-word reply", ("Conversation flow",)),
    ("Do not summarise the conversation back", ("Conversation flow",)),
    ("Do not thank them more than once", ("Conversation flow",)),
    ("I understand your concern", ("Conversation flow",)),
    ("thank you for sharing that", ("Conversation flow",)),
    # Practical help
    ("Offer ONE, not a list", ("Conversation flow",)),
    # Wrapping up
    ("at most six exchanges", ("Conversation flow",)),
    ("Say ONE short warm closing line", ("Conversation flow",)),
    ("Then call the `end_call` tool, with the reason", ("Conversation flow",)),
    ("do not wait to be asked twice", ("Conversation flow",)),
    # Keypad, voicemail, opt-out (non-negotiable)
    ("NO KEYPAD ESCAPE", ("Guardrails",)),
    ("Keeping someone on the phone who has asked to go", ("Guardrails",)),
    ("ANSWERING MACHINE", ("Guardrails",)),
    ("Leave ONE short message", ("Guardrails",)),
    ('end the call with reason "voicemail"', ("Guardrails",)),
    # Tool reasons
    ('"parent_finished"', ("Tools",)),
    ('"call_back_later"', ("Tools",)),
    ('"wrong_number"', ("Tools",)),
    ('"voicemail"', ("Tools",)),
    ('"opt_out"', ("Tools",)),
    # Names
    ("Use only the names listed under WHAT YOU KNOW", ("Guardrails",)),
    ("worse than using none", ("Guardrails",)),
    # Hard rules
    ("Discuss only this child and this message", ("Guardrails",)),
    ("offer to have the teacher call", ("Guardrails",)),
    ("Never invent marks, attendance figures, dates or incidents", ("Guardrails",)),
    ("Quote academic detail only if the parent asks for it", ("Guardrails",)),
    ("Never ask for money, bank details, OTPs or any document number", ("Guardrails",)),
    ("tell them not to share it with anyone", ("Guardrails",)),
    ("asks not to be called again, acknowledge warmly, say it has been noted", ("Guardrails",)),
    ("Do not argue, do not ask why", ("Guardrails",)),
    # Tone
    ("Like a kind teacher talking to a parent over chai", ("Personality",)),
    (
        "A parent in a village deserves exactly the dignity a parent in a city gets",
        ("Personality",),
    ),
    ("never use school jargon, never sound like a notice", ("Guardrails",)),
]

#: Rules that must sit under `# Guardrails` specifically.
NON_NEGOTIABLES: list[tuple[str, str]] = [
    (
        "money / bank details / OTP",
        "Never ask for money, bank details, OTPs or any document number",
    ),
    ("never invent facts", "Never invent marks, attendance figures, dates or incidents"),
    ("marks only if asked", "Quote marks only if the parent asks"),
    ("no shaming", "Never shame or blame the parent or the child"),
    ("no product name", "never call yourself Sahayak, SahayakAI or a bot"),
    ("AI disclosure", "you are an assistant calling for the teacher"),
    ("voicemail", "ANSWERING MACHINE"),
    ("no promises for the school", "Never promise anything on the school's behalf"),
    ("opt-out", "asks not to be called again, acknowledge warmly"),
    ("keypad / busy", "NO KEYPAD ESCAPE"),
    ("names not given", "Use only the names listed under WHAT YOU KNOW"),
    ("focus guardrail", "Stay on this child's school matter"),
    ("call-back offer", "Offer a call-back from the school"),
]


class TestStructure:
    def test_sections_present_in_order(self) -> None:
        text = _render()
        headings = re.findall(r"(?m)^# (.+)$", text)
        ordered = [h for h in headings if h in SECTION_ORDER]
        assert ordered == SECTION_ORDER

    def test_no_section_is_empty(self) -> None:
        for name, body in _sections(_render()).items():
            assert len(body) > 40, name


class TestOldRulesSurvive:
    @pytest.mark.parametrize(("phrase", "allowed"), OLD_RULES)
    def test_rule_survives_in_the_right_section(
        self, phrase: str, allowed: tuple[str, ...]
    ) -> None:
        secs = _sections(_render())
        found_in = [name for name, body in secs.items() if phrase in body]
        assert found_in, f"rule dropped: {phrase!r}"
        assert set(found_in) & set(allowed), f"{phrase!r} is under {found_in}, expected {allowed}"

    @pytest.mark.parametrize("lang", sorted(_LANGUAGE_CODES))
    def test_language_interpolated_in_every_language(self, lang: str) -> None:
        text = _flat(_render(lang))
        assert f"Speak {lang}, and keep speaking {lang}" in text

    def test_message_and_facts_still_rendered(self) -> None:
        text = _render()
        assert "<<<MESSAGE\nAarav is doing well.\nMESSAGE>>>" in text
        assert "The child is Aarav." in text
        assert "calling on behalf of Mrs Rao" in text

    def test_school_name_is_used_never_ours(self) -> None:
        sec = _sections(_render())["Personality"]
        assert "Darjeeling Public School" in sec
        assert "SahayakAI" not in sec


class TestGuardrailsHoldTheNonNegotiables:
    @pytest.mark.parametrize(("label", "phrase"), NON_NEGOTIABLES)
    def test_rule_is_under_guardrails(self, label: str, phrase: str) -> None:
        guard = _sections(_render())["Guardrails"]
        assert phrase in guard, f"{label} missing from # Guardrails"

    def test_focus_guardrail_offers_a_callback(self) -> None:
        guard = _sections(_render())["Guardrails"]
        assert "other children" in guard and "call-back from the school" in guard

    def test_guardrails_are_a_list_of_distinct_rules(self) -> None:
        raw = _render().split("# Guardrails")[1].split("\n# ")[0]
        assert len(re.findall(r"(?m)^- ", raw)) >= len(NON_NEGOTIABLES) - 2


class TestPersonas:
    def test_every_outreach_reason_maps_to_a_persona(self) -> None:
        for reason in OUTREACH_REASONS:
            assert REASON_TO_PERSONA[reason] in PERSONAS
            assert persona_for_reason(reason).id == REASON_TO_PERSONA[reason]

    def test_mapping_choices(self) -> None:
        assert persona_for_reason("positive_feedback").id == "recognition"
        for r in ("consecutive_absences", "poor_performance", "behavioral_concern"):
            assert persona_for_reason(r).id == "class_teacher_request"

    def test_unknown_or_missing_reason_falls_back_to_the_gentlest(self) -> None:
        for r in (None, "", "something_new"):
            assert persona_for_reason(r).id == "class_teacher_request"

    def test_five_personas_exist(self) -> None:
        assert set(PERSONAS) == {
            "class_teacher_request",
            "recognition",
            "fees_accounts",
            "closure_emergency",
            "ptm_event_invite",
        }

    def test_supported_languages_cover_the_app_languages(self) -> None:
        assert set(_LANGUAGE_CODES) <= set(SUPPORTED_LANGUAGES)
        assert "Nepali" in SUPPORTED_LANGUAGES

    @pytest.mark.parametrize("pid", sorted(PERSONAS))
    def test_persona_shape(self, pid: str) -> None:
        p = PERSONAS[pid]
        assert p.id == pid
        assert re.fullmatch(r"\d+\.\d+\.\d+", p.version)
        assert 2 <= len(p.persona.split()) <= 5
        assert 2 <= len(p.emotions) <= 3
        assert p.delivery and p.length_rule
        assert set(p.language_notes) == set(SUPPORTED_LANGUAGES)
        for lang, note in p.language_notes.items():
            assert note.pacing and note.politeness, (pid, lang)

    def test_personas_are_frozen(self) -> None:
        with pytest.raises(AttributeError):
            PERSONAS["recognition"].version = "9"  # type: ignore[misc]

    def test_personality_follows_reason_and_explicit_override(self) -> None:
        rec = _sections(_render(reason="positive_feedback"))["Personality"]
        assert PERSONAS["recognition"].persona in rec
        fees = _sections(_render(persona=PERSONAS["fees_accounts"]))["Personality"]
        assert PERSONAS["fees_accounts"].persona in fees

    def test_language_note_is_rendered_for_the_calls_language(self) -> None:
        sec = _sections(_render("Nepali"))["Personality"]
        assert PERSONAS["class_teacher_request"].language_notes["Nepali"].politeness in sec


class TestForbiddenPhrasesPerPersona:
    @pytest.mark.parametrize("pid", sorted(PERSONAS))
    @pytest.mark.parametrize("lang", SUPPORTED_LANGUAGES)
    def test_rendered_prompt_has_no_forbidden_phrase(self, pid: str, lang: str) -> None:
        text = _render(lang, persona=PERSONAS[pid]).lower()
        for phrase in PERSONAS[pid].forbidden_phrases:
            assert phrase.lower() not in text, (pid, lang, phrase)

    @pytest.mark.parametrize("pid", sorted(PERSONAS))
    def test_every_persona_declares_forbidden_phrases(self, pid: str) -> None:
        assert PERSONAS[pid].forbidden_phrases

    def test_fees_persona_has_threat_words_forbidden(self) -> None:
        f = PERSONAS["fees_accounts"].forbidden_phrases
        assert {"penalty", "consequence", "legal action"} <= set(f)


class TestNativeScriptInEveryLanguage:
    @pytest.mark.parametrize("lang", SUPPORTED_LANGUAGES)
    @pytest.mark.parametrize("reason", [None, *OUTREACH_REASONS])
    def test_native_script_instruction_present(self, lang: str, reason: str | None) -> None:
        lang_section = _sections(_render(lang, reason=reason))["Language"]
        assert NATIVE_SCRIPT_PHRASE in lang_section
        assert f"Your ENTIRE reply is in {lang}" in lang_section
