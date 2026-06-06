/**
 * Tests for scripts/ci/check-no-verify-bypass.mjs and
 * scripts/ci/check-schema-drift.mjs.
 *
 * The no-verify check is exercised against a throwaway git repo with a
 * commit body containing `--no-verify` — we assert exit code 1.
 * The schema-drift check is exercised against two on-disk fixture dirs.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const NO_VERIFY_SCRIPT = path.join(REPO_ROOT, 'scripts', 'ci', 'check-no-verify-bypass.mjs');
const DRIFT_SCRIPT = path.join(REPO_ROOT, 'scripts', 'ci', 'check-schema-drift.mjs');

function gitInit(dir: string) {
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'ci@test'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'ci'], { cwd: dir });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir });
}

function commit(dir: string, message: string, filename: string) {
  writeFileSync(path.join(dir, filename), Math.random().toString());
  execFileSync('git', ['add', filename], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', message], { cwd: dir });
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
}

describe('check-no-verify-bypass', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'noverify-'));
    gitInit(dir);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('passes on clean commits', () => {
    const base = commit(dir, 'init', 'a');
    commit(dir, 'feat: add thing', 'b');
    const res = spawnSync('node', [NO_VERIFY_SCRIPT, base, 'HEAD'], { cwd: dir, encoding: 'utf8' });
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/PASS/);
  });

  it('fails when a commit body references --no-verify', () => {
    const base = commit(dir, 'init', 'a');
    commit(dir, 'fix: yolo\n\nshipped via --no-verify because hooks were slow', 'b');
    const res = spawnSync('node', [NO_VERIFY_SCRIPT, base, 'HEAD'], { cwd: dir, encoding: 'utf8' });
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/FAIL/);
  });

  it('fails when a commit references skip-hooks', () => {
    const base = commit(dir, 'init', 'a');
    commit(dir, 'wip [skip hooks]', 'b');
    const res = spawnSync('node', [NO_VERIFY_SCRIPT, base, 'HEAD'], { cwd: dir, encoding: 'utf8' });
    expect(res.status).toBe(1);
  });

  it('rejects unsafe refs', () => {
    const res = spawnSync('node', [NO_VERIFY_SCRIPT, '; rm -rf /', 'HEAD'], { cwd: dir, encoding: 'utf8' });
    expect(res.status).toBe(2);
  });
});

describe('check-schema-drift', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'drift-'));
    mkdirSync(path.join(dir, 'qa', 'baseline-schemas'), { recursive: true });
    mkdirSync(path.join(dir, 'qa', 'baseline-schemas-fresh'), { recursive: true });
    mkdirSync(path.join(dir, 'qa', 'sidecar-schemas'), { recursive: true });
    mkdirSync(path.join(dir, 'qa', 'sidecar-schemas-fresh'), { recursive: true });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function write(rel: string, obj: unknown) {
    writeFileSync(path.join(dir, rel), JSON.stringify(obj));
  }

  it('passes when fresh matches committed', () => {
    const schema = { type: 'object', properties: { x: { type: 'string', minLength: 1, maxLength: 10 } } };
    write('qa/baseline-schemas/lesson-plan.json', schema);
    write('qa/baseline-schemas-fresh/lesson-plan.json', schema);
    // Copy DRIFT_SCRIPT into the fake repo so relative paths resolve.
    const fakeScript = path.join(dir, 'check-schema-drift.mjs');
    execFileSync('cp', [DRIFT_SCRIPT, fakeScript]);
    mkdirSync(path.join(dir, 'scripts', 'ci'), { recursive: true });
    execFileSync('cp', [DRIFT_SCRIPT, path.join(dir, 'scripts', 'ci', 'check-schema-drift.mjs')]);
    const res = spawnSync('node', [path.join(dir, 'scripts', 'ci', 'check-schema-drift.mjs')], { cwd: dir, encoding: 'utf8' });
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/PASS/);
  });

  it('fails when drift exceeds threshold', () => {
    // Build a baseline with many constraints and a fresh schema with none.
    const big: { type: string; properties: Record<string, unknown> } = { type: 'object', properties: {} };
    for (let i = 0; i < 20; i++) {
      big.properties[`f${i}`] = { type: 'string', enum: ['a', 'b'], minLength: 1, maxLength: 5, pattern: '^x' };
    }
    write('qa/baseline-schemas/lesson-plan.json', big);
    write('qa/baseline-schemas-fresh/lesson-plan.json', { type: 'object' });
    mkdirSync(path.join(dir, 'scripts', 'ci'), { recursive: true });
    execFileSync('cp', [DRIFT_SCRIPT, path.join(dir, 'scripts', 'ci', 'check-schema-drift.mjs')]);
    const res = spawnSync('node', [path.join(dir, 'scripts', 'ci', 'check-schema-drift.mjs'), '--threshold=10'], { cwd: dir, encoding: 'utf8' });
    expect(res.status).toBe(1);
    expect(res.stderr + res.stdout).toMatch(/FAIL/);
  });
});
