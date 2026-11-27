/**
 * Class gate: retired feature names must not reappear in the product.
 *
 * Founder report (2026-11-27): the pedagogy tool at /teacher-training is
 * called "AI Mentor". It had already been renamed once (Teacher Training ->
 * AI Coach), and the old label kept surviving in one surface or another
 * (sidebar, command palette, chat chips, library filter, VIDYA's manifest,
 * locale keys). This gate covers the whole class: any feature name listed in
 * RETIRED_NAMES fails the build if it shows up as a quoted UI string in
 * source, as a t("...") key, or as a locale key.
 *
 * To retire another name, add it to RETIRED_NAMES with its replacement.
 * Prose that only mentions the old name inside a longer sentence (for
 * example VIDYA's "earlier named AI Coach" hint, or a search keyword list)
 * is allowed, because it never renders as the feature's label.
 */
import fs from "fs";
import path from "path";

const RETIRED_NAMES: { retired: string; current: string }[] = [
    { retired: "AI Coach", current: "AI Mentor" },
];

const SRC = path.resolve(__dirname, "../..");
const LOCALES = path.join(SRC, "locales");

function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return e.name === "__tests__" ? [] : sourceFiles(p);
        return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
    });
}

function escapeRe(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("retired feature names", () => {
    const files = sourceFiles(SRC).map((f) => ({ f, src: fs.readFileSync(f, "utf8") }));

    for (const { retired, current } of RETIRED_NAMES) {
        it(`"${retired}" is not used as a UI label in source (use "${current}")`, () => {
            // A quoted string that is exactly the retired name, or JSX text that is exactly it.
            const quoted = new RegExp(`(["'\`])${escapeRe(retired)}\\1`);
            const jsxText = new RegExp(`>\\s*${escapeRe(retired)}\\s*<`);
            const offenders = files
                .filter(({ src }) => quoted.test(src) || jsxText.test(src))
                .map(({ f }) => path.relative(SRC, f));
            expect(offenders).toEqual([]);
        });

        it(`no locale file keeps a key containing "${retired}"`, () => {
            const offenders: string[] = [];
            for (const file of fs.readdirSync(LOCALES).filter((n) => n.endsWith(".json"))) {
                const data = JSON.parse(fs.readFileSync(path.join(LOCALES, file), "utf8")) as Record<string, unknown>;
                for (const key of Object.keys(data)) {
                    if (key.includes(retired)) offenders.push(`${file}: ${key}`);
                }
            }
            expect(offenders).toEqual([]);
        });

        it(`"${current}" is translated in every locale`, () => {
            const missing = fs
                .readdirSync(LOCALES)
                .filter((n) => n.endsWith(".json"))
                .filter((file) => {
                    const data = JSON.parse(fs.readFileSync(path.join(LOCALES, file), "utf8")) as Record<string, unknown>;
                    return typeof data[current] !== "string" || !(data[current] as string).trim();
                });
            expect(missing).toEqual([]);
        });
    }
});
