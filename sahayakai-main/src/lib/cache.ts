import crypto from 'crypto';

interface CacheEntry {
    buffer: string;
    timestamp: number;
}

const TTS_CACHE = new Map<string, CacheEntry>();
const MAX_CACHE_AGE_MS = 1000 * 60 * 60 * 24; // 24 hours
const MAX_CACHE_ITEMS = 500;

export function generateCacheKey(text: string, voiceName: string, provider: string = 'google'): string {
    return crypto.createHash('md5').update(`${text}_${voiceName}_${provider}`).digest('hex');
}

export function getCachedAudio(key: string): string | null {
    const entry = TTS_CACHE.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > MAX_CACHE_AGE_MS) {
        TTS_CACHE.delete(key);
        return null;
    }
    return entry.buffer;
}

export function setCachedAudio(key: string, buffer: string): void {
    if (TTS_CACHE.size >= MAX_CACHE_ITEMS) {
        const firstKey = TTS_CACHE.keys().next().value;
        if (firstKey) TTS_CACHE.delete(firstKey);
    }
    TTS_CACHE.set(key, { buffer, timestamp: Date.now() });
}
