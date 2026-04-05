# FileTypeIcon Component

**File:** `src/components/file-type-icon.tsx`

---

## Purpose

Centralized mapping from `ContentType` string to Lucide icon component. Used in filter chips, library cards, resource cards, message bubbles.

---

## Props

```ts
{
  type: ContentType | string;
  className?: string;
}
```

---

## Type → Icon Mapping

| ContentType | Icon | Color class |
|---|---|---|
| `lesson-plan` | BookOpen | text-orange-600 |
| `quiz` | ClipboardCheck | text-blue-600 |
| `worksheet` | FileSignature | text-green-600 |
| `visual-aid` | Images | text-purple-600 |
| `rubric` | Table | text-rose-600 |
| `micro-lesson` | Play | text-cyan-600 |
| `virtual-field-trip` | Globe2 | text-teal-600 |
| `instant-answer` | Wand2 | text-amber-600 |
| `teacher-training` | GraduationCap | text-indigo-600 |

**Fallback:** `File` icon for unknown types.

---

## Usage

```tsx
// In filter chips:
<FileTypeIcon type="quiz" className="h-3.5 w-3.5" />

// In library cards:
<FileTypeIcon type={content.type} className="h-5 w-5" />
```

This component enforces consistent iconography across the entire app. Never use hardcoded icons for content types — always use `FileTypeIcon`.
