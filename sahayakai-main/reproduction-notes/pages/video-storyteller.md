# Video Storyteller — /video-storyteller

**File:** `src/app/video-storyteller/page.tsx`
**Auth:** Not required (public browsing — RSS content is free, no user data exposed)
**Algorithm:** `docs/VIDEO_RECOMMENDATION_ALGORITHM.md`

---

## Purpose

Curated educational YouTube video discovery for Indian school teachers. Videos are organized into 5 pedagogical categories via ranked local scoring + RSS feeds. No second LLM call — ranking is fully deterministic.

---

## Component Tree

```
VideoStorytellerPage
├── Header (Video icon, title, Refresh button)
├── VideoFilterBar        ← subject / grade / language / search
├── AI Insight Banner     ← personalizedMessage from Gemini
├── VideoCarousel × 5    ← one per category
│   ├── Category header (icon + title + "View All")
│   └── Horizontal scroll of VideoCards
│       └── VideoCard
│           ├── YouTube thumbnail (mqdefault, 320×180)
│           ├── Channel name
│           ├── Title
│           └── Watch button (opens youtube.com in new tab)
└── Expanded Category View (when "View All" clicked)
    ├── Back button
    └── 4-col grid of VideoCards
```

---

## State (in page)

| State | Type | Purpose |
|---|---|---|
| `loading` | `boolean` | Fetch in flight |
| `recommendations` | `VideoRecommendations \| null` | Current result |
| `expandedCategory` | `{ key, title, icon } \| null` | Expanded view |
| `filters` | `{ subject?, gradeLevel?, language?, searchQuery? }` | Active filters |

---

## Data Flow

1. `useEffect` on `user` → loads profile → sets filters from profile → calls `fetchRecommendations()`
2. `fetchRecommendations()` → `POST /api/ai/video-storyteller` with `{ subject, gradeLevel, language, topic, state?, educationBoard? }`
3. API route → `getVideoRecommendations()` in `src/ai/flows/video-storyteller.ts`
4. Flow executes 5-tier pipeline (see `docs/VIDEO_RECOMMENDATION_ALGORITHM.md`)
5. Returns `{ categories, personalizedMessage, categorizedVideos, fromCache, latencyScore }`
6. Page calls `mergeCuratedVideos(categorizedVideos)` — fills empty categories from static fallback
7. Renders 5 `VideoCarousel` components

**Error handling:** On any API failure, falls back to curated-only content and shows toast "Showing curated content".

---

## API Route

`POST /api/ai/video-storyteller`

**Request body:**
```json
{
  "subject": "Mathematics",
  "gradeLevel": "Class 7",
  "language": "Marathi",
  "topic": "fractions",
  "state": "Maharashtra",
  "educationBoard": "Maharashtra State Board (MSBSHSE)"
}
```

All fields optional. Auth is optional — `x-user-id` header injected by middleware if logged in, used for profile enrichment only.

**Response:**
```json
{
  "categories": { "pedagogy": ["query1", ...], ... },
  "personalizedMessage": "...",
  "categorizedVideos": {
    "topRecommended": [{ "id", "title", "thumbnail", "channelTitle", "publishedAt" }, ...],
    "pedagogy": [...],
    "storytelling": [...],
    "govtUpdates": [...],
    "courses": [...]
  },
  "fromCache": false,
  "latencyScore": 1842
}
```

---

## Categories

| Key | Title | Icon |
|---|---|---|
| `topRecommended` | Top Recommended for You | Star |
| `storytelling` | Storytelling for Your Subjects | BookOpen |
| `pedagogy` | Pedagogy & Teaching Methods | GraduationCap |
| `govtUpdates` | Government Updates | Bell |
| `courses` | Teacher Training Courses | School |

---

## Channel Source Files

- **`src/lib/youtube-channels.ts`** — Channel ID registry, `INDIAN_EDU_CHANNELS`, `LANGUAGE_CHANNEL_MAP`, `STATE_EDUCATION_CONFIG`, `SUBJECT_CHANNEL_MAP`
- **`src/lib/youtube-rss.ts`** — RSS feed fetcher (`fetchMultipleChannelsRSS`)
- **`src/lib/curated-videos.ts`** — Static fallback video library (verified IDs)
- **`src/lib/youtube-video-cache.ts`** — Firestore semantic cache

---

## Design

- Horizontal carousel per category with snap scrolling
- "View All" expands to 4-col grid (sm:2, md:3, lg:4)
- Thumbnails: `mqdefault` (320×180), guaranteed for all valid YouTube IDs
- AI insight banner: `bg-orange-50 border-orange-100` with Sparkles icon
- Loading state: animated spinner + sparkle overlay
- Empty state: shown only when logged in and no recommendations loaded
