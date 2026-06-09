# Review Panel — /review-panel

**File:** `src/app/review-panel/page.tsx`
**Auth:** Required (admin/moderator intent)

---

## Purpose

Content moderation panel for reviewing teacher-submitted community content before or after publication. Approve, reject, or flag resources.

---

## Status

Placeholder/coming soon page based on codebase state. The route exists and is linked from the admin sidebar section, but full moderator UI may not be implemented.

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
