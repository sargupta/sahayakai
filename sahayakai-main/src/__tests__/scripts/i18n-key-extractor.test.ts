/**
 * Class gate: Gate 9's key scanner (scripts/find-missing-i18n-keys.mjs) sees every key the
 * UI can hand to t(), and counts a key as missing unless EVERY locale file has it.
 *
 * WHAT HAPPENED (review findings #2 and #16, 2026-11-15)
 * The scanner matched t() calls with the regex /\bt\(\s*(["'])([^"'\n]{1,200})\1\s*\)/. It
 * could not see a key containing an apostrophe ("Outside the school's calling hours"), a
 * t("…", args) call, a key reached through a variable (t(REFUSAL_TEXT[why]), t(r.label)),
 * or a call through an alias (const { t: translate } = useLanguage()). It also treated a key
 * present in ANY locale as defined, so keys that existed only in hindi.json passed. Gate 9
 * reported 0 missing keys while 290 were missing from at least one locale.
 *
 * WHAT THIS GATE CATCHES
 * Each blind spot, on a fixture app the scanner runs against:
 *   - apostrophes and escapes in a key, and extra arguments after it;
 *   - an aliased translator;
 *   - a key present in some locales but not all (reported with the locales it lacks);
 *   - keys reached through a variable: a dynamic t() call must be declared in
 *     scripts/i18n-dynamic-keys.json, and the strings of the code constant it names are
 *     checked like literals; an undeclared dynamic call is counted, and a declaration that
 *     no longer matches the code is a registry error.
 * The fixture runs with the app root as cwd and reads the text report, the same interface
 * Gate 9 (scripts/ci/check-i18n-ratchet.mjs) parses.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const APP_ROOT = path.resolve(__dirname, "..", "..", "..");
const SCANNER = path.join(APP_ROOT, "scripts", "find-missing-i18n-keys.mjs");

const PAGE = `
import { useLanguage } from "@/context/language-context";

const REFUSAL_TEXT = {
    outside_hours: "Families are called between 10:00 and 19:00.",
    sunday: "Complete key",
} as const;

export function Page({ why, label }: { why: keyof typeof REFUSAL_TEXT; label: string }) {
    const { t: translate } = useLanguage();
    return [
        t("Complete key"),
        t("Outside the school's calling hours"),
        t('Don\\'t call before {time}', { time: "10:00" }),
        t("Hindi only"),
        t(REFUSAL_TEXT[why]),
        t(label),
        translate("Alias key"),
        t(why === "sunday" ? "Literal branch" : "Complete key"),
    ];
}
`;

const LOCALES = {
    "hindi.json": { "Complete key": "पूर्ण कुंजी", "Hindi only": "केवल हिंदी" },
    "bengali.json": { "Complete key": "সম্পূর্ণ কী" },
};

const REGISTRY = {
    sources: { "fixture-refusal-text": { file: "src/page.tsx", name: "REFUSAL_TEXT" } },
    sites: { "src/page.tsx": { "REFUSAL_TEXT[why]": ["fixture-refusal-text"] } },
};

let root: string;

function writeApp(registry: unknown, page: string = PAGE): void {
    rmSync(path.join(root, "src"), { recursive: true, force: true });
    mkdirSync(path.join(root, "src", "locales"), { recursive: true });
    mkdirSync(path.join(root, "scripts"), { recursive: true });
    writeFileSync(path.join(root, "src", "page.tsx"), page);
    for (const [name, dict] of Object.entries(LOCALES)) writeFileSync(path.join(root, "src", "locales", name), JSON.stringify(dict));
    writeFileSync(path.join(root, "scripts", "i18n-dynamic-keys.json"), JSON.stringify(registry));
}

interface Report {
    raw: string;
    missingCount: number;
    /** key → the report line (which names the locales it is missing from) */
    missing: Map<string, string>;
    count: (label: string) => number | null;
}

function scan(): Report {
    const r = spawnSync(process.execPath, [SCANNER, "--no-write"], { cwd: root, encoding: "utf8" });
    const raw = `${r.stdout}\n${r.stderr}`;
    const count = (label: string) => {
        const m = raw.match(new RegExp(`^${label.replace(/[()]/g, "\\$&")}: (\\d+)$`, "m"));
        return m ? Number(m[1]) : null;
    };
    const missing = new Map<string, string>();
    const section = raw.split("## Missing keys")[1]?.split("\n## ")[0] ?? "";
    for (const line of section.split("\n")) {
        const m = line.match(/^- ("(?:[^"\\]|\\.)*")/);
        if (m) missing.set(JSON.parse(m[1]) as string, line);
    }
    return { raw, missingCount: count("MISSING (used but not defined)") ?? -1, missing, count };
}

beforeAll(() => {
    root = mkdtempSync(path.join(os.tmpdir(), "i18n-extractor-"));
});
afterAll(() => {
    rmSync(root, { recursive: true, force: true });
});

describe("Gate 9 key scanner sees every key and checks every locale", () => {
    it("reports each blind-spot key, and only those", () => {
        writeApp(REGISTRY);
        const r = scan();
        expect([...r.missing.keys()].sort()).toEqual(
            [
                "Alias key",
                "Don't call before {time}",
                "Families are called between 10:00 and 19:00.",
                "Hindi only",
                "Literal branch",
                "Outside the school's calling hours",
            ].sort(),
        );
        expect(r.missingCount).toBe(6);
        // Present in one locale only: missing, and the report names the locale that lacks it.
        expect(r.missing.get("Hindi only")).toContain("[missing in bengali]");
        expect(r.missing.get("Outside the school's calling hours")).toContain("[missing in every locale]");
    });

    it("counts a dynamic t() call that the registry does not declare", () => {
        writeApp(REGISTRY);
        const r = scan();
        expect(r.count("UNREGISTERED DYNAMIC t() CALLS")).toBe(1);
        expect(r.raw).toMatch(/src\/page\.tsx:\d+ {2}t\(label\)/);
        expect(r.count("REGISTRY ERRORS")).toBe(0);
    });

    it("refuses a new call that reuses a registered expression until it is declared", () => {
        // Review 2026-11-16: a second t(f.label) over a different list rode on the first call's
        // entry and was never checked. Entries now pin how many calls they cover.
        const twice = PAGE.replace("t(REFUSAL_TEXT[why]),", "t(REFUSAL_TEXT[why]),\n        t(REFUSAL_TEXT[why]),");
        writeApp(REGISTRY, twice);
        let r = scan();
        expect(r.count("REGISTRY ERRORS")).toBe(1);
        expect(r.raw).toContain("src/page.tsx :: REFUSAL_TEXT[why] covers 1 call(s) but the file has 2");
        writeApp({ ...REGISTRY, sites: { "src/page.tsx": { "REFUSAL_TEXT[why]": { sources: ["fixture-refusal-text"], count: 2 } } } }, twice);
        r = scan();
        expect(r.count("REGISTRY ERRORS")).toBe(0);
    });

    it("treats a registry that no longer matches the code as an error", () => {
        writeApp({
            sources: {
                ...REGISTRY.sources,
                "renamed-away": { file: "src/page.tsx", name: "OLD_LABELS" },
                "unused": { file: "src/page.tsx", name: "REFUSAL_TEXT" },
            },
            sites: { "src/page.tsx": { "REFUSAL_TEXT[why]": ["fixture-refusal-text"], "OLD_LABELS[code]": ["renamed-away"] } },
        });
        const r = scan();
        expect(r.count("REGISTRY ERRORS")).toBe(3);
        expect(r.raw).toContain('stale site: src/page.tsx has no dynamic t() call on `OLD_LABELS[code]`');
        expect(r.raw).toContain('source "renamed-away": src/page.tsx declares no "OLD_LABELS"');
        expect(r.raw).toContain('source "unused" is not used by any site');
    });
});
