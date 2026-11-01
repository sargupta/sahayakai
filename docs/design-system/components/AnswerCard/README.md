VIDYA's result inside a conversation: the reply, a leaf chip naming its source, and Open, Read aloud and Again.

**Where it fits.** The conversation is the typed or turn-based thread; VIDYA Live is hands-free voice; the ask-in-place `VoiceSheet` is a quick ask about the current page. An AnswerCard is how a result arrives in the conversation. Every conversation, typed or Live, is kept in Library → Conversations, never as a Generation.

**Use** for any reply that produced something: a lesson plan, worksheet, quiz or answer. For plain replies, use `ChatBubble`.

**The consumer provides**
- The reply as `children`: what is ready and what is in it, in VIDYA's first person ("Ready: a 40-minute water cycle plan for Class 6. Warm-up, four stages, group activity, wrap-up.").
- `source`, board-aware: "CBSE · NCERT Curiosity 6, Ch 8", "Karnataka State Board (KSEEB) · Class 7, Ch 8", or "Source stated aloud" after a voice turn where VIDYA named it.
- `resultName` ("Water cycle lesson plan, Class 6"), which names the actions for assistive tech.
- `onOpen`, `onReadAloud` with `reading`, and `onAgain`; translated labels.

**Anatomy:** a VIDYA `ChatBubble` laid out as a column, 10px apart. The source chip is `leaf-tint` with a 6px `leaf-500` dot and `leaf-700` 500 12px text. The actions sit 4px lower, 7px apart: Open is the small `saffron-500` pill; Read aloud and Again are quiet pills (`fill-quiet` with a `border-strong` edge). All are 600 12px, padding 8px 13px.

**States**
- Reading: Read aloud is pressed (`aria-pressed`) and turns leaf, the speaking colour, while VIDYA reads the answer.
- No source: omit `source` rather than show an empty or vague chip.

**Rules**
- The source names the board and the book, never "NCERT" alone.
- One saffron action per answer: Open. The others stay quiet.
- Each pill draws about 31px tall; its touch area extends to 44px.
- Never use the leaf chip for something VIDYA did not ground; say what was not checked with a `HonestyNote` instead.
