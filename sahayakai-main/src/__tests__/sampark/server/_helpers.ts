/**
 * Shared builders for the Sampark server/API tests (stream D). Not a test
 * file, so jest only loads it when a test imports it.
 *
 * Instants (IST is the only clock that matters):
 *   MON_11_IST  2026-10-05 11:00 IST (Monday)  = 2026-10-05T05:30:00Z
 *   MON_08_IST  2026-10-05 08:00 IST (Monday)  — before any routine window
 */

import crypto from 'node:crypto';

import type { AudioStore, Clock, SamparkRepo, SpeechSynthesizer, SpeechVerifier } from '@/lib/sampark/ports';
import { buildMulawWav, mulawSamples } from '@/lib/sampark/speech/wav';
import type { VoiceCheckDeps } from '@/lib/sampark/speech/render-job';

export const ORG = 'hillview-demo';
export const ADMIN = 'dev-user-123';
export const MON_11_IST = new Date('2026-10-05T05:30:00Z');
export const MON_08_IST = new Date('2026-10-05T02:30:00Z');

/** Keys the phone module requires. Test-only values. */
export function setPhoneEnv(): void {
    process.env.SAMPARK_PII_KEY = Buffer.alloc(32, 7).toString('base64');
    process.env.SAMPARK_PHONE_PEPPER = 'test-pepper';
}

export interface TestClock extends Clock {
    set(at: Date | string): void;
    advance(ms: number): void;
}

export function testClock(start: Date | string = MON_11_IST): TestClock {
    let t = new Date(start).getTime();
    return {
        now: () => new Date(t),
        set: (at) => {
            t = new Date(at).getTime();
        },
        advance: (ms) => {
            t += ms;
        },
    };
}

// ── CRM wire records (crm/schema.ts) ────────────────────────────────────────

export function crmConsent(status: 'granted' | 'denied' | 'unknown' = 'granted') {
    return { status, recordedAt: '2026-06-01T10:00:00+05:30', method: 'admission_form' as const, noticeVersion: 'dpdp-v1' };
}

export function crmStudent(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id,
        admissionNo: `ADM-${id}`,
        apaarId: null,
        fullName: `Student ${id}`,
        spokenFirstName: { en: 'Asha', hi: 'आशा', bn: 'আশা', ne: 'आशा' },
        grade: 7,
        section: 'B',
        rollNo: 1,
        gender: 'female',
        feeCategory: 'regular',
        boarding: false,
        transportRoute: null,
        sensitiveFlags: [],
        status: 'active',
        guardians: [{ guardianId: `g-${id}`, isPrimary: true, isGuardianOfRecord: true }],
        updatedAt: '2026-09-01T10:00:00+05:30',
        ...overrides,
    };
}

let phoneSeq = 100000000;
export function syntheticPhone(): string {
    phoneSeq += 1;
    return `+915${phoneSeq}`;
}

export function crmGuardian(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id,
        fullName: `Guardian ${id}`,
        relation: 'mother',
        phone: syntheticPhone(),
        preferredLanguage: 'ne',
        consent: { notices: crmConsent('granted'), progress: null, recordedConversation: null, hpcInput: null },
        doNotContact: false,
        synthetic: true,
        updatedAt: '2026-09-01T10:00:00+05:30',
        ...overrides,
    };
}

export const CRM_SCHOOL = {
    id: 'hillview',
    name: 'Hillview Demo School',
    udise: null,
    board: 'CBSE',
    city: 'Siliguri',
    academicYear: '2026-27',
    timezone: 'Asia/Kolkata',
    rubricScale: { id: 'hpc3', labels: ['Beginning', 'Developing', 'Proficient'] },
    holidays: [
        { date: '2026-10-20', name: 'Durga Puja' },
        { date: '2026-10-19', name: 'Durga Puja' },
    ],
};

// ── Recording repo: every write, for PII scans ──────────────────────────────

const WRITE = /^(upsert|create|update|save|append|claim)/;

export function recordingRepo(inner: SamparkRepo): SamparkRepo & { writes: { method: string; args: unknown[] }[] } {
    const writes: { method: string; args: unknown[] }[] = [];
    const proxy = new Proxy(inner, {
        get(target, prop, receiver) {
            if (prop === 'writes') return writes;
            const value = Reflect.get(target, prop, receiver);
            if (typeof value !== 'function') return value;
            return (...args: unknown[]) => {
                if (typeof prop === 'string' && WRITE.test(prop)) writes.push({ method: prop, args });
                return (value as (...a: unknown[]) => unknown).apply(target, args);
            };
        },
    });
    return proxy as SamparkRepo & { writes: { method: string; args: unknown[] }[] };
}

// ── Fake speech ─────────────────────────────────────────────────────────────

const SILENCE = 0xff;

/**
 * A synthesizer whose audio CARRIES its text (UTF-8 never contains 0xff, the
 * μ-law silence byte), so the fake verifier can "transcribe" it exactly —
 * including after the render job prepends lead-in silence.
 */
export function fakeSpeech(opts: { secondsPerClip?: number; mishear?: (text: string) => string | null } = {}): {
    synth: SpeechSynthesizer & { calls: number };
    verifier: SpeechVerifier;
    store: AudioStore & { keys(): string[] };
    voiceCheck: VoiceCheckDeps;
    normalise: (wav: Buffer) => Buffer;
} {
    const seconds = opts.secondsPerClip ?? 2;
    const synth = {
        calls: 0,
        async synthesize(req: { text: string }) {
            synth.calls += 1;
            const text = Buffer.from(req.text, 'utf8');
            const total = Math.max(text.length, Math.round(seconds * 8000));
            const samples = Buffer.concat([text, Buffer.alloc(total - text.length, SILENCE)]);
            return { audio: buildMulawWav(samples), mimeType: 'audio/wav' as const, durationSeconds: total / 8000 };
        },
    };
    const verifier: SpeechVerifier = {
        async transcribe(req) {
            const samples = mulawSamples(req.audio);
            let start = 0;
            let end = samples.length;
            while (start < end && samples[start] === SILENCE) start++;
            while (end > start && samples[end - 1] === SILENCE) end--;
            const text = samples.subarray(start, end).toString('utf8');
            const misheard = opts.mishear?.(text);
            return { transcript: misheard ?? text, confidence: 0.99 };
        },
    };
    const blobs = new Map<string, { audio: Buffer; mimeType: string }>();
    const store = {
        async put(key: string, audio: Buffer, mimeType: string) {
            blobs.set(key, { audio: Buffer.from(audio), mimeType });
        },
        async get(key: string) {
            return blobs.get(key) ?? null;
        },
        async exists(key: string) {
            return blobs.has(key);
        },
        keys: () => [...blobs.keys()],
    };
    // The hard-word probe: its own perfect voice and two recognisers, so synth.calls counts only
    // campaign clips. Audio here is text bytes, so loudness normalisation is identity.
    const probeSynth: SpeechSynthesizer = {
        async synthesize(req) {
            return { audio: buildMulawWav(Buffer.from(req.text, 'utf8')), mimeType: 'audio/wav' as const, durationSeconds: 1 };
        },
    };
    const hear = (): SpeechVerifier => ({
        async transcribe(req) {
            return { transcript: mulawSamples(req.audio).toString('utf8'), confidence: 1 };
        },
    });
    const voiceCheck: VoiceCheckDeps = {
        synth: probeSynth,
        primary: { name: 'fake-primary', verifier: hear() },
        secondaryFor: () => ({ name: 'fake-secondary', verifier: hear() }),
    };
    return { synth, verifier, store, voiceCheck, normalise: (wav: Buffer) => wav };
}

// ── Fake Firestore for the org-admin rule (organizations / members / users) ─

export interface FakeOrg {
    name: string;
    adminUserId: string;
    isDemoData?: boolean;
    members?: Record<string, { userId: string; role: string }>;
}

export function fakeOrgDb(orgs: Record<string, FakeOrg>, users: Record<string, Record<string, unknown>> = {}) {
    const snap = (id: string, data: Record<string, unknown> | undefined) => ({ id, exists: !!data, data: () => data });
    return {
        collection(name: string) {
            if (name === 'organizations') {
                return {
                    doc: (orgId: string) => ({
                        get: async () => {
                            const o = orgs[orgId];
                            return snap(orgId, o ? { name: o.name, adminUserId: o.adminUserId, isDemoData: o.isDemoData } : undefined);
                        },
                        collection: () => ({
                            doc: (uid: string) => ({ get: async () => snap(uid, orgs[orgId]?.members?.[uid]) }),
                        }),
                    }),
                    where: (_field: string, _op: string, value: string) => ({
                        limit: () => ({
                            get: async () => {
                                const docs = Object.entries(orgs)
                                    .filter(([, o]) => o.adminUserId === value)
                                    .map(([id, o]) => snap(id, { name: o.name, adminUserId: o.adminUserId }));
                                return { docs, empty: docs.length === 0 };
                            },
                        }),
                    }),
                };
            }
            if (name === 'users') {
                return { doc: (uid: string) => ({ get: async () => snap(uid, users[uid]) }) };
            }
            throw new Error(`fakeOrgDb: unexpected collection ${name}`);
        },
    };
}

export function randomId(): string {
    return crypto.randomUUID();
}
