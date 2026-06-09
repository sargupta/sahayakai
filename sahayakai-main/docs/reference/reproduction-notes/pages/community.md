# Community — /community

**File:** `src/app/community/page.tsx`
**Auth:** Partial (browsing public, interaction requires auth)

---

## Purpose

Social hub for teachers. Discover trending educational resources shared by other teachers, connect with educators across India, and participate in live community chat.

---

## Component Tree

```
CommunityPage
├── Page header
│   ├── Title + description
│   └── CreatePostDialog (desktop — triggers via Button)
├── Tabs (Discover | Connect | Chat)
│   ├── TabsTrigger: Discover (Flame icon)
│   ├── TabsTrigger: Connect (Users icon)
│   └── TabsTrigger: Chat (MessageCircle icon)
│
├── TabsContent: "discover"
│   ├── Search bar + MicSearch button (SpeechRecognition API)
│   ├── Language filter chips (All + 11 languages)
│   ├── Type filter chips (All, Lesson Plan, Quiz, Worksheet, Visual Aid, Rubric, Field Trip)
│   │   └── Each chip: FileTypeIcon + label
│   ├── TeacherStrip (horizontal scroll of suggested educators)
│   └── ResourceList
│       └── ResourceCard × N
│           ├── FileTypeIcon + type badge
│           ├── Author avatar + name
│           ├── Title + metadata (grade, subject, language)
│           ├── Stats (likes, saves, downloads)
│           ├── Like button (toggle, optimistic)
│           ├── Save button (toggle, optimistic)
│           └── Use in [Tool] button
│
├── TabsContent: "connect"
│   └── TeacherDirectory component
│
└── TabsContent: "chat"
    └── CommunityChat component

Mobile FAB (sm:hidden, fixed bottom-6 right-6)
└── CreatePostDialog (trigger: circular + button)
```

---

## State

| State | Type | Initial | Purpose |
|---|---|---|---|
| `languageFilter` | `string` | `'all'` | Filter resources by language |
| `typeFilter` | `string` | `'all'` | Filter resources by content type |
| `searchInput` | `string` | `''` | Controlled search input (debounced) |
| `searchTerm` | `string` | `''` | Applied search term (after debounce) |
| `resources` | `Resource[]` | `[]` | All loaded resources |
| `filteredResources` | `Resource[]` | `[]` | After client-side filter applied |
| `loading` | `boolean` | `true` | Initial data fetch |
| `likedIds` | `Set<string>` | `new Set()` | Resources liked by current user |
| `savedIds` | `Set<string>` | `new Set()` | Resources saved by current user |
| `, setActiveTab` | — | `'discover'` | Tab tracking (setter only, read unused) |

---

## Data Flow

1. Mount: `getLibraryResources()` action → loads up to 100 resources
2. Mount (if signed in): load `likedIds`, `savedIds` for current user
3. Filter change: client-side filter applied to `resources` → `filteredResources`
4. Search: client-side text match on `title + topic + subject`
5. Voice search: `SpeechRecognition` API → fills `searchInput` → triggers filter

---

## Type Filter Chips Config

```
{ value: 'all', label: 'All', icon: LayoutGrid }
{ value: 'lesson-plan', label: 'Lesson Plans', icon: BookOpen }
{ value: 'quiz', label: 'Quizzes', icon: ClipboardCheck }
{ value: 'worksheet', label: 'Worksheets', icon: FileSignature }
{ value: 'visual-aid', label: 'Visual Aids', icon: Images }
{ value: 'rubric', label: 'Rubrics', icon: Table }
{ value: 'virtual-field-trip', label: 'Field Trips', icon: Globe2 }
```

---

## Voice Search

Uses `window.SpeechRecognition || window.webkitSpeechRecognition` (Web Speech API).
- Language: derived from `languageFilter` state or `navigator.language`
- Mic button: shows `Mic` (idle) / `MicOff` (recording) / `Loader2` (processing)
- Not available on Firefox — no fallback indicator shown

---

## TeacherStrip (inline component)

Horizontal scrollable strip of 5 recommended educators in Discover tab.
- Loads from `getRecommendedTeachersAction(userId)`
- Each item: Avatar, Name, Subject badge, Follow button
- Follows with optimistic update + rollback

---

## ResourceCard Interactions

| Action | Result |
|---|---|
| Like | `likeResourceAction()` — toggle, optimistic |
| Save | `saveResourceToLibraryAction()` — adds to user library |
| "Use in Lesson Plan" | Navigate to `/lesson-plan` with resource params |
| "Open" | Navigate to appropriate tool page |

---

## Mobile FAB

- `sm:hidden` — only shows on mobile screens
- Fixed position: `fixed bottom-6 right-6 z-50`
- `+` icon (`Plus` Lucide) circular orange button
- Opens `CreatePostDialog` via its `trigger` prop

---

## CreatePostDialog

- Form: content textarea (min 5 chars), optional image upload
- On submit: `createPostAction()` → published to community
- Success: toast + dialog close
- Accepts optional `trigger` prop for custom trigger element

---

## Design

- Tabs: pill-style with active state white bg + shadow
- Filter chips: horizontally scrollable row, no wrap, active chip is orange-100 with orange border
- Resource cards: white, rounded-2xl, shadow-sm, 1-col on mobile
- TeacherStrip: `overflow-x-auto`, `flex gap-3`, snap scroll
