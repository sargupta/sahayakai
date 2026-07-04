/**
 * Client helpers for the H8 media proxy (POST /api/media/sign).
 *
 * Private media (voice DMs) is stored as a bare Storage path — client reads
 * on those prefixes are denied by storage.rules, so playback first exchanges
 * the path for a short-lived V4 signed URL through the access-checked sign
 * endpoint. <audio src> cannot carry the Bearer header, which is why the
 * exchange happens over apiFetch and the element gets the signed URL.
 */
import { apiFetch } from './client';

/**
 * True when the stored value is a bare Storage path (new private media)
 * rather than a directly playable URL (legacy download URLs, blob:/data:
 * previews from the offline outbox).
 */
export function isPrivateStoragePath(value: string): boolean {
    return !/^(https?|blob|data):/.test(value);
}

/** Exchange a Storage path for a short-lived signed URL (10-min TTL). */
export async function signMediaPath(path: string, signal?: AbortSignal): Promise<string> {
    const { url } = await apiFetch<{ url: string }>('/api/media/sign', { body: { path }, signal });
    return url;
}
