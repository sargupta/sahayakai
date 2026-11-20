"""What may be said about a child, and to whom: the non-LLM privacy layer.

THE BREACH THIS EXISTS FOR (2026-10-11 real-phone test, Vobiz 41534a41-...)

The caller said "Hello", then "What", and VIDYA delivered the teacher's whole
message about the child. Identity was never confirmed. The only gate was on
the two school-data tools; the child's name, class, the reason for the call,
recent marks and the full message were in the model's instructions from the
first word, and the kickoff told it to name the child in the identity question.
A gate that the model can talk past is not a gate.

THE RULE NOW

1. Data minimisation (the authoritative gate). Until the bridge's own
   verification (dialogue.py, not the model) marks the caller verified, NO
   child-specific text is in any model context, cue, fixed line or tool
   result. There is nothing to leak.
2. Output check (defence in depth). Every sentence about to be spoken before
   verification is checked against the child's protected terms; a hit is
   blocked and logged. This catches a model that guesses, and a code path that
   forgot rule 1.

Protected terms are built from the outreach record by the bridge; the model
never sees the list.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher

from .flow import LINES

__all__ = ["ProtectedTerms", "fuzzy_name_in", "norm_tokens", "romanise"]

_WORD = re.compile(r"\w+", re.UNICODE)

#: Devanagari -> rough Latin, enough to compare a spoken name to a record.
_DEV = {
    "अ": "a",
    "आ": "a",
    "इ": "i",
    "ई": "i",
    "उ": "u",
    "ऊ": "u",
    "ए": "e",
    "ऐ": "ai",
    "ओ": "o",
    "औ": "au",
    "क": "k",
    "ख": "kh",
    "ग": "g",
    "घ": "gh",
    "च": "ch",
    "छ": "chh",
    "ज": "j",
    "झ": "jh",
    "ट": "t",
    "ठ": "th",
    "ड": "d",
    "ढ": "dh",
    "ण": "n",
    "त": "t",
    "थ": "th",
    "द": "d",
    "ध": "dh",
    "न": "n",
    "प": "p",
    "फ": "ph",
    "ब": "b",
    "भ": "bh",
    "म": "m",
    "य": "y",
    "र": "r",
    "ल": "l",
    "व": "v",
    "श": "sh",
    "ष": "sh",
    "स": "s",
    "ह": "h",
    "ा": "a",
    "ि": "i",
    "ी": "i",
    "ु": "u",
    "ू": "u",
    "े": "e",
    "ै": "ai",
    "ो": "o",
    "ौ": "au",
    "ं": "n",
    "ँ": "n",
    "्": "",
    "़": "",
    "ः": "h",
    "ृ": "ri",
}


def romanise(text: str) -> str:
    """Devanagari to rough Latin; everything else unchanged."""
    out: list[str] = []
    for i, ch in enumerate(text):
        r = _DEV.get(ch)
        if r is None:
            out.append(ch)
            continue
        out.append(r)
        # A consonant without a vowel sign or virama carries an inherent 'a',
        # except at the end of a word.
        if "क" <= ch <= "ह":
            nxt = text[i + 1] if i + 1 < len(text) else " "
            is_sign = "ा" <= nxt <= "्" or nxt in "ंँ़"
            if not is_sign and unicodedata.category(nxt).startswith("L"):
                out.append("a")
    return "".join(out)


def _fold(word: str) -> str:
    """Spelling-insensitive form: long vowels and doubled letters collapsed."""
    w = word.lower().replace("aa", "a").replace("ee", "i").replace("oo", "u")
    return re.sub(r"(.)\1+", r"\1", w)


def norm_tokens(text: str) -> list[str]:
    return [_fold(t) for t in _WORD.findall(romanise(text or "").lower()) if t]


def fuzzy_name_in(name: str, text: str) -> bool:
    """Does `text` contain `name` (one word), allowing for recogniser spelling?

    Names of four letters or more match at a similarity of 0.8 ("Ravi" ~
    "Ravee", "रवि"); shorter names must match exactly. Deliberately strict: a
    false match reads a child's record to a stranger.
    """
    target = _fold(name)
    if not target:
        return False
    for tok in norm_tokens(text):
        if tok == target:
            return True
        if len(target) >= 4 and SequenceMatcher(None, tok, target).ratio() >= 0.8:
            return True
    return False


#: Words that may appear in the generic school introduction and identity
#: question, or are too common to identify anyone.
_GENERIC = {
    "school",
    "teacher",
    "student",
    "child",
    "children",
    "parent",
    "parents",
    "guardian",
    "calling",
    "behalf",
    "message",
    "important",
    "assistant",
    "automated",
    "please",
    "thank",
    "thanks",
    "hello",
    "namaste",
    "would",
    "could",
    "about",
    "share",
    "before",
    "there",
    "their",
    "which",
    "class",
    "today",
    "where",
    "these",
    "those",
    "other",
    "every",
    "being",
    "should",
    "really",
    "regarding",
    "kindly",
    "dear",
    "respected",
    "regards",
    "sincerely",
    "contact",
    "discuss",
    "further",
    "support",
    "help",
    "together",
    "time",
    "your",
    "with",
    "this",
    "that",
    "from",
    "have",
    "will",
    "they",
    "them",
    "what",
    "when",
    "know",
    "name",
    "may",
    "speak",
    "sorry",
    "again",
    "confirm",
    "goodbye",
    "great",
}


def _allowed_vocabulary() -> frozenset[str]:
    """Generic words plus every word of the bridge's own fixed lines, FOLDED.

    Folded like the tokens they are compared with: the first version compared
    folded tokens ("mesage") with unfolded words ("message"), so every generic
    word with a double letter was protected whenever the teacher's letter used
    it, and on staging the guard blocked VIDYA's own identity question.

    The fixed lines (flow.LINES) are reviewed templates that carry only the
    school's and teacher's names, so no word of theirs is child data.
    """
    words = set(_GENERIC)
    for table in LINES.values():
        for template in table.values():
            words.update(norm_tokens(template.format(school="", teacher="", ai="")))
    return frozenset(_fold(w) for w in words)


_ALLOWED = _allowed_vocabulary()


@dataclass(frozen=True)
class ProtectedTerms:
    """Child-specific words that must not be spoken before verification."""

    terms: frozenset[str]
    numbers: frozenset[str]

    @classmethod
    def build(
        cls,
        *,
        student_name: str | None,
        class_name: str | None,
        message: str | None,
        extra: str | None,
        allowed: str,
    ) -> ProtectedTerms:
        allowed_names = set(norm_tokens(allowed))
        allow = allowed_names | _ALLOWED
        terms: set[str] = set()
        for t in norm_tokens(student_name or ""):
            # A word the school's or teacher's own name contains is said in the
            # introduction anyway, so it cannot disclose anything; protecting it
            # blocked the opening line itself (a "Sharma" taught by Ms. Sharma,
            # or a child surnamed like the school, got a call that never began).
            if len(t) >= 3 and t not in allowed_names:
                terms.add(t)
        for source in (class_name, message, extra):
            for t in norm_tokens(source or ""):
                if len(t) >= 5 and t not in allow and not t.isdigit():
                    terms.add(t)
        numbers = {
            n
            for n in re.findall(r"\d+", " ".join(x or "" for x in (class_name, message, extra)))
            if n not in set(re.findall(r"\d+", allowed))
        }
        return cls(frozenset(terms), frozenset(numbers))

    def leaks(self, text: str) -> list[str]:
        """The protected terms (or numbers) present in `text`."""
        found = [t for t in norm_tokens(text) if t in self.terms]
        found += [n for n in re.findall(r"\d+", text or "") if n in self.numbers]
        return sorted(set(found))
