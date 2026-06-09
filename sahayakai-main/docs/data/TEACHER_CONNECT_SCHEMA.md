# TeacherConnect Data Schema Design

**Last updated:** 2026-06-10 (re-verified against `src/`).

This document defines the data structures for the TeacherConnect social network: **Cloud Firestore (NoSQL)** for social interactions plus **Cloud SQL (PostgreSQL)** for governed `certifications` records.

---

## 1. Firestore Collections (Real-time & Social)

> Correction: the original draft named a `profiles` collection and a `followerId/followingId` connection model. Neither matches the implementation. Profiles live in `users`; connections are mutual (not a follow graph).

### `users` (Collection) — profile source of truth
Full interface: `UserProfile` (`src/types/index.ts:155`). Social-relevant fields:
- `uid` (string, docId): Firebase Auth UID.
- `displayName`, `bio?`, `department?`, `designation?`.
- `photoURL?` (string): avatar URL (the field is `photoURL`, not `avatarUrl`).
- `followersCount`, `followingCount` (number, denormalized).
- `schoolName?`, `district?`, `state?`, `subjects[]`, `gradeLevels[]`, `badges[]`, `impactScore`.
- `createdAt`, `lastLogin` (Timestamp).

### `posts` (Collection)
Main feed content (`src/app/actions/community.ts`). No exported interface; field shape assembled inline.
- `id` (string, docId).
- `authorId` (string): Ref to `users`.
- `content` (string): text content.
- likes/saves counters and `createdAt`.
- TODO(verify: full `posts` field shape); `resourceRef`, `mediaUrls`, `visibility` from the old draft are unconfirmed in code.

### `library_resources` (Collection)
Shared, downloadable resources. `authorId` → `users`. Engagement counters as `stats.{likes,saves,downloads}`. Per-user like state in `library_resources/{id}/likes/{uid}` subcollection.

### `connections` (Collection) — mutual connection graph
`Connection` (`src/types/index.ts:419`).
- `id` (string, docId): sorted `{uid1}_{uid2}` pair.
- `uids` ([string, string]): both participants (enables `array-contains`).
- `initiatedBy` (string): who sent the original request.
- `connectedAt` (string, ISO).

### `connection_requests` (Collection) — pending requests
`ConnectionRequest` (`src/types/index.ts:411`): `id ({fromUid}_{toUid}), fromUid, toUid, createdAt, expiresAt (30 days)`.

### `groups` (Collection) + subcollections
`Group` (`src/types/community.ts`) with `members`, `posts`, `chat` subcollections (`GroupMember`, `GroupPost`, `GroupChatMessage`).

### Likes
Per-resource likes are stored in a `likes` subcollection (`{ uid, createdAt }`) and aggregated into `stats.likes`. There is no top-level `interactions` subcollection as the old draft described; comments are not yet a separate live collection. TODO(verify: whether a comments collection exists in production).

---

## 2. Cloud SQL Schema (Relational & Governed)

Database: PostgreSQL, connected via the `DATABASE_URL` env/secret (`src/lib/db/sql.ts`). TODO(verify: the live database/instance name); it is not hardcoded in code, only the connection string env. Reads fail soft (return `[]`) when `DATABASE_URL` is unset.

### Table: `certifications`
Used for formal, non-volatile professional records. Mirrors the `Certification` interface in `src/lib/services/certification-service.ts` (columns: `id, user_id, cert_name, issuing_body, issue_date, expiry_date?, verification_url?, status`).
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique record ID. |
| `user_id` | UUID (FK) | Matches Firebase/Firestore UID. |
| `cert_name` | VARCHAR(255) | Name of the certificate (e.g., "CTET Qualified"). |
| `issuing_body` | VARCHAR(255) | Ministry of Education, etc. |
| `issue_date` | DATE | Date awarded. |
| `expiry_date` | DATE (Optional) | If applicable. |
| `verification_url`| TEXT | Link to official govt verification portal. |
| `status` | ENUM | 'verified', 'pending', 'rejected'. |

---

## 3. Storage Optimization & Consistency
- **Counters**: Firestore Increments will be used for `likesCount` and `commentsCount` to avoid read-heavy aggregation.
- **Denormalization**: `displayName` and `avatarUrl` may be denormalized into the `posts` document to reduce joins on the main feed (updated via Cloud Functions).
