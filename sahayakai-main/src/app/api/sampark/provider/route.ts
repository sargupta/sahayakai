/**
 * The calling-provider choice at the SamparkAI entry (src/lib/sampark/provider-choice.ts).
 *
 * GET  → { choice, options: [{ id, available }] }  — which providers this deployment can use
 *        (configuration problems by NAME only, never values) and this session's current choice.
 * POST { provider: 'elevenlabs' | 'vobiz' } → sets the httpOnly session cookie the Riya routes
 *        read server-side. Refused (409) for a provider this deployment has not configured.
 *
 * Auth: a signed-in user (x-user-id, set by the middleware after verifying the token) — 401
 * otherwise. The choice belongs to this browser session only: it changes no school, no other
 * user, and no gate (every Riya rule still applies to whichever provider is chosen).
 * Flags: SAMPARK_ENABLED==='true' else 404.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { PROVIDER_CHOICES, PROVIDER_COOKIE, providerChoiceFromCookieHeader } from '@/lib/sampark/provider-choice';
import { providerOptions } from '@/server/sampark/conversation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ provider: z.enum(PROVIDER_CHOICES) }).strict();

function guard(req: NextRequest): NextResponse | null {
    if (process.env.SAMPARK_ENABLED !== 'true') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!req.headers.get('x-user-id')) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    return null;
}

export async function GET(req: NextRequest) {
    const refused = guard(req);
    if (refused) return refused;
    const options = providerOptions().map((o) => ({ id: o.id, available: o.available }));
    const current = providerChoiceFromCookieHeader(req.headers.get('cookie'));
    return NextResponse.json({ choice: current, options }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: NextRequest) {
    const refused = guard(req);
    if (refused) return refused;
    let parsed: z.infer<typeof Body>;
    try {
        const r = Body.safeParse(await req.json());
        if (!r.success) return NextResponse.json({ error: 'INVALID_PROVIDER' }, { status: 400 });
        parsed = r.data;
    } catch {
        return NextResponse.json({ error: 'INVALID_PROVIDER' }, { status: 400 });
    }
    const option = providerOptions().find((o) => o.id === parsed.provider);
    if (!option?.available) {
        return NextResponse.json({ error: 'PROVIDER_NOT_AVAILABLE', message: 'This calling provider is not set up for this deployment.' }, { status: 409 });
    }
    const res = NextResponse.json({ choice: parsed.provider }, { headers: { 'cache-control': 'no-store' } });
    // Session cookie (no Max-Age): a new browser session chooses again. httpOnly: only the server reads it.
    res.cookies.set(PROVIDER_COOKIE, parsed.provider, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
    });
    return res;
}
