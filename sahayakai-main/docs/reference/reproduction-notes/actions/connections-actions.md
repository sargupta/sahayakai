# Server Actions: Connections

**File:** `src/app/actions/connections.ts`
**Verified:** 2026-06-10

All actions resolve the caller's uid from the middleware-injected `x-user-id` header; they take only the OTHER party's id / a requestId as argument. The whole module uses the Admin SDK (`getDb` from `firebase-admin`) for every read and write.

---

## Connection Schema

```
pairId = [uid1, uid2].sort().join('_')    // buildConnectionId - order-independent

connection_requests/{pairId}: { fromUid, toUid, createdAt, expiresAt (+30 days, ISO string) }
connections/{pairId}: { uids: [uid1, uid2], initiatedBy, connectedAt }
```

---

## sendConnectionRequestAction(toUid)

Returns `{ status: 'sent' | 'already_connected' | 'already_pending' }`. The sender is the authenticated `x-user-id`.

```
1. fromUid = x-user-id; validate fromUid !== toUid (no self-connect)
2. pairId = buildConnectionId(fromUid, toUid)
3. Parallel-read connections/{pairId} and connection_requests/{pairId}
   - connection exists → 'already_connected'
   - request exists     → 'already_pending'
4. Create connection_requests/{pairId}: { fromUid, toUid, createdAt, expiresAt (+30d ISO) }
5. createNotification(CONNECT_REQUEST, toUid, { requestId: pairId })
```

---

## acceptConnectionRequestAction(requestId)

Only the recipient (`toUid`) can accept. Returns `void`.

```
1. accepter = x-user-id
2. Load connection_requests/{requestId}; validate accepter === request.toUid
3. Admin-SDK batch:
   a. Delete connection_requests/{requestId}
   b. Create connections/{pairId}: { uids: [fromUid, toUid], initiatedBy: fromUid, connectedAt }
4. createNotification(CONNECT_ACCEPTED, fromUid, { ... })
```

**Critical:** `connections` are created via the Admin SDK because Firestore rules block client-SDK creates on that collection. Connection creation must be server-controlled.

---

## declineConnectionRequestAction(requestId)

Either party can decline (sender withdraws, recipient declines). Returns `void`.

```
1. caller = x-user-id
2. Load request; verify caller is fromUid or toUid
3. Delete connection_requests/{requestId}   (idempotent)
```

---

## disconnectAction(otherUid)

Either participant can disconnect. Returns `void`.

```
1. caller = x-user-id
2. pairId = buildConnectionId(caller, otherUid)
3. Delete connections/{pairId}              (idempotent, Admin SDK)
```

---

## getMyConnectionDataAction()

Caller from `x-user-id`. Returns all connection state for the current user in one call (`MyConnectionData`).

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
