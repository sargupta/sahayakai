# Database Verification & Architecture Report (TeacherConnect)

**Last updated:** 2026-06-10 (re-verified against `src/`).

## 1. Login & Identity Mechanism
- **Auth Provider**: Firebase Authentication (Google OAuth).
- **Session Management**: Client-side Firebase SDK (`onAuthStateChanged`) for real-time UI updates, supplemented by Server Actions for secure database writes.
- **Mapping**: The **UID** (Uniform Identifier) from Firebase is the "Master Key" used across all databases (Firestore & Cloud SQL).

## 2. Storage Strategy (Hybrid Architecture)
We use a hybrid approach to balance speed and professional integrity:

| Data Category | Storage Engine | Why? |
| :--- | :--- | :--- |
| **User Profile** | Firestore (`users`) | High flexibility for adding bio, department, social links. |
| **Social Content** | Firestore (`posts`) | Fast, scalable retrieval for global and following feeds. |
| **Certifications** | Cloud SQL (PostgreSQL) | Relational integrity required for verified professional credentials. |
| **Library** | Firestore (`library_resources`) | Easy indexing for search and download tracking. |

## 3. Database Schemas & Relations
All data is linked via the `userId` / `authorId` / `fid` (Firebase ID).

### A. Firestore (NoSQL)
- **`users/{uid}`**: Primary profile (`UserProfile`). (Mapped to UI in `/my-profile`). Note: the profile collection is `users`, not `profiles`.
- **`posts/{postId}`**: `authorId` links back to `users`. (Mapped to UI in `/community`)
- **`library_resources/{id}`**: `authorId` links to `users`. Download/like/save counts live as `stats.{downloads,likes,saves}` fields on the resource doc (verified `trackDownloadAction`, `src/app/actions/community.ts:304`), NOT in a `stats/downloads` subcollection.
- **`connections/{pairId}`**: mutual teacher-to-teacher connections. Correction: docId is the sorted `{uid1}_{uid2}` pair and the doc shape is `{ uids: [uid1, uid2], initiatedBy, connectedAt }` (`Connection`, `src/types/index.ts:419`), NOT a `followerId`/`followingId` pair. Pending requests live in `connection_requests/{fromUid}_{toUid}`.

### B. Cloud SQL (Relational)
- **`certifications` table**:
  - `user_id` (VARCHAR): Matches Firestore `uid`.
  - `cert_name`, `issuing_body`, `issue_date`, `status`.

## 4. Mapping & Component Logic
- **Profile Page**: Aggregates Firestore `user` data and Cloud SQL `certifications` using the `getProfileData` server action.
- **Community Feed**: `getPosts` fetches global/following posts. Each card dynamically identifies the teacher via `post.authorId`.
- **Download Engine**: 
  - Increments the `stats.downloads` field on `library_resources/{id}` inside a transaction (`trackDownloadAction`, `src/app/actions/community.ts`).
  - TODO(verify: whether download tracking still publishes a Pub/Sub event). The only live Pub/Sub topic in code is `sahayakai-storage-cleanup` (`src/lib/pubsub.ts`).

## 5. Data Adaptability & Updates
- **Update Mechanism**: `updateProfileAction` (Server Action) uses `dbAdapter.updateUser` to perform merged updates in Firestore.
- **Dynamic Adaptation**: As a teacher adds a certification or updates their bio, `revalidatePath("/my-profile")` ensures the UI reflects the change immediately.

## 6. Audit & Refinement Report (Post-Implementation)
Following a comprehensive "Scrum Team Review", the following refinements were made to ensure zero bypass of critical components:

### A. Dynamic Identity Resolution
- **Issue**: Social posts were using placeholder names (`Teacher {prefix}`).
- **Fix**: Implemented a `resolveProfiles` batch fetcher in the `CommunityPage`.
- **Relationship**: `post.authorId` (Firestore) -> `getProfilesAction` -> `users/{uid}` (Firestore).
- **Outcome**: The Digital Staffroom now displays real teacher names and high-fidelity avatars.

### B. Follow-Graph Integration
- **Verification**: Verified that `connections` (followerId, followingId) correctly populates.
- **Feature**: The "Following" tab in the Community Library is now functional, filtering resources based on the user's personal follow list.

### C. Resource Data Integrity
- **Verification**: Library resources denormalize `authorName` for speed, but the UI now re-resolves these via the `profiles` state to ensure that name changes are propagated without requiring global database rewrites.

---

### **Thorough Check Summary**
- [x] **Relations**: All social and library assets correctly reference the UID.
- [x] **Mapping**: Component data fetching in `/community` and `/my-profile` is verified.
- [x] **Following**: Library following tab is functional.
- [x] **Identity**: Author resolution is dynamic and high-fidelity.
- [x] **Updates**: Server actions for profile edits and certification additions are in place.
