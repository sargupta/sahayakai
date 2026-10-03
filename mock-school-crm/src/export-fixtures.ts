/**
 * `npm run export-fixtures`: write the seed data as test fixtures for the app,
 * into sahayakai-main/src/__tests__/fixtures/sampark/.
 *
 * Always generated fresh from the default seed and anchor (never from
 * data/state.json, which carries demo-page edits), so the fixtures are
 * reproducible. If the full roster would exceed ~400 KB of fixture files, a
 * deterministic subset is written instead: every student in grades 4 and 7
 * (tombstones included) and every guardian those students reference. All
 * planted cases live in those grades, so the subset carries every one of them.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CrmGuardian, CrmStudent } from './contract/crm-schema';
import { guardiansCsv, studentsCsv } from './csv';
import { DEFAULT_ANCHOR_DATE, DEFAULT_SEED, generateState } from './generate';
import type { CrmState, PlantedManifest } from './state';
import { PACKAGE_ROOT } from './store';

export const FIXTURE_DIR = path.resolve(PACKAGE_ROOT, '..', 'sahayakai-main', 'src', '__tests__', 'fixtures', 'sampark');
const SIZE_BUDGET_BYTES = 400 * 1024;
const SUBSET_GRADES = [4, 7];

interface FixtureSet {
    files: Record<string, string>;
    subset: boolean;
    students: CrmStudent[];
    guardians: CrmGuardian[];
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/** One record per line, so the fixture stays diff-friendly without pretty-printing every field. */
const jsonLines = (value: Record<string, unknown[]>) =>
    `{\n${Object.entries(value)
        .map(([key, list]) => `  ${JSON.stringify(key)}: [\n${list.map((row) => `    ${JSON.stringify(row)}`).join(',\n')}\n  ]`)
        .join(',\n')}\n}\n`;

/**
 * The signals Sampark's rules read (attendance, holistic-card entries, assessments, meeting requests,
 * incidents, fee dues), in the app's `CrmSignals` shape (src/lib/sampark/rules/signals.ts), for the
 * students in the fixture set. FEE DUES are NOT served by the mock CRM: a handful are planted here,
 * relative to the anchor date, to exercise the C1/C2 rules, and are labelled as such in the README.
 */
export function buildSignals(state: CrmState, students: CrmStudent[]) {
    const ids = new Set(students.map((s) => s.id));
    const addDays = (date: string, days: number) => {
        const [y, m, d] = date.split('-').map(Number);
        return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
    };
    const anchor = state.anchorDate;
    const due = (id: string, studentId: string, offsetDays: number, amountRupees: number, label: string) => ({
        id,
        studentId,
        label,
        dueDate: addDays(anchor, offsetDays),
        amountRupees,
        status: 'open' as const,
    });
    const feeDues = [
        due('fee_t2_stu_0128', 'stu_0128', 5, 12500, 'Second instalment'), // regular family, due in 5 days (C1)
        due('fee_t2_stu_0261', 'stu_0261', -5, 12500, 'Second instalment'), // overdue by 5 days (C2)
        due('fee_t2_stu_0273', 'stu_0273', 5, 12500, 'Second instalment'), // RTE-quota: excluded
        due('fee_t2_stu_0251', 'stu_0251', 5, 12500, 'Second instalment'), // counsellor referral: suppressed
        due('fee_t2_stu_0125', 'stu_0125', -3, 12500, 'Second instalment'), // custody restriction: suppressed
        due('fee_t2_stu_0153', 'stu_0153', 4, 75000, 'Second instalment'), // amount the scripts cannot say yet
        due('fee_t2_stu_0245', 'stu_0245', -40, 12500, 'Second instalment'), // overdue beyond the hand-over limit
    ].filter((d) => ids.has(d.studentId));
    return {
        attendance: state.attendance
            .filter((a) => ids.has(a.studentId))
            .map((a) => ({ studentId: a.studentId, date: a.date, status: a.status, leaveNote: a.leaveNote, markedAt: a.markedAt })),
        hpc: state.hpcEntries
            .filter((h) => ids.has(h.studentId))
            .map((h) => ({
                id: h.id,
                studentId: h.studentId,
                observedOn: h.observedOn,
                respondentType: h.respondent.type,
                sentiment: h.sentiment,
                note: h.note,
                confidential: h.confidential,
                reasonCode: h.reasonCode,
                unitId: h.unit ? h.unit.id : null,
                ability: h.ability,
                rubric: h.rubric ? { level: h.rubric.level, label: h.rubric.label } : null,
            })),
        assessments: state.assessments
            .filter((a) => ids.has(a.studentId))
            .map((a) => ({
                studentId: a.studentId,
                assessmentId: a.assessmentId,
                assessmentName: a.assessmentName,
                subjectId: a.subjectId,
                date: a.date,
                maxMarks: a.maxMarks,
                marks: a.marks,
                status: a.status,
            })),
        meetings: state.meetings.filter((m) => ids.has(m.studentId)).map((m) => ({ studentId: m.studentId, reasonCode: m.reasonCode, status: m.status })),
        incidents: state.incidents
            .filter((i) => ids.has(i.studentId))
            .map((i) => ({ studentId: i.studentId, reasonCode: i.reasonCode, severity: i.severity, status: i.status })),
        feeDues,
    };
}

function build(state: CrmState, students: CrmStudent[], guardians: CrmGuardian[], subset: boolean): FixtureSet {
    const studentIds = new Set(students.map((s) => s.id));
    const guardianIds = new Set(guardians.map((g) => g.id));
    const keep = (ids: readonly string[]) => ids.filter((id) => studentIds.has(id) || guardianIds.has(id));
    const planted: PlantedManifest = {
        ...state.planted,
        rteStudents: keep(state.planted.rteStudents),
        boarders: keep(state.planted.boarders),
        missingSpokenNames: state.planted.missingSpokenNames.filter((m) => studentIds.has(m.studentId)),
    };
    const files: Record<string, string> = {
        'school.json': json(state.school),
        'students.json': json(students),
        'guardians.json': json(guardians),
        'malformed.json': json({ ...state.malformed, reasons: state.planted.malformed.reasons }),
        'signals.json': jsonLines(buildSignals(state, students.filter((s) => !s.deleted))),
        'planted.json': json({ seed: state.seed, anchorDate: state.anchorDate, subset: subset ? { grades: SUBSET_GRADES } : null, planted }),
        'students.csv': studentsCsv(students),
        'guardians.csv': guardiansCsv(guardians),
        'students-with-malformed.csv': studentsCsv([...students, ...state.malformed.students]),
        'guardians-with-malformed.csv': guardiansCsv([...guardians, ...state.malformed.guardians]),
    };
    files['README.md'] = readme(state, planted, students, guardians, subset);
    return { files, subset, students, guardians };
}

export function buildFixtures(state: CrmState = generateState({ seed: DEFAULT_SEED, anchorDate: DEFAULT_ANCHOR_DATE })): FixtureSet {
    const full = build(state, state.students, state.guardians, false);
    const size = Object.values(full.files).reduce((sum, text) => sum + Buffer.byteLength(text, 'utf8'), 0);
    if (size <= SIZE_BUDGET_BYTES) return full;
    const students = state.students.filter((s) => SUBSET_GRADES.includes(s.grade));
    const referenced = new Set(students.flatMap((s) => s.guardians.map((l) => l.guardianId)));
    const guardians = state.guardians.filter((g) => referenced.has(g.id));
    return build(state, students, guardians, true);
}

function readme(state: CrmState, p: PlantedManifest, students: CrmStudent[], guardians: CrmGuardian[], subset: boolean): string {
    const live = students.filter((s) => !s.deleted).length;
    const tomb = students.length - live;
    const rows: [string, string, string][] = [
        ['Siblings in different grades sharing both guardians', `${p.siblings.studentIds.join(', ')}`, `guardians ${p.siblings.guardianIds.join(', ')}`],
        ['Blended family: step-parent not guardian of record', `step-child ${p.blendedFamily.stepChildId}, joint child ${p.blendedFamily.jointChildId}`, `mother ${p.blendedFamily.motherId}; step-parent ${p.blendedFamily.stepParentId} has isGuardianOfRecord=false for ${p.blendedFamily.stepChildId}`],
        ['sensitiveFlags ["counsellor_referral"]', p.counsellorReferral.studentId, 'also has a confidential counsellor card entry'],
        ['sensitiveFlags ["custody_restriction"]', p.custodyRestriction.studentId, ''],
        ['Guardian with doNotContact=true', p.doNotContactGuardian.guardianId, `guardian of ${p.doNotContactGuardian.studentId}`],
        ['Guardians with preferredLanguage null', p.nullLanguageGuardians.join(', '), 'the only nulls in the data'],
        ["Student with status 'left'", p.leftStudent.studentId, ''],
        ['Tombstones (deleted: true), updated in the last 2 days', `students ${p.tombstones.studentIds.join(', ')}; guardian ${p.tombstones.guardianIds.join(', ')}`, 'a withdrawn family and a duplicate record of a live student'],
        ['Malformed (only with ?includeMalformed=true)', [...p.malformed.studentIds, ...p.malformed.guardianIds].join(', '), Object.entries(p.malformed.reasons).map(([id, why]) => `${id}: ${why}`).join('; ')],
        ['RTE-quota students (planted)', p.plantedRteStudents.join(', '), `all RTE in this file: ${p.rteStudents.join(', ') || 'none'}`],
        ['Spoken first name not reviewed in some languages', p.missingSpokenNames.map((m) => `${m.studentId} (${m.missing.join('/')})`).join(', '), ''],
        ['Guardian name needing RFC 4180 quoting', p.csvQuotingGuardian.guardianId, p.csvQuotingGuardian.fullName],
        ['Notices consent examples (class 7B)', `denied ${p.consentExamples.deniedGuardianId}; null ${p.consentExamples.unknownNullGuardianId}; status unknown ${p.consentExamples.unknownStatusGuardianId}`, ''],
    ];
    return `# Sampark CRM fixtures (generated)

Generated by \`npm run export-fixtures\` in \`mock-school-crm/\`. Do not edit by hand; regenerate instead.
Seed \`${state.seed}\`, anchored to ${state.anchorDate}. School: ${state.school.name} (${state.school.id}).

${subset ? `**Subset:** the full roster exceeds the fixture size budget, so these files hold grades ${SUBSET_GRADES.join(' and ')} only (${live} live students + ${tomb} tombstones, ${guardians.length} guardians they reference). Every planted case lives in these grades.` : `Full roster: ${live} live students + ${tomb} tombstones, ${guardians.length} guardians.`}

| File | Contents |
|---|---|
| school.json | \`CrmSchool\` |
| students.json, guardians.json | contract-valid records, tombstones included, no malformed records |
| malformed.json | the 3 raw malformed records (\`students\`, \`guardians\`) and why each fails |
| students.csv, guardians.csv | the same records in the contract CSV shape |
| students-with-malformed.csv, guardians-with-malformed.csv | as above plus the malformed rows (what \`?includeMalformed=true\` returns) |
| signals.json | attendance, holistic-card entries, assessments, meeting requests, incidents and fee dues for these students, in Sampark's \`CrmSignals\` shape (slice 2 rules and backtest). Fee dues are planted by the exporter; the mock CRM does not serve them |
| planted.json | machine-readable ids of every planted case |

Every record in students.json and guardians.json validates against \`src/lib/sampark/crm/schema.ts\`; every record in malformed.json fails it.

## Planted cases

| Case | Ids | Notes |
|---|---|---|
${rows.map((r) => `| ${r.map((c) => c.replace(/\|/g, '\\|')).join(' | ')} |`).join('\n')}
`;
}

async function main() {
    const set = buildFixtures();
    await mkdir(FIXTURE_DIR, { recursive: true });
    let total = 0;
    for (const [name, text] of Object.entries(set.files)) {
        await writeFile(path.join(FIXTURE_DIR, name), text, 'utf8');
        total += Buffer.byteLength(text, 'utf8');
    }
    console.log(
        `[mock-school-crm] wrote ${Object.keys(set.files).length} fixture files (${Math.round(total / 1024)} KB) to ${FIXTURE_DIR}` +
            (set.subset ? ` (subset: grades ${SUBSET_GRADES.join(', ')})` : ''),
    );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main();
}
