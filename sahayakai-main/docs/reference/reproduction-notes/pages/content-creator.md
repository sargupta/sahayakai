# Content Creator — /content-creator

**File:** `src/app/content-creator/page.tsx`
**Auth:** Required

---

## Purpose

Hub page that organizes visual content creation tools. Currently links to Visual Aid Designer and Virtual Field Trip. Video Storyteller is listed as "coming soon" here (even though it exists as a separate page).

---

## Component Tree

```
ContentCreatorPage
├── Page header ("Content Creator")
├── Description text
└── Tool cards grid
    ├── Visual Aid Designer card → /visual-aid-designer
    ├── Virtual Field Trip card → /virtual-field-trip
    └── Video Storyteller card (coming soon — disabled)
```

---

## Note

This page is a navigation hub, not a tool itself. It contains no AI calls or state. The individual tools it links to (`/visual-aid-designer`, `/virtual-field-trip`) each have their own full page with forms and AI generation.

---

## Design

- 3-col card grid
- Each card: large icon, title, description, "Open" button or "Coming Soon" badge
- Coming soon card: grayed out, no click action
