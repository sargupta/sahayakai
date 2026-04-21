"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { getNotificationsAction } from "@/app/actions/notifications";
import { NotificationFeed } from "@/components/notifications-feed";
import { Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotificationsPage() {
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setFirebaseUser(user);
                try {
                    const data = await getNotificationsAction(user.uid);
                    setNotifications(data);
                } catch (error) {
                    console.error("Failed to fetch notifications:", error);
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-40">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="mt-4 text-muted-foreground">Loading your updates...</p>
            </div>
        );
    }

    if (!firebaseUser) {
        return (
            <div className="w-full max-w-md mx-auto px-4 py-20 text-center space-y-6">
                <div className="bg-primary/8 p-6 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                    <Bell className="h-10 w-10 text-primary" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold">Sign-in Required</h1>
                    <p className="text-muted-foreground">Please sign in to view your notifications.</p>
                </div>
                <Button
                    onClick={async () => {
                        const provider = new GoogleAuthProvider();
                        provider.setCustomParameters({ prompt: 'select_account' });
                        try {
                            await signInWithPopup(auth, provider);
                        } catch (err) {
                            console.error('Sign-in failed:', err);
                        }
                    }}
                    className="w-full"
                >
                    Sign in with Google
                </Button>
            </div>
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
                        <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">Notifications</h1>
                        <p className="text-muted-foreground mt-1">Stay updated with your community activity</p>
                    </div>
                </div>

                <NotificationFeed notifications={notifications} userId={firebaseUser.uid} />
            </div>
        </div>
    );
}
