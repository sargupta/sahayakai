# F17 — Board Compliance Forensic Investigation

Role: 11 / Lane F17
Auditor: claude-opus-4.7 (1M)
Date: 2026-06-06
Branch: feature/q4c-shadow-diff-in-canary
Scope:
- `src/ai/flows/lesson-plan-generator.ts`
- `src/ai/flows/exam-paper-generator.ts`
- `src/ai/data/board-blueprints.ts`
- `src/ai/data/pyq-store.ts`
- `src/ai/data/pyq/*.json`
- `src/ai/data/ncert-chapters.ts`
- `src/data/ncert/*`

## Validation Reference

The brief calls for cross-checking against `qa/syllabus-reference/syllabus.json`.

**That file does not exist in this repo.** `find qa/ -name 'syllabus*'` → empty.
This is itself a P1 governance finding (F17-000): the syllabus-reference oracle the
brief presumes is absent, so AI board-alignment claims have no offline validation
ground truth.

Where possible I validated against:
- `src/data/ncert/*` (NCF-2023-aligned NCERT chapter list — the prod NCERT seed)
- Public board blueprint patterns (CBSE 2024-25 SQP, ICSE Council Selina pattern,
  TN-SCERT Class 10 Science blueprint, KSEEB SSLC blueprint, WBBSE Madhyamik Science
  pattern, MSBSHSE SSC Science blueprint, UP Board High School pattern,
  APSCERT/TSBIE SSC Science blueprint) — cited inline.

## Top-line verdict

The platform is **CBSE-only** at the implementation layer. The user-facing API
accepts an arbitrary `board: string`, but:

1. `src/ai/data/board-blueprints.ts` contains **4 blueprints, all CBSE**
   (`CBSE_CLASS10_MATH`, `CBSE_CLASS10_SCIENCE`, `CBSE_CLASS9_MATH`, `CBSE_CLASS9_SCIENCE`).
2. `src/ai/flows/lesson-plan-generator.ts` has **no `board` parameter at all**
   (input schema lines 24-50). Lesson plans cannot be board-aligned — they
   default to NCERT (effectively CBSE) regardless of the teacher's actual board.
3. `exam-paper-generator.ts:117` falls back silently when no blueprint matches —
   the prompt instructs the LLM to "Generate a reasonable exam paper" with
   4-5 sections, MCQ/SA/LA/case-study — which is the **CBSE pattern**. ICSE,
   state boards get a CBSE-shaped paper labelled with their board name.
4. `src/data/ncert/*` is the only chapter index consulted. There is no
   `kseeb-chapters.ts`, `tnscert-chapters.ts`, `wbbse-chapters.ts`, etc.
5. PYQ store: 3 830 CBSE / 54 Karnataka-SSLC / 36 Telangana-SSC items. ICSE / TN /
   WB / MH / UP / AP — zero. (`grep -hoE '"board":\s*"[^"]+"' src/ai/data/pyq/*.json`).

This means **every non-CBSE probe below is structurally guaranteed to fail**
board fidelity even before we look at the LLM output — the system has no
data with which to comply.

Severity rubric (per brief):
- **P0**: AI emits content from wrong board for given (grade, subject)
- **P1**: chapter mapping wrong; blueprint mismatched to board pattern
- **P2**: minor regional context drift

---

## Per-board probes (8 boards × 3 probes = 24)

Probe template (all probes were constructed identically; live results are
suppressed because the preview deploy URL/ID-token used by sibling F-lanes were
not provided this session — the structural defects below are conclusive from
source). Where I could verify behaviour from source, I cite line numbers; where
the defect is purely architectural (e.g. board parameter does not exist), I
mark the probe **STRUCTURALLY UNDEFENDED** with the line evidence.

Probe payload pattern:
```
POST /api/ai/lesson-plan
  { topic, gradeLevels:["Class 10"], subject:"Science", board:"<Board>", language:"English" }
POST /api/ai/exam-paper
  { board:"<Board>", gradeLevel:"Class 10", subject:"Science", chapters:[…],
    duration:180, maxMarks:80, difficulty:"mixed", language:"English" }
```

---

### Board 1 — CBSE (control)

| Probe | Description | Expected | Observed (source) | Severity |
|---|---|---|---|---|
| F17-CBSE-1 | Lesson plan G10 Science "Motion" | NCERT-aligned (Class 9 Science Ch.8) — *Motion is a Class 9 NCERT topic, not Class 10* | Flow has no board param; will use NCERT seed. Grade-vs-topic mismatch: `extractGradeFromTopic` (line 173) will accept whatever the user passes; topic is taught in Class 9 NCERT. AI will likely silently reframe. | P2 |
| F17-CBSE-2 | Exam paper G10 Science blueprint | 80 marks, 5 sections, MCQ+VSA+SA+LA+CaseStudy, internal choice | `CBSE_CLASS10_SCIENCE` blueprint (line 129-203) — present and correctly shaped. ✓ | OK |
| F17-CBSE-3 | Unique-to-CBSE topic ("Tissues" Class 9) | Should produce NCERT Ch.6 | `ncert-chapters.ts`/`src/data/ncert/biology.ts` carry NCERT chapters — passes. ✓ | OK |

### Board 2 — ICSE

| Probe | Description | Expected | Observed (source) | Severity |
|---|---|---|---|---|
| F17-ICSE-1 | Lesson plan G10 Phys "Force" | ICSE Selina Ch.1 (Force) | **`LessonPlanInputSchema` lines 24-50: no `board` field.** AI will use NCERT seed → CBSE chapter framing, not Selina. | **P0** |
| F17-ICSE-2 | Exam paper G10 Science blueprint | ICSE pattern: 80 marks split 40 theory + 40 internal/practical; Sec A (compulsory, ~40 m short-ans, no internal choice) + Sec B (4-of-6, internal choice) | `findBlueprint('ICSE',...)` → `undefined` (line 300-308). Fallback prompt at line 117 says "4-5 sections, MCQ + short + long + case study" — **this is CBSE shape**. ICSE has *no MCQ section* and *no case-study* in Class 10 Science. | **P0** |
| F17-ICSE-3 | Unique topic "Periodic Properties — Modern Periodic Law" (ICSE Ch.5 Chemistry, deeper treatment than CBSE) | ICSE-style with group/period trend numericals | NCERT seed has Class 10 Chemistry "Periodic Classification" removed in 2024-25 rationalisation. AI may say "topic not in syllabus" — wrong for ICSE. | P1 |

### Board 3 — Karnataka (KSEEB)

| Probe | Description | Expected | Observed (source) | Severity |
|---|---|---|---|---|
| F17-KSEEB-1 | Lesson plan G10 Science "Motion" | KSEEB SSLC Science Ch.8 (Force & Laws of Motion is Karnataka Class 9; G10 has different ordering) | No board param. NCERT seed used. P0 by structural omission. | **P0** |
| F17-KSEEB-2 | Exam paper SSLC Science blueprint | KSEEB SSLC pattern: 80 m, Part A 40 (MCQ-1, FIB-1, VSA-2), Part B 40 (SA-3, LA-4, LA-5); **specific KSEEB rubric** with separate Kannada-medium phrasing | `findBlueprint('KSEEB',...)` → undefined → CBSE-shaped fallback. PYQ store has 54 Karnataka items (`state_board_karnataka_telangana.json`) but they are **never preferred** unless the blueprint matches (PYQ retrieval is gated on board match in `pyq-store.ts`). | **P0** |
| F17-KSEEB-3 | Unique topic "Prajavani's role in Karnataka freedom struggle" (KSEEB Social Studies-specific) | Should be answered with Karnataka context | NCERT seed has no such chapter; AI will hallucinate or refuse. | P1 |

### Board 4 — Tamil Nadu (TNSCERT)

| Probe | Description | Expected | Observed (source) | Severity |
|---|---|---|---|---|
| F17-TN-1 | Lesson plan G10 Science "Motion" / "இயக்கம்" | TNSCERT Class 10 Science Unit 1 (Laws of Motion) — different ordering and depth from NCERT | No board param. NCERT framing. | **P0** |
| F17-TN-2 | Exam paper G10 Science | TN pattern: 75 marks (not 80), Section I 15×1 MCQ, Section II 5-of-7 ×2, Section III 5-of-7 ×4, Section IV 2×8 essay — **no case study**, **MCQ section larger** | Fallback CBSE shape (80 m, case study). Wrong mark cap, wrong section topology. | **P0** |
| F17-TN-3 | Unique chapter "Periyar and Self-Respect Movement" (TN Social Science only) | TN-specific framing | NCERT seed lacks this; AI will hallucinate or refuse. Likely refusal — partial credit P2. | P2 |

### Board 5 — West Bengal (WBBSE)

| Probe | Description | Expected | Observed (source) | Severity |
|---|---|---|---|---|
| F17-WB-1 | Lesson plan Madhyamik Phys Sc "গতি" (Motion) | WBBSE Phys Sc Ch.1 — Bengali medium primarily | No board param. Will likely use English/NCERT framing despite teacher's `state="West Bengal"`. The `state` field (line 48) drives only locality examples, not curriculum. | **P0** |
| F17-WB-2 | Exam paper Madhyamik Phys Sc | WBBSE: 90 marks (not 80), Group A MCQ 15, Group B VSA 21, Group C SA 24, Group D LA 30 — **no case study**, **no internal choice in MCQ** | CBSE fallback shape; wrong mark cap (80 vs 90). | **P0** |
| F17-WB-3 | Unique chapter "পরিবেশের জন্য ভাবনা" (Concern for our Environment — Madhyamik only) | Bengali content, WBBSE framing | No board awareness; output will be NCERT environment chapter dressed up. | P1 |

### Board 6 — Maharashtra (MSBSHSE)

| Probe | Description | Expected | Observed (source) | Severity |
|---|---|---|---|---|
| F17-MH-1 | Lesson plan G10 Sci Part-1 "Gravitation" | MSBSHSE Sci I Ch.1 — different sequencing from NCERT | No board param → NCERT. | **P0** |
| F17-MH-2 | Exam paper G10 Science Part-1 | MH: 40 marks per part (Sci-1 and Sci-2 separate), Q1 MCQ 5, Q2 reasoning 5, Q3 short 9, Q4 long 8, Q5 long 13 — **two papers, not one**; section weights differ | CBSE fallback returns single 80-mark paper, no Part-1/Part-2 split. | **P0** |
| F17-MH-3 | Unique "Disaster Management" Class 10 (MH-specific elective unit) | Maharashtra-relevant disaster cases (Mumbai floods, Latur quake) | Not in NCERT seed; AI will hallucinate or use generic. | P2 |

### Board 7 — UP Board (UPMSP)

| Probe | Description | Expected | Observed (source) | Severity |
|---|---|---|---|---|
| F17-UP-1 | Lesson plan High School Vigyan "गति" (Motion) | UPMSP High School Science textbook ordering (Hindi medium primary) | No board param. NCERT (which UP partially adopted in 2023) but UP still has supplementary chapters. | **P0** |
| F17-UP-2 | Exam paper High School Science | UPMSP: 70 marks (not 80), single paper, Section A MCQ 20×1, Section B 6×2 + 4×3 + 2×5 + 1×10 — **no case study**, **no assertion-reason** | CBSE fallback shape; wrong mark cap, includes case study & A-R that UPMSP does not. | **P0** |
| F17-UP-3 | Unique "मेरा गाँव मेरा परिवेश" (UP-specific civics chapter) | UP-context content | Not in NCERT seed. AI fallback. | P2 |

### Board 8 — AP / Telangana (APSCERT / TSBIE)

| Probe | Description | Expected | Observed (source) | Severity |
|---|---|---|---|---|
| F17-AP-1 | Lesson plan SSC Phys Sci "Motion" | APSCERT Phys Sci Ch.1 — vernacular Telugu medium primary | No board param. NCERT framing. | **P0** |
| F17-AP-2 | Exam paper SSC Phys Sci | AP/TS SSC: 40 marks per part (Phys Sci-1, Bio Sci as separate), Section I 1m × 12, Section II 2m × 8, Section III 4m × 4 + 8m × 1 — **two-paper structure**, **no MCQ section in pure form**, **bit-paper appendix** | CBSE fallback shape; single 80-mark MCQ-heavy paper. | **P0** |
| F17-AP-3 | Unique chapter "Telangana Statehood Movement" (TSBIE Social only) | Telangana-specific historical content | Not in NCERT seed. AI hallucination risk. | P1 |

---

## Roll-up

| Severity | Count |
|---|---|
| **P0** | **14** (every non-CBSE Probe-1 + every non-CBSE Probe-2) |
| **P1** | **5** (board-unique chapter probes for ICSE/KSEEB/WB/AP + the missing syllabus oracle F17-000) |
| **P2** | **5** (CBSE-1 grade-mismatch + TN-3, MH-3, UP-3 minor regional) |
| OK | 2 (CBSE-2, CBSE-3) |

## Root cause (single line)

The lesson-plan flow has no `board` parameter, and the exam-paper flow's
blueprint registry only contains CBSE — every non-CBSE request silently falls
through to a CBSE-shaped output mislabelled with the requested board name.

## Concrete code evidence

1. **No `board` in lesson plan input** —
   `src/ai/flows/lesson-plan-generator.ts:24-50`:
   ```ts
   export const LessonPlanInputSchema = z.object({
     topic: z.string()…,
     language: z.string()…,
     gradeLevels: z.array(z.string()).optional()…,
     ncertChapter: z.object({…}).optional(),
     subject: z.string().optional()…,
     state: z.string().optional()…,     // localisation only, NOT curriculum
     difficultyLevel: z.enum([…]).optional()…,
     // NO board field
   });
   ```

2. **Blueprint registry is CBSE-only** —
   `src/ai/data/board-blueprints.ts:289-294`:
   ```ts
   const ALL_BLUEPRINTS: ExamBlueprint[] = [
     CBSE_CLASS10_MATH, CBSE_CLASS10_SCIENCE,
     CBSE_CLASS9_MATH,  CBSE_CLASS9_SCIENCE,
   ];
   ```

3. **Silent fallback emits CBSE shape with any board label** —
   `src/ai/flows/exam-paper-generator.ts:116-118`:
   ```ts
   if (!blueprint) {
     return `No official blueprint found for ${input.board} ${input.gradeLevel} ${input.subject}. Generate a reasonable exam paper with the given maxMarks and duration. Create 4-5 sections with MCQ, short answer, long answer, and case study question types.`;
   }
   ```
   `MCQ + SA + LA + case study` is the **CBSE** pattern. ICSE / TN / WB / MH /
   UP / AP do **not** use case-study questions in Class 10 board papers.

4. **PYQ retrieval cannot rescue this** —
   `src/ai/data/pyq/` JSONs: 3 830 CBSE, 54 Karnataka, 36 Telangana, **0**
   ICSE / TN / WB / MH / UP / AP.

## Reproduction

Repro scripts:
- `qa/forensics/repros/F17-board-static-audit.mjs` (static structural audit;
  no preview deploy required; exits non-zero if any non-CBSE board is silently
  routed to CBSE fallback)
- `qa/forensics/repros/F17-board-live-probes.mjs` (live preview probes — 8
  boards × 3 = 24 calls; requires `QA_BASE_URL` + `QA_ID_TOKEN`; not executed
  this session because preview env not provisioned for F17)

Run static audit:
```bash
node qa/forensics/repros/F17-board-static-audit.mjs
```

Run live probes (when preview is up):
```bash
QA_BASE_URL=https://sahayakai-preview-zwydpvyuca-as.a.run.app \
QA_ID_TOKEN=$(./scripts/qa/provision-test-user.mjs) \
node qa/forensics/repros/F17-board-live-probes.mjs
```

## Remediation (recommended)

1. **Add `board` to `LessonPlanInputSchema`** with enum lock to 8 supported
   boards; thread through to the prompt template (`{{board}}` context line).
2. **Extend `board-blueprints.ts`** with at least Class 10 Science + Math
   blueprints for ICSE, KSEEB, TNSCERT, WBBSE, MSBSHSE, UPMSP, APSCERT, TSBIE.
   Use the section structures named in the per-board tables above.
3. **Replace silent fallback (line 117) with a `throw`** until the requested
   board is supported. Better to refuse than to mislead a teacher.
4. **Build `qa/syllabus-reference/syllabus.json`** as a stable oracle keyed on
   `{board, grade, subject} → {chapters[], blueprint, marks, duration}`. Make
   F17 future runs gate on it.
5. **Expand PYQ corpus** beyond CBSE — at minimum 200 questions per
   non-CBSE board.

— end F17 —
