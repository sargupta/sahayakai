Three saffron dots in a small VIDYA bubble while she writes a reply, with a polite status that says so in words.

**Where it fits.** The conversation is the typed or turn-based thread; VIDYA Live (hands-free voice) shows her working state on the large orb instead, and the ask-in-place `VoiceSheet` shows it as steps. Every conversation, typed or Live, is kept in Library → Conversations, never as a Generation.

**Use** as the last child of a `ChatThread` from the moment the teacher's turn is sent until VIDYA's reply replaces it. Only one at a time. If the job takes longer than a few seconds, replace it with a reply that says what VIDYA is doing.

**The consumer provides** a translated `label` that names the job when it is known ("VIDYA is writing the worksheet").

**Anatomy:** VIDYA's 28px resting orb, 9px from a white 74% bubble with a `border-glass` edge, radius 20 (`radius-panel`), padding 13px 16px and `shadow-bubble`. Three 7px `saffron-500` dots, 5px apart, at full, 60% and 30% strength.

**Rules**
- The status (`role="status"`) carries the meaning; the dots are hidden from assistive tech.
- The dots lift in turn. Under reduced motion they stay still and the state still reads, because the three graded dots are a static picture.
- Saffron here is VIDYA, not a warning. Never tint the dots by state.
