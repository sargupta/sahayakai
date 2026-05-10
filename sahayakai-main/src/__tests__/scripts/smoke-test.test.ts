/**
 * @jest-environment node
 *
 * Verifies the post-merge AI smoke harness (`scripts/smoke-test-ai-flows.sh`).
 *
 * Strategy: spin up a tiny in-process HTTP mock that returns canned
 * Gemini-shaped responses for every route the harness probes, run the
 * bash script against it, then assert the rendered output table matches
 * the expected shape. This catches regressions in the harness itself
 * (broken curl flag, missing route, parsing bug) WITHOUT making any real
 * AI calls.
 *
 * Runs under the node test environment (not jsdom) — jsdom intercepts
 * `node:http` which makes the in-process server hang under curl.
 */
import { spawn } from 'node:child_process';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Spawn the bash script ASYNCHRONOUSLY. We can't use spawnSync because the
 * mock HTTP server runs on the same Node event loop — a sync child blocks
 * the loop, the server never accepts the curl connection, and every request
 * times out at curl --max-time.
 */
async function runScript(env: NodeJS.ProcessEnv, timeoutMs: number): Promise<{
    status: number | null;
    stdout: string;
    stderr: string;
}> {
    return new Promise((resolve, reject) => {
        const proc = spawn('bash', [SCRIPT_PATH], {
            env: { ...process.env, ...env },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (b: Buffer) => { stdout += b.toString(); });
        proc.stderr.on('data', (b: Buffer) => { stderr += b.toString(); });
        const killer = setTimeout(() => {
            proc.kill('SIGKILL');
        }, timeoutMs);
        proc.on('error', (e) => { clearTimeout(killer); reject(e); });
        proc.on('exit', (code) => {
            clearTimeout(killer);
            resolve({ status: code, stdout, stderr });
        });
    });
}

// jsdom is the default test env (jest.config.ts), but the script is plain bash
// and the mock server uses Node http, so jsdom doesn't get in the way.

type Route = {
    method: 'GET' | 'POST';
    path: string;
    /**
     * Either a status code + canned JSON body, or a function that decides
     * dynamically. SSE routes return raw chunks via `sse: true`.
     */
    handler:
    | { kind: 'json'; status: number; body: unknown }
    | { kind: 'sse'; chunks: string[] }
    | { kind: 'fn'; fn: (req: IncomingMessage, res: ServerResponse) => void };
};

const SCRIPT_PATH = path.resolve(__dirname, '../../../scripts/smoke-test-ai-flows.sh');

// One handler per route the script hits. The bodies aren't required to be
// realistic — they only need to:
//   - return HTTP 200
//   - parse as JSON (except SSE)
//   - contain the field the harness reads as the "notes" excerpt
const ROUTES: Route[] = [
    {
        method: 'POST',
        path: '/api/ai/lesson-plan',
        handler: { kind: 'json', status: 200, body: { title: "Plants' Food Factory", duration: '45m' } },
    },
    {
        method: 'POST',
        path: '/api/ai/instant-answer',
        handler: { kind: 'json', status: 200, body: { answer: 'A 412-character answer ...', citations: [] } },
    },
    {
        method: 'POST',
        path: '/api/ai/quiz',
        handler: { kind: 'json', status: 200, body: { title: 'Photosynthesis Quiz', questions: new Array(12).fill({ q: 'q' }) } },
    },
    {
        method: 'POST',
        path: '/api/ai/exam-paper',
        handler: { kind: 'json', status: 200, body: { title: 'CBSE Class 10 Maths', sections: [] } },
    },
    {
        method: 'POST',
        path: '/api/ai/rubric',
        handler: { kind: 'json', status: 200, body: { title: 'Renewable Energy Rubric', criteria: [] } },
    },
    {
        method: 'POST',
        path: '/api/ai/worksheet',
        handler: { kind: 'json', status: 200, body: { title: 'Multiplication Worksheet', activities: [] } },
    },
    {
        method: 'POST',
        path: '/api/ai/teacher-training',
        handler: { kind: 'json', status: 200, body: { introduction: 'Managing 40 students starts with clear routines ...', advice: [] } },
    },
    {
        method: 'POST',
        path: '/api/ai/virtual-field-trip',
        handler: { kind: 'json', status: 200, body: { title: 'Reef Trip', stops: [] } },
    },
    {
        method: 'POST',
        path: '/api/ai/video-storyteller',
        handler: { kind: 'json', status: 200, body: { categories: ['hook', 'concept', 'practice'] } },
    },
    {
        method: 'POST',
        path: '/api/ai/visual-aid',
        // visual-aid is the slow one — mock returns immediately so the test
        // is deterministic.
        handler: { kind: 'json', status: 200, body: { imageUrl: 'data:image/png;base64,AAAA' } },
    },
    {
        method: 'POST',
        path: '/api/ai/avatar',
        handler: { kind: 'json', status: 200, body: { imageUrl: 'data:image/png;base64,BBBB' } },
    },
    {
        method: 'POST',
        path: '/api/ai/parent-message',
        handler: { kind: 'json', status: 200, body: { message: 'Dear parent, Aarav is doing well ...' } },
    },
    {
        method: 'POST',
        path: '/api/ai/intent',
        handler: { kind: 'json', status: 200, body: { action: 'NAVIGATE', url: '/quiz-generator?topic=photosynthesis' } },
    },
    // P6: voice-tiny.webm is now checked in, so the harness uploads the
    // fixture and expects a 200 with `text`. Mock returns a deterministic
    // string regardless of audio content (this exercises the multipart
    // wiring, not the model).
    {
        method: 'POST',
        path: '/api/ai/voice-to-text',
        handler: { kind: 'json', status: 200, body: { text: 'photosynthesis is the way plants make food' } },
    },
    {
        method: 'POST',
        path: '/api/ai/lesson-plan/stream',
        handler: {
            kind: 'sse',
            chunks: [
                'data: {"type":"status","message":"warming up"}\n\n',
                'data: {"type":"status","message":"generating"}\n\n',
                'data: {"type":"complete","data":{"title":"Plants Food Factory"}}\n\n',
            ],
        },
    },
    {
        method: 'POST',
        path: '/api/ai/exam-paper/stream',
        handler: {
            kind: 'sse',
            chunks: [
                'data: {"type":"status","message":"building blueprint"}\n\n',
                'data: {"type":"complete","data":{"title":"CBSE Class 10 Maths"}}\n\n',
            ],
        },
    },
    {
        method: 'GET',
        path: '/api/ai/quiz/health',
        // Mirror prod behaviour: non-admin tokens get 401. Harness should
        // SKIP this row (and not count it as a failure).
        handler: {
            kind: 'fn',
            fn: (_req, res) => {
                res.statusCode = 401;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'admin only' }));
            },
        },
    },
];

function startMock(): Promise<{ server: Server; baseUrl: string }> {
    return new Promise((resolve) => {
        const server = createServer((req, res) => {
            // Drain the request body so curl gets a clean response.
            const chunks: Buffer[] = [];
            req.on('data', (c: Buffer) => chunks.push(c));
            req.on('end', () => {
                const route = ROUTES.find((r) => r.method === req.method && r.path === req.url);
                if (!route) {
                    res.statusCode = 404;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: `no mock for ${req.method} ${req.url}` }));
                    return;
                }
                const h = route.handler;
                if (h.kind === 'json') {
                    res.statusCode = h.status;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(h.body));
                } else if (h.kind === 'sse') {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.setHeader('Cache-Control', 'no-cache');
                    for (const chunk of h.chunks) res.write(chunk);
                    res.end();
                } else {
                    h.fn(req, res);
                }
            });
        });
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            if (!addr || typeof addr === 'string') {
                throw new Error('Failed to bind mock server');
            }
            resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
        });
    });
}

// Smoke-test exercises a real shell script that spawns curl probes
// against a local mock server — under heavy parallel jest load this
// can briefly exceed the default 5s budget. 30s is plenty in
// practice and prevents flaky CI failures.
jest.setTimeout(30_000);

describe('scripts/smoke-test-ai-flows.sh', () => {
    let server: Server;
    let baseUrl: string;

    beforeAll(async () => {
        // Verify the script file exists before doing anything else — failing
        // here is far more diagnostic than failing on the spawn line.
        readFileSync(SCRIPT_PATH);
        const out = await startMock();
        server = out.server;
        baseUrl = out.baseUrl;
    });

    afterAll(() => {
        return new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('runs every probe and emits the documented table format', async () => {
        const result = await runScript(
            {
                BASE_URL: baseUrl,
                TEST_TOKEN: 'dev-token',
                // Generous timeout so a slow CI box doesn't trip the curl
                // limit while talking to the in-process mock.
                TIMEOUT: '30',
            },
            60_000,
        );

        // The bash script exits 0 on all-pass. All routes mocked, so we
        // expect 0 — except quiz/health which is documented to SKIP, and
        // voice-to-text which SKIPs when no fixture exists. Both SKIP, so
        // FAIL = 0 → exit 0.
        if (result.status !== 0) {
            // eslint-disable-next-line no-console -- diagnostic on failure only
            console.error('STDOUT:\n' + result.stdout);
            // eslint-disable-next-line no-console
            console.error('STDERR:\n' + result.stderr);
        }
        expect(result.status).toBe(0);

        const stdout = result.stdout ?? '';

        // Header
        expect(stdout).toContain('=== Sahayakai AI flows smoke test ===');
        expect(stdout).toContain(`Base: ${baseUrl}`);

        // Column headings
        expect(stdout).toMatch(/Flow\s+Status\s+Latency\s+Notes/);

        // Every flow must appear in the table.
        const expectedFlows = [
            'lesson-plan',
            'instant-answer',
            'quiz',
            'exam-paper',
            'rubric',
            'worksheet',
            'teacher-training',
            'virtual-field-trip',
            'video-storyteller',
            'visual-aid',
            'avatar',
            'parent-message',
            'intent',
            'voice-to-text',
            'lesson-plan/stream',
            'exam-paper/stream',
            'quiz/health',
        ];
        for (const flow of expectedFlows) {
            // Match the row at start-of-line so 'lesson-plan' doesn't
            // accidentally match 'lesson-plan/stream'.
            const re = new RegExp(`^${flow.replace('/', '\\/')}\\s`, 'm');
            expect(stdout).toMatch(re);
        }

        // Summary line.
        expect(stdout).toMatch(/Summary: \d+\/\d+ PASS, \d+ FAIL, \d+ SKIP/);

        // No FAIL rows on a fully-mocked run.
        const summaryMatch = stdout.match(/Summary: (\d+)\/(\d+) PASS, (\d+) FAIL, (\d+) SKIP/);
        expect(summaryMatch).not.toBeNull();
        const [, passStr, totalStr, failStr, skipStr] = summaryMatch as RegExpMatchArray;
        const pass = Number(passStr);
        const total = Number(totalStr);
        const fail = Number(failStr);
        const skip = Number(skipStr);

        // 17 probes total.
        expect(total).toBe(17);
        // Exactly one SKIP against this mock: quiz/health (admin-only without
        // TEST_AS_ADMIN). Since P6 the voice-to-text fixture is checked in
        // and the probe runs successfully against the mock.
        expect(skip).toBe(1);
        expect(fail).toBe(0);
        expect(pass).toBe(16);

        // Sample assertion: lesson-plan note carries the title prefix the
        // script extracted from the canned body.
        expect(stdout).toMatch(/lesson-plan\s+✓.*title: "Plants' Food Factory"/);
    });

    it('exits non-zero when at least one probe fails', async () => {
        // Spin up a second mock that returns 500 for lesson-plan to prove
        // the failure path is wired correctly.
        const failServer = createServer((req, res) => {
            // Drain the request body — without this, the request stays open
            // until curl's --max-time fires, blowing the test budget.
            req.on('data', () => undefined);
            req.on('end', () => {
                if (req.method === 'POST' && req.url === '/api/ai/lesson-plan') {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'mock 500' }));
                    return;
                }
                // Everything else: cheap 200 ok with a plausible body.
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                    JSON.stringify({
                        title: 'X',
                        answer: 'X',
                        introduction: 'X',
                        message: 'X',
                        action: 'X',
                        imageUrl: 'data:image/png;base64,QQ==',
                        categories: [],
                        text: 'X',
                    }),
                );
            });
        });
        await new Promise<void>((res) => failServer.listen(0, '127.0.0.1', () => res()));
        const addr = failServer.address();
        if (!addr || typeof addr === 'string') throw new Error('bind');
        const failBase = `http://127.0.0.1:${addr.port}`;

        try {
            const result = await runScript(
                {
                    BASE_URL: failBase,
                    TEST_TOKEN: 'dev-token',
                    TIMEOUT: '10',
                },
                60_000,
            );
            expect(result.status).toBe(1);
            expect(result.stdout).toMatch(/lesson-plan\s+✗.*500/);
            expect(result.stdout).toMatch(/Summary: \d+\/\d+ PASS, [1-9]\d* FAIL/);
        } finally {
            await new Promise<void>((res) => failServer.close(() => res()));
        }
    });
});
