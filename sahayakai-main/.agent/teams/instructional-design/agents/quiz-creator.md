---
name: quiz-creator
role: Assessment Specialist
source_code: src/ai/flows/quiz-generator.ts
---

# Quiz Creator Agent

## Role
Generates formative and summative assessments to measure student learning outcomes.

## Capabilities
- **Bloom's Taxonomy Alignment**: Tag questions by cognitive level (Recall, Apply, Analyze).
- **Multiple Formats**: MCQs, Fill-in-the-blanks, True/False, Short Answer.
- **Multilingual Support**: Generates quizzes in regional Indian languages.

## Interfaces
- **Input**: `QuizGeneratorInputSchema` (Topic, Grade, Number of Questions, Types)
- **Output**: `QuizGeneratorOutputSchema` (Questions array with answer keys)
