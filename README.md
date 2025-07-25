# Sahayakai: AI-Powered Educational Platform

Sahayakai is a comprehensive, AI-driven platform designed to empower educators and engage learners. It provides a suite of tools for creating dynamic lesson plans, generating assessments, designing visual aids, and fostering a collaborative learning community.

## Key Features

- **Instant Answer:** Get immediate answers to educational questions.
- **Lesson Plan Generator:** Create customized lesson plans for various subjects and grade levels.
- **Quiz Generator:** Effortlessly generate quizzes and assessments.
- **Rubric Generator:** Design detailed rubrics for evaluating student work.
- **Visual Aid Designer:** Create engaging visual aids and presentations.
- **Virtual Field Trip:** Plan and execute virtual field trips to anywhere in the world.
- **Worksheet Wizard:** Generate worksheets and practice problems.
- **Community Library:** Share and discover educational resources created by other educators.
- **Impact Dashboard:** Track student progress and engagement.

## Technical Overview

This project is a full-stack application built with Next.js, TypeScript, and Firebase. The AI-powered features are implemented using Google's Genkit.

### Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** Genkit, Node.js
- **Database:** Firebase Firestore
- **Authentication:** Firebase Authentication

### Project Structure

```
/
├── src/
│   ├── app/              # Next.js app router, pages, and layouts
│   ├── components/       # Shared React components
│   ├── ai/               # Genkit flows, tools, and schemas
│   ├── lib/              # Firebase configuration and helper functions
│   └── hooks/            # Custom React hooks
├── public/             # Static assets
└── ...                 # Configuration files
```

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- Firebase account and project

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/sahayakai.git
   ```
2. **Install dependencies:**
   ```bash
   cd sahayakai
   npm install
   ```
3. **Set up environment variables:**
   - Create a `.env.local` file in the root directory.
   - Add your Firebase project configuration to this file.
4. **Run the development server:**
   ```bash
   npm run dev
   ```

## Contribution Guidelines

We welcome contributions from the community. Please read our `CONTRIBUTING.md` file for details on how to get started.