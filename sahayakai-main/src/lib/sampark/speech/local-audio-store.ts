/**
 * Local-filesystem AudioStore for development (SAMPARK_AUDIO_DIR, default
 * `.sampark-audio`, gitignored). GCS replaces it later behind the same port.
 *
 * Keys are clip keys (lower-case hex). Anything else is refused on write and
 * treated as absent on read, so a key from a URL can never escape the
 * directory. Writes are atomic (temp file + rename), so a reader never sees a
 * half-written clip.
 */

import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { AudioStore } from '@/lib/sampark/ports';

const KEY = /^[a-f0-9]{8,128}$/;

const EXT_BY_MIME: Record<string, string> = { 'audio/wav': '.wav' };
const MIME_BY_EXT: Record<string, string> = { '.wav': 'audio/wav', '.bin': 'application/octet-stream' };

function sanitiseKey(key: string): string | null {
    const k = String(key ?? '').toLowerCase();
    return KEY.test(k) ? k : null;
}

export function createLocalAudioStore(dir: string): AudioStore {
    const root = path.resolve(dir);

    async function locate(key: string): Promise<{ file: string; mimeType: string } | null> {
        const k = sanitiseKey(key);
        if (!k) return null;
        for (const [ext, mimeType] of Object.entries(MIME_BY_EXT)) {
            const file = path.join(root, `${k}${ext}`);
            try {
                await fs.access(file);
                return { file, mimeType };
            } catch {
                // try the next extension
            }
        }
        return null;
    }

    return {
        async put(key, audio, mimeType) {
            const k = sanitiseKey(key);
            if (!k) throw new Error(`Invalid audio key: must be lower-case hex`);
            await fs.mkdir(root, { recursive: true });
            const file = path.join(root, `${k}${EXT_BY_MIME[mimeType] ?? '.bin'}`);
            const tmp = `${file}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
            await fs.writeFile(tmp, audio);
            await fs.rename(tmp, file);
        },
        async get(key) {
            const found = await locate(key);
            if (!found) return null;
            return { audio: await fs.readFile(found.file), mimeType: found.mimeType };
        },
        async exists(key) {
            return (await locate(key)) !== null;
        },
    };
}
