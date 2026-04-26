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

export function stripMarkdown(text: string): string {
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

// In-memory cache for TTS audio to avoid re-fetching the same text
const ttsCache = new Map<string, string>();
const TTS_CACHE_MAX = 50;

// ---- Voice cloud quota soft-cap warning system ----
// The /api/tts response includes a `voiceQuota` snapshot whenever the user
// has a finite cloud-voice limit (Pro = 300/mo, Gold = 1500/mo per teacher).
// Browser-only voice calls (free tier, langs Sarvam doesn't cover) skip the
// API entirely and never trigger warnings.
//
// We dispatch a `sahayakai:voice-quota-warning` CustomEvent on `window` so a
// single global listener (mounted in AppShell) can surface a toast. The
// listener persists "user X warned for threshold T this month" in localStorage
// so the same threshold doesn't spam multiple toasts in a single session.

export type VoiceQuotaWarningLevel = 'warn-80' | 'warn-95';

export interface VoiceQuotaSnapshot {
    used: number;
    limit: number;
    remaining: number;
    warning: 'none' | VoiceQuotaWarningLevel;
}

export interface VoiceQuotaWarningEventDetail {
    level: VoiceQuotaWarningLevel;
    used: number;
    limit: number;
    remaining: number;
}

const VOICE_QUOTA_WARNING_EVENT = 'sahayakai:voice-quota-warning';

function dispatchVoiceQuotaWarning(snapshot: VoiceQuotaSnapshot | null | undefined): void {
    if (typeof window === 'undefined') return;
    if (!snapshot || snapshot.warning === 'none') return;
    const detail: VoiceQuotaWarningEventDetail = {
        level: snapshot.warning,
        used: snapshot.used,
        limit: snapshot.limit,
        remaining: snapshot.remaining,
    };
    window.dispatchEvent(new CustomEvent<VoiceQuotaWarningEventDetail>(VOICE_QUOTA_WARNING_EVENT, { detail }));
}

export const VOICE_QUOTA_WARNING_EVENT_NAME = VOICE_QUOTA_WARNING_EVENT;

export const tts = {
    async speak(text: string, targetLang: string = 'en') {
        if (!text) return;
        this.cancel(); // Cancel any existing audio before speaking
        try {
            // Attach Firebase ID token so middleware can verify identity.
            // Without this, prod middleware returns 401 and the call falls
            // through to the inconsistent browser speechSynthesis fallback.
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            try {
                const { auth } = await import('@/lib/firebase');
                const { getIdToken } = await import('firebase/auth');
                if (auth.currentUser) {
                    const idToken = await getIdToken(auth.currentUser);
                    headers['Authorization'] = `Bearer ${idToken}`;
                }
            } catch {
                // Non-critical — will still attempt the request, middleware will 401
            }

            // Use full text length in key to avoid prefix collisions
            const cacheKey = `${targetLang}:${text.length}:${text.slice(0, 100)}`;
            let audioContent = ttsCache.get(cacheKey);

            if (!audioContent) {
                const response = await fetch('/api/tts', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ text, targetLang }),
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch TTS audio");
                }

                const data = await response.json();
                audioContent = data.audioContent;

                // Surface voice-quota soft-cap warning if the server flagged one.
                // The listener in AppShell dedups via localStorage so only the
                // first cross of each threshold this month shows a toast.
                dispatchVoiceQuotaWarning(data?.voiceQuota);

                // Cache with eviction
                if (ttsCache.size >= TTS_CACHE_MAX) {
                    const firstKey = ttsCache.keys().next().value;
                    if (firstKey !== undefined) ttsCache.delete(firstKey);
                }
                ttsCache.set(cacheKey, audioContent!);
            }

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
