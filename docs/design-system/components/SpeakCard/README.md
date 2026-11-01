The spoken way into a tool: a flat saffron mic button, an example of what to say, and a typed way in beside it.

**Use**
- At the top of Make and of any picker where the teacher can simply say what she wants ("Class 5 fractions revision sheet"). One per screen.
- The mic is a control. VIDYA herself stays the parked `Orb`; never put an orb in this card and never draw this disc as a sphere.

**The consumer provides** `example` (a real request, without quotes), `onSpeak`, `onType`, and while listening `transcript`, `language` and `level` (0 to 1, the live mic level). Override `title`, `typeLabel`, `micLabel` and `offlineHint` to translate.

**States**
- `idle`: "Tap and speak", the example in curly quotes, "Or type a topic". The 50px well behind the 42px disc breathes (`accent-wash`).
- `listening`: "Listening · English"; the transcript replaces the example and is announced politely; the well stays lit (`accent-outline`) and swells with `level`. The mic is `aria-pressed` and named "Stop listening".
- `offline`: "Voice needs a signal", "Typing works without one", "Type a topic". The disc turns `stone-500` with the mic-off glyph and is disabled.

**Rules**
- The whole card is the mic's touch area (its ::after covers the card); "Or type a topic" is a separate button layered above it with a 44px touch area.
- Card: 74% white glass, 1px `border-glass`, 22px radius, `shadow-live-card`, 15px 17px padding. Disc: `saffron-500`, `shadow-mic`, white mic glyph.
- Title 15px/600 in the display face; example 12px/1.5 in `text-body`; the typed way in 12px/600 `saffron-600` with a forward chevron glyph, never a text arrow.
- Under reduced motion the well is still; the title and `aria-pressed` carry the state.
