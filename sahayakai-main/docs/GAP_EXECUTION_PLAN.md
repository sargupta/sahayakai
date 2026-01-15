# 🚀 Action Plan: Whitepaper Gap Analysis & Improvements

**Goal**: systematically address the vulnerabilities and inefficiencies identified in the "Master Technical Whitepaper" (Section 6).

## 1. Security & AI Safety (Critical)

### The Gap
*   **Rate Limiting**: Currently relies on `localStorage` in `use-lesson-plan.ts`. A tech-savvy student can clear cache to bypass limits and drain LLM credits.
*   **Prompt Injection**: `validateTopicSafety` is client-side. A coiled `curl` request can bypass it.

### The Fix
*   **Server-Side Rate Limiting**: Implement a Token Bucket algorithm in `src/app/actions/lesson-plan.ts` using Firestore (`rate_limits` collection) keyed by User UID (Anonymous Auth).
*   **Server-Side Validation**: Move `validateTopicSafety` to `src/lib/safety.ts` (it is there) but **call it explicitly** in the Server Action before calling Genkit.

### Implementation Steps
1.  Modify `src/lib/safety.ts` to export a `checkServerRateLimit(userId)` function.
2.  Update `src/app/actions/lesson-plan.ts` to block requests if rate limit fails.
3.  Add "Jailbreak" patterns to `unsafePatterns` (e.g., "ignore previous instructions").

## 2. PDF Export Reliability (High Value)

### The Gap
*   `window.print()` results vary by browser. Background colors often don't print.

### The Fix
*   **CSS Print Media**: Add a strictly typed `@media print` block in `globals.css`.
*   **Directives**:
    *   Force background colors (`-webkit-print-color-adjust: exact`).
    *   Hide "Generate" buttons and Sidebars.
    *   Set Margins to 0.

## 3. Cost Optimization (Medium Value)

### The Gap
*   Duplicate topics (e.g., "Gravity" vs "Physics Gravity") cause double billing.

### The Fix
*   **Soft Semantic Normalization**: In `src/app/actions/lesson-plan.ts`, implement a "Stopword Removal" normalizer (remove "the", "a", "teach me") to increase cache hit rates without a vector DB.

---

## Execution Checklist
- [ ] **Security**: Implement `checkServerRateLimit` in Firestore.
- [ ] **Safety**: Enforce `validateTopicSafety` on Server.
- [ ] **PDF**: Add `print` utility classes in `globals.css`.
- [ ] **Optimization**: Upgrade `normalizeKey` function.
