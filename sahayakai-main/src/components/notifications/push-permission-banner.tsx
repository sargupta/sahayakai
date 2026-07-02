'use client';

import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { requestNotificationPermission } from '@/lib/fcm-client';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/language-context';

export function PushPermissionBanner() {
    const { t } = useLanguage();
    const [show, setShow] = useState(false);
    const [enabling, setEnabling] = useState(false);

    useEffect(() => {
        // Only show if notifications are supported but not yet granted
        if (typeof Notification === 'undefined') return;
        if (Notification.permission === 'default') {
            // Check if user previously dismissed (stored in localStorage).
            // localStorage throws in private-mode Safari / restricted WebViews —
            // guard so this globally-mounted banner can't crash the whole app.
            let dismissed: string | null = null;
            try {
                dismissed = localStorage.getItem('push-banner-dismissed');
            } catch { /* localStorage unavailable */ }
            if (!dismissed) setShow(true);
        }
    }, []);

    const handleEnable = async () => {
        setEnabling(true);
        try {
            const token = await requestNotificationPermission();
            if (token) {
                try {
                    await fetch('/api/fcm/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token }),
                    });
                } catch {}
            }
            setShow(false);
        } catch {
            // A rejected permission request must not leave the button stuck on
            // "Enabling…". Reset so the teacher can retry or dismiss.
            setEnabling(false);
        }
    };

    const handleDismiss = () => {
        try {
            localStorage.setItem('push-banner-dismissed', 'true');
        } catch { /* localStorage unavailable */ }
        setShow(false);
    };

    if (!show) return null;

    return (
        <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-100 rounded-xl mx-4 mt-3">
            <Bell className="h-4 w-4 text-orange-500 shrink-0" />
            <p className="text-xs text-foreground font-medium flex-1">
                {t("Enable notifications to never miss a message from fellow teachers.")}
            </p>
            <Button
                size="sm"
                onClick={handleEnable}
                disabled={enabling}
                className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-lg shrink-0"
            >
                {enabling ? 'Enabling...' : 'Enable'}
            </Button>
            <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}
