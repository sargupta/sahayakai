
"use client";

import { MicrophoneInput } from "@/components/microphone-input";

export function GlobalVoiceInterface() {
    const handleTranscript = (transcript: string) => {
        // Universal voice handler: Redirect to home with the transcript
        window.location.href = `/?voice_transcript=${encodeURIComponent(transcript)}`;
    };

    return (
        <MicrophoneInput
            onTranscriptChange={handleTranscript}
            isFloating
            label="ಹೇಳಿ (Speak)"
            iconSize="lg"
        />
    );
}
