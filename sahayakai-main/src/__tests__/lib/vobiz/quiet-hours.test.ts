/**
 * Class gate: quiet hours are a property of the SYSTEM, not of one route.
 *
 * A parent should never be phoned about their child at 2am. Until now that
 * guarantee lived in exactly one place — the dial route — which binds only
 * callers who go through the app. Anything that reaches the carrier another way
 * skips it.
 *
 * That is not hypothetical. This feature was tested by a script that talked to
 * the carrier directly, and it rang a real phone at 23:55 IST, because the only
 * guard lived somewhere the script never went.
 *
 * So the assertion here is not "the answer route checks the clock" — that is the
 * instance. It is that EVERY server-side entry point on the call path consults
 * the shared window, so a new one cannot ship without one.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { CALLING_WINDOW_END_HOUR, CALLING_WINDOW_START_HOUR, checkCallingWindow } from '@/lib/calling-hours';

const ROOT = process.cwd();

/**
 * Every route that can cause, or continue, a phone conversation with a parent.
 * Discovered rather than listed, so a new Vobiz endpoint is in scope the moment
 * it lands.
 */
function callPathRoutes(): string[] {
    const vobizDir = join(ROOT, 'src/app/api/attendance/vobiz');
    const discovered = readdirSync(vobizDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => join('src/app/api/attendance/vobiz', e.name, 'route.ts'));
    return [join('src/app/api/attendance/call', 'route.ts'), ...discovered];
}

/** Routes that may legitimately skip the check, each with a stated reason. */
const EXEMPT: Record<string, string> = {
    // Reports what already happened. Refusing a hangup callback out of hours
    // would strand the record, not protect anybody — the call is over.
    'src/app/api/attendance/vobiz/status/route.ts':
        'records the outcome of a call that has already ended',
};

describe('quiet hours bind every entry point on the call path', () => {
    const routes = callPathRoutes();

    it('finds the routes', () => {
        // If discovery breaks, every it.each below passes on an empty list.
        expect(routes.length).toBeGreaterThanOrEqual(3);
    });

    it.each(routes)('%s consults the shared calling window', (rel) => {
        if (EXEMPT[rel]) return;
        const src = readFileSync(join(ROOT, rel), 'utf8');
        expect(src).toMatch(/checkCallingWindow\(/);
    });

    it.each(routes)('%s does not re-implement the window itself', (rel) => {
        const src = readFileSync(join(ROOT, rel), 'utf8');
        // A local hour comparison is how the two copies drift apart, and the
        // one that drifts is the one that calls a parent at midnight.
        expect(src).not.toMatch(/getHours\(\)\s*[<>]/);
    });

    it('every exemption names a reason', () => {
        for (const reason of Object.values(EXEMPT)) {
            expect(reason.length).toBeGreaterThan(20);
        }
    });
});

describe('the window itself', () => {
    const istInstant = (hour: number, minute: number) =>
        new Date(Date.UTC(2026, 8, 18, hour - 5, minute - 30));

    it('refuses the hour this feature was actually tested at', () => {
        // 23:55 IST. The regression that motivated this file.
        expect(checkCallingWindow(istInstant(23, 55)).allowed).toBe(false);
    });

    it('refuses the small hours', () => {
        for (const h of [0, 2, 5, 7]) {
            expect(checkCallingWindow(istInstant(h, 30)).allowed).toBe(false);
        }
    });

    it('allows the working day', () => {
        expect(checkCallingWindow(istInstant(CALLING_WINDOW_START_HOUR, 0)).allowed).toBe(true);
        expect(checkCallingWindow(istInstant(CALLING_WINDOW_END_HOUR - 1, 59)).allowed).toBe(true);
    });
});
