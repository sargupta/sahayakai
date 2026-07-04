"use client";

/**
 * ModerationMenu — moderation v1.
 *
 * Reusable Block / Report overflow menu dropped into profile headers,
 * conversation headers, and post/resource cards. Hides itself when the
 * target is the signed-in user (or nobody is signed in), so call sites
 * can render it unconditionally.
 */
import { useState } from "react";
import { MoreVertical, Ban, Flag } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { BlockUserDialog } from "./block-user-dialog";
import { ReportDialog } from "./report-dialog";
import type { ReportTargetType } from "@/lib/api/moderation";

interface ModerationMenuProps {
    /** The uid being blocked (author / profile owner / other DM participant). */
    targetUid: string;
    targetName?: string;
    /** What the Report action files against. */
    reportTargetType: ReportTargetType;
    reportTargetId: string;
    /** Called after a successful block (navigate away, refresh list, …). */
    onBlocked?: () => void;
    className?: string;
}

export function ModerationMenu({
    targetUid,
    targetName,
    reportTargetType,
    reportTargetId,
    onBlocked,
    className,
}: ModerationMenuProps) {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [blockOpen, setBlockOpen] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);

    // Never offer Block/Report against yourself or when signed out.
    if (!user || !targetUid || user.uid === targetUid) return null;

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground shrink-0", className)}
                        aria-label={t("More options")}
                        title={t("More options")}
                    >
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl border-border shadow-elevated">
                    <DropdownMenuItem
                        onClick={() => setReportOpen(true)}
                        className="gap-2 cursor-pointer"
                    >
                        <Flag className="h-4 w-4 text-muted-foreground" />
                        {t("Report")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => setBlockOpen(true)}
                        className="gap-2 cursor-pointer text-red-600 focus:text-red-600"
                    >
                        <Ban className="h-4 w-4" />
                        {t("Block")}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <BlockUserDialog
                open={blockOpen}
                onOpenChange={setBlockOpen}
                targetUid={targetUid}
                targetName={targetName}
                onBlocked={onBlocked}
            />
            <ReportDialog
                open={reportOpen}
                onOpenChange={setReportOpen}
                targetType={reportTargetType}
                targetId={reportTargetId}
            />
        </>
    );
}
