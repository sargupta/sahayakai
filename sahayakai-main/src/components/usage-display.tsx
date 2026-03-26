'use client';

import { useSubscription } from '@/hooks/use-subscription';
import { Gauge } from 'lucide-react';
import Link from 'next/link';
import {
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';

/**
 * Sidebar nav item for the Usage page.
 * Shows a subtle badge when any feature is above 70% usage.
 */
export function UsageDisplay() {
    const { usage, loading, isPro } = useSubscription();
    const { setOpenMobile } = useSidebar();
    const pathname = usePathname();

    if (loading) return null;

    // Check if any feature is nearing its limit
    let nearLimit = false;
    let atLimit = false;
    for (const info of Object.values(usage)) {
        if (info.limit <= 0) continue;
        const pct = Math.round((info.used / info.limit) * 100);
        if (pct >= 90) atLimit = true;
        if (pct >= 70) nearLimit = true;
    }

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                isActive={pathname === '/usage'}
                tooltip="Usage"
            >
                <Link href="/usage" onClick={() => setOpenMobile(false)} className="flex items-center justify-between w-full">
                    <span className="flex items-center gap-2">
                        <Gauge />
                        <span>Usage</span>
                    </span>
                    {atLimit && (
                        <span className="ml-auto h-2 w-2 rounded-full bg-red-500" />
                    )}
                    {!atLimit && nearLimit && (
                        <span className="ml-auto h-2 w-2 rounded-full bg-amber-500" />
                    )}
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}
