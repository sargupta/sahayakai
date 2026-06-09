# ImageUploader Component

**File:** `src/components/image-uploader.tsx`

_Last verified against source: 2026-06-10._

---

## Purpose

Reusable Firebase Storage image upload control. Click to upload, with progress and preview.

---

## Props

```ts
{
  onImageUpload: (url: string) => void;   // note: onImageUpload, not onUpload
  className?: string;
  language?: string;                        // legacy, kept for backwards compat
  compact?: boolean;                        // condensed UI variant
}
```

There is no `onRemove`, `accept`, `maxSizeMB`, `storagePath`, or `disabled` prop. Accepted types and size are hardcoded inside the component.

---

## Constraints (hardcoded)

- Max size: 4 MB.
- Accepted types: `image/jpeg`, `image/png`, `image/webp`.
- Storage path: `users/{uid}/uploads/{uuid}_{file.name}`.

---

## Upload Flow

```
1. File selected
2. Validate size <= 4MB and type in {jpeg, png, webp}
3. uploadBytesResumable(ref(storage, `users/{uid}/uploads/{uuid}_{file.name}`), file)
4. on('state_changed'): track progress %
5. complete: getDownloadURL(ref) -> onImageUpload(url)
```

---

## UI

- Idle: drop/click zone with an `UploadCloud` icon (Lucide), styled with theme tokens (not hardcoded slate/orange).
- Uploading: progress indicator.
- Uploaded: preview.
- `compact` prop renders a condensed version.

TODO(verify: exact error-surface mechanism - inline text vs toast - in current image-uploader.tsx).

---

## Used In

- Worksheet flow - attach textbook image
- `CreatePostDialog` - post image
- TODO(verify: profile photo usage)
