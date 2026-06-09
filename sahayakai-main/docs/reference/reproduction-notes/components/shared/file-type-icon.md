# FileTypeIcon Component

**File:** `src/components/file-type-icon.tsx`

_Last verified against source: 2026-06-10._

---

## Purpose

Centralized mapping from a `FileType` string to a Lucide icon component. Used in filter chips, library cards, resource cards, and message bubbles.

---

## Props

```ts
{ type: FileType; className?: string } & LucideProps
```

Extra `LucideProps` (e.g. `strokeWidth`) are forwarded to the rendered icon.

---

## Type → Icon Mapping

The component is a `switch` on `type`. It applies NO color classes - color comes entirely from `className` passed by the caller (or surrounding text color). This differs from the legacy doc, which listed per-type `text-*` colors that no longer exist here.

| FileType | Icon |
|---|---|
| `lesson-plan` | `FileText` |
| `quiz` | `FileSignature` |
| `rubric` | `ClipboardCheck` |
| `worksheet` | `PencilRuler` |
| `visual-aid` | `ImageIcon` |
| `image` | `ImageIcon` |
| `instant-answer` | `Lightbulb` |
| `virtual-field-trip` | `MapIcon` |
| `micro-lesson` | `Video` |
| `teacher-training` | `GraduationCap` |
| `assessment-submission` | `ScanLine` |
| `folder` | `Folder` |
| default | `FileText` |

---

## Usage

```tsx
<FileTypeIcon type="quiz" className="h-3.5 w-3.5" />
<FileTypeIcon type={content.type} className="h-5 w-5 text-primary" />
```

Always route content-type iconography through this component; never hardcode icons for content types.
