# Review Panel - /review-panel

**File:** `src/app/review-panel/page.tsx`
**Auth:** Not gated at page level (static placeholder)
**Snapshot:** 2026-06-10

---

## Purpose

Intended content-moderation panel for reviewing teacher-submitted community content. (Admin-only per the copy.)

---

## Status

Confirmed placeholder / coming-soon page. Renders a single card with a `ShieldCheck` icon, title "Review Panel", and the message "This feature is coming soon. (Admin-only) Review community-submitted content. Stay tuned!" No queue, no API calls, no moderation actions.

---

## Component Tree (placeholder state)

```
ReviewPanelPage
├── Page header ("Review Panel")
└── Coming soon content or basic scaffolding
```

---

## Intended Functionality

When fully implemented:
- Queue of submitted resources pending review
- Approve → `isPublic = true`, added to `library_resources`
- Reject → notifies author, content stays private
- Flag → marks content for follow-up review

---

## Access Control Note

No role-based access control implemented. Admin pages rely on obscurity (not linked from public nav).
