import { getDb } from '@/lib/firebase-admin';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { checkServerRateLimit } from '@/lib/server-safety';
import { dispatchExamPaper } from '@/lib/sidecar/exam-paper-dispatch';
import type { McpAuthDb } from '@/lib/mcp/auth';
import { handleMcpHttpRequest } from '@/lib/mcp/http-handler';
import { examPaperCapability } from '@/lib/mcp/exam-paper/capability';
import { defaultCanAnchorWholeSyllabus } from '@/lib/mcp/exam-paper/service';

/**
 * Sahayak Exam Paper Generator — public MCP server (Streamable HTTP, stateless).
 *
 *   POST /api/mcp/exam-paper
 *   Authorization: Bearer sk_sahayak_<keyId>_<secret>   (scope: exam-paper)
 *
 * Authentication happens in-handler (the middleware lists /api/mcp/ as a
 * public prefix because callers are API clients, not Firebase users).
 * Docs: docs/mcp/exam-paper/README.md
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// The exam-paper service has a 75 s generation budget; 180 s leaves headroom
// for auth, the safety check and response serialisation (same as /api/ai/exam-paper).
export const maxDuration = 180;

const capability = examPaperCapability({
    dispatch: dispatchExamPaper,
    isEnabledFor: async (subject) => (await isFeatureEnabled('examPaperEnabled', subject)).enabled,
    canAnchorWholeSyllabus: defaultCanAnchorWholeSyllabus,
});
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
