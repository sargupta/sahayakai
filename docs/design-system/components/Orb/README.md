VIDYA, drawn as a draggable saffron sphere that floats over every screen. Its colour is its state.

**States**
- `resting`: parked at 56px, floating 7px every 5.5s; a tap opens the voice sheet.
- `dragging`: lifted with a 12px saffron halo; on release it snaps to one of six perches.
- `listening`: a pulsing halo (2s), while the page behind stays visible.
- `working`: indigo, pulsing at 1.8s. VIDYA keeps working while the teacher uses the app.
- `ready`: leaf, with a count badge; a tap opens the deliver tray.
- `offline`: stone grey, still. Voice needs signal; typing and saved work carry on.

**Placement**
- Park it at right 16 / bottom 100 (`.sk-orb-park`), above the tab bar.
- Over a full-width CTA, use bottom 172 (`.sk-orb-park--cta`).
- The teacher chooses a hand, and the position is remembered per hand (`.sk-orb-park--left`).
- It is never inside the tab bar, never inside a card, and never more than one per screen.

**The consumer provides** `state`, `badge` (ready only), `onClick`, and a `label` when the default "VIDYA, <state>" is not enough. Add `decorative` when a visible line next to it already names the state.

**Rules**
- The orb carries no glyph. Its meaning comes from the state colour and motion, plus the words beside it (`OrbHint`, the sheet title). Colour is never the only signal.
- It is never red. An error is said in words in the sheet.
- Under `prefers-reduced-motion` it stops floating and pulsing; the state colour and words remain.
- As a button its touch area is at least 56px.
