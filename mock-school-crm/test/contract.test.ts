/**
 * The service must serve EXACTLY the app's wire contract. Two gates:
 *  1. src/contract/crm-schema.ts is a byte-for-byte copy of the app's
 *     sahayakai-main/src/lib/sampark/crm/schema.ts (below its header), so a
 *     contract change in the app fails here until the copy is refreshed.
 *  2. Every generated record validates against it, and every malformed record
 *     fails it for the planted reason. When the app's own module can be loaded
 *     (its node_modules are installed, e.g. locally), records are validated
 *     against THAT module too.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as contract from '../src/contract/crm-schema';
import { freshState } from './helpers';

const here = path.dirname(fileURLToPath(import.meta.url));
const COPY = path.resolve(here, '../src/contract/crm-schema.ts');
const APP = path.resolve(here, '../../sahayakai-main/src/lib/sampark/crm/schema.ts');
const MARKER = '// ---- verbatim copy below ----\n';

test('the contract copy is byte-identical to the app schema', () => {
    const copy = readFileSync(COPY, 'utf8');
    const at = copy.indexOf(MARKER);
    assert.ok(at > 0, 'copy is missing its marker line');
    assert.ok(existsSync(APP), `app schema not found at ${APP}`);
    assert.equal(copy.slice(at + MARKER.length), readFileSync(APP, 'utf8'), 'src/contract/crm-schema.ts has drifted from the app contract; refresh it (see its header)');
});

test('every generated student, guardian and the school validate against the contract', () => {
    const state = freshState();
    assert.doesNotThrow(() => contract.CrmSchoolSchema.parse(state.school));
    for (const s of state.students) {
        const r = contract.CrmStudentSchema.safeParse(s);
        assert.ok(r.success, `${s.id}: ${r.success ? '' : JSON.stringify(r.error.issues)}`);
    }
    for (const g of state.guardians) {
        const r = contract.CrmGuardianSchema.safeParse(g);
        assert.ok(r.success, `${g.id}: ${r.success ? '' : JSON.stringify(r.error.issues)}`);
    }
});

test('each malformed record fails the contract for its planted reason', () => {
    const { malformed } = freshState();
    const failing = (schema: typeof contract.CrmStudentSchema | typeof contract.CrmGuardianSchema, rec: unknown) => {
        const r = schema.safeParse(rec);
        assert.equal(r.success, false);
        return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
    };
    const byId = new Map([...malformed.students, ...malformed.guardians].map((r) => [String(r.id), r]));
    assert.deepEqual(failing(contract.CrmStudentSchema, byId.get('stu_9901')), ['grade']);
    assert.deepEqual(failing(contract.CrmStudentSchema, byId.get('stu_9902')), ['guardians']);
    assert.deepEqual(failing(contract.CrmGuardianSchema, byId.get('gdn_9901')), ['phone']);
    assert.equal(malformed.students.length + malformed.guardians.length, 3);
});

test('records also validate against the app module itself, when it can be loaded', async (t) => {
    let appContract: typeof contract;
    try {
        // A computed specifier keeps tsc from following it (CI has no app node_modules).
        const specifier = pathToFileURL(APP).href;
        appContract = (await import(specifier)) as typeof contract;
    } catch (err) {
        t.skip(`app schema not loadable here (${(err as Error).message.split('\n')[0]}); the byte-identical copy test covers it`);
        return;
    }
    const state = freshState();
    appContract.CrmSchoolSchema.parse(state.school);
    for (const s of state.students) assert.ok(appContract.CrmStudentSchema.safeParse(s).success, s.id);
    for (const g of state.guardians) assert.ok(appContract.CrmGuardianSchema.safeParse(g).success, g.id);
    for (const bad of state.malformed.students) assert.equal(appContract.CrmStudentSchema.safeParse(bad).success, false);
    for (const bad of state.malformed.guardians) assert.equal(appContract.CrmGuardianSchema.safeParse(bad).success, false);
});
