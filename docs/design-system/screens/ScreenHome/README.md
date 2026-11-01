Home: VIDYA's voice-first front door, set on the teacher's real day: the day, what to say, the orb and a type bar.

The teacher opens the app between periods, so Home answers two questions at once: what does my day hold, and what can I ask for. The orb is the screen; everything waiting is written as something to say.

Built from the following:
- the `ScreenHeader` greeting and a `screen`-level title about the day ("Two periods, one prep gap"), with today's periods as the subline;
- one raised `GlassCard` panel, eyebrow "Say it, I'll open it", of `TaskRow`s, each a real waiting item phrased as the words that open it and routing to its tool;
- the `Orb`, 112px and centred, with "Tap or hold to speak" under it;
- the `Composer` ("Ask VIDYA, or type what you need…") with a one-line hint;
- the `TabBar` on Home.

**The consumer provides**
- The day: the teacher's periods for the headline and subline.
- Up to four waiting items, each with a real count, a meaning dot and the phrase in the teacher's language (code-mixed is normal: "आज के 4 absentees के parents को call करो").
- `onClick` per row (open its tool with the item preloaded), the orb's tap (open the `VoiceSheet`) and hold (keep talking), and the composer's submit.

**States**
- No timetable: the headline counts what is waiting ("3 things waiting today"); the subline names the teacher's classes.
- Nothing waiting: the card offers two or three things to say for the next period instead, drawn from the teacher's classes and board ("Class 7 Maths का कल का lesson").
- Working or ready: the orb takes its state colour and count, here as everywhere.

**Rules**
- The headline is the teacher's real day, never a generic welcome, and every count is real.
- Exactly one orb: on Home it is the hero, so there is no parked orb on this screen.
- Each row is one button; its accessible name reads the phrase and the action ("Call: आज के 4 absentees…").
- Rows may wrap in long languages; never truncate them.
- Four tabs, never five: creation starts from the orb, the rows and the composer.
