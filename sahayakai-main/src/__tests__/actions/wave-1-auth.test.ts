/**
 * Wave 1 security regression test.
 *
 * Every exported server action in the modules covered by Wave 1 must reject
 * calls with no x-user-id header. This catches the future-regression case
 * where someone forgets the requireAuth() gate on a new action.
 *
 * The test deliberately stubs everything below the auth gate — a passing
 * test means the gate fired BEFORE Firestore was even touched.
 */

const mockHeadersMap = new Map<string, string>();
jest.mock('next/headers', () => ({
    headers: () => Promise.resolve(mockHeadersMap),
}));

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => {
        throw new Error('should not reach Firestore — auth must reject first');
    },
    getStorageInstance: async () => {
        throw new Error('should not reach Storage — auth must reject first');
    },
}));

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        getUser:      jest.fn(async () => { throw new Error('should not reach adapter'); }),
        getUsers:     jest.fn(async () => { throw new Error('should not reach adapter'); }),
        getContent:   jest.fn(async () => { throw new Error('should not reach adapter'); }),
        listContent:  jest.fn(async () => { throw new Error('should not reach adapter'); }),
        saveContent:  jest.fn(async () => {}),
        updateUser:   jest.fn(async () => { throw new Error('should not reach adapter'); }),
        serialize:    (x: any) => x,
    },
}));

jest.mock('@/lib/services/certification-service', () => ({
    certificationService: {
        getCertificationsByUser: jest.fn(async () => { throw new Error('should not reach'); }),
        addCertification:        jest.fn(async () => { throw new Error('should not reach'); }),
    },
}));

jest.mock('@/lib/auth-utils', () => ({
    validateAdmin: jest.fn(async () => {}),
}));

jest.mock('@/lib/server-safety', () => ({
    checkServerRateLimit: jest.fn(async () => {}),
}));

jest.mock('@/lib/teacher-activity-tracker', () => ({
    trackTeacherContent: jest.fn(),
}));

jest.mock('@/lib/aggregator', () => ({
    aggregateUserMetrics: jest.fn(async () => {}),
}));

beforeEach(() => {
    mockHeadersMap.clear();
});

const expectUnauthorized = (call: () => Promise<unknown>) =>
    expect(call()).rejects.toThrow(/Unauthorized/i);

// ── notifications.ts ───────────────────────────────────────────────────────
// Migrated to /api/notifications/* (tranche 5). The auth-gate assertions now
// live in src/__tests__/api/notifications/notifications.test.ts (401 per
// route with no x-user-id header).

// ── profile.ts ─────────────────────────────────────────────────────────────
// Migrated to /api/profile/** (tranche 5); service logic now lives in
// src/server/profile.ts with the same requireAuth gates. Route-level 401s
// are asserted in src/__tests__/api/profile/profile-routes-401.test.ts.
import * as profile from '@/server/profile';

describe('profile service — Wave 1 auth gate', () => {
    it('getProfileData', () => expectUnauthorized(() => profile.getProfileData()));
    it('updateProfileAction', () =>
        expectUnauthorized(() => profile.updateProfileAction('uid-1', {})));
    it('markChecklistItemAction', () =>
        expectUnauthorized(() => profile.markChecklistItemAction('uid-1', 'item-1')));
    it('addCertificationAction', () =>
        expectUnauthorized(() => profile.addCertificationAction({ certName: 'Test Cert' })));
});

describe('profile service — cross-user write is forbidden', () => {
    it('updateProfileAction rejects another uid', async () => {
        mockHeadersMap.set('x-user-id', 'caller-uid');
        await expect(profile.updateProfileAction('different-uid', { displayName: 'X' }))
            .rejects.toThrow(/Forbidden/i);
    });
    it('markChecklistItemAction rejects another uid', async () => {
        mockHeadersMap.set('x-user-id', 'caller-uid');
        await expect(profile.markChecklistItemAction('different-uid', 'item-1'))
            .rejects.toThrow(/Forbidden/i);
    });
});

// ── auth.ts ────────────────────────────────────────────────────────────────
// Migrated to /api/account/{sync,profile} (tranche 5); service logic (incl.
// F1-06 / F11-5) now lives in src/server/auth.ts. Route-level 401s are
// asserted in src/__tests__/api/account/account-routes-401.test.ts.
import * as auth from '@/server/auth';

describe('auth service — Wave 1 auth gate', () => {
    it('syncUserAction returns Unauthorized when no session', async () => {
        const result = await auth.syncUserAction({ uid: 'x', email: null, displayName: null, photoURL: null });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Unauthorized/i);
    });
    it('getUserProfileAction returns Unauthorized when no session', async () => {
        const result = await auth.getUserProfileAction();
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Unauthorized/i);
    });
    it('syncUserAction rejects spoofed uid', async () => {
        mockHeadersMap.set('x-user-id', 'caller-uid');
        const result = await auth.syncUserAction({ uid: 'different-uid', email: null, displayName: null, photoURL: null });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Forbidden/i);
    });
});

// ── content.ts ─────────────────────────────────────────────────────────────
// Migrated to /api/content/{library,search,pdf-download,storage-test}
// (tranche 5). The auth-gate assertions (401 before any Firestore/Storage
// touch) now live in src/__tests__/api/content/content-library-routes.test.ts.

// ── telemetry.ts ───────────────────────────────────────────────────────────
// Migrated to POST /api/telemetry (tranche 5); service in
// src/server/telemetry.ts. Route 401 asserted in
// src/__tests__/api/telemetry-route.test.ts (client wrapper converts the
// 401 back to the historic silent-drop result).
import * as telemetry from '@/server/telemetry';

describe('telemetry service — Wave 1 auth gate', () => {
    it('syncTelemetryEvents returns success+0 when unauthenticated (silent drop)', async () => {
        const result = await telemetry.syncTelemetryEvents([{ event: 'test' }]);
        expect(result).toEqual({ success: true, count: 0 });
    });
});

// ── lesson-plan.ts ─────────────────────────────────────────────────────────
// Migrated to /api/lesson-plan/cache (tranche 5). The auth gate (401 on both
// verbs) and the graceful-null client behavior are asserted in
// src/__tests__/api/lesson-plan/lesson-plan-cache-routes.test.ts.

// ── ncert.ts ───────────────────────────────────────────────────────────────
// Migrated to /api/ncert/chapters (tranche 5). The auth gate (401) and the
// graceful-[] client behavior are asserted in
// src/__tests__/api/ncert/ncert-chapters-route.test.ts.
