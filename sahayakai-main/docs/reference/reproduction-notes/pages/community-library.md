# Community Library — /community-library

**File:** `src/app/community-library/page.tsx`
**Auth:** Not required (public browsing)

---

## Purpose

Browse community-shared educational resources. Currently uses mock data — full implementation pending.

---

## Current State

Uses **mock data** (hardcoded resource array in the page file). Not yet connected to live `library_resources` Firestore collection. Consider this a UI scaffold / work-in-progress.

---

## Component Tree

```
CommunityLibraryPage
├── Page header + description
├── Search input
├── LanguageSelector
├── Tabs: Trending | Following
└── Resource cards grid (mock data)
    └── Card × N
        ├── Type badge
        ├── Title
        ├── Author
        ├── Stats (likes, saves)
        └── Download/Open buttons
```

---

## Key Note for Reproduction

When implementing for real:
1. Replace mock data with `getLibraryResources()` action
2. "Following" tab: `getFollowingPosts(userId)` action
3. Connect like/save buttons to `likeResourceAction()` / `saveResourceToLibraryAction()`
4. The community page (`/community`) already has a working "Discover" tab that does this — use it as reference

---

## Design

Follows same card pattern as community page resource cards.
