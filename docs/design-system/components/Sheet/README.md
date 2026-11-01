The bottom sheet that rises over the page behind it: SahayakAI's only dialog, menu and picker shell.

SahayakAI never leaves the page to ask something: VIDYA listens, works and delivers in sheets over the page, and the page stays visible at about 34% opacity under a 14% ink scrim. Confirmations, pickers (`OptionSheet`) and the voice and deliver flows (`VoiceSheet`, `DeliverTray`) all use this shell.

**Use**
- To confirm something consequential: pass `title` and two buttons, with the safe choice first. Use `role="alertdialog"` when it ends or sends something.
- To pick from a list, use `OptionSheet`. For VIDYA's own flows, use `VoiceSheet` and `DeliverTray`.
- `modal={false}` with no scrim for a sheet the teacher can work around, for example VIDYA writing in the background.

**The consumer provides**
- `open` and `onClose`.
- A `title` (or a custom `header`) that names the dialog.
- The children. Buttons inside use `size="sm"`.
- Dimming the page behind: set it to opacity .34.
- A positioned screen to rise in (`PhoneScreen`). The sheet spans its full width and grows with its content up to 48px below the top.

**Anatomy:** a 44×4 grab handle, an optional header, then the content stacked 12px apart on `surface-card`. The corners are `radius-sheet` (26px) at the top and `radius-screen` at the bottom, and the sheet casts `shadow-sheet`.

**Behaviour**
- It focuses its first control on open.
- Escape and a tap on the scrim call `onClose`.
- It rises in 0.4s on the standard curve, and appears without motion under reduced motion.
- `contained` (the default) keeps it inside the nearest positioned screen; `contained={false}` fixes it to the viewport.
