# Server Actions: Content

**File:** `src/app/actions/content.ts`

---

## getUserContent(userId)

Returns all saved content for a user.

```
Fetches users/{userId}/content (up to 100 items)
Excludes soft-deleted items (deletedAt != null)
Serializes Timestamps to ISO strings for client compatibility
Returns ContentItem[]
```

---

## searchContentAction(userId, query, filters?)

Smart scored search across user's content.

```
Scoring per item:
  +10 if query term in title
  +5  if query term in topic
  +15 if grade matches context
  +15 if subject matches context
  +10 if language matches context

Returns all items if query empty (show all)
Returns ranked results sorted by score descending
```

---

## saveToLibrary(userId, content)

Save AI-generated content to user's private library.

```
1. Sanitize title (remove special chars, max 80 chars)
2. Generate UUID for contentId
3. Upload content data to GCS: users/{uid}/{type}/{sanitizedTitle}_{uuid}.json
4. Write Firestore record: users/{uid}/content/{contentId}
5. Track analytics event (content_created)
6. Return { contentId, storagePath }
```

---

## recordPdfDownload(userId, contentId, pdfBase64)

Saves a PDF download to GCS for future access.

```
1. Base64 → Buffer
2. Upload to GCS with retry
3. Update Firestore record with pdfStoragePath
4. Wrapped with Sentry instrumentation
5. Rolls back Firestore update if GCS upload fails
```

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
