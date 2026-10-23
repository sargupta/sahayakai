import { createLessonPlanViaMcp, getMcpDemoConfig, getMcpStatus } from '@/lib/mcp-demo/lesson-planner-client';

/**
 * Backend for the /mcp-demo/lesson-planner page.
 *
 *   browser ──(Firebase session)──▶ /api/mcp-demo/lesson-planner
 *     ──(MCP SDK client, Streamable HTTP, server-held API key)──▶ /api/mcp/lesson-planner
 *     ──▶ create_lesson_plan ──▶ Sahayak lesson-plan service
 *
 * Not a public route: the middleware requires a signed-in Sahayak user for
 * /api/* (and injects x-user-id), so this cannot be used as an open proxy
 * for the server's MCP key. Responses never contain the key or the MCP URL.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 150;

const NOT_CONFIGURED = { category: 'not_configured', message: 'The MCP demo is not configured on this server.', retryable: false };
const MAX_BODY_BYTES = 16 * 1024;

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function requireUser(request: Request): Response | null {
    return request.headers.get('x-user-id') ? null : json({ error: { category: 'authentication', message: 'Please sign in.', retryable: false } }, 401);
}

/** MCP status for the page's status indicator (initialize + tools/list; no generation). */
export async function GET(request: Request) {
    const denied = requireUser(request);
    if (denied) return denied;
    const config = getMcpDemoConfig();
    if (!config) return json({ connected: false, configured: false });
    const status = await getMcpStatus(config);
    return json({ configured: true, ...status });
}

/** Generate a lesson plan through the MCP server. */
export async function POST(request: Request) {
    const denied = requireUser(request);
    if (denied) return denied;
    const config = getMcpDemoConfig();
    if (!config) return json({ error: NOT_CONFIGURED }, 503);

    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
        return json({ error: { category: 'invalid_input', message: 'Request is too large.', retryable: false } }, 413);
    }
    let args: unknown;
    try {
        args = JSON.parse(text);
    } catch {
        return json({ error: { category: 'invalid_input', message: 'Request body must be JSON.', retryable: false } }, 400);
    }

    const result = await createLessonPlanViaMcp(args, config);
    if (result.ok) return json({ plan: result.plan, mcp: result.mcp });
    const status = result.error.category === 'invalid_input' ? 400
        : result.error.category === 'rate_limited' ? 429
        : result.error.category === 'content_policy' ? 422
        : 502;
    return json({ error: result.error }, status);
}
