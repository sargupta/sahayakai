# Server Actions: Auth & Profile

---

## Auth Actions

**File:** `src/app/actions/auth.ts`

### syncUserAction(firebaseUser)

Called by AuthProvider on every sign-in. Upserts user profile.

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

### getProfileData(userId)

Parallel fetch:
```
[profile, certifications] = await Promise.all([
  getUser(userId),
  db.collection('users').doc(userId).collection('certifications').get()
])
Returns: { profile: UserProfile | null, certifications: Certification[] }
```

### updateProfileAction(userId, data)

Updates mutable profile fields:
```
Allowed fields: displayName, designation, department, schoolName, bio, preferredLanguage
Merges into users/{uid}
revalidatePath('/my-profile')
```

### addCertificationAction(formData: FormData)

```
Fields: userId, certName, issuingBody, issueDate
Creates users/{uid}/certifications/{uuid}:
  { name, issuingBody, issueDate, status: 'pending', createdAt }
```

### getDailyCostsAction(days?)

Admin-only. Fetches daily cost data for last N days.
```
Calls cost-service.ts getDailyCosts(days)
Returns daily breakdown per service
```

---

## Notifications Actions

**File:** `src/app/actions/notifications.ts`

### createNotification(type, recipientId, data)

```
Creates notifications/{uuid}:
  { type, recipientId, senderId?, senderName?, title, message, isRead: false, metadata?, createdAt }
```

Called internally by other actions (connections, community, messages).

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
