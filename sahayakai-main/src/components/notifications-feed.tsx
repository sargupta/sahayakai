"use client";

import { Notification } from "@/types";
import { markNotificationAsReadAction, markAllAsReadAction } from "@/app/actions/notifications";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCircle2, UserPlus, Trophy, Info, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface NotificationFeedProps {
    notifications: Notification[];
    userId: string;
}

export function NotificationFeed({ notifications, userId }: NotificationFeedProps) {
    const router = useRouter();

    const handleMarkAsRead = async (id: string) => {
        await markNotificationAsReadAction(id);
        router.refresh();
    };

    const handleMarkAllAsRead = async () => {
        await markAllAsReadAction(userId);
        router.refresh();
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'FOLLOW': return <UserPlus className="h-5 w-5 text-blue-500" />;
            case 'BADGE_EARNED': return <Trophy className="h-5 w-5 text-amber-500" />;
            case 'NEW_POST': return <Bell className="h-5 w-5 text-green-500" />;
            default: return <Info className="h-5 w-5 text-gray-500" />;
        }
    };

    if (notifications.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <Bell className="h-12 w-12 text-gray-300" />
                <div>
                    <h3 className="text-xl font-semibold text-gray-900">No notifications yet</h3>
                    <p className="text-gray-500">When you gain followers or earn badges, they'll appear here.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Recent Activity</h2>
                <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead} className="text-orange-600 hover:text-orange-700 hover:bg-orange-50">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark all as read
                </Button>
            </div>

            <div className="space-y-3">
                {notifications.map((notification) => (
                    <Card key={notification.id} className={`border-l-4 ${notification.isRead ? 'border-l-transparent' : 'border-l-orange-500'} transition-all hover:shadow-md`}>
                        <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                                <div className="mt-1">
                                    {getIcon(notification.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className={`font-semibold text-gray-900 ${notification.isRead ? 'opacity-70' : ''}`}>
                                            {notification.title}
                                        </h3>
                                        <span className="text-xs text-gray-400 whitespace-nowrap">
                                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                        </span>
                                    </div>
                                    <p className={`text-sm text-gray-600 mt-1 ${notification.isRead ? 'opacity-70' : ''}`}>
                                        {notification.message}
                                    </p>

                                    <div className="mt-3 flex items-center justify-between">
                                        {notification.senderId && (
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-6 w-6">
                                                    <AvatarImage src={notification.senderPhotoURL} />
                                                    <AvatarFallback>{notification.senderName?.[0] || 'T'}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-xs font-medium text-gray-700">{notification.senderName}</span>
                                            </div>
                                        )}
                                        <div className="flex gap-2">
                                            {!notification.isRead && (
                                                <Button size="sm" variant="ghost" onClick={() => handleMarkAsRead(notification.id)} className="h-8 text-xs">
                                                    Mark read
                                                </Button>
                                            )}
                                            {notification.link && (
                                                <Button size="sm" variant="outline" asChild className="h-8 text-xs border-orange-200 text-orange-700 hover:bg-orange-50">
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
                ))}
            </div>
        </div>
    );
}
