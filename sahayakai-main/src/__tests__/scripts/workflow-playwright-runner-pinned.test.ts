/**
 * Class gate: a workflow that installs Playwright browsers runs on a pinned
 * runner image, never a floating `*-latest` one.
 *
 * The bug this catches: on 2026-10-22 GitHub moved `ubuntu-latest` to Ubuntu
 * 26.04. Playwright 1.60 supports only the images it was released for, so
 * `npx playwright install --with-deps chromium` refused the new image and the
 * E2E Smoke check failed on every pull request before a single test ran. No
 * code changed; the floor moved under the job.
 *
 * Pinning one job would not stop it recurring in the next Playwright workflow,
 * so the gate is on the class: any workflow file that installs Playwright must
 * name an exact runner image in every `runs-on`. Moving the pin is then a
 * deliberate change, made when Playwright supports the newer image.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const WORKFLOW_DIR = path.join(APP_ROOT, '..', '.github', 'workflows');

function workflows(): { file: string; body: string }[] {
  return readdirSync(WORKFLOW_DIR)
    .filter((f) => /\.ya?ml$/.test(f))
    .map((file) => ({ file, body: readFileSync(path.join(WORKFLOW_DIR, file), 'utf8') }));
}

/** Every `runs-on:` value in a workflow, ignoring comment lines. */
function runnerImages(body: string): string[] {
  return [...body.matchAll(/^[^#\n]*\bruns-on:\s*(.+)$/gm)].map((m) => m[1].replace(/\s+#.*$/, '').trim());
}

describe('Playwright workflows run on a pinned runner image', () => {
  const playwright = workflows().filter((w) => /playwright install/.test(w.body));

  it('finds at least one Playwright workflow to check', () => {
    // A gate that scans nothing reports green forever.
    expect(playwright.map((w) => w.file)).toContain('e2e-smoke.yml');
  });

  it.each(playwright.map((w) => [w.file, w.body] as const))('%s names an exact image in every runs-on', (_file, body) => {
    const images = runnerImages(body);
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image).not.toMatch(/-latest\b/);
    }
  });
});
