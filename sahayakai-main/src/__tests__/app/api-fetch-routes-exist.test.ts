/**
 * Every literal `fetch("/api/…")` in src/ must have a route file behind it.
 *
 * Class gate for a 404 nobody saw: the exam-paper form fetched
 * /api/exam-paper/blueprints, the route was dropped in a migration, and the
 * hook swallowed the failure ("leave empty — form still works"), so every
 * board silently lost its blueprint and subject picker. A client call to a
 * route that does not exist now fails here instead of in a teacher's browser.
 * Dynamic paths (template literals with `${…}`) are out of scope.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const SRC = join(__dirname, "..", "..");
const APP = join(SRC, "app");

function sources(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (name === "__tests__" || name === "node_modules") continue;
        if (statSync(p).isDirectory()) sources(p, out);
        else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
    }
    return out;
}

function routeExists(api: string): boolean {
    const segs = api.replace(/^\/|\/$/g, "").split("/");
    const walk = (dir: string, i: number): boolean => {
        if (i === segs.length) return existsSync(join(dir, "route.ts")) || existsSync(join(dir, "route.js"));
        if (!existsSync(dir)) return false;
        return readdirSync(dir).some((k) => {
            const p = join(dir, k);
            if (!statSync(p).isDirectory()) return false;
            if (/^\[\.\.\..+\]$/.test(k) || /^\[\[\.\.\..+\]\]$/.test(k)) return true;
            return (k === segs[i] || /^\[.+\]$/.test(k)) && walk(p, i + 1);
        });
    };
    return walk(APP, 0);
}

const calls = sources(SRC).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(/fetch\(\s*["'`](\/api\/[A-Za-z0-9_\-/]+)(?=[?"'`])/g)].map((m) => ({
        file: file.slice(SRC.length + 1),
        api: m[1],
    })),
);

describe("client API calls resolve to a route", () => {
    it("finds the calls", () => {
        expect(calls.length).toBeGreaterThan(20);
    });

    it("has a route file for every literal /api path", () => {
        const dead = calls.filter((c) => !routeExists(c.api)).map((c) => `${c.api} <- ${c.file}`);
        expect(dead).toEqual([]);
    });

    it("includes the exam-paper blueprints route the form depends on", () => {
        expect(routeExists("/api/exam-paper/blueprints")).toBe(true);
    });
});
