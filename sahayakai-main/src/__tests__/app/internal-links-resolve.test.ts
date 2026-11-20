/**
 * Every literal internal link in src/ must lead somewhere: a page, a route
 * handler, a file in public/, or a redirect declared in next.config.ts.
 *
 * Class gate for dead links found in the 2026-11 demo-readiness pass: the blog
 * articles linked to five articles that were never written, the regional
 * landing pages linked to a /hi page that does not exist, the try-call page
 * sent its one call-to-action to /signup, and the school dashboard's empty
 * state sent "Invite teachers" to /organization/invite. Each was a 404 a
 * visitor found before we did. Dynamic links (template literals with `${…}`)
 * are out of scope.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const SRC = join(__dirname, "..", "..");
const APP = join(SRC, "app");
const ROOT = join(SRC, "..");
const PUBLIC = join(ROOT, "public");

function sources(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (name === "__tests__" || name === "node_modules") continue;
        if (statSync(p).isDirectory()) sources(p, out);
        else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
    }
    return out;
}

/** Does `path` resolve to a page.tsx or route.ts, walking through (groups) and [params]? */
function appRouteExists(path: string): boolean {
    const segs = path.replace(/^\/|\/$/g, "").split("/").filter(Boolean);
    const walk = (dir: string, i: number): boolean => {
        if (!existsSync(dir)) return false;
        const kids = readdirSync(dir).filter((k) => statSync(join(dir, k)).isDirectory());
        // Route groups add no URL segment.
        if (kids.some((k) => /^\(.+\)$/.test(k) && walk(join(dir, k), i))) return true;
        if (i === segs.length) return ["page.tsx", "page.ts", "route.ts"].some((f) => existsSync(join(dir, f)));
        return kids.some((k) => {
            if (/^\[\.\.\..+\]$/.test(k) || /^\[\[\.\.\..+\]\]$/.test(k)) return true;
            return (k === segs[i] || /^\[.+\]$/.test(k)) && walk(join(dir, k), i + 1);
        });
    };
    return walk(APP, 0);
}

const redirectSources = new Set(
    [...readFileSync(join(ROOT, "next.config.ts"), "utf8").matchAll(/source:\s*'([^']+)',\s*destination:\s*'[^']+',\s*permanent/g)].map((m) => m[1]),
);

function resolves(path: string): boolean {
    return appRouteExists(path) || existsSync(join(PUBLIC, path)) || redirectSources.has(path);
}

const LINK = /(?:href[:=]\s*\{?|router\.(?:push|replace)\(|redirect\()\s*["'](\/[A-Za-z0-9_\-/.]*)(?=[?#"'])/g;

const links = sources(SRC).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(LINK)]
        .map((m) => ({ file: file.slice(SRC.length + 1).replace(/\\/g, "/"), path: m[1] }))
        .filter((l) => l.path !== "/" && !l.path.startsWith("//") && !l.path.startsWith("/api/") && !l.path.startsWith("/__/")),
);

describe("internal links resolve", () => {
    it("finds the links", () => {
        expect(links.length).toBeGreaterThan(100);
    });

    it("has a page, a public file or a redirect behind every literal internal link", () => {
        const dead = [...new Set(links.filter((l) => !resolves(l.path)).map((l) => `${l.path} <- ${l.file}`))];
        expect(dead).toEqual([]);
    });

    it("redirects only to places that exist", () => {
        const cfg = readFileSync(join(ROOT, "next.config.ts"), "utf8");
        const targets = [...cfg.matchAll(/source:\s*'[^']+',\s*destination:\s*'(\/[^']*)',\s*permanent/g)].map((m) => m[1]);
        expect(targets.length).toBeGreaterThan(0);
        expect(targets.filter((t) => t !== "/" && !appRouteExists(t))).toEqual([]);
    });
});
