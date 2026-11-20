/**
 * Class gate: deployed SamparkAI keeps campaign audio in Cloud Storage, never on the container's disk.
 *
 * The bug: the only AudioStore wrote clips to `.sampark-audio` on local disk. On Cloud Run that is
 * per instance, in memory, split across regions and lost on restart (and not writable by the
 * production image's user): a Practice campaign rendered on one instance had no audio on another.
 * The store is now chosen in ONE place (createAudioStoreFromEnv): Cloud Storage whenever
 * SAMPARK_AUDIO_BUCKET is set, which the production config always sets (cloudbuild-flags.test.ts).
 */
import { createGcsAudioStore, SAMPARK_AUDIO_PREFIX, type AudioBucket } from '@/lib/sampark/speech/gcs-audio-store';

function memoryBucket() {
    const objects = new Map<string, Buffer>();
    const bucket: AudioBucket = {
        file: (name: string) => ({
            save: async (data: Buffer) => {
                objects.set(name, data);
            },
            exists: async () => [objects.has(name)] as [boolean],
            download: async () => [objects.get(name) as Buffer] as [Buffer],
        }),
    };
    return { objects, bucket };
}

describe('Cloud Storage audio store', () => {
    it('round-trips a clip under the private prefix', async () => {
        const { objects, bucket } = memoryBucket();
        const store = createGcsAudioStore(async () => bucket);
        await store.put('abcdef0123', Buffer.from('RIFF'), 'audio/wav');
        expect([...objects.keys()]).toEqual([`${SAMPARK_AUDIO_PREFIX}abcdef0123.wav`]);
        expect(await store.exists('ABCDEF0123')).toBe(true);
        expect(await store.get('abcdef0123')).toEqual({ audio: Buffer.from('RIFF'), mimeType: 'audio/wav' });
    });

    it('refuses or ignores any key that is not a clip key, so a URL cannot reach another object', async () => {
        const { objects, bucket } = memoryBucket();
        const store = createGcsAudioStore(async () => bucket);
        await expect(store.put('../users/x', Buffer.from('x'), 'audio/wav')).rejects.toThrow(/Invalid audio key/);
        expect(await store.get('../../etc/passwd')).toBeNull();
        expect(await store.exists('zz')).toBe(false);
        expect(objects.size).toBe(0);
    });
});

describe('one place picks the store', () => {
    it('the speech deps and the read-only routes both use createAudioStoreFromEnv', () => {
        const src: string = require('node:fs').readFileSync(require('node:path').join(process.cwd(), 'src/lib/sampark/repo/factory.ts'), 'utf8');
        expect(src).not.toMatch(/createLocalAudioStore/);
        expect((src.match(/createAudioStoreFromEnv\(\)/g) ?? []).length).toBe(2);
    });
});
