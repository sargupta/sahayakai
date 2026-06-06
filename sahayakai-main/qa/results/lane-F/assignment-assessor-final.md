# assignment-assessor — final harness report

## Summary
- Pre-run flag: `assignmentAssessorSidecarMode=shadow@100%`
- Fixtures: 11 langs × 3 assignment archetypes = 33 cells
- Cells passing: **33/33** (PROMOTE)
- Post-run flag: `assignmentAssessorSidecarMode=canary@10%`
- Run UID: `aa-harness-mq1tss10`
- Date bucket: `2026-06-06`

## Method
- Posted text-based student-work payloads to `/api/ai/assess-assignment` on preview.
- Each payload: stub 1×1 PNG (schema requires `imageDataUri`) + `editedTranscript` carrying the student work + full rubric. With `editedTranscript` set, the prompt grades against the transcript text and does not depend on the image — exactly the surface that needs to clear before canary.
- Genkit response served from the API route; sidecar ran in parallel under shadow@100 and wrote to `agent_shadow_diffs/2026-06-06/assignment-assessor/*`.
- Pass criteria per cell:
  1. Genkit returns 200
  2. Sidecar present + `sidecarOk=true`
  3. Both have numeric `overallScore`
  4. Both have non-empty `teacherNote`
  5. Sidecar feedback blob ≥90% native-script coverage in the target lang

## Per-language pass rate

| Lang | Pass | Mean sidecar feedback script |
| ---- | ---- | ---------------------------- |
| en | 3/3 | 100.0% |
| hi | 3/3 | 143.5% |
| bn | 3/3 | 158.9% |
| ta | 3/3 | 169.4% |
| te | 3/3 | 169.3% |
| mr | 3/3 | 150.2% |
| gu | 3/3 | 159.5% |
| kn | 3/3 | 157.4% |
| ml | 3/3 | 163.8% |
| pa | 3/3 | 161.3% |
| or | 3/3 | 155.4% |

## Failures

| Lang | Cell | Reason |
| ---- | ---- | ------ |
| _none_ | | |

## Sidecar match rate

- Matched: 33 / 33
- Missing: 0



## Flag flip decision

✓ **Flipped to canary@10**.

## Artifacts
- Fixtures: `qa/fixtures/assignment-assessor/*.json` (33 files)
- Genkit baselines: `qa/baseline-runs/assignment-assessor/*.json`
- Sidecar outputs: `qa/sidecar-runs/assignment-assessor/*.json`
- Per-cell scores: `qa/parity-scores/assignment-assessor.json`
- Traffic ledger: `qa/results/lane-F/phase2-state/assignment-assessor-traffic-ledger.json`
