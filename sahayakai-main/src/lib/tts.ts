export function detectLangCode(text: string): string {
    if (/[\u0900-\u097F]/.test(text)) return 'hi-IN'; // Devanagari (Hindi, Marathi, etc.)
    if (/[\u0980-\u09FF]/.test(text)) return 'bn-IN'; // Bengali — fixed: was \u0A0F, bled into Gurmukhi
    if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN'; // Tamil
    if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN'; // Telugu
    if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN'; // Kannada
    if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN'; // Malayalam
    if (/[\u0A80-\u0AFF]/.test(text)) return 'gu-IN'; // Gujarati
    if (/[\u0A00-\u0A7F]/.test(text)) return 'pa-IN'; // Gurmukhi (Punjabi)
    return 'en-IN';
}

function stripMarkdown(text: string): string {
    return text
        .replace(/```[\s\S]*?```/g, '')           // remove fenced code blocks
        .replace(/`[^`]*`/g, '')                   // remove inline code
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // [text](url) → text (don't read URLs aloud)
        .replace(/#{1,6}\s+/g, '')                 // remove heading markers
        .replace(/^\s*[-*+]\s+/gm, '')             // remove unordered list markers
        .replace(/^\s*\d+\.\s+/gm, '')             // remove ordered list markers
        .replace(/^>\s+/gm, '')                    // remove blockquote markers
        .replace(/[*_~]/g, '')                     // remove bold, italic, strikethrough
        .trim();
}

function speakFallback(text: string, targetLang: string = 'en') {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const cleanText = stripMarkdown(text);
    const langCode = targetLang.length > 2 ? targetLang : detectLangCode(cleanText);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = langCode;
    utterance.rate = 0.9; // Slightly slower for clarity

    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith(langCode.split('-')[0]) && v.name.includes('Google'));
    if (voice) {
        utterance.voice = voice;
    }

    window.speechSynthesis.speak(utterance);
}

let activeAudio: HTMLAudioElement | null = null;
// Resolve callback captured from speak()'s internal Promise so cancel() can unblock it
let activeSpeakResolve: (() => void) | null = null;

export const tts = {
    async speak(text: string, targetLang: string = 'en') {
        if (!text) return;
        this.cancel(); // Cancel any existing audio before speaking
        try {
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, targetLang }),
            });

            if (!response.ok) {
                throw new Error("Failed to fetch TTS audio");
            }

            const { audioContent } = await response.json();
            const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
            activeAudio = audio;

            await new Promise<void>((resolve, reject) => {
                // Capture resolve so cancel() can unblock this await
                activeSpeakResolve = resolve;

                audio.onended = () => {
                    activeAudio = null;
                    activeSpeakResolve = null;
                    resolve();
                };
                audio.onerror = (e) => {
                    activeAudio = null;
                    activeSpeakResolve = null;
                    reject(e);
                };
                audio.play().catch((e) => {
                    activeAudio = null;
                    activeSpeakResolve = null;
                    reject(e);
                });
            });

            activeSpeakResolve = null;

        } catch (e) {
            console.warn("Cloud TTS Failed, using OS Fallback", e);
            speakFallback(text, targetLang);
        }
    },

    cancel() {
        // Resolve the pending speak() Promise first so any awaiter is unblocked
        if (activeSpeakResolve) {
            activeSpeakResolve();
            activeSpeakResolve = null;
        }
        if (activeAudio) {
            activeAudio.pause();
            activeAudio.currentTime = 0;
            activeAudio = null;
        }
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    },

    prime() {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance('');
            utterance.volume = 0;
            window.speechSynthesis.speak(utterance);
        }
        const silentAudio = new Audio('data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq');
        silentAudio.volume = 0;
        silentAudio.play().catch(() => { });
    }
};
