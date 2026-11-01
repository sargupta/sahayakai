"You are saying": the teacher's words as VIDYA hears them, live, with a saffron caret until she stops.

**Use**
- `variant="live"` (default) under the listening orb. Set `final` when the turn ends; the caret goes.
- `variant="caught"` at the top of a failure, under `LiveError`: "What I caught", quoted, each lost span in red.

**The consumer provides** the words as `text` in the teacher's own language and mix ("कक्षा छह के लिए जल चक्र की पाठ योजना बनाओ"), with `lang`. For a dropped line, mix strings with `{ lost: true }` spans; give a translated `lostLabel` and `label` in other languages.

**Rules**
- 17px/1.8 (16px when caught), `text-strong`, on a 22px glass card with `shadow-live-card`. Indic scripts fall through the font stack to Noto; the line height already clears their marks. Never truncate the words.
- The caret is a 1.5px `saffron-600` bar that blinks; it stops blinking under reduced motion and disappears when `final`.
- It is not a live region: the teacher is speaking, and the `LiveStatus` carries the state.
- Lost spans are `red-500` with a word ("[lost]"), never colour alone.
- The finished conversation, with this transcript, is kept in Library under Conversations. A conversation never creates a Generation.
