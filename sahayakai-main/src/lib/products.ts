/**
 * Two products, one codebase: SahayakAI (the teacher's workspace) and
 * SamparkAI (school-to-parent communication).
 *
 * Routing model (docs/products/SAMPARK_SUBDOMAIN.md):
 *   - SamparkAI lives under the `/sampark` route tree:
 *       /sampark              public website
 *       /sampark/workspace    the signed-in entry (pick a school)
 *       /sampark/[orgId]/...  one school's workspace
 *   - On a SamparkAI host (e.g. sampark.sahayakai.com, sampark.localhost) the
 *     middleware rewrites `/x` to `/sampark/x`, so the public URL has no
 *     prefix. Links inside SamparkAI go through `useSamparkHref()` (see
 *     components/shell/product-paths.ts), which emits prefixed or
 *     unprefixed paths to match the URL the visitor is on.
 *   - Links between the products use the configured origins below. With no
 *     origins configured (local dev, one Cloud Run service) both products are
 *     served from the same origin and links stay relative.
 *
 * Nothing here is a secret: NEXT_PUBLIC_* values are inlined into the
 * browser bundle at build time.
 */

export const SAMPARK_PREFIX = '/sampark';

/** Route segments under /sampark that are not an orgId. */
export const SAMPARK_RESERVED_SEGMENTS = ['workspace', 'demo'] as const;

/**
 * First path segments that belong to SahayakAI. On a SamparkAI host these are
 * not rewritten into the /sampark tree (where they would be read as an
 * orgId); the middleware sends them to the SahayakAI origin instead. A test
 * (src/__tests__/lib/products.test.ts) fails when a new top-level route in
 * src/app is missing here, so the two products can never swallow each
 * other's pages. These names are therefore also reserved as orgIds.
 */
export const SAHAYAK_ROUTE_SEGMENTS = [
    // src/app
    'admin', 'api-docs', 'api-playground', 'assess-assignment', 'assessment-scanner', 'attendance',
    'community', 'community-library', 'content-creator', 'exam-paper', 'impact-dashboard',
    'instant-answer', 'labs', 'lesson-plan', 'messages', 'my-library', 'my-profile', 'notifications',
    'onboarding', 'organization', 'pricing', 'privacy-for-teachers', 'profile', 'quiz-generator',
    'review-panel', 'rubric-generator', 'settings', 'submit-content', 'teacher-training', 'try-call',
    'usage', 'video-storyteller', 'virtual-field-trip', 'visual-aid-designer', 'worksheet-wizard',
    // src/app/(marketing)
    'about', 'blog', 'bn', 'for-schools', 'kn', 'school-pricing', 'ta', 'terms',
] as const;

/**
 * On a SamparkAI host, `/to-sahayak/x` redirects to SahayakAI's `/x`. It lets
 * SamparkAI link to SahayakAI's home ("/") without knowing the origin.
 */
export const SAHAYAK_BRIDGE_PREFIX = '/to-sahayak';

/**
 * The SahayakAI origin as seen from a SamparkAI host: SAHAYAK_URL /
 * NEXT_PUBLIC_SAHAYAK_URL when set, otherwise the same host without its
 * "sampark." label (sampark.sahayakai.com → sahayakai.com, which the
 * middleware's apex rule then sends to www; sampark.localhost:3000 →
 * localhost:3000).
 */
export function sahayakOriginFor(host: string, protocol: string, env: Record<string, string | undefined> = process.env): string {
    const configured = env.SAHAYAK_URL || env.NEXT_PUBLIC_SAHAYAK_URL;
    if (configured) return stripTrailingSlash(configured);
    const bare = host.toLowerCase().startsWith('sampark.') ? host.slice('sampark.'.length) : host;
    return `${protocol}//${bare}`;
}

/** True when `pathname` is a SahayakAI page (first segment in SAHAYAK_ROUTE_SEGMENTS). */
export function isSahayakRoute(pathname: string): boolean {
    const first = pathname.split('/')[1] ?? '';
    return (SAHAYAK_ROUTE_SEGMENTS as readonly string[]).includes(first);
}

/** Default hosts that serve SamparkAI. Overridden by SAMPARK_HOSTS. */
const DEFAULT_SAMPARK_HOSTS = ['sampark.sahayakai.com', 'sampark.localhost'];

function stripTrailingSlash(url: string): string {
    return url.endsWith('/') ? url.slice(0, -1) : url;
}

/** Hostnames (no port) that serve SamparkAI. Server-side only (middleware). */
export function samparkHosts(env: Record<string, string | undefined> = process.env): string[] {
    const raw = env.SAMPARK_HOSTS;
    if (!raw) return DEFAULT_SAMPARK_HOSTS;
    return raw
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
}

/** True when the request's Host header names a SamparkAI host. Port is ignored. */
export function isSamparkHost(host: string | null | undefined, hosts: string[] = samparkHosts()): boolean {
    if (!host) return false;
    const name = host.toLowerCase().split(':')[0];
    return hosts.includes(name);
}

/**
 * Origin that serves SamparkAI, e.g. "https://sampark.sahayakai.com".
 * Empty when SamparkAI shares the current origin under /sampark.
 */
export function samparkOrigin(): string {
    return stripTrailingSlash(process.env.NEXT_PUBLIC_SAMPARK_URL ?? '');
}

/** Origin that serves SahayakAI, e.g. "https://www.sahayakai.com". Empty = same origin. */
export function sahayakOrigin(): string {
    return stripTrailingSlash(process.env.NEXT_PUBLIC_SAHAYAK_URL ?? '');
}

/**
 * URL of a SamparkAI page from outside SamparkAI (the SahayakAI sidebar,
 * marketing pages). `path` is SamparkAI-relative: "/" or "/workspace".
 */
export function samparkUrl(path: string = '/'): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    const origin = samparkOrigin();
    if (origin) return `${origin}${p === '/' ? '' : p}` || '/';
    return p === '/' ? SAMPARK_PREFIX : `${SAMPARK_PREFIX}${p}`;
}

/**
 * Where SahayakAI's "SamparkAI" entry opens: the signed-in school workspace,
 * or — on a demo deployment (NEXT_PUBLIC_SAMPARK_DEMO_ENABLED=true, set beside
 * the server flag SAMPARK_DEMO_ENABLED) — the demo school. The public flag only
 * picks the link; the demo pages and APIs are still gated on the server flag.
 */
export function samparkEntryPath(env: Record<string, string | undefined> = { NEXT_PUBLIC_SAMPARK_DEMO_ENABLED: process.env.NEXT_PUBLIC_SAMPARK_DEMO_ENABLED }): string {
    return env.NEXT_PUBLIC_SAMPARK_DEMO_ENABLED === 'true' ? '/demo' : '/workspace';
}

/** URL of a SahayakAI page from inside SamparkAI. */
export function sahayakUrl(path: string = '/'): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    const origin = sahayakOrigin();
    return origin ? `${origin}${p}` : p;
}

/**
 * True when a link leaves this app's client router: another origin, or the
 * /to-sahayak bridge (a server redirect). Render <a>, not next/link.
 */
export function isExternalUrl(href: string): boolean {
    return /^https?:\/\//i.test(href) || href === SAHAYAK_BRIDGE_PREFIX || href.startsWith(`${SAHAYAK_BRIDGE_PREFIX}/`);
}
