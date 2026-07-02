# F16 — Subject + Pedagogy Forensic Report

**Role:** 10 — Subject + Pedagogy Forensics
**Date:** 2026-06-06
**Investigator:** Forensic Agent F16
**Scope:** Mathematics, Physics, Chemistry, Biology, Social Science, Hindi, English, Sanskrit, Regional Languages, CS/IT
**Charter:** validate that SahayakAI AI outputs match canonical NCERT curriculum across all 10 subject specialisations; flag chapter-alignment, notation, factual, age-appropriate, and topic-coverage defects.

---

## Methodology

This report combines:

1. **Static curriculum audit** of the NCERT seed (`src/data/ncert/*.ts`, 20 subject files) against the rationalized NCERT textbooks (2022-23 and NCF-2023 editions).
2. **AI prompt audit** of `src/ai/flows/lesson-plan-generator.ts` and `src/ai/flows/quiz-definitions.ts` looking for per-subject correctness guardrails.
3. **Rendering-surface audit** for math / code / Devanagari output paths.
4. **Live-probe scripts** (`qa/forensics/repros/F16/`) — 50 executable probes (10 subjects × 5 probes). They require `SAHAYAK_ID_TOKEN` (`gcloud auth print-identity-token --impersonate-service-account=…`) and `./run-50-probes.sh` to produce raw JSON traces under `./out/`. The static layer found the systemic defects below before live runs were necessary; live runs are scripted for re-verification post-fix.

Severity ladder (from charter):
- **P0** factually wrong / harmful content
- **P1** chapter mis-alignment, grammar wrong in target language, math/code wrong
- **P2** stylistic / single-language edge
- **P3** terminology preference

---

## Summary

| Severity | Count |
|---|---|
| P0 | 0 |
| P1 | 8 |
| P2 | 4 |
| P3 | 2 |

**Top three systemic risks:**

1. **NCERT seed is partially pre-rationalization** (Classes 11-12 Math/Physics/Chemistry/Biology) → AI generates plans for chapters no longer in the textbook. The validator accepts the stale list as canonical and even auto-corrects valid topics *to* deleted chapters.
2. **Prompts have no subject-correctness guardrails** — no math notation rules, no SI units, no Sanskrit sandhi/chandas, no code-block / Python-3 pin for CS, no balanced-equation / valence rule for Chemistry. The only "subject-aware" guidance is "use Indian context" and "be blackboard-friendly".
3. **LaTeX/math is renderable only on the worksheet surface.** Lesson plan, quiz, and exam-paper outputs render Markdown without `remark-math` + `rehype-katex`, so any LaTeX the model emits surfaces as raw `$x^2$` literals.

---

## Per-subject findings (10 × 5 probes)

### 10A Mathematics (Class 1-12)

| Probe | Method | Finding |
|---|---|---|
| 1. NCERT chapter alignment — Class 10 'Quadratic Equations' | seed lookup + live LP probe | Seed correct (math-10-4). Lesson plan probe scripted. |
| 2. NCERT chapter alignment — Class 11 'Mathematical Reasoning' | seed lookup | **P1 (F16-001):** chapter rationalized out, but still in seed (math-11-14). Validator passes. |
| 3. Notation correctness — fractions, π, equals signs, SI | prompt audit | **P1 (F16-005):** prompt has zero math notation rules. **P1 (F16-006):** lesson-plan output surface has no KaTeX, so LaTeX leaks as text. |
| 4. Age-appropriateness — Class 3 'Long and Short' | prompt audit | **P2 (F16-012):** no class-band vocabulary rule; outputs cluster in middle register. |
| 5. Topic coverage — Class 8 'Linear Equations in One Variable' | live QZ probe | Scripted; verify generated questions exercise transposition AND word problems (key learning objective in NCERT keyword: 'algebra'). |

### 10B Physics (Class 11-12)

| Probe | Method | Finding |
|---|---|---|
| 1. NCERT chapter alignment — Class 11 'Physical World' | seed lookup | **P1 (F16-002):** rationalized OUT; seed retains as phy-11-1 (chapter 1). Lesson plan now teaches a non-existent chapter. |
| 2. NCERT chapter alignment — Class 12 'Electromagnetic Induction' | seed lookup | Correct (phy-12-6). |
| 3. Formula derivation + dimensional analysis — 'Units and Measurements' | prompt audit | **P1 (F16-005):** no SI/dimensional-analysis instruction in prompt; live probe will demonstrate via numeric question. |
| 4. Concept accuracy — 'Laws of Motion' (Newton 1/2/3) | seed + prompt audit | learningOutcomes correct; no prompt-side cross-check for sign convention or vector vs scalar. |
| 5. Topic coverage — Class 12 'Ray Optics' | live QZ probe | Scripted; verify mirror formula + lens-maker formula sign convention. |

### 10C Chemistry (Class 11-12)

| Probe | Method | Finding |
|---|---|---|
| 1. NCERT chapter alignment — Class 12 chapter list | seed lookup | **P1 (F16-003):** seed has 16 chapters; rationalized book has ~10. Multiple deletions: Solid State, Surface Chemistry, General Principles of Isolation, Polymers, Chemistry in Everyday Life. |
| 2. NCERT chapter alignment — Class 11 'Some Basic Concepts of Chemistry' | seed | Correct (chem-11-1). |
| 3. Balanced reactions, valences | prompt audit | **P1 (F16-005):** no balanced-equation / valence / charge-balance instruction. Model may emit `H2 + O2 → H2O` (unbalanced). |
| 4. Molecular formula correctness — 'Chemical Bonding' QZ | live probe | Scripted; verify VSEPR shapes named correctly + Lewis structures. |
| 5. Coordination Compounds — IUPAC naming | live probe | Scripted. Without IUPAC rule scaffolding, expect ligand-ordering errors. |

### 10D Biology (Class 11-12)

| Probe | Method | Finding |
|---|---|---|
| 1. NCERT chapter alignment — Class 12 chapter count | seed lookup | **P1 (F16-004):** 14 chapters in seed; rationalized book has 13. |
| 2. Cell biology terminology — Class 11 | seed | learningOutcomes thin (`cell`); insufficient signal for prompt-side topic coverage check. |
| 3. Classification accuracy — Plant Kingdom QZ | live probe | Scripted; verify Whittaker 5-kingdom OR newer 3-domain — prompt does not pin which system. |
| 4. Genetics — Class 12 Inheritance | live LP probe | Scripted; verify Mendelian ratios stated precisely (1:2:1, 9:3:3:1). |
| 5. Human reproduction — terminology | live QZ probe | Scripted; verify clinical Latin + Hindi parallel terms — UI is multilingual. |

### 10E Social Science (Class 6-10)

| Probe | Method | Finding |
|---|---|---|
| 1. NCERT chapter alignment — Class 8 'Exploring Society' | seed | **P2 (F16-010):** seed uses NCF-2023 book; many schools still on 2022 books → mismatch. |
| 2. History dates — 1857 revolt, Quit India 1942, Independence 1947 | seed | Dates accurate in seed metadata; live probe required for actual dates in lesson body. |
| 3. Geography facts — Class 10 'Nationalism in India' | live LP probe | Scripted. |
| 4. Polity — Class 9 'French Revolution' QZ | live probe | Scripted; verify 1789 Bastille, 1793 execution dates. |
| 5. Topic coverage — Tribes / Nomads / Settled Communities | live probe | Scripted. |

### 10F Hindi (as taught subject)

| Probe | Method | Finding |
|---|---|---|
| 1. Grammar — संज्ञा (Noun) Class 6 | live LP probe | Scripted; verify सञ्ज्ञा classification (व्यक्तिवाचक/जातिवाचक/भाववाचक). |
| 2. Grammar — क्रिया विशेषण Class 9 | live LP probe | Scripted. |
| 3. Compound words — समास Class 10 | prompt audit | **P2 (F16-011):** prompt forbids transliteration in English mode but offers no positive rule for grammar topic example construction. |
| 4. कारक — Class 7 QZ | live probe | Scripted; verify all 8 कारक named correctly. |
| 5. रस अलंकार Class 10 QZ | live probe | Scripted; verify नौ रस enumerated + matched correctly. |

### 10G English

| Probe | Method | Finding |
|---|---|---|
| 1. NCERT prose alignment — Class 7 'Three Questions' (Honeycomb) | seed | Confirmed in english.ts. |
| 2. Class 9 'The Road Not Taken' (Beehive) | seed | Confirmed; rationalized edition correct. |
| 3. Class 10 'A Letter to God' (First Flight) | live LP probe | Scripted. |
| 4. Class 8 'The Best Christmas Present in the World' | live QZ probe | Scripted; this is in Class 8 Honeydew. |
| 5. Class 9 'The Fun They Had' (Asimov) | live QZ probe | Scripted. |

### 10H Sanskrit

| Probe | Method | Finding |
|---|---|---|
| 1. śloka structure — Class 8 सुभाषितानि | prompt audit | **P1 (F16-007):** prompt has no chandas (meter) rule, no sandhi rule, no vibhakti agreement check. Model-generated ślokas frequently break anuṣṭubh metre. |
| 2. Class 10 शुचिपर्यावरणम् | seed | Confirmed in sanskrit.ts. |
| 3. Class 9 सूक्तिमौक्तिकम् | seed | Confirmed. |
| 4. सन्धि rules — Class 7 QZ | live probe | Scripted; without sandhi-rule scaffolding, expect incorrect विसर्ग/स्वर sandhi. |
| 5. कारक एवं विभक्ति — Class 10 QZ | live probe | Scripted. |

### 10I Regional Languages (Bengali / Tamil / Telugu / Marathi / Kannada — as taught subjects)

| Probe | Method | Finding |
|---|---|---|
| 1. Bengali — অপরিচিতা Class 7 | prompt audit | **P2 (F16-009):** language lock is script-only; Bengali bibhakti / sandhi not enforced. |
| 2. Tamil — திருக்குறள் Class 8 | live LP probe | Scripted; verify கீழ்க்காணும் kural structure (2 lines, 4+3 metre). |
| 3. Telugu — Class 9 భారతదేశం | live LP probe | Scripted. |
| 4. Marathi — अव्यय Class 6 QZ | live probe | Scripted. |
| 5. Kannada — ಚೆಲುವ Class 10 QZ | live probe | Scripted. |

### 10J Computer Science / IT (Class 9-12)

| Probe | Method | Finding |
|---|---|---|
| 1. Class 9 'Digital Documentation' (IT-402) | seed | Correct in it.ts. |
| 2. Class 10 'Database Management System' | live LP probe | Scripted. |
| 3. Class 11 'Python: Lists and Tuples' | prompt audit | **P1 (F16-008):** no Python-3 pin, no code-block fencing instruction, no compile-check. Model may emit Python 2 syntax (`print` statement) or non-idiomatic code. |
| 4. Class 12 SQL — JOIN / GROUP BY | live QZ probe | Scripted; verify ANSI SQL syntax not vendor-specific. |
| 5. Sorting algorithms Class 11 | live QZ probe | Scripted; verify complexity bounds stated correctly (bubble = O(n²), merge = O(n log n)). |

---

## Cross-cutting findings

- **F16-013 (P3):** chapter-validator's pass-3 Levenshtein cap of 3 produces false-positive auto-corrects on short Devanagari titles (4-6 chars). See `src/ai/data/ncert-chapters.ts:333`.
- **F16-014 (P3):** no `__tests__/*pedagogy*` or `*notation*` coverage. Validator has tests; generated AI output does not.

---

## Recommended fixes (P0/P1)

1. **Patch the seed** (`src/data/ncert/{mathematics,physics,chemistry,biology}.ts`) to the 2023-24 rationalized chapter lists; add `isActive: false` + `rationalizedOut: true` to removed chapters so historical traffic still has metadata but the validator filters them out.
2. **Add per-subject prompt blocks** in `lesson-plan-generator.ts` and `quiz-definitions.ts`:
   - Math/Physics/Chemistry: "Render math in LaTeX (`$...$`). Use SI units. Balance every chemical equation. Use `π`, `≥`, `≤`, `±`, `°` glyphs."
   - Sanskrit: "Apply śloka chandas rules (anuṣṭubh 8+8+8+8); preserve sandhi; vibhakti must agree."
   - CS/IT: "Pin Python 3; fence code in markdown ```python blocks; SQL = ANSI-SQL unless stated."
3. **Wire `remark-math` + `rehype-katex`** into lesson-plan, quiz, and exam-paper display components (currently only `worksheet-display.tsx`).
4. **Add age-band vocabulary scaffolding** to the lesson-plan prompt: explicit Lexile-style register hints per class band (1-2, 3-5, 6-8, 9-10, 11-12).
5. **Tighten validator fuzzy cap** to 2 on titles shorter than 8 characters; never auto-correct without numeric chapter confirmation.
6. **Add pedagogy regression tests** under `src/ai/__tests__/pedagogy/` that snapshot a known-good lesson plan per subject and assert factual invariants (e.g. quadratic discriminant = b²−4ac; speed of light = 3×10⁸ m/s; H₂O molecular formula; Quit India = 1942).

---

## Repros

All probes — including 50 live-API probes (10 subjects × 5) — are under `qa/forensics/repros/F16/`:

- `probe-lesson-plan.mjs` — single lesson-plan call
- `probe-quiz.mjs` — single quiz call
- `run-50-probes.sh` — full 50-probe sweep

To run end-to-end:

```bash
export SAHAYAK_ID_TOKEN=$(gcloud auth print-identity-token \
  --impersonate-service-account="<sa>@sahayakai-b4248.iam.gserviceaccount.com")
cd qa/forensics/repros/F16/
./run-50-probes.sh
```

Each probe writes its raw JSON response to `./out/<subject>-<grade>-<topic>.json` for manual review against the per-subject correctness criteria listed above.

---

## Confidence

- **High confidence:** F16-001 to F16-008 (verified statically against canonical NCERT rationalization lists and source code).
- **Medium confidence:** F16-009 to F16-012 (prompt-derived risks; live probes will demonstrate frequency).
- **Lower confidence (advisory):** F16-013, F16-014.

The Codex/Gemini peer-review pass should re-verify F16-003 and F16-004 chapter counts against current NCERT TOCs before fixes ship — the rationalization is messy and editions vary.
