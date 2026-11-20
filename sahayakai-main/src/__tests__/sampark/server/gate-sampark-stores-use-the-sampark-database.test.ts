/**
 * Class gate (Sampark class gate 5, extended): Sampark data is stored only in the Sampark
 * database, behind assertSamparkEnvironmentSafe.
 *
 * The bug this catches: the Google Calendar store opened the app's default database with
 * getDb(), so on a staging service or a developer machine (SAMPARK_FIRESTORE_DATABASE =
 * sampark-nonprod, or no emulator) schools' encrypted OAuth tokens, OAuth state and synced
 * events landed in the production default database while every other Sampark store went to the
 * Sampark database.
 *
 * The first version of this gate passed a whole file on one guard call anywhere in it, so a
 * getDb() in a second function of the same store was never looked at, and it scanned only
 * src/lib/sampark and src/server/sampark, not the Sampark routes.
 *
 * The gate is on the class, per Firestore open, in every Sampark module: anything under a
 * Sampark directory (library, server, pages, the /api/sampark*, Sampark job and Sampark webhook
 * routes) and any other source file that names a `sampark_` collection or imports a Sampark
 * library or server module. In those modules:
 *  - the Sampark database is reached through samparkFirestore() or getSamparkRepo() (or the
 *    guarded store factories), never getDb();
 *  - a raw getFirestore() call sits in a function that has already called
 *    assertSamparkEnvironmentSafe();
 *  - the namespaced admin.firestore() and `new Firestore()` are never used;
 *  - a module declared below as reading the APP's own records may use getDb(), but only on the
 *    collections declared for it, and never on a `sampark_` collection.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

/** Modules that read the APP's own collections from the default database, not Sampark data. */
const APP_DATA_READERS: Record<string, { reason: string; collections: string[] }> = {
    'src/server/sampark/auth.ts': { reason: 'organizations and members: who is a school admin or teacher', collections: ['organizations', 'members', 'users'] },
    'src/server/sampark/calendar.ts': { reason: 'users: staff display names on the school calendar', collections: ['users'] },
};

const SAMPARK_PATH = /^src\/(?:.+\/)?sampark[^/]*\//;
const TOUCHES_SAMPARK = /["'`]sampark_[a-z_]+["'`]|from ["']@\/(?:lib|server)\/sampark\//;
const OPENS_FIRESTORE = /\bgetFirestore\(|\bgetDb\b|\bsamparkFirestore\(|\bgetSamparkRepo\(|\.firestore\(\s*\)|\bnew Firestore\(/;
/** A top-level declaration starts a new chunk: a guard counts only inside its own function. */
const TOP_LEVEL = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|const|let|var|class)\b/gm;

function samparkModules(): Array<{ file: string; text: string }> {
    const out = execFileSync('git', ['ls-files', 'src'], { cwd: APP_ROOT, encoding: 'utf8' });
    return out
        .split('\n')
        .filter((f) => /\.tsx?$/.test(f) && !f.includes('__tests__'))
        .map((file) => ({ file, text: readFileSync(path.join(APP_ROOT, file), 'utf8') }))
        .filter(({ file, text }) => SAMPARK_PATH.test(file) || TOUCHES_SAMPARK.test(text));
}

/** True when `index` falls inside an import statement (single- or multi-line). */
function inImport(text: string, index: number): boolean {
    for (const m of text.matchAll(/^import\s[\s\S]*?\sfrom\s*["'][^"']+["'];?/gm)) {
        if (m.index! > index) break;
        if (index < m.index! + m[0].length) return true;
    }
    return false;
}

function lineOf(text: string, index: number): number {
    return text.slice(0, index).split('\n').length;
}

/** Where the top-level declaration that contains `index` starts. */
function declarationStart(text: string, index: number): number {
    let start = 0;
    for (const m of text.matchAll(TOP_LEVEL)) {
        if (m.index! > index) break;
        start = m.index!;
    }
    return start;
}

/** Every Firestore open in `text` that does not reach the Sampark database safely. */
function violations(file: string, text: string, reader = APP_DATA_READERS[file]): string[] {
    const found: string[] = [];
    const at = (index: number, why: string) => found.push(`${file}:${lineOf(text, index)} ${why}`);
    for (const m of text.matchAll(/\bgetDb\b/g)) {
        if (!reader) at(m.index!, 'getDb() opens the default database, not the Sampark database');
    }
    for (const m of text.matchAll(/\bgetFirestore\b/g)) {
        if (inImport(text, m.index!)) continue;
        const before = text.slice(declarationStart(text, m.index!), m.index!);
        if (!/\bassertSamparkEnvironmentSafe\(/.test(before)) at(m.index!, 'getFirestore() before assertSamparkEnvironmentSafe() in the same function');
    }
    for (const m of text.matchAll(/\.firestore\(\s*\)|\bnew Firestore\(/g)) at(m.index!, 'opens Firestore around the Sampark guard');
    if (reader) {
        for (const m of text.matchAll(/["'`](sampark_[a-z_]+)["'`]/g)) at(m.index!, `a declared reader of app data names the Sampark collection ${m[1]}`);
        for (const m of text.matchAll(/\.collection\(\s*([^)]*)\)/g)) {
            const name = m[1].match(/^["'`]([\w-]+)["'`]$/)?.[1];
            if (!name || !reader.collections.includes(name)) at(m.index!, `a declared reader of app data opens ${name ? `the undeclared collection ${name}` : 'a collection by a computed name'}`);
        }
    }
    return found;
}

describe('gate: Sampark stores use the Sampark database', () => {
    const modules = samparkModules();
    const openers = modules.filter(({ text }) => OPENS_FIRESTORE.test(text)).map(({ file }) => file);

    it('scans the Sampark routes and finds the modules that open Firestore at all', () => {
        // A gate that scans nothing reports green forever.
        const scanned = modules.map(({ file }) => file);
        expect(scanned).toEqual(
            expect.arrayContaining([
                'src/app/api/sampark/[orgId]/riya/route.ts',
                'src/app/api/sampark/google-calendar/oauth/callback/route.ts',
                'src/app/api/sampark-demo/turn/route.ts',
                'src/app/api/jobs/sampark-dispatch/route.ts',
                'src/app/api/webhooks/sampark-voice/status/route.ts',
            ]),
        );
        expect(openers).toEqual(expect.arrayContaining(['src/lib/sampark/repo/factory.ts', 'src/server/sampark/google-calendar.ts', ...Object.keys(APP_DATA_READERS)]));
    });

    it('every Firestore open in a Sampark module goes to the Sampark database, or is a declared read of app data', () => {
        expect(modules.flatMap(({ file, text }) => violations(file, text))).toEqual([]);
    });

    it('checks each open, not each file', () => {
        // The shape the first version missed: the guard in one function, getDb() in another.
        const mixed = [
            'export async function googleCalendarDeps() {',
            "    const db = await samparkFirestore();",
            '}',
            'export async function leakChannel(orgId: string) {',
            "    await (await getDb()).collection('sampark_google_calendar_channels').doc(orgId).set({});",
            '}',
        ].join('\n');
        expect(violations('x.ts', mixed)).toEqual(['x.ts:5 getDb() opens the default database, not the Sampark database']);

        // A factory whose second function skips the guard.
        const factory = [
            'import {',
            '    getFirestore,',
            "} from 'firebase-admin/firestore';",
            'export async function getRepo() {',
            '    assertSamparkEnvironmentSafe();',
            '    return getFirestore(getApp());',
            '}',
            'export async function getOtherRepo() {',
            '    return getFirestore(getApp());',
            '}',
        ].join('\n');
        expect(violations('x.ts', factory)).toEqual(['x.ts:9 getFirestore() before assertSamparkEnvironmentSafe() in the same function']);
        expect(violations('x.ts', 'const db = admin.firestore();')).toEqual(['x.ts:1 opens Firestore around the Sampark guard']);

        // A declared reader of app data stays on its own collections.
        const reader = { reason: 'test', collections: ['users'] };
        expect(violations('r.ts', "const db = await getDb(); await db.collection('users').doc(uid).get();", reader)).toEqual([]);
        expect(violations('r.ts', "const db = await getDb(); await db.collection('sampark_calls').add({});", reader)).toEqual([
            'r.ts:1 a declared reader of app data names the Sampark collection sampark_calls',
            'r.ts:1 a declared reader of app data opens the undeclared collection sampark_calls',
        ]);
        expect(violations('r.ts', 'const db = await getDb(); await db.collection(name).get();', reader)).toEqual(['r.ts:1 a declared reader of app data opens a collection by a computed name']);
    });
});
