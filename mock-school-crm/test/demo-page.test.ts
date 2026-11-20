/**
 * The demo page (GET /): the office dashboard's sections render from real state,
 * the CSS-only office-action tabs are wired without script, every form keeps the
 * action and field names the calling system and tests depend on, the last pull
 * is tracked in memory, and the page never references an external asset.
 */

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { formatDateRuns, holidayGroups, OFFICE_TABS } from '../src/demo-page';
import { createPullTracker } from '../src/pulls';
import { api, crawl, startServer, submitDemo, type TestServer } from './helpers';

// 2026-10-07 08:42 UTC = 14:12 IST, a Wednesday.
const NOW = new Date('2026-10-07T08:42:00Z');

async function page(baseUrl: string, path = '/'): Promise<string> {
    const res = await fetch(`${baseUrl}${path}`);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get('content-type') ?? '', /text\/html/);
    return res.text();
}

/** The attribute values of every element with `attr` inside one form. */
function formFields(html: string, action: string): { method: string; names: string[] } {
    const m = new RegExp(`<form method="(\\w+)" action="${action.replace(/\//g, '\\/')}"[^>]*>([\\s\\S]*?)</form>`).exec(html);
    assert.ok(m, `no form posting to ${action}`);
    const names = [...(m[2] ?? '').matchAll(/<(?:input|select|textarea)\b[^>]*\bname="([^"]+)"/g)].map((x) => x[1] ?? '');
    return { method: m[1] ?? '', names: [...new Set(names)].sort() };
}

/** Every external reference a page could load: script, stylesheet, font, image, frame, CSS url()/@import, any http(s) URL. */
function assertNoExternalAssets(html: string, where: string): void {
    assert.doesNotMatch(html, /https?:\/\//i, `${where}: an http(s) URL appears in the page`);
    assert.doesNotMatch(html, /<(script|link|img|iframe|object|embed|video|audio|source)\b/i, `${where}: an element that loads a resource`);
    assert.doesNotMatch(html, /@import|@font-face|url\(/i, `${where}: CSS that loads a resource`);
    assert.doesNotMatch(html, /\bsrc\s*=/i, `${where}: a src attribute`);
    assert.doesNotMatch(html, /href="(?!#|\/(?!\/))/i, `${where}: a link that leaves this site`);
}

let srv: TestServer;
before(async () => {
    srv = await startServer({ now: () => NOW });
});
after(async () => {
    await srv.close();
});

describe('demo page layout', () => {
    test('renders the app bar, module rail, header and every dashboard section from state', async () => {
        const html = await page(srv.baseUrl);
        const state = srv.app.state;
        // App bar
        assert.match(html, /<div class="crest" aria-hidden="true">HV<\/div>/);
        assert.match(html, /Demo records system · CBSE · Siliguri/);
        assert.match(html, /Synthetic data · numbers cannot ring/);
        assert.match(html, /<form class="search" method="get" action="\/" role="search">/);
        // Rail: Dashboard current, then the modules with live counts.
        assert.match(html, /<nav class="rail" aria-label="Office modules">/);
        assert.match(html, /<a href="#dashboard" aria-current="page"><span>Dashboard<\/span><\/a>/);
        const live = state.students.filter((s) => !s.deleted && s.status === 'active').length;
        const guardians = state.guardians.filter((g) => !g.deleted).length;
        assert.match(html, new RegExp(`<span>Students</span><span class="count">${live}</span>`));
        assert.match(html, new RegExp(`<span>Guardians</span><span class="count">${guardians}</span>`));
        assert.match(html, /<span>Holistic cards<\/span><span class="count">2,983<\/span>/);
        for (const name of ['Attendance', 'Events', 'Communications', 'Integrations']) assert.match(html, new RegExp(`<span>${name}</span><span class="count">`));
        // Every rail link lands on something on this page.
        const rail = /<nav class="rail"[\s\S]*?<\/nav>/.exec(html)?.[0] ?? '';
        const railTargets = [...rail.matchAll(/href="#([^"]+)"/g)].map((x) => x[1]);
        assert.equal(railTargets.length, 8);
        for (const id of railTargets) assert.match(html, new RegExp(`id="${id}"`), `rail link #${id} has no target`);
        // Header
        assert.match(html, /Wed 7 Oct 2026 · Academic year 2026-27/);
        assert.match(html, /<h1 id="dashboard">Office dashboard<\/h1>/);
        // KPI tiles
        assert.match(html, /aria-label="School at a glance"/);
        assert.equal(html.match(/<div class="kpi">/g)?.length, 6);
        assert.match(html, new RegExp(`Active students</span><span class="kpi-value" style="color: var\\(--ink\\)">${live}<`));
        assert.match(html, /Classes 1 to 10, A and B/);
        assert.match(html, /1 marked do-not-contact/);
        // Sections
        for (const heading of ['Office actions', 'Upcoming events', 'Guardian languages', 'Records to check', 'Calls written back by SahayakAI', 'SahayakAI connection']) {
            assert.match(html, new RegExp(`<h2 id="[^"]+">${heading}</h2>`), heading);
        }
        // The seed's register ends on the anchor date, so "today" falls back to the last marked day, honestly labelled.
        assert.match(html, /<h2 id="attendance-h">Attendance, last marked day<\/h2>/);
        assert.match(html, /showing Wed 30 Sep, the last marked day/);
        assert.match(html, /<th scope="col">Section A<\/th><th scope="col">Section B<\/th>/);
        assert.equal(html.match(/<th scope="row">Class \d+<\/th>/g)?.length, 10);
        assert.match(html, /<span class="cell tone-[a-z]+"><span>\d+\/\d+ present<\/span>/);
        // Events: the 7B PTM, then the Durga Puja break grouped across the weekend.
        assert.match(html, /Parent-Teacher Meeting, Class 7B<\/span><span class="ev-sub">Sat 10:00 to 13:00 · School Hall · Class 7B · RSVPs on/);
        assert.match(html, /Durga Puja break<\/span><span class="ev-sub">Holidays 16 and 19 to 23 Oct/);
        // Languages
        assert.match(html, /<div class="langbar" role="img" aria-label="Nepali \d+ percent, Bengali \d+ percent, Hindi \d+ percent, English \d+ percent, Not recorded under 1 percent">/);
        // Records to check: planted malformed rows, custody restriction, the left student, do-not-contact.
        const p = state.planted;
        assert.match(html, new RegExp(`Student rows that fail the contract</span><span class="check-ids">${p.malformed.studentIds.join(', ')}</span></span><span class="n-badge tone-bad">2<`));
        assert.match(html, new RegExp(`Guardian rows that fail the contract</span><span class="check-ids">${p.malformed.guardianIds.join(', ')}</span>`));
        assert.match(html, new RegExp(`Custody restriction on file</span><span class="check-ids">${p.custodyRestriction.studentId}</span>`));
        assert.match(html, new RegExp(`Students who left</span><span class="check-ids">${p.leftStudent.studentId}</span>`));
        assert.match(html, new RegExp(`Guardians marked do-not-contact</span><span class="check-ids">${p.doNotContactGuardian.guardianId}</span>`));
        assert.match(html, /Guardians without consent recorded<\/span><span class="check-ids">notices consent missing or unknown<\/span><\/span><span class="n-badge tone-warn">\d+</);
        // Connection card
        assert.match(html, /<dt>Contract<\/dt><dd class="mono">school-CRM v1<\/dd>/);
        assert.match(html, /<dt>API key<\/dt><dd class="mono">••••••••-123<\/dd>/, 'only the last four characters of the key');
        assert.doesNotMatch(html, /test-key-123/);
        assert.match(html, /Off\. Set SAHAYAKAI_WEBHOOK_URL and SAHAYAKAI_WEBHOOK_SECRET/);
        assert.match(html, /POST \/v1\/communications · \/v1\/events\/\{id\}\/rsvps/);
    });

    test('communications: empty state names POST /v1/communications; a write-back appears in the table', async () => {
        const fresh = await startServer({ now: () => NOW });
        try {
            const empty = await page(fresh.baseUrl);
            assert.match(empty, /<p class="empty">Nothing written back yet\.[^<]*POST \/v1\/communications/);
            const res = await api(fresh.baseUrl, '/v1/communications', {
                method: 'POST',
                body: JSON.stringify({
                    externalId: 'page-call-1',
                    channel: 'voice_call',
                    guardianId: 'gdn_0001',
                    purpose: 'ptm_invite',
                    language: 'ne',
                    outcome: 'answered',
                    keysPressed: ['1'],
                    occurredAt: '2026-10-07T08:40:00Z',
                }),
            });
            assert.equal(res.status, 201);
            const html = await page(fresh.baseUrl);
            assert.match(html, /latest 1 of 1 · 1 today/);
            assert.match(html, /<tr><td class="mono muted">14:10<\/td><td><strong>Sarita Gurung<\/strong> <span class="mono muted">gdn_0001<\/span><\/td><td class="mono">ptm_invite<\/td><td><span class="badge tone-ok">answered<\/span><\/td><td class="mono">ne<\/td><td class="mono">1<\/td><\/tr>/);
            assert.match(html, /Calls written back<\/span><span class="kpi-value" style="color: var\(--primary\)">1</);
        } finally {
            await fresh.close();
        }
    });

    test('marking a student absent today switches the grid to today and counts the missing leave note', async () => {
        const fresh = await startServer({ now: () => NOW });
        try {
            const student = fresh.app.state.students.find((s) => !s.deleted && s.status === 'active' && s.grade === 4 && s.section === 'A');
            assert.ok(student);
            const location = await submitDemo(fresh.baseUrl, 'absent', { studentId: student.id });
            assert.match(location, /^\/\?done=.*&tab=absent$/);
            const html = await page(fresh.baseUrl, location);
            assert.match(html, /<h2 id="attendance-h">Attendance today<\/h2><span class="card-sub"><strong>1 absent<\/strong> · 1 without a leave note<\/span>/);
            assert.match(html, /<th scope="row">Class 4<\/th><td><span class="cell tone-hot"><span>\d+\/\d+ present<\/span><b>1 absent · 1 no note<\/b>/);
            assert.match(html, /Absent today<\/span><span class="kpi-value" style="color: var\(--warn\)">1</);
            assert.match(html, /<p class="banner banner-ok" role="status">[^<]*marked absent for 2026-10-07\.<\/p>/);
        } finally {
            await fresh.close();
        }
    });
});

describe('office actions', () => {
    const EXPECTED_FIELDS: Record<string, string[]> = {
        '/demo/closure': ['reason', 'when'],
        '/demo/absent': ['studentId'],
        '/demo/event': ['audience', 'date', 'endTime', 'kind', 'rsvpEnabled', 'startTime', 'title', 'venueId'],
        '/demo/meeting': ['reasonCode', 'requestedByRole', 'studentId'],
        '/demo/incident': ['reasonCode', 'reportedByRole', 'severity', 'studentId'],
        '/demo/guardian': ['doNotContact', 'guardianId'],
        '/demo/hpc': ['ability', 'note', 'respondentType', 'sentiment', 'studentId'],
    };

    test('every form keeps its action, method and exact field names', async () => {
        const html = await page(srv.baseUrl);
        const actions = [...html.matchAll(/<form method="post" action="(\/demo\/[a-z]+)"/g)].map((m) => m[1]);
        assert.deepEqual(actions.sort(), Object.keys(EXPECTED_FIELDS).sort(), 'one form per demo action, none missing or extra');
        for (const [action, fields] of Object.entries(EXPECTED_FIELDS)) {
            const form = formFields(html, action);
            assert.equal(form.method, 'post', action);
            assert.deepEqual(form.names, fields, action);
        }
    });

    test('every control has a label and every submit is a real button', async () => {
        const html = await page(srv.baseUrl);
        // Controls are wrapped in <label>, except the search box which uses for/id.
        const controls = [...html.matchAll(/<(input|select|textarea)\b[^>]*>/g)];
        assert.ok(controls.length > 20);
        for (const c of controls) {
            const at = c.index ?? 0;
            const before = html.slice(0, at);
            const insideLabel = before.lastIndexOf('<label') > before.lastIndexOf('</label>');
            const id = /\bid="([^"]+)"/.exec(c[0])?.[1];
            assert.ok(insideLabel || (id && html.includes(`for="${id}"`)), `unlabelled control: ${c[0].slice(0, 80)}`);
        }
        const forms = [...html.matchAll(/<form\b[\s\S]*?<\/form>/g)];
        for (const f of forms) assert.match(f[0], /<button type="submit"/, 'each form submits with a real button');
    });

    test('the tabs work without script: each tab links to a panel id, :target shows it, the default panel is last', async () => {
        const html = await page(srv.baseUrl);
        assert.doesNotMatch(html, /<script/i);
        // CSS: hidden by default, :target shows a panel, and a targeted panel hides the default one.
        assert.match(html, /\.panel \{ display: none;/);
        assert.match(html, /\.panel:target, \.panel-default \{ display: block; \}/);
        assert.match(html, /\.panel:target ~ \.panel-default \{ display: none; \}/);

        const panels = [...html.matchAll(/<section class="panel( panel-default)?" id="act-([a-z]+)"[^>]*>([\s\S]*?)<\/section>/g)];
        assert.deepEqual(panels.map((p) => p[2]).sort(), OFFICE_TABS.map((t) => t.id).sort(), 'one panel per tab');
        for (const p of panels) {
            const id = p[2] ?? '';
            const body = p[3] ?? '';
            // The panel holds its own form and a tab bar marking itself current.
            assert.match(body, new RegExp(`<form method="post" action="/demo/${id}"`), `panel act-${id} holds the ${id} form`);
            assert.match(body, new RegExp(`<a class="tab" href="#act-${id}" aria-current="true">`), `panel act-${id} marks its own tab`);
            assert.equal(body.match(/aria-current="true"/g)?.length, 1);
            // Every tab in it links to a panel that exists.
            for (const t of OFFICE_TABS) assert.match(body, new RegExp(`href="#act-${t.id}"`));
        }
        const defaults = panels.filter((p) => p[1]);
        assert.equal(defaults.length, 1, 'exactly one default panel');
        assert.equal(defaults[0]?.[2], 'closure', 'closure is the default tab');
        assert.equal(panels.at(-1)?.[2], 'closure', 'the default panel is the last sibling, so a targeted panel can hide it');
        assert.equal(new Set(panels.map((p) => p[2])).size, panels.length, 'ids are unique');

        // ?tab= picks the default (the redirect after a demo action uses it); junk falls back to closure.
        const absent = await page(srv.baseUrl, '/?tab=absent');
        const absentPanels = [...absent.matchAll(/<section class="panel( panel-default)?" id="act-([a-z]+)"/g)];
        assert.equal(absentPanels.at(-1)?.[2], 'absent');
        assert.equal(absentPanels.at(-1)?.[1], ' panel-default');
        const junk = await page(srv.baseUrl, '/?tab=%3Cscript%3E');
        assert.match(junk, /<section class="panel panel-default" id="act-closure"/);
        assert.doesNotMatch(junk, /<script/i);
    });

    test('a demo action redirects back to its own tab, with the flash or error banner', async () => {
        const done = await submitDemo(srv.baseUrl, 'closure', { when: 'tomorrow', reason: 'heavy_rain' });
        assert.match(done, /^\/\?done=[^&]+&tab=closure$/);
        const failed = await submitDemo(srv.baseUrl, 'meeting', { studentId: 'stu_0000', reasonCode: 'conduct', requestedByRole: 'principal' });
        assert.match(failed, /^\/\?error=[^&]+&tab=meeting$/);
        const html = await page(srv.baseUrl, failed);
        assert.match(html, /<p class="banner banner-err" role="alert">choose a student<\/p>/);
        assert.match(html, /<section class="panel panel-default" id="act-meeting"/);
    });
});

describe('search', () => {
    test('GET /?q= lists matching students and guardians', async () => {
        const html = await page(srv.baseUrl, '/?q=gurung');
        assert.match(html, /<h2 id="search-h">Search: “gurung”<\/h2>/);
        assert.match(html, /stu_0128/);
        assert.match(html, /gdn_0001/);
        assert.match(html, /value="gurung"/, 'the search box keeps the query');
        const byAdmission = await page(srv.baseUrl, `/?q=${encodeURIComponent(srv.app.state.students[5]?.admissionNo ?? '')}`);
        assert.match(byAdmission, new RegExp(String(srv.app.state.students[5]?.id)));
        const none = await page(srv.baseUrl, '/?q=zzzzqqq');
        assert.match(none, /No student or guardian matches “zzzzqqq”/);
        const plain = await page(srv.baseUrl);
        assert.doesNotMatch(plain, /id="search-results"/, 'no results card without a query');
    });
});

describe('escaping and external assets', () => {
    test('every interpolated value is escaped', async () => {
        const evil = '<img src=x onerror=alert(1)>"\'';
        const html = await page(srv.baseUrl, `/?q=${encodeURIComponent(evil)}&done=${encodeURIComponent(evil)}&error=${encodeURIComponent(evil)}`);
        assert.ok(!html.includes('<img'), 'raw markup from the query string reached the page');
        assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;&quot;&#39;/);
        // A guardian name with quotes in state is escaped wherever it appears.
        assert.match(await page(srv.baseUrl, '/?q=minnie'), /Mary &quot;Minnie&quot; Thomas/);
    });

    test('no page variant references an external URL or loads an asset', async () => {
        for (const path of ['/', '/?q=gurung', '/?q=x', '/?done=Saved&tab=hpc', '/?error=Nope&tab=event']) {
            assertNoExternalAssets(await page(srv.baseUrl, path), path);
        }
        // The font stack names IBM Plex with system fallbacks; nothing downloads it.
        const html = await page(srv.baseUrl);
        assert.match(html, /--sans: "IBM Plex Sans", system-ui/);
        assert.match(html, /--mono: "IBM Plex Mono", ui-monospace/);
    });
});

describe('last pull', () => {
    test('the tracker sums a paged crawl into one pull and restarts on a fresh first page', () => {
        let t = Date.parse('2026-10-07T08:00:00Z');
        const tracker = createPullTracker(() => new Date(t));
        assert.deepEqual(tracker.snapshot(), { students: null, guardians: null });
        tracker.page('guardians', { records: 200, continued: false, incremental: false, complete: false });
        t += 1000;
        tracker.page('guardians', { records: 200, continued: true, incremental: false, complete: false });
        t += 1000;
        tracker.page('guardians', { records: 45, continued: true, incremental: false, complete: true });
        assert.deepEqual(tracker.snapshot().guardians, { at: '2026-10-07T08:00:02.000Z', records: 445, requests: 3, via: 'api', incremental: false, complete: true });
        tracker.page('guardians', { records: 3, continued: false, incremental: true, complete: true });
        assert.equal(tracker.snapshot().guardians?.records, 3);
        assert.equal(tracker.snapshot().guardians?.incremental, true);
        tracker.csv('students', 401);
        assert.equal(tracker.snapshot().students?.via, 'csv');
        // A snapshot is a copy.
        const snap = tracker.snapshot();
        if (snap.students) snap.students.records = 0;
        assert.equal(tracker.snapshot().students?.records, 401);
    });

    test('authenticated list GETs and CSV exports are recorded; failures and unauthenticated calls are not', async () => {
        let now = new Date('2026-10-07T08:30:00Z'); // 14:00 IST
        const fresh = await startServer({ now: () => now });
        try {
            let html = await page(fresh.baseUrl);
            assert.match(html, /SahayakAI has not pulled these records yet/);
            assert.match(html, /<dt>Last pull<\/dt><dd>Not pulled yet since this server started<\/dd>/);
            assert.match(html, /Waiting for first pull/);
            assert.equal(fresh.app.lastPull().students, null);

            // Unauthenticated, rejected and by-id requests do not count.
            assert.equal((await fetch(`${fresh.baseUrl}/v1/students`)).status, 401);
            assert.equal((await api(fresh.baseUrl, '/v1/students?limit=0')).status, 400);
            assert.equal((await api(fresh.baseUrl, '/v1/students/stu_0128')).status, 200);
            assert.deepEqual(fresh.app.lastPull(), { students: null, guardians: null });

            const state = fresh.app.state;
            const students = await crawl(fresh.baseUrl, '/v1/students', { limit: '150' });
            assert.equal(students.records.length, state.students.length);
            now = new Date('2026-10-07T08:42:00Z'); // 14:12 IST
            const guardians = await crawl(fresh.baseUrl, '/v1/guardians', { limit: '200' });
            const pulls = fresh.app.lastPull();
            assert.equal(pulls.students?.records, state.students.length);
            assert.equal(pulls.students?.requests, students.pages);
            assert.equal(pulls.students?.complete, true);
            assert.equal(pulls.guardians?.records, state.guardians.length);
            assert.equal(pulls.guardians?.at, '2026-10-07T08:42:00.000Z');

            html = await page(fresh.baseUrl);
            assert.match(html, /<p class="pulled" id="last-pull"><span class="dot" aria-hidden="true"><\/span>SahayakAI pulled these records at 14:12<\/p>/);
            assert.match(
                html,
                new RegExp(`<dt>Last pull</dt><dd>14:12 · ${state.students.length} students \\(at 14:00\\), ${state.guardians.length} guardians</dd>`),
            );
            assert.match(html, /<span class="pill tone-ok">Connected<\/span>/);

            // A CSV export is a pull of every row it served, malformed rows included when asked for.
            now = new Date('2026-10-07T09:00:00Z'); // 14:30 IST
            assert.equal((await api(fresh.baseUrl, '/v1/export/students.csv?includeMalformed=true')).status, 200);
            assert.equal(fresh.app.lastPull().students?.records, state.students.length + state.malformed.students.length);
            html = await page(fresh.baseUrl);
            assert.match(html, /SahayakAI pulled these records at 14:30/);
            assert.match(html, new RegExp(`${state.students.length + state.malformed.students.length} students \\(CSV export\\)`));

            // An incremental pull reads as changes only.
            await api(fresh.baseUrl, `/v1/guardians?updatedSince=${encodeURIComponent('2026-09-28T00:00:00+05:30')}`);
            assert.equal(fresh.app.lastPull().guardians?.incremental, true);
            assert.match(await page(fresh.baseUrl), /\d+ changed guardians/);
        } finally {
            await fresh.close();
        }
    });

    test('the pull log is not written to the state file', async () => {
        const fresh = await startServer({ now: () => NOW });
        try {
            await crawl(fresh.baseUrl, '/v1/students', { limit: '200' });
            assert.ok(fresh.app.lastPull().students);
            assert.ok(!('pulls' in fresh.app.state) && !('lastPull' in fresh.app.state));
            assert.doesNotMatch(JSON.stringify(fresh.app.state), /lastPull|"pulls"/);
        } finally {
            await fresh.close();
        }
    });
});

describe('helpers', () => {
    test('formatDateRuns and holidayGroups', () => {
        assert.equal(formatDateRuns(['2026-10-16', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']), '16 and 19 to 23 Oct');
        assert.equal(formatDateRuns(['2026-11-09', '2026-11-10']), '9 and 10 Nov');
        assert.equal(formatDateRuns(['2026-12-25']), '25 Dec');
        assert.equal(formatDateRuns(['2026-12-31', '2027-01-01', '2027-01-02']), '31 Dec to 2 Jan');
        const groups = holidayGroups(
            [
                { date: '2026-10-02', name: 'Gandhi Jayanti' },
                { date: '2026-10-16', name: 'Durga Puja break' },
                { date: '2026-10-19', name: 'Durga Puja break' },
                { date: '2026-10-20', name: 'Durga Puja break (Vijaya Dashami)' },
                { date: '2026-11-09', name: 'Kali Puja and Tihar' },
                { date: '2026-11-10', name: 'Bhai Tika' },
            ],
            '2026-10-07',
        );
        assert.deepEqual(
            groups.map((g) => [g.date, g.title, g.sub]),
            [
                ['2026-10-16', 'Durga Puja break', 'Holidays 16, 19 and 20 Oct'],
                ['2026-11-09', 'Kali Puja and Tihar, Bhai Tika', 'Holidays 9 and 10 Nov'],
            ],
        );
    });
});
