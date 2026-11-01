# VIDYA and voice

VIDYA is the assistant inside SahayakAI. It is drawn as one draggable orb that floats over every screen and reads whatever page is behind it. Voice is the front door, and typing is always an equal sibling: the same sentence typed or spoken gives the same result.

There are three ways to talk to VIDYA. **Ask in place** (tap the orb) is the sheet loop below: one request about the page behind it. **VIDYA Live** (hold the orb on Home, "Keep talking" in the ask sheet elsewhere, or "Talk to VIDYA" on the web) is a full-screen, hands-free conversation; it has its own guide, "VIDYA Live". **Conversation** is the typed thread. All three are one assistant with one state model, and every talk is kept in Library → Conversations.

**One entity, three bodies.** The orb is VIDYA: a sphere with no glyph, whose colour and motion are the state. A mic button is a flat pill or disc with a mic glyph: a control you press, never a sphere. An inline field mic is a small mic beside one input: dictation into that field, not a conversation.

## The loop

| Step | The orb | What the teacher sees | Component |
| --- | --- | --- | --- |
| Rest | Saffron, floating | "Tap to speak" beside the orb on first use, then the orb alone | `OrbHint` |
| Listen | Saffron with a pulsing halo | A sheet over the page: "Listening", the language, the page it is reading ("This page"), the words as they are heard, interpretations to pick, and a Composer to type instead | `VoiceSheet` |
| Work | Indigo, pulsing | "Writing your lesson", a checklist of real steps (board and chapter matched, activity chosen, writing in हिन्दी), the draft so far, progress. "Minimise to orb" keeps working in the background | `VoiceSheet state="working"`, `ChecklistStep`, `ProgressBar` |
| Ready | Leaf, with a count | The output on its screen; a tap on the orb opens the deliver tray | `ArtifactFrame`, `Orb state="ready"` |
| Deliver | Leaf | One tray for every output: parent group, print, save to class, post to Community, download, read aloud. Nothing leaves until the teacher taps send | `DeliverTray` |
| Offline | Stone, still | "Typing still works" | `OrbHint`, `Composer state="offline"` |

## Behaviour rules

- **No background listening.** There is no wake word, and the microphone is never open in the background. Ask in place is push to talk, and its sheet shows a leaf "Mic on" pill whenever it is open. VIDYA Live keeps the microphone open only while its screen is visible, with Mute one tap away and the status pill always saying what VIDYA is doing.
- **Context first.** VIDYA states what it is reading before it acts: "This page: Working with Fractions · Class 7 · lesson plan". It offers interpretations as `SuggestionRow`s instead of guessing silently.
- **Confirm by speaking back.** When the teacher's words are noisy or code-mixed, VIDYA reads back its understanding ("Did you mean Ganita Prakash 7, Chapter 8?") before generating.
- **Never block the app.** Working is non-modal. The teacher can minimise to the orb, keep using the app, and come back when it turns leaf.
- **Context prompts are offers, not interruptions.** On a results screen VIDYA may offer the obvious next step ("I can build a remedial worksheet for the 4 weak concepts.") with two choices (`OrbPrompt`). One offer at a time; it dismisses on any other action.
- **Honest failure.** If listening fails, VIDYA says so in words, keeps what she caught and offers the way forward ("I couldn't hear that clearly. I've kept what I caught."). The orb is never red: failure is shown by the red status pill and an error card, and the work drops to typing.
- **The teacher decides.** VIDYA drafts. Every send, call and post waits for the teacher's tap.

## The orb

- **Colour is the state.** Saffron rests, moves and listens; indigo works (and checks the board's source); leaf is ready and speaking; stone is offline. Motion reinforces the state and never replaces it.
- **No glyph on the orb.** Never put a mic, sparkle or any icon on the sphere. When the orb needs words ("Tap to talk"), they sit in a pill or hint beside it.
- **Placement.** The orb parks on one of six perches and remembers the position per hand (left or right) from Profile. It is never inside the tab bar, never over the primary action, and never more than one per screen.
- **Size.** 56px parked, 60px on onboarding, 46px in a sheet header while listening, 42px while working, 36px in the deliver tray, 28px as the avatar in a conversation. In VIDYA Live it grows to 164px while listening and 118px while working or speaking.
- **On the camera.** On the scanner's dark ground the orb keeps its colour and gains a milk halo (`shadow-orb-camera`).

## Spoken output

- VIDYA speaks in the teacher's chosen language and register. Calls to parents are warm, short and blame-free ("Warm, short, no blame. Ask before you advise.").
- Read-aloud uses the deliver tray's "Read aloud · To the class".
- Text written for speech avoids symbols, abbreviations and the middle dot. Write numbers as they are spoken in that language.
