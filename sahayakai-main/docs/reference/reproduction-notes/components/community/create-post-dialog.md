# CreatePostDialog Component

**File:** `src/components/community/create-post-dialog.tsx`

---

## Purpose

Modal dialog for teachers to create and publish posts to the community. Supports text content and optional image attachment.

---

## Props

```ts
{
  onPostCreated: () => void;   // callback after successful post
  trigger?: React.ReactNode;   // optional custom trigger element
}
```

The `trigger` prop enables the mobile FAB to use a custom circular button while reusing the same dialog logic.

---

## Internal State

| State | Type | Purpose |
|---|---|---|
| `open` | `boolean` | Dialog open/closed |
| `content` | `string` | Post text (min 5 chars) |
| `imageUrl` | `string \| null` | Optional image attachment |
| `submitting` | `boolean` | Submit in flight |

---

## Form Validation

- Content: minimum 5 characters, maximum 500
- Image: optional, uploaded via `ImageUploader`
- Submit button disabled until content ≥ 5 chars

---

## Submit Flow

1. `createPostAction(content, imageUrl?)` server action
2. Validates auth (x-user-id header)
3. Creates document in `community` collection
4. `revalidatePath('/community')`
5. On success: toast "Post published!", close dialog, call `onPostCreated()`

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

- Dialog width: `max-w-md`
- Content textarea: min-h-[120px], resizable
- Image upload: optional section below textarea
- Submit button: orange-500, full-width, disabled state
