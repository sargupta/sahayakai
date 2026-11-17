/** @jest-environment node */
/**
 * Regression: the local launcher's Practice mode enabled only `ptm_invitation`, so every
 * class-wide announcement (holiday, exam, event, closure) was refused with "This workflow is not
 * switched on yet", 0 families were eligible and Class-Wide Outreach could never start.
 * Every mode of the launcher must enable every Riya workflow the app knows.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RIYA_PURPOSES } from '@/lib/sampark/conversation/riya-purposes';

const SRC = readFileSync(join(process.cwd(), 'scripts/sampark/riya-local.mjs'), 'utf8');

describe('riya-local launcher workflows', () => {
    it('RIYA_ALL_PURPOSES lists exactly the app’s Riya workflows', () => {
        const m = SRC.match(/const RIYA_ALL_PURPOSES = '([^']+)'/);
        expect(m).not.toBeNull();
        expect(m![1].split(',').sort()).toEqual([...RIYA_PURPOSES].sort());
    });

    it('no mode hard-codes a narrower SAMPARK_RIYA_PURPOSES', () => {
        const uses = [...SRC.matchAll(/SAMPARK_RIYA_PURPOSES:\s*([^,\n]+)/g)].map((x) => x[1].trim());
        expect(uses.length).toBeGreaterThanOrEqual(3);
        for (const u of uses) expect(u).toBe('RIYA_ALL_PURPOSES');
    });
});

describe('riya-local launcher opens the demo school after the provider page', () => {
    it('sets both the server and the browser demo flags', () => {
        expect(SRC).toMatch(/appEnv\.SAMPARK_DEMO_ENABLED = 'true';/);
        expect(SRC).toMatch(/appEnv\.NEXT_PUBLIC_SAMPARK_DEMO_ENABLED = 'true';/);
    });
});
