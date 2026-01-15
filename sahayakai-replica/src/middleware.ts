import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

    // Clone the request headers and set the nonce (if we use CSP later)
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);

    // Create the response
    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });

    // -----------------------------------------------------------------------------
    // SECURITY HEADERS
    // -----------------------------------------------------------------------------

    // Prevent the site from being embedded in an iframe (Clickjacking protection)
    response.headers.set('X-Frame-Options', 'DENY');

    // Prevent browser from MIME-sniffing a response away from the declared content-type
    response.headers.set('X-Content-Type-Options', 'nosniff');

    // Control how much referrer information is sent with requests
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy: Control access to browser features
    // We explicitly ALLOW microphone because we use it for voice input.
    // We DENY camera and geolocation by default to reduce attack surface.
    response.headers.set(
        'Permissions-Policy',
        'camera=(), microphone=(self), geolocation=(), payment=()'
    );

    // Strict Transport Security (HSTS) - Force HTTPS
    // Include subdomains, max-age 2 years
    if (process.env.NODE_ENV === 'production') {
        response.headers.set(
            'Strict-Transport-Security',
            'max-age=63072000; includeSubDomains; preload'
        );
    }

    return response;
}

// Config to match all paths except static files and images
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes) -> We actually WANT middleware on API for headers
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
