'use client';

import { useState, useEffect } from 'react';

export function useOnlineStatus(): boolean {
    // Initialize to `true` unconditionally — NOT `navigator.onLine`. Reading
    // navigator during the initial render makes the first client render
    // (which sees a real navigator) diverge from the server render (which
    // defaults to online), producing a React hydration mismatch that throws
    // away and re-renders the whole subtree. Consumers (canUseAI on every
    // GeneratorPage) drive a submit button's `disabled` off this, so the
    // mismatch was systemic. Reconcile to the real value in useEffect, which
    // only runs after hydration.
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        setIsOnline(navigator.onLine);

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
}
