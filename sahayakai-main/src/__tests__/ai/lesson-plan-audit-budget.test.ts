/** @jest-environment node */
/**
 * Regression: the optional materials audit (a second model call after the lesson plan is
 * generated) once stalled for >40 s and pushed /api/ai/lesson-plan past its 60 s budget, so a
 * plan that had already been generated was thrown away and the teacher saw "AI service busy".
 * The audit must stay time-boxed, well inside the route budget.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Normalise line endings: a Windows checkout (core.autocrlf=true) has CRLF, the repo has LF.
const SRC = readFileSync(join(process.cwd(), 'src/ai/flows/lesson-plan-generator.ts'), 'utf8').replace(/\r\n/g, '\n');

describe('lesson plan materials audit budget', () => {
    it('the audit call is wrapped in withTimeout', () => {
        expect(SRC).toMatch(/withTimeout\(\s*auditMaterials\(/);
    });

    it('its budget leaves the generation most of the 60 s route budget', () => {
        const m = SRC.match(/MATERIALS_AUDIT_BUDGET_MS\s*=\s*([\d_]+)/);
        expect(m).not.toBeNull();
        const ms = Number(m![1].replace(/_/g, ''));
        expect(ms).toBeGreaterThan(0);
        expect(ms).toBeLessThanOrEqual(15_000);
    });

    it('a timed-out audit is caught and keeps the plan (inside the try/catch)', () => {
        const call = SRC.indexOf('withTimeout(\n            auditMaterials(');
        const tryStart = SRC.lastIndexOf('try {', call);
        const catchAfter = SRC.indexOf('} catch (auditError)', call);
        expect(call).toBeGreaterThan(0);
        expect(tryStart).toBeGreaterThan(0);
        expect(catchAfter).toBeGreaterThan(call);
    });
});
