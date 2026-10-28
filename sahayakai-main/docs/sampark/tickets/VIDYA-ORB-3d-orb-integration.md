# VIDYA 3D orb integration and stability

**Type:** feature + reliability · **Area:** SahayakAI · VIDYA · **Status:** implemented locally, awaiting manual test
**Branch:** `feat/sampark-google-calendar-vidya-callbacks` (local only, not pushed)
**Design:** [../../VIDYA_ORB.md](../../VIDYA_ORB.md)

## Problem
The floating VIDYA mic was a flat gradient circle; there was no web 3D orb. Its look did
not reflect what VIDYA was doing. It could also sit on top of dialogs and sheets
(z-90 vs z-50).

## Scope
- A WebGL sphere as the mic button's face, with no new dependency and a CSS fallback.
- States from real signals only:
  - listening: the mic is recording;
  - thinking: transcribing, or the request is in flight;
  - speaking: audio is playing;
  - error: the request failed;
  - idle.
- A screen-reader announcement of the state.
- The orb steps aside while a dialog, sheet, menu or select list is open.
- Reduced motion; the loop pauses when the tab is hidden; GL resources released on
  unmount.
- The existing mic, recording, transcription and assistant behaviour unchanged.

## Acceptance criteria
- [x] The orb renders in the app (WebGL), with the CSS fallback when WebGL is
      unavailable.
- [x] "Speaking" shows only while audio plays (`tts.subscribeSpeaking`).
- [x] Reduced motion draws still frames only.
- [x] Unmount releases the GL context; a hidden tab pauses the loop.
- [x] Hidden while a Radix dialog or menu is open.
- [x] Existing orb tests still pass.
- [ ] **Manual:** speak to VIDYA on a real device and check each state (microphone
      permission needed).
- [ ] **Manual:** frame rate on a low-end Android device.

## Tests
`src/__tests__/components/vidya/vidya-orb.test.tsx` (12) plus the existing
`omni-orb*.test.ts*`.
