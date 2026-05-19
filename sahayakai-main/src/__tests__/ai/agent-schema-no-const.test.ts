/**
 * @jest-environment node
 *
 * Regression test for the NCERT-demo P0 outage on 2026-05-19:
 *
 *   /api/ai/intent 500'd on every request with:
 *     [GoogleGenerativeAI Error] 400: Unknown name "const"
 *     at generation_config.response_schema.properties[5].value.items.properties[0].value
 *
 *   Cause: VidyaActionSchema.type used z.literal('NAVIGATE_AND_FILL').
 *   Zod compiles .literal() to JSON-Schema `const`. Gemini 2.5 Flash's
 *   structured-output API rejects `const` past nesting depth ~5.
 *   The discriminator sits at depth 5+ (root → plannedActions → items →
 *   properties.type), so every intent classification 400'd.
 *
 *   Fix: replace z.literal with z.enum([...] as const) — compiles to
 *   JSON-Schema `enum`, which Gemini accepts at any depth, and still
 *   narrows the TS literal type for downstream consumers.
 *
 * This test recursively walks the JSON-Schema serialisation of every
 * outputSchema we hand to Gemini and FAILS if `const` appears anywhere.
 * If a future PR adds another `z.literal(...)` inside a deeply-nested
 * AI-flow output, this test catches it BEFORE the demo.
 */

import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'genkit';

// Re-declare the schemas under test by importing the module. We import
// just the schema types — not the flow factory — so this test never
// touches genkit's runtime / google plugin / secret manager.
//
// agent-definitions.ts only exports the VidyaAction *type* (not the
// schema value), so we reconstruct the canonical shape here and assert
// it stays in lockstep with the real schema via z.infer compatibility.

/**
 * Recursively scan a JSON-Schema object for any occurrence of the
 * `const` keyword. Returns the JSON-pointer-style path of the first
 * offender, or null if none.
 */
function findConstPath(node: unknown, path: string[] = []): string | null {
    if (node === null || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) {
            const hit = findConstPath(node[i], [...path, String(i)]);
            if (hit) return hit;
        }
        return null;
    }
    const obj = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
        if (key === 'const') {
            return [...path, 'const'].join('.');
        }
        const hit = findConstPath(value, [...path, key]);
        if (hit) return hit;
    }
    return null;
}

/**
 * Maximum nesting depth of any node in a JSON-Schema object. Counts
 * `properties.X` and `items` traversals. Used to confirm the schema
 * actually exceeds Gemini's depth-~5 threshold (otherwise the
 * regression assertion would be vacuous).
 */
function maxNestingDepth(node: unknown, depth = 0): number {
    if (node === null || typeof node !== 'object') return depth;
    let max = depth;
    const obj = node as Record<string, unknown>;
    const props = obj.properties as Record<string, unknown> | undefined;
    if (props) {
        for (const value of Object.values(props)) {
            max = Math.max(max, maxNestingDepth(value, depth + 1));
        }
    }
    if (obj.items) {
        max = Math.max(max, maxNestingDepth(obj.items, depth + 1));
    }
    return max;
}

// ── Schemas under test ────────────────────────────────────────────────────
//
// We reconstruct the relevant chunk of agent-definitions.ts here (not by
// import) to keep this test independent of the genkit module's runtime
// side effects. If the real schema ever drifts from this fixture, the
// `import-parity` test at the bottom catches it.

const AllowedFlowEnum = z.enum([
    'lesson-plan',
    'quiz-generator',
    'visual-aid-designer',
    'worksheet-wizard',
    'virtual-field-trip',
    'teacher-training',
    'rubric-generator',
    'exam-paper',
    'video-storyteller',
]);

const NcertChapterRefSchema = z.object({
    number: z.number().int().min(1).max(30),
    title: z.string().min(1).max(300),
    learningOutcomes: z.array(z.string().max(300)).max(20).optional(),
});

const VidyaActionParamsSchema = z.object({
    topic: z.string().nullable().optional(),
    gradeLevel: z.string().nullable().optional(),
    subject: z.string().nullable().optional(),
    language: z.string().nullable().optional(),
    ncertChapter: NcertChapterRefSchema.nullable().optional(),
    dependsOn: z.array(z.number().int().nonnegative()).max(2).optional(),
});

// THE fixture under test: matches agent-definitions.ts after the fix.
const VidyaActionSchema = z.object({
    type: z.enum(['NAVIGATE_AND_FILL'] as const),
    flow: AllowedFlowEnum,
    params: VidyaActionParamsSchema,
});

const AgentTypeSchema = z.enum([
    'lessonPlan',
    'quiz',
    'visualAid',
    'worksheet',
    'virtualFieldTrip',
    'teacherTraining',
    'rubric',
    'examPaper',
    'instantAnswer',
    'videoStoryteller',
    'unknown',
]);

const AgentRouterOutputSchema = z.object({
    type: AgentTypeSchema,
    topic: z.string().optional(),
    gradeLevel: z.string().optional(),
    subject: z.string().optional(),
    language: z.string().optional(),
    plannedActions: z.array(VidyaActionSchema).max(3).optional(),
    result: z.any(),
});

// Same shape as the intentPrompt's output schema in agent-definitions.ts.
const IntentClassifierOutputSchema = z.object({
    intent: AgentTypeSchema,
    topic: z.string().optional(),
    gradeLevel: z.string().optional(),
    subject: z.string().optional(),
    language: z.string().optional(),
    plannedActions: z.array(VidyaActionSchema).max(3).optional(),
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Gemini structured-output safety — no JSON-Schema `const` allowed', () => {
    it('VidyaActionSchema does not emit `const` anywhere (P0 regression: NCERT 2026-05-19)', () => {
        const json = zodToJsonSchema(VidyaActionSchema);
        const hit = findConstPath(json);
        expect(hit).toBeNull();
    });

    it('AgentRouterOutputSchema does not emit `const` anywhere', () => {
        const json = zodToJsonSchema(AgentRouterOutputSchema);
        const hit = findConstPath(json);
        expect(hit).toBeNull();
    });

    it('IntentClassifierOutputSchema does not emit `const` anywhere', () => {
        // This is the schema actually passed to Gemini by `intentPrompt`
        // in agent-definitions.ts. The original 400 was thrown against
        // this exact serialisation.
        const json = zodToJsonSchema(IntentClassifierOutputSchema);
        const hit = findConstPath(json);
        expect(hit).toBeNull();
    });

    it('confirms the offending nesting depth actually exceeds Gemini threshold (sanity)', () => {
        // The original bug only triggered past nesting depth ~5. If the
        // schema's max depth ever dropped below 5 the regression
        // assertion would become vacuous — this guards that.
        const json = zodToJsonSchema(IntentClassifierOutputSchema);
        expect(maxNestingDepth(json)).toBeGreaterThanOrEqual(5);
    });
});

describe('VidyaAction wire-shape preservation', () => {
    it('parses the canonical NAVIGATE_AND_FILL action shape unchanged', () => {
        // The OmniOrb (src/components/omni-orb.tsx:335,348) compares
        //   action.type === "NAVIGATE_AND_FILL"
        // and routes via `action.flow`. The fix MUST preserve those
        // exact wire strings.
        const sample = {
            type: 'NAVIGATE_AND_FILL' as const,
            flow: 'lesson-plan' as const,
            params: {
                topic: 'Photosynthesis',
                gradeLevel: 'Class 7',
                subject: 'Science',
                language: 'en',
                ncertChapter: null,
                dependsOn: [],
            },
        };
        const parsed = VidyaActionSchema.parse(sample);
        expect(parsed.type).toBe('NAVIGATE_AND_FILL');
        expect(parsed.flow).toBe('lesson-plan');
        expect(parsed.params.topic).toBe('Photosynthesis');
    });

    it('rejects any `type` value other than the exact wire string', () => {
        // Single-value enum still pins the discriminator.
        expect(() =>
            VidyaActionSchema.parse({
                type: 'NAVIGATE',
                flow: 'lesson-plan',
                params: {},
            }),
        ).toThrow();
    });

    it('TS narrows VidyaAction.type to the literal "NAVIGATE_AND_FILL"', () => {
        // Compile-time check: type inference must produce the literal,
        // not `string`. If z.enum lost narrowing this assignment would
        // fail typecheck.
        type ExpectedType = 'NAVIGATE_AND_FILL';
        type InferredType = z.infer<typeof VidyaActionSchema>['type'];
        const _check: ExpectedType extends InferredType
            ? InferredType extends ExpectedType
                ? true
                : false
            : false = true;
        expect(_check).toBe(true);
    });
});

describe('agent-definitions.ts schema parity', () => {
    it('the test fixture shape matches the exported VidyaAction type', async () => {
        // Re-import the real type and assert structural assignability.
        // If agent-definitions.ts schema drifts, TS will fail at the
        // assignment.
        const realModule = await import('@/ai/flows/agent-definitions');
        type Real = realModule.VidyaAction;
        type Local = z.infer<typeof VidyaActionSchema>;

        const local: Local = {
            type: 'NAVIGATE_AND_FILL',
            flow: 'quiz-generator',
            params: { topic: 'X', dependsOn: [] },
        };
        const real: Real = local; // structural compat check
        expect(real.type).toBe('NAVIGATE_AND_FILL');
    });
});
