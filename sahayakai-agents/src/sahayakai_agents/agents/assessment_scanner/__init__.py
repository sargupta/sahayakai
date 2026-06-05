"""Assessment Scanner agent -- multimodal vision OCR + grading.

Two-pass strategy (mirror of the TS Genkit flow):
  PASS 1 -- per-page extraction (questions + handwritten answers, verbatim)
  PASS 2 -- rubric-grounded scoring with NCERT context

Sidecar version: phase-w.alpha.
"""
