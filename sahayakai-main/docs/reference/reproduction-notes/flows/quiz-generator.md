# AI Flow: Quiz Generator

**Files:**
- `src/ai/flows/quiz-generator.ts` — orchestrator
- `src/ai/flows/quiz-definitions.ts` — prompt definitions and output schema
- `src/ai/flows/quiz-definitions-enhanced-validation.ts` — additional validation

**API Route:** `POST /api/ai/quiz`

---

## Purpose

Generate quizzes at 3 difficulty levels simultaneously. Uses Bloom's Taxonomy levels to calibrate question complexity. Validates output schema strictly.

---

## Input Schema

```ts
{
  topic: string;
  gradeLevel: GradeLevel;
  subject: Subject;
  language: Language;
  questionTypes: ('mcq' | 'true-false' | 'fill-blank' | 'short-answer')[];
  bloomsLevels: ('Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create')[];
  questionCount: number;       // per difficulty level
}
```

---

## Processing Steps

1. Build 3 separate prompts (easy/medium/hard) with different Bloom's level emphasis
2. **Generate all 3 in parallel** (`Promise.all([easyCall, mediumCall, hardCall])`)
3. Each call independently validates output schema
4. Merge results into unified output

---

## Output Schema

```ts
{
  title: string;
  questions: {
    easy: QuizQuestion[];
    medium: QuizQuestion[];
    hard: QuizQuestion[];
  }
}

QuizQuestion: {
  id: string;
  question: string;
  options?: string[];           // MCQ only
  answer: string;
  type: 'mcq' | 'true-false' | 'fill-blank' | 'short-answer';
  bloomsLevel: string;
  explanation?: string;
}
```

---

## Parallel Generation

Key architectural decision: all 3 difficulty levels generated in parallel.
- Easy: emphasizes Remember/Understand Bloom's levels
- Medium: emphasizes Apply/Analyze
- Hard: emphasizes Evaluate/Create

This means 3x the API calls but 3x faster than sequential. Total latency ≈ latency of one call.

---

## Validation

`quiz-definitions-enhanced-validation.ts` adds:
- Ensures no duplicate questions across difficulties
- Ensures answer is always one of the provided options (for MCQ)
- Ensures Bloom's level matches difficulty band
- Falls back to basic output if validation fails (no silent error)
