/**
 * Class gate: every class the homepage and /features markup uses is defined
 * in their stylesheets.
 *
 * WHAT HAPPENED (2026-11-27, homepage v1 before release)
 * The design's CSS was scoped by a script that prefixed animation names. It
 * also renamed the class selectors that share those names (.pulse became
 * .hp-pulse, .rv became .hp-rv), while the markup kept class="pulse". The
 * orb pulse, waveforms, reveals and the quote highlight silently stopped
 * animating. No type check or lint rule notices a class with no rule.
 *
 * WHAT THIS GATE CATCHES
 * Not "the pulse class" but the class: any className token in
 * src/components/landing/{home,features} with no matching selector in
 * home.css or features.css.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const LANDING = path.resolve(__dirname, "..", "..", "components", "landing");
const DIRS = ["home", "features"];

/** Classes defined outside these stylesheets, or deliberate hooks with no style. */
const ALLOWED = new Set([
  "force-light", // globals.css: re-declares the light palette for marketing pages
  "sr-only", // Tailwind utility: visually hidden, still read by screen readers
  "okopt", // design hook on the quiz scene's correct option; styled inline
]);

function filesIn(dir: string, ext: string): string[] {
  const full = path.join(LANDING, dir);
  return readdirSync(full)
    .filter((f) => f.endsWith(ext))
    .map((f) => path.join(full, f));
}

const css = DIRS.flatMap((d) => filesIn(d, ".css"))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");
const defined = new Set([...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]));

function classTokens(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/className="([^"]+)"/g)) out.push(...m[1].split(/\s+/));
  for (const m of src.matchAll(/className=\{`([^`]+)`\}/g)) {
    out.push(...m[1].replace(/\$\{[^}]*\}/g, " ").split(/\s+/));
  }
  return out.filter(Boolean);
}

describe("landing markup only uses defined classes", () => {
  const files = DIRS.flatMap((d) => filesIn(d, ".tsx"));

  it("finds the stylesheets and components", () => {
    expect(css.length).toBeGreaterThan(1000);
    expect(files.length).toBeGreaterThan(3);
  });

  it.each(files.map((f) => [path.relative(LANDING, f), f]))("%s", (_name, file) => {
    const missing = [...new Set(classTokens(readFileSync(file, "utf8")))].filter(
      (c) => !defined.has(c) && !ALLOWED.has(c),
    );
    expect(missing).toEqual([]);
  });
});

describe("landing palette variables", () => {
  const sources = DIRS.flatMap((d) => [...filesIn(d, ".tsx"), ...filesIn(d, ".ts"), ...filesIn(d, ".css")]).map((f) => ({
    f: path.relative(LANDING, f),
    src: readFileSync(f, "utf8"),
  }));
  const definedVars = new Set([...css.matchAll(/(--hp-[\w-]+)\s*:/g)].map((m) => m[1]));

  it("every var(--hp-*) used is defined in home.css or features.css", () => {
    const missing = sources.flatMap(({ f, src }) =>
      [...src.matchAll(/var\((--hp-[\w-]+)\)/g)].map((m) => m[1]).filter((v) => !definedVars.has(v)).map((v) => `${f}: ${v}`),
    );
    expect(missing).toEqual([]);
  });

  it("no variable is named after its own hex value (name colours by role or family)", () => {
    const hexNamed = sources.flatMap(({ f, src }) => [...src.matchAll(/--hp-[0-9a-fA-F]{6}\b/g)].map((m) => `${f}: ${m[0]}`));
    expect(hexNamed).toEqual([]);
  });
});
