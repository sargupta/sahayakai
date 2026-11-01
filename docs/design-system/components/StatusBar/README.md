The 36px device row at the top of every phone screen: the clock on the left, the network on the right.

**Use** as the first row of every phone mock. `PhoneScreen` draws it for you; use it alone only when building a custom screen shell.

**The consumer provides** `network` ("lte" online, drawn with a small battery bar; "no signal" offline, without one) and, rarely, `time`.

**States**
- `tone="light"` (default): `text-body` on every wash.
- `tone="camera"`: `on-camera-icon` on the scanner's `camera-ground`.
- Offline: pass `network="no signal"`; the orb and the offline queue carry the meaning, not this row.

**Rules**
- 36px high (`status-h`), 22px side padding, Instrument Sans 500 12px; the network text is tracked .14em. It runs edge to edge across the 360px screen.
- The battery is a drawn 5×9 bar in the text colour, never a text symbol.
- It is decorative (`aria-hidden`): the real device draws its own status bar, so assistive tech never reads a fake clock.
- Never put actions, badges or app state in it.
