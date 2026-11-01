A floating capsule that confirms what just happened, with an optional status dot and one text action such as Undo.

**Use** after an action that left the screen ("Sent to the Class 7 parent group", "Saved offline · I'll send it when you're back") and for short hints while dragging ("Release to park · six perches"). Place it in `.sk-toast-dock`: centred, 84px above a screen's foot, clear of the tab bar and above it in `z-toast`.

**The consumer provides** the message as `children`, an optional `tone` for the dot, and `action` + `onAction`. Keep the `Toast` mounted and switch `open` (or the children) so its live region exists before the message arrives.

**States**
- Default: `surface-capsule` with a 1px `border-row` edge, `shadow-hint`, `radius-pill`, 8px 13px padding; text 12px/500 `text-strong`.
- With a dot: an 8px dot in the tone: `leaf` done, `amber` queued, `red` failed, `saffron` VIDYA, `indigo` working.
- With an action: a 12px/600 `saffron-600` text button whose touch area extends to 44px.
- Empty: no box, nothing announced.

**Rules**
- It is a polite `role="status"` region; the message is announced once, whole.
- One toast at a time; a new one replaces the old.
- A toast with an action stays until the teacher acts or moves on, and at least 10 seconds. A plain toast may leave after 4 seconds.
- Never put the only copy of important information in a toast, and never an error that needs a decision: use a sheet.
- The message wraps in long languages and never truncates. On a 360px phone the dock keeps 16px from each edge, so a long message wraps to a second line inside the capsule.
