import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CSV_COLUMNS, CrmGuardianSchema, CrmStudentSchema } from '../src/contract/crm-schema';
import { encodeCsv, guardiansCsv, parseCsv, rowToGuardian, rowToStudent, studentsCsv } from '../src/csv';
import { freshState } from './helpers';

test('RFC 4180: quotes, commas, newlines and Unicode survive a round trip', () => {
    const rows = [
        ['a', 'b,c', 'say "hi"', 'line1\nline2', 'আরভ', ''],
        ['', '', '"', ',', 'x\r\ny', 'तेन्जिङ'],
    ];
    const text = encodeCsv(rows);
    assert.ok(text.endsWith('\r\n'));
    assert.ok(text.includes('"say ""hi"""'));
    assert.deepEqual(parseCsv(text), rows);
});

test('parseCsv accepts LF-only files and rejects an unterminated quote', () => {
    assert.deepEqual(parseCsv('a,b\n1,2\n'), [['a', 'b'], ['1', '2']]);
    assert.throws(() => parseCsv('a,"b\n'));
});

test('students CSV: exact header, and parsing it back gives the JSON records', () => {
    const { students } = freshState();
    const [header, ...rows] = parseCsv(studentsCsv(students));
    assert.deepEqual(header, [...CSV_COLUMNS.students]);
    assert.equal(rows.length, students.length);
    rows.forEach((row, i) => {
        const back = rowToStudent(header ?? [], row);
        assert.deepEqual(back, students[i]);
        assert.ok(CrmStudentSchema.safeParse(back).success);
    });
});

test('guardians CSV: exact header, consent encoding, and parsing it back gives the JSON records', () => {
    const { guardians, planted } = freshState();
    const text = guardiansCsv(guardians);
    const [header, ...rows] = parseCsv(text);
    assert.deepEqual(header, [...CSV_COLUMNS.guardians]);
    rows.forEach((row, i) => {
        const back = rowToGuardian(header ?? [], row);
        assert.deepEqual(back, guardians[i]);
        assert.ok(CrmGuardianSchema.safeParse(back).success);
    });
    // Encodings, spelled out.
    const quoted = guardians.find((g) => g.id === planted.csvQuotingGuardian.guardianId);
    assert.ok(text.includes(`"${quoted?.fullName.replace(/"/g, '""')}"`));
    const unknownStatus = rows[guardians.findIndex((g) => g.id === planted.consentExamples.unknownStatusGuardianId)];
    assert.equal(unknownStatus?.[CSV_COLUMNS.guardians.indexOf('consent.notices')], 'unknown;;;');
    const nullConsent = rows[guardians.findIndex((g) => g.id === planted.consentExamples.unknownNullGuardianId)];
    assert.equal(nullConsent?.[CSV_COLUMNS.guardians.indexOf('consent.notices')], '');
    const granted = rows.find((r) => r[CSV_COLUMNS.guardians.indexOf('consent.notices')]?.startsWith('granted;'));
    assert.match(granted?.[CSV_COLUMNS.guardians.indexOf('consent.notices')] ?? '', /^granted;\d{4}-\d{2}-\d{2}T[^;]+;(admission_form|parent_form);hv-notice-\d{4}$/);
});

test('the students guardians column is "gid:isPrimary:isGuardianOfRecord|..."', () => {
    const { students, planted } = freshState();
    const step = students.find((s) => s.id === planted.blendedFamily.stepChildId);
    const [header, ...rows] = parseCsv(studentsCsv(step ? [step] : []));
    const cell = rows[0]?.[(header ?? []).indexOf('guardians')];
    assert.equal(cell, `${planted.blendedFamily.motherId}:true:true|${planted.blendedFamily.stepParentId}:false:false`);
});

test('malformed rows map back to the same malformed records, which the schema rejects', () => {
    const { malformed } = freshState();
    const [sh, ...sRows] = parseCsv(studentsCsv(malformed.students));
    sRows.forEach((row, i) => {
        const back = rowToStudent(sh ?? [], row);
        assert.deepEqual(back, malformed.students[i]);
        assert.equal(CrmStudentSchema.safeParse(back).success, false);
    });
    const [gh, ...gRows] = parseCsv(guardiansCsv(malformed.guardians));
    const back = rowToGuardian(gh ?? [], gRows[0] ?? []);
    assert.deepEqual(back, malformed.guardians[0]);
    assert.equal(CrmGuardianSchema.safeParse(back).success, false);
});
