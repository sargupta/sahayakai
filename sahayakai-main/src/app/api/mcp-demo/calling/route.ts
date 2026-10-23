import { getCallingDemoConfig, getCallingStatus, listContactsViaMcp } from '@/lib/mcp-demo/calling-client';

/**
 * Backend for /mcp-demo/calling.
 *
 *   browser ──(Firebase session)──▶ /api/mcp-demo/calling
 *     ──(MCP SDK client, server-held key)──▶ POST /api/mcp/calling ──▶ existing Contact flow
 *
 * Signed-in Sahayak users only (middleware injects x-user-id for /api/*), so
 * it is not an open telephony proxy. Responses never contain the key or URL.
 *
 *   GET                                   → MCP status (initialize + tools/list)
 *   POST {action:'list', class_id?}       → list_parent_contacts
 *   POST {action:'call', …}               → 403 capability_disabled. initiate_parent_call is switched
 *                                           off until it routes through Sampark (integration brief, decision 1).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 150;

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const NOT_CONFIGURED = { category: 'not_configured', message: 'The MCP calling demo is not configured on this server.', retryable: false };

const CALLING_DISABLED = {
    category: 'capability_disabled',
    message: 'Placing parent calls through the MCP is switched off until it goes through the Sampark calling rules of the school.',
    retryable: false,
};

const STATUS_BY_CATEGORY: Record<string, number> = {
    invalid_input: 400, not_found: 404, authorization: 403, rate_limited: 429, outside_allowed_hours: 409, not_configured: 503,
};

export async function GET(request: Request) {
    if (!request.headers.get('x-user-id')) return json({ error: { category: 'authentication', message: 'Please sign in.', retryable: false } }, 401);
    const config = getCallingDemoConfig();
    if (!config) return json({ configured: false, connected: false });
    return json({ configured: true, ...(await getCallingStatus(config)) });
}

export async function POST(request: Request) {
    if (!request.headers.get('x-user-id')) return json({ error: { category: 'authentication', message: 'Please sign in.', retryable: false } }, 401);
    const config = getCallingDemoConfig();
    if (!config) return json({ error: NOT_CONFIGURED }, 503);

    const text = await request.text();
    if (text.length > 8 * 1024) return json({ error: { category: 'invalid_input', message: 'Request is too large.', retryable: false } }, 413);
    let body: Record<string, unknown>;
    try {
        body = JSON.parse(text);
    } catch {
        return json({ error: { category: 'invalid_input', message: 'Request body must be JSON.', retryable: false } }, 400);
    }
    const { action, ...args } = body ?? {};
    if (action === 'call') return json({ error: CALLING_DISABLED }, 403);
    const outcome = action === 'list' ? await listContactsViaMcp(args, config) : null;
    if (!outcome) return json({ error: { category: 'invalid_input', message: 'Unknown action.', retryable: false } }, 400);
    if (outcome.ok) return json({ result: outcome.result, mcp: outcome.mcp });
    return json({ error: outcome.error }, STATUS_BY_CATEGORY[outcome.error.category] ?? 502);
}
