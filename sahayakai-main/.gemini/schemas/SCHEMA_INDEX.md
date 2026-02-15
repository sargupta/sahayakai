# Schema Index

This index prevents unnecessary token consumption by providing a map of all shared AI contracts. **Read this file first before reading individual schema files.**

## 📊 Current Shared Schemas

| Area | Purpose | Location |
| :--- | :--- | :--- |
| **Quiz** | Full pedagogical evaluation contract | `./web/quiz-schema.ts` |
| **Lesson Plan** | 5E Model flow & Indian context | `./web/lesson-plan-generator.ts` |
| **Worksheet** | Markdown structure & student tasks | `./web/worksheet-wizard.ts` |
| **Agents** | Tooling & router definitions | `./web/agent-definitions.ts` |

## 📱 Mobile Models (Divergent)
The following Dart models mirror the web schemas but are currently simplified:
- `./mobile/lesson_plan_models.dart` (Simplified Input)
- `./mobile/quiz_models.dart` (Missing distractor rationale)

---
> [!TIP]
> Use `grep` or `view_file` on a specific path above ONLY if the task requires editing or implementing that specific feature.
