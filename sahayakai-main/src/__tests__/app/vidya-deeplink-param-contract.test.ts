/**
 * VIDYA deep-link param contract.
 *
 * The intent route and the agent router build ONE query string and reuse it
 * for every flow they can navigate to — `topic`, `gradeLevel`, `subject`,
 * `language`. A destination page that reads some other name for the text
 * field is not "slightly wrong": its whole pre-fill-and-auto-submit branch
 * is unreachable, and the teacher lands on an empty form after asking for
 * something specific out loud. That is silent — no error, no log — so
 * nothing but a contract test catches it.
 *
 * `/rubric-generator` read only `assignmentDescription` and
 * `/worksheet-wizard` read only `prompt`; neither name is emitted by the
 * routers at all.
 *
 * The AI routers are not the only producers. The community feed's "Use this"
 * button builds the same four params by hand and pushes a teacher at a flow
 * page, so a rename on the consumer side breaks that button just as silently.
 * It is enumerated below alongside the routers.
 *
 * The producer's flow list is parsed out of the route source rather than
 * hard-coded, so adding a tenth flow to the switch fails here until its
 * destination is listed and honours the contract. Reading sources (instead
 * of rendering nine pages against Firebase, Zustand and the mic) follows
 * vidya-prefill-sweep.test.ts, which pins the same surfaces at file level.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const REPO_ROOT = resolve(__dirname, '../../..');

function read(file: string): string {
    return readFileSync(resolve(REPO_ROOT, file), 'utf8');
}

/**
 * Everything that builds this query string and navigates a teacher to a flow.
 *
 * The two AI routers share one builder (`queryParams` → `/<flow>?${queryString}`)
 * and a switch of literal destinations, so their flow list can be parsed out of
 * the source. The community feed's "Use this" button builds its own
 * (`params` → `/${c.route}?${params.toString()}`) and takes the destination from
 * a TYPE_CONFIG table keyed by resource type, so `routesLiteralFlows` is false
 * for it: what is pinned there is the param contract, which is what a rename on
 * the consumer side would break. Its destinations are NOT asserted, and they do
 * not all resolve today — the table sends `lesson-plan` to `/lesson-planner`,
 * which is not a route. That is its own defect with its own fix, not this one.
 */
const PRODUCERS = [
    { file: 'src/app/api/ai/intent/route.ts', builder: 'queryParams', routesLiteralFlows: true },
    { file: 'src/ai/flows/agent-router.ts', builder: 'queryParams', routesLiteralFlows: true },
    { file: 'src/components/community/resource-feed.tsx', builder: 'params', routesLiteralFlows: false },
];

/** The subset whose destinations are literal `/<flow>?${queryString}` templates. */
const FLOW_ROUTERS = PRODUCERS.filter((p) => p.routesLiteralFlows);

/** The text param the shared query string carries. */
const CANONICAL_TEXT_PARAM = 'topic';

/**
 * Where each navigable flow's URL params are actually read. Aliases are the
 * extra names that page also accepts — legacy or supervisor-specific — and
 * exist only to document them; the contract is the canonical param.
 */
const DESTINATIONS: Record<string, { consumer: string; aliases: string[] }> = {
    'lesson-plan': { consumer: 'src/features/lesson-planner/hooks/use-lesson-plan.ts', aliases: [] },
    'quiz-generator': { consumer: 'src/features/quiz-generator/hooks/use-quiz-generator.ts', aliases: [] },
    'visual-aid-designer': { consumer: 'src/app/visual-aid-designer/page.tsx', aliases: ['prompt'] },
    'worksheet-wizard': { consumer: 'src/features/worksheet-wizard/hooks/use-worksheet-wizard.ts', aliases: ['prompt'] },
    'virtual-field-trip': { consumer: 'src/app/virtual-field-trip/page.tsx', aliases: [] },
    'teacher-training': { consumer: 'src/app/teacher-training/page.tsx', aliases: ['question'] },
    'rubric-generator': { consumer: 'src/features/rubric-generator/hooks/use-rubric-generator.ts', aliases: ['assignmentDescription'] },
    'video-storyteller': { consumer: 'src/app/video-storyteller/page.tsx', aliases: [] },
    'exam-paper': { consumer: 'src/features/exam-paper/hooks/use-exam-paper.ts', aliases: [] },
};

/** Flows the producer's navigate switch routes to. */
function navigableFlows(source: string): string[] {
    const matches = source.matchAll(/url:\s*`\/([a-z-]+)\?\$\{queryString\}`/g);
    return [...matches].map((m) => m[1]);
}

/** Param names a producer writes into its query string, via `<builder>.set`. */
function emittedParams(source: string, builder: string): string[] {
    const matches = source.matchAll(
        new RegExp(String.raw`${builder}\.set\(\s*['"]([a-zA-Z]+)['"]`, 'g'),
    );
    return [...new Set([...matches].map((m) => m[1]))];
}

/** Param names a destination reads, via `searchParams.get` / `searchParams?.get`. */
function readParams(source: string): string[] {
    const matches = source.matchAll(/searchParams\??\.get\(\s*['"]([a-zA-Z]+)['"]/g);
    return [...new Set([...matches].map((m) => m[1]))];
}

describe('VIDYA deep-link param contract', () => {
    describe.each(PRODUCERS)('$file', ({ file, builder, routesLiteralFlows }) => {
        const source = read(file);

        it(`emits '${CANONICAL_TEXT_PARAM}' as the text param`, () => {
            expect(emittedParams(source, builder)).toContain(CANONICAL_TEXT_PARAM);
        });

        if (routesLiteralFlows) {
            it('routes only to flows the destination table knows about', () => {
                const unlisted = navigableFlows(source).filter((flow) => !DESTINATIONS[flow]);
                expect(unlisted).toEqual([]);
            });
        }
    });

    it('every producer emits the same param names', () => {
        const [first, ...rest] = PRODUCERS.map((p) =>
            emittedParams(read(p.file), p.builder).sort(),
        );
        for (const other of rest) expect(other).toEqual(first);
    });

    describe.each(Object.entries(DESTINATIONS))('%s', (flow, { consumer, aliases }) => {
        const source = read(consumer);

        it(`reads '${CANONICAL_TEXT_PARAM}' from the URL`, () => {
            expect(readParams(source)).toContain(CANONICAL_TEXT_PARAM);
        });

        if (aliases.length > 0) {
            it.each(aliases)("still accepts its '%s' alias", (alias) => {
                expect(readParams(source)).toContain(alias);
            });
        }

        it('is reachable from at least one producer', () => {
            const reachable = FLOW_ROUTERS.some((p) => navigableFlows(read(p.file)).includes(flow));
            expect(reachable).toBe(true);
        });
    });
});
