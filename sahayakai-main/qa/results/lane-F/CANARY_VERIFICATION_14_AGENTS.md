# Canary Verification — 14 canary@10 agents

Generated: 2026-06-06T08:44:03.112Z
Base: https://sahayakai-hotfix-resilience-zwydpvyuca-as.a.run.app
Probes per agent: 3
UID selection: deterministic bucket<10 (djb2 hash mod 100 — same as dispatcher).

## Summary

- Agents healthy (sidecar dominant): **0/14**
- Agents degraded: **14/14**
- Aggregate sidecar dispatches: 0
- Aggregate genkit_fallback dispatches: 36
- Aggregate genkit (off/shadow) dispatches: 0
- Aggregate probes with no matched log: 6

## Per-agent verdict

| Agent | Flag | Probes | HTTP OK | Avg ms | sidecar | genkit | fallback | no-log | fb% | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| instant-answer | instantAnswer | 3 | 3 | 4454 | 0 | 0 | 3 | 0 | 100% | FAIL_FALLBACK_DOMINANT |
| quiz | quiz | 3 | 3 | 22545 | 0 | 0 | 3 | 0 | 100% | FAIL_FALLBACK_DOMINANT |
| worksheet | worksheet | 3 | 3 | 18511 | 0 | 0 | 3 | 0 | 100% | FAIL_FALLBACK_DOMINANT |
| lesson-plan | lessonPlan | 3 | 3 | 1425 | 0 | 0 | 3 | 0 | 100% | FAIL_FALLBACK_DOMINANT |
| video-storyteller | videoStoryteller | 3 | 3 | 7388 | 0 | 0 | 3 | 0 | 100% | FAIL_FALLBACK_DOMINANT |
| rubric | rubric | 3 | 3 | 11262 | 0 | 0 | 3 | 0 | 100% | FAIL_FALLBACK_DOMINANT |
| parent-message | parentMessage | 3 | 3 | 5250 | 0 | 0 | 3 | 0 | 100% | FAIL_FALLBACK_DOMINANT |
| assessment-scanner | assessmentScanner | 3 | 0 | 515 | 0 | 0 | 0 | 3 | 0% | NO_LOGS_MATCHED |
| assignment-assessor | assignmentAssessor | 3 | 0 | 551 | 0 | 0 | 0 | 3 | 0% | NO_LOGS_MATCHED |
| teacher-training | teacherTraining | 3 | 3 | 8874 | 0 | 0 | 3 | 0 | 100% | FAIL_FALLBACK_DOMINANT |
| exam-paper | examPaper | 3 | 3 | 67860 | 0 | 0 | 3 | 0 | 100% | FAIL_FALLBACK_DOMINANT |
| virtual-field-trip | virtualFieldTrip | 3 | 3 | 14175 | 0 | 0 | 3 | 0 | 100% | FAIL_FALLBACK_DOMINANT |
| visual-aid | visualAid | 3 | 3 | 29992 | 0 | 0 | 3 | 0 | 100% | FAIL_FALLBACK_DOMINANT |
| avatar | avatar | 3 | 3 | 10513 | 0 | 0 | 3 | 0 | 100% | FAIL_FALLBACK_DOMINANT |

## Sidecar staging diagnostics (for agents that fell back)

### instant-answer

- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/instant-answer/answer` • 0.007789359s • 2026-06-06T08:41:35.739850Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/instant-answer/answer` • 0.009845211s • 2026-06-06T08:31:12.210447Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/instant-answer/answer` • 0.008072241s • 2026-06-06T08:31:06.454741Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/instant-answer/answer` • 0.007873617s • 2026-06-06T08:30:59.959845Z

### quiz

- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/quiz/generate` • 0.007722007s • 2026-06-06T08:32:12.223312Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/quiz/generate` • 0.010551327s • 2026-06-06T08:31:48.704959Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/quiz/generate` • 0.008068899s • 2026-06-06T08:31:17.855471Z

### worksheet

- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/worksheet/generate` • 0.007561660s • 2026-06-06T08:33:07.458915Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/worksheet/generate` • 0.010244372s • 2026-06-06T08:32:50.630885Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/worksheet/generate` • 0.007571099s • 2026-06-06T08:32:30.285386Z

### lesson-plan

- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/lesson-plan/generate` • 0.008062079s • 2026-06-06T08:33:36.176164Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/lesson-plan/generate` • 0.010899999s • 2026-06-06T08:33:33.303939Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/lesson-plan/generate` • 0.009448409s • 2026-06-06T08:33:30.342574Z

### video-storyteller

- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/video-storyteller/recommend-queries` • 0.007774750s • 2026-06-06T08:41:50.234637Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/video-storyteller/recommend-queries` • 0.008647460s • 2026-06-06T08:33:57.393499Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/video-storyteller/recommend-queries` • 0.008323040s • 2026-06-06T08:33:48.732279Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/video-storyteller/recommend-queries` • 0.007569608s • 2026-06-06T08:33:38.814302Z

### rubric

- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/rubric/generate` • 0.008222837s • 2026-06-06T08:41:39.356223Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/rubric/generate` • 0.008386319s • 2026-06-06T08:34:33.037381Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/rubric/generate` • 0.008609909s • 2026-06-06T08:34:18.646755Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/rubric/generate` • 0.007478487s • 2026-06-06T08:34:05.919974Z

### parent-message

- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/parent-message/generate` • 0.007315360s • 2026-06-06T08:34:57.864909Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/parent-message/generate` • 0.011816047s • 2026-06-06T08:34:50.795862Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/parent-message/generate` • 0.008255957s • 2026-06-06T08:34:44.345376Z

### teacher-training

- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/teacher-training/advise` • 0.008565690s • 2026-06-06T08:35:37.277621Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/teacher-training/advise` • 0.008001280s • 2026-06-06T08:35:25.777427Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/teacher-training/advise` • 0.013063540s • 2026-06-06T08:35:16.362296Z

### exam-paper

- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/exam-paper/generate` • 0.009164379s • 2026-06-06T08:38:22.318489Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/exam-paper/generate` • 0.007883137s • 2026-06-06T08:37:05.047730Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/exam-paper/generate` • 0.010601783s • 2026-06-06T08:35:47.488230Z

### virtual-field-trip

- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/virtual-field-trip/plan` • 0.008594859s • 2026-06-06T08:39:47.530513Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/virtual-field-trip/plan` • 0.013290298s • 2026-06-06T08:39:33.240836Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/virtual-field-trip/plan` • 0.008495028s • 2026-06-06T08:39:15.888750Z

### visual-aid

- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/visual-aid/generate` • 0.007938960s • 2026-06-06T08:41:08.216698Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/visual-aid/generate` • 0.008213679s • 2026-06-06T08:40:37.551658Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/visual-aid/generate` • 0.009542419s • 2026-06-06T08:40:03.020821Z

### avatar

- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/avatar-generator/generate` • 0.008389060s • 2026-06-06T08:42:03.535981Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/avatar-generator/generate` • 0.008625329s • 2026-06-06T08:41:49.355771Z
- HTTP 401 • `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app/v1/avatar-generator/generate` • 0.008523756s • 2026-06-06T08:41:38.038141Z


## Recommendation

**ALERT — 12 agents show >50% genkit_fallback. Recommend IMMEDIATE revert to shadow@100 for:**
- instant-answer
- quiz
- worksheet
- lesson-plan
- video-storyteller
- rubric
- parent-message
- teacher-training
- exam-paper
- virtual-field-trip
- visual-aid
- avatar

Re-run after revert to confirm shadow path still records sidecar parity diffs in Firestore.

## Per-probe details

### instant-answer

| uid | bucket | http | ms | source | mode | sidecarErr | sidecarMs |
|---|---|---|---|---|---|---|---|
| `canary-vf-instant-answer-0-1780734657356-0` | 3 | 200 | 5174 | genkit_fallback | canary | http/InstantAnswerSidecarHttpError | 51 |
| `canary-vf-instant-answer-1-1780734665168-18` | 9 | 200 | 4097 | genkit_fallback | canary | http/InstantAnswerSidecarHttpError | 34 |
| `canary-vf-instant-answer-2-1780734670831-70` | 1 | 200 | 4090 | genkit_fallback | canary | http/InstantAnswerSidecarHttpError | 39 |

### quiz

| uid | bucket | http | ms | source | mode | sidecarErr | sidecarMs |
|---|---|---|---|---|---|---|---|
| `canary-vf-quiz-0-1780734676494-20` | 8 | 200 | 29160 | genkit_fallback | canary | http | 46 |
| `canary-vf-quiz-1-1780734707242-10` | 4 | 200 | 22057 | genkit_fallback | canary | http | 50 |
| `canary-vf-quiz-2-1780734730891-40` | 6 | 200 | 16417 | genkit_fallback | canary | http | 48 |

### worksheet

| uid | bucket | http | ms | source | mode | sidecarErr | sidecarMs |
|---|---|---|---|---|---|---|---|
| `canary-vf-worksheet-0-1780734748876-33` | 9 | 200 | 18832 | genkit_fallback | canary | http | 61 |
| `canary-vf-worksheet-1-1780734769291-10` | 5 | 200 | 15318 | genkit_fallback | canary | http | 41 |
| `canary-vf-worksheet-2-1780734786206-30` | 7 | 200 | 21384 | genkit_fallback | canary | http | 42 |

### lesson-plan

| uid | bucket | http | ms | source | mode | sidecarErr | sidecarMs |
|---|---|---|---|---|---|---|---|
| `canary-vf-lesson-plan-0-1780734809055-60` | 6 | 200 | 1433 | genkit_fallback | canary | http/LessonPlanSidecarHttpError | 64 |
| `canary-vf-lesson-plan-1-1780734812033-33` | 9 | 200 | 1484 | genkit_fallback | canary | http/LessonPlanSidecarHttpError | 28 |
| `canary-vf-lesson-plan-2-1780734814971-1` | 0 | 200 | 1357 | genkit_fallback | canary | http/LessonPlanSidecarHttpError | 24 |

### video-storyteller

| uid | bucket | http | ms | source | mode | sidecarErr | sidecarMs |
|---|---|---|---|---|---|---|---|
| `canary-vf-video-storyteller-0-1780734817814-60` | 9 | 200 | 8362 | genkit_fallback | canary | http | 47 |
| `canary-vf-video-storyteller-1-1780734827581-90` | 5 | 200 | 7089 | genkit_fallback | canary | http | 40 |
| `canary-vf-video-storyteller-2-1780734836267-10` | 9 | 200 | 6713 | genkit_fallback | canary | http | 33 |

### rubric

| uid | bucket | http | ms | source | mode | sidecarErr | sidecarMs |
|---|---|---|---|---|---|---|---|
| `canary-vf-rubric-0-1780734844551-20` | 5 | 200 | 11286 | genkit_fallback | canary | http/RubricSidecarHttpError | 56 |
| `canary-vf-rubric-1-1780734857376-10` | 2 | 200 | 12870 | genkit_fallback | canary | http/RubricSidecarHttpError | 39 |
| `canary-vf-rubric-2-1780734871803-29` | 0 | 200 | 9631 | genkit_fallback | canary | http/RubricSidecarHttpError | 38 |

### parent-message

| uid | bucket | http | ms | source | mode | sidecarErr | sidecarMs |
|---|---|---|---|---|---|---|---|
| `canary-vf-parent-message-0-1780734882923-40` | 3 | 200 | 5130 | genkit_fallback | canary | http/ParentMessageSidecarHttpError | 66 |
| `canary-vf-parent-message-1-1780734889632-11` | 0 | 200 | 5521 | genkit_fallback | canary | http/ParentMessageSidecarHttpError | 33 |
| `canary-vf-parent-message-2-1780734896612-10` | 4 | 200 | 5098 | genkit_fallback | canary | http/ParentMessageSidecarHttpError | 31 |

### assessment-scanner

| uid | bucket | http | ms | source | mode | sidecarErr | sidecarMs |
|---|---|---|---|---|---|---|---|
| `canary-vf-assessment-scanner-0-1780734903254-0` | 7 | 400 | 485 | — | — |  |  |
| `canary-vf-assessment-scanner-1-1780734905305-27` | 0 | 400 | 517 | — | — |  |  |
| `canary-vf-assessment-scanner-2-1780734907254-34` | 0 | 400 | 542 | — | — |  |  |

### assignment-assessor

| uid | bucket | http | ms | source | mode | sidecarErr | sidecarMs |
|---|---|---|---|---|---|---|---|
| `canary-vf-assignment-assessor-0-1780734909217-0` | 4 | 400 | 538 | — | — |  |  |
| `canary-vf-assignment-assessor-1-1780734911212-130` | 1 | 400 | 569 | — | — |  |  |
| `canary-vf-assignment-assessor-2-1780734913132-30` | 8 | 400 | 546 | — | — |  |  |

### teacher-training

| uid | bucket | http | ms | source | mode | sidecarErr | sidecarMs |
|---|---|---|---|---|---|---|---|
| `canary-vf-teacher-training-0-1780734915091-24` | 9 | 200 | 8065 | genkit_fallback | canary | http | 89 |
| `canary-vf-teacher-training-1-1780734924597-22` | 9 | 200 | 9980 | genkit_fallback | canary | http | 32 |
| `canary-vf-teacher-training-2-1780734936055-50` | 5 | 200 | 8576 | genkit_fallback | canary | http | 54 |

### exam-paper

| uid | bucket | http | ms | source | mode | sidecarErr | sidecarMs |
|---|---|---|---|---|---|---|---|
| `canary-vf-exam-paper-0-1780734946096-0` | 1 | 202 | 75668 | genkit_fallback | canary | http | 84 |
| `canary-vf-exam-paper-1-1780735023307-25` | 9 | 202 | 75867 | genkit_fallback | canary | http | 50 |
| `canary-vf-exam-paper-2-1780735100868-11` | 9 | 200 | 52046 | genkit_fallback | canary | http | 51 |

### virtual-field-trip

| uid | bucket | http | ms | source | mode | sidecarErr | sidecarMs |
|---|---|---|---|---|---|---|---|
| `canary-vf-virtual-field-trip-0-1780735154470-20` | 3 | 200 | 15790 | genkit_fallback | canary | http | 99 |
| `canary-vf-virtual-field-trip-1-1780735171787-0` | 2 | 200 | 12756 | genkit_fallback | canary | http | 44 |
| `canary-vf-virtual-field-trip-2-1780735186185-29` | 0 | 200 | 13980 | genkit_fallback | canary | http | 36 |

### visual-aid

| uid | bucket | http | ms | source | mode | sidecarErr | sidecarMs |
|---|---|---|---|---|---|---|---|
| `canary-vf-visual-aid-0-1780735201717-90` | 6 | 200 | 32733 | genkit_fallback | canary | http | 62 |
| `canary-vf-visual-aid-1-1780735236009-100` | 9 | 200 | 29078 | genkit_fallback | canary | http | 54 |
| `canary-vf-visual-aid-2-1780735266763-70` | 6 | 200 | 28165 | genkit_fallback | canary | http | 44 |

### avatar

| uid | bucket | http | ms | source | mode | sidecarErr | sidecarMs |
|---|---|---|---|---|---|---|---|
| `canary-vf-avatar-0-1780735296568-7` | 0 | 200 | 9614 | genkit_fallback | canary | http | 65 |
| `canary-vf-avatar-1-1780735307903-50` | 3 | 200 | 12522 | genkit_fallback | canary | http | 169 |
| `canary-vf-avatar-2-1780735322041-30` | 4 | 200 | 9404 | genkit_fallback | canary | http | 40 |
