# Database Schema Review

**Status**: In Progress
**Reviewers**: Detective (Structure), Accountant (Integrity)
**Baseline Specification**: `docs/DATABASES_SCHEMA.md` (The Source of Truth)

## 1. Compliance Audit (Detective)
We are comparing the *Actual Implementation* (`types/index.ts`, `db/adapter.ts`) against the *Master Plan* (`docs/DATABASES_SCHEMA.md`).

| Feature | Spec Status | Implementation Status | Verdict |
| :--- | :--- | :--- | :--- |
| **User Profile** | Defined (`UserProfile`) | Partial | ⚠️ Missing `impactScore`, `planType` |
| **Content Base** | Defined (`BaseContent`) | Partial | ✅ `type`, `title`, `grade` match. |
| **Lesson Plan** | JSON Schema Defined | **Loose** | ❌ Storing markdown mostly? Needs strict JSON check. |
| **Quiz** | `questions[]` array | **Strict** | ✅ Zod schema likely matches. |
| **Visual Aid** | `VisualAidSchema` | **MVP** | ⚠️ `storagePath` vs `imageUrl` discrepancy. |
| **Micro Lesson** | `slides[]` array | **Missing** | ❌ Not implemented in DB yet. |
| **Rubric** | Defined | **Missing** | ❌ Likely unstructured JSON. |

## 2. Critical Gaps Identified
1.  **Field Mismatches**: Spec uses `storagePath`, implementation might use `imageUrl`.
2.  **Strictness**: `db/adapter.ts` accepts `any` in `data`. We need to enforce `Zod` schemas *at the adapter level* before writing.
3.  **Missing Features**: The "Impact Metrics" (Gamification) defined in `user-impact` schema are completely missing from the current app.

## 3. Action Plan
1.  **Strict Typing**: Update `types/index.ts` to copy definitions *verbatim* from `docs/DATABASES_SCHEMA.md`.
2.  **Adapter Enforcement**: Modify `saveContent` to take a generic `T` and validate against a schema mapping.
3.  **Migration**: No massive data migration needed yet (user-123 is demo), but future-proofing is required now.
