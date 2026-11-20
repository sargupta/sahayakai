/**
 * Class gate: no CI gate script may crash because a child process printed
 * more than Node's default 1 MB.
 *
 * WHAT HAPPENED (review finding, 2026-11-15)
 * Gate 11 (scripts/ci/check-design-tokens.mjs) shells out to
 * `git diff -U0 <base>...HEAD` through execFileSync, which buffers the whole
 * stdout and kills the child once it passes `maxBuffer` (default 1 MB). On a
 * long-lived branch that diff was ~1.4 MB, so the gate died with
 * `spawnSync git ENOBUFS` instead of reporting, and CI showed a crash where it
 * should have shown 34 findings.
 *
 * WHAT THIS GATE CATCHES
 * The class, two ways:
 *   1. Statically: every execFileSync / execSync / spawnSync / execFile / exec
 *      call in scripts/ci/*.mjs passes a maxBuffer of at least 64 MB. Output
 *      size grows with the repo (diffs, logs, file lists), so no call may rely
 *      on the default.
 *   2. Behaviourally: Gate 11 runs to a verdict against a throwaway git repo
 *      whose diff is larger than 1 MB.
 */
import { spawnSync, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const APP_ROOT = path.resolve(__dirname, "..", "..", "..");
const CI_DIR = path.join(APP_ROOT, "scripts", "ci");
const MIN_MAX_BUFFER = 64 * 1024 * 1024;
const NODE_DEFAULT_MAX_BUFFER = 1024 * 1024;

// ── 1. Static: every buffered child call sets a large maxBuffer ───────────

const CALL_START = /(?<![.\w$])(execFileSync|execSync|spawnSync|execFile|exec)\s*\(/g;

/** The text of a call from its opening paren to the matching close paren. */
function callText(src: string, openParen: number): string {
  let depth = 0;
  for (let i = openParen; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")" && --depth === 0) return src.slice(openParen, i + 1);
  }
  throw new Error("unbalanced call");
}

/** Evaluate `256 * 1024 * 1024`-style constants; identifiers resolve via `const X = ...`. */
function resolveBytes(expr: string, src: string): number | null {
  const e = expr.trim();
  const numeric = e.replace(/(\d)_(?=\d)/g, "$1"); // 1_048_576
  if (/^\d+(\s*\*\s*\d+)*$/.test(numeric)) {
    return numeric.split("*").reduce((product, n) => product * Number(n.trim()), 1);
  }
  if (/^[A-Za-z_$][\w$]*$/.test(e)) {
    const def = src.match(new RegExp(`const\\s+${e}\\s*=\\s*([^;\\n]+)`));
    return def ? resolveBytes(def[1], src) : null;
  }
  return null;
}

interface ChildCall {
  file: string;
  line: number;
  fn: string;
  text: string;
  maxBuffer: number | null;
}

function childCalls(): ChildCall[] {
  const calls: ChildCall[] = [];
  for (const name of readdirSync(CI_DIR).filter((f) => f.endsWith(".mjs"))) {
    const src = readFileSync(path.join(CI_DIR, name), "utf8");
    for (const m of src.matchAll(CALL_START)) {
      const open = m.index! + m[0].length - 1;
      const text = callText(src, open);
      const mb = text.match(/maxBuffer\s*:\s*([^,}\n]+)/);
      calls.push({
        file: name,
        line: src.slice(0, m.index).split("\n").length,
        fn: m[1],
        text,
        maxBuffer: mb ? resolveBytes(mb[1], src) : null,
      });
    }
  }
  return calls;
}

describe("scripts/ci child processes never rely on the 1 MB default maxBuffer", () => {
  const calls = childCalls();

  it("finds the child-process calls it is meant to police", () => {
    // Guards the scanner itself: if this drops to zero the test below proves nothing.
    expect(calls.filter((c) => c.file === "check-design-tokens.mjs").length).toBeGreaterThan(0);
    expect(calls.some((c) => /['"]git['"]/.test(c.text))).toBe(true);
  });

  it("every git call (and every other buffered child call) passes maxBuffer >= 64 MB", () => {
    const offenders = calls
      .filter((c) => c.maxBuffer === null || c.maxBuffer < MIN_MAX_BUFFER)
      .map((c) => `${c.file}:${c.line} ${c.fn}(...) maxBuffer=${c.maxBuffer ?? "default (1 MB)"}`);
    expect(offenders).toEqual([]);
  });
});

// ── 2. Behavioural: Gate 11 survives a diff larger than 1 MB ──────────────

/** git with GIT_* stripped, so a hook-time run can never touch the real repo. */
function cleanEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) if (!k.startsWith("GIT_")) env[k] = v;
  return { ...env, ...extra };
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync(
    "git",
    [
      "-c", "user.name=gate-test",
      "-c", "user.email=gate-test@example.invalid",
      "-c", "commit.gpgsign=false",
      "-c", "core.hooksPath=/dev/null",
      ...args,
    ],
    { cwd, env: cleanEnv(), encoding: "utf8", maxBuffer: MIN_MAX_BUFFER },
  ).trim();
}

describe("Gate 11 on a diff larger than 1 MB", () => {
  let repo: string;

  beforeAll(() => {
    repo = mkdtempSync(path.join(os.tmpdir(), "gate11-buffer-"));
    const app = path.join(repo, "sahayakai-main");
    mkdirSync(path.join(app, "src", "components"), { recursive: true });
    mkdirSync(path.join(app, "scripts", "ci"), { recursive: true });
    writeFileSync(path.join(app, "scripts", "ci", "design-tokens-budget.json"), JSON.stringify({ maxHits: 0 }));
    writeFileSync(path.join(app, "src", "components", "seed.tsx"), "export const seed = 1;\n");
    git(repo, "init", "-q");
    git(repo, "add", ".");
    git(repo, "commit", "-qm", "base");

    // ~1.7 MB of clean added lines: the -U0 diff alone is past Node's default.
    const filler = "x".repeat(60);
    const lines = Array.from({ length: 24_000 }, (_, i) => `export const line${i} = "${filler}";`);
    writeFileSync(path.join(app, "src", "components", "big.tsx"), lines.join("\n") + "\n");
    git(repo, "add", ".");
    git(repo, "commit", "-qm", "big change");
  });

  afterAll(() => {
    if (repo) rmSync(repo, { recursive: true, force: true });
  });

  it("the fixture diff really is bigger than the 1 MB default", () => {
    const diff = git(repo, "diff", "-U0", "HEAD~1...HEAD");
    expect(Buffer.byteLength(diff)).toBeGreaterThan(NODE_DEFAULT_MAX_BUFFER);
  });

  it("reaches a verdict instead of crashing with ENOBUFS", () => {
    const base = git(repo, "rev-parse", "HEAD~1");
    const run = spawnSync(process.execPath, [path.join(CI_DIR, "check-design-tokens.mjs")], {
      cwd: repo,
      env: cleanEnv({ BASE_SHA: base }),
      encoding: "utf8",
      maxBuffer: MIN_MAX_BUFFER,
    });
    expect(run.stderr).not.toMatch(/ENOBUFS/);
    expect(run.stdout).toContain("OK — 1 changed .tsx file(s), no banned design-token patterns.");
    expect(run.status).toBe(0);
  }, 60_000);
});
