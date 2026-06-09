# Server Actions: Auth & Profile

**Verified:** 2026-06-10

Identity comes from the middleware-injected `x-user-id` header. Where these actions accept a `_uid` / `_userId` argument it is ignored (the header is authoritative).

---

## Auth Actions

**File:** `src/app/actions/auth.ts`

### syncUserAction(user)

Called by AuthProvider on every sign-in. `user` = `{ uid, email, displayName, photoURL }`. Upserts the user profile.

```
1. Auth check
2. Merge into users/{uid}:
   { uid, email, displayName, photoURL, lastLogin: serverTimestamp() }
3. If new user: also set createdAt
4. Does NOT overwrite existing schoolName, subjects, etc.
```

### getUserProfileAction(uid)

Fetches a user profile by UID. Returns `UserProfile | null`.

---

## Profile Actions

**File:** `src/app/actions/profile.ts`

### getProfileData(_userId?)

Parallel fetch of the caller's own profile + certifications (serialized for the client). Returns `{ profile, certifications }`. Throws Forbidden for cross-user reads.

### getPublicProfileAction(targetUid)

Public-safe view of another teacher's profile. Mirrors `getProfileData`'s shape so `ProfileView` can render either. Also resolves the connection state between caller and `targetUid` (reads `connections/{pairId}`).

### updateProfileAction(_userId, data)

Merges mutable profile fields into `users/{uid}` and `revalidatePath('/my-profile')`.

### addCertificationAction(formData: FormData)

Creates a certification under `users/{uid}/certifications/{id}` (status `pending`).

### markChecklistItemAction(_userId, itemId)

Marks an onboarding/profile checklist item complete for the caller.

### lookupSchoolDominantLocationAction(...)

Resolves the dominant district/state/pincode for a school name (used to pre-fill profile geography).

### getDailyCostsAction(days = 7)

Admin-only. Calls `costService.getDailyCosts(days)` (`src/lib/services/cost-service.ts`) and returns the daily per-service cost breakdown for the admin cost dashboard.

---

## Notifications Actions

**File:** `src/app/actions/notifications.ts`

### createNotification(notification)

```
notification = Omit<Notification, 'id' | 'isRead' | 'createdAt'>
Creates notifications/{id}: { ...notification, isRead: false, createdAt }
```

Called internally by other actions (connections, community, messages).

### createTypedNotification(args)

Template-driven variant. `args` carries a `TemplateKey` and template params; builds the title/message from a notification template and writes the doc.

### getNotificationsAction(userId)

```
Fetches notifications where recipientId == userId, limit 50
In-memory sort by createdAt desc (avoids Firestore composite index requirement)
Returns Notification[]
```

### markNotificationAsReadAction(notificationId)

Sets `isRead: true`. `revalidatePath('/notifications')`.

### markAllAsReadAction(userId)

```
Batch update: all unread notifications for userId → isRead: true
```
