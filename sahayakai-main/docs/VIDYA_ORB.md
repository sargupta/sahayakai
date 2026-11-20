# VIDYA orb (web)

Status (28 Oct 2026): the floating VIDYA mic now has a 3D sphere for a face. The orb's
state comes from real voice signals. Tested in jsdom and checked in the local dev
server.

## History: what existed

- `src/components/omni-orb.tsx` (the floating, draggable VIDYA assistant, mounted in
  `app-shell.tsx`) drew a **flat gradient circle** with a mic icon, built from
  `MicrophoneInput`.
- No 3D renderer was ever part of the web app; git history across all branches has no
  three.js or WebGL code for it.
- The "VIDYA orb" with resting / listening / working / ready states in commit
  `bb1e3d8d` is the **Flutter mobile** app's (`VidyaOrb`), not the web app's.

## Rendering

`src/components/vidya/vidya-sphere.tsx` draws one WebGL fragment shader on a canvas the
size of the mic button. No 3D library is used. The shader produces:
- a lit sphere (diffuse, specular, fresnel rim);
- a slowly turning noise swirl;
- a soft outer glow.

Colours are read from the design tokens (`--saffron-*`, `--indigo-*`, `--leaf-*`,
`--ink-500`, `--destructive`), so the orb follows the theme.

| State | Look | Real source |
|---|---|---|
| idle | saffron, slow breathing | nothing else applies |
| listening | brighter, rippling | `MicrophoneInput` status `recording` |
| thinking | indigo swirl | mic `processing` / `initializing` (transcribing), or the `/api/assistant` request in flight |
| speaking | pulse, green rim | `tts.subscribeSpeaking`: true only while VIDYA's audio plays (cloud audio `playing`→`ended`, or the browser utterance `onstart`→`onend`), and during the mic's spoken greeting |
| error | grey-red, still | the last assistant request failed. Cleared after 4 s |

`deriveOrbState` (`src/components/vidya/orb-state.ts`) fixes the precedence:
error > listening > speaking > thinking > idle.
- Talking over VIDYA shows "listening", because the mic cancels the speech.
- Nothing shows "speaking" unless audio is playing.

## Where it appears

- **Home (signed in):** the big "Speak your topic" mic in `dashboard-home.tsx`.
  - Its states come from the mic's status, the answer being fetched (`isThinking`),
    VIDYA's voice (`useVidyaSpeaking`) and a failed request.
  - The floating orb is hidden on `/`, so this is VIDYA's only orb on Home.
- **Every other signed-in page:** the floating, draggable orb (`omni-orb.tsx`).
- Shared signal hooks: `src/components/vidya/use-vidya-signals.ts`.

## Integration

- `MicrophoneInput` gained two **optional** props:
  - `onStatusChange`, which reports its status;
  - `renderVisual`, which draws the button's face.
- The button, its `aria-label`, the label bubble, recording, transcription and every
  other caller are unchanged.
- `OmniOrb` passes both props. It also announces the state in words through an `sr-only`
  live region ("VIDYA is listening", and so on).
- **Overlap.** The orb sits at `z-[90]`, above the app's `z-50` overlays. While a Radix
  dialog, alert dialog, sheet, menu or select list is open (`useOverlayOpen`), the orb
  becomes transparent, non-interactive and `aria-hidden`. It never covers a dialog's
  buttons or a mobile sheet.
- **Performance and cleanup.**
  - The canvas is at most 2× the device pixel ratio.
  - The animation loop stops while the tab is hidden.
  - On unmount it cancels the frame and deletes the program, shader and buffer, then
    calls `WEBGL_lose_context`.
  - A lost GL context switches to the CSS sphere.
- **Reduced motion.** With reduced motion on, one still frame is drawn per state change
  and the loop never starts. The CSS fallback does not pulse.
- **Without WebGL** (or after a compile failure) the orb is a radial-gradient CSS sphere
  with the same state colours.

## Earlier dev-server error

The "Cannot read properties of undefined (reading 'call')" error seen on port 3000 came
from a stale webpack chunk. Development was serving `/_next/static` with an `immutable`
cache header, so the browser kept old chunks across rebuilds. `next.config.ts` now sends
that header **in production only**. This is a source fix, not cache avoidance; it holds
on any port after a fresh `.next`.

## Tests

`src/__tests__/components/vidya/vidya-orb.test.tsx` covers:
- the state mapping and its precedence;
- the real tts speaking signal (start, end, cancel);
- token colour conversion;
- the WebGL path: it draws, pauses when the tab is hidden and releases the context on
  unmount;
- reduced motion: still frames only, no loop;
- the CSS fallback for every state;
- `MicrophoneInput` keeping its button and label with the orb face;
- the overlay detection.

The existing source-level orb tests still pass.
