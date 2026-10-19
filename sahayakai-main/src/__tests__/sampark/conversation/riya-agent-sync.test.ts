/** @jest-environment node */
/**
 * Class gate: the read-only clone verifier (scripts/sampark/verify-riya-clone.mjs) checks the
 * hosted agent against copies of Sahayak's variable list and preview opening. If either copy
 * drifts from the app's constants, the verifier would pass an agent the app cannot drive, or
 * the preview would show a line the agent never says. The script is plain .mjs (run with node,
 * no build), so the copies are compared here as text.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RIYA_OPENING_TEMPLATE, RIYA_VARIABLES, riyaOpening } from '@/lib/sampark/conversation/riya-purposes';

const script = readFileSync(join(process.cwd(), 'scripts/sampark/verify-riya-clone.mjs'), 'utf8');

function literal(name: string): string {
    const m = script.match(new RegExp(`export const ${name} = ([^;]+);`));
    if (!m) throw new Error(`${name} not found in verify-riya-clone.mjs`);
    return m[1];
}

describe('verify-riya-clone.mjs stays in step with the app', () => {
    it('has the same 14 variables, in order', () => {
        expect(JSON.parse(literal('SAHAYAK_VARIABLES').replace(/'/g, '"'))).toEqual([...RIYA_VARIABLES]);
    });

    it('has the same preview opening', () => {
        expect(literal('OPENING_TEMPLATE')).toBe(JSON.stringify(RIYA_OPENING_TEMPLATE));
    });

    it('the preview opening only uses a variable Sahayak sends, and fills it', () => {
        const used = [...RIYA_OPENING_TEMPLATE.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
        expect(used.every((v) => (RIYA_VARIABLES as readonly string[]).includes(v))).toBe(true);
        expect(riyaOpening('Hillview Demo School')).toBe("Hello, I'm Riya, an AI assistant calling on behalf of Hillview Demo School with an important update. Is this a good time to talk?");
        // AI disclosure is in the opening itself (verifier 12e), so the preview shows it before anything else.
        expect(RIYA_OPENING_TEMPLATE).toMatch(/\ban AI assistant\b/);
    });
});
