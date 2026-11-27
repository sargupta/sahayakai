/**
 * Class gate for the deploys that failed on a Google Fonts hiccup
 * (2026-11-26, 2026-11-27).
 *
 * WHAT HAPPENED
 * `next build` downloads fonts from Google at build time. Google
 * intermittently returns a font URL Next cannot parse, the build dies with
 * "An error occurred in `next/font`", and a production deploy fails although
 * the code is fine.
 *
 * WHAT THIS GATE CATCHES
 * The class is "a transient third-party fetch at build time fails a deploy".
 * `npm run build` must go through scripts/build-with-retry.mjs, which retries
 * that failure and nothing else: a real build error must still fail at once.
 * The script is exercised end to end with a stand-in `next` binary.
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const APP_ROOT = path.resolve(__dirname, "../../..");
const SCRIPT = path.join(APP_ROOT, "scripts/build-with-retry.mjs");

/** Runs the wrapper with a fake `next` that follows `plan`, one entry per attempt. */
function run(plan: Array<"font" | "other" | "ok">) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "build-retry-"));
    const counter = path.join(dir, "count");
    fs.writeFileSync(counter, "0");
    const lines = plan
        .map((p, i) => {
            const body =
                p === "ok"
                    ? "exit 0"
                    : p === "font"
                      ? "echo 'An error occurred in `next/font`.' >&2; exit 1"
                      : "echo 'Type error: something real' >&2; exit 2";
            return `if [ "$n" = "${i + 1}" ]; then ${body}; fi`;
        })
        .join("\n");
    fs.writeFileSync(
        path.join(dir, "next"),
        `#!/bin/sh\nn=$(( $(cat "${counter}") + 1 ))\necho $n > "${counter}"\n${lines}\nexit 9\n`,
        { mode: 0o755 },
    );
    const res = spawnSync("node", [SCRIPT], {
        env: { ...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH}` },
        encoding: "utf8",
    });
    const attempts = Number(fs.readFileSync(counter, "utf8"));
    fs.rmSync(dir, { recursive: true, force: true });
    return { status: res.status, attempts };
}

describe("npm run build survives a Google Fonts hiccup", () => {
    it("package.json builds through the retry wrapper", () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(APP_ROOT, "package.json"), "utf8"));
        expect(pkg.scripts.build).toBe("node scripts/build-with-retry.mjs");
    });

    it("a clean build runs once", () => {
        expect(run(["ok"])).toEqual({ status: 0, attempts: 1 });
    });

    it("a font failure is retried and the build then passes", () => {
        expect(run(["font", "ok"])).toEqual({ status: 0, attempts: 2 });
    });

    it("gives up after three font failures", () => {
        expect(run(["font", "font", "font", "ok"])).toEqual({ status: 1, attempts: 3 });
    });

    it("a real build error fails at once with its own exit code", () => {
        expect(run(["other", "ok"])).toEqual({ status: 2, attempts: 1 });
    });
});
