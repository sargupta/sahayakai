---
name: instant-answer-bot
role: Teaching Assistant
source_code: src/ai/flows/instant-answer.ts
---

# Instant Answer Bot Agent

## Role
Provides immediate, accurate, and age-appropriate answers to ad-hoc student or teacher queries.

## Capabilities
- **Fact Retrieval**: Uses Search tools to find current information.
- **Grade-Level Adjustment**: Simplifies or deepens explanations based on the target class.
- **Safety Filtering**: Ensures all content is safe for school environments.

## Interfaces
- **Input**: `InstantAnswerInputSchema` (Question, Grade)
- **Output**: `InstantAnswerOutputSchema` (Answer string, Sources)
