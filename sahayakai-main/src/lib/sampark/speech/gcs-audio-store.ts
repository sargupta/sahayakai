/**
 * Cloud Storage AudioStore for deployed SamparkAI (SAMPARK_AUDIO_BUCKET).
 *
 * The local store writes clips to the container's disk, which on Cloud Run is
 * per instance, in memory, split across two regions and lost on restart (and
 * not writable at all in the production image). Clips live here instead, under
 * `sampark-audio/<key>.<ext>` in a private bucket: storage.rules has no match
 * for that prefix, so no client can read or write it; only the server (Admin
 * SDK) serves clips, through the same routes as before.
 *
 * Keys are clip keys (lower-case hex). Anything else is refused on write and
 * treated as absent on read, exactly like the local store, so a key from a URL
 * can never reach another object.
 */

import type { AudioStore } from '@/lib/sampark/ports';

const KEY = /^[a-f0-9]{8,128}$/;
export const SAMPARK_AUDIO_PREFIX = 'sampark-audio/';

const EXT_BY_MIME: Record<string, string> = { 'audio/wav': '.wav' };
const MIME_BY_EXT: Record<string, string> = { '.wav': 'audio/wav', '.bin': 'application/octet-stream' };

/** The slice of a Cloud Storage bucket this store uses (firebase-admin's Bucket satisfies it). */
export interface AudioBucket {
    file(name: string): {
        save(data: Buffer, options: { contentType: string; resumable: boolean; metadata: { cacheControl: string } }): Promise<unknown>;
        exists(): Promise<[boolean]>;
        download(): Promise<[Buffer]>;
    };
}

function sanitiseKey(key: string): string | null {
    const k = String(key ?? '').toLowerCase();
    return KEY.test(k) ? k : null;
}

export function createGcsAudioStore(getBucket: () => Promise<AudioBucket>): AudioStore {
    async function locate(key: string): Promise<{ name: string; mimeType: string } | null> {
        const k = sanitiseKey(key);
        if (!k) return null;
        const bucket = await getBucket();
        for (const [ext, mimeType] of Object.entries(MIME_BY_EXT)) {
            const name = `${SAMPARK_AUDIO_PREFIX}${k}${ext}`;
            const [exists] = await bucket.file(name).exists();
            if (exists) return { name, mimeType };
        }
        return null;
    }

    return {
        async put(key, audio, mimeType) {
            const k = sanitiseKey(key);
            if (!k) throw new Error('Invalid audio key: must be lower-case hex');
            const bucket = await getBucket();
            // One object write is atomic: a reader sees the old clip or the whole new one.
            await bucket.file(`${SAMPARK_AUDIO_PREFIX}${k}${EXT_BY_MIME[mimeType] ?? '.bin'}`).save(audio, {
                contentType: mimeType,
                resumable: false,
                metadata: { cacheControl: 'private, max-age=0' },
            });
        },
        async get(key) {
            const found = await locate(key);
            if (!found) return null;
            const [audio] = await (await getBucket()).file(found.name).download();
            return { audio, mimeType: found.mimeType };
        },
        async exists(key) {
            return (await locate(key)) !== null;
        },
    };
}

/**
 * The store for this process: Cloud Storage when SAMPARK_AUDIO_BUCKET is set (every deployment),
 * else the local directory (SAMPARK_AUDIO_DIR, development and tests). One place, so the render
 * job that writes clips and the routes that read them always use the same store.
 */
export async function createAudioStoreFromEnv(env: Record<string, string | undefined> = process.env): Promise<AudioStore> {
    const bucketName = env.SAMPARK_AUDIO_BUCKET?.trim();
    if (bucketName) {
        const { getStorageInstance } = await import('@/lib/firebase-admin');
        let bucket: Promise<AudioBucket> | null = null;
        return createGcsAudioStore(() => (bucket ??= getStorageInstance().then((s) => s.bucket(bucketName) as unknown as AudioBucket)));
    }
    const { createLocalAudioStore } = await import('@/lib/sampark/speech/local-audio-store');
    return createLocalAudioStore(env.SAMPARK_AUDIO_DIR ?? '.sampark-audio');
}
