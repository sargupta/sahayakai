# SahayakAI Project Map (gemini.md)

## Project Overview
**Status:** Blueprint Phase (B.L.A.S.T. Protocol)
**Last Updated:** 2026-01-29
**Project Identity:** "Bharat First" AI Teaching Assistant for Rural India.

## B.L.A.S.T. Protocol Progress
- [x] **B - Blueprint:** Discovery synthesized from Strategic Review & Roadmap
- [x] **L - Link:** Verified Gemini/Genkit connectivity via `tools/verify_link.ts`
- [x] **A - Architect:** Comprehensive Ecosystem SOPs roll-out (Master, Interactive, Support, Lesson Plan) - Layer 1 Complete.
- [ ] **S - Stylize:** Premium "Bharat" UX/UI Refinement (In Progress: Added Copy button to Instant Answer card)
- [ ] **T - Trigger:** Automation & Deployment triggers

## Discovery Questions (Synthesized)
*   **North Star:** Transform SahayakAI from a single-user tool to a nationwide ecosystem platform. Immediate priority: Completing the "Indian Context" transformation and establishing a "Semantic Cache" for sustainability.
*   **Integrations:** 
    *   **Core:** Google Gemini (via Genkit), Firebase (Hosting/Functions/Auth).
    *   **Priority:** Semantic Caching layer (to be built), Supabase/Realtime DB migration for curriculum mapping.
    *   **Future:** Student/Parent communication (WhatsApp/SMS).
*   **Source of Truth:** 
    *   Current: `src/lib/indian-context.ts` (Context Data), `src/ai/flows/` (AI Prompts).
    *   Technical: `STRATEGIC_REVIEW.md` and `RURAL_INDIA_ROADMAP.md` as policy guides.
*   **Delivery Payload:** Structured, culturally relevant lesson plans, localized UI (10+ languages), and offline-ready PWA assets.
*   **Behavioral Rules:** 
    *   **The "Bharat-First" Constraint:** Mandatory use of Indian rural contexts (Agriculture, local geography, zero-cost resources).
    *   **Resource Awareness:** Default assumption is "Chalk & Blackboard" environment.
    *   **Tone:** Supportive, pedagogical, and highly accessible (voice-first).
    *   **Reliability:** Deterministic business logic must wrap LLM outputs.

## Data Schema (Lesson Plan Payload)
```json
{
  "title": "string",
  "gradeLevel": "string (Required)",
  "duration": "string (Required)",
  "subject": "string (Required)",
  "objectives": ["string"],
  "keyVocabulary": [{"term": "string", "meaning": "string"}],
  "materials": ["string"],
  "activities": [
    {
      "phase": "Engage | Explore | Explain | Elaborate | Evaluate",
      "name": "string",
      "description": "string",
      "duration": "string",
      "teacherTips": "string (Optional)",
      "understandingCheck": "string (Optional)"
    }
  ],
  "assessment": "string",
  "homework": "string (Optional)"
}
```

## Data Schema (Teacher Training Payload)
```json
{
  "introduction": "string (Required) - Empathetic acknowledgment of the teacher's concern",
  "advice": [
    {
      "strategy": "string (Required) - Actionable classroom technique",
      "pedagogy": "string (Required) - Core pedagogical principle name (e.g., 'Scaffolding', 'Zone of Proximal Development')",
      "explanation": "string (Required) - Simple explanation with Indian context analogy"
    }
  ],
  "conclusion": "string (Required) - Motivational closing statement"
}
```

## Data Schema (Micro-Lesson Payload)
```json
{
  "topic": "string (Required)",
  "gradeLevel": "string (Required)",
  "sequenceNumber": "number (Required) - 1 for first lesson, 2 for second...",
  "slides": [
    {
      "slideNumber": "number (1-5)",
      "type": "Title | Concept | Example | Activity | Summary",
      "content": {
        "title": "string",
        "bulletPoints": ["string"],
        "visualPrompt": "string (Description for image generation or placeholder)",
        "teacherNotes": "string (Script for the teacher)"
      }
    }
  ]
}
```

## Architectural Boundaries
- **Logic Layer:** All business rules (NCERT mapping, Bharat-context injection, pedagogical grounding) happen in the AI System Prompt guided by `architecture/` SOPs.
- **Validation Layer:** Deterministic checks for "Westernisms", metadata completeness, and mandatory pedagogical citations.

## Maintenance Log
*   **2026-01-29:** Project initialized. Discovery Questions answered via strategic analysis. Handshake verified Gemini API link. Created `architecture/lesson_plan_generation_sop.md`.
*   **2026-01-29:** Commenced **Phase 4: S - Stylize**. Added Copy button and improved layout for the Instant Answer component on the homepage.
*   **2026-01-29:** **Schema First Pattern Established** - Defined Teacher Training payload schema in `gemini.md`, created `validate_teacher_training.ts` validator, and integrated it into the flow. Tests confirm deterministic checks for empathy, pedagogy citations, and encouragement.
*   **2026-01-29:** **Agentic Skills Deployed** - Created `senior-software-engineer` and `scrum-master` skills. These enforce "Business Serious" operating protocols for Code Architecture and Project Governance.
*   **2026-01-29:** **Skills Upgraded to Expert Level** - Enhanced skills with "Phased Workflows", bundled Reference Templates (ADR, Checklists, Standups), and Python Automation Scripts (`scaffold_test.py`, `generate_status_report.py`).
*   **2026-01-29:** **Micro-Lesson Generator DEPLOYED (Vertical Slice 1)** - Completed Logic, UI, and PDF Export.
    *   **Architecture:** Enforced 5-slide rule via Validator.
    *   **Quality:** Passed Senior Engineer Audit (Complexity Check) and Vitest functional tests.
    *   **Feature:** Client-side PDF generation producing 5-slide, high-contrast decks.
*   **Next Step:** Apply Schema First methodology to remaining services (Quiz, Worksheet, Field Trip) and refine the UI to match the data contracts.

