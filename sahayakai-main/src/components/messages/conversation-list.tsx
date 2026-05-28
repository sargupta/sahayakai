"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { Conversation } from "@/types/messages";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, Search, Users, PenSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { PresenceDot } from './presence-dot';
import { useLanguage } from "@/context/language-context";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(ts: Timestamp | null): string {
    if (!ts) return "";
    try { return formatDistanceToNow(ts.toDate(), { addSuffix: true }); } catch { return ""; }
}

function getInitials(name: string): string {
    return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function getConversationLabel(conv: Conversation, myUid: string, t: (k: string) => string): { name: string; photo: string | null } {
    if (conv.type === "group") {
        return { name: conv.name ?? t("Group"), photo: conv.groupPhotoURL ?? null };
    }
    const otherId = conv.participantIds.find((id) => id !== myUid);
    if (!otherId) return { name: t("Teacher"), photo: null };
    return {
        name: conv.participants[otherId]?.displayName ?? t("Teacher"),
        photo: conv.participants[otherId]?.photoURL ?? null,
    };
}

// ── ConversationListItem ──────────────────────────────────────────────────────

function ConversationListItem({
    conv,
    myUid,
    isActive,
    onClick,
}: {
    conv: Conversation;
    myUid: string;
    isActive: boolean;
    onClick: () => void;
}) {
    const { t } = useLanguage();
    const { name, photo } = getConversationLabel(conv, myUid, t);
    const unread = conv.unreadCount?.[myUid] ?? 0;
    const isMyLastMsg = conv.lastMessageSenderId === myUid;
    const otherUid = conv.type === 'direct' ? conv.participantIds.find(id => id !== myUid) : undefined;

    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 px-4 py-3 transition-all transition-colors text-left",
                isActive
                    ? "bg-primary/5 border-l-2 border-primary border-r-2 border-r-transparent"
                    : "hover:bg-muted/50 border-l-2 border-l-transparent border-r-2 border-r-transparent"
            )}
        >
            {/* Avatar */}
            <div className="relative shrink-0">
                <Avatar className="h-11 w-11 ring-2 ring-white shadow-sm">
                    <AvatarImage src={photo ?? undefined} referrerPolicy="no-referrer" />
                    <AvatarFallback className={cn(
                        "text-sm font-bold text-white",
                        conv.type === "group"
                            ? "bg-gradient-to-br from-purple-500 to-indigo-500"
                            : "bg-gradient-to-br from-orange-400 to-amber-500"
                    )}>
                        {conv.type === "group" ? <Users className="h-5 w-5" /> : getInitials(name)}
                    </AvatarFallback>
                </Avatar>
                {unread > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center">
                        {unread > 9 ? "9+" : unread}
                    </span>
                )}
                {otherUid && (
                    <PresenceDot uid={otherUid} className="absolute bottom-0 right-0" />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <p className={cn("text-sm truncate", unread > 0 ? "font-black text-foreground" : "font-semibold text-foreground")}>
                        {name}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                        {formatTime(conv.lastMessageAt)}
                    </span>
                </div>
                <p className={cn(
                    "text-xs truncate mt-0.5",
                    unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground"
                )}>
                    {isMyLastMsg ? t("You: ") : ""}{conv.lastMessage || t("Start a conversation")}
                </p>
            </div>
        </button>
    );
}

// ── ConversationList ──────────────────────────────────────────────────────────

interface ConversationListProps {
    activeConversationId: string | null;
    onSelect: (conv: Conversation) => void;
    onNewDM: () => void;         // opens teacher picker / community page
}

export function ConversationList({
    activeConversationId,
    onSelect,
    onNewDM,
}: ConversationListProps) {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Real-time inbox
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "conversations"),
            where("participantIds", "array-contains", user.uid),
            orderBy("lastMessageAt", "desc"),
        );

        const unsub = onSnapshot(q, (snap) => {
            setConversations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Conversation)));
            setLoading(false);
        });

        return () => unsub();
    }, [user]);

    const filtered = search.trim()
        ? conversations.filter((conv) => {
            const label = getConversationLabel(conv, user?.uid ?? "", t).name.toLowerCase();
            return label.includes(search.toLowerCase());
        })
        : conversations;

    return (
        <div className="flex flex-col h-full border-r border-border bg-card">
            {/* Header */}
            <div className="px-4 py-4 border-b border-border shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-black text-foreground tracking-tight">{t("Messages")}</h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onNewDM}
                        className="h-8 w-8 rounded-xl text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10"
                        title={t("New message")}
                    >
                        <PenSquare className="h-4 w-4" />
                    </Button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t("Search conversations…")}
                        className="pl-9 h-9 text-sm bg-muted/50 border-border rounded-xl focus-visible:ring-orange-400/30"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border">
                {loading ? (
                    <div className="flex justify-center items-center h-32">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center space-y-3">
                        <div className="p-4 bg-orange-50 rounded-full">
                            <MessageCircle className="h-8 w-8 text-orange-300" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-foreground">{t("No messages yet")}</p>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                <PenSquare className="inline h-3 w-3 mb-0.5 mr-1" />{t("Use the button above to find a teacher and start a conversation.")}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {filtered.map((conv) => (
                            <ConversationListItem
                                key={conv.id}
                                conv={conv}
                                myUid={user?.uid ?? ""}
                                isActive={conv.id === activeConversationId}
                                onClick={() => onSelect(conv)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
