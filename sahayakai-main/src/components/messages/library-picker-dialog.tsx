"use client";

import { useState, useEffect, useCallback } from "react";
import { BaseContent } from "@/types";
import { SharedResource } from "@/types/messages";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FileTypeIcon } from "@/components/file-type-icon";
import { Loader2, Search, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

// Content types that the messaging SharedResource schema supports + their tool route.
// (Mirrors SHAREABLE_TYPES in conversation-thread.tsx and RESOURCE_CONFIG in message-bubble.tsx.)
const ATTACHABLE: Record<SharedResource["type"], string> = {
    "lesson-plan": "lesson-planner",
    "quiz": "quiz-generator",
    "worksheet": "worksheet-wizard",
    "visual-aid": "visual-aid-designer",
    "virtual-field-trip": "virtual-field-trip",
    "rubric": "rubric-generator",
    "teacher-training": "teacher-training",
};

function isAttachable(type: string): type is SharedResource["type"] {
    return Object.prototype.hasOwnProperty.call(ATTACHABLE, type);
}

// Map a saved library item into the messaging SharedResource shape.
function toSharedResource(item: BaseContent): SharedResource | null {
    if (!isAttachable(item.type)) return null;
    return {
        id: item.id,
        type: item.type,
        title: item.title,
        gradeLevel: item.gradeLevel || undefined,
        subject: item.subject || undefined,
        language: item.language || undefined,
        route: ATTACHABLE[item.type],
    };
}

interface LibraryPickerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (resource: SharedResource) => void;
}

export function LibraryPickerDialog({ open, onOpenChange, onSelect }: LibraryPickerDialogProps) {
    const { user, openAuthModal } = useAuth();
    const { t } = useLanguage();
    const [items, setItems] = useState<BaseContent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");

    const fetchLibrary = useCallback(async () => {
        if (!user) { setLoading(false); return; }
        setLoading(true);
        setError(null);
        try {
            const url = new URL("/api/content/list", window.location.origin);
            url.searchParams.append("limit", "20");
            const token = await user.getIdToken();
            const response = await fetch(url.toString(), {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                if (response.status === 401) { openAuthModal(); throw new Error(t("Please sign in to view your library")); }
                throw new Error(t("Could not load library. Please try again."));
            }
            const data = await response.json();
            // Only items the messaging schema can carry.
            setItems((data.items ?? []).filter((it: BaseContent) => isAttachable(it.type)));
        } catch (e: any) {
            setError(e.message || t("Could not load library. Please try again."));
        } finally {
            setLoading(false);
        }
    }, [user, openAuthModal, t]);

    useEffect(() => {
        if (open) fetchLibrary();
        else { setQuery(""); setError(null); }
    }, [open, fetchLibrary]);

    const filtered = items.filter((it) =>
        !query.trim() ||
        it.title?.toLowerCase().includes(query.toLowerCase()) ||
        it.topic?.toLowerCase().includes(query.toLowerCase()) ||
        it.subject?.toLowerCase().includes(query.toLowerCase())
    );

    const handlePick = (item: BaseContent) => {
        const resource = toSharedResource(item);
        if (!resource) return;
        onSelect(resource);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-4 pt-4 pb-2">
                    <DialogTitle className="text-base">{t("Attach from My Library")}</DialogTitle>
                    <DialogDescription className="text-xs">
                        {t("Pick a saved resource to share in this chat.")}
                    </DialogDescription>
                </DialogHeader>

                <div className="px-4 pb-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t("Search your library…")}
                            className="pl-9 h-9 text-sm"
                        />
                    </div>
                </div>

                <div className="max-h-[50vh] overflow-y-auto px-2 pb-3 scrollbar-thin scrollbar-thumb-border">
                    {loading ? (
                        <div className="flex justify-center items-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
                        </div>
                    ) : error ? (
                        <p className="text-center text-sm text-destructive py-10">{error}</p>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                            <div className="p-3 bg-primary/5 rounded-full">
                                <BookOpen className="h-6 w-6 text-primary/40" />
                            </div>
                            <p className="text-sm font-medium text-foreground">{t("No saved resources yet")}</p>
                            <p className="text-xs text-muted-foreground">{t("Save a resource to your library, then attach it here.")}</p>
                        </div>
                    ) : (
                        <ul className="space-y-1">
                            {filtered.map((item) => (
                                <li key={item.id}>
                                    <button
                                        onClick={() => handlePick(item)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-left",
                                            "hover:bg-primary/5 transition-colors"
                                        )}
                                    >
                                        <FileTypeIcon type={item.type} className="h-5 w-5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                                            <p className="text-[11px] text-muted-foreground truncate">
                                                {[item.gradeLevel, item.subject].filter(Boolean).map((s) => t(s as string)).join(" · ")}
                                            </p>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
