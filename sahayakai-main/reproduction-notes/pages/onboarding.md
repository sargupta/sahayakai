# Onboarding Page — /onboarding

**File:** `src/app/onboarding/page.tsx`
**Auth:** Required (redirects to home if not signed in)

---

## Purpose

First-time setup wizard for new teachers. Collects profile info needed to personalize AI tool outputs (school, district, subjects, preferred language). 4-step flow.

---

## Component Tree

```
OnboardingPage
├── Step indicator (1/4, 2/4, 3/4, 4/4)
├── Step 1: Welcome + basic info
│   ├── Display name (pre-filled from Firebase auth)
│   └── School name input
├── Step 2: Location
│   ├── District input
│   └── Pincode input
├── Step 3: Teaching subjects + grade
│   ├── SubjectSelector (multi-select)
│   └── GradeLevelSelector (multi-select)
├── Step 4: Language preference
│   └── LanguageSelector
└── Finish button → calls updateProfileAction → redirect to /
```

---

## State

| State | Type | Purpose |
|---|---|---|
| `step` | `1 \| 2 \| 3 \| 4` | Current wizard step |
| `formData` | `object` | Accumulated profile fields |
| `loading` | `boolean` | Submit in-progress |

---

## Data Flow

1. Mount: check if user already has a complete profile → skip onboarding, redirect to `/`
2. Each step: validates its fields before allowing Next
3. Step 4 "Finish": calls `updateProfileAction(uid, formData)` → updates `users/{uid}` in Firestore
4. On success: redirect to `/`

---

## Key Interactions

- **Next button** — validates current step fields, advances step counter
- **Back button** — decrements step (no data loss)
- **Finish** — submits all collected data, shows loading state

---

## Design

- Centered card layout, max-w-md
- Progress indicator: dots or numbered steps at top
- Large, touch-friendly inputs
- Saffron primary for active step indicator and CTA button
- Minimal distractions — no sidebar visible during onboarding

---

## Business Logic

- Runs once per teacher on first login
- Profile completion gates some community features
- `preferredLanguage` set here flows into all AI tool defaults
