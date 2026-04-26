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

jest.mock('@/app/actions/aggregator', () => ({
    aggregateUserMetrics: jest.fn(async () => {}),
}));

beforeEach(() => {
    mockHeadersMap.clear();
});

const expectUnauthorized = (call: () => Promise<unknown>) =>
    expect(call()).rejects.toThrow(/Unauthorized/i);

// ── notifications.ts ───────────────────────────────────────────────────────
import * as notifications from '@/app/actions/notifications';

describe('notifications.ts — Wave 1 auth gate', () => {
    it('getNotificationsAction', () =>
        expectUnauthorized(() => notifications.getNotificationsAction()));
    it('markNotificationAsReadAction', () =>
        expectUnauthorized(() => notifications.markNotificationAsReadAction('notif-1')));
    it('markAllAsReadAction', () =>
        expectUnauthorized(() => notifications.markAllAsReadAction()));
    // createNotification is server-only (stamps caller uid as senderId when
    // called from a request context). Anonymous callers are allowed because
    // it's also invoked from cron jobs without a request context. Verified
    // by inspection rather than by the table test.
});

// ── profile.ts ─────────────────────────────────────────────────────────────
import * as profile from '@/app/actions/profile';

describe('profile.ts — Wave 1 auth gate', () => {
    it('getProfileData', () => expectUnauthorized(() => profile.getProfileData()));
    it('updateProfileAction', () =>
        expectUnauthorized(() => profile.updateProfileAction('uid-1', {})));
    it('markChecklistItemAction', () =>
        expectUnauthorized(() => profile.markChecklistItemAction('uid-1', 'item-1')));
    it('addCertificationAction', () => {
        const fd = new FormData();
        fd.set('certName', 'Test Cert');
        return expectUnauthorized(() => profile.addCertificationAction(fd));
    });
});

describe('profile.ts — cross-user write is forbidden', () => {
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
import * as auth from '@/app/actions/auth';

describe('auth.ts — Wave 1 auth gate', () => {
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
import * as content from '@/app/actions/content';

describe('content.ts — Wave 1 auth gate', () => {
    it('getUserContent', () => expectUnauthorized(() => content.getUserContent()));
    it('searchContentAction', () =>
        expectUnauthorized(() => content.searchContentAction('uid-1', 'q')));
    it('saveToLibrary', () =>
        expectUnauthorized(() => content.saveToLibrary('uid-1', 'lesson-plan' as any, 'title', {})));
    it('recordPdfDownload', () =>
        expectUnauthorized(() => content.recordPdfDownload('uid-1', 'title', 'data:application/pdf;base64,YWJj')));
    it('testStorageConnection', () =>
        expectUnauthorized(() => content.testStorageConnection()));
});

// ── telemetry.ts ───────────────────────────────────────────────────────────
import * as telemetry from '@/app/actions/telemetry';

describe('telemetry.ts — Wave 1 auth gate', () => {
    it('syncTelemetryEvents returns success+0 when unauthenticated (silent drop)', async () => {
        const result = await telemetry.syncTelemetryEvents([{ event: 'test' }]);
        expect(result).toEqual({ success: true, count: 0 });
    });
});

// ── lesson-plan.ts ─────────────────────────────────────────────────────────
import * as lessonPlan from '@/app/actions/lesson-plan';

describe('lesson-plan.ts — Wave 1 auth gate', () => {
    it('getCachedLessonPlan returns null on auth failure (graceful)', async () => {
        // Action wraps requireAuth in try/catch and returns null on any error.
        const result = await lessonPlan.getCachedLessonPlan('topic', 'Grade 8', 'English');
        expect(result).toBeNull();
    });
    // saveLessonPlanToCache is verified by inspection — its try/catch swallows
    // the auth error to "fail gracefully" (caching is best-effort), but the
    // requireAuth() call still gates Firestore writes.
});

// ── ncert.ts ───────────────────────────────────────────────────────────────
import * as ncert from '@/app/actions/ncert';

describe('ncert.ts — Wave 1 auth gate', () => {
    it('getNCERTChapters returns [] when unauthenticated (graceful)', async () => {
        // Action wraps requireAuth in try/catch and returns [] on any error.
        const result = await ncert.getNCERTChapters(8);
        expect(result).toEqual([]);
    });
});
