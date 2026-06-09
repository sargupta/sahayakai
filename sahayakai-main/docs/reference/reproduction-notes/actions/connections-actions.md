# Server Actions: Connections

**File:** `src/app/actions/connections.ts`

---

## Connection Schema

```
pairId = [uid1, uid2].sort().join('_')    // deterministic, order-independent

connection_requests/{pairId}: { fromUid, toUid, createdAt, expiresAt (+30 days) }
connections/{pairId}: { uids: [uid1, uid2], initiatedBy, connectedAt }
```

---

## sendConnectionRequestAction(fromUid, toUid)

```
1. Auth check (fromUid must match x-user-id)
2. Validate: fromUid !== toUid (no self-connect)
3. pairId = [fromUid, toUid].sort().join('_')
4. Check if connection_requests/{pairId} already exists → return early (idempotent)
5. Check if connections/{pairId} already exists → return early (already connected)
6. Create connection_requests/{pairId}: { fromUid, toUid, createdAt, expiresAt }
7. createNotification(CONNECT_REQUEST, toUid, { requestId: pairId, senderId: fromUid })
```

---

## acceptConnectionRequestAction(requestId)

Only the recipient (`toUid`) can accept.

```
1. Auth check (accepter must be toUid)
2. Load connection_requests/{requestId}
3. Validate: x-user-id === request.toUid
4. Atomic batch:
   a. Delete connection_requests/{requestId}
   b. Create connections/{pairId} via Admin SDK (bypasses Firestore rules)
      { uids: [fromUid, toUid], initiatedBy: fromUid, connectedAt: serverTimestamp() }
5. createNotification(CONNECT_ACCEPTED, fromUid, { metadata: { pairId } })
```

**Critical:** Step 4b uses Admin SDK because Firestore rules block `connections` create from client SDK. This is intentional — connection creation must be server-controlled.

---

## declineConnectionRequestAction(requestId, userId)

Either party can decline (sender withdraws, recipient declines).

```
1. Auth check
2. Load request to verify user is fromUid or toUid
3. Delete connection_requests/{requestId}
(Idempotent — if already deleted, no error)
```

---

## disconnectAction(userId, targetUid)

Either participant can disconnect.

```
1. Auth check
2. pairId = [userId, targetUid].sort().join('_')
3. Delete connections/{pairId} (client SDK allowed per Firestore rules)
(Idempotent)
```

---

## getMyConnectionDataAction(userId)

Returns all connection state for the current user in one call.

```
Parallel queries:
  - connections where uids array-contains userId → connectedUids
  - connection_requests where fromUid == userId → sentRequestUids
  - connection_requests where toUid == userId → receivedRequests (with fromUid)

Returns: {
  connectedUids: string[],
  sentRequestUids: string[],
  receivedRequests: { fromUid, requestId }[]
}
```

Used by TeacherDirectory and ProfileView to determine which button to show per teacher.
