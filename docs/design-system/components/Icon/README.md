The app's 20px line icons, drawn in the current text colour on one 1.7px stroke.

Every icon in SahayakAI comes from this one set, so the tab bar, the controls and the rows share one hand. The glyphs are drawn on a 20px grid with round caps and joins; `SahayakAI.ICONS` lists their names.

**Use**
- `name` picks the glyph; `size` 20 in rows and tabs, 18 inside 40-46px discs, 16 inside pills.
- Colour comes from the surrounding text (`currentColor`): `text-muted` for inactive, `text-strong` for active, white on saffron, leaf and indigo fills.
- Pass `label` only when the icon stands alone and means something. Beside a visible word it stays hidden from assistive tech.

**Rules**
- A mic glyph is a control you press. VIDYA herself is the orb and never carries a glyph, so never put the mic (or any icon) inside the orb.
- No emoji anywhere in the interface, and no brand marks (WhatsApp, YouTube) drawn as icons: name the channel in words.
- Icons never carry meaning alone. "Absent" is a red mark plus the word; "Send" is the arrow plus an accessible name.
- Don't mix in another icon library. Ask for a new glyph to be added to this set instead.
