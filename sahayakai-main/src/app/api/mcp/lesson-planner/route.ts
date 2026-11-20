import { getDb } from '@/lib/firebase-admin';
import { checkServerRateLimit } from '@/lib/server-safety';
import { dispatchLessonPlan } from '@/lib/sidecar/lesson-plan-dispatch';
import type { McpAuthDb } from '@/lib/mcp/auth';
import { handleMcpHttpRequest } from '@/lib/mcp/http-handler';
import { lessonPlannerCapability } from '@/lib/mcp/lesson-planner/capability';

/**
 * Sahayak Lesson Planner — public MCP server (Streamable HTTP, stateless).
 *
 *   POST /api/mcp/lesson-planner
 *   Authorization: Bearer sk_sahayak_<keyId>_<secret>   (scope: lesson-planner)
 *
 * Authentication happens in-handler (the middleware lists /api/mcp/ as a
 * public prefix because callers are API clients, not Firebase users).
 * Docs: docs/mcp/lesson-planner/README.md
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Lesson-plan generation can take up to ~60 s under load (same budget as /api/ai/lesson-plan).
export const maxDuration = 120;

const capability = lessonPlannerCapability(dispatchLessonPlan);
const deps = {
    getDb: getDb as unknown as () => Promise<McpAuthDb>,
    rateLimit: checkServerRateLimit,
};

export async function POST(request: Request): Promise<Response> {
    return handleMcpHttpRequest(request, capability, deps);
}

// Stateless Streamable HTTP: no server-initiated SSE stream, no sessions to
// delete. Both answer 405 with an explanation.
export const GET = POST;
export const DELETE = POST;
