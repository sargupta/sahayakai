import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { initializeFirebase } from '@/lib/firebase-admin';
import { generateCacheKey, getCachedAudio, setCachedAudio } from '@/lib/cache';
import { checkServerRateLimit } from '@/lib/server-safety';
import { UsageTracker } from '@/lib/usage-tracker';
import { sarvamTTS, toSarvamLangCode } from '@/lib/sarvam';
import { ensureVoiceQuota, recordVoiceMinutes, estimateTTSMinutes, buildVoiceQuotaSnapshot } from '@/lib/voice-quota-guard';

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
    if (/[\u0B00-\u0B7F]/.test(text)) return 'or-IN'; // Odia (before Tamil — Odia range is \u0B00-\u0B7F)
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

/**
 * Synthesise speech with Google Cloud TTS (used as fallback when Sarvam fails).
 */
async function googleTTS(cleanText: string, langCode: string, voiceName: string): Promise<string> {
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
                speakingRate: 0.92,
                pitch: 0,
                effectsProfileId: ['headphone-class-device'],
            },
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google TTS ${response.status}: ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    if (!data.audioContent) throw new Error('Google TTS returned empty audio');
    return data.audioContent;
}

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
        const langCode = (targetLang && VALID_LANG_CODE.test(targetLang))
            ? targetLang
            : detectLangCode(cleanText);

        // --- Try Sarvam first, fall back to Google ---
        const sarvamLang = toSarvamLangCode(langCode);
        const provider = sarvamLang ? 'sarvam' : 'google';
        const voiceLabel = sarvamLang ? `sarvam:priya:${sarvamLang}` : getVoiceName(langCode);

        const cacheKey = generateCacheKey(cleanText, voiceLabel, provider);
        const cached = getCachedAudio(cacheKey);
        if (cached) {
            console.log(`[TTS] Cache Hit (${provider}): ${voiceLabel}`);
            UsageTracker.trackTTS(uid, cleanText.length, true, provider);
            return NextResponse.json({ audioContent: cached });
        }

        // Voice cloud minute quota check — runs AFTER cache check so cache hits
        // don't burn provider minutes. Free tier (limit=0) is 403'd here.
        const quota = await ensureVoiceQuota(req);
        if (!quota.ok) return quota.response;

        let audioContent: string;

        if (sarvamLang) {
            // Sarvam is available for this language — try it first
            try {
                console.log(`[TTS] Sarvam inference: ${sarvamLang}`);
                const result = await sarvamTTS(cleanText, sarvamLang);
                audioContent = result.audioContent;
                UsageTracker.trackTTS(uid, cleanText.length, false, 'sarvam');
            } catch (sarvamErr: any) {
                // Sarvam failed — fall back to Google
                console.warn(`[TTS] Sarvam failed (${sarvamErr.message}), falling back to Google`);
                const googleVoice = getVoiceName(langCode);
                audioContent = await googleTTS(cleanText, langCode, googleVoice);
                UsageTracker.trackTTS(uid, cleanText.length, false, 'google');
            }
        } else {
            // Language not supported by Sarvam — use Google directly
            console.log(`[TTS] Google inference (no Sarvam for ${langCode}): ${getVoiceName(langCode)}`);
            audioContent = await googleTTS(cleanText, langCode, getVoiceName(langCode));
            UsageTracker.trackTTS(uid, cleanText.length, false, 'google');
        }

        setCachedAudio(cacheKey, audioContent);

        // Provider call succeeded — burn voice quota minutes (fire-and-forget).
        // Cache hits above returned early and cost nothing.
        const billedMinutes = estimateTTSMinutes(cleanText.length);
        if (uid) recordVoiceMinutes(uid, billedMinutes);

        // Soft-cap snapshot for the client. Quota was OK (we passed the
        // ensureVoiceQuota gate), so 'used' here is the pre-call read PLUS
        // the minutes we just billed. Client surfaces warning toasts.
        const voiceQuota = buildVoiceQuotaSnapshot(quota.used + billedMinutes, quota.limit);

        return NextResponse.json({ audioContent, voiceQuota });

    } catch (error: any) {
        if (error.message?.includes('Rate limit exceeded')) {
            return NextResponse.json({ error: error.message }, { status: 429 });
        }
        console.error('[TTS] Server Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
