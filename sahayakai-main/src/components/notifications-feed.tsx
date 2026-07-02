"use client";

import { useEffect, useState } from "react";
import { Notification } from "@/types";
import { markNotificationAsReadAction, markAllAsReadAction } from "@/app/actions/notifications";
import { acceptConnectionRequestAction, declineConnectionRequestAction } from "@/app/actions/connections";
import { formatDistanceToNow, type Locale } from "date-fns";
import { hi, bn, ta, te, kn, gu, enIN } from "date-fns/locale";
import { Bell, CheckCircle2, UserPlus, Trophy, Info, ExternalLink, UserCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/language-context";

// Map the active UI language (full-name union from @/types) to a date-fns
// locale so relative timestamps ("2 days ago") render in the teacher's script
// instead of always English. date-fns 3.6 ships hi/bn/ta/te/kn/gu; Marathi
// (Devanagari) falls back to Hindi, and Punjabi/Malayalam/Odia (no date-fns
// locale yet) fall back to English-India — the best minimal correct fix until
// those locales land upstream.
// Coerce a range of possible createdAt shapes (ISO string, epoch millis,
// Firestore Timestamp {seconds,nanoseconds}, a Timestamp with .toDate(), or a
// real Date) into a valid Date. Returns null when the value can't be parsed so
// callers can render a safe fallback instead of crashing formatDistanceToNow.
function coerceToDate(value: unknown): Date | null {
    if (value == null) return null;
    try {
        if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
        if (typeof value === 'number') {
            const d = new Date(value);
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof value === 'string') {
            const d = new Date(value);
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof value === 'object') {
            const obj = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
            if (typeof obj.toDate === 'function') {
                const d = obj.toDate();
                return d instanceof Date && !isNaN(d.getTime()) ? d : null;
            }
            const secs = typeof obj.seconds === 'number' ? obj.seconds
                : typeof obj._seconds === 'number' ? obj._seconds : undefined;
            if (typeof secs === 'number') {
                const d = new Date(secs * 1000);
                return isNaN(d.getTime()) ? null : d;
            }
        }
    } catch {
        return null;
    }
    return null;
}

const DATE_LOCALE_MAP: Record<string, Locale> = {
    English: enIN,
    Hindi: hi,
    Marathi: hi,
    Bengali: bn,
    Punjabi: enIN,
    Gujarati: gu,
    Odia: enIN,
    Tamil: ta,
    Telugu: te,
    Kannada: kn,
    Malayalam: enIN,
};

interface NotificationFeedProps {
    notifications: Notification[];
    userId: string;
    /**
     * Optional callback the parent page passes to re-fetch the source of
     * truth from Firestore after an action lands. Without this, optimistic
     * removal is the only signal that something happened — refresh wires
     * the feed back up to server state.
     */
    onRefresh?: () => void | Promise<void>;
}

export function NotificationFeed({ notifications: incomingNotifications, userId, onRefresh }: NotificationFeedProps) {
    const router = useRouter();
    const { toast } = useToast();
    const { t, language } = useLanguage();
    const dateLocale = DATE_LOCALE_MAP[language] ?? enIN;
    // Mirror the incoming notifications into local state so we can optimistically
    // remove/update cards immediately after Accept/Decline lands, instead of
    // waiting for the parent re-fetch (which Next.js router.refresh() doesn't
    // re-run for client-only useEffect data).
    const [notifications, setNotifications] = useState<Notification[]>(incomingNotifications);
    // Track per-notification action loading + resolved state
    const [actionState, setActionState] = useState<Record<string, 'loading' | 'accepted' | 'declined'>>({});

    // Re-sync when the parent passes a new list (e.g. on refresh)
    useEffect(() => {
        setNotifications(incomingNotifications);
    }, [incomingNotifications]);

    const triggerRefresh = async () => {
        try {
            if (onRefresh) await onRefresh();
            router.refresh(); // keep server-cached paths fresh too
        } catch (e) {
            console.error('[NotificationFeed] refresh failed', e);
        }
    };

    const handleMarkAsRead = async (id: string) => {
        // Optimistic: flag as read in local state immediately
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
        try {
            await markNotificationAsReadAction(id);
            await triggerRefresh();
        } catch (e) {
            console.error('[NotificationFeed] markAsRead failed', e);
            // Revert
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: false } : n)));
            toast({ title: t('Could not mark as read'), variant: 'destructive' });
        }
    };

    const handleMarkAllAsRead = async () => {
        const prevSnapshot = notifications;
        // Optimistic flip
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        try {
            await markAllAsReadAction(userId);
            await triggerRefresh();
        } catch (e) {
            console.error('[NotificationFeed] markAllAsRead failed', e);
            setNotifications(prevSnapshot);
            toast({ title: t('Could not mark all as read'), variant: 'destructive' });
        }
    };

    const handleAccept = async (notification: Notification) => {
        const requestId = notification.metadata?.requestId;
        if (!requestId) {
            console.warn('[NotificationFeed] Accept clicked but no requestId on notification', notification);
            toast({ title: t('Cannot accept: request reference missing'), variant: 'destructive' });
            return;
        }
        console.log('[NotificationFeed] Accept', { id: notification.id, requestId, from: notification.senderName });
        setActionState((prev) => ({ ...prev, [notification.id]: 'loading' }));
        try {
            await acceptConnectionRequestAction(requestId);
            // Best-effort mark-as-read so the badge count drops too
            try { await markNotificationAsReadAction(notification.id); } catch { /* non-fatal */ }
            setActionState((prev) => ({ ...prev, [notification.id]: 'accepted' }));
            toast({
                title: `${t('Connected with')} ${notification.senderName ?? t('teacher')}`,
                description: t('You can now message them and see their shared resources.'),
            });
            // Keep the "Connected" feedback visible for ~1.5s, then drop the
            // card and re-fetch source of truth. Refresh first so the next
            // render gets the new list, then drop the optimistic entry.
            setTimeout(async () => {
                setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
                await triggerRefresh();
            }, 1500);
        } catch (e) {
            console.error('[NotificationFeed] acceptConnectionRequest failed', e);
            setActionState((prev) => { const s = { ...prev }; delete s[notification.id]; return s; });
            toast({
                title: t('Could not accept request'),
                description: e instanceof Error ? e.message : t('Please try again.'),
                variant: 'destructive',
            });
        }
    };

    const handleDecline = async (notification: Notification) => {
        const requestId = notification.metadata?.requestId;
        if (!requestId) {
            toast({ title: t('Cannot decline: request reference missing'), variant: 'destructive' });
            return;
        }
        console.log('[NotificationFeed] Decline', { id: notification.id, requestId });
        setActionState((prev) => ({ ...prev, [notification.id]: 'loading' }));
        try {
            await declineConnectionRequestAction(requestId);
            try { await markNotificationAsReadAction(notification.id); } catch { /* non-fatal */ }
            setActionState((prev) => ({ ...prev, [notification.id]: 'declined' }));
            toast({ title: t('Request declined') });
            setTimeout(async () => {
                setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
                await triggerRefresh();
            }, 1200);
        } catch (e) {
            console.error('[NotificationFeed] declineConnectionRequest failed', e);
            setActionState((prev) => { const s = { ...prev }; delete s[notification.id]; return s; });
            toast({
                title: t('Could not decline request'),
                description: e instanceof Error ? e.message : t('Please try again.'),
                variant: 'destructive',
            });
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
                    <h3 className="text-xl font-semibold text-foreground">{t("No notifications yet")}</h3>
                    <p className="text-muted-foreground">{t("When you gain followers or earn badges, they'll appear here.")}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("Recent Activity")}</h2>
                <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead} className="text-primary hover:text-primary hover:bg-primary/10">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {t("Mark all as read")}
                </Button>
            </div>

            <div className="space-y-3">
                {notifications.map((notification) => {
                    const aState = actionState[notification.id];
                    const isConnectRequest = notification.type === 'CONNECT_REQUEST';
                    const requestId = notification.metadata?.requestId;
                    // Only show inline actions if there's a requestId and not yet acted upon
                    const showActions = isConnectRequest && !!requestId && !aState;
                    // Build a View destination. Prefer the notification's `link`
                    // (set when the request was created), else fall back to the
                    // sender's public profile. This is what the View button hit
                    // before — but a missing link silently rendered no button.
                    const viewHref = notification.link
                        ?? (notification.senderId ? `/profile/${notification.senderId}` : undefined);

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
                                                {(() => {
                                                    const d = coerceToDate(notification.createdAt);
                                                    if (!d) return '';
                                                    try {
                                                        return formatDistanceToNow(d, { addSuffix: true, locale: dateLocale });
                                                    } catch {
                                                        return '';
                                                    }
                                                })()}
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
                                                            disabled={aState === 'loading'}
                                                            data-testid={`accept-${notification.id}`}
                                                        >
                                                            {t("Accept")}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 text-xs rounded-full px-4 border-border text-muted-foreground hover:text-red-500 hover:border-red-200"
                                                            onClick={() => handleDecline(notification)}
                                                            disabled={aState === 'loading'}
                                                            data-testid={`decline-${notification.id}`}
                                                        >
                                                            {t("Decline")}
                                                        </Button>
                                                    </>
                                                )}

                                                {/* Resolved state feedback */}
                                                {aState === 'loading' && (
                                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/60" />
                                                )}
                                                {aState === 'accepted' && (
                                                    <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                                                        <UserCheck className="h-3.5 w-3.5" /> {t("Connected")}
                                                    </span>
                                                )}
                                                {aState === 'declined' && (
                                                    <span className="text-xs text-muted-foreground/60">{t("Request declined")}</span>
                                                )}

                                                {!notification.isRead && !showActions && (
                                                    <Button size="sm" variant="ghost" onClick={() => handleMarkAsRead(notification.id)} className="h-8 text-xs">
                                                        {t("Mark read")}
                                                    </Button>
                                                )}
                                                {viewHref && (
                                                    <Button size="sm" variant="outline" asChild className="h-8 text-xs border-primary/20 text-primary hover:bg-primary/10">
                                                        <Link href={viewHref} data-testid={`view-${notification.id}`}>
                                                            {t("View")} <ExternalLink className="ml-1 h-3 w-3" />
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
