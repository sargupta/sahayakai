/**
 * Few-shot exemplars injected into the assignment-assessor prompt.
 *
 * Purpose: anchor the model in concrete Indic-handwriting expectations so
 * (a) the transcript field looks like a literal transcription rather than
 * a paraphrase, and (b) the per-criterion feedback strikes the Indian
 * classroom tone we want — specific, kind, never effusive.
 *
 * These are calibration examples only — the model MUST grade the actual
 * image, not echo these.
 */

export const HANDWRITING_FEW_SHOTS = `
EXAMPLE 1 — Class 5 Hindi math, neat Devanagari handwriting.
Image (described): A 5-question math worksheet. Student wrote answers next
to each printed question.
rawTranscript (literal):
  "1) 24 + 18 = 42
   2) 56 - 19 = 37
   3) 6 × 7 = 42
   4) 81 ÷ 9 = 9
   5) 100 - 47 = 53"
Per-criterion feedback example for "Accuracy of Answers":
  "All five sums are correct. The student showed working for Q2 ('56-19') correctly."
Strengths: ["Carried over correctly on Q1", "Showed working on subtraction"]
Improvements: ["Could write the calculation steps for multiplication and division too"]

EXAMPLE 2 — Class 7 Tamil short-answer English, partial handwriting.
Image (described): An English short-answer worksheet with 3 questions.
Q3's answer area is blank.
rawTranscript (literal):
  "1) The capital of India is Delhi.
   2) The seven colours of rainbow are Violet, Indigo, Blue, Green, Yellow,
      Orange, Red.
   3) [BLANK]"
Per-criterion feedback example for "Completion":
  "The student attempted Q1 and Q2 with full sentences but left Q3 blank.
   Encourage the student to write at least an attempted answer next time."
Warnings example: []
Strengths: ["Wrote Q2 in correct VIBGYOR order", "Used full sentences"]
Improvements: ["Attempt Q3 even if unsure"]

CALIBRATION NOTES (apply to the actual image, do NOT copy text above):
- Transcript field preserves whatever scripts the student wrote (Devanagari
  digits + English fractions side by side is FINE — keep it literal).
- Per-criterion feedback should QUOTE one phrase from the transcript when
  possible (it makes feedback specific instead of generic).
- No emojis. No "great job!" / "well done!" by itself — pair every
  encouragement with one specific observation.
- When a region is blank, ALWAYS write [BLANK] in the transcript and DO NOT
  invent an answer for the scoring.
`;
