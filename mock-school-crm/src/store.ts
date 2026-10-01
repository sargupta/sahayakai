/**
 * Persistence: the whole CRM lives in memory and is mirrored to one JSON file
 * (default data/state.json, gitignored). Writes are atomic (write a temp file
 * in the same directory, then rename over the target) and serialised, so a
 * crash mid-write never leaves a half-written state file.
 */

import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateState, type GenerateOptions } from './generate';
import { STATE_VERSION, type CrmState } from './state';

export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_STATE_PATH = path.join(PACKAGE_ROOT, 'data', 'state.json');

let tempCounter = 0;

export async function saveStateAtomic(file: string, state: CrmState): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true });
    tempCounter += 1;
    const temp = `${file}.tmp-${process.pid}-${tempCounter}`;
    try {
        await writeFile(temp, JSON.stringify(state), 'utf8');
        await rename(temp, file);
    } catch (err) {
        await unlink(temp).catch(() => undefined);
        throw err;
    }
}

export async function loadState(file: string): Promise<CrmState> {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as CrmState;
    if (parsed.version !== STATE_VERSION) {
        throw new Error(`${file} has state version ${String(parsed.version)}, expected ${STATE_VERSION}; run \`npm run seed\``);
    }
    return parsed;
}

/** Loads the state file, or generates the seed data and writes it if the file is missing. */
export async function loadOrCreateState(file: string, options: GenerateOptions = {}): Promise<{ state: CrmState; created: boolean }> {
    if (existsSync(file)) return { state: await loadState(file), created: false };
    const state = generateState(options);
    await saveStateAtomic(file, state);
    return { state, created: true };
}

/** Serialises saves: each call waits for the previous one, and a failure does not wedge the queue. */
export function createSaver(file: string | null, getState: () => CrmState): () => Promise<void> {
    let chain: Promise<void> = Promise.resolve();
    return () => {
        if (!file) return Promise.resolve();
        const next = chain.then(() => saveStateAtomic(file, getState()));
        chain = next.catch((err: unknown) => {
            console.error(`[mock-school-crm] failed to save state: ${String(err)}`);
        });
        return next;
    };
}
