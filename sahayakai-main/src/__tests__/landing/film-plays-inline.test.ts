/**
 * Class gate for the founder-reported "the video takes me to a different page
 * instead of playing here" bug (2026-11-27).
 *
 * WHAT HAPPENED
 * The film on the homepage was a poster that linked out to YouTube, because
 * the Content-Security-Policy frame-src did not allow a YouTube player.
 *
 * WHAT THIS GATE CATCHES
 * The class is "a marketing page embeds a frame the CSP would block, or falls
 * back to sending the visitor away". For every page under the marketing
 * folders: each embedded frame host must be listed in frame-src, and the film
 * must be an in-page player.
 */
import * as fs from "fs";
import * as path from "path";

const SRC = path.resolve(__dirname, "../..");
const DIRS = [path.join(SRC, "app/(marketing)"), path.join(SRC, "components/landing")];

function files(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return files(p);
        return /\.tsx?$/.test(e.name) ? [p] : [];
    });
}

function frameSrc(): string {
    const mw = fs.readFileSync(path.join(SRC, "middleware.ts"), "utf8");
    const m = mw.match(/`frame-src ([^`]+)`/);
    if (!m) throw new Error("middleware.ts must keep a frame-src directive");
    return m[1];
}

describe("embedded frames on marketing pages", () => {
    const sources = DIRS.flatMap(files).map((f) => ({ f, src: fs.readFileSync(f, "utf8") }));

    it("every embedded frame host is allowed by the CSP frame-src", () => {
        const allowed = frameSrc();
        const offenders: string[] = [];
        for (const { f, src } of sources) {
            if (!/<iframe\b/.test(src)) continue;
            const hosts = [...src.matchAll(/https:\/\/([a-z0-9.-]+)\/embed\//g)].map((m) => m[1]);
            if (hosts.length === 0) offenders.push(`${path.relative(SRC, f)}: <iframe> with no recognisable embed host`);
            for (const h of hosts) {
                if (!allowed.includes(`https://${h}`)) offenders.push(`${path.relative(SRC, f)}: ${h} is not in frame-src`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it("the film plays in the page", () => {
        const page = sources.find(({ f }) => f.endsWith("for-schools-client.tsx"));
        expect(page).toBeDefined();
        const film = page!.src.slice(page!.src.indexOf("function Film()"), page!.src.indexOf("function Belief()"));
        expect(film).toMatch(/<iframe\b/);
        expect(film).toContain("FILM_EMBED_URL");
        expect(page!.src).toMatch(/FILM_EMBED_URL = `https:\/\/www\.youtube-nocookie\.com\/embed\//);
    });

    it("the homepage film plays in the page", () => {
        const page = sources.find(({ f }) => f.endsWith(path.join("home", "home-page.tsx")));
        expect(page).toBeDefined();
        const film = page!.src.slice(page!.src.indexOf("function Film()"), page!.src.indexOf("/* ------------------------------------------------------------ calculator"));
        expect(film).toMatch(/<iframe\b/);
        expect(film).toContain("FILM_EMBED_URL");
        expect(film).not.toMatch(/href=\{?["'`]https:\/\/(www\.)?youtube\.com\/watch/);
        expect(page!.src).toMatch(/FILM_EMBED_URL = `https:\/\/www\.youtube-nocookie\.com\/embed\//);
    });
});
