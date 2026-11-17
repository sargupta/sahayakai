
"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { MicrophoneInput } from "@/components/microphone-input";
import { redirectWithVoiceIntent } from "@/lib/voice-intent";

/**
 * Home Voice Interface — available to both authenticated and unauthenticated users.
 *
 * For unauthenticated visitors on the landing page: stores the transcript in
 * sessionStorage so the dashboard can auto-fill it after sign-in completes.
 * For authenticated users: passes through to the normal dashboard path.
 *
 * Handoff logic lives in src/lib/voice-intent.ts — it is shared by
 * GlobalVoiceInterface (the fixed floating mic) and the hero VIDYA orb so
 * both entry mics behave identically.
 */
export function GlobalVoiceInterface() {
    const { user } = useAuth();

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
            onTranscriptChange={(transcript) => redirectWithVoiceIntent(transcript, Boolean(user))}
            isFloating
            label="ಹೇಳಿ (Speak)"
            iconSize="lg"
        />
    );
}
