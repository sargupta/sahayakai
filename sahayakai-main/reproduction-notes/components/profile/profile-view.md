# ProfileView Component

**File:** `src/components/profile/profile-view.tsx`

---

## Purpose

Full profile display for both own profile (`/my-profile`) and others (`/profile/[uid]`). Conditionally shows Edit button (own) or connection action buttons (others).

---

## Props

```ts
{
  targetUid: string;
  isOwnProfile: boolean;
}
```

---

## State

| State | Type | Purpose |
|---|---|---|
| `profile` | `UserProfile \| null` | Loaded profile data |
| `certifications` | `Certification[]` | Certifications list |
| `connectionData` | `ConnectionData \| null` | Own connection state with targetUid |
| `loading` | `boolean` | Data fetch |
| `actionState` | `string` | Connection action in flight |

---

## Data Flow

1. Mount: `getProfileData(targetUid)` → `{ profile, certifications }`
2. If `!isOwnProfile`: `getMyConnectionDataAction()` → load connection state
3. Profile displayed from fetched data

---

## Sections

### Header
- Gradient background (saffron → amber gradient band)
- Avatar: `h-24 w-24`, `ring-4 ring-white shadow-lg`
- Display name + `BadgeCheck` icon if `verifiedStatus === true`
- Designation + department (if set)
- School + district (if set)
- Bio text (if set)

### Stats Row
- Followers count + `Users` icon
- Following count + `UserCheck` icon
- Resources shared + `Library` icon
- Impact score + `BarChart` icon

### Action Buttons
- `isOwnProfile=true`: "Edit Profile" → `EditProfileDialog`
- `isOwnProfile=false`: Connection state buttons (see below)

### Badges
- `profile.badges[]` rendered as pill chips
- Earned date shown on hover

### Certifications
- Each: name, issuing body, issue date, status badge (pending=yellow, verified=green)
- Own profile: "Add Certification" form

### Activity Timeline
- Recent tool usage events
- Each: icon by content type, action description, relative date

### Help Others Grow Card (own profile only)
- Orange gradient card
- CTA: "Share your work with the community"

---

## Connection Button Logic (isOwnProfile=false)

```
connectionData.connectedUids.includes(targetUid)
  → "Connected" (ghost) + "Message" (outline) + "Disconnect" (dropdown option)

connectionData.sentRequestUids.includes(targetUid)
  → "Pending" (disabled outline) — click to withdraw

connectionData.receivedRequests.find(r => r.fromUid === targetUid)
  → "Accept" (orange-500) + "Decline" (ghost) buttons

else:
  → "Connect" (orange-500)
```

---

## EditProfileDialog

`src/components/edit-profile-dialog.tsx`

Form fields: displayName, designation, department, schoolName, bio.
Submit → `updateProfileAction()` → toast + close.
