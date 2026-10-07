/**
 * Where Sampark's data lives, and the fail-closed guard that decides it.
 *
 * CLASS GATE 5 (plan §9 "Environments", §13). Local development loads the
 * production service account, and the preview environment writes to the
 * production Firestore project, so "no writes reach production" cannot rest on
 * someone remembering an environment variable. Outside production the
 * repository REFUSES to start unless it is pointed at:
 *   - the Firestore emulator (FIRESTORE_EMULATOR_HOST), or
 *   - the separate named database `sampark-nonprod` (SAMPARK_FIRESTORE_DATABASE).
 * There is no "I know what I'm doing" override.
 *
 * Tests inject an in-memory repo with setSamparkRepoForTests(); the guard only
 * protects the real Firestore path.
 */

import { getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { initializeFirebase } from '@/lib/firebase-admin';
import { type AudioStore, type Clock, type SamparkRepo, type SpeechSynthesizer, type SpeechVerifier, systemClock } from '@/lib/sampark/ports';
import { FirestoreSamparkRepo } from '@/lib/sampark/repo/firestore';
import type { VoiceCheckDeps } from '@/lib/sampark/speech/render-job';
import type { ParentLanguage } from '@/types/sampark';

export const SAMPARK_NONPROD_DATABASE = 'sampark-nonprod';

type Env = Record<string, string | undefined>;

/**
 * Throws SAMPARK_UNSAFE_ENVIRONMENT unless this process may touch Sampark data.
 * Pure over `env` so the gate test can drive every branch.
 */
export function assertSamparkEnvironmentSafe(env: Env = process.env): void {
    if (env.NODE_ENV === 'production') return;
    if (env.FIRESTORE_EMULATOR_HOST && env.FIRESTORE_EMULATOR_HOST.trim() !== '') return;
    if (env.SAMPARK_FIRESTORE_DATABASE === SAMPARK_NONPROD_DATABASE) return;
    throw new Error(
        'SAMPARK_UNSAFE_ENVIRONMENT: outside production Sampark must use the Firestore emulator ' +
            `(FIRESTORE_EMULATOR_HOST) or the named database '${SAMPARK_NONPROD_DATABASE}' ` +
            '(SAMPARK_FIRESTORE_DATABASE). Refusing to touch the production database.',
    );
}

let repoOverride: SamparkRepo | null = null;
let repoPromise: Promise<SamparkRepo> | null = null;

export async function getSamparkRepo(): Promise<SamparkRepo> {
    if (repoOverride) return repoOverride;
    // Checked on EVERY call, not just the first: a cached repo must never
    // outlive a change that makes the environment unsafe.
    assertSamparkEnvironmentSafe();
    if (!repoPromise) {
        repoPromise = (async () => {
            await initializeFirebase();
            const app = getApp();
            const databaseId = process.env.SAMPARK_FIRESTORE_DATABASE?.trim();
            const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
            return new FirestoreSamparkRepo(db);
        })().catch((err) => {
            repoPromise = null; // allow a retry after a transient init failure
            throw err;
        });
    }
    return repoPromise;
}

/** Test seam: inject a repo (e.g. createMemorySamparkRepo()) or pass null to restore the real one. */
export function setSamparkRepoForTests(repo: SamparkRepo | null): void {
    repoOverride = repo;
    repoPromise = null;
}

// ── Clock ───────────────────────────────────────────────────────────────────

let clockOverride: Clock | null = null;

/**
 * The rehearsal clock lives on globalThis, not in this module: Next bundles every route
 * separately, so a module-level cache would give each route its own clock anchored at its
 * own first request (a call could then "end" before it started).
 */
const DEV_CLOCK_KEY = Symbol.for('sahayakai.sampark.devClock');
type DevClockSlot = { raw: string; clock: Clock };

/**
 * Local rehearsal at any hour: `SAMPARK_DEV_NOW=2026-10-07T11:00:00+05:30` starts this
 * process's Sampark clock at that instant and lets it run forward in real time, so the
 * calling-window rules can be exercised end to end at night. Honoured ONLY outside
 * production AND against the Firestore emulator — never with real data, never in a
 * deployment, whatever else is set. Pure over `env` and `realNow` for the test.
 */
export function devClockFromEnv(env: Env = process.env, realNow: () => number = Date.now): Clock | null {
    const raw = env.SAMPARK_DEV_NOW?.trim();
    if (!raw) return null;
    if (env.NODE_ENV === 'production' || !env.FIRESTORE_EMULATOR_HOST?.trim()) return null;
    const start = Date.parse(raw);
    if (!Number.isFinite(start)) return null;
    const offsetMs = start - realNow();
    return { now: () => new Date(realNow() + offsetMs) };
}

/** The clock routes and jobs use. Tests pin it so window/expiry logic is deterministic. */
export function getSamparkClock(): Clock {
    if (clockOverride) return clockOverride;
    const raw = process.env.SAMPARK_DEV_NOW?.trim() ?? '';
    if (!raw) return systemClock;
    const slots = globalThis as unknown as Record<symbol, DevClockSlot | undefined>;
    let slot = slots[DEV_CLOCK_KEY];
    if (slot?.raw !== raw) {
        slot = { raw, clock: devClockFromEnv() ?? systemClock };
        slots[DEV_CLOCK_KEY] = slot;
    }
    return slot.clock;
}

export function setSamparkClockForTests(clock: Clock | null): void {
    clockOverride = clock;
}

// ── Speech dependencies (stream C adapters) ─────────────────────────────────

export interface SpeechDeps {
    synth: SpeechSynthesizer;
    verifier: SpeechVerifier;
    store: AudioStore;
    /** The hard-word probe's two independent recognisers (render-job.ts). */
    voiceCheck: VoiceCheckDeps;
    /** Loudness normalisation; defaults to normaliseTelephonyWav in the render job. */
    normalise?: (wav: Buffer) => Buffer;
}

let speechOverride: SpeechDeps | null = null;
let speechPromise: Promise<SpeechDeps> | null = null;

/**
 * Loaded lazily so routes that never synthesise (most of them) never pull in
 * the Google auth client.
 */
export async function getSpeechDeps(): Promise<SpeechDeps> {
    if (speechOverride) return speechOverride;
    if (!speechPromise) {
        speechPromise = (async () => {
            const [{ createGoogleSynthesizer, createChirpVerifier }, { createLocalAudioStore }, recognizers] = await Promise.all([
                import('@/lib/sampark/speech/google-speech'),
                import('@/lib/sampark/speech/local-audio-store'),
                import('@/lib/sampark/speech/secondary-recognizers'),
            ]);
            const verifier = createChirpVerifier();
            const sarvam = { name: 'sarvam-saarika', verifier: recognizers.createSarvamVerifier() };
            const chirp3 = { name: 'google-chirp3', verifier: recognizers.createChirp3Verifier() };
            return {
                synth: createGoogleSynthesizer(),
                verifier,
                store: createLocalAudioStore(process.env.SAMPARK_AUDIO_DIR ?? '.sampark-audio'),
                voiceCheck: {
                    primary: { name: 'google-chirp2', verifier },
                    secondaryFor: (language: ParentLanguage) => (recognizers.secondaryRecognizerFor(language) === 'sarvam' ? sarvam : chirp3),
                },
            };
        })().catch((err) => {
            speechPromise = null;
            throw err;
        });
    }
    return speechPromise;
}

export function setSpeechDepsForTests(deps: SpeechDeps | null): void {
    speechOverride = deps;
    speechPromise = null;
    storePromise = null;
}

let storePromise: Promise<AudioStore> | null = null;

/**
 * Just the audio store, for routes that only READ rendered audio (the console preview and the
 * Vobiz `<Play>` fetch). Building the full speech deps would load the Google auth clients on a
 * cold start for nothing — and Vobiz wants the audio within seconds of answering.
 */
export async function getAudioStore(): Promise<AudioStore> {
    if (speechOverride) return speechOverride.store;
    if (!storePromise) {
        storePromise = import('@/lib/sampark/speech/local-audio-store')
            .then(({ createLocalAudioStore }) => createLocalAudioStore(process.env.SAMPARK_AUDIO_DIR ?? '.sampark-audio'))
            .catch((err) => {
                storePromise = null;
                throw err;
            });
    }
    return storePromise;
}
