"use client";

/**
 * BlockUserDialog — moderation v1.
 *
 * Confirmation dialog that explains exactly what blocking does before the
 * action lands (dignity-first: the blocked teacher is never notified).
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language-context";
import { blockUserAction } from "@/lib/api/moderation";

interface BlockUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    targetUid: string;
    targetName?: string;
    /** Called after a successful block (e.g. navigate away / refresh feed). */
    onBlocked?: () => void;
}

export function BlockUserDialog({ open, onOpenChange, targetUid, targetName, onBlocked }: BlockUserDialogProps) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const [submitting, setSubmitting] = useState(false);

    const handleBlock = async () => {
        setSubmitting(true);
        try {
            await blockUserAction(targetUid);
            toast({ title: t("User blocked") });
            onOpenChange(false);
            onBlocked?.();
        } catch (err: any) {
            toast({
                title: t("Could not complete this action. Please try again."),
                description: typeof err?.message === "string" ? err.message : undefined,
                variant: "destructive",
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="sm:max-w-[440px] rounded-md border border-border shadow-elevated">
                <AlertDialogHeader>
                    <AlertDialogTitle className="type-h3">
                        {t("Block this teacher?")}
                        {targetName ? ` (${targetName})` : ""}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground leading-relaxed">
                        {t("They will not be able to message you, and you will not see their posts or shared resources. They will not be notified.")}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2 sm:gap-0">
                    <AlertDialogCancel className="rounded-md font-semibold" disabled={submitting}>
                        {t("Cancel")}
                    </AlertDialogCancel>
                    <Button
                        variant="destructive"
                        onClick={handleBlock}
                        disabled={submitting}
                        className="rounded-md font-semibold px-6"
                    >
                        {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        {t("Block")}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
