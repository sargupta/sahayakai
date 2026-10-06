#!/usr/bin/env node
/**
 * Sahayak Lesson Planner MCP — end-to-end demo / smoke test, run exactly as an
 * external AI agent would: official MCP SDK client → initialize → tools/list →
 * tools/call create_lesson_plan → print the plan. Exit 0 = PASS, 1 = FAIL.
 *
 *   npm run mcp:lesson-planner:demo                         # local `npm run dev` (port 3000)
 *   PORT=3100 npm run mcp:lesson-planner:demo               # local dev on another port
 *   SAHAYAK_MCP_URL=https://<host>/api/mcp/lesson-planner SAHAYAK_MCP_API_KEY=sk_sahayak_… npm run mcp:lesson-planner:demo
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
const DEMO_INPUT = { topic: 'Photosynthesis', grade: 7, subject: 'Science', language: 'English', difficulty: 'medium' };

function readEnvLocal(name) {
    const file = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env.local');
    if (!existsSync(file)) return undefined;
    const m = readFileSync(file, 'utf8').match(new RegExp(`^${name}=(\\S+)`, 'm'));
    return m ? m[1].replace(/^["']|["']$/g, '') : undefined;
}

const url = process.env.SAHAYAK_MCP_URL ?? `http://localhost:${process.env.PORT ?? 3000}/api/mcp/lesson-planner`;
const apiKey = process.env.SAHAYAK_MCP_API_KEY ?? readEnvLocal('MCP_LOCAL_DEV_API_KEY');
const step = (n, text) => console.log(`\n[${n}/4] ${text}`);
const fail = (why) => {
    console.error(`\nFAIL — ${why}`);
    process.exit(1);
};

async function main() {
    console.log(`Sahayak Lesson Planner MCP demo\nendpoint: ${url}`);
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
    const tool = tools.find((t) => t.name === 'create_lesson_plan');
    console.log(`      discovered: ${tools.map((t) => t.name).join(', ')}`);
    if (!tool) fail('create_lesson_plan was not discovered.');
    console.log(`      required inputs: ${(tool.inputSchema.required ?? []).join(', ')}`);

    step(3, `tools/call create_lesson_plan ${JSON.stringify(DEMO_INPUT)}`);
    console.log('      generating (usually 10–40 s)…');
    const started = Date.now();
    const res = await client.callTool({ name: 'create_lesson_plan', arguments: DEMO_INPUT }, undefined, SLOW);
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    await client.close();
    if (res.isError) fail(`tool returned an error after ${secs}s: ${JSON.stringify(res.structuredContent ?? res.content)}`);

    const plan = res.structuredContent;
    step(4, `lesson plan received in ${secs}s`);
    console.log(`\n${res.content?.[0]?.text ?? JSON.stringify(plan, null, 2)}`);

    const phases = (plan?.activities ?? []).map((a) => a.phase);
    const ok = plan?.title && plan.grade === 7 && plan.learning_objectives?.length > 0
        && ['Engage', 'Explore', 'Explain', 'Elaborate', 'Evaluate'].every((p) => phases.includes(p));
    if (!ok) fail('the response did not contain a complete 5E lesson plan.');
    console.log(`\nPASS — discovered and invoked create_lesson_plan; "${plan.title}" (Class ${plan.grade}, ${plan.learning_objectives.length} objectives, ${phases.join(' → ')}).`);
}

main().then(() => process.exit(0), (e) => fail(e?.message ?? String(e)));
