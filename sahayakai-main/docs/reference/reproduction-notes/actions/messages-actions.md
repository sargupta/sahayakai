# Server Actions: Messages

**File:** `src/app/actions/messages.ts`

---

## getOrCreateDirectConversationAction(myUid, targetUid)

Creates or fetches a 1:1 DM conversation.

```
1. Auth check
2. conversationId = buildDirectConversationId(myUid, targetUid) = [uid1,uid2].sort().join('_')
3. Check if doc exists at conversations/{conversationId}
4. If exists: return existing conversation
5. If not: fetch both user profiles
6. Create conversations/{conversationId} with:
   { type:'direct', participantIds:[myUid, targetUid],
     participants: { [myUid]: {displayName,photoURL}, [targetUid]: {...} },
     unreadCount: { [myUid]: 0, [targetUid]: 0 },
     createdAt: serverTimestamp() }
7. Return conversation object
```

---

## createGroupConversationAction(creatorUid, memberUids, name, groupPhotoURL?)

Creates a group conversation (2–50 members).

```
1. Auth check
2. Validate: 2–50 members
3. Fetch all member profiles (batch of 10 max per Firestore in-query)
4. Create conversations/{uuid} with type:'group', all members in participantIds
5. Return conversation
```

---

## sendMessageAction({ conversationId, text, type, resource?, audioUrl?, audioDuration? })

Sends a message. Atomic transaction for unread count update.

```
1. Auth check (senderId = x-user-id)
2. Fetch sender profile (displayName, photoURL) — server-side, never trust client
3. Build message payload:
   - type: 'text' | 'resource' | 'audio'
   - text, senderId, senderName, senderPhotoURL
   - resource? (if type=resource)
   - audioUrl?, audioDuration? (if type=audio)
   - readBy: [senderId]  (sender already read their own message)
   - createdAt: serverTimestamp()
4. Atomic transaction:
   - Add message to conversations/{convId}/messages
   - Increment unreadCount[uid] for all OTHER participants
   - Update conversation: lastMessage, lastMessageAt
5. Fire-and-forget notifications for other participants
```

**Preview text for lastMessage:**
- text: truncated to 50 chars
- resource: "Shared a [type]"
- audio: "Voice message"

---

## markConversationReadAction(conversationId, userId)

Marks all messages as read for a user.

```
1. Reset conversations/{convId}.unreadCount[userId] = 0
2. Fetch last 50 messages in conversation
3. For each message where readBy doesn't include userId:
   - Update message: readBy = FieldValue.arrayUnion(userId)
```

---

## getTotalUnreadCountAction(userId)

Returns total unread count across all conversations.

```
1. Query conversations where participantIds array-contains userId
2. Sum unreadCount[userId] across all results
3. Return total
```

Used by AppSidebar for the Messages badge (but sidebar uses a real-time listener, not this action).
