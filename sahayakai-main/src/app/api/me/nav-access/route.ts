import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth-utils';
import { isFeatureEnabled, readConfig } from '@/lib/feature-flags';

/** Feature flag that lets beta testers see Labs in the sidebar. */
const LABS_NAV_FLAG = 'labsNav';

/**
 * GET /api/me/nav-access
 *
 * What the signed-in user's sidebar may show beyond the teacher default:
 *   - staff: users/{uid}.role === 'admin' (the same check as the /admin
 *     layout). Staff see Labs and the internal dashboards.
 *   - labs:  staff, or the `labsNav` feature flag is explicitly configured
 *     and on for this user (allowlist / global). Unlike most flags, an
 *     unconfigured `labsNav` means OFF: Labs is hidden from teachers by
 *     decision (26 Oct 2026), and appears only for staff and beta testers.
 *
 * Navigation only: every hidden route keeps its own server-side guard.
 */
export async function GET(req: NextRequest) {
    const uid = req.headers.get('x-user-id');
    if (!uid) return NextResponse.json({ staff: false, labs: false });

    try {
        const [staff, cfg] = await Promise.all([isAdmin(uid), readConfig()]);
        let labs = staff;
        if (!labs && cfg.features?.[LABS_NAV_FLAG]) {
            labs = (await isFeatureEnabled(LABS_NAV_FLAG, uid)).enabled;
        }
        return NextResponse.json({ staff, labs });
    } catch (err) {
        console.error('[nav-access] evaluation failed', err);
        return NextResponse.json({ staff: false, labs: false });
    }
}
