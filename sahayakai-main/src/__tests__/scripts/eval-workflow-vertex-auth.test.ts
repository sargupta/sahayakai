/**
 * Class gate: a CI job that runs the live AI evals can authenticate to every
 * provider the app's flows actually call.
 *
 * The bug this catches: on 2026-07-22 (b058ca65) the default Genkit provider
 * moved to Vertex AI, which authenticates with Application Default Credentials.
 * The eval workflow still supplied only a Gemini API key, so every live eval
 * failed with VertexAI.GoogleAuthError on every run for three months — the
 * blocking quality gate for the product's AI output measured nothing.
 *
 * So the gate is on the class, not the instance: while any source (the default
 * model in src/ai/genkit.ts, or any flow/evaluator pinning a model) uses a
 * `vertexai/` model, every workflow step that runs the live evals must come
 * after a Google Cloud auth step that provides ADC.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const WORKFLOW_DIR = path.join(APP_ROOT, '..', '.github', 'workflows');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'node_modules') sourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

/** True while any shipped source calls a Vertex model. */
function appUsesVertex(): boolean {
  return sourceFiles(path.join(APP_ROOT, 'src')).some((f) => /['"`]vertexai\//.test(readFileSync(f, 'utf8')));
}

/** Workflow bodies with comment lines removed. */
function workflows(): { file: string; body: string }[] {
  return readdirSync(WORKFLOW_DIR)
    .filter((f) => /\.ya?ml$/.test(f))
    .map((file) => ({ file, body: readFileSync(path.join(WORKFLOW_DIR, file), 'utf8').replace(/^\s*#.*$/gm, '') }));
}

/** A step that runs the evals against real models (the --dry dataset check spends nothing and needs no auth). */
const LIVE_EVAL = /run-evals\.mts(?![^\n]*--dry)/;
const GCP_AUTH = /google-github-actions\/auth@|GOOGLE_APPLICATION_CREDENTIALS=/;

describe('live AI evals can authenticate to Vertex AI', () => {
  const evalWorkflows = workflows().filter((w) => LIVE_EVAL.test(w.body));

  it('finds the eval workflow and a Vertex model in the app (the gate scans something)', () => {
    expect(evalWorkflows.map((w) => w.file)).toContain('genkit-eval.yml');
    expect(appUsesVertex()).toBe(true);
  });

  it.each(evalWorkflows.map((w) => [w.file, w.body] as const))('%s authenticates to Google Cloud before the live evals run', (_file, body) => {
    const auth = body.search(GCP_AUTH);
    const live = body.search(LIVE_EVAL);
    expect(auth).toBeGreaterThan(-1);
    expect(auth).toBeLessThan(live);
  });
});
