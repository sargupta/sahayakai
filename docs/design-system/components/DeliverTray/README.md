One tray for every output: pick any ways to deliver, then one send. Nothing leaves the phone before that tap.

**Use** when the orb is ready (leaf) or the teacher taps "Deliver" on an output: a lesson, worksheet, quiz, rubric or call log. The same tray serves every output; only the options change.

**The consumer provides**
- `subtitle`: what is being delivered and in which language ("Lesson plan + worksheet · हिन्दी").
- `options`: each with a `title`, a fact (`sub`: "WhatsApp · 34", "A4 · 34 copies") and the send label it implies (`action`: "Send to parent group"). The default six are Parent group, Print, Save to class, Post to Community, Download PDF and Read aloud.
- `selected` with `onChange` (or `defaultSelected`), `onDeliver`, and `onPreview` for the saffron Preview pill.

**States**
- An option at rest: `surface-inset` with a `border-row` edge, `radius-field`.
- Chosen: `leaf-tint` with a `leaf-tint-border` edge and a leaf check disc, so the choice never rests on colour alone.
- The send follows the choice: one option shows its own action ("Send to parent group"); several show "Deliver 3 ways"; none disables it with "Choose a way to deliver".

**Rules**
- Options are toggle buttons (`aria-pressed`) in a labelled group; each is at least 44px high.
- Keep the promise visible: "Nothing leaves the phone until you tap send." on a 8% saffron note.
- The send is the one primary on the tray: 50px, `accent-fill`.
- Counts in the facts must be the class's real numbers (34 present, 34 copies).
