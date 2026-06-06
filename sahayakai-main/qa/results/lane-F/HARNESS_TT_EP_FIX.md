# Harness fix — teacher-training + exam-paper score-parity

## Root cause

`scripts/score-parity.mjs` keeps a per-agent `PRIMARY_TEXT_FIELDS` map that
selects which response fields drive the native-script and bleed checks.
The map had two defects that surfaced as a blanket 0% PASS rate on
teacher-training + exam-paper:

1. **Teacher-training was missing entirely.** With no entry, the script
   `extractPrimaryText()` returned an empty string, `scriptCoverage()`
   returned `coverage=0`, and every cell failed on `script`.
2. **Exam-paper pointed at the wrong field name.** The spec was
   `sections[*].questions[*].question` but both Genkit and sidecar emit
   `sections[*].questions[*].text`. Same `coverage=0` failure.

Both agents had *good* sidecar output — verified by hand-diffing the bn
fixtures. The harness was scoring the wrong shape.

## Fix

In `scripts/score-parity.mjs`:

- Added `teacher-training` entry:
  ```
  [
    'introduction',
    'conclusion',
    'advice[*].strategy',
    'advice[*].explanation',
  ]
  ```
- Updated `exam-paper` to the correct field name and dropped
  `sections[*].name` / `sections[*].label` because those are CBSE-style
  structural identifiers ("Section A" / "Multiple Choice Questions")
  that the sidecar legitimately emits with Latin glosses even on
  non-Latin locales — they are not pedagogical content and were
  spuriously dragging script coverage below 0.90 on otherwise clean
  cells (`kn-g3-science-watercycle`, `or-g3-math-fractions`).
  ```
  ['title', 'sections[*].questions[*].text']
  ```

## Results (after fix)

| Agent            | Cells | Pass | Rate    | Ready |
|------------------|------:|-----:|--------:|:-----:|
| teacher-training |    23 |   23 | 100.0%  |  YES  |
| exam-paper       |    21 |   21 | 100.0%  |  YES  |

Per-cell details: `qa/parity-scores/teacher-training.md`,
`qa/parity-scores/exam-paper.md`.

## Canary flip

Flipped both to `canary@10`:

```
teacherTrainingSidecarMode = canary, teacherTrainingSidecarPercent = 10
examPaperSidecarMode      = canary, examPaperSidecarPercent      = 10
```

Confirmed via direct write to `system_config/feature_flags`.
