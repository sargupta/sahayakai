import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify, importX509, createRemoteJWKSet } from 'jose';
import {
    PROFILE_COMPLETE_COOKIE,
    verifyProfileCompleteCookie,
} from '@/lib/profile-complete-cookie';

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

    // SECURITY: Strip any client-supplied identity headers BEFORE any branch.
    // `x-user-id` / `x-user-plan` are trusted by every downstream route
    // handler as the verified-from-token identity. A client that sets them
    // on its outbound request would otherwise be able to impersonate any
    // user. Only this middleware — after successfully verifying a Firebase
    // ID token — is allowed to set them. We strip on ALL requests
    // (public + private + static) so there is no path where a forged
    // header survives. (P0 fix, 2026-06-05.)
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete('x-user-id');
    requestHeaders.delete('x-user-plan');
    // F1-06 fix (2026-06-06): syncUserAction previously trusted
    // client-supplied email/displayName. Strip these here so only the
    // post-verify branch below can set them, derived from the verified
    // ID-token claims (`email`, `name`).
    requestHeaders.delete('x-user-email');
    requestHeaders.delete('x-user-name');

    // Skip static assets entirely
    if (
        pathname.startsWith('/_next') ||
        pathname === '/favicon.ico' ||
        // SEO static files served from public/ (llms.txt, llms-full.txt, google verification)
        pathname === '/llms.txt' ||
        pathname === '/llms-full.txt' ||
        pathname === '/google8283f170c9f5e54d.html' ||
        // Firebase Auth helper paths reverse-proxied to *.firebaseapp.com
        // (see next.config.ts rewrites). Don't run auth verification or
        // attach security headers (e.g. X-Frame-Options: DENY would block
        // the iframe the Firebase SDK loads at /__/auth/iframe).
        pathname.startsWith('/__/')
    ) {
        return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // Public API routes — skip auth
    //
    // SECURITY NOTE (P0 fix, 2026-06-05): /api/analytics/* and
    // /api/teacher-activity were previously here. They are NOT actually
    // public — their handlers trust `x-user-id` from the request headers
    // for write authorization. Leaving them in this list let any anon
    // caller spoof the header and write to any victim's analytics
    // documents. They are now authenticated like every other private
    // route below.
    //
    // /api/metrics stays public because anon visitors (logged-out
    // landing pages) emit web-vital telemetry; the route does not use
    // `x-user-id` and only logs a client-supplied id label.
    // /api/auth/profile-check stays public because it runs pre-login
    // (the client doesn't have a token yet at that moment).
    const isPublicApi =
        pathname.startsWith('/api/health') ||
        pathname.startsWith('/api/ai/quiz/health') ||
        pathname.startsWith('/api-docs') ||
        pathname.startsWith('/api/metrics') ||
        pathname.startsWith('/api/auth/') ||
        pathname.startsWith('/api/attendance/twiml') ||  // Twilio callbacks — no auth header
        pathname.startsWith('/api/jobs/') ||  // Cloud Scheduler cron jobs — OIDC validated by Cloud Run
        pathname.startsWith('/api/webhooks/') ||  // Payment webhooks — verified via HMAC signature
        pathname.startsWith('/api/billing/callback') ||  // Razorpay redirect — verified via signature
        pathname === '/api/billing/create-public-subscription' ||  // Anon pricing checkout — creates Razorpay payment link; payment-side verification on webhook (exact path, NOT /api/billing prefix)
        pathname.startsWith('/api/seo/');  // SEO endpoints (llms.txt, google-verify) — public, no auth needed

    if (isPublicApi) {
        return NextResponse.next({ request: { headers: requestHeaders } });
    }

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

    // Server actions are POST requests to page routes. Without an explicit
    // gate here, an expired-session client call lets the action run with no
    // x-user-id, the action's `getAuthUserId()` throws "Unauthorized", and
    // Next.js converts to a generic 500 — bad UX (error page instead of
    // login redirect) and noisy GCP logs (12 such 500s observed in the
    // 2026-06-01 audit, all from one user retrying with expired session).
    // Treat any non-idempotent method to a non-API non-admin path the same
    // as an API call: require auth.
    //
    // Safe by exclusion: all known legitimate non-API POST endpoints
    // (Twilio webhooks, payment callbacks, Cloud Scheduler jobs) live under
    // /api/* and are already covered by the isPublicApi short-circuit
    // above. Firebase auth helpers under /__/ are short-circuited by the
    // static-asset block. There is no public page route that accepts POST.
    const isMutatingMethod =
        request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS';
    const isPageMutation = !isApiOrAdmin && isMutatingMethod;

    if (rawToken) {
        if (process.env.NODE_ENV === 'development' && rawToken === 'dev-token') {
            // Dev bypass — inject mock UID when using the dev token placeholder
            requestHeaders.set('x-user-id', 'dev-user-123');
            requestHeaders.set('x-user-plan', 'pro');
            requestHeaders.set('x-user-email', 'dev@sahayakai.local');
            requestHeaders.set('x-user-name', 'Dev User');
        } else {
            const decoded = await verifyIdToken(rawToken);
            if (decoded?.sub) {
                requestHeaders.set('x-user-id', decoded.sub);
                // F1-06 fix (2026-06-06): inject verified-from-token email
                // and display name. syncUserAction (and any other server
                // surface that needs to mirror auth profile into Firestore)
                // reads from these headers instead of trusting a
                // client-supplied payload, so a signed-in attacker cannot
                // pass `email: 'victim@evil.com'` to overwrite their own
                // Firestore email and then phish via mutual contacts.
                const tokenEmail = (decoded as Record<string, unknown>).email;
                if (typeof tokenEmail === 'string' && tokenEmail.length > 0) {
                    requestHeaders.set('x-user-email', tokenEmail);
                }
                const tokenName = (decoded as Record<string, unknown>).name;
                if (typeof tokenName === 'string' && tokenName.length > 0) {
                    requestHeaders.set('x-user-name', tokenName);
                }
                // Plan from Firebase custom claims — set via Admin SDK when plan changes
                // Falls back to 'free' if claim not yet set (new users, pre-migration users)
                const plan = (decoded as Record<string, unknown>).planType;
                // Normalize legacy values: 'institution' → 'premium'; 'pro'/'gold'/'premium' pass through
                const VALID_PLANS = ['free', 'pro', 'gold', 'premium'];
                const LEGACY: Record<string, string> = { institution: 'premium' };
                const raw = typeof plan === 'string' ? plan : '';
                const resolved = LEGACY[raw] ?? (VALID_PLANS.includes(raw) ? raw : 'free');
                requestHeaders.set('x-user-plan', resolved);
                // Onboarding fast-path: a verified `onboardingCompleted` custom
                // claim lets an already-onboarded user skip the /onboarding gate
                // WITHOUT a profile-complete cookie. The backfill script stamps
                // this claim for every pre-existing user that already scores >=
                // threshold, so re-enabling the gate never re-onboards the base.
                if ((decoded as Record<string, unknown>).onboardingCompleted === true) {
                    requestHeaders.set('x-onboarding-completed', '1');
                }
            } else if (isApiOrAdmin || isPageMutation) {
                // Invalid token on protected routes OR a server-action POST →
                // reject with 401 (not 500). The client SDK can detect this
                // and trigger a login redirect.
                return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
            }
        }
    } else {
        if (isApiOrAdmin || isPageMutation) {
            // No token at all on a protected API/admin route OR a page
            // server-action POST. Reject with 401 instead of letting the
            // action throw "Unauthorized" and surface as a 500.
            if (process.env.NODE_ENV === 'development') {
                requestHeaders.set('x-user-id', 'dev-user-123');
                requestHeaders.set('x-user-plan', 'pro');
                requestHeaders.set('x-user-email', 'dev@sahayakai.local');
                requestHeaders.set('x-user-name', 'Dev User');
            } else {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }
        // Page GETs without a token: pass through, x-user-id simply not set.
        // The page can decide whether to render a public version or redirect.
    }

    // --- Onboarding completion gate (2026-06-06) ---
    // If the user is authenticated and trying to GET a page route that is
    // NOT in the allowlist below, AND we don't have a valid signed
    // profile-completion cookie NOR an `onboardingCompleted` token claim,
    // push them to /onboarding. The completion cookie is issued by POST
    // /api/profile/mark-complete after the server confirms the profile is
    // ≥ 80% complete.
    //
    // We deliberately gate on the cookie/claim rather than a Firestore read
    // so every page request stays cheap.
    //
    // INCIDENT 2026-06-08: shipping this gate cookie-only locked out the
    // ENTIRE existing user base — none of them had the cookie, so every
    // already-onboarded teacher was bounced to /onboarding and could not
    // reach any generation tool. The gate is now DEFAULT-OFF and only runs
    // when ONBOARDING_GATE_ENABLED === 'true'. Re-enable it ONLY after the
    // backfill (scripts/backfill-onboarding-claim.ts) has stamped the
    // `onboardingCompleted` custom claim on every pre-existing complete
    // user, so the claim fast-path (x-onboarding-completed) carries them
    // through without re-onboarding.
    const onboardingGateEnabled = process.env.ONBOARDING_GATE_ENABLED === 'true';
    const isAuthenticatedPageGet =
        onboardingGateEnabled &&
        requestHeaders.has('x-user-id') &&
        requestHeaders.get('x-onboarding-completed') !== '1' &&
        !isApiOrAdmin &&
        request.method === 'GET' &&
        !pathname.startsWith('/__/');
    if (isAuthenticatedPageGet) {
        const onboardingAllowlist = [
            '/onboarding',
            '/login',
            '/signup',
            '/auth',
            '/logout',
            '/privacy',
            '/terms',
            '/sw.js',
            '/manifest',
            '/robots.txt',
            '/sitemap.xml',
        ];
        const inAllowlist = onboardingAllowlist.some(p => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}.`));
        // Also skip public marketing pages (landing) so logged-in users
        // visiting the homepage aren't bounced. The homepage IS the
        // dashboard for authenticated teachers, so it MUST be gated.
        // We allow only the explicit-allowlist set above.
        if (!inAllowlist) {
            const cookieVal = request.cookies.get(PROFILE_COMPLETE_COOKIE)?.value;
            const verifiedUid = await verifyProfileCompleteCookie(cookieVal);
            const sessionUid = requestHeaders.get('x-user-id');
            if (!verifiedUid || verifiedUid !== sessionUid) {
                const redirectUrl = new URL('/onboarding', request.url);
                redirectUrl.searchParams.set('next', pathname);
                return NextResponse.redirect(redirectUrl);
            }
        }
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
