"use client";

/**
 * My Library → Conversations.
 *
 * Every VIDYA conversation (text, turn-based voice, Live Voice) is retained
 * automatically in `users/{uid}/vidya_sessions` and listed here — the teacher
 * does not have to do anything. The bookmark is a separate "keep" toggle:
 * bookmarked conversations are never pruned (unsaved ones keep the 10 most
 * recent). Nothing here is an artifact: these rows live in the conversation
 * store, never in `users/{uid}/content` (Generations).
 */

import { useCallback, useEffect, useState } from "react";
import { Bookmark, Loader2, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/layout";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ConversationSummary {
    id: string;
    title: string;
    saved: boolean;
    updatedAt: string | null;
    messageCount: number;
}

interface ConversationMessage {
    role: "user" | "model";
    parts: { text: string }[];
}

export function ConversationList() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const { toast } = useToast();
    const [items, setItems] = useState<ConversationSummary[] | null>(null);
    const [open, setOpen] = useState<{ title: string; messages: ConversationMessage[] } | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const authed = useCallback(async (path: string, init: RequestInit = {}) => {
        const token = await user?.getIdToken();
        if (!token) throw new Error("not signed in");
        const res = await fetch(path, {
            ...init,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }, [user]);

    const failed = useCallback(() => {
        toast({ title: t("Something went wrong"), description: t("Please try again."), variant: "destructive" });
    }, [t, toast]);

    const load = useCallback(async () => {
        try {
            const data = await authed("/api/vidya/session?list=1");
            setItems(Array.isArray(data.items) ? data.items : []);
        } catch {
            setItems([]);
            failed();
        }
    }, [authed, failed]);

    // Keyed on the teacher, not on `load`: `t` / `toast` / the user object can
    // change identity on any provider re-render, which would refetch the list
    // (and race an open/bookmark in flight).
    const uid = user?.uid;
    useEffect(() => {
        if (uid) void load();
    }, [uid]);

    const openConversation = async (item: ConversationSummary) => {
        setBusyId(item.id);
        try {
            const data = await authed(`/api/vidya/session?id=${encodeURIComponent(item.id)}`);
            setOpen({ title: data.title || item.title, messages: Array.isArray(data.messages) ? data.messages : [] });
        } catch {
            failed();
        } finally {
            setBusyId(null);
        }
    };

    // Bookmark = keep this conversation (never pruned). Un-bookmarking does
    // not remove it from the list or delete its history.
    const toggleSaved = async (item: ConversationSummary) => {
        setBusyId(item.id);
        try {
            await authed("/api/vidya/session", { method: "PATCH", body: JSON.stringify({ sessionId: item.id, saved: !item.saved }) });
            setItems((prev) => (prev ?? []).map((i) => (i.id === item.id ? { ...i, saved: !item.saved } : i)));
        } catch {
            failed();
        } finally {
            setBusyId(null);
        }
    };

    if (items === null) {
        return (
            <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <EmptyState
                icon={MessageSquareText}
                title={t("No conversations yet")}
                description={t("Your chats with VIDYA appear here automatically. Tap the bookmark to keep one.")}
            />
        );
    }

    return (
        <>
            <ul className="grid gap-3" aria-label={t("Conversations")}>
                {items.map((item) => (
                    <li key={item.id} className="flex items-center gap-4 rounded-surface-md border border-border bg-card p-4 shadow-soft">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-primary/10 text-primary">
                            <MessageSquareText className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-foreground">{item.title || t("Conversations")}</p>
                            <p className="text-xs text-muted-foreground">
                                {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : ""}
                                {item.updatedAt ? " · " : ""}
                                {item.messageCount} {t("Messages")}
                                {item.saved ? ` · ${t("Saved")}` : ""}
                            </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => openConversation(item)} disabled={busyId === item.id}>
                                {t("Open")}
                            </Button>
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => toggleSaved(item)}
                                disabled={busyId === item.id}
                                aria-pressed={item.saved}
                                aria-label={item.saved ? t("Saved") : t("Save conversation")}
                                title={item.saved ? t("Saved") : t("Save conversation")}
                            >
                                <Bookmark className={cn("h-4 w-4", item.saved && "fill-current text-primary")} />
                            </Button>
                        </div>
                    </li>
                ))}
            </ul>

            <Dialog open={open !== null} onOpenChange={(v) => { if (!v) setOpen(null); }}>
                <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="pr-6">{open?.title}</DialogTitle>
                    </DialogHeader>
                    <ol className="space-y-3">
                        {(open?.messages ?? []).map((m, i) => (
                            <li
                                key={i}
                                className={m.role === "user"
                                    ? "ml-8 rounded-surface-md bg-primary/10 p-3 text-sm text-foreground"
                                    : "mr-8 rounded-surface-md border border-border bg-card p-3 text-sm text-foreground"}
                            >
                                <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                                    {m.role === "user" ? t("Teacher") : "VIDYA"}
                                </span>
                                <span className="whitespace-pre-wrap">{m.parts.map((p) => p.text).join("")}</span>
                            </li>
                        ))}
                    </ol>
                </DialogContent>
            </Dialog>
        </>
    );
}
