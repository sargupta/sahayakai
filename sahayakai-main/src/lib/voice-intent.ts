/**
 * Voice-intent handoff shared by every entry mic on the home page.
 *
 * GlobalVoiceInterface (the fixed floating mic) and the hero VIDYA orb
 * must both deliver a recognised transcript through the SAME channel:
 *
 *   unauthenticated → stash the transcript in sessionStorage so the
 *                     dashboard can auto-fill it after sign-in, then
 *                     bounce to `/?voice_intent=1` (app-shell waits
 *                     for auth and forwards the stored intent).
 *   authenticated   → normal dashboard auto-submit via URL param.
 *
 * The stored key is consumed by DashboardHome's effect that checks
 * `sahayakai-voice-intent` when `voice_transcript` is absent.
 */

export const VOICE_INTENT_KEY = "sahayakai-voice-intent";

export function redirectWithVoiceIntent(transcript: string, isAuthed: boolean): void {
  if (typeof window === "undefined") return;

  if (!isAuthed) {
    try {
      sessionStorage.setItem(VOICE_INTENT_KEY, transcript);
    } catch {
      // storage unavailable — degrade gracefully
    }
    window.location.href = "/?voice_intent=1";
    return;
  }

  window.location.href = `/?voice_transcript=${encodeURIComponent(transcript)}`;
}