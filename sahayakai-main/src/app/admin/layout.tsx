import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth-utils';
import { AdminSecureSessionLabel } from './admin-secure-session-label';

interface AdminLayoutProps {
    children: React.ReactNode;
}

/**
 * Server-side guard for the entire /admin path.
 * This ensures that the page contents are never even sent to the browser
 * if the user is not an authorized administrator.
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
    const headersList = await headers();
    // The middleware injects this header if the user is logged in
    const userId = headersList.get('x-user-id');

    // 1. Check if user is logged in
    if (!userId) {
        redirect('/');
    }

    // 2. Verify Admin Status
    // The dev bypass is gated ONLY on an explicit opt-in flag (ALLOW_DEV_ADMIN)
    // AND the known mock dev uid — never on NODE_ENV. This prevents a non-prod
    // build (staging/preview) from rendering the admin dashboard to any signed-in
    // user. When the flag is set for the mock uid, we skip the DB check to avoid
    // hangs from local GCP auth/Secret Manager issues.
    const devBypass =
        process.env.ALLOW_DEV_ADMIN === 'true' && userId === 'dev-user-123';

    let authorized = false;
    if (!devBypass) {
        try {
            authorized = await isAdmin(userId);
        } catch (e) {
            console.error("[AdminLayout] Auth check failed:", e);
        }
    }

    // 3. Application Security Guard
    // Render the admin surface ONLY to real admins or the explicit dev bypass.
    if (!authorized && !devBypass) {
        redirect('/');
    }

    // 4. Render the Dashboard
    return (
        <div className="min-h-screen bg-slate-50/50">
            {/* Admin-only Header */}
            <div className="bg-slate-900 px-6 py-3 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <AdminSecureSessionLabel className="text-white text-xs font-bold tracking-widest uppercase" />
                    {devBypass && (
                        <span className="ml-2 text-amber-400 text-[10px] font-bold border border-amber-400/30 px-1 rounded">DEV BYPASS</span>
                    )}
                </div>
                <div className="text-slate-400 text-[10px] font-mono">
                    UID: {userId?.substring(0, 8)}...
                </div>
            </div>

            <main className="pb-20">
                {children}
            </main>
        </div>
    );
}
