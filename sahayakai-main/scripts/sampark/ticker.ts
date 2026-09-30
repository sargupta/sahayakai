/**
 * Local stand-in for Cloud Scheduler: drives the two Sampark jobs against a
 * running dev server.
 *
 *   CRON_SECRET=… npx tsx scripts/sampark/ticker.ts                 # every 15 s
 *   CRON_SECRET=… npx tsx scripts/sampark/ticker.ts --interval 30   # every 30 s
 *   CRON_SECRET=… npx tsx scripts/sampark/ticker.ts --once          # one render + one dispatch
 *   SAMPARK_BASE_URL=http://localhost:3001 …                        # another port
 *
 * Each tick POSTs /api/jobs/sampark-render, then /api/jobs/sampark-dispatch,
 * with `Authorization: Bearer $CRON_SECRET`, and prints both reports. A failed
 * request is reported and the loop carries on (the jobs are idempotent).
 * Refuses a non-local base URL: this is a development tool.
 */

function out(line: string): void {
    process.stdout.write(`${line}\n`);
}

function arg(name: string): string | null {
    const i = process.argv.indexOf(name);
    return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

const baseUrl = (process.env.SAMPARK_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const intervalSeconds = Math.max(1, Number(arg('--interval') ?? process.env.SAMPARK_TICK_SECONDS ?? 15) || 15);
const once = process.argv.includes('--once');
const secret = process.env.CRON_SECRET?.trim();

async function call(path: string): Promise<void> {
    const started = Date.now();
    try {
        const res = await fetch(`${baseUrl}${path}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${secret}` },
        });
        const text = await res.text();
        let body: unknown = text;
        try {
            body = JSON.parse(text);
        } catch {
            // non-JSON (e.g. an HTML error page) — print as text
        }
        out(`${new Date().toISOString()} ${path} → ${res.status} (${Date.now() - started} ms) ${JSON.stringify(body)}`);
    } catch (err) {
        out(`${new Date().toISOString()} ${path} → request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
}

async function tick(): Promise<void> {
    await call('/api/jobs/sampark-render');
    await call('/api/jobs/sampark-dispatch');
}

async function main(): Promise<void> {
    if (!secret) {
        process.stderr.write('CRON_SECRET is not set (use the same value as the dev server).\n');
        process.exit(1);
    }
    const host = new URL(baseUrl).hostname;
    if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
        process.stderr.write(`Refusing to tick ${baseUrl}: the ticker only drives a local dev server.\n`);
        process.exit(1);
    }
    if (once) {
        await tick();
        return;
    }
    out(`Sampark ticker → ${baseUrl} every ${intervalSeconds}s (Ctrl-C to stop)`);
    for (;;) {
        await tick();
        await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
    }
}

main().catch((err) => {
    process.stderr.write(`Ticker failed: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
});
