A settings row that turns one thing on or off: its label, the state word ("On"), and a leaf track.

**Use** in Profile and settings cards, for settings that apply right away ("Orb on the left hand", "Auto-capture answer sheets"). Use a `Chip` to choose content and a `SegmentedControl` to choose one of several. A switch never needs a save button.

**The consumer provides** `label` (translated), either `checked` + `onChange` or `defaultChecked`, and translated `stateLabels` when the page is not in English. When the setting cannot change, it sets `disabled` and adds a line that says why, tied with `aria-describedby`.

**Anatomy:** the label (500 12px `ink-600`) on the left. On the right, the state word (600 12px: `leaf-700` "On", `ink-600` "Off") sits before a 40×24 pill track with a 20px `milk-50` thumb under `shadow-float`. The track is `border-strong` ink when off and `leaf-500` when on.

**States**
- Off and on: the thumb slides 16px in .25s on the standard curve, and appears without motion under reduced motion.
- Disabled: 55% opacity, with the reason written below.
- Forced colours: the track takes a system outline and the highlight colour when on.

**Rules**
- A `<button role="switch">` with `aria-checked`, named by its `<label>`. Tapping the label also toggles it.
- The state word is drawn for sighted users and hidden from assistive tech, which hears `aria-checked`. Status is always a word, never only the track's colour.
- The track draws at 24px tall; its touch area extends to 44px.
- Indic labels get a 1.6 line height, and Indic state words render at 12px.
