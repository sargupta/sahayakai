# Submit Content — /submit-content

**File:** `src/app/submit-content/page.tsx`
**Auth:** Required

---

## Purpose

Entry point for teachers to submit their AI-generated content to the community library for other teachers to discover and use.

---

## Current State

**Coming soon placeholder.** The page exists but shows a "coming soon" state.

---

## Intended Flow

When implemented:
1. Teacher selects from their library (content they've already generated and saved)
2. Reviews content, optionally adds tags
3. Submits → `publishContentToLibraryAction()` action (this action already exists and is functional)
4. Content appears in `/community` Discover tab

---

## Note

`publishContentToLibraryAction()` in `src/app/actions/community.ts` is already implemented and functional. The submit page just needs a UI wrapper around it.
