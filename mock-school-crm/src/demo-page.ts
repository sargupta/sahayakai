/**
 * The demo page at GET /: server-rendered HTML, no scripts, no external assets,
 * readable on a phone. It is the school office's screen: in front of a
 * principal you add a teacher's observation or declare a closure and watch the
 * calling system react (via the signed webhook hints and its next pull).
 */

import type { CrmGuardian, CrmStudent } from './contract/crm-schema';
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
    today: string;
    flash: string | null;
    error: string | null;
    webhookEnabled: boolean;
    deliveries: readonly DeliveryRecord[];
    venues: Record<string, string>;
}

const esc = (value: unknown): string =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const label = (code: string) => code.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const options = (values: readonly string[], selected?: string) =>
    values.map((v) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(label(v))}</option>`).join('');

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

function pct(n: number, d: number): string {
    return d === 0 ? '0%' : `${Math.round((n / d) * 100)}%`;
}

export function renderDemoPage(m: DemoPageModel): string {
    const { state } = m;
    const live = state.students.filter((s) => !s.deleted && s.status === 'active');
    const guardians = state.guardians.filter((g) => !g.deleted);
    const langCount = (code: string | null) => guardians.filter((g) => g.preferredLanguage === code).length;
    const consentGranted = guardians.filter((g) => g.consent.notices?.status === 'granted').length;
    const absentToday = state.attendance.filter((r) => r.date === m.today && r.status === 'absent').length;
    const upcoming = state.events
        .filter((e) => e.date >= m.today && e.status === 'published')
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
        .slice(0, 6);
    const comms = state.communications.slice(-50).reverse();
    const recentCards = state.hpcEntries.slice(-8).reverse();
    const studentName = new Map(state.students.map((s) => [s.id, `${s.fullName} (${s.grade}${s.section})`]));
    const guardianName = new Map(state.guardians.map((g) => [g.id, g.fullName]));
    const studentSelect = studentOptions(state.students);
    const sections = [...new Set(live.map((s) => `${s.grade}${s.section}`))];

    const eventLine = (e: CrmState['events'][number]) =>
        `<li><strong>${esc(e.date)}${e.startTime ? ` ${esc(e.startTime)}` : ''}</strong> ${esc(e.title)}${
            e.venueName ? `, ${esc(e.venueName)}` : ''
        } <span class="muted">(${esc(e.kind)}, ${e.audience.kind === 'school' ? 'whole school' : esc(e.audience.sections.map((s) => `${s.grade}${s.section}`).join(', '))})</span></li>`;

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(state.school.name)} - school office (demo)</title>
<style>
:root { --bg: #f6f5f1; --card: #ffffff; --ink: #1d232a; --muted: #5d6670; --line: #dcd9d0; --accent: #1f5f8b; --ok: #1d6b3a; --warn: #8a3b12; }
@media (prefers-color-scheme: dark) { :root { --bg: #15181c; --card: #1e2227; --ink: #e8e6e1; --muted: #a2a9b1; --line: #343a41; --accent: #7fb6de; --ok: #7fd49c; --warn: #f0a57a; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 980px; margin: 0 auto; padding: 16px; }
header h1 { font-size: 1.4rem; margin: 0 0 4px; }
.muted { color: var(--muted); font-size: 0.9rem; }
.banner { border: 1px solid var(--line); background: var(--card); padding: 8px 12px; border-radius: 8px; margin: 12px 0; }
.ok { border-color: var(--ok); color: var(--ok); }
.err { border-color: var(--warn); color: var(--warn); }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 12px 0; }
.stat { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
.stat b { display: block; font-size: 1.3rem; }
section { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; margin: 14px 0; }
section h2 { font-size: 1.1rem; margin: 0 0 8px; }
form { display: grid; gap: 8px; }
label { display: grid; gap: 2px; font-size: 0.9rem; }
select, input, textarea, button { font: inherit; padding: 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--ink); width: 100%; }
textarea { min-height: 64px; }
button { background: var(--accent); color: var(--card); border: 0; font-weight: 600; cursor: pointer; }
.forms { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
.forms section { margin: 0; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.table { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
ul { margin: 0; padding-left: 18px; }
</style>
</head>
<body>
<main>
<header>
<h1>${esc(state.school.name)}</h1>
<div class="muted">${esc(state.school.board)} · ${esc(state.school.city)} · academic year ${esc(state.school.academicYear)} · today ${esc(m.today)} (IST) · data anchored to ${esc(state.anchorDate)}</div>
<div class="banner">Demo school. Every family, name and phone number here is synthetic; phone numbers are in the reserved +915 range and cannot ring a real phone.</div>
</header>
${m.flash ? `<div class="banner ok" role="status">${esc(m.flash)}</div>` : ''}
${m.error ? `<div class="banner err" role="alert">${esc(m.error)}</div>` : ''}

<div class="grid">
<div class="stat"><b>${live.length}</b>active students</div>
<div class="stat"><b>${guardians.length}</b>guardians</div>
<div class="stat"><b>${sections.length}</b>classes (1-10, A/B)</div>
<div class="stat"><b>${pct(consentGranted, guardians.length)}</b>consent to notices</div>
<div class="stat"><b>${absentToday}</b>absent today</div>
<div class="stat"><b>${state.communications.length}</b>calls logged back</div>
</div>
<p class="muted">Guardian languages: Nepali ${pct(langCount('ne'), guardians.length)}, Bengali ${pct(langCount('bn'), guardians.length)}, Hindi ${pct(langCount('hi'), guardians.length)}, English ${pct(langCount('en'), guardians.length)}, not recorded ${langCount(null)}. Webhook hints: ${m.webhookEnabled ? 'configured' : 'not configured'}.</p>

<div class="forms">
<section id="hpc">
<h2>Add a holistic-card observation</h2>
<form method="post" action="/demo/hpc">
<label>Student<select name="studentId" required>${studentSelect}</select></label>
<div class="row">
<label>Respondent<select name="respondentType">${options(RESPONDENT_TYPES, 'teacher')}</select></label>
<label>Sentiment<select name="sentiment">${options(HPC_SENTIMENTS, 'positive')}</select></label>
</div>
<label>Ability (optional)<select name="ability"><option value="">None</option>${options(HPC_ABILITIES)}</select></label>
<label>Note (teacher and staff; nurse and counsellor entries keep a reason code only)<textarea name="note" maxlength="280"></textarea></label>
<button type="submit">Add observation</button>
</form>
</section>

<section id="absent">
<h2>Mark a student absent today</h2>
<form method="post" action="/demo/absent">
<label>Student<select name="studentId" required>${studentSelect}</select></label>
<button type="submit">Mark absent for ${esc(m.today)}</button>
</form>
</section>

<section id="event">
<h2>Publish an event</h2>
<form method="post" action="/demo/event">
<label>Title<input name="title" required placeholder="Parent-Teacher Meeting, Class 4A"></label>
<div class="row">
<label>Kind<select name="kind">${options(EVENT_KINDS.filter((k) => k !== 'closure'), 'ptm')}</select></label>
<label>Audience<select name="audience"><option value="school">Whole school</option>${sections.map((s) => `<option value="${esc(s)}">Class ${esc(s)}</option>`).join('')}</select></label>
</div>
<div class="row">
<label>Date<input type="date" name="date" required value="${esc(m.today)}"></label>
<label>Venue<select name="venueId"><option value="">None</option>${Object.entries(m.venues)
        .map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`)
        .join('')}</select></label>
</div>
<div class="row">
<label>Starts<input type="time" name="startTime" value="10:00"></label>
<label>Ends<input type="time" name="endTime" value="12:00"></label>
</div>
<label><span><input type="checkbox" name="rsvpEnabled" checked style="width:auto"> Collect RSVPs</span></label>
<button type="submit">Publish event</button>
</form>
</section>

<section id="closure">
<h2>Declare an emergency closure</h2>
<form method="post" action="/demo/closure">
<div class="row">
<label>When<select name="when"><option value="today">Today</option><option value="tomorrow">Tomorrow</option></select></label>
<label>Reason<select name="reason">${options(CLOSURE_REASONS, 'heavy_rain')}</select></label>
</div>
<button type="submit">Declare closure</button>
</form>
</section>

<section id="meeting">
<h2>Request a meeting</h2>
<form method="post" action="/demo/meeting">
<label>Student<select name="studentId" required>${studentSelect}</select></label>
<div class="row">
<label>Reason<select name="reasonCode">${options(MEETING_REASON_CODES, 'general_progress')}</select></label>
<label>Requested by<select name="requestedByRole">${options(['class_teacher', 'coordinator', 'principal', 'counsellor', 'parent'], 'class_teacher')}</select></label>
</div>
<button type="submit">Request meeting</button>
</form>
</section>

<section id="incident">
<h2>Log an incident (reason code only)</h2>
<form method="post" action="/demo/incident">
<label>Student<select name="studentId" required>${studentSelect}</select></label>
<label>Reason<select name="reasonCode">${options(INCIDENT_REASON_CODES, 'minor_injury')}</select></label>
<div class="row">
<label>Severity<select name="severity">${options(['low', 'medium', 'high'], 'low')}</select></label>
<label>Reported by<select name="reportedByRole">${options(['teacher', 'coordinator', 'principal', 'nurse', 'bus_attendant', 'coach', 'guard'], 'teacher')}</select></label>
</div>
<button type="submit">Log incident</button>
</form>
</section>

<section id="guardian">
<h2>Guardian do-not-contact</h2>
<form method="post" action="/demo/guardian">
<label>Guardian<select name="guardianId" required>${guardianOptions(state.guardians)}</select></label>
<label>Do not contact<select name="doNotContact"><option value="true">On</option><option value="false">Off</option></select></label>
<button type="submit">Save</button>
</form>
</section>
</div>

<section id="events">
<h2>Upcoming events</h2>
${upcoming.length ? `<ul>${upcoming.map(eventLine).join('')}</ul>` : '<p class="muted">None.</p>'}
</section>

<section id="communications">
<h2>Communications written back (latest 50)</h2>
${
    comms.length
        ? `<div class="table"><table><thead><tr><th>When</th><th>Guardian</th><th>Purpose</th><th>Outcome</th><th>Lang</th><th>Keys</th><th>External id</th></tr></thead><tbody>${comms
              .map(
                  (c) =>
                      `<tr><td>${esc(c.occurredAt)}</td><td>${esc(guardianName.get(c.guardianId) ?? c.guardianId)}</td><td>${esc(c.purpose)}</td><td>${esc(c.outcome)}${c.optOut ? ' (opt-out)' : ''}</td><td>${esc(c.language ?? '')}</td><td>${esc(c.keysPressed.join(' '))}</td><td>${esc(c.externalId)}</td></tr>`,
              )
              .join('')}</tbody></table></div>`
        : '<p class="muted">Nothing written back yet. The calling system posts each call outcome to POST /v1/communications.</p>'
}
</section>

<section id="recent-cards">
<h2>Latest card observations</h2>
<div class="table"><table><thead><tr><th>Date</th><th>Student</th><th>Respondent</th><th>Sentiment</th><th>Note</th></tr></thead><tbody>${recentCards
        .map(
            (e) =>
                `<tr><td>${esc(e.observedOn)}</td><td>${esc(studentName.get(e.studentId) ?? e.studentId)}</td><td>${esc(label(e.respondent.type))}</td><td>${esc(e.sentiment)}</td><td>${
                    e.confidential ? `<span class="muted">confidential: ${esc(e.reasonCode ?? '')}</span>` : esc(e.note ?? '')
                }</td></tr>`,
        )
        .join('')}</tbody></table></div>
</section>

${
    m.webhookEnabled
        ? `<section id="deliveries"><h2>Recent webhook hints</h2>${
              m.deliveries.length
                  ? `<ul>${m.deliveries
                        .map((d) => `<li>${esc(d.at)} ${esc(d.type)} ${esc(d.entity.kind)}/${esc(d.entity.id)}: ${d.error ? `failed (${esc(d.error)})` : `HTTP ${esc(d.status)}`}</li>`)
                        .join('')}</ul>`
                  : '<p class="muted">None sent yet.</p>'
          }</section>`
        : ''
}
<p class="muted">API: /v1/school, /v1/students, /v1/guardians, /v1/export/students.csv (Bearer key required). See the README.</p>
</main>
</body>
</html>`;
}
