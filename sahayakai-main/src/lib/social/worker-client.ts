import 'server-only';

/**
 * Thin HTTP client for the social-automation workers (baileys, ig).
 * Workers live behind an internal-only shared key — never expose to the browser.
 */

const BAILEYS_URL = process.env.BAILEYS_WORKER_URL ?? 'http://localhost:8081';
const IG_URL = process.env.IG_WORKER_URL ?? 'http://localhost:8082';
const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? '';

async function call<T>(base: string, path: string, init: RequestInit = {}): Promise<T> {
    if (!INTERNAL_KEY) throw new Error('INTERNAL_API_KEY not configured');
    const res = await fetch(`${base}${path}`, {
        ...init,
        headers: {
            'content-type': 'application/json',
            'x-internal-key': INTERNAL_KEY,
            ...(init.headers ?? {}),
        },
        // Workers are internal — short timeout, no Next.js cache.
        cache: 'no-store',
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`worker ${base}${path} ${res.status}: ${body}`);
    }
    return (await res.json()) as T;
}

export const baileysClient = {
    health: () => call<{ ok: boolean; sessions: number }>(BAILEYS_URL, '/health'),
    pair: (teacherUid: string, phoneNumber: string) =>
        call<{ pairingCode: string }>(BAILEYS_URL, '/pair', {
            method: 'POST',
            body: JSON.stringify({ teacherUid, phoneNumber }),
        }),
    status: (teacherUid: string) =>
        call<{ teacherUid: string; state: string }>(BAILEYS_URL, `/status/${teacherUid}`),
    send: (args: {
        teacherUid: string;
        to: string;
        text?: string;
        mediaUrl?: string;
        mediaType?: 'image' | 'audio' | 'document' | 'video';
        caption?: string;
    }) =>
        call<{ ok: boolean; id?: string }>(BAILEYS_URL, '/send', {
            method: 'POST',
            body: JSON.stringify(args),
        }),
    logout: (teacherUid: string) =>
        call<{ ok: boolean }>(BAILEYS_URL, `/logout/${teacherUid}`, { method: 'POST' }),
};

export const igClient = {
    health: () => call<{ ok: boolean }>(IG_URL, '/health'),
    dm: (account: string, to_username: string, text: string) =>
        call<{ ok: boolean }>(IG_URL, '/dm', {
            method: 'POST',
            body: JSON.stringify({ account, to_username, text }),
        }),
    post: (account: string, media_url: string, caption: string, kind: 'photo' | 'reel' | 'story' = 'photo') =>
        call<{ ok: boolean; media_id: string }>(IG_URL, '/post', {
            method: 'POST',
            body: JSON.stringify({ account, media_url, caption, kind }),
        }),
};
