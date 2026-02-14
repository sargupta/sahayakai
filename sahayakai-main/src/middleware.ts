import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify, importX509 } from 'jose';

// Firebase Project ID
const PROJECT_ID = 'sahayakai-b4248';
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

async function verifyIdToken(token: string) {
    try {
        // 1. Fetch Google's public keys
        console.log('[MIDDLEWARE] fetching google certs...');
        const res = await fetch(GOOGLE_CERTS_URL);
        console.log('[MIDDLEWARE] certs fetched mask status:', res.status);
        const certs = await res.json();

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
    console.log(`[MIDDLEWARE] incoming request: ${pathname}`);

    // Skip verification for static files and specific public APIs
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api/health') ||
        pathname.startsWith('/api-docs') ||
        pathname.startsWith('/api/teacher-activity') ||
        pathname === '/favicon.ico'
    ) {
        return NextResponse.next();
    }

    // Only apply logic to API routes
    if (pathname.startsWith('/api/')) {
        const authHeader = request.headers.get('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const decoded = await verifyIdToken(token);

        if (!decoded || !decoded.sub) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        // Inject the verified user ID into headers for the API route
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-user-id', decoded.sub);

        return NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });
    }

    // Standard non-API security headers logic
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);

    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });

    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=()');

    if (process.env.NODE_ENV === 'production') {
        response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }

    return response;
}

// Config to match only API paths for security headers and auth
export const config = {
    matcher: [
        '/api/:path*',
    ],
};
