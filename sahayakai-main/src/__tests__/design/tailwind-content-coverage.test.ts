/**
 * @jest-environment node
 *
 * Class gate for the 2026-10-23 "classes missing from production CSS" bug.
 *
 * tailwind.config.ts `content` listed only src/pages, src/components and
 * src/app. Every class written anywhere else in src/ (src/features,
 * src/data, src/types, ...) was silently dropped from the shipped CSS: the
 * GeneratorPage spinner (`motion-safe:animate-spin`), the sticky mobile CTA
 * (`bottom-[calc(...)]`, `md:static`), the instant-answer `prose-lg`
 * typography and three quick-template colours, 29 utilities in all.
 * Nothing failed: Tailwind simply never saw those files.
 *
 * This gate does not pin those 29 classes. It asserts the CLASS of bug:
 *
 *   1. Every utility Tailwind can generate from non-test source under src/
 *      is present in the CSS the real config generates. Any class written
 *      in a file the `content` globs miss fails here, whatever the file.
 *   2. Every non-test source file under src/ is matched by a `content`
 *      glob (names the offending files, even when their classes happen to
 *      be used elsewhere today).
 *
 * "Test code" (excluded on both sides) is __tests__/, __mocks__/ and
 * *.test.* files: they only repeat classes from the code they exercise.
 */
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import fg from "fast-glob";
import postcss from "postcss";
import tailwindcss, { type Config } from "tailwindcss";
import tailwindConfig from "../../../tailwind.config";

// Relative `content` globs resolve against the cwd, exactly as in
// `next build` (run from sahayakai-main/). Jest runs from the same place.
const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const SOURCE_EXTS = new Set([".js", ".ts", ".jsx", ".tsx", ".mdx"]);

function isTestCode(relPath: string): boolean {
    const parts = relPath.split(sep);
    return (
        parts.includes("__tests__") ||
        parts.includes("__mocks__") ||
        /\.test\.[jt]sx?$/.test(relPath)
    );
}

/** Every non-test source file under src/, as paths relative to ROOT. */
function appSourceFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const abs = join(dir, entry.name);
            const rel = relative(ROOT, abs);
            if (isTestCode(rel)) continue;
            if (entry.isDirectory()) walk(abs);
            else if (SOURCE_EXTS.has(extname(entry.name))) out.push(rel);
        }
    };
    walk(SRC);
    return out.sort();
}

async function generatedSelectors(content: Config["content"]): Promise<Set<string>> {
    const result = await postcss([tailwindcss({ ...tailwindConfig, content })]).process(
        "@tailwind components;\n@tailwind utilities;",
        { from: undefined },
    );
    const selectors = new Set<string>();
    result.root.walkRules((rule) => {
        for (const s of rule.selectors) selectors.add(s.trim());
    });
    return selectors;
}

function contentGlobs(): string[] {
    const content = tailwindConfig.content;
    const files = Array.isArray(content) ? content : content.files;
    return files.filter((f): f is string => typeof f === "string");
}

describe("tailwind content globs cover all app source (class gate)", () => {
    const files = appSourceFiles();

    it("finds the app source tree", () => {
        // Guards the gate itself: an empty walk would make both checks pass.
        expect(files.length).toBeGreaterThan(100);
        expect(files).toEqual(expect.arrayContaining([expect.stringMatching(/^src[\\/]features[\\/]/)]));
    });

    it("every class in non-test src/ code reaches the CSS the config builds", async () => {
        const shipped = await generatedSelectors(tailwindConfig.content);
        // Raw content, not file paths: Next route dirs like [id] and
        // (marketing) are glob syntax and would not match themselves.
        const everything = await generatedSelectors(
            files.map((f) => ({
                raw: readFileSync(join(ROOT, f), "utf8"),
                extension: extname(f).slice(1),
            })),
        );
        const missing = new Set([...everything].filter((s) => !shipped.has(s)));
        // Report `.prose-lg` once, not once per `.prose-lg :where(h2)...` child.
        const report = [...missing]
            .filter((s) => {
                const head = s.split(" ")[0];
                return head === s || !missing.has(head);
            })
            .sort();
        // On failure: widen `content` in tailwind.config.ts. Do not safelist.
        expect(report).toEqual([]);
    }, 120_000);

    it("every non-test source file under src/ is matched by a content glob", () => {
        const globs = contentGlobs();
        const positive = globs.filter((g) => !g.startsWith("!"));
        const ignore = globs.filter((g) => g.startsWith("!")).map((g) => g.slice(1));
        const covered = new Set(
            fg.sync(positive, { cwd: ROOT, ignore }).map((p) => p.replace(/^\.\//, "").split("/").join(sep)),
        );
        const uncovered = files.filter((f) => !covered.has(f));
        expect(uncovered).toEqual([]);
    });
});
