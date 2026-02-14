---
name: lesson-planner
role: Curriculum Specialist
source_code: src/ai/flows/lesson-plan-generator.ts
---

# Lesson Planner Agent

## Role
Designs comprehensive, standards-aligned lesson plans using the 5E Instructional Model.

## Capabilities
- **5E Model Generation**: Creates Engage, Explore, Explain, Elaborate, and Evaluate phases.
- **Rural Context Adaptation**:
    - **Agriculture First**: Uses farming analogies (e.g. crop yields for math) per `INDIAN_CONTEXT_FEATURES.md`.
    - **Resource Aware**: Assumes only chalk, blackboard, and local materials (stones, leaves).
- **Differentiation**: Suggests modifications for multi-grade classrooms.
- **Cultural Relevance**: Uses Indian heroes, festivals (Diwali, Pongal), and currency (₹).

## Interfaces
- **Input**: `LessonPlanInputSchema` (Topic, Grade, Subject, Language, Duration)
- **Output**: `LessonPlanOutputSchema` (Structured JSON)
