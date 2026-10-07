/**
 * Class gates against drift between the generator and what people read:
 *  - the README's planted-cases table names every planted id the generator makes;
 *  - the fixtures committed to the app match what `npm run export-fixtures` writes now.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildFixtures, FIXTURE_DIR } from '../src/export-fixtures';
import { freshState } from './helpers';

const here = path.dirname(fileURLToPath(import.meta.url));

test('README lists every planted id', () => {
    const readme = readFileSync(path.resolve(here, '../README.md'), 'utf8');
    const p = freshState().planted;
    const ids = [
        ...p.siblings.studentIds,
        ...p.siblings.guardianIds,
        p.blendedFamily.stepChildId,
        p.blendedFamily.jointChildId,
        p.blendedFamily.motherId,
        p.blendedFamily.stepParentId,
        p.counsellorReferral.studentId,
        p.custodyRestriction.studentId,
        p.doNotContactGuardian.guardianId,
        ...p.nullLanguageGuardians,
        p.leftStudent.studentId,
        ...p.tombstones.studentIds,
        ...p.tombstones.guardianIds,
        ...p.malformed.studentIds,
        ...p.malformed.guardianIds,
        ...p.plantedRteStudents,
        p.csvQuotingGuardian.guardianId,
        p.attendance.absenceStreak.studentId,
        p.attendance.lowAttendance.studentId,
        p.assessments.sustainedDrop.studentId,
        p.assessments.missedTest.studentId,
        ...Object.values(p.hpc).map((h) => h.studentId),
        p.events.ptm7B,
        p.events.annualDay,
        p.events.closure,
        p.meetings.sustainedDropRequest,
    ];
    const missing = ids.filter((id) => !readme.includes(id));
    assert.deepEqual(missing, [], 'README.md "Planted cases" is stale; update it from `npm run seed` output / data planted manifest');
});

test('the fixtures in sahayakai-main are up to date', (t) => {
    if (!existsSync(FIXTURE_DIR)) {
        t.skip(`${FIXTURE_DIR} not present`);
        return;
    }
    const { files } = buildFixtures();
    for (const [name, text] of Object.entries(files)) {
        const file = path.join(FIXTURE_DIR, name);
        assert.ok(existsSync(file), `${name} missing; run npm run export-fixtures`);
        assert.equal(readFileSync(file, 'utf8'), text, `${name} is stale; run npm run export-fixtures`);
    }
});
