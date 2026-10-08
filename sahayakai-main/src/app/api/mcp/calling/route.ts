import { getDb } from '@/lib/firebase-admin';
import { checkCallingWindow } from '@/lib/calling-hours';
import { checkServerRateLimit } from '@/lib/server-safety';
import type { McpAuthDb } from '@/lib/mcp/auth';
import { handleMcpHttpRequest } from '@/lib/mcp/http-handler';
import { callingCapability } from '@/lib/mcp/calling/capability';
import type { CallingDb } from '@/lib/mcp/calling/service';
import { POST as parentMessageRoute } from '@/app/api/ai/parent-message/route';
import { POST as outreachRoute } from '@/app/api/attendance/outreach/route';
import { POST as callRoute } from '@/app/api/attendance/call/route';

/**
 * Sahayak Parent Calling — public MCP server (Streamable HTTP, stateless).
 *
 *   POST /api/mcp/calling
 *   Authorization: Bearer sk_sahayak_<keyId>_<secret>   (scope: calling)
 *
 * Drives the app's existing parent-message → outreach → call route handlers
 * (the attendance "Contact" flow) as the class's own teacher, after checking
 * that teacher belongs to the key's organisation.
 * Docs: docs/mcp/calling/README.md
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Message generation (~10-20 s) + provider dial; same order as the app's flow.
export const maxDuration = 120;

/**
 * Base URL the phone provider calls back (TwiML / answer / status). Server
 * config only: MCP_CALLING_CALLBACK_BASE_URL, else this server's loopback
 * under `next dev`. Unset in production = calling returns not_configured.
 */
function callbackBaseUrl(): string | null {
    const configured = process.env.MCP_CALLING_CALLBACK_BASE_URL?.trim();
    if (configured) return configured;
    return process.env.NODE_ENV === 'development' ? `http://localhost:${process.env.PORT || 3000}` : null;
}

const asHandler = (fn: (req: any) => Promise<Response>) => (req: Request) => fn(req);

const capability = callingCapability({
    getDb: getDb as unknown as () => Promise<CallingDb>,
    routes: { parentMessage: asHandler(parentMessageRoute), outreach: asHandler(outreachRoute), call: asHandler(callRoute) },
    get callbackBaseUrl() { return callbackBaseUrl(); },
    checkCallingWindow: () => checkCallingWindow(),
});
const deps = {
    getDb: getDb as unknown as () => Promise<McpAuthDb>,
    rateLimit: checkServerRateLimit,
};

export async function POST(request: Request): Promise<Response> {
    return handleMcpHttpRequest(request, capability, deps);
}

export const GET = POST;
export const DELETE = POST;
