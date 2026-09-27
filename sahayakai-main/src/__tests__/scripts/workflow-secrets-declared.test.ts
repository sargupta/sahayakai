/**
 * Class gate: every secret a workflow references must be declared, and every
 * declared secret must still be referenced.
 *
 * The bug this catches: `quality-gates.yml` referenced
 * `secrets.GCP_SA_READ_ONLY_KEY`, which was never created on the repository.
 * GitHub does not warn about that. The expression expands to an empty string,
 * and `google-github-actions/auth` then fails with a message about its own
 * inputs rather than about the missing secret. The nightly schedule turned
 * `main` red every day from 2026-07 to 2026-09-27, and because the red was
 * permanent it stopped carrying information — while the Cloud Run drift check
 * it guarded never ran a single time.
 *
 * Fixing that one reference would not stop it recurring, so the gate is on the
 * class: a reference with no row in .github/REQUIRED_SECRETS.md fails here, on
 * the pull request that introduces it, which forces whoever adds it to state
 * whether the secret exists and what breaks while it does not.
 *
 * The reverse direction matters too. A row whose secret is no longer referenced
 * anywhere is stale documentation, and stale documentation about credentials is
 * worse than none: it implies a secret is load-bearing when nothing reads it.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const MONOREPO_ROOT = path.resolve(APP_ROOT, '..');
const WORKFLOW_DIR = path.join(MONOREPO_ROOT, '.github', 'workflows');
const MANIFEST = path.join(MONOREPO_ROOT, '.github', 'REQUIRED_SECRETS.md');

/** Secret names referenced from any workflow, with the files that reference them. */
function referencedSecrets(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const files = readdirSync(WORKFLOW_DIR).filter((f) => /\.ya?ml$/.test(f));
  for (const file of files) {
    const body = readFileSync(path.join(WORKFLOW_DIR, file), 'utf8');
    for (const m of body.matchAll(/secrets\.([A-Z0-9_]+)/g)) {
      const name = m[1];
      // GITHUB_TOKEN is minted per run by Actions itself; nobody creates it.
      if (name === 'GITHUB_TOKEN') continue;
      const where = found.get(name) ?? [];
      if (!where.includes(file)) where.push(file);
      found.set(name, where);
    }
  }
  return found;
}

/** Secret names declared in the manifest's table (first column, backticked). */
function declaredSecrets(): string[] {
  const body = readFileSync(MANIFEST, 'utf8');
  return [...body.matchAll(/^\|\s*`([A-Z0-9_]+)`\s*\|/gm)].map((m) => m[1]);
}

describe('workflow secrets are declared in .github/REQUIRED_SECRETS.md', () => {
  it('finds workflows to scan at all', () => {
    // Guards against the whole suite passing vacuously if the path is ever
    // wrong — a gate that scans nothing reports green forever.
    const files = readdirSync(WORKFLOW_DIR).filter((f) => /\.ya?ml$/.test(f));
    expect(files.length).toBeGreaterThan(3);
    expect(referencedSecrets().size).toBeGreaterThan(0);
  });

  it('declares every secret referenced by a workflow', () => {
    const declared = new Set(declaredSecrets());
    const undeclared = [...referencedSecrets().entries()]
      .filter(([name]) => !declared.has(name))
      .map(([name, files]) => `${name} (referenced by ${files.join(', ')})`);

    expect(undeclared).toEqual([]);
  });

  it('has no stale rows for secrets nothing references', () => {
    const referenced = new Set(referencedSecrets().keys());
    const stale = declaredSecrets().filter((name) => !referenced.has(name));

    expect(stale).toEqual([]);
  });

  it('gives every declared secret a status and a consequence', () => {
    const body = readFileSync(MANIFEST, 'utf8');
    const rows = [...body.matchAll(/^\|\s*`([A-Z0-9_]+)`\s*\|(.*)$/gm)];
    expect(rows.length).toBe(declaredSecrets().length);

    for (const [, name, rest] of rows) {
      const cells = rest.split('|').map((c) => c.trim());
      // status | referenced-by | consequence
      expect(cells.filter((c) => c.length > 0).length).toBeGreaterThanOrEqual(3);
      expect(`${name}: ${cells[0]}`).toMatch(/: .*(present|MISSING)/);
    }
  });
});
