"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { getPerformanceMonitor } from "@/lib/performance-monitor";
import { initAnalytics } from "@/lib/analytics-events";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        // 1. Initialize Performance Monitoring (Web Vitals, Resource Load)
        // This runs once on mount
        getPerformanceMonitor();

        // 2. Initialize User Analytics when user is available
        if (user) {
            initAnalytics(user.uid);
        }
    }, [user]);

    return <>{children}</>;
}
