/**
 * Gate 11 must tell a design-system token from Tailwind's raw palette when
 * they share a name.
 *
 * The design system (Oct 2026) defines colour families called `stone` and
 * `indigo`, and tailwind.config.ts maps exactly `stone-100`, `stone-500`,
 * `indigo-100` and `indigo-500` to `hsl(var(--stone-100))` etc. Gate 11's
 * palette regex banned every `stone-*` / `indigo-*` class, so token-only code
 * (the SamparkAI site's `bg-stone-100`, `text-indigo-500`) failed the gate as
 * "raw palette". The fix reads the exempt shades from the config, so:
 *   - a shade the config maps to a CSS variable is a token (not a hit);
 *   - any other shade of the same family (stone-200, indigo-600) is still
 *     Tailwind's raw palette and still a hit;
 *   - a line with a token class and a raw class still reports the raw one.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const APP_ROOT = path.resolve(__dirname, "..", "..", "..");
const SCRIPT = path.join(APP_ROOT, "scripts", "ci", "check-design-tokens.mjs");

function cleanEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) if (!k.startsWith("GIT_")) env[k] = v;
  return { ...env, ...extra };
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync(
    "git",
    ["-c", "user.name=gate-test", "-c", "user.email=gate-test@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args],
    { cwd, env: cleanEnv(), encoding: "utf8" },
  ).trim();
}

const CONFIG = `export default {
  theme: {
    extend: {
      colors: {
        stone: {
          100: 'hsl(var(--stone-100))',
          500: 'hsl(var(--stone-500))',
        },
        indigo: {
          100: 'hsl(var(--indigo-100))',
          500: 'hsl(var(--indigo-500))',
        },
      },
    },
  },
};
`;

describe("Gate 11 palette rule vs design-system families", () => {
  let repo: string;
  let base: string;

  beforeAll(() => {
    repo = mkdtempSync(path.join(os.tmpdir(), "gate11-families-"));
    const app = path.join(repo, "sahayakai-main");
    mkdirSync(path.join(app, "src", "components"), { recursive: true });
    mkdirSync(path.join(app, "scripts", "ci"), { recursive: true });
    writeFileSync(path.join(app, "tailwind.config.ts"), CONFIG);
    writeFileSync(path.join(app, "scripts", "ci", "design-tokens-budget.json"), JSON.stringify({ maxHits: 100 }));
    writeFileSync(path.join(app, "src", "components", "seed.tsx"), "export const seed = 1;\n");
    git(repo, "init", "-q");
    git(repo, "add", ".");
    git(repo, "commit", "-qm", "base");
    base = git(repo, "rev-parse", "HEAD");

    writeFileSync(
      path.join(app, "src", "components", "site.tsx"),
      [
        'export const a = <span className="bg-stone-100" />;', // token
        'export const b = <span className="text-indigo-500" />;', // token
        'export const c = <span className="bg-stone-500 text-indigo-100" />;', // tokens
        'export const d = <span className="bg-stone-200" />;', // raw: not mapped
        'export const e = <span className="text-indigo-600" />;', // raw: not mapped
        'export const f = <span className="bg-stone-100 text-red-500" />;', // token + raw
      ].join("\n") + "\n",
    );
    git(repo, "add", ".");
    git(repo, "commit", "-qm", "site");
  });

  afterAll(() => {
    if (repo) rmSync(repo, { recursive: true, force: true });
  });

  function run() {
    return spawnSync(process.execPath, [SCRIPT], {
      cwd: repo,
      env: cleanEnv({ BASE_SHA: base }),
      encoding: "utf8",
    });
  }

  it("reports raw shades and never the shades tailwind.config.ts maps to tokens", () => {
    const r = run();
    const hits = r.stderr
      .split("\n")
      .map((l) => l.match(/site\.tsx:(\d+)\s+\[.*\]\s+"(.+)"$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => `${m[1]}:${m[2]}`);
    expect(hits).toEqual(["4:bg-stone-200", "5:text-indigo-600", "6:text-red-500"]);
    expect(r.status).toBe(1);
  });
});
