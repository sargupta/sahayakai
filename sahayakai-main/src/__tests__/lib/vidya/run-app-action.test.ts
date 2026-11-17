import {
    __resetVidyaAppContextForTests,
    buildVidyaAppContext,
    publishScreenEntities,
    registerCapability,
} from '@/lib/vidya/app-context-registry';
import { runAppAction, type AppActionDeps } from '@/lib/vidya/run-app-action';

const PATH = '/attendance/class-1';
let livePath = PATH;
let confirmations: Array<() => void> = [];

function deps(): AppActionDeps & { navigate: jest.Mock; onRefused: jest.Mock } {
    return {
        livePath: () => livePath,
        navigate: jest.fn(),
        requestConfirmation: (proceed) => { confirmations.push(proceed); },
        onRefused: jest.fn(),
    };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
    __resetVidyaAppContextForTests();
    livePath = PATH;
    confirmations = [];
    publishScreenEntities('attendance.class', PATH, { className: 'Class 7A' });
});

describe('runAppAction', () => {
    it('navigates only to manifest sections', () => {
        const d = deps();
        expect(runAppAction({ type: 'NAVIGATE', destination: 'my-library' }, '', d)).toBe('navigated');
        expect(d.navigate).toHaveBeenCalledWith(expect.objectContaining({ route: '/my-library' }));
    });

    it('runs a UI action through the screen\'s own handler', async () => {
        const run = jest.fn();
        registerCapability({ id: 'attendance.mark_all_present', path: PATH, enabled: true, run });
        const fp = buildVidyaAppContext(PATH).fingerprint;

        expect(runAppAction({ type: 'INVOKE', capability: 'attendance.mark_all_present' }, fp, deps())).toBe('ran');
        await flush();
        expect(run).toHaveBeenCalledWith({});
    });

    it('waits for explicit confirmation before a data-saving action', async () => {
        const run = jest.fn();
        registerCapability({ id: 'attendance.submit', path: PATH, enabled: true, run });
        const fp = buildVidyaAppContext(PATH).fingerprint;

        expect(runAppAction({ type: 'INVOKE', capability: 'attendance.submit' }, fp, deps())).toBe('awaiting_confirmation');
        await flush();
        expect(run).not.toHaveBeenCalled();

        confirmations[0]();
        await flush();
        expect(run).toHaveBeenCalledTimes(1);
    });

    it('refuses a stale action when the screen changed while VIDYA was thinking', async () => {
        const run = jest.fn();
        registerCapability({ id: 'attendance.mark_all_present', path: PATH, enabled: true, run });
        const fp = buildVidyaAppContext(PATH).fingerprint;
        publishScreenEntities('attendance.class', PATH, { className: 'Class 8B' }); // teacher switched class

        const d = deps();
        expect(runAppAction({ type: 'INVOKE', capability: 'attendance.mark_all_present' }, fp, d)).toBe('refused');
        expect(d.onRefused).toHaveBeenCalledWith('screen_changed');
        await flush();
        expect(run).not.toHaveBeenCalled();
    });

    it('re-checks at confirm time: navigating away before Confirm cancels the save', async () => {
        const run = jest.fn();
        registerCapability({ id: 'attendance.submit', path: PATH, enabled: true, run });
        const fp = buildVidyaAppContext(PATH).fingerprint;
        const d = deps();
        runAppAction({ type: 'INVOKE', capability: 'attendance.submit' }, fp, d);

        livePath = '/my-library';
        confirmations[0]();
        await flush();

        expect(run).not.toHaveBeenCalled();
        expect(d.onRefused).toHaveBeenCalled();
    });

    it('refuses an action this screen does not offer, or offers disabled', () => {
        const fp = buildVidyaAppContext(PATH).fingerprint;
        const d = deps();
        expect(runAppAction({ type: 'INVOKE', capability: 'library.filter', params: { type: 'quiz' } }, fp, d)).toBe('refused');
        expect(d.onRefused).toHaveBeenCalledWith('not_on_this_screen');

        registerCapability({ id: 'students.open_add', path: PATH, enabled: false, run: jest.fn() });
        const d2 = deps();
        expect(runAppAction({ type: 'INVOKE', capability: 'students.open_add' }, buildVidyaAppContext(PATH).fingerprint, d2)).toBe('refused');
        expect(d2.onRefused).toHaveBeenCalledWith('disabled');
    });

    it('surfaces a handler failure (e.g. backend refused) instead of swallowing it', async () => {
        registerCapability({ id: 'attendance.open_class', path: PATH, enabled: true, run: () => { throw new Error('class_not_found'); } });
        const d = deps();
        runAppAction({ type: 'INVOKE', capability: 'attendance.open_class', params: { className: 'Nope' } }, buildVidyaAppContext(PATH).fingerprint, d);
        await flush();
        expect(d.onRefused).toHaveBeenCalledWith('handler_failed');
    });
});
