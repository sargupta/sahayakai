# Git Branch Strategy & Log

This document tracks the purpose and status of branches in the `SahayakAI` repository to ensure disciplined version control.

## Active Branches

| Branch Name | Status | Purpose | Key Features / Changes |
| :--- | :--- | :--- | :--- |
| **`main`** | 🟢 Stable | Production-ready code. | The "Golden Copy". Only merged into after verification. |
| **`feature/mvp-quality-improvement`** | 🟡 Active | Implementing "World Class" UI/UX & Critical MVP Featuers. | - "Structured Minimalism" UI<br>- Lesson Plan Result Rewrite<br>- Native PDF Export<br>- Global Feedback System<br>- Firestore Content Saving<br>- Architecture Docs |

## Merged / Archived Branches

| Branch Name | Date Merged | Purpose |
| :--- | :--- | :--- |
| `feature/lesson-plan-ui-refactor` | (Previously) | Initial work on splitting the Lesson Plan into components. |

## workflow

1.  **Create Feature Branch**: `git checkout -b feature/topic-name` from `main`.
2.  **Develop & Verify**: Make changes, verify with `npm run dev` and Browser Tools.
3.  **Commit**: Use descriptive commit messages (`feat:`, `fix:`, `docs:`).
4.  **Merge**: Switch to `main`, `git merge feature/topic-name`.
5.  **Tag**: (Optional) Tag versions for release.
