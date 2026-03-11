import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { initializeFirebase } from '@/lib/firebase-admin';
import { generateCacheKey, getCachedAudio, setCachedAudio } from '@/lib/cache';
import { checkServerRateLimit } from '@/lib/server-safety';
import { UsageTracker } from '@/lib/usage-tracker';

// Cache the GCP access token for its full lifetime (1 hour).
// Re-fetching on every request added 100–300 ms of latency per TTS call.
let _tokenCache: { value: string; expiresAt: number } | null = null;

async function getGoogleAccessToken(): Promise<string> {
    // Reuse until 60 s before expiry to handle clock skew
    if (_tokenCache && Date.now() < _tokenCache.expiresAt - 60_000) {
        return _tokenCache.value;
    }
    await initializeFirebase();
    const credential = admin.app().options.credential;
    if (!credential) throw new Error("Firebase Admin credential missing");
    const token = await (credential as any).getAccessToken();
    // Google access tokens are valid for 3600 s; cache for 55 min
    _tokenCache = { value: token.access_token as string, expiresAt: Date.now() + 55 * 60 * 1000 };
    return _tokenCache.value;
}

/**
 * Detect BCP-47 language code from Unicode script ranges in the text.
 * NOTE: Bengali upper bound is \u09FF (not \u0A0F which bleeds into Gurmukhi).
 */
function detectLangCode(text: string): string {
    if (/[\u0900-\u097F]/.test(text)) return 'hi-IN'; // Devanagari (Hindi, Marathi, etc.)
    if (/[\u0980-\u09FF]/.test(text)) return 'bn-IN'; // Bengali
    if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN'; // Tamil
    if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN'; // Telugu
    if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN'; // Kannada
    if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN'; // Malayalam
    if (/[\u0A80-\u0AFF]/.test(text)) return 'gu-IN'; // Gujarati
    if (/[\u0A00-\u0A7F]/.test(text)) return 'pa-IN'; // Gurmukhi (Punjabi)
    return 'en-IN';
}

/**
 * Select the best available Google Cloud TTS voice for each language.
 *
 * Tier priority: Neural2 > Wavenet > Standard
 * All voices are female (-A or -C) for a consistent, warm VIDYA persona.
 *
 * Telugu note: Google has no Wavenet/Neural2 for te-IN — Standard-A is the only option.
 */
function getVoiceName(langCode: string): string {
    const voiceMap: Record<string, string> = {
        'hi-IN': 'hi-IN-Neural2-A', // Neural2, female (was -D male)
        'en-IN': 'en-IN-Neural2-A', // Neural2, female (was -D male)
        'bn-IN': 'bn-IN-Wavenet-A', // Wavenet, female
        'ta-IN': 'ta-IN-Wavenet-A', // Wavenet, female
        'kn-IN': 'kn-IN-Wavenet-A', // Wavenet, female
        'ml-IN': 'ml-IN-Wavenet-A', // Wavenet, female
        'gu-IN': 'gu-IN-Wavenet-A', // Wavenet, female
        'pa-IN': 'pa-IN-Wavenet-A', // Wavenet, female
        'te-IN': 'te-IN-Standard-A', // Standard, female — no Wavenet/Neural2 available for Telugu
    };
    return voiceMap[langCode] || `${langCode}-Standard-A`;
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

const VALID_LANG_CODE = /^[a-z]{2}-[A-Z]{2}$/;

export async function POST(req: NextRequest) {
    try {
        const uid = req.headers.get('x-user-id');
        if (!uid) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await checkServerRateLimit(uid);

        const { text, targetLang } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        const cleanText = stripMarkdown(text);

        // Use caller-provided language code when valid; otherwise detect from script.
        // This lets callers override for Romanised/Hinglish text where detection fails.
        const langCode = (targetLang && VALID_LANG_CODE.test(targetLang))
            ? targetLang
            : detectLangCode(cleanText);

        const voiceName = getVoiceName(langCode);

        const cacheKey = generateCacheKey(cleanText, voiceName);
        const cached = getCachedAudio(cacheKey);
        if (cached) {
            console.log(`[TTS] Cache Hit for: ${voiceName}`);
            UsageTracker.trackTTS(uid, cleanText.length, true);
            return NextResponse.json({ audioContent: cached });
        }

        console.log(`[TTS] Inference required for: ${voiceName}`);
        UsageTracker.trackTTS(uid, cleanText.length, false);
        const token = await getGoogleAccessToken();

        const response = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                input: { text: cleanText },
                voice: { languageCode: langCode, name: voiceName },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: 0.92,  // Slightly slower than default 1.0 — clearer for non-native listeners
                    pitch: 0,
                    effectsProfileId: ['headphone-class-device'], // Better audio profile
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[TTS] GCP Error:", errorText);
            return NextResponse.json({ error: 'TTS Synthesis Failed' }, { status: response.status });
        }

        const data = await response.json();
        if (data.audioContent) {
            setCachedAudio(cacheKey, data.audioContent);
        }

        return NextResponse.json({ audioContent: data.audioContent });

    } catch (error: any) {
        if (error.message?.includes('Rate limit exceeded')) {
            return NextResponse.json({ error: error.message }, { status: 429 });
        }
        console.error('[TTS] Server Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
