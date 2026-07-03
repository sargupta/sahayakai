"use client";

/**
 * BlockedUsersCard — moderation v1.
 *
 * Owner-only management list rendered on /my-profile (profile-view own
 * profile sidebar). Lists users the caller has blocked with an Unblock
 * action. Fetches via GET /api/moderation/blocks.
 */
import { useEffect, useState, useCallback } from "react";
import { Ban, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language-context";
import {
    listBlockedUsersAction,
    unblockUserAction,
    type BlockedUser,
} from "@/lib/api/moderation";

export function BlockedUsersCard() {
    const { t } = useLanguage();
    const { toast } = useToast();
    const [blocks, setBlocks] = useState<BlockedUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyUid, setBusyUid] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setBlocks(await listBlockedUsersAction());
        } catch {
            // Non-critical management surface — fail quiet, keep empty state.
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleUnblock = async (uid: string) => {
        setBusyUid(uid);
        try {
            await unblockUserAction(uid);
            setBlocks((prev) => prev.filter((b) => b.blockedUid !== uid));
            toast({ title: t("User unblocked") });
        } catch {
            toast({
                title: t("Could not complete this action. Please try again."),
                variant: "destructive",
            });
        } finally {
            setBusyUid(null);
        }
    };

    return (
        <Card className="bg-card border-border shadow-soft rounded-md overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-border">
                <CardTitle className="flex items-center gap-2 type-h3 text-foreground">
                    <Ban className="h-5 w-5 text-muted-foreground" />
                    {t("Blocked users")}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
                {loading ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
                    </div>
                ) : blocks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("You have not blocked anyone.")}</p>
                ) : (
                    <div className="space-y-3">
                        {blocks.map((b) => (
                            <div key={b.blockedUid} className="flex items-center gap-3">
                                <Avatar className="h-8 w-8 ring-1 ring-border shrink-0">
                                    <AvatarImage src={b.photoURL ?? undefined} referrerPolicy="no-referrer" />
                                    <AvatarFallback className="text-xs font-bold bg-muted text-muted-foreground">
                                        {(b.displayName?.[0] ?? "T").toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="flex-1 min-w-0 truncate text-sm font-medium text-foreground">
                                    {b.displayName}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={busyUid === b.blockedUid}
                                    onClick={() => handleUnblock(b.blockedUid)}
                                    className="rounded-md h-8 px-3 text-xs font-semibold"
                                >
                                    {busyUid === b.blockedUid
                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        : t("Unblock")}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
