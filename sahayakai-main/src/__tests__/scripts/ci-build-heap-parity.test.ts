/**
 * Class gate: CI builds fail only for reasons production would also fail for.
 *
 * Two ways CI went red on 2026-10-23 with no fault in the code:
 *
 *  1. Heap. The production image builds with the Dockerfile's NODE_OPTIONS
 *     (--max-old-space-size=4096). The Cloud Build test gate ran the same
 *     `next build` in a bare node:20 container with Node's default ~2 GB heap,
 *     ran out of memory, and failed commits the deploy would have built. The
 *     class: any Cloud Build step that runs the Next build outside Docker must
 *     give it at least the production heap.
 *
 *  2. Runner apt sources. `playwright install --with-deps` runs `apt-get
 *     update`, which fails if any source on the runner image is unreachable;
 *     packages.microsoft.com returned 403 and E2E Smoke died before a test
 *     ran. The class: any workflow that installs Playwright with system deps
 *     first drops the image's third-party apt sources.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const WORKFLOW_DIR = path.join(APP_ROOT, '..', '.github', 'workflows');

/** The heap the production image builds with, from the Dockerfile. */
function productionHeapMb(): number {
  const dockerfile = readFileSync(path.join(APP_ROOT, 'Dockerfile'), 'utf8');
  const m = /^ENV\s+NODE_OPTIONS=["']?[^"'\n]*--max-old-space-size=(\d+)/m.exec(dockerfile);
  if (!m) throw new Error('Dockerfile no longer sets NODE_OPTIONS --max-old-space-size; update this gate');
  return Number(m[1]);
}

/** Cloud Build steps (one YAML list item each) in a config, comments removed. */
function cloudBuildSteps(body: string): string[] {
  const steps = body.split(/^steps:\s*$/m)[1]?.split(/^\S/m)[0] ?? '';
  return steps
    .split(/^\s{2}- /m)
    .slice(1)
    .map((s) => s.replace(/^\s*#.*$/gm, ''));
}

/** A step that runs the Next production build directly (not inside a Docker build, which carries the Dockerfile's env). */
const runsNextBuild = (step: string) => /['"]run['"]\s*,\s*['"]build['"]|\bnext build\b/.test(step) && !/cloud-builders\/docker/.test(step);

describe('CI gives `next build` at least the production heap', () => {
  const prod = productionHeapMb();
  const configs = readdirSync(APP_ROOT)
    .filter((f) => /^cloudbuild.*\.ya?ml$/.test(f))
    .map((file) => ({ file, body: readFileSync(path.join(APP_ROOT, file), 'utf8') }));
  const buildSteps = configs.flatMap(({ file, body }) => cloudBuildSteps(body).filter(runsNextBuild).map((step) => [file, step] as const));

  it('finds the CI gate build step to check', () => {
    expect(prod).toBeGreaterThanOrEqual(4096);
    expect(buildSteps.map(([file]) => file)).toContain('cloudbuild-ci.yaml');
  });

  it.each(buildSteps)('%s: the build step sets NODE_OPTIONS --max-old-space-size >= the Dockerfile', (_file, step) => {
    const m = /NODE_OPTIONS=[^'"\n]*--max-old-space-size=(\d+)/.exec(step);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(prod);
  });
});

describe('Playwright --with-deps installs do not depend on the runner image\'s third-party apt sources', () => {
  const workflows = readdirSync(WORKFLOW_DIR)
    .filter((f) => /\.ya?ml$/.test(f))
    .map((file) => ({ file, body: readFileSync(path.join(WORKFLOW_DIR, file), 'utf8').replace(/^\s*#.*$/gm, '') }));
  const withDeps = workflows.filter((w) => /playwright install[^\n]*--with-deps/.test(w.body));

  it('finds at least one such workflow', () => {
    expect(withDeps.map((w) => w.file)).toContain('e2e-smoke.yml');
  });

  it.each(withDeps.map((w) => [w.file, w.body] as const))('%s removes microsoft-prod apt sources before installing', (_file, body) => {
    const drop = body.search(/rm -f[^\n]*sources\.list\.d\/microsoft-prod/);
    const install = body.search(/playwright install[^\n]*--with-deps/);
    expect(drop).toBeGreaterThan(-1);
    expect(drop).toBeLessThan(install);
  });
});
