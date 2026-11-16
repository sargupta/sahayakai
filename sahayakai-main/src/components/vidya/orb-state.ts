/**
 * VIDYA's orb state from real signals only (no timers that guess):
 *
 *   error      the last /api/assistant request failed (OmniOrb clears it after 4 s)
 *   listening  the microphone is recording
 *   speaking   VIDYA's audio is playing (tts.subscribeSpeaking), or the mic is
 *              playing its spoken greeting before recording
 *   thinking   the recording is being transcribed, or the reply is awaited
 *   idle       none of the above
 *
 * Earlier rows win: a teacher who starts talking while VIDYA speaks sees "listening"
 * (the mic cancels the speech).
 */

import type { MicStatus } from "@/components/microphone-input";

import type { VidyaOrbState } from "./vidya-sphere";

export function deriveOrbState(s: { failed: boolean; micStatus: MicStatus; speaking: boolean; awaitingReply: boolean }): VidyaOrbState {
    if (s.failed) return "error";
    if (s.micStatus === "recording") return "listening";
    if (s.speaking || s.micStatus === "greeting") return "speaking";
    if (s.micStatus === "processing" || s.micStatus === "initializing" || s.awaitingReply) return "thinking";
    return "idle";
}
