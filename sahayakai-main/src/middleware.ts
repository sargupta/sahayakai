import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify, importX509 } from 'jose';

// Firebase Project ID
const PROJECT_ID = 'sahayakai-b4248';
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

// Cache Google public certs — they rotate every ~6 h, so 5 h is safe.
// Without this every API request did a live network call to Google = +50–200 ms.
let _certsCache: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getGoogleCerts(): Promise<Record<string, string>> {
    if (_certsCache && Date.now() < _certsCache.expiresAt) return _certsCache.certs;
    const res = await fetch(GOOGLE_CERTS_URL);
    const certs = await res.json();
    _certsCache = { certs, expiresAt: Date.now() + 5 * 60 * 60 * 1000 };
    return certs;
}

async function verifyIdToken(token: string) {
    try {
        // 1. Get Google's public keys (cached for 5 h)
        const certs = await getGoogleCerts();

        // 2. Decode header to find 'kid' (key id)
        const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString());
        const kid = header.kid;

        if (!certs[kid]) throw new Error('Invalid key ID');

        // 3. Import public key and verify
        const publicKey = await importX509(certs[kid], 'RS256');

        const { payload } = await jwtVerify(token, publicKey, {
            issuer: ISSUER,
            audience: PROJECT_ID,
        });

        return payload;
    } catch (err) {
        console.error('Token verification failed:', err);
        return null;
    }
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip static assets entirely
    if (
        pathname.startsWith('/_next') ||
        pathname === '/favicon.ico'
    ) {
        return NextResponse.next();
    }

    // Public API routes — skip auth
    const isPublicApi =
        pathname.startsWith('/api/health') ||
        pathname.startsWith('/api/ai/quiz/health') ||
        pathname.startsWith('/api-docs') ||
        pathname.startsWith('/api/teacher-activity') ||
        pathname.startsWith('/api/metrics') ||
        pathname.startsWith('/api/analytics') ||
        pathname.startsWith('/api/assistant') ||
        pathname.startsWith('/api/auth/') ||
        pathname.startsWith('/api/attendance/twiml') ||  // Twilio callbacks — no auth header
        pathname.startsWith('/api/jobs/') ||  // Cloud Scheduler cron jobs — OIDC validated by Cloud Run
        pathname.startsWith('/api/webhooks/') ||  // Payment webhooks — verified via HMAC signature
        pathname.startsWith('/api/billing/callback');  // Razorpay redirect — verified via signature  // Cloud Scheduler cron jobs — OIDC validated by Cloud Run

    if (isPublicApi) {
        return NextResponse.next();
    }

    const requestHeaders = new Headers(request.headers);

    // --- Resolve the Firebase ID token ---
    // Priority: Authorization header (API calls) → auth-token cookie (server actions / page requests)
    const authHeader = request.headers.get('Authorization');
    const cookieToken = request.cookies.get('auth-token')?.value;
    const rawToken = authHeader?.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : cookieToken ?? null;

    const isApiOrAdmin = pathname.startsWith('/api/') || pathname.startsWith('/admin/');

    if (rawToken) {
        if (process.env.NODE_ENV === 'development' && rawToken === 'dev-token') {
            // Dev bypass — inject mock UID when using the dev token placeholder
            requestHeaders.set('x-user-id', 'dev-user-123');
            requestHeaders.set('x-user-plan', 'pro');
        } else {
            const decoded = await verifyIdToken(rawToken);
            if (decoded?.sub) {
                requestHeaders.set('x-user-id', decoded.sub);
                // Plan from Firebase custom claims — set via Admin SDK when plan changes
                // Falls back to 'free' if claim not yet set (new users, pre-migration users)
                const plan = (decoded as Record<string, unknown>).planType;
                // Normalize legacy values: 'institution' → 'premium'; 'pro'/'gold'/'premium' pass through
                const VALID_PLANS = ['free', 'pro', 'gold', 'premium'];
                const LEGACY: Record<string, string> = { institution: 'premium' };
                const raw = typeof plan === 'string' ? plan : '';
                const resolved = LEGACY[raw] ?? (VALID_PLANS.includes(raw) ? raw : 'free');
                requestHeaders.set('x-user-plan', resolved);
            } else if (isApiOrAdmin) {
                // Invalid token on protected routes → reject
                return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
            }
        }
    } else {
        if (isApiOrAdmin) {
            // No token at all on protected API/admin routes
            if (process.env.NODE_ENV === 'development') {
                requestHeaders.set('x-user-id', 'dev-user-123');
                requestHeaders.set('x-user-plan', 'pro');
            } else {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }
        // Page routes without a token: pass through, x-user-id simply not set
    }

    // Security headers for all non-static responses
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    requestHeaders.set('x-nonce', nonce);

    const response = NextResponse.next({ request: { headers: requestHeaders } });

    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=()');

    if (process.env.NODE_ENV === 'production') {
        response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }

    return response;
}

// Run on all routes except static files (handled by the early return above)
export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
