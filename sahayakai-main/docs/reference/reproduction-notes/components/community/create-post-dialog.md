# CreatePostDialog Component

**File:** `src/components/community/create-post-dialog.tsx`

_Last verified against source: 2026-06-10._

---

## Purpose

Modal dialog for teachers to create and publish posts to the community. Supports text content and an optional image attachment. Form is managed with `react-hook-form` + `zod`.

---

## Props

```ts
{
  onPostCreated: () => void;             // callback after successful post
  trigger?: React.ReactNode;             // optional custom trigger element (mobile FAB)
  open?: boolean;                        // optional controlled-open
  onOpenChange?: (open: boolean) => void;
}
```

Supports controlled open state (`open` / `onOpenChange`) in addition to the default uncontrolled trigger. The `trigger` prop lets the mobile FAB reuse the same dialog.

TODO(verify: exact controlled-open prop names against current source.)

---

## Form Validation (zod)

- Content: minimum 5 characters (zod schema). Image optional, uploaded via `ImageUploader`.
- Submit gated by react-hook-form validity.

---

## Submit Flow

1. `createPostAction(content, 'public', imageUrl)` server action (note the visibility argument)
2. Validates auth (x-user-id header)
3. Creates the post document
4. On success: toast, close dialog, call `onPostCreated()`

TODO(verify: target collection name and any revalidatePath call in createPostAction.)

---

## DialogTrigger

```tsx
<DialogTrigger asChild>
  {trigger ?? <Button>Create Post</Button>}
</DialogTrigger>
```

Default trigger: standard Button component.
When `trigger` prop provided: uses that element (e.g., mobile FAB circular button).

---

## Design

- Dialog width: `sm:max-w-[500px]`
- Content textarea + optional image-upload section
- Submit button uses default (`bg-primary`) variant with disabled state
