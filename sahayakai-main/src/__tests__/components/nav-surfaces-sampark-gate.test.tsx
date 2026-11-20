/**
 * Class gate: no SahayakAI navigation surface links to SamparkAI while
 * SamparkAI is off, and Attendance is always the teacher's /attendance.
 *
 * The bug (2026-11-15): the sidebar Attendance item, the sidebar footer
 * SamparkAI entry and the command palette all pointed at
 * /sampark/choose-provider. Production runs SAMPARK_ENABLED=false
 * (cloudbuild.yaml), so that page's only API call (/api/sampark/provider)
 * answered 404 and every teacher who clicked Attendance got an error page
 * instead of the class registers and parent-call modal at /attendance.
 *
 * The class: any SahayakAI surface that links to a SamparkAI page without
 * asking the server whether SamparkAI is on. This file renders every
 * navigation surface (desktop sidebar + rail, the phone menu sheet's
 * sidebar, the phone tab bar, the command palette, the dashboard home)
 * with the real /api/me/nav-access handler and the real useNavAccess hook
 * between them and process.env.SAMPARK_ENABLED, then collects every link
 * target. A last check fails when a new file outside SamparkAI starts
 * linking to it without being added to the surfaces rendered here.
 */

import fs from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

// ── The real nav-access handler, behind a mocked transport ──────────────────

// The project's jsdom env does not keep NextResponse.json bodies through
// `await res.json()` (see video-storyteller-quota.test.ts); mirror it.
jest.mock('next/server', () => ({
    NextResponse: {
        json: (data: unknown, init?: { status?: number }) => ({
            status: init?.status ?? 200,
            ok: (init?.status ?? 200) < 400,
            json: async () => data,
        }),
    },
}));
jest.mock('@/lib/auth-utils', () => ({ isAdmin: jest.fn(async () => false) }));
jest.mock('@/lib/feature-flags', () => ({
    readConfig: jest.fn(async () => ({})),
    isFeatureEnabled: jest.fn(async () => ({ enabled: false })),
}));

const mockApiFetch = jest.fn();
jest.mock('@/lib/api/client', () => ({
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

// ── App context mocks (auth, i18n, router, firebase) ────────────────────────

const TEACHER_UID = 'teacher-1';
const mockPush = jest.fn();

jest.mock('firebase/auth', () => ({
    onAuthStateChanged: jest.fn((_auth: unknown, cb: (u: { uid: string }) => void) => {
        cb({ uid: 'teacher-1' });
        return jest.fn();
    }),
}));
jest.mock('firebase/firestore', () => ({
    collection: jest.fn(() => ({})),
    query: jest.fn(() => ({})),
    where: jest.fn(() => ({})),
    doc: jest.fn(() => ({})),
    getDoc: jest.fn(() => Promise.resolve({ data: () => ({}) })),
    updateDoc: jest.fn(() => Promise.resolve()),
    onSnapshot: jest.fn(() => jest.fn()),
}));
jest.mock('@/lib/firebase', () => ({ db: {}, auth: { currentUser: null } }));
jest.mock('@/context/auth-context', () => ({
    useAuth: () => ({ user: { uid: 'teacher-1', displayName: 'Meena' }, loading: false, requireAuth: () => true, openAuthModal: jest.fn() }),
}));
jest.mock('@/context/language-context', () => ({
    ...jest.requireActual('@/context/language-context'),
    useLanguage: () => ({ t: (k: string) => k, language: 'English', isLoaded: true }),
}));
jest.mock('next/navigation', () => ({
    usePathname: () => '/',
    useRouter: () => ({ push: mockPush, replace: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() }),
}));
jest.mock('next/link', () => {
    const { forwardRef } = jest.requireActual('react');
    return {
        __esModule: true,
        default: forwardRef(({ href, children, ...rest }: { href: string; children: React.ReactNode }, ref: React.Ref<HTMLAnchorElement>) => (
            <a ref={ref} href={href} {...rest}>{children}</a>
        )),
    };
});

// Sidebar side-effects.
jest.mock('@/lib/profile-utils', () => ({ isNewUser: jest.fn(() => false) }));
jest.mock('@/lib/api/profile', () => ({ updateProfileAction: jest.fn() }));
jest.mock('@/components/onboarding/feature-spotlight', () => ({
    FeatureSpotlight: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SPOTLIGHT_IDS: { SIDEBAR_LESSON_PLAN: 'spot-1', HOME_VOICE_INPUT: 'home-voice-input' },
}));

// Dashboard data hooks (as in vidya/dashboard-home-orb.test.tsx).
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock('@/hooks/use-onboarding-progress', () => ({
    useOnboardingProgress: () => ({
        isNewUser: false, generationCount: 3, checklistItems: [], suggestions: [], phase: 'done', advancePhase: jest.fn(),
        profile: null, profileSummary: null, spotlightsSeen: ['home-voice-input'], markSpotlightSeen: jest.fn(),
        showProfileCompletion: false, checklistDismissed: true, isFirstWeek: false,
        refreshSuggestions: jest.fn(), dismissProfileCard: jest.fn(), dismissChecklist: jest.fn(),
    }),
}));
jest.mock('@/hooks/use-community-intro', () => ({ useCommunityIntro: () => ({ showNudge: false, dismissNudge: jest.fn(), markVisited: jest.fn(), trackGeneration: jest.fn() }) }));
jest.mock('@/components/dashboard/recent-work-strip', () => ({ RecentWorkStrip: () => null }));
jest.mock('@/components/landing/sample-output-section', () => ({ SampleOutputSection: () => null }));
jest.mock('@/components/landing/demo-interaction', () => ({ DemoInteraction: () => null }));
jest.mock('@/components/community/community-nudge-banner', () => ({ CommunityNudgeBanner: () => null }));

import { AppSidebar } from '@/components/app-sidebar';
import { CommandPalette } from '@/components/command-palette';
import { DashboardHome } from '@/components/dashboard/dashboard-home';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { GET as navAccessGET } from '@/app/api/me/nav-access/route';
import { samparkEntryUrl } from '@/lib/products';

// The middleware sets x-user-id after verifying the Firebase token; the
// handler reads only that header.
function routeThroughHandler() {
    mockApiFetch.mockImplementation(async (url: string) => {
        if (url !== '/api/me/nav-access') throw new Error(`unexpected apiFetch ${url}`);
        const req = { headers: new Map([['x-user-id', TEACHER_UID]]) };
        const res = await navAccessGET(req as never);
        return res.json();
    });
}

/** True for any URL that opens SamparkAI: the /sampark tree or a sampark.* host. */
function opensSampark(href: string): boolean {
    const u = new URL(href, 'https://www.sahayakai.com');
    return u.hostname.startsWith('sampark.') || u.pathname === '/sampark' || u.pathname.startsWith('/sampark/');
}

/** Let the nav-access request (handler → hook → state) settle. */
async function settle() {
    await act(async () => {
        await Promise.allSettled(mockApiFetch.mock.results.map((r) => r.value));
        await new Promise((r) => setTimeout(r, 0));
    });
}

function linkTargets(root: ParentNode = document): string[] {
    return [...root.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') as string);
}

async function renderSidebar(props: { forceFull?: boolean } = {}) {
    const view = render(<AppSidebar {...props} onNavigate={props.forceFull ? jest.fn() : undefined} />);
    await settle();
    // Open the folded Explore group so every link is in the DOM.
    for (const b of screen.getAllByRole('button', { name: /explore/i })) {
        if (b.getAttribute('aria-expanded') === 'false') fireEvent.click(b);
    }
    return view;
}

function openPalette() {
    act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    });
}

/** Every destination the palette offers: select each item and record where it goes. */
async function paletteTargets(): Promise<Array<{ label: string; href: string }>> {
    render(<CommandPalette />);
    await settle();
    openPalette();
    const count = document.querySelectorAll('[cmdk-item]').length;
    const out: Array<{ label: string; href: string }> = [];
    for (let i = 0; i < count; i += 1) {
        if (!document.querySelector('[cmdk-item]')) openPalette();
        const item = document.querySelectorAll('[cmdk-item]')[i] as HTMLElement;
        mockPush.mockClear();
        fireEvent.click(item);
        expect(mockPush).toHaveBeenCalledTimes(1);
        out.push({ label: item.textContent?.trim() ?? '', href: mockPush.mock.calls[0][0] });
    }
    return out;
}

const savedEnv = process.env.SAMPARK_ENABLED;

beforeEach(() => {
    mockApiFetch.mockReset();
    mockPush.mockReset();
    routeThroughHandler();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterAll(() => {
    if (savedEnv === undefined) delete process.env.SAMPARK_ENABLED;
    else process.env.SAMPARK_ENABLED = savedEnv;
});

describe('navigation surfaces with SamparkAI off (SAMPARK_ENABLED unset, as in production)', () => {
    beforeEach(() => {
        delete process.env.SAMPARK_ENABLED;
    });

    it('the desktop sidebar and rail link to no SamparkAI page, and Attendance is /attendance', async () => {
        await renderSidebar();
        expect(mockApiFetch).toHaveBeenCalledWith('/api/me/nav-access', expect.anything());
        const hrefs = linkTargets();
        expect(hrefs.length).toBeGreaterThan(10);
        expect(hrefs.filter(opensSampark)).toEqual([]);
        expect(screen.queryAllByTestId('sampark-entry')).toHaveLength(0);
        const attendance = screen.getAllByRole('link', { name: /Attendance/ });
        expect(attendance.length).toBeGreaterThan(0);
        for (const a of attendance) expect(a).toHaveAttribute('href', '/attendance');
    });

    it('the phone menu sheet (the sidebar in forceFull) links to no SamparkAI page, and Attendance is /attendance', async () => {
        await renderSidebar({ forceFull: true });
        const nav = screen.getByRole('navigation', { name: 'SahayakAI' });
        expect(linkTargets().filter(opensSampark)).toEqual([]);
        const attendance = within(nav).getAllByRole('link', { name: /Attendance/ });
        for (const a of attendance) expect(a).toHaveAttribute('href', '/attendance');
    });

    it('the phone tab bar links to no SamparkAI page', () => {
        render(<MobileBottomNav />);
        const hrefs = linkTargets();
        expect(hrefs.length).toBe(4);
        expect(hrefs.filter(opensSampark)).toEqual([]);
    });

    it('the command palette offers no SamparkAI destination, and Attendance goes to /attendance', async () => {
        const targets = await paletteTargets();
        expect(mockApiFetch).toHaveBeenCalledWith('/api/me/nav-access', expect.anything());
        expect(targets.length).toBeGreaterThan(10);
        expect(targets.filter((x) => opensSampark(x.href))).toEqual([]);
        expect(targets.find((x) => x.label === 'Attendance')?.href).toBe('/attendance');
        expect(targets.some((x) => /SamparkAI/.test(x.label))).toBe(false);
    });

    it('the dashboard home links to no SamparkAI page', async () => {
        render(<DashboardHome />);
        await settle();
        const hrefs = linkTargets();
        expect(hrefs.length).toBeGreaterThan(0);
        expect(hrefs.filter(opensSampark)).toEqual([]);
    });

    it('a failed nav-access request keeps SamparkAI hidden (fail closed)', async () => {
        process.env.SAMPARK_ENABLED = 'true';
        mockApiFetch.mockImplementation(async () => { throw new Error('network'); });
        await renderSidebar();
        expect(screen.queryAllByTestId('sampark-entry')).toHaveLength(0);
        expect(linkTargets().filter(opensSampark)).toEqual([]);
    });

    it.each(['false', '1', 'TRUE', ''])('SAMPARK_ENABLED=%j counts as off', async (value) => {
        process.env.SAMPARK_ENABLED = value;
        const res = await navAccessGET({ headers: new Map([['x-user-id', TEACHER_UID]]) } as never);
        expect(await res.json()).toEqual({ staff: false, labs: false, sampark: false });
    });
});

describe('navigation surfaces with SamparkAI on (SAMPARK_ENABLED=true)', () => {
    beforeEach(() => {
        process.env.SAMPARK_ENABLED = 'true';
    });

    it('nav-access reports it', async () => {
        const res = await navAccessGET({ headers: new Map([['x-user-id', TEACHER_UID]]) } as never);
        expect(await res.json()).toEqual({ staff: false, labs: false, sampark: true });
    });

    it('the sidebar shows the one SamparkAI entry in the footer (sidebar and rail); Attendance stays /attendance', async () => {
        await renderSidebar();
        const entries = screen.getAllByTestId('sampark-entry');
        expect(entries).toHaveLength(2);
        for (const e of entries) expect(e).toHaveAttribute('href', samparkEntryUrl());
        for (const a of screen.getAllByRole('link', { name: /Attendance/ })) expect(a).toHaveAttribute('href', '/attendance');
    });

    it('the phone menu sheet shows the SamparkAI entry too', async () => {
        await renderSidebar({ forceFull: true });
        expect(screen.getAllByTestId('sampark-entry').length).toBeGreaterThan(0);
    });

    it('the command palette lists "SamparkAI · School calls"; Attendance stays /attendance', async () => {
        const targets = await paletteTargets();
        expect(targets.find((x) => x.label === 'SamparkAI · School calls')?.href).toBe(samparkEntryUrl('/workspace'));
        expect(targets.find((x) => x.label === 'Attendance')?.href).toBe('/attendance');
    });
});

// A new SahayakAI surface that links to SamparkAI must join the render gate
// above (and so must hide its link while SamparkAI is off).
describe('every SahayakAI file that links to SamparkAI is a surface this gate renders', () => {
    const SRC = path.join(__dirname, '..', '..');
    const GATED = ['components/app-sidebar.tsx', 'components/command-palette.tsx'];
    // SamparkAI's own tree, server code, routing and the URL helpers
    // themselves, and the public marketing pages (outside the app shell).
    const OUT_OF_SCOPE = [
        /^app\/sampark\//, /^components\/sampark\//, /^app\/api\//, /^__tests__\//, /^lib\//, /^server\//,
        /^middleware\.ts$/, /^components\/shell\/product-paths\.ts$/,
        /^app\/\(marketing\)\//, /^components\/landing\//, /^components\/marketing\//,
    ];
    const LINKS_TO_SAMPARK = /\bsampark(?:Entry)?Url\(|\buseSamparkHref\(|\bSAMPARK_PREFIX\b|["']\/sampark(?:[/?"']|$)/;

    function walk(dir: string): string[] {
        return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
            const p = path.join(dir, d.name);
            if (d.isDirectory()) return walk(p);
            return /\.(tsx?|jsx?)$/.test(d.name) ? [p] : [];
        });
    }

    it('finds no unlisted file', () => {
        const linking = walk(SRC)
            .map((f) => path.relative(SRC, f).split(path.sep).join('/'))
            .filter((rel) => !OUT_OF_SCOPE.some((re) => re.test(rel)))
            .filter((rel) => LINKS_TO_SAMPARK.test(fs.readFileSync(path.join(SRC, rel), 'utf8')));
        expect(linking.filter((rel) => !GATED.includes(rel))).toEqual([]);
        // Not vacuous: the two gated surfaces really do link to SamparkAI.
        expect(linking.sort()).toEqual(GATED);
    });
});
