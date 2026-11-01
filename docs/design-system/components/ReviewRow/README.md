One answer sheet the scanner could not mark alone: the sheet, the student, why, and the one action that fixes it.

**Use**
- Scan results, under a red eyebrow "Needs your eye · 2", 7px apart in a `<ul>` with `as="li"`.
- `action="Review"` when the teacher can mark it from the photo; `action="Rescan"` when the photo is unusable.

**The consumer provides** `name`, `roll`, `reason` ("Q4 handwriting unclear", "Photographed at an angle"), `tone`, `action` + `onAction`, an optional sheet photo in `src`, and translated `rollLabel`.

**Rules**
- `tone="red"`: could not be read · `tone="amber"`: read, but needs a retake or a check. The reason always says it in words.
- The action's name reads the action and the student together ("Review Divya Rane · roll 04"); its touch area extends to 44px.
- Never mark a sheet silently: every exception the scanner meets becomes a row here until the teacher clears it.
- Row: 14px radius, 86% glass; 30px thumbnail on paper `#f3ede3`; name 12px/600, reason 12px, action 12px/600 `saffron-600`.
