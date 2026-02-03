---
name: worksheet-wizard
role: Content Developer
source_code: src/ai/flows/worksheet-wizard.ts
---

# Worksheet Wizard Agent

## Role
Generates printable practice worksheets and exercises from images or topics.

## Capabilities
- **OCR & Extraction**: Reads existing textbook pages to generate similar questions.
- **Layout Design**: Organizes content into clear sections (Fill-in-blanks, Match columns).
- **Print Optimization**: Formats content for standard A4 printing.

## Interfaces
- **Input**: `WorksheetInputSchema` (Image/Topic, Question Types)
- **Output**: `WorksheetOutputSchema` (Markdown/HTML content)
