"use client";

import { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { getNotificationsAction } from "@/lib/api/notifications";
import { NotificationFeed } from "@/components/notifications-feed";
import { Bell, Loader2 } from "lucide-react";
import { AuthGate } from "@/components/auth/auth-gate";
import { useLanguage } from "@/context/language-context";

export default function NotificationsPage() {
    const { t } = useLanguage();
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = useCallback(async (uid: string) => {
        try {
            const data = await getNotificationsAction(uid);
            setNotifications(data);
        } catch (error) {
            console.error("[NotificationsPage] Failed to fetch notifications:", error);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setFirebaseUser(user);
                await fetchNotifications(user.uid);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [fetchNotifications]);

    const handleRefresh = useCallback(async () => {
        if (firebaseUser) {
            await fetchNotifications(firebaseUser.uid);
        }
    }, [firebaseUser, fetchNotifications]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-40">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="mt-4 text-muted-foreground">{t("Loading your updates...")}</p>
            </div>
        );
    }

    if (!firebaseUser) {
        return (
            <AuthGate
                icon={Bell}
                title={t("Sign in to see notifications")}
                description={t("Sign in to get notified when a fellow teacher connects, replies, or shares a resource.")}
            >
                {null}
            </AuthGate>
        );
    }

    return (
        <div className="container max-w-4xl mx-auto py-10 px-4 min-h-screen">
            <div className="space-y-8">
                <div className="flex items-center gap-3 border-b pb-6 border-primary/20">
                    <div className="bg-primary/10 p-3 rounded-2xl">
                        <Bell className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">{t("Notifications")}</h1>
                        <p className="text-muted-foreground mt-1">{t("Stay updated with your community activity")}</p>
                    </div>
                </div>

                <NotificationFeed notifications={notifications} userId={firebaseUser.uid} onRefresh={handleRefresh} />
            </div>
        </div>
    );
}
