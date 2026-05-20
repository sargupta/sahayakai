# Plan: stop re-prompting mic permission within a VIDYA session

**Status:** drafted 2026-05-20 by a parallel session. Not implemented here
because `src/components/microphone-input.tsx` is actively being edited
on branch `fix/vidya-conversation-quality-on-develop`. Pick this up
when that branch lands, OR fold into that branch directly.

## Context

Teacher reported: *"VIDYA is always asking for permission to use
microphone. Once I have allowed, it should be allowed for that
particular session until I discontinue the session."*

The browser caches `getUserMedia` permission grants per origin, so the
native permission prompt should fire **once** per origin and never
again unless the user revokes. If the user actually sees a re-prompt
on every mic tap, exactly one of these is true:

1. **Stream-stop pattern destroys the cache hint.** Current code in
   `src/components/microphone-input.tsx` calls `getUserMedia()` on
   every recording (line 364) and explicitly stops every track when
   the recording ends (lines 217, 253, 426, 472, 533). Some browsers
   (iOS Safari in particular, certain Chrome PWA contexts) treat a
   fully-stopped MediaStream as "permission used, now released" and
   re-prompt on the next call. Even when no native prompt fires,
   the **getUserMedia call itself can take 200-800ms** to re-establish
   the audio pipeline, which the teacher perceives as a "permission
   request" delay.
2. **PWA scope mismatch.** If the teacher installed the PWA after
   granting permission to the web URL, the installed app counts as a
   different origin and re-asks.
3. **Browser policy is "Ask each time".** Some teachers' Android
   browsers (especially in-app webviews launched from WhatsApp /
   sharing) default to per-use permission.

The fix below addresses cause #1 and degrades gracefully for #2 and #3.

## What to change

### File: `src/components/microphone-input.tsx`

**One MediaStream per session, not per recording.** Today's flow:

```
mic tap → getUserMedia → record → stop tracks → release stream
mic tap → getUserMedia → record → stop tracks → release stream  ← re-prompts on iOS
mic tap → getUserMedia → record → stop tracks → release stream
```

After the fix:

```
mic tap (first) → getUserMedia → cache stream in ref → record → pause recorder, keep stream
mic tap (next)  → reuse cached stream → record → pause recorder, keep stream
session-end / unmount → release stream tracks
```

Concrete edits:

1. **Lift `streamRef` lifetime to the component.** Today it is cleared
   on every `onstop`. Change the cleanup to STOP the MediaRecorder only,
   leaving `streamRef.current` alive:
   ```ts
   // BEFORE — at line ~426 (inside onstop)
   stream.getTracks().forEach(track => track.stop());
   // AFTER
   // intentionally NOT stopping tracks here — the stream is reused
   // for the next recording in this session. Released on unmount only.
   ```
   Apply the same change at lines 217, 253, 472, 533.

2. **Reuse stream on subsequent recordings.** In `startRecording`
   (around line 350), check `streamRef.current` BEFORE calling
   `getUserMedia`:
   ```ts
   let stream = streamRef.current;
   if (!stream || !stream.active || stream.getAudioTracks().every(t => t.readyState !== 'live')) {
       stream = await navigator.mediaDevices.getUserMedia({
           audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: false },
       });
       streamRef.current = stream;
   }
   ```
   This guard handles: (a) first call, (b) cached stream still alive,
   (c) cached stream silently revoked by the browser (rare; fallback
   to a fresh request).

3. **One-time cleanup on unmount.** Add a `useEffect` cleanup that
   stops tracks only when the component truly unmounts:
   ```ts
   useEffect(() => {
       return () => {
           streamRef.current?.getTracks().forEach(t => t.stop());
           streamRef.current = null;
       };
   }, []);
   ```

4. **Recreate MediaRecorder per recording, but keep the stream.**
   `MediaRecorder` does not safely restart after `stop()`. Continue
   `new MediaRecorder(stream, { mimeType })` per recording — that is
   cheap; the costly part is the stream acquisition, which is now
   amortised.

### Optional companion: a tiny `useMicPermission` hook (new file)

`src/hooks/use-mic-permission.ts` — wraps
`navigator.permissions.query({ name: 'microphone' })` so the UI can
render a "tap to enable mic" affordance the FIRST time. Reduces the
"surprise prompt" UX where the dialog appears mid-conversation. Pure
addition, no existing-file edits. Skip if the prompt is already
front-and-centre in onboarding.

## Verification

1. **Manual on Chrome desktop:** Grant mic, record 3 times in a row.
   No native prompt after the first one. Network tab should show only
   one `getUserMedia` resolution.
2. **Manual on iOS Safari** (the worst case): same — single prompt
   per session, no further prompts on subsequent recordings within
   the same tab.
3. **Manual on Android Chrome PWA installed**: same.
4. **Jest:** add a render+ref test asserting `streamRef.current`
   survives `onstop`. Mock `navigator.mediaDevices.getUserMedia` and
   verify it is called exactly once across 3 record-stop cycles.

## Risk / rollback

- Holding a MediaStream open in the background is a **privacy signal**
  in some browsers (Chrome shows the red dot in the tab). Document
  in the orb that the mic indicator stays on for the conversation.
  If that is unacceptable, fall back to the current per-recording
  pattern and accept the re-prompt cost.
- If the cached stream goes stale (e.g. user unplugs USB mic mid-
  session), `stream.active` returns true but no audio is captured.
  Mitigated by the `readyState !== 'live'` check in step 2 above.

## Why not in this commit

`fix/vidya-conversation-quality-on-develop` is actively editing
`microphone-input.tsx` (per `git log -1 514d33928 --stat`). Concurrent
edits would create a merge conflict before either branch could land.
Wait for that branch to merge, then apply the plumbing above as a
follow-up PR titled `fix(vidya): persistent mic stream per session`.
