# SahayakAI: Application Audit Master Plan

**Date:** Feb 02, 2026
**Status:** In Progress
**Objective:** A "No Nonsense" forensic review of the entire SahayakAI ecosystem (Web, Mobile, Backend).

---

## 1. The Council of Experts ("Who is Who")
To ensure a rigorous, multidimensional review, we have constituted a panel of specialized expert personas. Each expert has a distinct philosophy and focus area.

| Expert Persona | Real-World Role | Philosophy & Focus |
| :--- | :--- | :--- |
| **Dr. Aris** | **Lead System Architect** | *"Structure is Destiny."* Focuses on scalability, database schema, sharding, and data flow. Hates redundancy. |
| **Sentinel** | **CISO (Security Lead)** | *"Trust No One."* Focuses on Authentication, Authorization, API security, PII protection, and compliance (DPDP). |
| **Pixel** | **Principal UI Engineer** | *"God is in the Details."* Focuses on Next.js/React patterns, Tailwind implementation, responsiveness, and performance (Lighthouse). |
| **Fluttershy** | **Mobile Tech Lead** | *"Native Fidelity."* Focuses on Dart/Flutter best practices, state management (Riverpod/Bloc), and offline capability. |
| **Synapse** | **AI Research Scientist** | *"Intelligence with Intent."* Focuses on Genkit flows, prompt engineering, latency, and hallucination control. |
| **Sherlock** | **Forensic Data Auditor** | *"The Truth is in the Logs."* Focuses on data integrity, orphaned records, and edge cases. |
| **Scrum Master** | **Project Manager** | *"Execution is Everything."* Synthesizes findings into actionable tasks and manages the roadmap. |

---

## 2. Audit Scope & Methodology

### Zone A: The Core (Backend & AI)
*Led by Dr. Aris & Synapse*
**Flows to Audit:**
- [ ] `lesson-plan-generator.ts` & `lesson-plan` schema
- [ ] `quiz-generator.ts` & `quiz-definitions.ts`
- [ ] `worksheet-wizard.ts`
- [ ] `visual-aid-designer.ts`
- [ ] `virtual-field-trip.ts`
- [ ] `rubric-generator.ts`
- [ ] `avatar-generator.ts`
- [ ] `teacher-training.ts`
- [ ] `instant-answer.ts`
- [ ] `voice-to-text.ts` & `agent-router.ts`

**Infrastructure:**
- [ ] `src/lib/firebase-admin.ts` (Auth/Secrets)
- [ ] `src/lib/db/adapter.ts` (Data Access Layer)
- [ ] `src/data/ncert` (Static Content)

### Zone B: The Web Platform (Next.js)
*Led by Pixel & Sentinel*
**Pages/Routes to Audit:**
- [ ] `lesson-plan/page.tsx`
- [ ] `quiz-generator/page.tsx`
- [ ] `worksheet-wizard/page.tsx`
- [ ] `visual-aid-designer/page.tsx` & `visual-aid-creator/page.tsx`
- [ ] `virtual-field-trip/page.tsx`
- [ ] `rubric-generator/page.tsx`
- [ ] `my-library/page.tsx` & `community-library/page.tsx`
- [ ] `my-profile/page.tsx`
- [ ] `teacher-training/page.tsx`
- [ ] `impact-dashboard/page.tsx`
- [ ] `submit-content/page.tsx` & `content-creator/page.tsx`
- [ ] `video-storyteller/page.tsx`
- [ ] `review-panel/page.tsx`
- [ ] `instant-answer/page.tsx` & `community/page.tsx`
- [ ] Root `page.tsx` & `layout.tsx`

**Components & Hooks:**
- [ ] `src/components` (UI Library)
- [ ] `src/features` (Business Logic)
- [ ] `middleware.ts` (Route Protection)

### Zone C: The Mobile Interface (Flutter)
*Led by Fluttershy*
-   **Review Target:** `sahayakai/sahayakai_mobile/lib`.
-   **Objectives:** Validate project structure, API integration strategy, and feature parity with Web.

---

## 3. Execution Roadmap

### Phase 1: reconnaissance (Current Phase)
-   [ ] **Inventory:** Map out the file structure of Web vs Mobile.
-   [ ] **Config Setup:** Verify environment variables and shared configurations.

### Phase 2: The Deep Dive
-   [ ] **AI Logic Audit:** Synapse to review `lesson-plan`, `quiz`, `worksheet` flows.
-   [ ] **Security Sweep:** Sentinel to check API Routes and Firestore Rules.
-   [ ] **Mobile Review:** Fluttershy to analyze Dart code organization.

### Phase 3: Synthesis & Fixes
-   [ ] **Report Generation:** Compile "Critical", "Major", and "Minor" issues.
-   [ ] **Refactoring Plan:** Create a step-by-step fix list.
