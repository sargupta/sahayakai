# VIDYA Live

VIDYA Live is the teacher talking with VIDYA on one screen, hands-free, the way one talks to a colleague. VIDYA listens while the teacher speaks, shows what she heard as she hears it, checks the board's source out loud, reads the result back with captions, and can be interrupted at any moment. It is the product's most distinctive moment: build it exactly as specified here.

## Three ways to talk to VIDYA, one assistant

VIDYA has one body, the orb, which is a sphere with no glyph on it. Its colour and motion are its state. A mic glyph is always a control you press, and it is never drawn as a sphere. Keep these three entry points distinct:

| | Ask in place | VIDYA Live | Conversation |
|---|---|---|---|
| How it starts | Tap the orb | Hold the orb on Home; "Keep talking" in the ask sheet on any other screen; "Talk to VIDYA" on the web | Type, or open a past conversation |
| Surface | `VoiceSheet` over the page | A full screen (`ScreenLive*`) | A thread (`ChatThread`, `ScreenConversation`) |
| Turn-taking | Push to talk, one request | Continuous; VIDYA hears interruptions | Turn by turn |
| Best for | "Make a worksheet from this page" | Planning out loud, thinking with VIDYA, hands busy | Refining in writing, quiet rooms |
| Where it is kept | Library → Conversations | Library → Conversations | Library → Conversations |

How Live starts was decided 26 Oct 2026. On Home the orb is the hero and does not move, so holding it keeps talking. On every other screen the orb is parked, holding it drags it to another perch, and Live starts from "Keep talking". An inline field mic is a fourth, smaller thing: dictation into one field. It is never a conversation. A chat or a Live talk never creates a Generation. Only a tool's output does, and it creates exactly one row.

## One state model, phone and web

The same states drive the phone's Live screen, the web home's presence and the compact presence on tool pages. In code, the session's states map to these. `interrupted` shows as listening, `thinking` as working, `error` as failed, and `ended` as resting.

| State | Orb | Status pill | Screen ground | Eyebrow | Foot |
|---|---|---|---|---|---|
| Connecting | Working orb, slow breath | Indigo tint · "Connecting" | `wash-live-listening` | "Connecting" | End |
| Listening | `orb-live` 164px, breathing halo that grows with the teacher's voice | Saffron tint · "Listening · हिन्दी" | `wash-live-listening` + glow | "Listening" | Type · Mute · End |
| Muted | The listening orb, held still | Saffron tint · "Muted" | `wash-live-listening` | "Muted" | Unmute · End |
| Working | `orb-live-working` 118px inside a spinning indigo arc | Solid indigo · "Checking CBSE source" | `wash-working` + glow | "Reading a source" | Stop |
| Speaking | `orb-live-speaking` 118px, two leaf rings that follow her voice | Solid leaf · "Speaking · हिन्दी" | `wash-live-speaking` + glow | "Reading it back" | Pause · End |
| Paused | Speaking orb, still | Leaf tint · "Paused" | `wash-live-speaking` | "Paused" | Resume · End |
| Failed | No orb: a card says what happened | Solid red · "Couldn't hear" | `wash-live-failed` | none | Mic · finish by typing |
| Offline | `orb-offline` | Stone tint · "No signal · typing works" | `wash-screen` | none | Type |

These are the components: `LiveOrb`, `LiveStatus`, `LiveTranscript`, `LiveCaption`, `LiveReceipts`, `LiveControls`, `LiveError`, and `VidyaPresence` on the web.

**Colour is the state, and the whole screen takes it.**
- Saffron means VIDYA is listening.
- Indigo means she is working, and it is also the colour of curriculum.
- Leaf means she is speaking or the result is ready.
- Red appears only in the failed pill and the error card's edge, never on the orb.

The pill and the eyebrow always say the state in words, so colour never carries it alone. Under reduced motion nothing moves, and the words still tell the teacher where she is.

## The screen, top to bottom

1. **Header.** On the left, a back disc (while listening; in the other states the foot's Stop, Pause or End is the way out) and the word VIDYA. On the right, the status pill. The language is part of the pill ("Listening · हिन्दी"), so the teacher always knows which language VIDYA is hearing.
2. **Eyebrow.** 12px, tracked, in the state's colour: "Listening", "Reading a source", "Reading it back".
3. **Orb stage.** 176px square, centred, lit from behind by the state's glow.
4. **The card that matters now:**
   - listening: `LiveTranscript` ("You are saying"), the words as they arrive, with a saffron caret;
   - working: `LiveReceipts`, the visible steps;
   - speaking: `LiveCaption` ("Caption · step 2 of 6"), then the source note.
5. **One hint line**, for example "Stop speaking and she starts working". It is 12px and centred.
6. **Foot.** `LiveControls`: round 50px glass controls, or one wide button. They are always reachable with a thumb, and nothing sits under them.

## Listening

- The transcript card shows the teacher's words in her own script as they are recognised. It never shows a translation. The caret shows that VIDYA is still hearing.
- The turn ends after a natural pause: "Stop speaking and she starts working". The teacher never has to press send.
- **Type** switches to the keyboard on the same screen, and everything heard so far stays.
- **Mute** stops the microphone without ending the talk. The pill then says "Muted".
- **End** closes Live and returns to the page the teacher came from.

## Working: grounding the teacher can see

VIDYA shows her receipts while she works:
1. "Heard: lesson plan, water cycle, Class 6"
2. "Matched CBSE · NCERT Curiosity 6, Ch 8"
3. "Building a 40-minute plan…"

The board and the book are always named, never "NCERT" alone. For a Karnataka State Board teacher the second line reads "Matched KSEEB · Class 6 Science". Optional extras appear as chips under "I'll also do these if you tap", with the line "Nothing paid runs until you tap it." **Stop** cancels the work and keeps what was heard.

## Speaking: captions always on

- VIDYA states her source first: "Based on CBSE · NCERT Curiosity 6, Chapter 8." The source note under the caption repeats it in writing.
- The caption card shows the sentence being spoken, in the language VIDYA is speaking, and where it sits in the output ("step 2 of 6"). Captions cannot be turned off in Live, because a teacher in a noisy staffroom still has to follow.
- **Barge-in.** If the teacher talks over VIDYA, VIDYA stops speaking and returns to listening. **Pause** holds her mid-sentence, and **Resume** continues from the same word.

## When it fails

Failure keeps the work and drops to typing. It never makes the teacher start again.
- `LiveError` says what happened in plain words: "I couldn't hear that clearly. The connection dropped mid-sentence. I've kept what I caught."
- **"What I caught"** shows the partial request, with the lost words marked [lost].
- **"Finish it without voice."** The request appears as an editable field, with the understood parameters as chips (Class 6 · Medium · 10 questions).
- **On 2G**, VIDYA stays on typing until the signal returns, "because it's cheaper and it finishes".
- **"Retry voice when signal returns"** is a switch. VIDYA tells the teacher once and never keeps retrying.
- The last three requests are saved as drafts in Library, whatever happens to the signal.

## Minutes

Live voice is metered by the minute, so a teacher can always see what she has left, and the meter never interrupts a class (decided 26 Oct 2026).
- **Where she reads them:** Profile's usage card. `UsageMeter` takes `live` and shows "VIDYA Live" and "18 min left" over a bar of minutes used. It shows on every plan.
- **In Live:** nothing, until 5 or fewer minutes remain. Then `LiveHeader` takes `minutesLeft` and shows a quiet amber "4 min left" pill before the status. It never sounds, flashes or interrupts.
- **At zero:** VIDYA finishes the sentence she is speaking, then says it plainly in the teacher's language: "That's all my Live minutes for this month. I've kept everything we said. Shall we carry on by typing?" The conversation stays open in typing, and nothing is lost.
- **For the school:** admins see the school's pool and each teacher's use in the console, never a teacher's transcripts.

## Acting in the app: guarded, always confirmed

VIDYA knows the screen the teacher is on: its section, the safe entities on it, and what can be done there. She can navigate and act through the app's own paths.
- **Navigation.** She goes only to known sections of the app.
- **Actions.** She can take an action only when the current screen offers it and has it enabled. If the screen changed since she looked, she asks again rather than acting.
- **Changing data.** Anything that changes data (marking attendance, sending a message, calling a parent) waits for an explicit **Confirm** tap. Voice cannot skip the confirm, and it is checked again at the moment of confirming.
- **Public talks.** On the public website, VIDYA talks to visitors with no tools and no account context.

## Privacy

- The microphone is open only while Live is on screen, or while the web presence shows a live state. It is never open in the background, and there is no wake word.
- The pill always shows whether VIDYA is listening. Mute is one tap.
- Every Live talk is kept as a conversation in Library → Conversations, where the teacher can read it and delete it.

## On the web

`VidyaPresence` brings the same states to the browser, in three sizes:

| Size | Where | What it shows |
|---|---|---|
| Hero | The public landing page | Orb, "Meet VIDYA, tap and talk", status, End |
| Workspace | The signed-in home, under the greeting | Orb, status pill, the live caption line, three quiet starters, End; typing is a quiet field below |
| Compact | Every tool page, bottom-right | A 64px orb with the status pill and a short caption bubble stacked above it |

There is one voice session for the whole web app, so a talk started on the home page continues when VIDYA opens the lesson planner. On phone-width browsers the compact presence parks above the tab bar, and it never covers the page's primary action.

## Writing for Live

- Pill and eyebrow words are short and stay the same in every language: Listening, Reading a source, Reading it back, Paused, Couldn't hear.
- Spoken lines avoid symbols, abbreviations and the middle dot. Write "Class 6, Chapter 8", never "Cl. 6 · Ch 8".
- VIDYA speaks in the first person. She addresses the teacher as "you" and never uses exclamation marks.
