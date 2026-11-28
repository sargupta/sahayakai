import { NextResponse } from 'next/server';
import { createJoinLink, listJoinLinks, revokeJoinLink } from '@/lib/access/join-links';
import { errorResponse, readJsonObject, requireOrgAdmin, toErrorResponse } from '@/lib/access/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * /api/organizations/{orgId}/join-links — a school's teacher join links.
 * Caller must administer this organization (school admin) or be a SahayakAI
 * administrator.
 *
 * GET    -> { links: [{ id, createdAt, expiresAt, maxUses, uses, revoked }] }
 * POST   { maxUses?, expiresInDays? } -> { id, code, url, expiresAt, maxUses }
 *        The code is shown once; only its hash is stored.
 * DELETE ?id= -> { ok: true }   (revokes; the record is kept for audit)
 */

/** Public origin for the shareable URL. Prefer configuration over the Host header. */
function publicOrigin(request: Request): string {
    const configured = process.env.NEXT_PUBLIC_APP_URL;
    if (configured) return configured.replace(/\/+$/, '');
    const host = request.headers.get('host') ?? 'www.sahayakai.com';
    const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
    return `${protocol}://${host}`;
}

export async function GET(request: Request, context: { params: Promise<{ orgId: string }> }) {
    try {
        const { orgId } = await context.params;
        await requireOrgAdmin(request, orgId);
        return NextResponse.json({ links: await listJoinLinks(orgId) });
    } catch (err) {
        return toErrorResponse(err, '[join-links GET]');
    }
}

export async function POST(request: Request, context: { params: Promise<{ orgId: string }> }) {
    try {
        const { orgId } = await context.params;
        const actor = await requireOrgAdmin(request, orgId);
        // The body is optional: an empty POST creates a link with defaults.
        const body = await readJsonObject(request).catch(() => ({} as Record<string, unknown>));
        const link = await createJoinLink({
            orgId,
            createdBy: actor,
            maxUses: body.maxUses,
            expiresInDays: body.expiresInDays,
        });
        return NextResponse.json({
            id: link.id,
            code: link.code,
            url: `${publicOrigin(request)}/join/${link.code}`,
            expiresAt: link.expiresAt.toISOString(),
            maxUses: link.maxUses,
        });
    } catch (err) {
        return toErrorResponse(err, '[join-links POST]');
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ orgId: string }> }) {
    try {
        const { orgId } = await context.params;
        const actor = await requireOrgAdmin(request, orgId);
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return errorResponse(400, 'Missing id');
        await revokeJoinLink(orgId, id, actor);
        return NextResponse.json({ ok: true });
    } catch (err) {
        return toErrorResponse(err, '[join-links DELETE]');
    }
}
