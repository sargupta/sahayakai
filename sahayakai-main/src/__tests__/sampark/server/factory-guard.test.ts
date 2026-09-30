/** @jest-environment node */
/**
 * CLASS GATE 5 (plan §9 "Environments", §13): outside production the Sampark
 * repository refuses to start unless it is pointed at the Firestore emulator
 * or the named non-production database. Local development loads the
 * production service account, so this refusal is the only thing standing
 * between a dev laptop and production data.
 */

const initializeFirebase = jest.fn(async () => undefined);
const getFirestoreMock = jest.fn((..._args: unknown[]) => ({ __fake: 'firestore' }));

jest.mock('@/lib/firebase-admin', () => ({ initializeFirebase: () => initializeFirebase() }));
jest.mock('firebase-admin/app', () => ({ getApp: () => ({ name: '[DEFAULT]' }) }));
jest.mock('firebase-admin/firestore', () => ({ getFirestore: (...args: unknown[]) => getFirestoreMock(...args) }));

import {
    assertSamparkEnvironmentSafe,
    getSamparkRepo,
    SAMPARK_NONPROD_DATABASE,
    setSamparkRepoForTests,
} from '@/lib/sampark/repo/factory';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';

const ORIGINAL = { ...process.env };

function setEnv(env: Record<string, string | undefined>) {
    for (const k of ['NODE_ENV', 'FIRESTORE_EMULATOR_HOST', 'SAMPARK_FIRESTORE_DATABASE']) delete (process.env as Record<string, string | undefined>)[k];
    Object.assign(process.env, env);
}

afterEach(() => {
    process.env = { ...ORIGINAL };
    setSamparkRepoForTests(null);
    initializeFirebase.mockClear();
    getFirestoreMock.mockClear();
});

describe('assertSamparkEnvironmentSafe (pure)', () => {
    it.each([
        [{ NODE_ENV: 'development' }],
        [{ NODE_ENV: 'test' }],
        [{}],
        [{ NODE_ENV: 'development', FIRESTORE_EMULATOR_HOST: '   ' }],
        [{ NODE_ENV: 'development', SAMPARK_FIRESTORE_DATABASE: '(default)' }],
        [{ NODE_ENV: 'development', SAMPARK_FIRESTORE_DATABASE: 'sampark-prod' }],
    ])('refuses %j', (env) => {
        expect(() => assertSamparkEnvironmentSafe(env)).toThrow(/^SAMPARK_UNSAFE_ENVIRONMENT/);
    });

    it.each([
        [{ NODE_ENV: 'development', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }],
        [{ NODE_ENV: 'test', SAMPARK_FIRESTORE_DATABASE: SAMPARK_NONPROD_DATABASE }],
        [{ NODE_ENV: 'production' }],
    ])('allows %j', (env) => {
        expect(() => assertSamparkEnvironmentSafe(env)).not.toThrow();
    });
});

describe('getSamparkRepo', () => {
    it('throws before touching Firebase when the environment is unsafe', async () => {
        setEnv({ NODE_ENV: 'development' });
        await expect(getSamparkRepo()).rejects.toThrow(/SAMPARK_UNSAFE_ENVIRONMENT/);
        expect(initializeFirebase).not.toHaveBeenCalled();
        expect(getFirestoreMock).not.toHaveBeenCalled();
    });

    it('uses the default database against the emulator', async () => {
        setEnv({ NODE_ENV: 'development', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' });
        const repo = await getSamparkRepo();
        expect(repo).toBeDefined();
        expect(initializeFirebase).toHaveBeenCalled();
        expect(getFirestoreMock).toHaveBeenCalledWith({ name: '[DEFAULT]' });
    });

    it('uses the named database when SAMPARK_FIRESTORE_DATABASE is set', async () => {
        setEnv({ NODE_ENV: 'development', SAMPARK_FIRESTORE_DATABASE: SAMPARK_NONPROD_DATABASE });
        await getSamparkRepo();
        expect(getFirestoreMock).toHaveBeenCalledWith({ name: '[DEFAULT]' }, SAMPARK_NONPROD_DATABASE);
    });

    it('re-checks the guard on every call, even after a repo was cached', async () => {
        setEnv({ NODE_ENV: 'development', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' });
        await getSamparkRepo();
        setEnv({ NODE_ENV: 'development' });
        await expect(getSamparkRepo()).rejects.toThrow(/SAMPARK_UNSAFE_ENVIRONMENT/);
    });

    it('returns an injected test repo without the guard', async () => {
        setEnv({ NODE_ENV: 'development' });
        const memory = createMemorySamparkRepo();
        setSamparkRepoForTests(memory);
        await expect(getSamparkRepo()).resolves.toBe(memory);
    });
});
