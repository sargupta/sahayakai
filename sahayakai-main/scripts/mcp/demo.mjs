#!/usr/bin/env node
/**
 * Sahayak public MCP servers — end-to-end demo / smoke test, run exactly as an
 * external AI agent would: official MCP SDK client → initialize → tools/list →
 * tools/call → print the result. Exit 0 = PASS, 1 = FAIL.
 *
 *   npm run mcp:lesson-planner:demo        (= node scripts/mcp/demo.mjs lesson-planner)
 *   npm run mcp:exam-paper:demo            (= node scripts/mcp/demo.mjs exam-paper)
 *   PORT=3100 npm run mcp:exam-paper:demo  # local dev on another port
 *   SAHAYAK_MCP_URL=https://<host>/api/mcp/exam-paper SAHAYAK_MCP_API_KEY=sk_sahayak_… npm run mcp:exam-paper:demo
 *
 * Locally the key is read from .env.local (MCP_LOCAL_DEV_API_KEY, created by
 * `npm run mcp:dev-key`). Only the public SDK client is used — no Sahayak
 * internals — so this file doubles as an integration example.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// First request after `next dev` starts compiles the route; allow for it.
const SLOW = { timeout: 180_000 };

/** One entry per public MCP server: what to call and how to judge the answer. */
const DEMOS = {
    'lesson-planner': {
        name: 'Lesson Planner',
        tool: 'create_lesson_plan',
        input: { topic: 'Photosynthesis', grade: 7, subject: 'Science', language: 'English', difficulty: 'medium' },
        expect: 'usually 10–40 s',
        check(plan) {
            const phases = (plan?.activities ?? []).map((a) => a.phase);
            const ok = plan?.title && plan.grade === 7 && plan.learning_objectives?.length > 0
                && ['Engage', 'Explore', 'Explain', 'Elaborate', 'Evaluate'].every((p) => phases.includes(p));
            return ok ? `"${plan.title}" (Class ${plan.grade}, ${plan.learning_objectives.length} objectives, ${phases.join(' → ')})` : null;
        },
        failure: 'the response did not contain a complete 5E lesson plan.',
    },
    'exam-paper': {
        name: 'Exam Paper Generator',
        tool: 'create_exam_paper',
        input: { board: 'CBSE', grade: 8, subject: 'Science', chapters: ['Force and Pressure'], difficulty: 'medium', language: 'English' },
        expect: 'usually 30–75 s',
        check(paper) {
            const questions = (paper?.sections ?? []).flatMap((s) => s.questions ?? []);
            const answered = questions.filter((q) => q.answer_key).length;
            const ok = paper?.title && paper.grade === 8 && questions.length > 0 && answered > 0 && paper.total_question_marks > 0;
            return ok
                ? `"${paper.title}" (Class ${paper.grade}, ${paper.sections.length} sections, ${questions.length} questions, ${paper.total_question_marks}/${paper.max_marks} marks, ${answered} answers${paper.review_notes.length ? `, ${paper.review_notes.length} review note(s)` : ''})`
                : null;
        },
        failure: 'the response did not contain an exam paper with questions and answers.',
    },
};

function readEnvLocal(name) {
    const file = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env.local');
    if (!existsSync(file)) return undefined;
    const m = readFileSync(file, 'utf8').match(new RegExp(`^${name}=(\\S+)`, 'm'));
    return m ? m[1].replace(/^["']|["']$/g, '') : undefined;
}

const capability = process.argv[2] ?? 'lesson-planner';
const demo = DEMOS[capability];
const url = process.env.SAHAYAK_MCP_URL ?? `http://localhost:${process.env.PORT ?? 3000}/api/mcp/${capability}`;
const apiKey = process.env.SAHAYAK_MCP_API_KEY ?? readEnvLocal('MCP_LOCAL_DEV_API_KEY');
const step = (n, text) => console.log(`\n[${n}/4] ${text}`);
const fail = (why) => {
    console.error(`\nFAIL — ${why}`);
    process.exit(1);
};

async function main() {
    if (!demo) fail(`unknown capability "${capability}". Use one of: ${Object.keys(DEMOS).join(', ')}.`);
    console.log(`Sahayak ${demo.name} MCP demo\nendpoint: ${url}`);
    if (!apiKey) fail('no API key. Run `npm run mcp:dev-key` (local) or set SAHAYAK_MCP_API_KEY.');

    step(1, 'initialize');
    const client = new Client({ name: 'sahayak-mcp-demo-client', version: '1.0.0' });
    try {
        await client.connect(new StreamableHTTPClientTransport(new URL(url), {
            requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
        }), SLOW);
    } catch (e) {
        fail(`could not connect/initialize (${e.message}). Is \`npm run dev\` running, and was it restarted after \`npm run mcp:dev-key\`?`);
    }
    const server = client.getServerVersion();
    console.log(`      connected to ${server?.name} v${server?.version}`);

    step(2, 'tools/list');
    const { tools } = await client.listTools(undefined, SLOW);
    const tool = tools.find((t) => t.name === demo.tool);
    console.log(`      discovered: ${tools.map((t) => t.name).join(', ')}`);
    if (!tool) fail(`${demo.tool} was not discovered.`);
    console.log(`      required inputs: ${(tool.inputSchema.required ?? []).join(', ')}`);

    step(3, `tools/call ${demo.tool} ${JSON.stringify(demo.input)}`);
    console.log(`      generating (${demo.expect})…`);
    const started = Date.now();
    const res = await client.callTool({ name: demo.tool, arguments: demo.input }, undefined, SLOW);
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    await client.close();
    if (res.isError) fail(`tool returned an error after ${secs}s: ${JSON.stringify(res.structuredContent ?? res.content)}`);

    const result = res.structuredContent;
    step(4, `result received in ${secs}s`);
    console.log(`\n${res.content?.[0]?.text ?? JSON.stringify(result, null, 2)}`);

    const summary = demo.check(result);
    if (!summary) fail(demo.failure);
    console.log(`\nPASS — discovered and invoked ${demo.tool}; ${summary}.`);
}

main().then(() => process.exit(0), (e) => fail(e?.message ?? String(e)));
