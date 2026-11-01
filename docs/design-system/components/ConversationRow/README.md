One chat with VIDYA in My Library: a small orb, the first line of the teacher's ask, and how many messages, how, when.

**Use**
- My Library → Conversations: one row per chat, 9px apart in a `<ul>` with `as="li"`. Typed chats, turn-by-turn voice and VIDYA Live transcripts all land here on their own.
- `onClick` opens the transcript. `onKeep` shows the keep toggle: a kept chat is held for good; the rest roll over after the latest 10.

**The consumer provides** `ask` in the teacher's own words, `messages`, `mode` (`typed` · `voice` · `live`), `when` ("today", "16 Sept"), `kept`, and translated `modeLabel`, `keptLabel`, `keepLabel` (or a whole `meta` line) when not in English.

**Rules**
- A chat never creates a Generation, and a Generation never shows here. If a chat led to a lesson plan, the plan is a `LibraryRow` in Generations.
- The orb is VIDYA's mark, not a state: always the resting gradient, still, without a glyph.
- The keep toggle is its own 44px button (`aria-pressed`), named "Keep" plus the ask; kept rows also say "Kept" in the meta line.
- Asks stay on one line; Indic asks wrap and are never truncated.
- Same geometry as `LibraryRow` (orb in the 36px badge slot), so the two lists line up.
