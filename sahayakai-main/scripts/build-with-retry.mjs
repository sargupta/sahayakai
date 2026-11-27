#!/usr/bin/env node
/**
 * `next build`, retried when Google Fonts hands back a bad response.
 *
 * WHY (founder-visible deploy failures, 2026-11-26 and 2026-11-27)
 * next/font/google downloads every family at build time. Google
 * intermittently answers with a font URL that has no file extension, and
 * Next's loader then crashes with
 *   An error occurred in `next/font`. TypeError: Cannot read properties of
 *   null (reading '1')
 * The code is fine; the same commit builds on the next attempt. That failed
 * two production deploys and several PR checks, each costing a manual retry.
 *
 * WHAT THIS DOES
 * Runs `next build`. If, and only if, the build fails with a next/font
 * error, it runs it again (up to 3 attempts in total). Any other failure
 * exits at once with the build's own exit code, so real errors are not
 * hidden or slowed down.
 *
 * The lasting fix is to ship the font files in the repo (next/font/local).
 * Remove this wrapper when that lands.
 */
import { spawn } from "node:child_process";

export const MAX_ATTEMPTS = 3;
export const FONT_ERROR = /An error occurred in `next\/font`|Failed to fetch `[^`]+` from Google Fonts/;

/** True when a failed build's output shows the transient font failure. */
export function isRetryable(output) {
  return FONT_ERROR.test(output);
}

function runOnce(args) {
  return new Promise((resolve) => {
    const child = spawn("next", ["build", ...args], { shell: true, env: process.env });
    let output = "";
    const keep = (chunk, stream) => {
      const text = chunk.toString();
      output = (output + text).slice(-200_000);
      stream.write(text);
    };
    child.stdout.on("data", (c) => keep(c, process.stdout));
    child.stderr.on("data", (c) => keep(c, process.stderr));
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
  });
}

async function main() {
  const args = process.argv.slice(2);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { code, output } = await runOnce(args);
    if (code === 0) process.exit(0);
    if (!isRetryable(output) || attempt === MAX_ATTEMPTS) process.exit(code);
    console.error(`\n[build-with-retry] Google Fonts failed during the build (attempt ${attempt} of ${MAX_ATTEMPTS}). Retrying.\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
