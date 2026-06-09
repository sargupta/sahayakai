# Database Schema Review

**Last updated:** 2026-06-10
**Status**: Resolved (historical audit). Most gaps below have been closed; the schema in `docs/data/DATABASES_SCHEMA.md` now reflects the implemented types.
**Baseline Specification**: `docs/data/DATABASES_SCHEMA.md`

## 1. Compliance Audit (re-verified 2026-06-10)
Comparison of the *Actual Implementation* (`src/types/index.ts`, `src/lib/db/adapter.ts`) against the schema doc.

| Feature | Implementation Status | Verdict |
| :--- | :--- | :--- |
| **User Profile** | `UserProfile` (`src/types/index.ts:155`) | OK — `impactScore`, `planType`, gamification fields all present. |
| **Content Base** | `BaseContent` (`src/types/index.ts:228`) | OK — `type`, `title`, `gradeLevel`, soft-delete (`deletedAt`/`expiresAt`) present. |
| **Lesson Plan** | `LessonPlanSchema` | OK — structured JSON: flat `activities: Activity[]` with per-activity `phase` (not the old per-phase arrays). |
| **Quiz** | `QuizSchema` (`questions[]`) | OK — Zod-validated. |
| **Visual Aid** | `VisualAidSchema` | OK — uses `storageRef` (not `imageUrl`); fields `imageDataUri?, storageRef?, pedagogicalContext, discussionSpark`. |
| **Micro Lesson** | `MicroLessonSchema` (`slides[]`) | Defined in types; TODO(verify: micro-lesson is in CONTENT_TYPES but confirm a production write path exists). |
| **Rubric** | `RubricSchema` | OK — structured `criteria[].levels[]`. |
| **Assessment / performance** | `Assessment`, `AssessmentBatch` (`src/types/performance.ts`) | OK — new since original audit; backs `parent_outreach.performanceContext`. |

## 2. Resolved Gaps
1.  **Field Mismatches**: Visual Aid now uses `storageRef` consistently; documented.
2.  **Strictness**: AI flows validate payloads via Zod before persisting.
3.  **Gamification**: `impactScore`, `badges`, `contentSharedCount`, and `teacher_analytics` health scoring are implemented.

## 3. Remaining TODO
1.  TODO(verify: which collection is canonical): `feedback` vs `feedbacks` duplication (see `DATABASES_SCHEMA.md` §3).
2.  TODO(verify: relationship between `posts` and `community_posts`).
3.  Confirm a live write path exists for `micro-lesson` content.
