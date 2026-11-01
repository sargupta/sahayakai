The top row of VIDYA Live: an optional back disc, "VIDYA" as the screen heading, and the status pill at the end.

**Use** as the first child of the Live screen body, directly under the status bar.
- Give `onBack` while listening: it collapses Live back into the ask-in-place `VoiceSheet` (the reverse of the sheet's "Keep talking"), and the conversation carries on there.
- Leave it out while VIDYA works, speaks or has failed; Stop, End and the failure actions are in `LiveControls`.

**The consumer provides** `status` (a `LiveStatus`), `onBack` when it applies, a translated `backLabel` ("Back to the sheet"), and `minutesLeft` with a translated `minutesText` only when 5 or fewer VIDYA Live minutes remain this month.

**Rules**
- The title is the screen's `h1`, Bricolage 600 14px. Keep it "VIDYA" in every language.
- The back disc draws at 38px inside a 1px `border-glass` edge (40px overall) with a 44px touch area.
- End, not Back, returns the teacher to the page she came from.
- **Minutes left.** Near the end of the month's minutes, a quiet amber `Pill` ("4 min left") sits before the status. It never interrupts, sounds or animates. When the minutes run out, VIDYA finishes her sentence first (see "VIDYA Live").
