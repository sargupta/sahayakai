# TeacherConnect Data Schema Design

This document defines the data structures for the TeacherConnect social network, using a hybrid approach between **Google Cloud Firestore (NoSQL)** for social interactions and **Cloud SQL (Relational)** for governed records.

---

## 1. Firestore Collections (Real-time & Social)

### `profiles` (Collection)
Stores user-centric professional information.
- `id` (string, docId): User UUID from Firebase Auth.
- `displayName` (string): Full name of the teacher.
- `bio` (string): Short professional summary.
- `department` (string): e.g., "Science", "Primary Education".
- `avatarUrl` (string): URL to Cloud Storage asset.
- `followersCount` (number): Aggregated for performance.
- `followingCount` (number): Aggregated for performance.
- `createdAt` (timestamp).
- `updatedAt` (timestamp).

### `posts` (Collection)
Main feed content.
- `id` (string, docId).
- `authorId` (string): Ref to `profiles`.
- `content` (string): Text content or description.
- `resourceRef` (string, optional): ID of a Lesson Plan, Quiz, or Visual Aid from the library.
- `mediaUrls` (array of strings): Links to images or PDFs in Storage.
- `likesCount` (number).
- `commentsCount` (number).
- `visibility` (string): "public" | "department" | "private".
- `createdAt` (timestamp).

### `connections` (Collection)
Stores the follow graph.
- `id` (string, docId): `followerId_followingId`.
- `followerId` (string).
- `followingId` (string).
- `createdAt` (timestamp).

### `interactions` (Sub-collection under `posts/{post_id}`)
- `likes` (collection): Docs with user ID to prevent double-likes.
- `comments` (collection): 
  - `id` (string).
  - `authorId` (string).
  - `text` (string).
  - `createdAt` (timestamp).

---

## 2. Cloud SQL Schema (Relational & Governed)

Database: `sahayakai_records` (PostgreSQL)

### Table: `certifications`
Used for formal, non-volatile professional records.
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
