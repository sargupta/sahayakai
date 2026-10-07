/**
 * The demo page at GET /: the school office's own records screen (deliberately
 * not SahayakAI's look). Server-rendered HTML with no scripts and no external
 * assets (the IBM Plex fonts are named with system fallbacks, never loaded),
 * readable on a phone. In front of a principal you add a teacher's observation
 * or declare a closure and watch the calling system react, through the signed
 * webhook hints and its next pull.
 *
 * Office actions are CSS-only tabs. Each tab links to its panel's id and
 * `.panel:target` shows that panel. The default panel (?tab=, else closure) is
 * rendered last, so `.panel:target ~ .panel-default` hides it while another
 * panel is targeted. Every panel carries its own copy of the tab bar with the
 * right tab marked aria-current, so the bar stays correct (and in view after
 * the jump) without :has(). Without CSS, every form is stacked under its heading.
 */

import { CRM_API_VERSION, CrmGuardianSchema, CrmStudentSchema, type CrmGuardian, type CrmStudent } from './contract/crm-schema';
import { addDays, istDate, weekday } from './calendar';
import type { PullRecord, PullSnapshot } from './pulls';
import {
    CLOSURE_REASONS,
    EVENT_KINDS,
    HPC_ABILITIES,
    HPC_SENTIMENTS,
    INCIDENT_REASON_CODES,
    MEETING_REASON_CODES,
    RESPONDENT_TYPES,
} from './schemas';
import type { CrmState } from './state';
import type { DeliveryRecord } from './webhooks';

export interface DemoPageModel {
    state: CrmState;
    /** The IST date of "now". */
    today: string;
    flash: string | null;
    error: string | null;
    /** GET /?q=: filters a small list of students and guardians. */
    query: string | null;
    /** GET /?tab=: the office-action tab shown when the URL has no fragment. */
    tab: string | null;
    webhookEnabled: boolean;
    /** Webhook deliveries, newest first. */
    deliveries: readonly DeliveryRecord[];
    venues: Record<string, string>;
    /** The last authenticated pulls (in memory only). */
    pulls: PullSnapshot;
    /** The API key with all but its tail masked. */
    apiKeyHint: string;
}

/** The office-action tabs, in tab-bar order. Each id is also its POST /demo/<id> action. */
export const OFFICE_TABS = [
    { id: 'closure', label: 'Declare closure', title: 'Declare an emergency closure' },
    { id: 'absent', label: 'Mark absent', title: 'Mark a student absent today' },
    { id: 'event', label: 'Publish event', title: 'Publish an event' },
    { id: 'meeting', label: 'Request meeting', title: 'Request a meeting' },
    { id: 'incident', label: 'Log incident', title: 'Log an incident' },
    { id: 'guardian', label: 'Do not contact', title: "Change a guardian's do-not-contact" },
    { id: 'hpc', label: 'Card observation', title: 'Add a holistic-card observation' },
] as const;
export type OfficeTab = (typeof OFFICE_TABS)[number]['id'];
const DEFAULT_TAB: OfficeTab = 'closure';

const esc = (value: unknown): string =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const ACRONYMS: Record<string, string> = { ptm: 'PTM' };
const label = (code: string) => ACRONYMS[code] ?? code.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const options = (values: readonly string[], selected?: string) =>
    values.map((v) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(label(v))}</option>`).join('');

// ── Dates, times, numbers ────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const IST_OFFSET_MS = 330 * 60 * 1000;

const monthOf = (date: string) => MONTHS[Number(date.slice(5, 7)) - 1] ?? '';
const dayOf = (date: string) => String(Number(date.slice(8, 10)));
/** "7 Oct" */
const dayMonth = (date: string) => `${dayOf(date)} ${monthOf(date)}`;
/** "Wed 7 Oct" */
const shortDate = (date: string) => `${WEEKDAYS[weekday(date)] ?? ''} ${dayMonth(date)}`;
/** "Wed 7 Oct 2026" */
const longDate = (date: string) => `${shortDate(date)} ${date.slice(0, 4)}`;
/** IST "HH:MM" of an ISO instant. */
const istTime = (iso: string) => {
    const t = Date.parse(iso);
    return Number.isNaN(t) ? '' : new Date(t + IST_OFFSET_MS).toISOString().slice(11, 16);
};
const istDay = (iso: string) => {
    const t = Date.parse(iso);
    return Number.isNaN(t) ? '' : istDate(new Date(t));
};
/** "14:12" today, "30 Sep 14:12" on another day. */
const when = (iso: string, today: string) => {
    const day = istDay(iso);
    return day === today ? istTime(iso) : `${day ? dayMonth(day) : ''} ${istTime(iso)}`.trim();
};
const num = (n: number) => n.toLocaleString('en-IN');
const pct = (n: number, d: number) => (d === 0 ? 0 : (n / d) * 100);
const pctText = (n: number, d: number) => {
    const p = pct(n, d);
    return p > 0 && p < 1 ? 'under 1%' : `${Math.round(p)}%`;
};
const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;

// ── School identity ──────────────────────────────────────────────────────────

const GENERIC_WORDS = new Set(['the', 'of', 'school', 'demo', 'public', 'high', 'senior', 'secondary', 'academy', 'international']);

/** "Hillview Demo School, Siliguri" → "HV" (a compound like Hill+view gives both parts). */
export function crestInitials(name: string): string {
    const words = (name.split(',')[0] ?? name).split(/\s+/).filter((w) => w && !GENERIC_WORDS.has(w.toLowerCase()));
    const [first, second] = words;
    if (first && second) return `${first[0] ?? ''}${second[0] ?? ''}`.toUpperCase();
    const word = first ?? name;
    const compound = /^(.+?)(view|wood|field|dale|side|ridge|land|brook|vale|mount|hill)$/i.exec(word);
    return (compound ? `${compound[1]?.[0] ?? ''}${compound[2]?.[0] ?? ''}` : word.slice(0, 2)).toUpperCase();
}

// ── Form option lists ────────────────────────────────────────────────────────

function studentOptions(students: readonly CrmStudent[]): string {
    const groups = new Map<string, CrmStudent[]>();
    for (const s of students) {
        if (s.deleted || s.status !== 'active') continue;
        const key = `Class ${s.grade}${s.section}`;
        const list = groups.get(key) ?? [];
        list.push(s);
        groups.set(key, list);
    }
    return [...groups.entries()]
        .map(
            ([key, list]) =>
                `<optgroup label="${esc(key)}">${list
                    .sort((a, b) => a.rollNo - b.rollNo)
                    .map((s) => `<option value="${esc(s.id)}">${esc(`${s.rollNo}. ${s.fullName}`)}</option>`)
                    .join('')}</optgroup>`,
        )
        .join('');
}

function guardianOptions(guardians: readonly CrmGuardian[]): string {
    return guardians
        .filter((g) => !g.deleted)
        .map((g) => `<option value="${esc(g.id)}">${esc(`${g.fullName} (${g.id})${g.doNotContact ? ' - do not contact' : ''}`)}</option>`)
        .join('');
}

// ── Derived views of the state ───────────────────────────────────────────────

const LANGUAGE_NAMES: Record<string, string> = { ne: 'Nepali', bn: 'Bengali', hi: 'Hindi', en: 'English' };
const LANGUAGE_COLOURS = ['var(--lang-1)', 'var(--lang-2)', 'var(--lang-3)', 'var(--lang-4)'];

interface SectionAttendance {
    onRoll: number;
    away: number;
    noNote: number;
}

/**
 * Attendance for `today` if any mark exists for it, else the latest marked day
 * before it. Absent and on-leave marks count as away; everyone else on roll
 * counts as present (late is present), so a day where the office has only
 * marked absentees still reads correctly.
 */
function attendanceView(state: CrmState, live: readonly CrmStudent[], today: string) {
    const liveIds = new Set(live.map((s) => s.id));
    let day: string | null = null;
    for (const r of state.attendance) if (r.date <= today && liveIds.has(r.studentId) && (day === null || r.date > day)) day = r.date;
    const sections = new Map<string, SectionAttendance>();
    const key = (grade: number, section: string) => `${grade}|${section}`;
    for (const s of live) {
        const k = key(s.grade, s.section);
        const cur = sections.get(k) ?? { onRoll: 0, away: 0, noNote: 0 };
        cur.onRoll += 1;
        sections.set(k, cur);
    }
    let away = 0;
    let noNote = 0;
    if (day) {
        for (const r of state.attendance) {
            if (r.date !== day || !liveIds.has(r.studentId) || (r.status !== 'absent' && r.status !== 'on_leave')) continue;
            const cur = sections.get(key(r.grade, r.section));
            if (!cur) continue;
            cur.away += 1;
            away += 1;
            if (!r.leaveNote) {
                cur.noNote += 1;
                noNote += 1;
            }
        }
    }
    const grades = [...new Set(live.map((s) => s.grade))].sort((a, b) => a - b);
    const sectionNames = [...new Set(live.map((s) => s.section))].sort();
    return { day, isToday: day === today, away, noNote, grades, sectionNames, cell: (g: number, s: string) => sections.get(key(g, s)) };
}

interface UpcomingItem {
    date: string;
    title: string;
    sub: string;
    kind: 'event' | 'closure' | 'holiday';
}

/** "16 and 19 to 23 Oct", "9 and 10 Nov", "24 Dec" */
export function formatDateRuns(dates: readonly string[]): string {
    const sorted = [...dates].sort();
    const runs: string[][] = [];
    for (const d of sorted) {
        const run = runs[runs.length - 1];
        if (run && addDays(run[run.length - 1] ?? d, 1) === d) run.push(d);
        else runs.push([d]);
    }
    const sameMonth = new Set(sorted.map((d) => d.slice(0, 7))).size === 1;
    const fmt = (d: string) => (sameMonth ? dayOf(d) : dayMonth(d));
    const items = runs.flatMap((run) => {
        const a = run[0] ?? '';
        const b = run[run.length - 1] ?? '';
        if (run.length === 1) return [fmt(a)];
        if (run.length === 2) return [fmt(a), fmt(b)];
        return [`${fmt(a)} to ${fmt(b)}`];
    });
    const joined = items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`;
    return sameMonth && sorted[0] ? `${joined} ${monthOf(sorted[0])}` : joined;
}

/** Holidays from `today` on, grouped when they are consecutive or only a weekend apart. */
export function holidayGroups(holidays: readonly { date: string; name: string }[], today: string): UpcomingItem[] {
    const upcoming = holidays.filter((h) => h.date >= today).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const groups: { date: string; name: string }[][] = [];
    for (const h of upcoming) {
        const group = groups[groups.length - 1];
        const prev = group?.[group.length - 1];
        let joins = Boolean(prev);
        if (prev) {
            for (let d = addDays(prev.date, 1); d < h.date; d = addDays(d, 1)) {
                const wd = weekday(d);
                if (wd !== 0 && wd !== 6) {
                    joins = false;
                    break;
                }
            }
        }
        if (group && joins) group.push(h);
        else groups.push([h]);
    }
    return groups.map((g) => {
        const names = [...new Set(g.map((h) => h.name.replace(/\s*\(.*\)\s*$/, '')))];
        const dates = g.map((h) => h.date);
        return {
            date: dates[0] ?? today,
            title: names.join(', '),
            sub: g.length === 1 ? 'Holiday' : `Holidays ${formatDateRuns(dates)}`,
            kind: 'holiday' as const,
        };
    });
}

function eventItem(e: CrmState['events'][number]): UpcomingItem {
    if (e.kind === 'closure') {
        return { date: e.date, title: e.title, sub: `${shortDate(e.date)} · emergency closure${e.closure ? ` · ${label(e.closure.reason).toLowerCase()}` : ''}`, kind: 'closure' };
    }
    const time = e.startTime ? (e.endTime ? `${e.startTime} to ${e.endTime}` : e.startTime) : '';
    const audience = e.audience.kind === 'school' ? 'Whole school' : e.audience.sections.map((s) => `Class ${s.grade}${s.section}`).join(', ');
    const parts = [`${WEEKDAYS[weekday(e.date)] ?? ''}${time ? ` ${time}` : ''}`, e.venueName, audience, e.rsvpEnabled ? 'RSVPs on' : null];
    return { date: e.date, title: e.title, sub: parts.filter(Boolean).join(' · '), kind: 'event' };
}

// ── Rendering ────────────────────────────────────────────────────────────────

const CSS = `
:root {
  --bar: #0B3B3F; --bar-ink: #E8F1F1; --bar-muted: #A9C4C6; --bar-field: #134A4E; --bar-line: #5E8E91; --bar-chip: #2B5E62;
  --primary: #0F5E63; --primary-ink: #0A4347; --primary-soft: #E3EFEF;
  --ground: #F3F5F6; --card: #FFFFFF; --ink: #142026; --ink-2: #33454D; --muted: #5B6B73;
  --line: #DDE3E6; --line-soft: #EEF2F3; --field-line: #7D8E96;
  --note-bg: #FBF3E4; --note-line: #EED9B0; --note-ink: #5C3B00; --badge-bg: #F6E7C8; --hot: #F6DCC3; --calm: #E6F2F2;
  --danger: #A12D2D; --danger-ink: #862424; --danger-soft: #FBE7E7; --danger-line: #E6B3B3;
  --ok: #1E6B45; --ok-soft: #E3F1E9; --ok-line: #A9D2BA; --warn: #9A5B00; --tab-hover: #E4EAEC;
  --lang-1: #0F5E63; --lang-2: #3E8E8A; --lang-3: #8CBFBB; --lang-4: #C9DFDD; --lang-none: #DDE3E6;
  --sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  color-scheme: light;
}
* { box-sizing: border-box; }
html { background: var(--ground); }
body { margin: 0; min-height: 100vh; background: var(--ground); color: var(--ink); font: 14px/1.55 var(--sans); }
a { color: var(--primary); }
a:hover { color: var(--primary-ink); }
:focus-visible { outline: 3px solid var(--primary); outline-offset: 2px; }
.appbar :focus-visible { outline-color: var(--badge-bg); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.skip { position: absolute; left: -9999px; top: 8px; z-index: 10; background: var(--card); color: var(--primary); padding: 10px 14px; border-radius: 8px; font-weight: 600; }
.skip:focus { left: 16px; }
.mono { font-family: var(--mono); font-size: 12px; }
.muted { color: var(--muted); }

.appbar { background: var(--bar); color: var(--bar-ink); display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; padding: 12px 24px; }
.brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.crest { flex: none; width: 36px; height: 36px; border-radius: 8px; background: var(--bar-ink); color: var(--bar); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; }
.brand-text { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
.brand-name { font-weight: 600; font-size: 15px; }
.brand-sub { font-size: 12px; color: var(--bar-muted); }
.search { flex: 1 1 260px; display: flex; justify-content: center; gap: 8px; margin: 0; }
.search-field { position: relative; flex: 1 1 auto; min-width: 0; max-width: 440px; }
.search input { width: 100%; height: 44px; border-radius: 8px; border: 1px solid var(--bar-line); background: var(--bar-field); color: var(--bar-ink); padding: 0 12px 0 36px; font: inherit; }
.search input::placeholder { color: var(--bar-muted); opacity: 1; }
.search svg { position: absolute; left: 12px; top: 14px; pointer-events: none; color: var(--bar-muted); }
.search button { flex: none; height: 44px; border-radius: 8px; border: 1px solid var(--bar-line); background: transparent; color: var(--bar-ink); font: inherit; font-weight: 600; padding: 0 14px; cursor: pointer; }
.search button:hover { background: var(--bar-field); }
.synthetic { font-size: 12px; font-weight: 600; background: var(--badge-bg); color: var(--note-ink); border-radius: 9999px; padding: 2px 10px; white-space: nowrap; }

.shell { display: grid; grid-template-columns: 220px minmax(0, 1fr); align-items: stretch; min-height: calc(100vh - 68px); }
.rail { background: var(--card); border-right: 1px solid var(--line); padding: 16px 12px; }
.rail ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.rail a { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; padding: 0 12px; border-radius: 8px; color: var(--ink-2); text-decoration: none; font-weight: 500; white-space: nowrap; }
.rail a:hover { background: var(--ground); color: var(--ink); }
.rail a[aria-current="page"] { background: var(--primary-soft); color: var(--bar); font-weight: 600; }
.rail .count { font-family: var(--mono); font-size: 12px; color: var(--muted); }
main { min-width: 0; padding: 24px 28px 48px; }
main:focus { outline: none; }
.wrap { max-width: 1220px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }

.pagehead { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px; }
.eyebrow { font-size: 12px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
h1 { margin: 0; font-size: 26px; font-weight: 700; line-height: 1.2; }
h2 { margin: 0; font-size: 17px; font-weight: 600; line-height: 1.3; }
.pulled { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--ok); }
.pulled.waiting { color: var(--muted); font-weight: 500; }
.dot { flex: none; width: 8px; height: 8px; border-radius: 9999px; background: currentColor; }

.banner { margin: 0; border: 1px solid; border-radius: 8px; padding: 10px 12px; font-size: 13px; font-weight: 500; }
.banner-ok { background: var(--ok-soft); border-color: var(--ok-line); color: var(--ok); }
.banner-err { background: var(--danger-soft); border-color: var(--danger-line); color: var(--danger); }

.card { min-width: 0; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.card-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 8px; }
.card-sub { font-size: 13px; color: var(--muted); }
.card-sub strong { color: var(--ink); font-weight: 600; }
.caption { margin: 0; font-size: 12px; color: var(--muted); }
.grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(360px, 100%), 1fr)); gap: 16px; align-items: start; }
.grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr)); gap: 16px; align-items: start; }
.grid-wide { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
@media (min-width: 1100px) { .grid-wide { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); } }

.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr)); gap: 12px; }
.kpi { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.kpi-label, .kpi-sub { font-size: 12px; color: var(--muted); }
.kpi-value { font-size: 26px; font-weight: 700; line-height: 1.2; }

.scroll { overflow-x: auto; max-width: 100%; }
.att { width: 100%; border-collapse: separate; border-spacing: 0 6px; font-size: 12px; }
.att th { text-align: left; font-size: 12px; font-weight: 500; color: var(--muted); padding: 0 6px 0 0; }
.att th[scope="row"] { font-size: 13px; font-weight: 600; color: var(--ink); white-space: nowrap; }
.att td { padding: 0 0 0 6px; min-width: 128px; }
.cell { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 8px; border-radius: 6px; padding: 6px 10px; }
.cell > span, .cell b { white-space: nowrap; }
.cell b { font-weight: 600; }
.tone-calm { background: var(--calm); color: var(--bar); }
.tone-warm { background: var(--note-bg); color: var(--note-ink); }
.tone-hot { background: var(--hot); color: var(--note-ink); }
.tone-bad { background: var(--danger-soft); color: var(--danger); }
.tone-warn { background: var(--note-bg); color: var(--note-ink); }
.tone-plain { background: var(--ground); color: var(--ink-2); }
.tone-ok { background: var(--ok-soft); color: var(--ok); }

.tabs { list-style: none; margin: 0 0 16px; padding: 0 0 8px; display: flex; flex-wrap: wrap; gap: 6px; border-bottom: 1px solid var(--line); }
.tab { display: inline-flex; align-items: center; min-height: 44px; padding: 0 12px; border-radius: 8px; background: var(--ground); color: var(--ink-2); font-weight: 600; font-size: 13px; text-decoration: none; }
.tab:hover { background: var(--tab-hover); color: var(--ink); }
.tab[aria-current="true"] { background: var(--primary); color: var(--card); }
.panel { display: none; scroll-margin-top: 12px; }
.panel:target, .panel-default { display: block; }
.panel:target ~ .panel-default { display: none; }

.form { display: flex; flex-direction: column; gap: 12px; margin: 0; }
.fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr)); gap: 12px; }
.field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 500; min-width: 0; }
.field select, .field input, .field textarea { width: 100%; min-height: 44px; border-radius: 8px; border: 1px solid var(--field-line); background: var(--card); color: var(--ink); padding: 0 10px; font: inherit; font-weight: 400; }
.field textarea { min-height: 88px; padding: 10px; resize: vertical; }
.check { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 13px; }
.check input { width: 20px; height: 20px; margin: 0; accent-color: var(--primary); }
.note { margin: 0; background: var(--note-bg); border: 1px solid var(--note-line); border-radius: 8px; padding: 10px 12px; font-size: 13px; color: var(--note-ink); }
.btn { align-self: flex-start; min-height: 44px; border: 0; border-radius: 8px; background: var(--primary); color: var(--card); font: inherit; font-weight: 600; padding: 0 18px; cursor: pointer; }
.btn:hover { background: var(--primary-ink); }
.btn-danger { background: var(--danger); }
.btn-danger:hover { background: var(--danger-ink); }
.recent { margin: 4px 0 0; padding: 12px 0 0; border-top: 1px solid var(--line-soft); list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 12px; }
.recent-title { font-size: 12px; font-weight: 600; color: var(--muted); margin: 12px 0 0; }

.list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
.ev { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 12px; align-items: center; }
.ev-date { font-family: var(--mono); font-size: 12px; color: var(--primary); font-weight: 500; line-height: 1.3; }
.ev-text { display: flex; flex-direction: column; min-width: 0; }
.ev-title { font-weight: 600; font-size: 13px; }
.ev-sub { font-size: 12px; color: var(--muted); }

.langbar { display: flex; height: 16px; border-radius: 6px; overflow: hidden; gap: 2px; }
.legend { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr)); gap: 8px 16px; font-size: 13px; }
.legend li { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.sw { flex: none; width: 10px; height: 10px; border-radius: 3px; }
.sw-empty { box-shadow: inset 0 0 0 1px var(--field-line); }
.legend .n { margin-left: auto; font-family: var(--mono); font-size: 12px; }

.checks { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
.checks li { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--line-soft); font-size: 13px; }
.checks li:last-child { border-bottom: 0; }
.check-text { display: flex; flex-direction: column; min-width: 0; }
.check-ids { font-family: var(--mono); font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
.n-badge { flex: none; font-family: var(--mono); font-weight: 500; border-radius: 6px; padding: 0 8px; }

.table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 640px; }
.table th { text-align: left; color: var(--muted); font-size: 12px; font-weight: 500; padding: 8px; border-bottom: 1px solid var(--line); }
.table td { padding: 8px; border-bottom: 1px solid var(--line-soft); vertical-align: top; }
.badge { display: inline-block; font-size: 12px; font-weight: 600; border-radius: 6px; padding: 1px 8px; white-space: nowrap; }
.empty { margin: 0; font-size: 13px; color: var(--muted); background: var(--ground); border-radius: 8px; padding: 12px; }

.pill { font-size: 12px; font-weight: 600; border-radius: 9999px; padding: 2px 10px; white-space: nowrap; }
.kv { margin: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px 14px; font-size: 13px; }
.kv dt { color: var(--muted); }
.kv dd { margin: 0; overflow-wrap: anywhere; }
.kv .fail { color: var(--danger); font-weight: 600; }
.endpoints { border-top: 1px solid var(--line-soft); padding-top: 12px; display: flex; flex-direction: column; gap: 6px; }
.code { display: block; font-family: var(--mono); font-size: 12px; background: var(--ground); border-radius: 6px; padding: 8px 10px; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
details summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--primary); }
details ul { margin: 0; padding-left: 18px; font-size: 12px; display: flex; flex-direction: column; gap: 4px; }
.results { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
.results li { padding: 8px 0; border-bottom: 1px solid var(--line-soft); font-size: 13px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; }
.results li:last-child { border-bottom: 0; }
.results h3 { margin: 4px 0 0; font-size: 13px; font-weight: 600; color: var(--muted); }
.foot { margin: 0; font-size: 12px; color: var(--muted); }

@media (max-width: 760px) {
  .appbar { padding: 12px 16px; }
  .shell { grid-template-columns: minmax(0, 1fr); min-height: 0; }
  .rail { border-right: 0; border-bottom: 1px solid var(--line); padding: 8px 16px; }
  .rail ul { flex-direction: row; overflow-x: auto; gap: 4px; }
  .rail a { padding: 0 10px; }
  main { padding: 16px 16px 40px; }
  .card { padding: 16px; }
  .field select, .field input, .field textarea, .search input { font-size: 16px; }
}
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
`;

const SEARCH_ICON =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>';

const field = (text: string, control: string) => `<label class="field"><span>${text}</span>${control}</label>`;

function pullLine(kind: string, p: PullRecord | null, mainAt: string | null, today: string): string {
    if (!p) return `${kind} not pulled yet`;
    const what = `${num(p.records)} ${p.incremental ? `changed ${kind}` : kind}`;
    const extras = [p.via === 'csv' ? 'CSV export' : null, p.complete ? null : 'crawl in progress', mainAt && when(p.at, today) !== when(mainAt, today) ? `at ${when(p.at, today)}` : null].filter(Boolean);
    return extras.length ? `${what} (${extras.join(', ')})` : what;
}

export function renderDemoPage(m: DemoPageModel): string {
    const { state, today } = m;
    const school = state.school;
    const live = state.students.filter((s) => !s.deleted && s.status === 'active');
    const guardians = state.guardians.filter((g) => !g.deleted);
    const studentName = new Map(state.students.map((s) => [s.id, `${s.fullName} (${s.grade}${s.section})`]));
    const guardianName = new Map(state.guardians.map((g) => [g.id, g.fullName]));
    const studentSelect = studentOptions(state.students);
    const sectionCodes = [...new Set(live.map((s) => `${s.grade}${s.section}`))];
    const shortName = (school.name.split(',')[0] ?? school.name).trim();
    const tab: OfficeTab = OFFICE_TABS.some((t) => t.id === m.tab) ? (m.tab as OfficeTab) : DEFAULT_TAB;

    // Counts shared by the rail, the KPI tiles and the cards.
    const att = attendanceView(state, live, today);
    const dnc = guardians.filter((g) => g.doNotContact);
    const consentGranted = guardians.filter((g) => g.consent.notices?.status === 'granted').length;
    const consentDenied = guardians.filter((g) => g.consent.notices?.status === 'denied').length;
    const noConsent = guardians.filter((g) => !g.consent.notices || g.consent.notices.status === 'unknown').length;
    const upcomingEvents = state.events
        .filter((e) => e.status === 'published' && e.date >= today)
        .sort((a, b) => (a.date + (a.startTime ?? '') < b.date + (b.startTime ?? '') ? -1 : 1));
    const callsToday = state.communications.filter((c) => istDay(c.occurredAt) === today).length;
    const grades = live.map((s) => s.grade);
    const sectionLetters = [...new Set(live.map((s) => s.section))].sort();
    const pulls = [m.pulls.students, m.pulls.guardians].filter((p): p is PullRecord => p !== null);
    const lastPullAt = pulls.map((p) => p.at).sort().at(-1) ?? null;

    // ── App bar and rail ──
    const query = (m.query ?? '').trim().slice(0, 60);
    const appBar = `<header class="appbar">
<div class="brand">
<div class="crest" aria-hidden="true">${esc(crestInitials(school.name))}</div>
<div class="brand-text"><span class="brand-name">${esc(shortName)}</span><span class="brand-sub">Demo records system · ${esc(school.board)} · ${esc(school.city)}</span></div>
</div>
<form class="search" method="get" action="/" role="search">
<div class="search-field"><label class="sr-only" for="q">Search students and guardians</label>${SEARCH_ICON}<input id="q" type="search" name="q" value="${esc(query)}" maxlength="60" placeholder="Search a student, guardian or admission no." autocomplete="off"></div>
<button type="submit">Search</button>
</form>
<span class="synthetic">Synthetic data · numbers cannot ring</span>
</header>`;

    const modules: [string, string, number | null][] = [
        ['Dashboard', '#dashboard', null],
        ['Students', '#at-a-glance', live.length],
        ['Guardians', '#languages', guardians.length],
        ['Attendance', '#attendance', att.away],
        ['Events', '#events', upcomingEvents.length],
        ['Holistic cards', '#act-hpc', state.hpcEntries.length],
        ['Communications', '#communications', state.communications.length],
        ['Integrations', '#connection', 1],
    ];
    const rail = `<nav class="rail" aria-label="Office modules"><ul>${modules
        .map(
            ([text, href, count], i) =>
                `<li><a href="${href}"${i === 0 ? ' aria-current="page"' : ''}><span>${esc(text)}</span>${count === null ? '' : `<span class="count">${esc(num(count))}</span>`}</a></li>`,
        )
        .join('')}</ul></nav>`;

    // ── Page header ──
    const pulled = lastPullAt
        ? `<p class="pulled" id="last-pull"><span class="dot" aria-hidden="true"></span>SahayakAI pulled these records ${
              istDay(lastPullAt) === today ? `at ${esc(istTime(lastPullAt))}` : `on ${esc(dayMonth(istDay(lastPullAt)))} at ${esc(istTime(lastPullAt))}`
          }</p>`
        : '<p class="pulled waiting" id="last-pull"><span class="dot" aria-hidden="true"></span>SahayakAI has not pulled these records yet</p>';
    const pageHead = `<div class="pagehead">
<div><div class="eyebrow">${esc(longDate(today))} · Academic year ${esc(school.academicYear)}</div><h1 id="dashboard">Office dashboard</h1></div>
${pulled}
</div>`;

    const banners = `${m.flash ? `<p class="banner banner-ok" role="status">${esc(m.flash)}</p>` : ''}${m.error ? `<p class="banner banner-err" role="alert">${esc(m.error)}</p>` : ''}`;

    // ── Search results ──
    let searchCard = '';
    if (query) {
        const needle = query.toLowerCase();
        const hit = (...values: string[]) => values.some((v) => v.toLowerCase().includes(needle));
        const students = query.length < 2 ? [] : state.students.filter((s) => !s.deleted && hit(s.fullName, s.admissionNo, s.id));
        const gHits = query.length < 2 ? [] : guardians.filter((g) => hit(g.fullName, g.id, g.phone));
        const children = new Map<string, string[]>();
        for (const s of state.students) {
            if (s.deleted) continue;
            for (const link of s.guardians) children.set(link.guardianId, [...(children.get(link.guardianId) ?? []), `${s.fullName} (${s.grade}${s.section})`]);
        }
        const more = (n: number) => (n > 8 ? `<li class="muted">and ${esc(num(n - 8))} more; narrow the search</li>` : '');
        const body =
            query.length < 2
                ? '<p class="empty">Type at least two letters.</p>'
                : students.length + gHits.length === 0
                  ? `<p class="empty">No student or guardian matches “${esc(query)}”.</p>`
                  : `${
                        students.length
                            ? `<h3>Students</h3><ul class="results">${students
                                  .slice(0, 8)
                                  .map(
                                      (s) =>
                                          `<li><strong>${esc(s.fullName)}</strong><span>Class ${esc(`${s.grade}${s.section}`)} · roll ${esc(s.rollNo)}</span><span class="mono">${esc(s.admissionNo)} · ${esc(s.id)}</span>${s.status === 'left' ? '<span class="badge tone-plain">left</span>' : ''}</li>`,
                                  )
                                  .join('')}${more(students.length)}</ul>`
                            : ''
                    }${
                        gHits.length
                            ? `<h3>Guardians</h3><ul class="results">${gHits
                                  .slice(0, 8)
                                  .map(
                                      (g) =>
                                          `<li><strong>${esc(g.fullName)}</strong><span>${esc(label(g.relation))} · ${esc(g.preferredLanguage ? (LANGUAGE_NAMES[g.preferredLanguage] ?? g.preferredLanguage) : 'language not recorded')}</span><span class="mono">${esc(g.id)}</span>${g.doNotContact ? '<span class="badge tone-bad">do not contact</span>' : ''}<span class="muted">${esc((children.get(g.id) ?? []).join(', '))}</span></li>`,
                                  )
                                  .join('')}${more(gHits.length)}</ul>`
                            : ''
                    }`;
        searchCard = `<section class="card" id="search-results" aria-labelledby="search-h">
<div class="card-head"><h2 id="search-h">Search: “${esc(query)}”</h2><span class="card-sub">${esc(plural(students.length, 'student'))}, ${esc(plural(gHits.length, 'guardian'))} · <a href="/">Clear search</a></span></div>
${body}
</section>`;
    }

    // ── KPI tiles ──
    const minGrade = grades.length ? Math.min(...grades) : 0;
    const maxGrade = grades.length ? Math.max(...grades) : 0;
    const kpis: { label: string; value: string; sub: string; color: string }[] = [
        { label: 'Active students', value: num(live.length), sub: `Classes ${minGrade} to ${maxGrade}, ${sectionLetters.join(' and ')}`, color: 'var(--ink)' },
        { label: 'Guardians', value: num(guardians.length), sub: `${num(dnc.length)} marked do-not-contact`, color: 'var(--ink)' },
        { label: 'Consent to notices', value: `${Math.round(pct(consentGranted, guardians.length))}%`, sub: `${num(consentGranted)} granted · ${num(consentDenied)} refused`, color: 'var(--ok)' },
        {
            label: att.isToday || !att.day ? 'Absent today' : `Absent on ${dayMonth(att.day)}`,
            value: num(att.away),
            sub: att.day ? `${num(att.noNote)} without a leave note` : 'No attendance marked yet',
            color: 'var(--warn)',
        },
        { label: 'Calls written back', value: num(callsToday), sub: `From SahayakAI today · ${num(state.communications.length)} in all`, color: 'var(--primary)' },
        { label: 'Card observations', value: num(state.hpcEntries.length), sub: 'Holistic progress cards', color: 'var(--ink)' },
    ];
    const kpiSection = `<section class="kpis" id="at-a-glance" aria-label="School at a glance">${kpis
        .map(
            (k) =>
                `<div class="kpi"><span class="kpi-label">${esc(k.label)}</span><span class="kpi-value" style="color: ${k.color}">${esc(k.value)}</span><span class="kpi-sub">${esc(k.sub)}</span></div>`,
        )
        .join('')}</section>`;

    // ── Attendance ──
    const attendanceCard = `<article class="card" id="attendance" aria-labelledby="attendance-h">
<div class="card-head"><h2 id="attendance-h">${att.isToday || !att.day ? 'Attendance today' : 'Attendance, last marked day'}</h2>${
        att.day ? `<span class="card-sub"><strong>${esc(num(att.away))} absent</strong> · ${esc(num(att.noNote))} without a leave note</span>` : ''
    }</div>
${
    !att.day
        ? '<p class="empty">No attendance has been marked yet.</p>'
        : `${
              att.isToday
                  ? ''
                  : `<p class="caption">No register is marked yet for today (${esc(shortDate(today))}); showing ${esc(shortDate(att.day))}, the last marked day.</p>`
          }<div class="scroll" role="region" aria-label="Students present by class" tabindex="0"><table class="att">
<caption class="sr-only">Students present by class and section on ${esc(longDate(att.day))}</caption>
<thead><tr><th scope="col">Class</th>${att.sectionNames.map((s) => `<th scope="col">Section ${esc(s)}</th>`).join('')}</tr></thead>
<tbody>${att.grades
              .map(
                  (g) =>
                      `<tr><th scope="row">Class ${esc(g)}</th>${att.sectionNames
                          .map((s) => {
                              const c = att.cell(g, s);
                              if (!c) return '<td><span class="cell tone-plain">none</span></td>';
                              const tone = c.away === 0 ? 'tone-calm' : c.noNote === 0 ? 'tone-warm' : 'tone-hot';
                              const note = c.away === 0 ? '' : `<b>${esc(num(c.away))} absent${c.noNote ? ` · ${esc(num(c.noNote))} no note` : ''}</b>`;
                              return `<td><span class="cell ${tone}"><span>${esc(`${c.onRoll - c.away}/${c.onRoll}`)} present</span>${note}</span></td>`;
                          })
                          .join('')}</tr>`,
              )
              .join('')}</tbody>
</table></div>`
}
<p class="caption">Absences without a leave note are the ones the office follows up with the family.</p>
</article>`;

    // ── Office actions ──
    const tomorrow = addDays(today, 1);
    const forms: Record<OfficeTab, string> = {
        closure: `<form method="post" action="/demo/closure" class="form">
<div class="fields">
${field('When', `<select name="when"><option value="tomorrow" selected>Tomorrow, ${esc(shortDate(tomorrow))}</option><option value="today">Today, ${esc(shortDate(today))}</option></select>`)}
${field('Reason', `<select name="reason">${options(CLOSURE_REASONS, 'heavy_rain')}</select>`)}
</div>
<p class="note">SahayakAI is sent a signed update. The principal can then send a closure call to every family, in each family&#39;s own language.</p>
<button type="submit" class="btn btn-danger">Declare closure</button>
</form>`,
        absent: `<form method="post" action="/demo/absent" class="form">
${field('Student', `<select name="studentId" required>${studentSelect}</select>`)}
<p class="caption">The mark is saved for today with no leave note.</p>
<button type="submit" class="btn">Mark absent for today</button>
</form>`,
        event: `<form method="post" action="/demo/event" class="form">
${field('Title', '<input name="title" required placeholder="Parent-Teacher Meeting, Class 4A">')}
<div class="fields">
${field('Kind', `<select name="kind">${options(EVENT_KINDS.filter((k) => k !== 'closure'), 'ptm')}</select>`)}
${field('Audience', `<select name="audience"><option value="school">Whole school</option>${sectionCodes.map((s) => `<option value="${esc(s)}">Class ${esc(s)}</option>`).join('')}</select>`)}
</div>
<div class="fields">
${field('Date', `<input type="date" name="date" required value="${esc(today)}">`)}
${field('Starts', '<input type="time" name="startTime" value="10:00">')}
${field('Ends', '<input type="time" name="endTime" value="12:00">')}
${field('Venue', `<select name="venueId"><option value="">None</option>${Object.entries(m.venues)
            .map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`)
            .join('')}</select>`)}
</div>
<label class="check"><input type="checkbox" name="rsvpEnabled" checked> Collect RSVPs</label>
<button type="submit" class="btn">Publish event</button>
</form>`,
        meeting: `<form method="post" action="/demo/meeting" class="form">
${field('Student', `<select name="studentId" required>${studentSelect}</select>`)}
<div class="fields">
${field('Reason (a code, never free text)', `<select name="reasonCode">${options(MEETING_REASON_CODES, 'general_progress')}</select>`)}
${field('Requested by', `<select name="requestedByRole">${options(['class_teacher', 'coordinator', 'principal', 'counsellor', 'parent'], 'class_teacher')}</select>`)}
</div>
<button type="submit" class="btn">Request meeting</button>
</form>`,
        incident: `<form method="post" action="/demo/incident" class="form">
${field('Student', `<select name="studentId" required>${studentSelect}</select>`)}
${field('Reason (a code, never free text)', `<select name="reasonCode">${options(INCIDENT_REASON_CODES, 'minor_injury')}</select>`)}
<div class="fields">
${field('Severity', `<select name="severity">${options(['low', 'medium', 'high'], 'low')}</select>`)}
${field('Reported by', `<select name="reportedByRole">${options(['teacher', 'coordinator', 'principal', 'nurse', 'bus_attendant', 'coach', 'guard'], 'teacher')}</select>`)}
</div>
<button type="submit" class="btn">Log incident</button>
</form>`,
        guardian: `<form method="post" action="/demo/guardian" class="form">
${field('Guardian', `<select name="guardianId" required>${guardianOptions(state.guardians)}</select>`)}
${field('Do not contact', '<select name="doNotContact"><option value="true">On</option><option value="false">Off</option></select>')}
<button type="submit" class="btn">Save do-not-contact</button>
</form>`,
        hpc: `<form method="post" action="/demo/hpc" class="form">
${field('Student', `<select name="studentId" required>${studentSelect}</select>`)}
<div class="fields">
${field('Respondent', `<select name="respondentType">${options(RESPONDENT_TYPES, 'teacher')}</select>`)}
${field('Sentiment', `<select name="sentiment">${options(HPC_SENTIMENTS, 'positive')}</select>`)}
${field('Ability (optional)', `<select name="ability"><option value="">None</option>${options(HPC_ABILITIES)}</select>`)}
</div>
${field('Note (teacher and staff; nurse and counsellor entries keep a reason code only)', '<textarea name="note" maxlength="280"></textarea>')}
<button type="submit" class="btn">Add observation</button>
</form>
<p class="recent-title">Latest observations</p>
<ul class="recent">${state.hpcEntries
            .slice(-5)
            .reverse()
            .map(
                (e) =>
                    `<li><span class="mono">${esc(dayMonth(e.observedOn))}</span> ${esc(studentName.get(e.studentId) ?? e.studentId)} · ${esc(label(e.respondent.type))} · ${esc(e.sentiment)}${
                        e.confidential ? ` · <span class="muted">confidential: ${esc(e.reasonCode ?? '')}</span>` : e.note ? `: ${esc(e.note)}` : ''
                    }</li>`,
            )
            .join('')}</ul>`,
    };
    const tabBar = (current: OfficeTab) =>
        `<ul class="tabs" aria-label="Office actions">${OFFICE_TABS.map(
            (t) => `<li><a class="tab" href="#act-${t.id}"${t.id === current ? ' aria-current="true"' : ''}>${esc(t.label)}</a></li>`,
        ).join('')}</ul>`;
    const panelOrder = [...OFFICE_TABS.filter((t) => t.id !== tab), ...OFFICE_TABS.filter((t) => t.id === tab)];
    const actionsCard = `<article class="card" id="office-actions" aria-labelledby="actions-h">
<div><h2 id="actions-h">Office actions</h2><span class="card-sub">${
        m.webhookEnabled
            ? 'Each change is sent to SahayakAI as a signed update'
            : 'Each change is saved here; signed updates to SahayakAI are off, so it sees them on its next pull'
    }</span></div>
<div class="panels">
${panelOrder
    .map(
        (t) =>
            `<section class="panel${t.id === tab ? ' panel-default' : ''}" id="act-${t.id}" aria-labelledby="act-${t.id}-h">
${tabBar(t.id)}
<h3 class="sr-only" id="act-${t.id}-h">${esc(t.title)}</h3>
${forms[t.id]}
</section>`,
    )
    .join('\n')}
</div>
</article>`;

    // ── Events and holidays ──
    const upcoming = [...upcomingEvents.slice(0, 5).map(eventItem), ...holidayGroups(school.holidays, today).slice(0, 3)].sort((a, b) =>
        a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
    );
    const eventsCard = `<article class="card" id="events" aria-labelledby="events-h">
<h2 id="events-h">Upcoming events</h2>
${
    upcoming.length
        ? `<ul class="list">${upcoming
              .map(
                  (u) =>
                      `<li class="ev"><span class="ev-date">${esc(dayMonth(u.date))}</span><span class="ev-text"><span class="ev-title">${esc(u.title)}</span><span class="ev-sub">${esc(u.sub)}</span></span></li>`,
              )
              .join('')}</ul>`
        : '<p class="empty">Nothing coming up.</p>'
}
</article>`;

    // ── Guardian languages ──
    const langCounts = Object.keys(LANGUAGE_NAMES)
        .map((code) => ({ code, name: LANGUAGE_NAMES[code] ?? code, n: guardians.filter((g) => g.preferredLanguage === code).length }))
        .sort((a, b) => b.n - a.n);
    const unrecorded = guardians.filter((g) => g.preferredLanguage === null).length;
    const langRows = [
        ...langCounts.map((l, i) => ({ name: l.name, n: l.n, colour: LANGUAGE_COLOURS[i] ?? 'var(--lang-4)', empty: false })),
        { name: 'Not recorded', n: unrecorded, colour: 'var(--lang-none)', empty: true },
    ];
    const languagesCard = `<article class="card" id="languages" aria-labelledby="languages-h">
<h2 id="languages-h">Guardian languages</h2>
<div class="langbar" role="img" aria-label="${esc(langRows.map((r) => `${r.name} ${pctText(r.n, guardians.length).replace('%', ' percent')}`).join(', '))}">${langRows
        .filter((r) => r.n > 0)
        .map((r) => `<span style="flex: ${r.n} 1 0; background: ${r.colour}"></span>`)
        .join('')}</div>
<ul class="legend">${langRows
        .map(
            (r) =>
                `<li><span class="sw${r.empty ? ' sw-empty' : ''}" style="background: ${r.colour}" aria-hidden="true"></span>${esc(r.name)}<span class="n">${esc(num(r.n))} · ${esc(pctText(r.n, guardians.length).replace('under 1', '<1'))}</span></li>`,
        )
        .join('')}</ul>
</article>`;

    // ── Records to check ──
    const badStudents = state.malformed.students.filter((r) => !CrmStudentSchema.safeParse(r).success).map((r) => String(r.id ?? '(no id)'));
    const badGuardians = state.malformed.guardians.filter((r) => !CrmGuardianSchema.safeParse(r).success).map((r) => String(r.id ?? '(no id)'));
    const checks: { label: string; ids: string[] | null; n: number; tone: 'bad' | 'warn' | 'plain'; sub?: string }[] = [
        { label: 'Student rows that fail the contract', ids: badStudents, n: badStudents.length, tone: 'bad', sub: 'served only with ?includeMalformed=true' },
        { label: 'Guardian rows that fail the contract', ids: badGuardians, n: badGuardians.length, tone: 'bad', sub: 'served only with ?includeMalformed=true' },
        { label: 'Guardians without consent recorded', ids: null, n: noConsent, tone: 'warn', sub: 'notices consent missing or unknown' },
        {
            label: 'Custody restriction on file',
            ids: state.students.filter((s) => !s.deleted && s.sensitiveFlags.includes('custody_restriction')).map((s) => s.id),
            n: 0,
            tone: 'plain',
        },
        { label: 'Students who left', ids: state.students.filter((s) => !s.deleted && s.status === 'left').map((s) => s.id), n: 0, tone: 'plain' },
        { label: 'Guardians marked do-not-contact', ids: dnc.map((g) => g.id), n: 0, tone: 'plain' },
    ];
    const checksCard = `<article class="card" id="records-to-check" aria-labelledby="checks-h">
<h2 id="checks-h">Records to check</h2>
<ul class="checks">${checks
        .map((c) => {
            const n = c.ids ? c.ids.length : c.n;
            const tone = n === 0 ? 'plain' : c.tone;
            const detail = c.ids && c.ids.length > 0 && c.ids.length <= 4 ? c.ids.join(', ') : (c.sub ?? '');
            return `<li><span class="check-text"><span>${esc(c.label)}</span>${detail ? `<span class="check-ids">${esc(detail)}</span>` : ''}</span><span class="n-badge tone-${tone}">${esc(num(n))}</span></li>`;
        })
        .join('')}</ul>
</article>`;

    // ── Communications written back ──
    const latest = state.communications.slice(-8).reverse();
    const outcomeTone = (c: CrmState['communications'][number]) =>
        c.optOut || /opt.?out/i.test(c.outcome) ? 'tone-bad' : /^(answered|completed|delivered|confirmed|acknowledged)/i.test(c.outcome) ? 'tone-ok' : 'tone-plain';
    const commsCard = `<article class="card" id="communications" aria-labelledby="comms-h">
<div class="card-head"><h2 id="comms-h">Calls written back by SahayakAI</h2><span class="card-sub mono">POST /v1/communications${
        latest.length ? ` · latest ${esc(num(latest.length))} of ${esc(num(state.communications.length))} · ${esc(num(callsToday))} today` : ''
    }</span></div>
${
    latest.length
        ? `<div class="scroll" role="region" aria-label="Calls written back" tabindex="0"><table class="table">
<thead><tr><th scope="col">When</th><th scope="col">Guardian</th><th scope="col">Purpose</th><th scope="col">Outcome</th><th scope="col">Lang</th><th scope="col">Keys</th></tr></thead>
<tbody>${latest
              .map(
                  (c) =>
                      `<tr><td class="mono muted">${esc(when(c.occurredAt, today))}</td><td><strong>${esc(guardianName.get(c.guardianId) ?? c.guardianId)}</strong> <span class="mono muted">${esc(c.guardianId)}</span></td><td class="mono">${esc(c.purpose)}</td><td><span class="badge ${outcomeTone(c)}">${esc(c.outcome)}${
                          c.optOut && !/opt.?out/i.test(c.outcome) ? ' · opt-out' : ''
                      }</span></td><td class="mono">${esc(c.language ?? '—')}</td><td class="mono">${esc(c.keysPressed.join(' ') || '—')}</td></tr>`,
              )
              .join('')}</tbody>
</table></div>`
        : '<p class="empty">Nothing written back yet. When SahayakAI finishes a call it posts the outcome to POST /v1/communications (idempotent by externalId), and the call appears here.</p>'
}
</article>`;

    // ── SahayakAI connection ──
    const lastPullText = lastPullAt
        ? `${esc(when(lastPullAt, today))} · ${esc(pullLine('students', m.pulls.students, lastPullAt, today))}, ${esc(pullLine('guardians', m.pulls.guardians, lastPullAt, today))}`
        : 'Not pulled yet since this server started';
    const deliveriesToday = m.deliveries.filter((d) => istDay(d.at) === today);
    const lastDelivery = m.deliveries[0];
    const hintsText = !m.webhookEnabled
        ? 'Off. Set SAHAYAKAI_WEBHOOK_URL and SAHAYAKAI_WEBHOOK_SECRET to send them.'
        : !lastDelivery
          ? 'On; none sent yet'
          : `${esc(num(deliveriesToday.length))}${deliveriesToday.length >= 100 ? '+' : ''} today · last ${esc(when(lastDelivery.at, today))}, ${
                lastDelivery.error ? `<span class="fail">failed (${esc(lastDelivery.error)})</span>` : `HTTP ${esc(lastDelivery.status)}`
            }`;
    const connectionCard = `<article class="card" id="connection" aria-labelledby="connection-h">
<div class="card-head"><h2 id="connection-h">SahayakAI connection</h2>${
        lastPullAt ? '<span class="pill tone-ok">Connected</span>' : '<span class="pill tone-plain">Waiting for first pull</span>'
    }</div>
<dl class="kv">
<dt>Contract</dt><dd class="mono">school-CRM ${esc(CRM_API_VERSION)}</dd>
<dt>API key</dt><dd class="mono">${esc(m.apiKeyHint)}</dd>
<dt>Last pull</dt><dd>${lastPullText}</dd>
<dt>Updates sent</dt><dd>${hintsText}</dd>
<dt>Signed with</dt><dd class="mono">X-CRM-Signature (HMAC-SHA256)</dd>
</dl>
${
    m.webhookEnabled && m.deliveries.length
        ? `<details><summary>Recent update hints</summary><ul>${m.deliveries
              .slice(0, 5)
              .map(
                  (d) =>
                      `<li><span class="mono">${esc(when(d.at, today))}</span> ${esc(d.type)} ${esc(d.entity.kind)}/${esc(d.entity.id)}: ${
                          d.error ? `<span class="fail">failed (${esc(d.error)})</span>` : `HTTP ${esc(d.status)}`
                      }</li>`,
              )
              .join('')}</ul></details>`
        : ''
}
<div class="endpoints"><span class="caption">Endpoints (Bearer key)</span><code class="code">GET  /v1/school · /v1/students · /v1/guardians
GET  /v1/export/students.csv · guardians.csv
GET  /v1/hpc/entries · /v1/attendance · /v1/events
POST /v1/communications · /v1/events/{id}/rsvps</code></div>
</article>`;

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(school.name)} · school office (demo)</title>
<style>${CSS}</style>
</head>
<body>
<a class="skip" href="#main">Skip to the dashboard</a>
${appBar}
<div class="shell">
${rail}
<main id="main" tabindex="-1">
<div class="wrap">
${pageHead}
${banners}
${searchCard}
${kpiSection}
<div class="grid-2">
${attendanceCard}
${actionsCard}
</div>
<div class="grid-3">
${eventsCard}
${languagesCard}
${checksCard}
</div>
<div class="grid-wide">
${commsCard}
${connectionCard}
</div>
<p class="foot">Every family, name and phone number here is synthetic. Numbers are in the reserved +915 range and cannot ring a real phone. Seed data is anchored to ${esc(longDate(state.anchorDate))}.</p>
</div>
</main>
</div>
</body>
</html>`;
}
