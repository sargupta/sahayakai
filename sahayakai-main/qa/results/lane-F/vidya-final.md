# VIDYA — interface-based parity (lane-F final)

- Run id: `vidya-1780718936998`
- Started: 2026-06-06T04:08:57.450Z
- Finished: 2026-06-06T04:09:42.723Z
- Endpoint: `https://sahayakai-preview-zwydpvyuca-as.a.run.app/api/assistant`
- Uid: `lane-f-vidya-parity`
- Flag check: vidyaSidecarMode=shadow@100 — OK
- Sidecar OK ratio (Firestore shadow diffs with sidecar payload): 98.0%
- Cells scored: 99 of 99 fixtures (matched via marker)
- **Pass rate: 0.0%**
- Canary-ready (≥95%): **NO — investigate failures**

## Scoring criteria
1. Both Genkit and sidecar return 200.
2. Same `action.flow` (string equality, including both-null).
3. Sidecar `response` in target lang (script coverage ≥0.90).
4. Cosine on response text ≥0.85 OR substring match on key entities.

## Per-language pass rate

| Lang | Pass | Total | Rate |
| --- | --- | --- | --- |
| en | 0 | 9 | 0.0% |
| hi | 0 | 9 | 0.0% |
| bn | 0 | 9 | 0.0% |
| ta | 0 | 9 | 0.0% |
| te | 0 | 9 | 0.0% |
| mr | 0 | 9 | 0.0% |
| gu | 0 | 9 | 0.0% |
| kn | 0 | 9 | 0.0% |
| ml | 0 | 9 | 0.0% |
| pa | 0 | 9 | 0.0% |
| or | 0 | 9 | 0.0% |

## Per-intent pass rate

| Intent | Pass | Total | Rate |
| --- | --- | --- | --- |
| ANSWER | 0 | 33 | 0.0% |
| CREATE | 0 | 33 | 0.0% |
| ACTION | 0 | 33 | 0.0% |

## Cell matrix

| Cell | Lang | Intent | Expect flow | Genkit flow | Sidecar flow | Match | Script | Cosine | Entity | Verdict | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| en-ans-photosyn | en | ANSWER | (null) | instant-answer | (null) | NO | 100.0% | 0.704 | yes | FAIL | action_flow_mismatch |
| en-ans-fractions | en | ANSWER | (null) | instant-answer | lesson-plan | NO | 100.0% | 0.551 | no | FAIL | action_flow_mismatch,semantic |
| en-ans-democracy | en | ANSWER | (null) | instant-answer | (null) | NO | 100.0% | 0.752 | yes | FAIL | action_flow_mismatch |
| en-cre-lesson | en | CREATE | lessonPlan | lesson-plan | lesson-plan | YES | 100.0% | 0.542 | no | FAIL | semantic |
| en-cre-quiz | en | CREATE | quiz | quiz-generator | quiz-generator | YES | 100.0% | 0.541 | no | FAIL | semantic |
| en-cre-workshet | en | CREATE | worksheet | worksheet-wizard | worksheet-wizard | YES | 100.0% | 0.557 | no | FAIL | semantic |
| en-act-visual | en | ACTION | visualAid | visual-aid-designer | visual-aid-designer | YES | 100.0% | 0.597 | no | FAIL | semantic |
| en-act-exam | en | ACTION | examPaper | exam-paper | exam-paper | YES | 100.0% | 0.543 | no | FAIL | semantic |
| en-act-video | en | ACTION | videoStoryteller | video-storyteller | video-storyteller | YES | 100.0% | 0.565 | no | FAIL | semantic |
| hi-ans-photosyn | hi | ANSWER | (null) | instant-answer | (null) | NO | 100.0% | 0.723 | yes | FAIL | action_flow_mismatch |
| hi-ans-fractions | hi | ANSWER | (null) | instant-answer | lesson-plan | NO | 0.0% | 0.500 | no | FAIL | action_flow_mismatch,script,semantic |
| hi-ans-democracy | hi | ANSWER | (null) | instant-answer | (null) | NO | 100.0% | 0.751 | yes | FAIL | action_flow_mismatch |
| hi-cre-lesson | hi | CREATE | lessonPlan | lesson-plan | lesson-plan | YES | 0.0% | 0.519 | no | FAIL | script,semantic |
| hi-cre-quiz | hi | CREATE | quiz | quiz-generator | quiz-generator | YES | 0.0% | 0.522 | no | FAIL | script,semantic |
| hi-cre-workshet | hi | CREATE | worksheet | worksheet-wizard | worksheet-wizard | YES | 0.0% | 0.549 | no | FAIL | script,semantic |
| hi-act-visual | hi | ACTION | visualAid | visual-aid-designer | visual-aid-designer | YES | 0.0% | 0.558 | no | FAIL | script,semantic |
| hi-act-exam | hi | ACTION | examPaper | exam-paper | exam-paper | YES | 0.0% | 0.506 | no | FAIL | script,semantic |
| hi-act-video | hi | ACTION | videoStoryteller | video-storyteller | video-storyteller | YES | 0.0% | 0.525 | no | FAIL | script,semantic |
| bn-ans-photosyn | bn | ANSWER | (null) | instant-answer | (null) | NO | 98.9% | 0.775 | yes | FAIL | action_flow_mismatch |
| bn-ans-fractions | bn | ANSWER | (null) | instant-answer | lesson-plan | NO | 0.0% | 0.547 | no | FAIL | action_flow_mismatch,script,semantic |
| bn-ans-democracy | bn | ANSWER | (null) | instant-answer | (null) | NO | 98.5% | 0.728 | yes | FAIL | action_flow_mismatch |
| bn-cre-lesson | bn | CREATE | lessonPlan | lesson-plan | lesson-plan | YES | 0.0% | 0.525 | no | FAIL | script,semantic |
| bn-cre-quiz | bn | CREATE | quiz | quiz-generator | quiz-generator | YES | 0.0% | 0.533 | no | FAIL | script,semantic |
| bn-cre-workshet | bn | CREATE | worksheet | worksheet-wizard | worksheet-wizard | YES | 0.0% | 0.548 | no | FAIL | script,semantic |
| bn-act-visual | bn | ACTION | visualAid | visual-aid-designer | visual-aid-designer | YES | 0.0% | 0.590 | no | FAIL | script,semantic |
| bn-act-exam | bn | ACTION | examPaper | exam-paper | exam-paper | YES | 0.0% | 0.523 | no | FAIL | script,semantic |
| bn-act-video | bn | ACTION | videoStoryteller | video-storyteller | video-storyteller | YES | 0.0% | 0.534 | no | FAIL | script,semantic |
| ta-ans-photosyn | ta | ANSWER | (null) | instant-answer | (null) | NO | 100.0% | 0.706 | yes | FAIL | action_flow_mismatch |
| ta-ans-fractions | ta | ANSWER | (null) | instant-answer | lesson-plan | NO | 0.0% | 0.558 | no | FAIL | action_flow_mismatch,script,semantic |
| ta-ans-democracy | ta | ANSWER | (null) | instant-answer | (null) | NO | 100.0% | 0.790 | yes | FAIL | action_flow_mismatch |
| ta-cre-lesson | ta | CREATE | lessonPlan | lesson-plan | lesson-plan | YES | 0.0% | 0.518 | no | FAIL | script,semantic |
| ta-cre-quiz | ta | CREATE | quiz | quiz-generator | quiz-generator | YES | 0.0% | 0.548 | no | FAIL | script,semantic |
| ta-cre-workshet | ta | CREATE | worksheet | worksheet-wizard | worksheet-wizard | YES | 0.0% | 0.548 | no | FAIL | script,semantic |
| ta-act-visual | ta | ACTION | visualAid | visual-aid-designer | visual-aid-designer | YES | 0.0% | 0.587 | no | FAIL | script,semantic |
| ta-act-exam | ta | ACTION | examPaper | exam-paper | exam-paper | YES | 0.0% | 0.525 | no | FAIL | script,semantic |
| ta-act-video | ta | ACTION | videoStoryteller | video-storyteller | video-storyteller | YES | 0.0% | 0.534 | no | FAIL | script,semantic |
| te-ans-photosyn | te | ANSWER | (null) | instant-answer | (null) | NO | 100.0% | 0.734 | yes | FAIL | action_flow_mismatch |
| te-ans-fractions | te | ANSWER | (null) | instant-answer | lesson-plan | NO | 0.0% | 0.535 | no | FAIL | action_flow_mismatch,script,semantic |
| te-ans-democracy | te | ANSWER | (null) | instant-answer | (null) | NO | 100.0% | 0.778 | yes | FAIL | action_flow_mismatch |
| te-cre-lesson | te | CREATE | lessonPlan | lesson-plan | lesson-plan | YES | 0.0% | 0.511 | no | FAIL | script,semantic |
| te-cre-quiz | te | CREATE | quiz | quiz-generator | quiz-generator | YES | 0.0% | 0.530 | no | FAIL | script,semantic |
| te-cre-workshet | te | CREATE | worksheet | worksheet-wizard | worksheet-wizard | YES | 0.0% | 0.551 | no | FAIL | script,semantic |
| te-act-visual | te | ACTION | visualAid | visual-aid-designer | visual-aid-designer | YES | 0.0% | 0.557 | no | FAIL | script,semantic |
| te-act-exam | te | ACTION | examPaper | exam-paper | exam-paper | YES | 0.0% | 0.514 | no | FAIL | script,semantic |
| te-act-video | te | ACTION | videoStoryteller | video-storyteller | video-storyteller | YES | 0.0% | 0.519 | no | FAIL | script,semantic |
| mr-ans-photosyn | mr | ANSWER | (null) | instant-answer | (null) | NO | 96.1% | 0.758 | yes | FAIL | action_flow_mismatch |
| mr-ans-fractions | mr | ANSWER | (null) | instant-answer | lesson-plan | NO | 0.0% | 0.497 | no | FAIL | action_flow_mismatch,script,semantic |
| mr-ans-democracy | mr | ANSWER | (null) | instant-answer | (null) | NO | 100.0% | 0.777 | yes | FAIL | action_flow_mismatch |
| mr-cre-lesson | mr | CREATE | lessonPlan | lesson-plan | lesson-plan | YES | 0.0% | 0.527 | no | FAIL | script,semantic |
| mr-cre-quiz | mr | CREATE | quiz | quiz-generator | quiz-generator | YES | 0.0% | 0.524 | no | FAIL | script,semantic |
| mr-cre-workshet | mr | CREATE | worksheet | worksheet-wizard | worksheet-wizard | YES | 0.0% | 0.545 | no | FAIL | script,semantic |
| mr-act-visual | mr | ACTION | visualAid | visual-aid-designer | visual-aid-designer | YES | 0.0% | 0.567 | no | FAIL | script,semantic |
| mr-act-exam | mr | ACTION | examPaper | exam-paper | exam-paper | YES | 0.0% | 0.537 | no | FAIL | script,semantic |
| mr-act-video | mr | ACTION | videoStoryteller | video-storyteller | video-storyteller | YES | 0.0% | 0.525 | no | FAIL | script,semantic |
| gu-ans-photosyn | gu | ANSWER | (null) | instant-answer | (null) | NO | 100.0% | 0.728 | yes | FAIL | action_flow_mismatch |
| gu-ans-fractions | gu | ANSWER | (null) | instant-answer | lesson-plan | NO | 0.0% | 0.491 | no | FAIL | action_flow_mismatch,script,semantic |
| gu-ans-democracy | gu | ANSWER | (null) | instant-answer | (null) | NO | 100.0% | 0.786 | yes | FAIL | action_flow_mismatch |
| gu-cre-lesson | gu | CREATE | lessonPlan | lesson-plan | lesson-plan | YES | 0.0% | 0.501 | no | FAIL | script,semantic |
| gu-cre-quiz | gu | CREATE | quiz | quiz-generator | quiz-generator | YES | 0.0% | 0.528 | no | FAIL | script,semantic |
| gu-cre-workshet | gu | CREATE | worksheet | worksheet-wizard | worksheet-wizard | YES | 0.0% | 0.535 | no | FAIL | script,semantic |
| gu-act-visual | gu | ACTION | visualAid | visual-aid-designer | visual-aid-designer | YES | 0.0% | 0.583 | no | FAIL | script,semantic |
| gu-act-exam | gu | ACTION | examPaper | exam-paper | exam-paper | YES | 0.0% | 0.523 | no | FAIL | script,semantic |
| gu-act-video | gu | ACTION | videoStoryteller | video-storyteller | video-storyteller | YES | 0.0% | 0.534 | no | FAIL | script,semantic |
| kn-ans-photosyn | kn | ANSWER | (null) | instant-answer | (null) | NO | 100.0% | 0.753 | yes | FAIL | action_flow_mismatch |
| kn-ans-fractions | kn | ANSWER | (null) | instant-answer | lesson-plan | NO | 0.0% | 0.531 | no | FAIL | action_flow_mismatch,script,semantic |
| kn-ans-democracy | kn | ANSWER | (null) | instant-answer | (null) | NO | 100.0% | 0.738 | yes | FAIL | action_flow_mismatch |
| kn-cre-lesson | kn | CREATE | lessonPlan | lesson-plan | lesson-plan | YES | 0.0% | 0.505 | no | FAIL | script,semantic |
| kn-cre-quiz | kn | CREATE | quiz | quiz-generator | quiz-generator | YES | 0.0% | 0.510 | no | FAIL | script,semantic |
| kn-cre-workshet | kn | CREATE | worksheet | worksheet-wizard | worksheet-wizard | YES | 0.0% | 0.532 | no | FAIL | script,semantic |
| kn-act-visual | kn | ACTION | visualAid | visual-aid-designer | visual-aid-designer | YES | 0.0% | 0.559 | no | FAIL | script,semantic |
| kn-act-exam | kn | ACTION | examPaper | exam-paper | exam-paper | YES | 0.0% | 0.505 | no | FAIL | script,semantic |
| kn-act-video | kn | ACTION | videoStoryteller | video-storyteller | video-storyteller | YES | 0.0% | 0.511 | no | FAIL | script,semantic |
| ml-ans-photosyn | ml | ANSWER | (null) | instant-answer | (null) | NO | 100.0% | 0.729 | yes | FAIL | action_flow_mismatch |
| ml-ans-fractions | ml | ANSWER | (null) | instant-answer | lesson-plan | NO | 0.0% | 0.526 | no | FAIL | action_flow_mismatch,script,semantic |
| ml-ans-democracy | ml | ANSWER | (null) | instant-answer | (null) | NO | 100.0% | 0.762 | yes | FAIL | action_flow_mismatch |
| ml-cre-lesson | ml | CREATE | lessonPlan | lesson-plan | lesson-plan | YES | 0.0% | 0.512 | no | FAIL | script,semantic |
| ml-cre-quiz | ml | CREATE | quiz | quiz-generator | quiz-generator | YES | 0.0% | 0.529 | no | FAIL | script,semantic |
| ml-cre-workshet | ml | CREATE | worksheet | worksheet-wizard | worksheet-wizard | YES | 0.0% | 0.531 | no | FAIL | script,semantic |
| ml-act-visual | ml | ACTION | visualAid | visual-aid-designer | visual-aid-designer | YES | 0.0% | 0.560 | no | FAIL | script,semantic |
| ml-act-exam | ml | ACTION | examPaper | exam-paper | exam-paper | YES | 0.0% | 0.505 | no | FAIL | script,semantic |
| ml-act-video | ml | ACTION | videoStoryteller | video-storyteller | video-storyteller | YES | 0.0% | 0.507 | no | FAIL | script,semantic |
| pa-ans-photosyn | pa | ANSWER | (null) | instant-answer | (null) | NO | 98.5% | 0.733 | yes | FAIL | action_flow_mismatch |
| pa-ans-fractions | pa | ANSWER | (null) | teacher-training | lesson-plan | NO | 0.0% | 0.558 | no | FAIL | action_flow_mismatch,script,semantic |
| pa-ans-democracy | pa | ANSWER | (null) | (null) | (null) | NO | 0.0% | 0.000 | no | FAIL | sidecar_missing |
| pa-cre-lesson | pa | CREATE | lessonPlan | lesson-plan | lesson-plan | YES | 0.0% | 0.511 | no | FAIL | script,semantic |
| pa-cre-quiz | pa | CREATE | quiz | quiz-generator | quiz-generator | YES | 0.0% | 0.531 | no | FAIL | script,semantic |
| pa-cre-workshet | pa | CREATE | worksheet | worksheet-wizard | worksheet-wizard | YES | 0.0% | 0.547 | no | FAIL | script,semantic |
| pa-act-visual | pa | ACTION | visualAid | visual-aid-designer | visual-aid-designer | YES | 0.0% | 0.591 | no | FAIL | script,semantic |
| pa-act-exam | pa | ACTION | examPaper | exam-paper | exam-paper | YES | 0.0% | 0.509 | no | FAIL | script,semantic |
| pa-act-video | pa | ACTION | videoStoryteller | video-storyteller | video-storyteller | YES | 0.0% | 0.522 | no | FAIL | script,semantic |
| or-ans-photosyn | or | ANSWER | (null) | instant-answer | (null) | NO | 100.0% | 0.725 | yes | FAIL | action_flow_mismatch |
| or-ans-fractions | or | ANSWER | (null) | instant-answer | lesson-plan | NO | 0.0% | 0.539 | no | FAIL | action_flow_mismatch,script,semantic |
| or-ans-democracy | or | ANSWER | (null) | (null) | (null) | NO | 0.0% | 0.000 | no | FAIL | sidecar_missing |
| or-cre-lesson | or | CREATE | lessonPlan | lesson-plan | lesson-plan | YES | 0.0% | 0.510 | no | FAIL | script,semantic |
| or-cre-quiz | or | CREATE | quiz | quiz-generator | quiz-generator | YES | 0.0% | 0.543 | no | FAIL | script,semantic |
| or-cre-workshet | or | CREATE | worksheet | worksheet-wizard | worksheet-wizard | YES | 0.0% | 0.533 | no | FAIL | script,semantic |
| or-act-visual | or | ACTION | visualAid | visual-aid-designer | visual-aid-designer | YES | 0.0% | 0.558 | no | FAIL | script,semantic |
| or-act-exam | or | ACTION | examPaper | exam-paper | exam-paper | YES | 0.0% | 0.509 | no | FAIL | script,semantic |
| or-act-video | or | ACTION | videoStoryteller | video-storyteller | video-storyteller | YES | 0.0% | 0.520 | no | FAIL | script,semantic |

## Failures (detail)
- **en-ans-photosyn** (ANSWER) — action_flow_mismatch — genkit_flow=instant-answer sidecar_flow=(null) script=100.0% cosine=0.704 entityHit=true
- **en-ans-fractions** (ANSWER) — action_flow_mismatch, semantic — genkit_flow=instant-answer sidecar_flow=lesson-plan script=100.0% cosine=0.551 entityHit=false
- **en-ans-democracy** (ANSWER) — action_flow_mismatch — genkit_flow=instant-answer sidecar_flow=(null) script=100.0% cosine=0.752 entityHit=true
- **en-cre-lesson** (CREATE) — semantic — genkit_flow=lesson-plan sidecar_flow=lesson-plan script=100.0% cosine=0.542 entityHit=false
- **en-cre-quiz** (CREATE) — semantic — genkit_flow=quiz-generator sidecar_flow=quiz-generator script=100.0% cosine=0.541 entityHit=false
- **en-cre-workshet** (CREATE) — semantic — genkit_flow=worksheet-wizard sidecar_flow=worksheet-wizard script=100.0% cosine=0.557 entityHit=false
- **en-act-visual** (ACTION) — semantic — genkit_flow=visual-aid-designer sidecar_flow=visual-aid-designer script=100.0% cosine=0.597 entityHit=false
- **en-act-exam** (ACTION) — semantic — genkit_flow=exam-paper sidecar_flow=exam-paper script=100.0% cosine=0.543 entityHit=false
- **en-act-video** (ACTION) — semantic — genkit_flow=video-storyteller sidecar_flow=video-storyteller script=100.0% cosine=0.565 entityHit=false
- **hi-ans-photosyn** (ANSWER) — action_flow_mismatch — genkit_flow=instant-answer sidecar_flow=(null) script=100.0% cosine=0.723 entityHit=true
- **hi-ans-fractions** (ANSWER) — action_flow_mismatch, script, semantic — genkit_flow=instant-answer sidecar_flow=lesson-plan script=0.0% cosine=0.500 entityHit=false
- **hi-ans-democracy** (ANSWER) — action_flow_mismatch — genkit_flow=instant-answer sidecar_flow=(null) script=100.0% cosine=0.751 entityHit=true
- **hi-cre-lesson** (CREATE) — script, semantic — genkit_flow=lesson-plan sidecar_flow=lesson-plan script=0.0% cosine=0.519 entityHit=false
- **hi-cre-quiz** (CREATE) — script, semantic — genkit_flow=quiz-generator sidecar_flow=quiz-generator script=0.0% cosine=0.522 entityHit=false
- **hi-cre-workshet** (CREATE) — script, semantic — genkit_flow=worksheet-wizard sidecar_flow=worksheet-wizard script=0.0% cosine=0.549 entityHit=false
- **hi-act-visual** (ACTION) — script, semantic — genkit_flow=visual-aid-designer sidecar_flow=visual-aid-designer script=0.0% cosine=0.558 entityHit=false
- **hi-act-exam** (ACTION) — script, semantic — genkit_flow=exam-paper sidecar_flow=exam-paper script=0.0% cosine=0.506 entityHit=false
- **hi-act-video** (ACTION) — script, semantic — genkit_flow=video-storyteller sidecar_flow=video-storyteller script=0.0% cosine=0.525 entityHit=false
- **bn-ans-photosyn** (ANSWER) — action_flow_mismatch — genkit_flow=instant-answer sidecar_flow=(null) script=98.9% cosine=0.775 entityHit=true
- **bn-ans-fractions** (ANSWER) — action_flow_mismatch, script, semantic — genkit_flow=instant-answer sidecar_flow=lesson-plan script=0.0% cosine=0.547 entityHit=false
- **bn-ans-democracy** (ANSWER) — action_flow_mismatch — genkit_flow=instant-answer sidecar_flow=(null) script=98.5% cosine=0.728 entityHit=true
- **bn-cre-lesson** (CREATE) — script, semantic — genkit_flow=lesson-plan sidecar_flow=lesson-plan script=0.0% cosine=0.525 entityHit=false
- **bn-cre-quiz** (CREATE) — script, semantic — genkit_flow=quiz-generator sidecar_flow=quiz-generator script=0.0% cosine=0.533 entityHit=false
- **bn-cre-workshet** (CREATE) — script, semantic — genkit_flow=worksheet-wizard sidecar_flow=worksheet-wizard script=0.0% cosine=0.548 entityHit=false
- **bn-act-visual** (ACTION) — script, semantic — genkit_flow=visual-aid-designer sidecar_flow=visual-aid-designer script=0.0% cosine=0.590 entityHit=false
- **bn-act-exam** (ACTION) — script, semantic — genkit_flow=exam-paper sidecar_flow=exam-paper script=0.0% cosine=0.523 entityHit=false
- **bn-act-video** (ACTION) — script, semantic — genkit_flow=video-storyteller sidecar_flow=video-storyteller script=0.0% cosine=0.534 entityHit=false
- **ta-ans-photosyn** (ANSWER) — action_flow_mismatch — genkit_flow=instant-answer sidecar_flow=(null) script=100.0% cosine=0.706 entityHit=true
- **ta-ans-fractions** (ANSWER) — action_flow_mismatch, script, semantic — genkit_flow=instant-answer sidecar_flow=lesson-plan script=0.0% cosine=0.558 entityHit=false
- **ta-ans-democracy** (ANSWER) — action_flow_mismatch — genkit_flow=instant-answer sidecar_flow=(null) script=100.0% cosine=0.790 entityHit=true
- **ta-cre-lesson** (CREATE) — script, semantic — genkit_flow=lesson-plan sidecar_flow=lesson-plan script=0.0% cosine=0.518 entityHit=false
- **ta-cre-quiz** (CREATE) — script, semantic — genkit_flow=quiz-generator sidecar_flow=quiz-generator script=0.0% cosine=0.548 entityHit=false
- **ta-cre-workshet** (CREATE) — script, semantic — genkit_flow=worksheet-wizard sidecar_flow=worksheet-wizard script=0.0% cosine=0.548 entityHit=false
- **ta-act-visual** (ACTION) — script, semantic — genkit_flow=visual-aid-designer sidecar_flow=visual-aid-designer script=0.0% cosine=0.587 entityHit=false
- **ta-act-exam** (ACTION) — script, semantic — genkit_flow=exam-paper sidecar_flow=exam-paper script=0.0% cosine=0.525 entityHit=false
- **ta-act-video** (ACTION) — script, semantic — genkit_flow=video-storyteller sidecar_flow=video-storyteller script=0.0% cosine=0.534 entityHit=false
- **te-ans-photosyn** (ANSWER) — action_flow_mismatch — genkit_flow=instant-answer sidecar_flow=(null) script=100.0% cosine=0.734 entityHit=true
- **te-ans-fractions** (ANSWER) — action_flow_mismatch, script, semantic — genkit_flow=instant-answer sidecar_flow=lesson-plan script=0.0% cosine=0.535 entityHit=false
- **te-ans-democracy** (ANSWER) — action_flow_mismatch — genkit_flow=instant-answer sidecar_flow=(null) script=100.0% cosine=0.778 entityHit=true
- **te-cre-lesson** (CREATE) — script, semantic — genkit_flow=lesson-plan sidecar_flow=lesson-plan script=0.0% cosine=0.511 entityHit=false
- **te-cre-quiz** (CREATE) — script, semantic — genkit_flow=quiz-generator sidecar_flow=quiz-generator script=0.0% cosine=0.530 entityHit=false
- **te-cre-workshet** (CREATE) — script, semantic — genkit_flow=worksheet-wizard sidecar_flow=worksheet-wizard script=0.0% cosine=0.551 entityHit=false
- **te-act-visual** (ACTION) — script, semantic — genkit_flow=visual-aid-designer sidecar_flow=visual-aid-designer script=0.0% cosine=0.557 entityHit=false
- **te-act-exam** (ACTION) — script, semantic — genkit_flow=exam-paper sidecar_flow=exam-paper script=0.0% cosine=0.514 entityHit=false
- **te-act-video** (ACTION) — script, semantic — genkit_flow=video-storyteller sidecar_flow=video-storyteller script=0.0% cosine=0.519 entityHit=false
- **mr-ans-photosyn** (ANSWER) — action_flow_mismatch — genkit_flow=instant-answer sidecar_flow=(null) script=96.1% cosine=0.758 entityHit=true
- **mr-ans-fractions** (ANSWER) — action_flow_mismatch, script, semantic — genkit_flow=instant-answer sidecar_flow=lesson-plan script=0.0% cosine=0.497 entityHit=false
- **mr-ans-democracy** (ANSWER) — action_flow_mismatch — genkit_flow=instant-answer sidecar_flow=(null) script=100.0% cosine=0.777 entityHit=true
- **mr-cre-lesson** (CREATE) — script, semantic — genkit_flow=lesson-plan sidecar_flow=lesson-plan script=0.0% cosine=0.527 entityHit=false
- **mr-cre-quiz** (CREATE) — script, semantic — genkit_flow=quiz-generator sidecar_flow=quiz-generator script=0.0% cosine=0.524 entityHit=false
- **mr-cre-workshet** (CREATE) — script, semantic — genkit_flow=worksheet-wizard sidecar_flow=worksheet-wizard script=0.0% cosine=0.545 entityHit=false
- **mr-act-visual** (ACTION) — script, semantic — genkit_flow=visual-aid-designer sidecar_flow=visual-aid-designer script=0.0% cosine=0.567 entityHit=false
- **mr-act-exam** (ACTION) — script, semantic — genkit_flow=exam-paper sidecar_flow=exam-paper script=0.0% cosine=0.537 entityHit=false
- **mr-act-video** (ACTION) — script, semantic — genkit_flow=video-storyteller sidecar_flow=video-storyteller script=0.0% cosine=0.525 entityHit=false
- **gu-ans-photosyn** (ANSWER) — action_flow_mismatch — genkit_flow=instant-answer sidecar_flow=(null) script=100.0% cosine=0.728 entityHit=true
- **gu-ans-fractions** (ANSWER) — action_flow_mismatch, script, semantic — genkit_flow=instant-answer sidecar_flow=lesson-plan script=0.0% cosine=0.491 entityHit=false
- **gu-ans-democracy** (ANSWER) — action_flow_mismatch — genkit_flow=instant-answer sidecar_flow=(null) script=100.0% cosine=0.786 entityHit=true
- **gu-cre-lesson** (CREATE) — script, semantic — genkit_flow=lesson-plan sidecar_flow=lesson-plan script=0.0% cosine=0.501 entityHit=false
- **gu-cre-quiz** (CREATE) — script, semantic — genkit_flow=quiz-generator sidecar_flow=quiz-generator script=0.0% cosine=0.528 entityHit=false
- **gu-cre-workshet** (CREATE) — script, semantic — genkit_flow=worksheet-wizard sidecar_flow=worksheet-wizard script=0.0% cosine=0.535 entityHit=false
- **gu-act-visual** (ACTION) — script, semantic — genkit_flow=visual-aid-designer sidecar_flow=visual-aid-designer script=0.0% cosine=0.583 entityHit=false
- **gu-act-exam** (ACTION) — script, semantic — genkit_flow=exam-paper sidecar_flow=exam-paper script=0.0% cosine=0.523 entityHit=false
- **gu-act-video** (ACTION) — script, semantic — genkit_flow=video-storyteller sidecar_flow=video-storyteller script=0.0% cosine=0.534 entityHit=false
- **kn-ans-photosyn** (ANSWER) — action_flow_mismatch — genkit_flow=instant-answer sidecar_flow=(null) script=100.0% cosine=0.753 entityHit=true
- **kn-ans-fractions** (ANSWER) — action_flow_mismatch, script, semantic — genkit_flow=instant-answer sidecar_flow=lesson-plan script=0.0% cosine=0.531 entityHit=false
- **kn-ans-democracy** (ANSWER) — action_flow_mismatch — genkit_flow=instant-answer sidecar_flow=(null) script=100.0% cosine=0.738 entityHit=true
- **kn-cre-lesson** (CREATE) — script, semantic — genkit_flow=lesson-plan sidecar_flow=lesson-plan script=0.0% cosine=0.505 entityHit=false
- **kn-cre-quiz** (CREATE) — script, semantic — genkit_flow=quiz-generator sidecar_flow=quiz-generator script=0.0% cosine=0.510 entityHit=false
- **kn-cre-workshet** (CREATE) — script, semantic — genkit_flow=worksheet-wizard sidecar_flow=worksheet-wizard script=0.0% cosine=0.532 entityHit=false
- **kn-act-visual** (ACTION) — script, semantic — genkit_flow=visual-aid-designer sidecar_flow=visual-aid-designer script=0.0% cosine=0.559 entityHit=false
- **kn-act-exam** (ACTION) — script, semantic — genkit_flow=exam-paper sidecar_flow=exam-paper script=0.0% cosine=0.505 entityHit=false
- **kn-act-video** (ACTION) — script, semantic — genkit_flow=video-storyteller sidecar_flow=video-storyteller script=0.0% cosine=0.511 entityHit=false
- **ml-ans-photosyn** (ANSWER) — action_flow_mismatch — genkit_flow=instant-answer sidecar_flow=(null) script=100.0% cosine=0.729 entityHit=true
- **ml-ans-fractions** (ANSWER) — action_flow_mismatch, script, semantic — genkit_flow=instant-answer sidecar_flow=lesson-plan script=0.0% cosine=0.526 entityHit=false
- **ml-ans-democracy** (ANSWER) — action_flow_mismatch — genkit_flow=instant-answer sidecar_flow=(null) script=100.0% cosine=0.762 entityHit=true
- **ml-cre-lesson** (CREATE) — script, semantic — genkit_flow=lesson-plan sidecar_flow=lesson-plan script=0.0% cosine=0.512 entityHit=false
- **ml-cre-quiz** (CREATE) — script, semantic — genkit_flow=quiz-generator sidecar_flow=quiz-generator script=0.0% cosine=0.529 entityHit=false
- **ml-cre-workshet** (CREATE) — script, semantic — genkit_flow=worksheet-wizard sidecar_flow=worksheet-wizard script=0.0% cosine=0.531 entityHit=false
- **ml-act-visual** (ACTION) — script, semantic — genkit_flow=visual-aid-designer sidecar_flow=visual-aid-designer script=0.0% cosine=0.560 entityHit=false
- **ml-act-exam** (ACTION) — script, semantic — genkit_flow=exam-paper sidecar_flow=exam-paper script=0.0% cosine=0.505 entityHit=false
- **ml-act-video** (ACTION) — script, semantic — genkit_flow=video-storyteller sidecar_flow=video-storyteller script=0.0% cosine=0.507 entityHit=false
- **pa-ans-photosyn** (ANSWER) — action_flow_mismatch — genkit_flow=instant-answer sidecar_flow=(null) script=98.5% cosine=0.733 entityHit=true
- **pa-ans-fractions** (ANSWER) — action_flow_mismatch, script, semantic — genkit_flow=teacher-training sidecar_flow=lesson-plan script=0.0% cosine=0.558 entityHit=false
- **pa-ans-democracy** (ANSWER) — sidecar_missing — genkit_flow=(null) sidecar_flow=(null) script=0.0% cosine=0.000 entityHit=false
- **pa-cre-lesson** (CREATE) — script, semantic — genkit_flow=lesson-plan sidecar_flow=lesson-plan script=0.0% cosine=0.511 entityHit=false
- **pa-cre-quiz** (CREATE) — script, semantic — genkit_flow=quiz-generator sidecar_flow=quiz-generator script=0.0% cosine=0.531 entityHit=false
- **pa-cre-workshet** (CREATE) — script, semantic — genkit_flow=worksheet-wizard sidecar_flow=worksheet-wizard script=0.0% cosine=0.547 entityHit=false
- **pa-act-visual** (ACTION) — script, semantic — genkit_flow=visual-aid-designer sidecar_flow=visual-aid-designer script=0.0% cosine=0.591 entityHit=false
- **pa-act-exam** (ACTION) — script, semantic — genkit_flow=exam-paper sidecar_flow=exam-paper script=0.0% cosine=0.509 entityHit=false
- **pa-act-video** (ACTION) — script, semantic — genkit_flow=video-storyteller sidecar_flow=video-storyteller script=0.0% cosine=0.522 entityHit=false
- **or-ans-photosyn** (ANSWER) — action_flow_mismatch — genkit_flow=instant-answer sidecar_flow=(null) script=100.0% cosine=0.725 entityHit=true
- **or-ans-fractions** (ANSWER) — action_flow_mismatch, script, semantic — genkit_flow=instant-answer sidecar_flow=lesson-plan script=0.0% cosine=0.539 entityHit=false
- **or-ans-democracy** (ANSWER) — sidecar_missing — genkit_flow=(null) sidecar_flow=(null) script=0.0% cosine=0.000 entityHit=false
- **or-cre-lesson** (CREATE) — script, semantic — genkit_flow=lesson-plan sidecar_flow=lesson-plan script=0.0% cosine=0.510 entityHit=false
- **or-cre-quiz** (CREATE) — script, semantic — genkit_flow=quiz-generator sidecar_flow=quiz-generator script=0.0% cosine=0.543 entityHit=false
- **or-cre-workshet** (CREATE) — script, semantic — genkit_flow=worksheet-wizard sidecar_flow=worksheet-wizard script=0.0% cosine=0.533 entityHit=false
- **or-act-visual** (ACTION) — script, semantic — genkit_flow=visual-aid-designer sidecar_flow=visual-aid-designer script=0.0% cosine=0.558 entityHit=false
- **or-act-exam** (ACTION) — script, semantic — genkit_flow=exam-paper sidecar_flow=exam-paper script=0.0% cosine=0.509 entityHit=false
- **or-act-video** (ACTION) — script, semantic — genkit_flow=video-storyteller sidecar_flow=video-storyteller script=0.0% cosine=0.520 entityHit=false

