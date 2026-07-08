# Content Creator - /content-creator

**File:** `src/app/content-creator/page.tsx`
**Auth:** Not gated at the page level (static hub; no API calls)
**Snapshot:** 2026-06-10

---

## Purpose

"Content Creator Studio" hub page that organizes multimedia content tools. All three tool cards are now active links.

---

## Component Tree

```
ContentCreatorPage
├── Page header ("Content Creator Studio") + description
└── Tool cards grid (3 cards, all active=true)
    ├── Visual Aid Designer card → /visual-aid-designer
    ├── Virtual Field Trip card → /virtual-field-trip
    └── Video Storyteller card → /video-storyteller
```

---

## Note

This page is a navigation hub, not a tool itself. It contains no AI calls or state (just a `tools` array rendered as `<Link>` cards). The tools it links to each have their own full page with forms and AI generation.

---

## Design

- 3-col card grid (`md:grid-cols-2 lg:grid-cols-3`)
- Each card: Lucide icon (Images / Globe2 / Video), title, description, action label + ArrowRight
- `card-accent-bar` top accent; hover elevation
