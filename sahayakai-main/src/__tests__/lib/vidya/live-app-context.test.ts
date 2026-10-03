/**
 * Live voice reuses text VIDYA's context + action system — no second copy.
 *
 * - The pushed frame is built from the manifest (product knowledge) and the
 *   same registry snapshot text VIDYA sends (screen, state, actions).
 * - A Live tool call becomes the same VidyaAppAction and runs through the
 *   same runAppAction rules: only offered + enabled actions, manifest routes
 *   only, stale-screen refusal, Confirm before anything is saved.
 */

import {
    __resetVidyaAppContextForTests,
    buildVidyaAppContext,
    publishScreenEntities,
    registerCapability,
    subscribeVidyaAppContext,
} from '@/lib/vidya/app-context-registry';
import { buildLiveAppContextFrame, liveToolCallToAppAction } from '@/lib/vidya/live-app-context';
import { renderManifestForPrompt, VIDYA_SECTIONS } from '@/lib/vidya/app-manifest';
import { runAppAction } from '@/lib/vidya/run-app-action';

const PATH = '/attendance/class-1';

beforeEach(() => {
    __resetVidyaAppContextForTests();
    publishScreenEntities('attendance.class', PATH, { className: 'Class 7A', studentCount: 32 });
    publishScreenEntities('attendance.grid', PATH, { absentStudents: ['Ravi'], attendanceSubmitted: false });
});

describe('buildLiveAppContextFrame — the same context text VIDYA gets', () => {
    it('carries product knowledge from the single manifest source', () => {
        const frame = buildLiveAppContextFrame(PATH);
        expect(frame.knowledge).toBe(renderManifestForPrompt());
        expect(frame.sections).toEqual(VIDYA_SECTIONS.map((s) => s.id));
        // What Live VIDYA needs to answer the founder's questions:
        expect(frame.knowledge).toMatch(/attendance \| Attendance \(\/attendance\).*Sidebar → Assess → Attendance/);
        expect(frame.knowledge).toMatch(/my-library \| My Library \(\/my-library\)/);
        expect(frame.knowledge).toMatch(/Add a student.*"Students" tab.*"Add Student"/);
        expect(frame.knowledge).toMatch(/Take attendance.*"Submit Attendance"/);
    });

    it('carries the current screen exactly as text VIDYA sees it', () => {
        registerCapability({ id: 'attendance.submit', path: PATH, enabled: true, run: jest.fn() });
        const frame = buildLiveAppContextFrame(PATH);
        const textCtx = buildVidyaAppContext(PATH);

        expect(frame.screen).toMatchObject({
            path: PATH, section: 'Attendance', screenId: 'attendance.class', fingerprint: textCtx.fingerprint,
        });
        expect(frame.screen.entities).toEqual(textCtx.entities);
        expect(frame.screen.capabilities).toEqual([
            expect.objectContaining({ id: 'attendance.submit', enabled: true, requiresConfirmation: true }),
        ]);
    });

    it('updates after a route / class change', () => {
        const a = buildLiveAppContextFrame(PATH);
        publishScreenEntities('attendance.class', PATH, { className: 'Class 8B', studentCount: 30 });
        const b = buildLiveAppContextFrame(PATH);
        expect(b.screen.fingerprint).not.toBe(a.screen.fingerprint);
        expect(buildLiveAppContextFrame('/my-library').screen).toMatchObject({ section: 'My Library', entities: {} });
    });

    it('stays small and private: well under the 64 KB frame cap, no ids or phone numbers', () => {
        const raw = JSON.stringify({ appContext: buildLiveAppContextFrame(PATH) });
        expect(raw.length).toBeLessThan(20_000);
        expect(raw).not.toMatch(/\+91\d{10}/);
    });

    it('every frame field is declared by the sidecar model (TS ↔ Python wire parity)', () => {
        const fs = require('fs') as typeof import('fs');
        const path = require('path') as typeof import('path');
        const py = fs.readFileSync(
            path.join(process.cwd(), '..', 'sahayakai-agents', 'src', 'sahayakai_agents', 'agents', 'vidya_voice', 'app_context.py'),
            'utf8',
        );
        registerCapability({ id: 'students.open_add', path: PATH, enabled: false, reason: 'full', run: jest.fn() });
        const frame = buildLiveAppContextFrame(PATH);
        const keys = new Set([
            ...Object.keys(frame),
            ...Object.keys(frame.screen),
            ...frame.screen.capabilities.flatMap((c) => Object.keys(c)),
        ]);
        for (const key of keys) expect(py).toMatch(new RegExp(`^\\s+${key}: `, 'm'));
    });

    it('notifies subscribers when a screen publishes or registers (drives the Live push)', () => {
        const listener = jest.fn();
        const off = subscribeVidyaAppContext(listener);
        publishScreenEntities('attendance.grid', PATH, { absentStudents: [] });
        const unregister = registerCapability({ id: 'attendance.submit', path: PATH, enabled: true, run: jest.fn() });
        unregister();
        expect(listener).toHaveBeenCalledTimes(3);
        off();
        publishScreenEntities('attendance.grid', PATH, { absentStudents: ['x'] });
        expect(listener).toHaveBeenCalledTimes(3);
    });
});

describe('liveToolCallToAppAction + runAppAction — the same action rules', () => {
    const flush = () => new Promise((r) => setTimeout(r, 0));
    const deps = (confirmations: Array<() => void> = []) => ({
        livePath: () => PATH,
        navigate: jest.fn(),
        requestConfirmation: (proceed: () => void) => { confirmations.push(proceed); },
        onRefused: jest.fn(),
    });

    it('navigate_to → manifest route only', () => {
        const ok = liveToolCallToAppAction({ name: 'navigate_to', args: { destination: 'attendance' } }, PATH);
        expect(ok?.action).toEqual({ type: 'NAVIGATE', destination: 'attendance' });
        const d = deps();
        runAppAction(ok!.action, ok!.fingerprint, d);
        expect(d.navigate).toHaveBeenCalledWith(expect.objectContaining({ route: '/attendance' }));

        expect(liveToolCallToAppAction({ name: 'navigate_to', args: { destination: 'https://evil.example' } }, PATH)).toBeNull();
    });

    it('perform_app_action runs a read-only/UI action through the screen\'s own handler', async () => {
        const run = jest.fn();
        registerCapability({ id: 'attendance.mark_all_present', path: PATH, enabled: true, run });
        const req = liveToolCallToAppAction(
            { name: 'perform_app_action', args: { capability: 'attendance.mark_all_present', params: {}, fingerprint: buildVidyaAppContext(PATH).fingerprint } },
            PATH,
        )!;
        expect(runAppAction(req.action, req.fingerprint, deps())).toBe('ran');
        await flush();
        expect(run).toHaveBeenCalled();
    });

    it('a saving action waits for Confirm (voice cannot skip it)', async () => {
        const run = jest.fn();
        registerCapability({ id: 'attendance.submit', path: PATH, enabled: true, run });
        const req = liveToolCallToAppAction(
            { name: 'perform_app_action', args: { capability: 'attendance.submit', fingerprint: buildVidyaAppContext(PATH).fingerprint } },
            PATH,
        )!;
        expect(req.description).toMatch(/Submit/);
        const confirmations: Array<() => void> = [];
        expect(runAppAction(req.action, req.fingerprint, deps(confirmations))).toBe('awaiting_confirmation');
        await flush();
        expect(run).not.toHaveBeenCalled();
        confirmations[0]();
        await flush();
        expect(run).toHaveBeenCalledTimes(1);
    });

    it('refuses actions the screen did not offer, or offers disabled (unauthorised/unsupported)', () => {
        expect(liveToolCallToAppAction({ name: 'perform_app_action', args: { capability: 'library.filter', params: { type: 'quiz' } } }, PATH)).toBeNull();
        expect(liveToolCallToAppAction({ name: 'perform_app_action', args: { capability: 'grant_admin' } }, PATH)).toBeNull();
        registerCapability({ id: 'students.open_add', path: PATH, enabled: false, reason: 'full', run: jest.fn() });
        expect(liveToolCallToAppAction({ name: 'perform_app_action', args: { capability: 'students.open_add' } }, PATH)).toBeNull();
        expect(liveToolCallToAppAction({ name: 'open_lesson_plan', args: {} }, PATH)).toBeNull(); // existing flow tools untouched
    });

    it('refuses a stale action: the screen changed after VIDYA looked', async () => {
        const run = jest.fn();
        registerCapability({ id: 'attendance.mark_all_present', path: PATH, enabled: true, run });
        const seen = buildVidyaAppContext(PATH).fingerprint; // what get_app_context served
        publishScreenEntities('attendance.class', PATH, { className: 'Class 8B' }); // teacher switched class

        const req = liveToolCallToAppAction({ name: 'perform_app_action', args: { capability: 'attendance.mark_all_present', fingerprint: seen } }, PATH)!;
        const d = deps();
        expect(runAppAction(req.action, req.fingerprint, d)).toBe('refused');
        expect(d.onRefused).toHaveBeenCalledWith('screen_changed');
        await flush();
        expect(run).not.toHaveBeenCalled();
    });

    it('a backend refusal from the real handler is surfaced, not bypassed', async () => {
        registerCapability({ id: 'attendance.submit', path: PATH, enabled: true, run: async () => { throw new Error('Unauthorized'); } });
        const req = liveToolCallToAppAction({ name: 'perform_app_action', args: { capability: 'attendance.submit', fingerprint: buildVidyaAppContext(PATH).fingerprint } }, PATH)!;
        const confirmations: Array<() => void> = [];
        const d = deps(confirmations);
        runAppAction(req.action, req.fingerprint, d);
        confirmations[0]();
        await flush();
        await flush();
        expect(d.onRefused).toHaveBeenCalledWith('handler_failed');
    });
});
