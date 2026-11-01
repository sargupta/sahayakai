The bar over a conversation with VIDYA: a back disc, the centred title and a settings disc.

**Where it fits.** It heads the conversation, the typed or turn-based thread. VIDYA Live (hands-free voice) and the ask-in-place `VoiceSheet` (a quick ask about the current page) carry their own headers. Every conversation, typed or Live, is kept in Library → Conversations, never as a Generation.

**Use** at the top of a conversation screen. Title it "VIDYA" for a live conversation, or with the conversation's topic when reopening one from the Library.

**The consumer provides** `onBack`, `onSettings` (language, voice, what VIDYA may read), the `title` when it is not "VIDYA", and translated `backLabel` and `settingsLabel`.

**Anatomy:** two 40px discs (38px inside a 1px `border-glass` edge) on `surface-disc`, holding the `back` and `settings` glyphs in `text-muted`. The title is Bricolage 600 17px, centred, and is the screen's `<h1>`.

**Rules**
- A disc left out keeps its space, so the title stays centred.
- Both discs are buttons named in words ("Back", "Conversation settings"); their touch areas extend to 46px.
- Long Latin titles end in an ellipsis on one line; Indic titles wrap instead and are never truncated. Keep titles short.
