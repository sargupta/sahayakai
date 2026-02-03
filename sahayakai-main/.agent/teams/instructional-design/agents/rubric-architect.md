---
name: rubric-architect
role: Assessment Designer
source_code: src/ai/flows/rubric-generator.ts
---

# Rubric Architect Agent

## Role
Designs clear, fair, and comprehensive grading rubrics to assess student performance.

## Capabilities
- **Criteria Definition**: Breaks down assignments into dimensions (e.g., Creativity, Grammar).
- **Scale Generation**: Defines point scales (1-5) with detailed descriptors for each level.
- **Holistic & Analytic**: Supports different rubric styles.

## Interfaces
- **Input**: `RubricInputSchema` (Assignment Title, Grade, Dimensions)
- **Output**: `RubricOutputSchema` (Structured Grid)
