VIDYA reading an output back, docked on the page: where she is, the line she is saying, and a play/pause disc.

**Use**
- On an output while VIDYA reads it aloud ("Reading back · 2 of 4"), above the output's actions.
- Mark the section being read with `Accordion`'s `current`, so the page and the bar agree.
- Dock it beside the parked orb: give the bar a right margin that clears the orb, so the two read as VIDYA and her words.

**The consumer provides** `quote` (without quote marks), `step` and `total`, `playing` with `onToggle` (or `defaultPlaying`), and translated `text`. For Hindi, `where: '{total} में से {step}'`.

**States**
- Reading: the leaf eyebrow "Reading back · 2 of 4"; the disc shows pause.
- Paused: the eyebrow "Paused · 2 of 4" in `text-body`; the disc shows play.

**Rules**
- The disc is a control, a flat 40px `leaf-500` circle with a glyph. It is never drawn as a sphere, and the orb never carries a glyph.
- The disc's name says what it will do ("Pause reading", "Resume reading"); its touch area reaches 44px.
- The quoted line is not a live region: VIDYA's voice already says it, and an announcement would talk over her.
- The card is `surface-disc` with a `border-glass` edge and `radius-scan` corners. Indic eyebrows are not uppercased or tracked; Indic quotes take a 1.7 line height.
