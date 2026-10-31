/**
 * VIDYA live application context + controlled actions.
 *
 * Security properties under test:
 *   - context is scoped to the screen that published it (no leakage across
 *     routes, cleared on unmount);
 *   - VIDYA can only INVOKE a manifest action the CURRENT screen registered
 *     and enabled, and only NAVIGATE to manifest sections (never a URL);
 *   - the fingerprint changes when the screen changes, so a stale action is
 *     refused;
 *   - client payloads are bounded and unknown fields/ids are dropped.
 */

import {
    __resetVidyaAppContextForTests,
    buildVidyaAppContext,
    clearScreenEntities,
    getRegisteredCapability,
    publishScreenEntities,
    registerCapability,
} from '@/lib/vidya/app-context-registry';
import {
    hasLiveAppState,
    sanitizeAppContext,
    validateAppAction,
} from '@/lib/vidya/app-context-contract';

beforeEach(() => __resetVidyaAppContextForTests());

describe('buildVidyaAppContext — route context', () => {
    it('resolves the current screen from the route', () => {
        expect(buildVidyaAppContext('/attendance/abc').screenId).toBe('attendance.class');
        expect(buildVidyaAppContext('/my-library').screenId).toBe('my-library');
    });

    it('only includes entities published on the current route', () => {
        publishScreenEntities('attendance.class', '/attendance/abc', { className: 'Class 7A', studentCount: 32 });
        publishScreenEntities('my-library', '/my-library', { itemsShown: 5 });

        expect(buildVidyaAppContext('/attendance/abc').entities).toEqual({ className: 'Class 7A', studentCount: 32 });
        expect(buildVidyaAppContext('/my-library').entities).toEqual({ itemsShown: 5 });
        expect(buildVidyaAppContext('/attendance/other').entities).toEqual({});
    });

    it('merges the page and grid contributions for the same screen', () => {
        publishScreenEntities('attendance.class', '/attendance/abc', { className: 'Class 7A' });
        publishScreenEntities('attendance.grid', '/attendance/abc', { absentCount: 2, attendanceSubmitted: false });

        expect(buildVidyaAppContext('/attendance/abc').entities).toEqual({
            className: 'Class 7A', absentCount: 2, attendanceSubmitted: false,
        });
    });

    it('drops context when the screen unmounts', () => {
        publishScreenEntities('attendance.grid', '/attendance/abc', { absentCount: 2 });
        clearScreenEntities('attendance.grid');
        expect(buildVidyaAppContext('/attendance/abc').entities).toEqual({});
    });

    it('fingerprint changes when the class or its state changes', () => {
        publishScreenEntities('attendance.class', '/attendance/abc', { className: 'Class 7A' });
        const first = buildVidyaAppContext('/attendance/abc').fingerprint;
        publishScreenEntities('attendance.class', '/attendance/abc', { className: 'Class 8B' });
        expect(buildVidyaAppContext('/attendance/abc').fingerprint).not.toBe(first);
    });
});

describe('capability registry', () => {
    it('advertises only the actions registered on this screen', () => {
        registerCapability({ id: 'attendance.submit', path: '/attendance/abc', enabled: true, run: jest.fn() });
        registerCapability({ id: 'library.filter', path: '/my-library', enabled: true, run: jest.fn() });

        expect(buildVidyaAppContext('/attendance/abc').capabilities.map((c) => c.id)).toEqual(['attendance.submit']);
        expect(getRegisteredCapability('attendance.submit', '/my-library')).toBeUndefined();
    });

    it('unregistering removes the action (screen left)', () => {
        const off = registerCapability({ id: 'attendance.submit', path: '/attendance/abc', enabled: true, run: jest.fn() });
        off();
        expect(getRegisteredCapability('attendance.submit', '/attendance/abc')).toBeUndefined();
    });

    it('refuses to register an action that is not in the manifest', () => {
        expect(() => registerCapability({ id: 'delete_everything' as never, path: '/', enabled: true, run: jest.fn() }))
            .toThrow(/Unknown VIDYA capability/);
    });

    it('reports disabled actions with their reason', () => {
        registerCapability({ id: 'students.open_add', path: '/attendance/abc', enabled: false, reason: '40-student limit reached', run: jest.fn() });
        expect(buildVidyaAppContext('/attendance/abc').capabilities).toEqual([
            { id: 'students.open_add', enabled: false, reason: '40-student limit reached' },
        ]);
    });
});

describe('validateAppAction — the model can only request what the app offers', () => {
    const ctx = sanitizeAppContext({
        screenId: 'attendance.class',
        entities: {},
        capabilities: [
            { id: 'attendance.submit', enabled: true },
            { id: 'students.open_add', enabled: false, reason: 'full' },
        ],
        fingerprint: 'f',
    });

    it('allows navigation only to manifest sections', () => {
        expect(validateAppAction({ type: 'NAVIGATE', destination: 'my-library' }, null)).toEqual({ type: 'NAVIGATE', destination: 'my-library' });
        expect(validateAppAction({ type: 'NAVIGATE', destination: 'https://evil.example' }, null)).toBeNull();
        expect(validateAppAction({ type: 'NAVIGATE', url: '/admin/cost-dashboard' }, null)).toBeNull();
    });

    it('allows INVOKE only for an enabled action this screen offered', () => {
        expect(validateAppAction({ type: 'INVOKE', capability: 'attendance.submit' }, ctx)).toEqual({ type: 'INVOKE', capability: 'attendance.submit' });
        // disabled
        expect(validateAppAction({ type: 'INVOKE', capability: 'students.open_add' }, ctx)).toBeNull();
        // real capability, but not offered on this screen
        expect(validateAppAction({ type: 'INVOKE', capability: 'library.filter', params: { type: 'quiz' } }, ctx)).toBeNull();
        // invented
        expect(validateAppAction({ type: 'INVOKE', capability: 'grant_admin' }, ctx)).toBeNull();
        // no screen context at all
        expect(validateAppAction({ type: 'INVOKE', capability: 'attendance.submit' }, null)).toBeNull();
    });

    it('keeps only declared string params', () => {
        const libCtx = sanitizeAppContext({ capabilities: [{ id: 'library.filter', enabled: true }] });
        expect(validateAppAction({ type: 'INVOKE', capability: 'library.filter', params: { type: 'quiz', userId: 'someone-else', n: 1 } }, libCtx))
            .toEqual({ type: 'INVOKE', capability: 'library.filter', params: { type: 'quiz' } });
    });

    it('rejects unknown action types', () => {
        expect(validateAppAction({ type: 'CLICK', selector: '#submit' }, ctx)).toBeNull();
        expect(validateAppAction('NAVIGATE', ctx)).toBeNull();
    });
});

describe('sanitizeAppContext — bounded, untrusted input', () => {
    it('drops unknown capability ids, bad keys and non-primitive values; clamps strings', () => {
        const out = sanitizeAppContext({
            screenId: 'attendance.class',
            entities: {
                className: 'x'.repeat(500),
                'bad key': 1,
                nested: { a: 1 },
                absentStudents: Array.from({ length: 100 }, (_, i) => `S${i}`),
            },
            capabilities: [{ id: 'attendance.submit', enabled: true }, { id: 'rm_rf', enabled: true }],
        })!;

        expect((out.entities.className as string).length).toBe(200);
        expect(out.entities).not.toHaveProperty('bad key');
        expect(out.entities).not.toHaveProperty('nested');
        expect((out.entities.absentStudents as string[]).length).toBe(40);
        expect(out.capabilities.map((c) => c.id)).toEqual(['attendance.submit']);
    });

    it('a client-sent role/permission never becomes a capability', () => {
        const out = sanitizeAppContext({ entities: { role: 'admin' }, capabilities: [{ id: 'admin', enabled: true }] })!;
        expect(out.capabilities).toEqual([]);
        expect(validateAppAction({ type: 'INVOKE', capability: 'admin' }, out)).toBeNull();
    });

    it('treats a missing/garbage payload as "no app context"', () => {
        expect(sanitizeAppContext(undefined)).toBeNull();
        expect(sanitizeAppContext('x')).toBeNull();
        expect(hasLiveAppState(sanitizeAppContext({ screenId: 'home' }))).toBe(false);
        expect(hasLiveAppState(sanitizeAppContext({ entities: { a: 1 } }))).toBe(true);
    });
});
