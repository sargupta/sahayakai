import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify, importX509, createRemoteJWKSet } from 'jose';

// Firebase Project ID
const PROJECT_ID = 'sahayakai-b4248';
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

// Phase R.2: Firebase App Check JWKS endpoint. App Check tokens are
// JWTs signed by Firebase's App Check service; verifying them against
// this key set proves the request came from a registered client app.
const APP_CHECK_JWKS_URL = 'https://firebaseappcheck.googleapis.com/v1/jwks';
const APP_CHECK_ISSUER = `https://firebaseappcheck.googleapis.com/${PROJECT_ID}`;
// `aud` claim format that App Check tokens carry — see
// https://firebase.google.com/docs/app-check/custom-resource-backend#nodejs
const APP_CHECK_AUD_PREFIXES = [
    `projects/${PROJECT_ID}`,
    'projects/640589855975', // project number
];

// Cache the JWKS resolver across requests (it has its own internal TTL).
const _appCheckJwks = createRemoteJWKSet(new URL(APP_CHECK_JWKS_URL));

/**
 * Verify a Firebase App Check token. Returns the claims on success or
 * `null` on any failure. We never throw from this function — App Check
 * is layered on top of ID-token + sidecar HMAC; a transient JWKS fetch
 * failure should not lock every API caller out.
 */
async function verifyAppCheckToken(token: string): Promise<Record<string, unknown> | null> {
    try {
        const { payload } = await jwtVerify(token, _appCheckJwks, {
            issuer: APP_CHECK_ISSUER,
        });
        const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
        if (!aud.some((a) => typeof a === 'string' && APP_CHECK_AUD_PREFIXES.includes(a))) {
            return null;
        }
        return payload as Record<string, unknown>;
    } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.warn('[middleware] App Check verification failed:', (err as Error).message);
        }
        return null;
    }
}

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
        pathname === '/favicon.ico' ||
        // Firebase Auth helper paths reverse-proxied to *.firebaseapp.com
        // (see next.config.ts rewrites). Don't run auth verification or
        // attach security headers (e.g. X-Frame-Options: DENY would block
        // the iframe the Firebase SDK loads at /__/auth/iframe).
        pathname.startsWith('/__/')
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
        pathname.startsWith('/api/auth/') ||
        pathname.startsWith('/api/attendance/twiml') ||  // Twilio callbacks — no auth header
        pathname.startsWith('/api/jobs/') ||  // Cloud Scheduler cron jobs — OIDC validated by Cloud Run
        pathname.startsWith('/api/webhooks/') ||  // Payment webhooks — verified via HMAC signature
        pathname.startsWith('/api/billing/callback');  // Razorpay redirect — verified via signature  // Cloud Scheduler cron jobs — OIDC validated by Cloud Run

    if (isPublicApi) {
        return NextResponse.next();
    }

    const requestHeaders = new Headers(request.headers);

    // --- Phase R.2: Firebase App Check verification ---
    // The browser attaches `X-Firebase-AppCheck` on outbound API calls
    // (see `@/lib/firebase-app-check`). When the header is present we
    // verify it; when it is absent we tolerate that for now since
    // Firebase rolled clients in stages — the sidecar still has its own
    // App Check gate (`SAHAYAKAI_REQUIRE_APP_CHECK`). On verification
    // success we stash the originating Firebase app id in `x-app-check-app`
    // so downstream API handlers can forward the original token to the
    // sidecar via the same header without re-verifying.
    if (process.env.APP_CHECK_REQUIRED === 'true') {
        const appCheckHeader = request.headers.get('X-Firebase-AppCheck');
        if (!appCheckHeader && pathname.startsWith('/api/ai/')) {
            // Strict mode (post-rollout): every AI API call must carry an
            // App Check token.
            return NextResponse.json({ error: 'Missing App Check token' }, { status: 401 });
        }
        if (appCheckHeader) {
            const claims = await verifyAppCheckToken(appCheckHeader);
            if (!claims) {
                return NextResponse.json({ error: 'Invalid App Check token' }, { status: 401 });
            }
            const appId = typeof claims.app_id === 'string' ? claims.app_id : '';
            if (appId) requestHeaders.set('x-app-check-app', appId);
        }
    }

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
