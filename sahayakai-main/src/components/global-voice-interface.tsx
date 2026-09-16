
"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { MicrophoneInput } from "@/components/microphone-input";

/**
 * Home Voice Interface — available to both authenticated and unauthenticated users.
 *
 * For unauthenticated visitors on the landing page: stores the transcript in
 * sessionStorage so the dashboard can auto-fill it after sign-in completes.
 * For authenticated users: passes through to the normal dashboard path.
 *
 * The stored transcript key is consumed by DashboardHome's effect that checks
 * `sahayakai-voice-intent` when `voice_transcript` is not present in the URL.
 */
const VOICE_INTENT_KEY = "sahayakai-voice-intent";

export function GlobalVoiceInterface() {
    const { user } = useAuth();

    const handleTranscript = (transcript: string) => {
        if (typeof window === "undefined") return;

        if (!user) {
            // Unauthenticated: store transcript for post-auth auto-fill
            try {
                sessionStorage.setItem(VOICE_INTENT_KEY, transcript);
            } catch {
                // storage unavailable — degrade gracefully
            }
            // Navigate with voice_intent flag so app-shell knows to wait for auth
            window.location.href = "/?voice_intent=1";
            return;
        }

        // Authenticated path: normal dashboard auto-submit via URL param
        window.location.href = `/?voice_transcript=${encodeURIComponent(transcript)}`;
    };

    // Clear voice_intent flag on load so it doesn't persist
    useEffect(() => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        if (params.get("voice_intent") === "1") {
            const url = new URL(window.location.href);
            url.searchParams.delete("voice_intent");
            window.history.replaceState({}, "", url.toString());
        }
    }, []);

    return (
        <MicrophoneInput
            onTranscriptChange={handleTranscript}
            isFloating
            label="ಹೇಳಿ (Speak)"
            iconSize="lg"
        />
    );
}
