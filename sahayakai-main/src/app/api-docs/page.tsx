import { notFound } from 'next/navigation';
import ApiDocsClient from './api-docs-client';

// Evaluate the environment per request, not at build time: ALLOW_DEV_SURFACES
// is a runtime switch on the Cloud Run service.
export const dynamic = 'force-dynamic';

/**
 * Interactive API documentation. Internal developer surface.
 *
 * It lists every route and request shape, so it is never rendered in
 * production. The middleware already answers 404 for this path
 * (`isInternalDevSurface` in src/lib/access/access-state.ts); this guard is
 * defence in depth in case the page is ever reached without the middleware.
 * A non-production-like deployment can opt in with ALLOW_DEV_SURFACES=true.
 */
export default function ApiDocsPage() {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_SURFACES !== 'true') {
        notFound();
    }
    return <ApiDocsClient />;
}
