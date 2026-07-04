"use client";

import { useRef, useState } from "react";
import { Share2, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { shareLatestContentAction } from "@/lib/api/community";
import { useLanguage } from "@/context/language-context";
import type { ContentType } from "@/types";

interface QuickShareButtonProps {
    /** The content type to share. Must match the `type` used when saving. */
    contentType: ContentType;
    /**
     * The display's existing save handler. The share action publishes the
     * user's most recently saved content of `contentType`, so we run the save
     * first to guarantee the freshly-generated (and possibly edited) content
     * is persisted before we publish it.
     */
    onSave?: () => Promise<void> | void;
    /**
     * Render style. `icon` = compact icon-only button paired with Save/Copy in
     * a ResultShell action row; `button` = labelled outline button.
     */
    variant?: "icon" | "button";
    className?: string;
}

/**
 * Compact "Share" button for AI output cards.
 *
 * Reuses the same backend the full ShareToCommunityCTA uses
 * (`shareLatestContentAction`). It saves the current content first (via the
 * display's existing save handler) and then publishes the latest content of
 * the given type to the Community Library, where connected teachers find it.
 */
export function QuickShareButton({
    contentType,
    onSave,
    variant = "icon",
    className,
}: QuickShareButtonProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const { t } = useLanguage();
    const [status, setStatus] = useState<"idle" | "loading" | "shared">("idle");
    const pendingRef = useRef(false);

    if (!user) return null;

    const handleShare = async () => {
        if (pendingRef.current) return;
        pendingRef.current = true;
        setStatus("loading");
        try {
            // Persist the current content first so the share action finds the
            // freshest version. Save failures here are non-fatal — the user may
            // have already saved, in which case sharing still works.
            if (onSave) {
                try {
                    await onSave();
                } catch {
                    // ignore — fall through to share attempt
                }
            }
            await shareLatestContentAction(contentType);
            setStatus("shared");
            toast({
                title: t("Shared to Community"),
                description: t("Other teachers can now find this in the Community Library."),
            });
        } catch (error: any) {
            const msg = error?.message || "";
            if (msg.includes("already shared")) {
                setStatus("shared");
                toast({
                    title: t("Shared to Community"),
                    description: t("Other teachers can now find this in the Community Library."),
                });
            } else {
                setStatus("idle");
                pendingRef.current = false;
                toast({
                    title: t("Could not share"),
                    description: msg || t("Please try again"),
                    variant: "destructive",
                });
            }
        }
    };

    const icon =
        status === "loading" ? (
            <Loader2 className="animate-spin" />
        ) : status === "shared" ? (
            <Check />
        ) : (
            <Share2 />
        );

    const label =
        status === "loading"
            ? t("Sharing...")
            : status === "shared"
              ? t("Shared")
              : t("Share");

    if (variant === "button") {
        return (
            <Button
                type="button"
                variant="outline"
                size="sm"
                className={`gap-1.5 text-xs ${className ?? ""}`}
                onClick={handleShare}
                disabled={status === "loading"}
            >
                <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
                {label}
            </Button>
        );
    }

    // Icon-row variant (matches ResultShell action button sizing).
    return (
        <Button
            type="button"
            variant="outline"
            onClick={handleShare}
            disabled={status === "loading"}
            aria-label={label}
            title={label}
            className={`h-10 px-3.5 text-sm ${className ?? ""}`}
        >
            <span className="mr-1.5 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
            {label}
        </Button>
    );
}
