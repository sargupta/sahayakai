/**
 * Class gate for the founder-reported "text too big, the hero does not fit
 * one screen" bug (2026-11-27).
 *
 * WHAT HAPPENED
 * The homepage headline was sized clamp(44px, 7.4vw, 104px): about 95px on a
 * 1280px laptop, so the hero ran past the first screen. Headings across the
 * homepage and /features each carried their own px size, with no shared scale.
 *
 * WHAT THIS GATE CATCHES
 * Not "this headline" but the class:
 *   - every h1/h2/h3 on the homepage and /features takes its size from the
 *     shared scale in home.css (var(--fs-*)), never a literal size;
 *   - the scale's largest heading step stays at or under 64px, the display
 *     step under 4.5vw, so a hero fits a 1280x720 screen.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const LANDING = path.resolve(__dirname, "..", "..", "components", "landing");
const DIRS = ["home", "features"];
const files = DIRS.flatMap((d) =>
  readdirSync(path.join(LANDING, d))
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => path.join(LANDING, d, f)),
);
const css = readFileSync(path.join(LANDING, "home", "home.css"), "utf8");

function scaleStep(name: string): string {
  const m = css.match(new RegExp(`--fs-${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`home.css must define --fs-${name}`);
  return m[1];
}
const maxPx = (v: string) => Math.max(...[...v.matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])));

describe("landing type scale", () => {
  it.each(files.map((f) => [path.relative(LANDING, f), f]))("%s: headings use the shared scale", (_n, file) => {
    const src = readFileSync(file, "utf8");
    const literal = [...src.matchAll(/<h[1-3]\b[^>]*?style=\{\{([\s\S]*?)\}\}/g)]
      .map((m) => m[1].match(/fontSize:\s*"([^"]+)"/)?.[1])
      .filter((v): v is string => !!v && !v.startsWith("var(--fs-"));
    expect(literal).toEqual([]);
  });

  it("no heading step is larger than 64px", () => {
    for (const step of ["display", "quote", "h2", "h3", "metric"]) {
      expect(maxPx(scaleStep(step))).toBeLessThanOrEqual(64);
    }
  });

  it("the display step scales gently enough for a hero to fit 1280x720", () => {
    const vw = Number(scaleStep("display").match(/(\d+(?:\.\d+)?)vw/)?.[1] ?? 0);
    expect(vw).toBeGreaterThan(0);
    expect(vw).toBeLessThanOrEqual(4.5);
  });
});
