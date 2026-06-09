# Lib: Auth Middleware

**File:** `src/middleware.ts`

---

## What It Does

1. Verifies Firebase ID token on every request
2. Injects `x-user-id` header into request (for server actions)
3. Applies security headers
4. Rate limiting (IP-based)

---

## Token Resolution Priority

```
1. Authorization: Bearer {token}  (API calls from client code)
2. auth-token cookie             (page navigations, SSR)
3. Neither → x-user-id not set (unauthenticated request)
```

---

## Token Verification

```ts
// Fetches Google public certs with 5-hour cache
const certsCacheKey = 'google-certs';
let certsCache: { certs: object, expiry: number } | null = null;

async function verifyFirebaseToken(token: string): Promise<string | null> {
  // Get Google public certs (cached 5 hours)
  const certs = await getGoogleCerts();

  // Verify JWT signature + expiry using jose library
  const { payload } = await jwtVerify(token, createPublicKey(certs[kid]));

  return payload.user_id || payload.sub;
}
```

5-hour cache avoids fetching Google certs on every request (saves 50–200ms per request).

---

## Dev Bypass

```ts
if (process.env.NODE_ENV === 'development' && token === 'dev-token') {
  request.headers.set('x-user-id', 'dev-user-123');
}
```

Allows local development without a real Firebase token.

---

## Public Routes (skip auth)

These routes bypass token verification entirely:
- `/api/health`
- `/api/analytics/*`
- `/api/auth/*`
- `/api/metrics`
- `/monitoring` (Sentry tunnel)

---

## Security Headers Applied

Every response gets:
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: [nonce-based CSP]
```

---

## Matcher Config

```ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

Runs on every route except static assets and favicon.

---

## x-user-id in Server Actions

Every server action that needs auth identity:
```ts
const { headers } = await import('next/headers');
const h = await headers();
const userId = h.get('x-user-id');
if (!userId) throw new Error('Unauthorized');
```

**Never** trust client-supplied userId. Always read from this header.
