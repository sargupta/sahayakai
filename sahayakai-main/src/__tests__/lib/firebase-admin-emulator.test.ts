/** @jest-environment node */
/**
 * Development-only Firestore-emulator path of initializeFirebase().
 *
 * CLASS GATE: with NODE_ENV=development and FIRESTORE_EMULATOR_HOST set, Firebase Admin is
 * initialised WITHOUT credentials — it never reads FIREBASE_SERVICE_ACCOUNT_KEY and never asks
 * Secret Manager for it — and never with the production project id. Outside that exact case
 * (production, or no emulator host) the existing credential path is unchanged.
 */

const initializeApp = jest.fn();
const cert = jest.fn(() => ({ kind: 'cert' }));
const apps: unknown[] = [];
jest.mock('firebase-admin', () => ({ apps, initializeApp: (...a: unknown[]) => { apps.push({}); return initializeApp(...a); }, credential: { cert } }));
jest.mock('firebase-admin/firestore', () => ({ getFirestore: jest.fn() }));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
jest.mock('firebase-admin/storage', () => ({ getStorage: jest.fn() }));
const getSecret = jest.fn(async () => { throw new Error('Secret Manager must not be called'); });
jest.mock('@/lib/secrets', () => ({ getSecret: (...a: unknown[]) => getSecret(...(a as [])) }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const saved = { ...process.env };

async function load() {
    let mod!: typeof import('@/lib/firebase-admin');
    jest.isolateModules(() => {
        // jest.setup stubs '@/lib/firebase-admin' globally; this test needs the real initializer.
        mod = jest.requireActual('@/lib/firebase-admin');
    });
    return mod;
}

beforeEach(() => {
    initializeApp.mockClear();
    cert.mockClear();
    getSecret.mockClear();
    apps.length = 0;
    process.env = { ...saved };
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    delete process.env.GCLOUD_PROJECT;
    delete process.env.FIRESTORE_EMULATOR_HOST;
});
afterAll(() => {
    process.env = saved;
});

describe('emulatorAdminOptions', () => {
    it('only for development with an explicit local emulator host', async () => {
        const { emulatorAdminOptions } = await load();
        expect(emulatorAdminOptions({ NODE_ENV: 'development', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' })).toEqual({ projectId: 'demo-sahayakai' });
        expect(emulatorAdminOptions({ NODE_ENV: 'development', FIRESTORE_EMULATOR_HOST: 'localhost:8080', GCLOUD_PROJECT: 'demo-x' })).toEqual({ projectId: 'demo-x' });
        expect(emulatorAdminOptions({ NODE_ENV: 'development' })).toBeNull();
        expect(emulatorAdminOptions({ NODE_ENV: 'production', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' })).toBeNull();
        expect(emulatorAdminOptions({ NODE_ENV: 'test', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' })).toBeNull();
        expect(() => emulatorAdminOptions({ NODE_ENV: 'development', FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com:443' })).toThrow(/local address/);
    });
    it('never defaults to the production project id', async () => {
        const { emulatorAdminOptions } = await load();
        const opts = emulatorAdminOptions({ NODE_ENV: 'development', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'sahayakai-b4248' });
        expect(opts?.projectId).toBe('demo-sahayakai');
    });
});

describe('initializeFirebase', () => {
    it('emulator path: no service account, no Secret Manager, no credential', async () => {
        (process.env as Record<string, string>).NODE_ENV = 'development';
        process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
        const { initializeFirebase } = await load();
        await initializeFirebase();
        expect(getSecret).not.toHaveBeenCalled();
        expect(cert).not.toHaveBeenCalled();
        expect(initializeApp).toHaveBeenCalledWith({ projectId: 'demo-sahayakai' });
    });

    it('a non-local emulator host is refused, not initialised', async () => {
        (process.env as Record<string, string>).NODE_ENV = 'development';
        process.env.FIRESTORE_EMULATOR_HOST = '10.0.0.5:8080';
        const { initializeFirebase } = await load();
        await expect(initializeFirebase()).rejects.toThrow(/local address/);
        expect(initializeApp).not.toHaveBeenCalled();
        expect(getSecret).not.toHaveBeenCalled();
    });

    it('production is unchanged: an emulator host does not skip the credential path', async () => {
        (process.env as Record<string, string>).NODE_ENV = 'production';
        process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
        const { initializeFirebase } = await load();
        await expect(initializeFirebase()).rejects.toThrow(/Firebase Init Failed/);
        expect(getSecret).toHaveBeenCalledWith('FIREBASE_SERVICE_ACCOUNT_KEY');
        expect(initializeApp).not.toHaveBeenCalled();
    });

    it('development without an emulator host is unchanged (credential path)', async () => {
        (process.env as Record<string, string>).NODE_ENV = 'development';
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({ project_id: 'p', client_email: 'x@p.iam.gserviceaccount.com', private_key: 'k' });
        process.env.GOOGLE_GENAI_API_KEY = 'not-a-real-key';
        const { initializeFirebase } = await load();
        await initializeFirebase();
        expect(cert).toHaveBeenCalled();
        expect(initializeApp).toHaveBeenCalledWith(expect.objectContaining({ credential: { kind: 'cert' } }));
    });
});
