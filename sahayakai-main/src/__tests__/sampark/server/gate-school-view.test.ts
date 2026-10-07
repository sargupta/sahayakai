/**
 * @jest-environment node
 *
 * CLASS GATE — a school record never leaves the server raw.
 *
 * The stored SamparkSchool carries the test phone's ciphertext and peppered
 * hash. The console must only ever receive `schoolView(school)`, which drops
 * both. Phase 2a shipped with the enable route still returning the raw record
 * (caught at integration), so the gate is on the class, not that route:
 *
 *  (a) every route under src/app/api/sampark/ that obtains a school from the
 *      school service (enableSchool, getSchoolOrThrow, updateSchool,
 *      setSchoolMode, setSchoolPause) must pass it through schoolView() — proven
 *      to fail on a planted violation first;
 *  (b) schoolView() itself never carries testPhoneEnc or testPhoneHash.
 */
import fs from 'node:fs';
import path from 'node:path';

import { schoolView } from '@/server/sampark/school';
import type { SamparkSchool } from '@/types/sampark';

const ROOT = path.resolve(__dirname, '../../../..');
const ROUTES = path.join(ROOT, 'src/app/api/sampark');
const SCHOOL_GETTERS = ['enableSchool', 'getSchoolOrThrow', 'updateSchool', 'setSchoolMode', 'setSchoolPause'];

function routeFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) return routeFiles(full);
        return e.name === 'route.ts' ? [full] : [];
    });
}

/** A route that imports a school getter from the school service but never calls schoolView(). */
function violates(code: string): boolean {
    const imports = code.match(/import\s*\{([^}]*)\}\s*from\s*['"]@\/server\/sampark\/school['"]/);
    if (!imports) return false;
    const names = imports[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0]);
    if (!names.some((n) => SCHOOL_GETTERS.includes(n))) return false;
    return !/\bschoolView\s*\(/.test(code);
}

describe('class gate: school records reach the console only through schoolView()', () => {
    it('the scanner catches a planted violation', () => {
        const planted = `import { enableSchool } from '@/server/sampark/school';\nexport async function POST() { return NextResponse.json(await enableSchool(ctx, o, u, i)); }`;
        expect(violates(planted)).toBe(true);
        expect(violates(planted.replace('NextResponse.json(await enableSchool(ctx, o, u, i))', 'NextResponse.json(schoolView(await enableSchool(ctx, o, u, i)))').replace('{ enableSchool }', '{ enableSchool, schoolView }'))).toBe(false);
    });

    it('the pause route is one of the routes scanned', () => {
        expect(routeFiles(ROUTES).map((f) => path.relative(ROUTES, f))).toContain(path.join('[orgId]', 'pause', 'route.ts'));
    });

    it('no Sampark route returns a raw school', () => {
        const offenders = routeFiles(ROUTES)
            .filter((f) => violates(fs.readFileSync(f, 'utf8')))
            .map((f) => path.relative(ROOT, f));
        expect(offenders).toEqual([]);
    });

    it('schoolView drops the test phone ciphertext and hash', () => {
        const school = {
            orgId: 'o1',
            displayName: 'School',
            testPhoneEnc: 'cipher',
            testPhoneHash: 'hash',
            testPhoneLast4: '0720',
        } as unknown as SamparkSchool;
        const view = schoolView(school, {} as NodeJS.ProcessEnv);
        expect(view).not.toHaveProperty('testPhoneEnc');
        expect(view).not.toHaveProperty('testPhoneHash');
        expect(view.testPhoneLast4).toBe('0720');
        expect(JSON.stringify(view)).not.toMatch(/cipher|"hash"/);
    });
});
