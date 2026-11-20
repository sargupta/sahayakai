/**
 * Who may use hands-free Live VIDYA, decided in ONE place.
 *
 * `/api/vidya-voice/start-session` (which mints the voice token) and
 * `/api/vidya-voice/eligibility` (which the app asks before showing the Live
 * orb) both call `liveVoiceAccess`, so the client is never told "yes" for a
 * session the server would then refuse. A teacher who is not allowed keeps the
 * tap-to-talk VIDYA instead of a dead "Voice isn't available" orb.
 */

type Env = Record<string, string | undefined>;

export const LIVE_ALLOWLIST_ENV = 'VIDYA_VOICE_LIVE_ALLOWED_UIDS';
const AGENTS_URL_ENV = 'NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL';

export function parseLiveAllowlist(raw: string | undefined): Set<string> {
    if (!raw) return new Set();
    return new Set(
        raw
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0),
    );
}

/** The service that serves the browser's voice socket: the public voice bridge, else the agents URL. */
export function liveVoiceBaseUrl(env: Env = process.env): string | null {
    return env.VIDYA_VOICE_STREAM_BASE_URL?.trim() || env[AGENTS_URL_ENV]?.trim() || null;
}

export type LiveVoiceAccess =
    | { ok: true; baseUrl: string }
    | { ok: false; reason: 'disabled' | 'not_allowlisted' | 'no_base_url' };

/**
 * Live VIDYA for this signed-in uid: the feature flag, the exact-match allowlist
 * (`*` only outside production, as a local convenience), and a voice service URL.
 */
export function liveVoiceAccess(uid: string, env: Env = process.env): LiveVoiceAccess {
    if (env.VIDYA_VOICE_LIVE_ENABLED !== 'true') return { ok: false, reason: 'disabled' };
    const allowlist = parseLiveAllowlist(env[LIVE_ALLOWLIST_ENV]);
    const devWildcard = env.NODE_ENV !== 'production' && allowlist.has('*');
    if (!devWildcard && !allowlist.has(uid)) return { ok: false, reason: 'not_allowlisted' };
    const baseUrl = liveVoiceBaseUrl(env);
    if (!baseUrl) return { ok: false, reason: 'no_base_url' };
    return { ok: true, baseUrl };
}
