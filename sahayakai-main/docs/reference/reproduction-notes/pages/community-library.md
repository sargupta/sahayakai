# Community Library - /community-library

**File:** `src/app/community-library/page.tsx`
**Auth:** Not required (static page)
**Snapshot:** 2026-06-10

---

## Purpose

Intended browser for community-shared educational resources.

---

## Current State

**Non-functional static mockup.** The page renders a hardcoded `mockResources` array (5 fake entries: Ravi Kumar, Priya Singh, etc.) with fixed like counts. The search input, LanguageSelector, and Download buttons have no handlers wired up. The "Following" tab shows a static "Content from teachers you follow will appear here" placeholder. It is NOT connected to the `library_resources` Firestore collection. The live working equivalent is the `/community` Discover tab.

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
4. The community page (`/community`) already has a working "Discover" tab that does this - use it as reference

---

## Design

Follows same card pattern as community page resource cards.
