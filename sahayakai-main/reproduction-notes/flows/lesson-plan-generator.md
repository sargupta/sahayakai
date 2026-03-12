# AI Flow: Lesson Plan Generator

**File:** `src/ai/flows/lesson-plan-generator.ts`
**API Route:** `POST /api/ai/lesson-plan`

---

## Purpose

Generate structured lesson plans following the 5E instructional model. Includes materials audit for Indian classroom realism. No web grounding (static educational content).

---

## Input Schema

```ts
{
  topic: string;
  gradeLevel: GradeLevel;
  subject: Subject;
  language: Language;
  duration: string;            // "30 minutes" | "45 minutes" | "60 minutes"
  ncertChapter?: {
    title: string;
    learningOutcomes: string[];
    keywords: string[];
  };
}
```

---

## Processing Steps

1. Normalize language/grade formats
2. Inject NCERT chapter context if provided
3. Build prompt with 5E structure requirement
4. Inject Indian context via `getIndianContextPrompt()`
5. Call Gemini — NO grounding (removed, saved $0.035/call)
6. Parse and validate output schema

---

## Output Schema (LessonPlanSchema)

```ts
{
  title: string;
  gradeLevel: string;
  subject: string;
  topic: string;
  language: string;
  duration: string;
  objectives: string[];        // 3–5 learning objectives
  materials: string[];         // Indian-realistic materials
  sections: {
    engage: string;            // Hook activity (5–10 min)
    explore: string;           // Student investigation
    explain: string;           // Teacher-led explanation
    elaborate: string;         // Extension activity
    evaluate: string;          // Assessment activity
  };
  assessment: string;          // Summative assessment description
  ncertAlignment?: string;     // If NCERT chapter provided
  diffSuggestions?: string;    // Differentiation suggestions
}
```

---

## 5E Model Enforcement

The prompt explicitly requires output structured around:
- **Engage:** Creates curiosity, activates prior knowledge
- **Explore:** Students investigate the concept
- **Explain:** Teacher clarifies and formalizes
- **Elaborate:** Students apply in new contexts
- **Evaluate:** Checks understanding

---

## Materials Audit

Prompt includes instruction: "Only list materials available in Indian government school classrooms — no projectors, no iPads. Assume chalk, blackboard, textbooks, and basic stationery."

---

## Cost Optimization

Google Search grounding was removed from this flow. Lesson plan content (5E activities, materials) doesn't need live web data. Saves ~$0.035 per generation call.
