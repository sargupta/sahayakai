# Gemini Integration

This document provides a detailed overview of the AI integration in the Sahayakai platform, powered by Google's Genkit.

## Genkit Flows

Genkit is used to define and orchestrate the AI-powered features of the platform. Each feature is implemented as a Genkit flow, which is a sequence of steps that can include model invocations, tool usage, and data processing.

### Core Flows

- **`instant-answer.ts`:** Provides immediate answers to user queries by leveraging a large language model.
- **`lesson-plan-generator.ts`:** Generates comprehensive lesson plans based on user-defined topics, subjects, and grade levels.
- **`quiz-generator.ts`:** Creates quizzes with various question types (multiple choice, true/false, short answer) from a given text or topic.
- **`rubric-generator.ts`:** Generates detailed rubrics for assessing student work based on specified criteria.
- **`visual-aid-designer.ts`:** Designs visual aids, such as presentations and infographics, based on user input.
- **`virtual-field-trip.ts`:** Creates immersive virtual field trip experiences.
- **`worksheet-wizard.ts`:** Generates worksheets with practice problems and exercises.

### Supporting Flows

- **`avatar-generator.ts`:** Generates user avatars.
- **`teacher-training.ts`:** Provides AI-powered teacher training modules.
- **`voice-to-text.ts`:** Transcribes spoken language into text.

## Data Schemas

To ensure type safety and data consistency, we use Zod schemas to define the input and output structures for our Genkit flows.

- **`quiz-generator-schemas.ts`:** Defines the data structures for creating quizzes, including the quiz itself, questions, and answer choices.

## Tools

Genkit tools are used to extend the capabilities of our AI models.

- **`google-search.ts`:** Allows our flows to access real-time information from the web by performing Google searches. This is crucial for providing up-to-date answers and generating relevant content.
