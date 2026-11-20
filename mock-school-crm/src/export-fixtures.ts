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
