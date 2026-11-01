VIDYA at full size in a live conversation: a glyph-free sphere whose colour, size and motion say what she is doing.

**Use**
- `size="live"` on the VIDYA Live phone screen, under the state eyebrow and above the transcript, caption or receipts.
- `size="hero"`, `"workspace"` and `"compact"` come through `VidyaPresence` on the web. Don't place them by hand.
- Everywhere else VIDYA is the parked 56px `Orb`. LiveOrb appears only once Live is open, or in the web presence.

**How the teacher gets here**
- Tapping the parked `Orb` opens the ask-in-place `VoiceSheet`. Holding or dragging the orb moves it; it never opens Live.
- The sheet's "Keep talking" control expands it into VIDYA Live, full screen. On the web, "Talk to VIDYA" (the presence orb or the sidebar entry) starts Live directly.
- End returns the teacher to the page she came from.

**States**
- `listening`: `orb-live` at `live-orb` (164px) with three drifting blobs and a sheen, inside a breathing `halo-live-listening` that swells with the mic.
- `working`: `orb-live-working` at `live-orb-sm` (118px) inside a 3px `indigo-500` arc that turns every 2.6s, over `halo-live-working`.
- `speaking`: `orb-live-speaking` at 118px with two leaf rings breathing out of step and swelling with VIDYA's voice. On the phone its stage is 150px.
- `paused`: the speaking sphere, still, without rings. `connecting`: the working sphere breathing slowly, without the arc. `offline`: `orb-offline`, still.
- `resting` and `failed` belong to the web presence: the listening sphere at rest, and the same sphere desaturated and still after a failure. On the phone a failure shows `LiveError` and no orb.
- Shadows: `shadow-orb-live`, `shadow-orb-live-working`, `shadow-orb-live-speaking`; the 64px dock uses the 56px orb's lighter shadows.

**The consumer provides** `state`, and the live level as `getLevel` (read once a frame without re-rendering; preferred) or `level` (0-1). With `onClick` the orb becomes the start and end button: give it a constant `label` ("Talk to VIDYA"); `aria-pressed` says whether a conversation is on.

**Rules**
- Never put a glyph inside it and never draw a mic button as a sphere. It is never red: a failure is said in words.
- The level drives one custom property, `--sk-live-level`, applied as `scale` on the halo (up to 12%) or the rings (14% outer, 8% inner), so it composes with the breathing.
- Above the orb, a 12px eyebrow tracked 0.2em names the state in its colour: "Listening" `saffron-600`, "Reading a source" `indigo-500`, "Reading it back" `leaf-700`.
- Without `onClick` it is `role="img"` named for the state ("VIDYA is listening"). The `LiveStatus` beside it announces changes; add `decorative` when the image name would only repeat it.
- Barge-in: the moment the teacher talks over VIDYA, switch straight back to `listening`.
- Under reduced motion nothing moves and the level is ignored; the pill and the eyebrow carry the state.
