import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth-utils';

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

    // 2. Verify Admin Status in Firestore
    const authorized = await isAdmin(userId);

    // In development, we allow access to set up the dashboard (bypass),
    // but in production, we strictly redirect unauthorized users to the homepage.
    if (!authorized && process.env.NODE_ENV === 'production') {
        redirect('/');
    }

    // 3. Render the Dashboard
    return (
        <div className="min-h-screen bg-slate-50/50">
            {/* Admin-only Header */}
            <div className="bg-slate-900 px-6 py-3 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-white text-xs font-bold tracking-widest uppercase">Admin Secure Session</span>
                    {process.env.NODE_ENV === 'development' && !authorized && (
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
