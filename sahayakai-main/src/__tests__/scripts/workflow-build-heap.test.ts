/**
 * Class gate: every CI step that runs the Next.js production build gets the
 * same Node heap as the production image.
 *
 * The bug this catches: the Dockerfile builds with
 * NODE_OPTIONS=--max-old-space-size=4096, but the GitHub workflows ran
 * `npm run build` on Node's default heap (about 2 GB). PR #131 added roughly
 * 1,800 lines of curriculum data, and both `test (20)` and `smoke` died with
 * "JavaScript heap out of memory" at about 1.83 GB, while the same tree built
 * cleanly locally and in Cloud Build. A green production build next to a red
 * CI build is noise that teaches people to ignore red.
 *
 * The gate is on the class, not the two steps: any workflow step whose `run`
 * invokes `npm run build` or `next build` must set NODE_OPTIONS with the
 * Dockerfile's exact --max-old-space-size, so CI and production cannot drift
 * apart again in either direction.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const MONOREPO_ROOT = path.resolve(APP_ROOT, '..');
const WORKFLOW_DIR = path.join(MONOREPO_ROOT, '.github', 'workflows');
const DOCKERFILE = path.join(APP_ROOT, 'Dockerfile');

const HEAP_FLAG = /--max-old-space-size=(\d+)/;

function dockerfileHeapMb(): number {
    const m = readFileSync(DOCKERFILE, 'utf8').match(/NODE_OPTIONS="?[^"\n]*--max-old-space-size=(\d+)/);
    if (!m) throw new Error('Dockerfile no longer sets --max-old-space-size; update this gate deliberately.');
    return Number(m[1]);
}

interface Step { name?: string; run?: string; env?: Record<string, unknown> }
interface Job { env?: Record<string, unknown>; steps?: Step[] }

/** Every step that runs the production build, with the heap it would get. */
function buildSteps(): Array<{ where: string; heapMb: number | null }> {
    const out: Array<{ where: string; heapMb: number | null }> = [];
    for (const file of readdirSync(WORKFLOW_DIR).filter((f) => /\.ya?ml$/.test(f))) {
        const doc = yaml.load(readFileSync(path.join(WORKFLOW_DIR, file), 'utf8')) as
            { env?: Record<string, unknown>; jobs?: Record<string, Job> } | null;
        for (const [jobName, job] of Object.entries(doc?.jobs ?? {})) {
            for (const step of job.steps ?? []) {
                if (!step.run || !/\b(npm run build|next build)\b/.test(step.run)) continue;
                // Step env wins over job env, which wins over workflow env.
                const opts = String(step.env?.NODE_OPTIONS ?? job.env?.NODE_OPTIONS ?? doc?.env?.NODE_OPTIONS ?? '');
                const m = opts.match(HEAP_FLAG);
                out.push({ where: `${file} › ${jobName} › ${step.name ?? step.run}`, heapMb: m ? Number(m[1]) : null });
            }
        }
    }
    return out;
}

describe('CI builds use the production heap (class gate)', () => {
    const expected = dockerfileHeapMb();
    const steps = buildSteps();

    it('finds the build steps it is meant to guard', () => {
        // If this drops to zero the regex or the workflow layout changed and
        // the gate would pass vacuously.
        expect(steps.length).toBeGreaterThanOrEqual(2);
    });

    it(`every build step sets --max-old-space-size=${expected}, matching the Dockerfile`, () => {
        const offenders = steps
            .filter((s) => s.heapMb !== expected)
            .map((s) => `${s.where}: ${s.heapMb ?? 'default heap'}`);
        expect(offenders).toEqual([]);
    });
});
