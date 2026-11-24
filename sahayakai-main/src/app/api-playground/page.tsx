import { notFound } from 'next/navigation';
import ApiPlaygroundClient from './api-playground-client';

// Evaluate the environment per request, not at build time: ALLOW_DEV_SURFACES
// is a runtime switch on the Cloud Run service.
export const dynamic = 'force-dynamic';

/**
 * API playground. Internal developer surface.
 *
 * It lets a visitor fire requests at every documented endpoint, so it is
 * never rendered in production. The middleware already answers 404 for this
 * path (`isInternalDevSurface` in src/lib/access/access-state.ts); this guard
 * is defence in depth in case the page is ever reached without the
 * middleware. A non-production-like deployment can opt in with
 * ALLOW_DEV_SURFACES=true.
 */
export default function ApiPlaygroundPage() {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_SURFACES !== 'true') {
        notFound();
    }
    return <ApiPlaygroundClient />;
}
