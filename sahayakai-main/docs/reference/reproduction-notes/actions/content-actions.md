# Server Actions: Content

**File:** `src/app/actions/content.ts`
**Verified:** 2026-06-10

The caller's uid comes from the `x-user-id` header; the leading `_userId` argument on these actions is ignored (kept for signature stability). Returns use the project's content types (`BaseContent`, `ContentType`).

---

## getUserContent(_userId?)

Returns all saved content for the authenticated user.

```
Fetches users/{uid}/content (up to ~100 items)
Excludes soft-deleted items
Serializes Timestamps to ISO strings for client compatibility
Returns BaseContent[]
```

---

## searchContentAction(_userId, query)

Smart scored search across the caller's content (no separate `filters` argument - context is inferred from the query).

```
Per-item scoring on title / topic / grade / subject / language matches.
Empty query → return all items.
Returns results sorted by score descending.
```

---

## saveToLibrary(_userId, type, title, data)

Save AI-generated content to the caller's private library. Returns `{ success, id?, error? }`.

```
1. Sanitize title
2. Generate contentId
3. Upload content data to GCS under users/{uid}/{type}/...
4. Write Firestore record users/{uid}/content/{contentId}
5. Track analytics (content_created)
```

---

## recordPdfDownload(_userId, title, base64Data, type = 'lesson-plan')

Saves a generated PDF to GCS for future access. Returns `{ success, path?, error? }`.

```
1. Base64 → Buffer
2. Upload to GCS (with retry)
3. Update Firestore record with the PDF storage path
4. Sentry-instrumented; rolls back the Firestore update if GCS upload fails
```

---

## testStorageConnection(_userId?)

Diagnostic: verifies GCS connectivity. Returns `{ success, message }`.

---

## API Routes (not actions)

### GET /api/content/list
Paginated content list. Query params: `type`, `cursor`, `pageSize` (default 20).

### GET /api/content/get?contentId=
Fetch single content item.

### DELETE /api/content/delete
Soft delete: sets `deletedAt` + `expiresAt` (+30 days).

### GET /api/content/download?contentId=
Returns GCS signed URL for file download.
