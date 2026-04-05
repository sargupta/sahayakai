# ImageUploader Component

**File:** `src/components/image-uploader.tsx`

---

## Purpose

Reusable Firebase Storage image upload component. Drag-drop or click to upload. Shows progress, preview, remove option.

---

## Props

```ts
{
  onUpload: (url: string) => void;
  onRemove?: () => void;
  accept?: string;             // default: "image/jpeg,image/png,image/webp"
  maxSizeMB?: number;          // default: 4
  storagePath?: string;        // custom path prefix
  disabled?: boolean;
}
```

---

## State

| State | Type | Purpose |
|---|---|---|
| `uploading` | `boolean` | Upload in flight |
| `progress` | `number` | Upload % (0–100) |
| `preview` | `string \| null` | Local object URL for preview |
| `error` | `string \| null` | Validation error |

---

## Upload Flow

```
1. File selected (drag or click)
2. Validate: size ≤ maxSizeMB, type in accept list
3. Create local preview: URL.createObjectURL(file)
4. path = storagePath ?? users/{uid}/uploads/{uuid}.{ext}
5. uploadBytesResumable(storageRef, file, { contentType: file.type })
6. task.on('state_changed'):
   - next: setProgress(snapshot.bytesTransferred / snapshot.totalBytes * 100)
   - error: setError('Upload failed')
   - complete: getDownloadURL(storageRef) → onUpload(url)
```

---

## UI States

**Idle/Drop zone:**
- Dashed border, `Upload` icon, "Click or drag to upload"
- `border-dashed border-2 border-slate-200 rounded-xl`
- Drag over: `border-orange-400 bg-orange-50`

**Uploading:**
- Image preview shown (semi-transparent)
- `Progress` bar component below preview
- Percentage text

**Uploaded:**
- Full image preview
- Remove button (`X` icon, top-right)

**Error:**
- Error text in red below drop zone

---

## Used In

- `WorksheetWizardPage` — attach textbook image
- `CreatePostDialog` — post image
- `EditProfileDialog` — profile photo (if implemented)
