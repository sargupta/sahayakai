# My Profile — /my-profile

**File:** `src/app/my-profile/page.tsx`
**Auth:** Required

---

## Purpose

The signed-in teacher's own public profile page. Shows profile info, badges, certifications, activity history, and allows editing.

---

## Component Tree

```
MyProfilePage (Suspense wrapper with loading skeleton)
└── ProfileView (isOwnProfile=true)
    ├── Profile header
    │   ├── Cover/gradient header
    │   ├── Avatar (AI-generated or uploaded)
    │   ├── Display name + verified badge
    │   ├── Designation + department
    │   ├── School name + district
    │   └── Bio text
    ├── Stats row (followers, following, resources shared, impact score)
    ├── Edit Profile button → EditProfileDialog
    ├── Badges section (earned badges grid)
    ├── Certifications section
    │   ├── Certification cards (name, issuing body, date, pending/verified status)
    │   └── Add Certification button → form
    ├── Recent activity timeline
    └── "Help others grow" promo card (share to community CTA)
```

---

## Data Flow

1. Mount: `getProfileData(userId)` → loads `{ profile, certifications }`
2. Certifications: stored in `users/{uid}/certifications` subcollection
3. Edit profile: `EditProfileDialog` → `updateProfileAction()` → `revalidatePath('/my-profile')`
4. Add certification: `addCertificationAction()` → FormData → sets `status: 'pending'`

---

## ProfileView Props (when used here)

```
targetUid: string        // current user's UID
isOwnProfile: true       // shows edit button, not connection buttons
```

---

## Design

- Header: gradient background (saffron → amber)
- Avatar: large (h-24 w-24), ring-4 ring-white, shadow-lg
- Verified badge: blue `BadgeCheck` Lucide icon next to name
- Stats row: evenly spaced, centered, with icon per stat
- Badges: small pill chips with earned date
- Certifications: cards with status badge (pending=yellow, verified=green)
- Activity: timeline with event type icons and timestamps
- "Help others grow" card: orange gradient, CTA to publish content

---

## Empty States

- No bio: "Add a bio to tell other teachers about yourself" prompt
- No certifications: "Add your certifications" with `+` button
- No activity: "Start using AI tools to build your activity history"
