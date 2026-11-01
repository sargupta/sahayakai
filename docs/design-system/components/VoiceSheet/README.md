The sheet VIDYA opens over the page behind it, first to listen and then to work, without leaving the page.

**Use**
- `state="listening"` after a tap on the orb: a modal sheet over a 14% `scrim`, with the page dimmed to 34% behind it. Children: what VIDYA heard, `SuggestionRow`s and a `Composer` for typing instead.
- `state="working"` once the teacher picks: non-modal, no scrim, the page stays usable. Children: `ChecklistStep`s, the draft so far and a progress bar. Give it `onMinimise` ("Minimise to orb") and `onStop`.
- `onKeepTalking` while listening adds a quiet "Keep talking" pill under the titles, with the speaker glyph: VIDYA will talk back. It grows ask-in-place into VIDYA Live, full screen, for a back-and-forth conversation. Holding the orb stays reserved for dragging it, so Live is never on a long press.
- When minimised, the orb turns indigo and keeps working; when ready it turns leaf and opens the `DeliverTray`.

**The consumer provides** `subtitle` (the language and what VIDYA is reading), `context` (the page behind, board-aware: "Working with Fractions · Class 7 · CBSE"), `transcript`, the children, and the handlers.

**Anatomy:** built on `Sheet`. The header is the orb (46px with its listening halo, or 42px indigo while working), a Bricolage title and an 11px subline, and a `leaf` "Mic on" pill while listening. The context card is `surface-inset` with a `border-hairline` edge and a `tight` eyebrow ("This page"). The transcript is Bricolage 600 15px in quotes.

**Rules**
- The sheet is named by its title; title and subline changes are announced politely.
- Listening takes focus; working does not, so the teacher keeps their place.
- "Keep talking" is a real button with its words beside the glyph; its pill draws 28px and its touch area extends to 44px.
- "Mic on" is said in words, not only by the pulsing orb. Under reduced motion nothing pulses and the words remain.
- Indic transcripts and context lines get a 1.7 line height and wrap rather than truncate.
- Working never dims the page: the teacher can keep teaching while VIDYA writes.
