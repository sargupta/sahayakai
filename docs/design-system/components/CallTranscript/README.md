The live transcript of a parent call: each line marked VIDYA or parent, new lines announced, with a reassurance below.

**Use** under `CallStage` on the in-call screen, and read-only (`live={false}`) wherever the finished call is opened from its summary.

**The consumer provides**
- `lines`, oldest first: `{ who: 'vidya' | 'parent', text, lang }`.
- `parentName` ("Hiren's mother") and `parentInitials` (default "P").
- `translatedFrom` ("Translated from Bengali") when the lines are shown in the teacher's language rather than as spoken.
- `note`: the default "You needn't stay on the line. A summary follows."; `null` to hide it.

**Anatomy:** a `surface-glass-strong` panel (`radius-panel`, 15px padding, soft card shadow) with a 12px tracked label; lines 9px apart, each a 20px marker and 12px/1.6 text. VIDYA's marker is a small leaf `Orb`; the parent's is a 20px saffron-tint `Avatar` with their initials. The note is a 60% white strip (`radius-field`, 10px 13px, 12px `text-body`) 18px below.

**Behaviour**
- The list is an ordered list with `aria-live="polite"`: each new line is read once, prefixed with who said it.
- Given a height (e.g. `flex: 0 1 auto` in a screen column), the lines scroll inside the panel, newest kept in view, and the list becomes focusable so it can be scrolled from the keyboard.

**Rules**
- VIDYA speaks for the school in the first person and never names the product. When a parent asks, she says the call is automated and that the class teacher reads everything.
- Indic lines render at 13px/1.7 and are never truncated.
- The transcript stays on the phone until the summary is saved to the student's record.
