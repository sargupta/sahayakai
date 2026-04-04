"use client";

import { useState } from "react";
import { Notification } from "@/types";
import { markNotificationAsReadAction, markAllAsReadAction } from "@/app/actions/notifications";
import { acceptConnectionRequestAction, declineConnectionRequestAction } from "@/app/actions/connections";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCircle2, UserPlus, Trophy, Info, ExternalLink, UserCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface NotificationFeedProps {
    notifications: Notification[];
    userId: string;
}

export function NotificationFeed({ notifications, userId }: NotificationFeedProps) {
    const router = useRouter();
    // Track per-notification action loading + resolved state
    const [actionState, setActionState] = useState<Record<string, 'loading' | 'accepted' | 'declined'>>({});

    const handleMarkAsRead = async (id: string) => {
        await markNotificationAsReadAction(id);
        router.refresh();
    };

    const handleMarkAllAsRead = async () => {
        await markAllAsReadAction(userId);
        router.refresh();
    };

    const handleAccept = async (notification: Notification) => {
        const requestId = notification.metadata?.requestId;
        if (!requestId) return;
        setActionState((prev) => ({ ...prev, [notification.id]: 'loading' }));
        try {
            await acceptConnectionRequestAction(requestId);
            await markNotificationAsReadAction(notification.id);
            setActionState((prev) => ({ ...prev, [notification.id]: 'accepted' }));
            router.refresh();
        } catch {
            setActionState((prev) => { const s = { ...prev }; delete s[notification.id]; return s; });
        }
    };

    const handleDecline = async (notification: Notification) => {
        const requestId = notification.metadata?.requestId;
        if (!requestId) return;
        setActionState((prev) => ({ ...prev, [notification.id]: 'loading' }));
        try {
            await declineConnectionRequestAction(requestId);
            await markNotificationAsReadAction(notification.id);
            setActionState((prev) => ({ ...prev, [notification.id]: 'declined' }));
            router.refresh();
        } catch {
            setActionState((prev) => { const s = { ...prev }; delete s[notification.id]; return s; });
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'FOLLOW': return <UserPlus className="h-5 w-5 text-blue-500" />;
            case 'BADGE_EARNED': return <Trophy className="h-5 w-5 text-amber-500" />;
            case 'NEW_POST': return <Bell className="h-5 w-5 text-green-500" />;
            case 'CONNECT_REQUEST': return <UserPlus className="h-5 w-5 text-primary" />;
            case 'CONNECT_ACCEPTED': return <UserCheck className="h-5 w-5 text-emerald-500" />;
            default: return <Info className="h-5 w-5 text-muted-foreground" />;
        }
    };

    if (notifications.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <Bell className="h-12 w-12 text-muted-foreground/60" />
                <div>
                    <h3 className="text-xl font-semibold text-foreground">No notifications yet</h3>
                    <p className="text-muted-foreground">When you gain followers or earn badges, they'll appear here.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recent Activity</h2>
                <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead} className="text-primary hover:text-primary hover:bg-primary/10">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark all as read
                </Button>
            </div>

            <div className="space-y-3">
                {notifications.map((notification) => {
                    const aState = actionState[notification.id];
                    const isConnectRequest = notification.type === 'CONNECT_REQUEST';
                    const requestId = notification.metadata?.requestId;
                    // Only show inline actions if there's a requestId and not yet acted upon
                    const showActions = isConnectRequest && !!requestId && !aState;

                    return (
                        <Card key={notification.id} className={`border-l-4 ${notification.isRead ? 'border-l-transparent' : 'border-l-primary'} transition-all hover:shadow-elevated shadow-soft rounded-xl`}>
                            <CardContent className="p-4">
                                <div className="flex items-start gap-4">
                                    <div className="mt-1">
                                        {getIcon(notification.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <h3 className={`font-semibold text-foreground ${notification.isRead ? 'opacity-70' : ''}`}>
                                                {notification.title}
                                            </h3>
                                            <span className="text-xs text-muted-foreground/60 whitespace-nowrap">
                                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                            </span>
                                        </div>
                                        <p className={`text-sm text-muted-foreground mt-1 ${notification.isRead ? 'opacity-70' : ''}`}>
                                            {notification.message}
                                        </p>

                                        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                                            {notification.senderId && (
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage src={notification.senderPhotoURL} />
                                                        <AvatarFallback>{notification.senderName?.[0] || 'T'}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-xs font-medium text-muted-foreground">{notification.senderName}</span>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2">
                                                {/* Inline accept/decline for pending connection requests */}
                                                {showActions && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            className="h-8 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-4"
                                                            onClick={() => handleAccept(notification)}
                                                        >
                                                            Accept
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 text-xs rounded-full px-4 border-border text-muted-foreground hover:text-red-500 hover:border-red-200"
                                                            onClick={() => handleDecline(notification)}
                                                        >
                                                            Decline
                                                        </Button>
                                                    </>
                                                )}

                                                {/* Resolved state feedback */}
                                                {aState === 'loading' && (
                                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/60" />
                                                )}
                                                {aState === 'accepted' && (
                                                    <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                                                        <UserCheck className="h-3.5 w-3.5" /> Connected
                                                    </span>
                                                )}
                                                {aState === 'declined' && (
                                                    <span className="text-xs text-muted-foreground/60">Request declined</span>
                                                )}

                                                {!notification.isRead && !showActions && (
                                                    <Button size="sm" variant="ghost" onClick={() => handleMarkAsRead(notification.id)} className="h-8 text-xs">
                                                        Mark read
                                                    </Button>
                                                )}
                                                {notification.link && (
                                                    <Button size="sm" variant="outline" asChild className="h-8 text-xs border-primary/20 text-primary hover:bg-primary/10">
                                                        <Link href={notification.link}>
                                                            View <ExternalLink className="ml-1 h-3 w-3" />
                                                        </Link>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
