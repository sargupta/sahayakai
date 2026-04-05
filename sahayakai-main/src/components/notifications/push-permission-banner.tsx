'use client';

import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { requestNotificationPermission } from '@/lib/fcm-client';
import { Button } from '@/components/ui/button';

export function PushPermissionBanner() {
    const [show, setShow] = useState(false);
    const [enabling, setEnabling] = useState(false);

    useEffect(() => {
        // Only show if notifications are supported but not yet granted
        if (typeof Notification === 'undefined') return;
        if (Notification.permission === 'default') {
            // Check if user previously dismissed (stored in localStorage)
            const dismissed = localStorage.getItem('push-banner-dismissed');
            if (!dismissed) setShow(true);
        }
    }, []);

    const handleEnable = async () => {
        setEnabling(true);
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
    };

    const handleDismiss = () => {
        localStorage.setItem('push-banner-dismissed', 'true');
        setShow(false);
    };

    if (!show) return null;

    return (
        <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-100 rounded-xl mx-4 mt-3">
            <Bell className="h-4 w-4 text-orange-500 shrink-0" />
            <p className="text-xs text-slate-700 font-medium flex-1">
                Enable notifications to never miss a message from fellow teachers.
            </p>
            <Button
                size="sm"
                onClick={handleEnable}
                disabled={enabling}
                className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-lg shrink-0"
            >
                {enabling ? 'Enabling...' : 'Enable'}
            </Button>
            <button onClick={handleDismiss} className="text-slate-400 hover:text-slate-600 shrink-0">
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}
