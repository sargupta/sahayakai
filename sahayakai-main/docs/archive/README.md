# Archived documents

These documents describe architectures, features, or systems that were **proposed or reviewed but never built**. They are retained for historical context only. **Do not use them for onboarding or as a reference for how the system works.** For the real, current architecture, see [`docs/SYSTEM_OVERVIEW.md`](../SYSTEM_OVERVIEW.md).

Why each was archived (verified against the production code, 2026-07-19):

| Document | Why it does not match reality |
|---|---|
| `SOLUTION_ARCHITECTURE.md` | Describes a three-codebase "Agent Garden" architecture that does not exist. The app is a single Next.js app on Cloud Run. |
| `ARCHITECTURE_REVIEW.md` | Reviews a fictional VertexAI "Agent Garden" / A2A stack with zero references in `src/`. |
| `ARCHITECTURE_REVIEW_ADDENDUM.md` | Doubles down on the same fictional stack. |
| `MOBILE_UX_ANALYSIS.md` | Analyzes a native Flutter app with nine themed "Studios". The actual Android app is a Capacitor wrapper around the PWA. |
| `TEACHER_CONNECT_SCHEMA.md` | A hybrid Firestore + Cloud SQL / PostgreSQL schema. There is no Cloud SQL dependency anywhere. |
| `TEACHER_CONNECT_PUB_SUB.md` | A Google Pub/Sub fan-out feed design. There is no Pub/Sub dependency. |
| `DATABASE_VERIFICATION_REPORT.md` | Verifies the fictional Firestore + Cloud SQL "TeacherConnect" design above. |

If you need the real equivalents: the data model is in [`docs/SYSTEM_OVERVIEW.md`](../SYSTEM_OVERVIEW.md) Section 8 and `firestore.rules`; the infra topology is in [`docs/MUMBAI_REGION_MIGRATION_RUNBOOK.md`](../MUMBAI_REGION_MIGRATION_RUNBOOK.md); the mobile app is covered in `sahayakai-android/`.
