/**
 * Riya calls tab — the real console component driven end to end in jsdom against the REAL
 * server service on in-memory repos. Only the HTTP hop is replaced: `apiFetch` is routed to
 * the same service functions the route handlers call, behind the same rules the route shell
 * applies (Sampark flag, Riya flag, org admin). Radix Select is swapped for a native <select>
 * because jsdom cannot drive its pointer-capture popover; nothing else in the UI is stubbed.
 *
 * Proves: the tab renders for an admin; Practice preview → confirm → simulated call → result;
 * refusal states; the disabled flag and a non-admin / cross-org viewer are blocked; and no
 * network request leaves the page (no ElevenLabs call) in Practice.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const toastSpy = jest.fn();
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastSpy }) }));
jest.mock('@/context/language-context', () => ({
    ...jest.requireActual('@/context/language-context'),
    useLanguage: () => ({ t: (k: string) => k, language: 'English', isLoaded: true }),
}));
jest.mock('@/lib/firebase', () => ({ auth: { currentUser: null } }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

// Native stand-in for the Radix Select (same props surface the panel uses).
jest.mock('@/components/ui/select', () => {
    const R = jest.requireActual('react') as typeof React;
    const SelectTrigger = (_p: { id?: string; 'aria-label'?: string; children?: React.ReactNode }) => null;
    const SelectValue = () => null;
    const SelectContent = ({ children }: { children?: React.ReactNode }) => R.createElement(R.Fragment, null, children);
    const SelectItem = ({ value, children }: { value: string; children?: React.ReactNode }) => R.createElement('option', { value }, children);
    const Select = ({ value, onValueChange, children }: { value?: string; onValueChange?: (v: string) => void; children?: React.ReactNode }) => {
        let id: string | undefined;
        let label: string | undefined;
        R.Children.forEach(children, (c) => {
            if (R.isValidElement(c) && c.type === SelectTrigger) {
                const p = c.props as { id?: string; 'aria-label'?: string };
                id = p.id;
                label = p['aria-label'];
            }
        });
        return R.createElement('select', { id, 'aria-label': label, value: value ?? '', onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onValueChange?.(e.target.value) },
            R.createElement('option', { value: '' }, '—'), children);
    };
    return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

const ORG = 'hillview-demo';
const ADMIN = 'admin-uid';
let currentUid = ADMIN;
let env: Record<string, string | undefined> = {};
let deps: import('@/server/sampark/conversation').RiyaDeps;

jest.mock('@/lib/api/client', () => {
    class ApiError extends Error {
        constructor(public readonly status: number, message: string, public readonly body: unknown = undefined) {
            super(message);
            this.name = 'ApiError';
        }
    }
    const apiFetch = async (path: string, init: { method?: string; body?: unknown } = {}) => {
        const svc = jest.requireActual('@/server/sampark/conversation');
        const guardians = jest.requireActual('@/server/sampark/guardians');
        const { SamparkServiceError } = jest.requireActual('@/server/sampark/errors');
        const method = init.method ?? (init.body !== undefined ? 'POST' : 'GET');
        const m = path.match(/^\/api\/sampark\/([^/?]+)(\/[^?]*)?(\?.*)?$/);
        if (!m) throw new ApiError(404, 'Not found');
        const orgId = decodeURIComponent(m[1]);
        const rest = m[2] ?? '';
        // The route shell, in its order: Sampark flag → auth → org admin → Riya flag.
        if (env.SAMPARK_ENABLED !== 'true') throw new ApiError(404, 'Not found');
        if (!currentUid) throw new ApiError(401, 'Unauthorized');
        if (!(orgId === ORG && currentUid === ADMIN)) throw new ApiError(403, 'Forbidden');
        try {
            if (rest === '/guardians' && method === 'GET') {
                return { guardians: await guardians.listGuardianRows({ repo: deps.repo, clock: deps.clock }, orgId, { limit: 500 }) };
            }
            if (!rest.startsWith('/riya')) throw new ApiError(404, 'Not found');
            if (env.SAMPARK_ELEVENLABS_ENABLED !== 'true') throw new ApiError(404, 'Not found');
            if (rest === '/riya' && method === 'GET') return await svc.riyaOverview(deps, orgId);
            if (rest === '/riya/preview') return await svc.previewRiyaCall(deps, orgId, svc.RiyaPreviewSchema.parse(init.body));
            if (rest === '/riya' && method === 'POST') return await svc.startRiyaCall(deps, orgId, currentUid, svc.RiyaStartSchema.parse(init.body));
            const call = rest.match(/^\/riya\/([^/]+)(\/reconcile|\/review)?$/);
            if (call && !call[2]) return await svc.getRiyaCall(deps, orgId, call[1]);
            if (call && call[2] === '/review') return await svc.reviewRiyaCall(deps, orgId, call[1], currentUid, (init.body as { note: 'cannot_tell' }).note);
            if (call && call[2] === '/reconcile') return await svc.reconcileRiyaCall(deps, orgId, call[1]);
        } catch (err) {
            if (err instanceof SamparkServiceError) throw new ApiError(err.status, err.message, { error: err.code });
            throw err;
        }
        throw new ApiError(404, 'Not found');
    };
    return { ApiError, apiFetch };
});

import { RiyaCallPanel } from '@/components/sampark/riya-call-panel';
import { SamparkSchoolProvider } from '@/components/sampark/school-context';
import { createMemoryConversationRepo } from '@/lib/sampark/conversation/repo';
import { encryptPhone, hashPhone } from '@/lib/sampark/phone';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { schoolView } from '@/server/sampark/school';

import { guardian, prefs, school, student, testClock } from '../engine/_fixtures';
import { setPhoneEnv } from '../server/_helpers';

const WED_11_IST = new Date('2026-10-07T05:30:00Z');

async function seed(mode: 'practice' | 'test' = 'practice') {
    setPhoneEnv();
    const repo = createMemorySamparkRepo();
    const testPhone = '+919800000001';
    const s = school({ mode, holidays: [], ...(mode === 'test' ? { testPhoneEnc: encryptPhone(testPhone), testPhoneHash: hashPhone(testPhone), testPhoneLast4: '0001' } : {}) });
    await repo.upsertSchool(s);
    await repo.upsertStudents(ORG, [
        student('s1', { displayName: 'Asha Rai', spokenFirstName: { English: 'Asha' }, guardianIds: ['g1'] }),
        student('s2', { displayName: 'Ravi Gurung', spokenFirstName: { English: 'Ravi' }, guardianIds: ['g2'] }),
    ]);
    const g = (id: string, name: string, phone: string, sid: string) =>
        guardian(id, { displayName: name, phoneEnc: encryptPhone(phone), phoneHash: hashPhone(phone), phoneLast4: phone.slice(-4), phoneClass: 'mobile', crmLanguage: 'English', studentIds: [sid] });
    await repo.upsertGuardians(ORG, [g('g1', 'Meena Rai', '+919811111111', 's1'), g('g2', 'Pema Gurung', '+919822222222', 's2')]);
    await repo.upsertPreferences([
        prefs('g1', { notices: 'granted', recorded_conversation: 'granted' }, 'English'),
        prefs('g2', { notices: 'granted' }, 'English'), // no recorded-conversation consent
    ]);
    deps = { repo, calls: createMemoryConversationRepo(), clock: testClock(WED_11_IST), env };
    return schoolView(s, env as NodeJS.ProcessEnv);
}

function renderPanel(view: ReturnType<typeof schoolView>, orgId = ORG) {
    return render(
        <SamparkSchoolProvider value={{ orgId, school: view, setSchool: () => undefined, reloadSchool: () => undefined }}>
            <RiyaCallPanel />
        </SamparkSchoolProvider>,
    );
}

let fetchSpy: jest.SpyInstance;
beforeEach(() => {
    toastSpy.mockReset();
    currentUid = ADMIN;
    env = { SAMPARK_ENABLED: 'true', SAMPARK_ELEVENLABS_ENABLED: 'true', SAMPARK_RIYA_PURPOSES: 'ptm_invitation,holiday_notice' };
    fetchSpy = jest.spyOn(global, 'fetch' as never).mockImplementation((() => {
        throw new Error('no network request may leave the Riya tab in Practice');
    }) as never);
});
afterEach(() => fetchSpy.mockRestore());

async function fillPtm(familyKey: string) {
    fireEvent.change(await screen.findByLabelText('What is the call about?'), { target: { value: 'ptm_invitation' } });
    await waitFor(() => expect(screen.getByRole('option', { name: /Meena Rai — Asha Rai/ })).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Family'), { target: { value: familyKey } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-10' } });
}

describe('Riya calls tab (Practice)', () => {
    it('renders for an org admin, previews, confirms and shows the simulated result — with no network call', async () => {
        renderPanel(await seed());
        expect(await screen.findByText('Riya calling assistant')).toBeTruthy();
        expect(screen.getByText('Practice — no real calls are made')).toBeTruthy();

        const place = screen.getByRole('button', { name: 'Run practice call' }) as HTMLButtonElement;
        expect(place.disabled).toBe(true); // nothing to call before a passing preview

        await fillPtm('g1|s1');
        fireEvent.change(screen.getByLabelText('Practice: what happens on the call'), { target: { value: 'answered_cannot_attend' } });
        fireEvent.click(screen.getByRole('button', { name: 'Preview what Riya will say' }));

        expect(await screen.findByText(/parent-teacher meeting for your child's class, Seven, section B, on Saturday, the tenth of October at ten o'clock in the morning/)).toBeTruthy();
        expect(screen.getByText(/Rings: phone ending 1111 \(simulated, nothing rings\)/)).toBeTruthy();
        expect(screen.getByText(/To: Meena Rai/)).toBeTruthy();
        await waitFor(() => expect(place.disabled).toBe(false));

        fireEvent.click(place);
        const dialog = await screen.findByRole('alertdialog');
        expect(within(dialog).getByText('Run a practice call?')).toBeTruthy();
        expect(within(dialog).getByText('Nothing will ring. The result appears in the list below.')).toBeTruthy();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Run practice call' }));

        await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({ title: 'Call status: Conversation ended' }));
        expect(await screen.findByText('Conversation ended')).toBeTruthy();
        // Answers are shown in words, never as the agent's raw ids (class: any raw key or enum value).
        expect(screen.getByText('Coming to the meeting')).toBeTruthy();
        expect(screen.getByText('Cannot attend')).toBeTruthy();
        expect(screen.getByText('Preferred meeting time')).toBeTruthy();
        expect(screen.getByText('Saturday after 11 AM')).toBeTruthy(); // free text is shown as said
        const answers = screen.getByText('Coming to the meeting').closest('dl') as HTMLElement;
        expect(answers.textContent).not.toMatch(/_/);
        expect(fetchSpy).not.toHaveBeenCalled();
        const stored = await deps.calls.listCalls(ORG, 10);
        expect(stored).toHaveLength(1);
        expect(stored[0]).toMatchObject({ provider: 'simulated', state: 'completed', destination: 'guardian' });
    });

    it('shows a refusal and keeps the call button disabled (no recorded-conversation consent)', async () => {
        renderPanel(await seed());
        await screen.findByText('Riya calling assistant');
        fireEvent.change(await screen.findByLabelText('What is the call about?'), { target: { value: 'ptm_invitation' } });
        await waitFor(() => expect(screen.getByRole('option', { name: /Pema Gurung/ })).toBeTruthy());
        fireEvent.change(screen.getByLabelText('Family'), { target: { value: 'g2|s2' } });
        fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-10' } });
        fireEvent.click(screen.getByRole('button', { name: 'Preview what Riya will say' }));
        expect(await screen.findByText('This family has not agreed to recorded calls.')).toBeTruthy();
        expect((screen.getByRole('button', { name: 'Run practice call' }) as HTMLButtonElement).disabled).toBe(true);
        expect(await deps.calls.listCalls(ORG, 10)).toHaveLength(0);
    });

    it('a provider timeout in Practice shows the unknown state and the review action', async () => {
        renderPanel(await seed());
        await screen.findByText('Riya calling assistant');
        await fillPtm('g1|s1');
        fireEvent.change(screen.getByLabelText('Practice: what happens on the call'), { target: { value: 'provider_timeout' } });
        fireEvent.click(screen.getByRole('button', { name: 'Preview what Riya will say' }));
        await screen.findByText(/parent-teacher meeting/);
        fireEvent.click(screen.getByRole('button', { name: 'Run practice call' }));
        fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Run practice call' }));
        expect(await screen.findByText('Outcome unknown — check before calling again')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Mark as checked' })).toBeTruthy();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('Riya flag off: the tab shows the not-found state and no form', async () => {
        const view = await seed();
        env.SAMPARK_ELEVENLABS_ENABLED = 'false';
        renderPanel(view);
        expect(await screen.findByRole('alert')).toBeTruthy();
        expect(screen.getByText('Not found. School calls may not be switched on for this school yet.')).toBeTruthy();
        expect(screen.queryByText('New Riya call')).toBeNull();
    });

    it('a non-admin, and an admin of another school, are blocked', async () => {
        const view = await seed();
        currentUid = 'teacher-uid';
        const { unmount } = renderPanel(view);
        expect(await screen.findByText('Only administrators of this school can use school calls.')).toBeTruthy();
        expect(screen.queryByText('New Riya call')).toBeNull();
        unmount();
        currentUid = ADMIN;
        renderPanel(view, 'other-school');
        expect(await screen.findByText('Only administrators of this school can use school calls.')).toBeTruthy();
    });
});

describe('Riya calls tab (Test mode, real call)', () => {
    const outbound = jest.fn(async () => new Response(JSON.stringify({ success: true, message: 'ok', conversation_id: 'conv_panel_1', sip_call_id: 'sip_1' }), { status: 200 }));

    function testEnv() {
        env = {
            ...env,
            SAMPARK_LIVE_DIAL_ENABLED: 'true',
            SAMPARK_FIRESTORE_DATABASE: 'sampark-nonprod',
            ELEVENLABS_API_KEY: 'sk_test_panel_key_not_real',
            ELEVENLABS_AGENT_ID: 'agent_1111cloneclonecloneclone111',
            ELEVENLABS_AGENT_BRANCH_ID: 'agtbrch_2222branchbranchbranch22',
            ELEVENLABS_AGENT_PHONE_NUMBER_ID: 'phnum_3333numbernumbernumber333',
            ELEVENLABS_SOURCE_AGENT_ID: 'agent_0000sourcesourcesourcesource00',
            ELEVENLABS_WEBHOOK_SECRET: 'whsec_panel_test',
            SAMPARK_RIYA_TEST_ALLOWED_NUMBERS: '+919800000001',
        };
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true'; // evaluateGate reads it from process.env
    }

    function webhookHealth(ok: boolean) {
        fetchSpy.mockImplementation((async (url: string) => {
            if (url === '/api/webhooks/elevenlabs-riya') return { ok, status: ok ? 200 : 503 };
            throw new Error(`unexpected browser request ${url}`);
        }) as never);
    }

    afterEach(() => {
        delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
        outbound.mockClear();
    });

    it('the confirmation lists agent, branch, number, purpose, database, window, webhook and cap; a failed webhook check blocks the call', async () => {
        testEnv();
        const view = await seed('test');
        deps = { ...deps, env, http: { fetchImpl: outbound as unknown as typeof fetch } };
        webhookHealth(false);
        renderPanel(view);
        await screen.findByText('Riya calling assistant');
        await fillPtm('g1|s1');
        fireEvent.click(screen.getByRole('button', { name: 'Preview what Riya will say' }));
        expect(await screen.findByText(/Number that will ring: \+919800000001/)).toBeTruthy();
        const place = screen.getByRole('button', { name: 'Place call' }) as HTMLButtonElement;
        await waitFor(() => expect(place.disabled).toBe(false));
        fireEvent.click(place);
        const dialog = await screen.findByRole('alertdialog');
        expect(within(dialog).getByText('Place a real test call?')).toBeTruthy();
        expect(within(dialog).getByText(/Agent …one111 · branch …anch22 · number …ber333/)).toBeTruthy();
        expect(within(dialog).getByText('Number that will ring: +919800000001')).toBeTruthy();
        expect(within(dialog).getByText('Purpose: PTM invitation')).toBeTruthy();
        expect(within(dialog).getByText('Non-production database')).toBeTruthy();
        expect(within(dialog).getByText('Normal calling hours')).toBeTruthy();
        expect(await within(dialog).findByText('Webhook check failed: the call result could not come back')).toBeTruthy();
        expect(within(dialog).getByText(/At most 5 real test call\(s\) today/)).toBeTruthy();
        const confirm = within(dialog).getByRole('button', { name: 'Place call' }) as HTMLButtonElement;
        expect(confirm.disabled).toBe(true);
        fireEvent.click(confirm);
        expect(outbound).not.toHaveBeenCalled();
    });

    it('with a healthy webhook, one confirmation places exactly one call to the test phone', async () => {
        testEnv();
        const view = await seed('test');
        deps = { ...deps, env, http: { fetchImpl: outbound as unknown as typeof fetch } };
        webhookHealth(true);
        renderPanel(view);
        await screen.findByText('Riya calling assistant');
        await fillPtm('g1|s1');
        fireEvent.click(screen.getByRole('button', { name: 'Preview what Riya will say' }));
        await screen.findByText(/Number that will ring: \+919800000001/);
        fireEvent.click(screen.getByRole('button', { name: 'Place call' }));
        const dialog = await screen.findByRole('alertdialog');
        expect(await within(dialog).findByText('Webhook reachable, signature check on')).toBeTruthy();
        const confirm = within(dialog).getByRole('button', { name: 'Place call' }) as HTMLButtonElement;
        await waitFor(() => expect(confirm.disabled).toBe(false));
        fireEvent.click(confirm);
        await waitFor(() => expect(outbound).toHaveBeenCalledTimes(1));
        const stored = await deps.calls.listCalls(ORG, 10);
        expect(stored).toHaveLength(1);
        expect(stored[0]).toMatchObject({ provider: 'elevenlabs', destination: 'test_phone', phoneLast4: '0001', providerConversationId: 'conv_panel_1' });
    });
});
