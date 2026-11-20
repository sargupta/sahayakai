/**
 * Class gate: every CI job that runs the live AI evals authenticates to Google Cloud first.
 *
 * The bug this catches: the app calls Gemini through Vertex AI (src/ai/genkit.ts, usingVertex),
 * which needs Application Default Credentials. genkit-eval.yml only supplied a Gemini API key, so
 * every live eval failed with "[VertexAI.GoogleAuthError]: Unable to authenticate your request",
 * on main's weekly run since 2026-10-12 and on every pull request touching src/ai. A blocking
 * quality gate that is always red stops meaning anything. Any job with a step that runs the live
 * evals (run-evals.mts without --dry) must have a google-github-actions/auth step before it.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const WORKFLOWS = path.resolve(__dirname, '..', '..', '..', '..', '.github', 'workflows');

interface Step { name?: string; uses?: string; run?: string }
interface Job { steps?: Step[] }

const runsLiveEvals = (s: Step) => typeof s.run === 'string' && /run-evals\.mts/.test(s.run) && !/--dry\b/.test(s.run);
const authenticates = (s: Step) => typeof s.uses === 'string' && /^google-github-actions\/auth@/.test(s.uses);

function jobs(): Array<{ file: string; job: string; steps: Step[] }> {
    return readdirSync(WORKFLOWS)
        .filter((f) => /\.ya?ml$/.test(f))
        .flatMap((file) => {
            const doc = yaml.load(readFileSync(path.join(WORKFLOWS, file), 'utf8')) as { jobs?: Record<string, Job> } | null;
            return Object.entries(doc?.jobs ?? {}).map(([job, j]) => ({ file, job, steps: j.steps ?? [] }));
        });
}

describe('gate: live AI evals run with Google Cloud credentials', () => {
    const evalJobs = jobs().filter((j) => j.steps.some(runsLiveEvals));

    it('finds the live eval job at all', () => {
        expect(evalJobs.map((j) => j.file)).toContain('genkit-eval.yml');
    });

    it.each(evalJobs.map((j) => [`${j.file} › ${j.job}`, j] as const))('%s authenticates before its first live eval step', (_label, j) => {
        const firstEval = j.steps.findIndex(runsLiveEvals);
        const firstAuth = j.steps.findIndex(authenticates);
        expect({ firstAuth: firstAuth >= 0 && firstAuth < firstEval }).toEqual({ firstAuth: true });
    });
});
