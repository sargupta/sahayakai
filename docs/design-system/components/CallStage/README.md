The top of a parent call VIDYA makes for the teacher: status and clock, VIDYA speaking on the line, who, how it goes.

**Use** as the first block of the in-call screen, on `wash-call` lit by `glow-live-speaking`. It is the screen's heading (`h1` by default).
- `state="connecting"` while the number on record rings: indigo status, the working sphere breathing slowly. Put the masked number and "the number on Hiren's record" in `detail`.
- `state="live"` (default) on the line: leaf status ("Call in progress · 1:12"), the leaf speaking sphere with two rings that follow VIDYA's voice through `level` or `getLevel`.
- `state="ended"` for the moment the call closes: ink status, the sphere still, no rings. The call summary follows.

**The consumer provides** `status`, `time`, `name` as the teacher knows the parent ("Hiren's mother"), `detail` ("Speaking Bengali · 3 exchanges so far") and the voice level.

**Anatomy:** a centred column 18px apart: the status (12px, tracked .18em, uppercase), a fixed 150px stage holding VIDYA's sphere (`orb-live-speaking`, 118px, in `halo-live-speaking`), the name in Bricolage 20/700 and the detail in 12px `text-body`, 4px below.

**Rules**
- The sphere is VIDYA and never carries a glyph: no phone, no mic. Colour and motion say the state; the status words say it too.
- The stage keeps its 150px in every state, so nothing on the screen moves when the call connects or ends.
- The clock is a `timer` and is not announced each second. State changes are announced once, politely ("On the call with Hiren's mother. VIDYA is speaking.").
- Calls go only to the number on the student's record, only inside the school's calling hours. The voice speaks as the school, never as a product, and says it is automated when asked.
- Under reduced motion the rings and sphere hold still; the status line still carries the state.
