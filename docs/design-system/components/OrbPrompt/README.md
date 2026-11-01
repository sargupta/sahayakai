VIDYA speaking from context: a short offer card beside the parked orb, with one primary and one secondary action.

**Use** when the page in front of the teacher makes a next step obvious: after scan results ("I can build a remedial worksheet for the 4 weak concepts."), after a call, on a post. At most one prompt per screen, and only after the teacher has seen the page.

**The consumer provides**
- `message`: one sentence in VIDYA's first person, built from facts on the page.
- `primary`: the offer ("Build it"). `secondary`: the alternative ("Message parents").
- `orbState` and `onOrb` (the orb opens the voice sheet), and `onDismiss` when the offer can be put away.

**Anatomy:** the card is `surface-float` with a 30% saffron edge, `radius-panel` and `shadow-prompt`, padded 12px 13px; the message is 500 12px `text-strong`; the two `xs` buttons share the width. The 56px orb sits to its right, aligned to the card's foot. The whole sits left 16, right 16, bottom 78, over the tab bar. Set the screen's `padBottom` to 150 so nothing hides under it.

**Rules**
- The offer is announced once, politely (`role="status"`); it never takes focus or blocks the page.
- With `onDismiss`, a close control (named "Not now", touch area 44px) and Escape put it away. Do not bring a dismissed offer back on the same page.
- Never offer something VIDYA cannot do offline without saying so.
- Indic messages get a 1.7 line height and button labels wrap rather than truncate.
