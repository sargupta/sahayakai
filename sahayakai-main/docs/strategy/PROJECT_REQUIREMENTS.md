# SahayakAI: Project Requirements Document

## 1. Introduction

SahayakAI is a web-based application designed to assist educators with various teaching-related tasks. It leverages generative AI to provide a suite of tools that streamline content creation and lesson planning. The application is built with a focus on multilingual support, catering to a diverse user base across different regions.

The primary goal of SahayakAI is to reduce the time and effort teachers spend on creating educational materials, allowing them to focus more on student interaction and personalized learning. The application provides a simple and intuitive interface for generating high-quality content that can be easily adapted to different grade levels and languages.

## 2. Core Features

The application is centered around a set of "agents," each responsible for a specific task. The main agents are:

*   **Lesson Plan Generator:** Creates detailed lesson plans based on a given topic, grade level, and language. The generated lesson plans include learning objectives, materials needed, step-by-step activities, and assessment methods.
*   **Quiz Generator:** Generates quizzes with a specified number of questions and question types (multiple-choice, fill-in-the-blanks, short answer). The quizzes are tailored to the specified topic and grade level.
*   **Instant Answer:** Provides direct answers to user questions on a wide range of topics. This feature is designed to be a quick reference tool for teachers.

## 3. Key Components

The application is built from a collection of reusable React components that encapsulate specific functionalities. The most important components are:

*   **`app-sidebar.tsx`:** The main navigation sidebar for the application, providing links to different sections of the site.
*   **`example-prompts.tsx`:** Displays a list of example prompts for users to try. This component is localized to support multiple languages and helps users understand the capabilities of the different AI agents.
*   **`...-display.tsx`:** A series of components for displaying the output of the AI agents. These components are responsible for rendering the generated content in a user-friendly format. Examples include:
    *   `quiz-display.tsx`: Renders a generated quiz with questions and options.
    *   `lesson-plan-display.tsx`: Displays a structured lesson plan with sections for objectives, activities, and assessments.
*   **UI Components (`src/components/ui`):** A collection of UI components from shadcn/ui, such as `Button`, `Card`, `Input`, and `Textarea`. These components are used to build the user interface and ensure a consistent look and feel across the application.
*   **Form Components:**
    *   `language-selector.tsx`: A dropdown menu for selecting the desired language for content generation.
    *   `grade-level-selector.tsx`: A component for selecting one or more grade levels.
    *   `auto-complete-input.tsx`: A text input with auto-complete suggestions to help users formulate their requests.
    *   `microphone-input.tsx`: Allows users to provide input via voice, which is then transcribed to text.

## 4. Technology Stack

### 4.1. Frontend

*   **Framework:** Next.js (React)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS with shadcn/ui components
*   **State Management:** React Hook Form (for forms), React's built-in state management (useState)
*   **Linting:** ESLint
*   **Package Manager:** npm

### 4.2. Backend (AI Flows)

*   **Framework:** Genkit (with Firebase)
*   **Language:** TypeScript
*   **Core Libraries:**
    *   `@genkit-ai/ai`: Core AI functionality
    *   `@genkit-ai/flow`: For defining and managing AI flows
    *   `@genkit-ai/firebase`: Firebase integration for Genkit
    *   `zod`: For schema validation

## 5. Project Structure

The project is organized into the following key directories:

*   `src/app`: Contains the Next.js pages and routes.
*   `src/components`: Reusable React components, including UI elements from shadcn/ui.
*   `src/ai`: Houses the Genkit AI flows, tools, and schemas.
    *   `src/ai/flows`: Contains the core agent logic (e.g., `agent-router.ts`, `lesson-plan-generator.ts`).
    *   `src/ai/schemas`: Zod schemas for validating AI model inputs.
    *   `src/ai/tools`: Custom tools for the AI agents (e.g., Google Search).
*   `public`: Static assets like images and avatars.
*   `docs`: Project documentation.

## 6. Frontend Implementation Details

### 6.1. Pages

*   **Homepage (`src/app/page.tsx`):** The main interface where users can interact with the AI agents. It includes a form for submitting requests and displays the generated content.
*   **Other pages:** The application is designed to be extensible with additional pages for specific features.

### 6.2. Components

*   **`app-sidebar.tsx`:** The main navigation sidebar for the application.
*   **`example-prompts.tsx`:** Displays a list of example prompts for users to try. This component is localized to support multiple languages.
*   **`...-display.tsx`:** A series of components for displaying the output of the AI agents (e.g., `quiz-display.tsx`, `lesson-plan-display.tsx`).
*   **UI Components (`src/components/ui`):** A collection of UI components from shadcn/ui, such as `Button`, `Card`, `Input`, and `Textarea`.

## 7. Backend (AI Flows) Implementation Details

### 7.1. Agent Router (`src/ai/flows/agent-router.ts`)

The `agentRouterFlow` is the entry point for all AI requests. It determines the user's intent and routes the request to the appropriate agent.

### 7.2. Individual Agents

Each agent is implemented as a Genkit flow:

*   **`lesson-plan-generator.ts`:** Takes a topic, grade level, and language and generates a lesson plan.
*   **`quiz-generator.ts`:** Generates a quiz based on the provided parameters.
*   **`instant-answer.ts`:** Provides a direct answer to a user's question.

### 7.3. Schema Validation

Zod schemas are used to validate the inputs for each AI flow. These schemas are defined in `src/ai/schemas`.

## 8. Localization

The application supports multiple languages. Translations are managed in the `src/components/example-prompts.tsx` file using a series of `Record<string, string>` objects. The `selectedLanguage` state determines which translation to display.

## 9. Setup and Installation

To set up and run the project locally, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set up Firebase:**
    *   Create a Firebase project.
    *   Enable the required Firebase services (e.g., Firestore, Authentication).
    *   Download your Firebase project's service account key and save it as `firebase-service-account.json` in the root of the project.
4.  **Run the development server:**
    ```bash
    npm run dev
    ```
5.  **Open the application:**
    Open your browser and navigate to `http://localhost:3000`.