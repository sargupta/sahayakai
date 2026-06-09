# My Library - /my-library

**File:** `src/app/my-library/page.tsx`
**Auth:** Required (signed-out users get `<AuthGate>`: "Sign in to open your library")
**Snapshot:** 2026-06-10

---

## Purpose

Personal content vault. Browse, search, filter, open, download, and delete all AI-generated content the teacher has saved. Also shows profile summary card with stats.

---

## Component Tree

```
MyLibraryPage
├── Page header (title)
├── ProfileCard (avatar, name, stats)
├── LanguageSelector (filters content by language)
├── ContentGallery
│   ├── Search input
│   ├── View toggle (Grid | List)
│   ├── Type filter tabs (All, Lesson Plans, Quizzes, etc.)
│   ├── Loading skeleton
│   ├── Empty state (if no content)
│   └── LibraryCard × N
│       ├── FileTypeIcon + type badge
│       ├── Title
│       ├── Grade + Subject badges
│       ├── Date
│       ├── Language badge
│       ├── Open button
│       ├── Download button
│       └── Delete button (with confirm state)
└── "Create New" button → router.push('/lesson-plan')
```

Avatar precedence is real photos only (NO AI generation, removed 2026-04-26): `profile.photoURL` (Settings upload) → `user.photoURL` (Google) → initials fallback.

---

## State

| State | Type | Purpose |
|---|---|---|
| `language` | `Language` | Language filter |
| `content` | `ContentItem[]` | All user's content |
| `loading` | `boolean` | Initial fetch |

---

## Data Flow

1. Mount: `getProfileData(user.uid)` loads the profile; `ContentGallery` loads saved content from `users/{uid}/content` and reports its count via `onCountChange`.
2. Avatar: real photo only (see precedence above); no AI avatar call.
3. Open: navigates to tool page with content pre-loaded (URL param or IndexedDB key)
4. Download: attempts client-side HTML export first, falls back to server download link
5. Delete: `softDeleteContent(userId, contentId)` → sets `deletedAt` + `expiresAt` (30d TTL)

---

## ContentGallery Features

- **Grid vs List toggle:** `LayoutGrid` vs `List` Lucide icons
- **Type filter:** tab-based, client-side
- **Search:** scores results with `searchContentAction()` (title +10, topic +5, grade/subject/language bonus)
- **Pagination:** `hasMore` flag triggers "Load more" button

---

## Download Behavior

Priority order:
1. Client-side export: renders content as HTML, triggers browser download
2. Server download link: `POST /api/content/download` returns presigned GCS URL

---

## Delete Behavior

- Soft delete (not hard delete): sets `deletedAt` + `expiresAt` (30 days)
- Storage file queued for cleanup via `storage-cleanup` job
- Optimistic UI: item removed from list immediately
- Confirm step: first click changes button to "Sure?" to prevent accidental deletion

---

## ProfileCard

Shows: avatar (real photo or initials), display name, and stats (followers, following, resources count from the gallery).

---

## Design

- Two-column layout: ProfileCard (left, sticky) + ContentGallery (right)
- Library cards: white, rounded-xl, shadow-sm
- Delete button: initially `Trash2` icon, on first click becomes red "Sure?" text
- Grid: 2-col on mobile, 3-col on desktop
