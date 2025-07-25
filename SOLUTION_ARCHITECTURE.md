# Solution Architecture

This document outlines the architecture of the Sahayakai platform, a full-stack application built on Next.js and Firebase.

## High-Level Architecture

The platform is divided into three main components:

1.  **Frontend:** A responsive web interface built with Next.js and React.
2.  **Backend:** A set of AI-powered services built with Genkit.
3.  **Database:** A NoSQL database powered by Firebase Firestore.

```ascii
+-----------------------------------------------------------------+
|                           User (Educator/Student)               |
+-----------------------------------------------------------------+
                  |
                  v
+-----------------------------------------------------------------+
|                     Frontend (Next.js/React)                    |
|-----------------------------------------------------------------|
| - UI Components (Shadcn)                                        |
| - App Router                                                    |
| - Tailwind CSS                                                  |
+-----------------------------------------------------------------+
                  |                                 ^
                  | (API Calls)                     | (Data)
                  v                                 |
+-----------------------------------------------------------------+
|                       Backend (Genkit/Node.js)                  |
|-----------------------------------------------------------------|
| - Genkit Flows (Lesson Plans, Quizzes, etc.)                    |
| - AI Model Integration (Google AI)                              |
| - Tools (Google Search)                                         |
+-----------------------------------------------------------------+
                  |                                 ^
                  | (Data Access)                   | (Data)
                  v                                 |
+-----------------------------------------------------------------+
|                    Database (Firebase Firestore)                |
|-----------------------------------------------------------------|
| - User Data                                                     |
| - Content (Lesson Plans, Quizzes)                               |
| - Community Posts                                               |
| - Firebase Authentication                                       |
+-----------------------------------------------------------------+
```

## Frontend

The frontend is a single-page application (SPA) built with Next.js. It uses the App Router for routing and server-side rendering (SSR) for improved performance and SEO.

### Key Libraries

- **React:** For building user interfaces.
- **TypeScript:** For static typing and improved developer experience.
- **Tailwind CSS:** For styling and responsive design.
- **Shadcn/ui:** For a set of pre-built UI components.

### Component Structure

The frontend is organized into a set of reusable components, located in the `src/components` directory. These components are used to build the various pages of the application, which are located in the `src/app` directory.

## Backend

The backend is built with Genkit, a framework for building AI-powered applications. It exposes a set of flows that are called by the frontend to perform various tasks, such as generating lesson plans, quizzes, and visual aids.

### Key Technologies

- **Genkit:** For orchestrating AI models and tools.
- **Node.js:** As the runtime environment for Genkit.
- **Google AI Models:** For natural language processing and generation.

## Database

The database is powered by Firebase Firestore, a NoSQL document database. It is used to store all of the application's data, including user profiles, lesson plans, quizzes, and other generated content.

### Data Models

The data models are defined in `src/lib/firestore-models.ts`. They represent the structure of the documents stored in Firestore.

- **User:** Represents a user of the platform.
- **Content:** Represents a piece of content created by a user, such as a lesson plan or a quiz.
- **CommunityPost:** Represents a post in the community library.

### Security Rules

Firestore security rules are used to control access to the data. These rules ensure that users can only access their own data and that they cannot modify data that they do not own.
