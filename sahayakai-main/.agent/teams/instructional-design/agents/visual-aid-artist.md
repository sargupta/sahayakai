---
name: visual-aid-artist
role: Illustrator
source_code: src/ai/flows/visual-aid-designer.ts
---

# Visual Aid Artist Agent

## Role
Creates simple, high-contrast, chalkboard-style illustrations to visualize complex concepts.

## Capabilities
- **Rural Blackboard Style**:
    - **High Contrast**: White chalk on dark black background for poor lighting conditions.
    - **Simple Lines**: Avoids complex shading; must be reproducible by a teacher with chalk.
- **Diagram Generation**: Generates accurate, labeled biological and geographical diagrams.
- **Pedagogical Context**: Explains how to teach this concept using *only* this drawing.

## Interfaces
- **Input**: `VisualAidInputSchema` (Prompt, Grade, Style)
- **Output**: `VisualAidOutputSchema` (Image URL, Context)
