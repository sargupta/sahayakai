/**
 * Class gate: every Vobiz dial whose answer streams into the telephony sidecar warms the sidecar
 * first.
 *
 * The bug this catches: #159 removed the always-warm sidecar instance and added warmTelephony()
 * to the teacher attendance route, so the sidecar's ~10 s cold start overlaps the ring instead
 * of the parent's first seconds. Riya over Vobiz then arrived as a second path into the same
 * sidecar without the warm-up, so its first call after an idle spell could be answered into
 * silence.
 *
 * Fixing one call site would not stop the next, so the gate is on the class: every source file
 * that dials Vobiz must be declared below as streaming (and then call warmTelephony) or as
 * playing clips (no sidecar). A new dial site that is not declared fails here, which forces its
 * author to decide.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

/** Every module that places a Vobiz call, and whether its answer streams into the sidecar. */
const DIAL_SITES: Record<string, 'streams' | 'plays-clips'> = {
    'src/app/api/attendance/call/route.ts': 'streams', // teacher parent call, live AI conversation
    'src/lib/sampark/conversation/vobiz-provider.ts': 'streams', // Riya over the Vobiz bridge
    'src/lib/sampark/dispatch/vobiz-carrier.ts': 'plays-clips', // Sampark keypad notices
};

function dialSites(): string[] {
    const out = execFileSync('git', ['grep', '-l', 'placeVobizCall', '--', 'src'], { cwd: APP_ROOT, encoding: 'utf8' });
    return out
        .split('\n')
        .filter((f) => f && !f.includes('__tests__') && f !== 'src/lib/vobiz/client.ts');
}

describe('gate: Vobiz dials that stream into the sidecar warm it first', () => {
    const found = dialSites();

    it('finds the dial sites at all', () => {
        expect(found.length).toBeGreaterThanOrEqual(3);
    });

    it('every dial site is declared', () => {
        expect(found.filter((f) => !(f in DIAL_SITES))).toEqual([]);
    });

    it.each(Object.entries(DIAL_SITES).filter(([, kind]) => kind === 'streams').map(([f]) => f))('%s calls warmTelephony()', (file) => {
        expect(readFileSync(path.join(APP_ROOT, file), 'utf8')).toMatch(/\bwarmTelephony\(/);
    });
});
