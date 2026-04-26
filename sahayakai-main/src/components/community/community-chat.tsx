"use client";

import { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, limitToLast, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { sendChatMessageAction } from "@/app/actions/community";
import { sendGroupChatMessageAction } from "@/app/actions/groups";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle, Loader2, Mic, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { VoiceRecorder } from "@/components/messages/voice-recorder";
import { useNearBottom } from "@/hooks/use-near-bottom";

type ChatMessage = {
    id: string;
    text: string;
    audioUrl?: string;
    authorId: string;
    authorName: string;
    authorPhotoURL?: string | null;
    createdAt: Timestamp | null;
};

function getInitials(name: string) {
    return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function formatTime(ts: Timestamp | null) {
    if (!ts) return "";
    try { return formatDistanceToNow(ts.toDate(), { addSuffix: true }); } catch { return ""; }
}

type CommunityChatProps = {
    collectionPath?: string;
    groupId?: string;
    title?: string;
    subtitle?: string;
};

export function CommunityChat({
    collectionPath = "community_chat",
    groupId,
    title = "Community Chat",
    subtitle = "Live discussion with teachers across Bharat",
}: CommunityChatProps = {}) {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isNearBottom = useNearBottom(scrollContainerRef, 120);
    const [unreadFromScrollUp, setUnreadFromScrollUp] = useState(0);
    const lastSeenLengthRef = useRef(0);

    // Real-time listener — limitToLast(100) gives the most recent 100 messages
    useEffect(() => {
        const q = query(
            collection(db, collectionPath),
            orderBy("createdAt", "asc"),
            limitToLast(100),
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMessages(snapshot.docs.map((doc) => ({
                id: doc.id,
                ...(doc.data() as Omit<ChatMessage, "id">),
            })));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [collectionPath]);

    // Auto-scroll on new messages — but ONLY if the user is already near the
    // bottom. Yanking them back when they're scrolled up reading history is
    // user-hostile. Track unread count to surface a "New messages ↓" pill.
    useEffect(() => {
        if (messages.length === 0) {
            lastSeenLengthRef.current = 0;
            setUnreadFromScrollUp(0);
            return;
        }
        const newSinceLastEffect = messages.length - lastSeenLengthRef.current;
        if (isNearBottom) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
            setUnreadFromScrollUp(0);
        } else if (newSinceLastEffect > 0) {
            setUnreadFromScrollUp((c) => c + newSinceLastEffect);
        }
        lastSeenLengthRef.current = messages.length;
    }, [messages, isNearBottom]);

    // Reset unread when user scrolls back to bottom.
    useEffect(() => {
        if (isNearBottom) setUnreadFromScrollUp(0);
    }, [isNearBottom]);

    const scrollToBottom = () => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        setUnreadFromScrollUp(0);
    };

    const handleSend = async (audioUrl?: string) => {
        const text = input.trim();
        if (!audioUrl && !text) return;
        if (!user || sending) return;

        // Optimistic update
        const optimisticId = `optimistic_${Date.now()}`;
        const optimisticMsg: ChatMessage = {
            id: optimisticId,
            text: audioUrl ? "Voice message" : text,
            audioUrl,
            authorId: user.uid,
            authorName: user.displayName || "Teacher",
            authorPhotoURL: user.photoURL,
            createdAt: null,
        };
        setMessages((prev) => [...prev, optimisticMsg]);
        if (!audioUrl) setInput("");
        setError(null);
        setSending(true);

        try {
            if (groupId) {
                await sendGroupChatMessageAction(groupId, audioUrl ? "" : text, audioUrl);
            } else {
                await sendChatMessageAction(audioUrl ? "" : text, audioUrl);
            }
        } catch (err: any) {
            // Rollback optimistic message and show error
            setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
            if (!audioUrl) setInput(text);
            setError(
                err?.message?.includes("Unauthorized")
                    ? "You must be signed in to send messages."
                    : err?.message?.includes("rate") || err?.message?.includes("Rate")
                    ? "Slow down — you're sending too fast."
                    : "Failed to send. Please try again.",
            );
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleVoiceSend = (audioUrl: string) => {
        handleSend(audioUrl);
    };

    return (
        <div className="flex flex-col min-h-[400px] h-[calc(100dvh-11rem)] sm:h-[600px] bg-card border border-border rounded-2xl overflow-hidden shadow-soft mt-4">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/30 shrink-0">
                <div className="p-1.5 bg-primary/10 rounded-lg">
                    <MessageCircle className="h-4 w-4 text-primary" />
                </div>
                <div>
                    <p className="text-sm font-bold text-foreground">{title}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">{subtitle}</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Live</span>
                </div>
            </div>

            {/* Messages */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scrollbar-thin scrollbar-thumb-border relative"
            >
                {loading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                        <div className="p-4 bg-primary/10 rounded-full">
                            <MessageCircle className="h-8 w-8 text-primary/40" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-foreground">Start the conversation</p>
                            <p className="text-xs text-muted-foreground mt-1">Be the first to share something with fellow teachers.</p>
                        </div>
                    </div>
                ) : (
                    messages.map((msg, idx) => {
                        const isOwn = msg.authorId === user?.uid;
                        const prevMsg = messages[idx - 1];
                        // Group consecutive messages from same sender — hide avatar/name
                        const showMeta = !prevMsg || prevMsg.authorId !== msg.authorId;
                        const isOptimistic = msg.id.startsWith("optimistic_");

                        return (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex items-end gap-2.5",
                                    isOwn && "flex-row-reverse",
                                    showMeta ? "mt-3" : "mt-0.5",
                                )}
                            >
                                {/* Avatar — spacer when hidden keeps alignment */}
                                <div className="w-7 shrink-0">
                                    {showMeta && (
                                        <Avatar className="h-7 w-7 ring-1 ring-background shadow-soft">
                                            <AvatarImage src={msg.authorPhotoURL ?? undefined} referrerPolicy="no-referrer" />
                                            <AvatarFallback className="text-[10px] font-bold bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                                                {getInitials(msg.authorName)}
                                            </AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>

                                <div className={cn("max-w-[72%] space-y-0.5", isOwn && "items-end flex flex-col")}>
                                    {showMeta && !isOwn && (
                                        <p className="text-[10px] font-bold text-muted-foreground px-1">{msg.authorName}</p>
                                    )}
                                    <div className={cn(
                                        "px-3.5 py-2 rounded-2xl text-sm leading-relaxed font-medium break-words",
                                        isOwn
                                            ? "bg-primary text-primary-foreground rounded-br-sm"
                                            : "bg-muted text-foreground rounded-bl-sm",
                                        isOptimistic && "opacity-60",
                                    )}>
                                        {msg.audioUrl ? (
                                            <div className="flex items-center gap-2 min-w-[160px]">
                                                <div className={cn("p-1.5 rounded-full shrink-0", isOwn ? "bg-white/20" : "bg-primary/10")}>
                                                    <Mic className={cn("h-3.5 w-3.5", isOwn ? "text-primary-foreground" : "text-primary")} />
                                                </div>
                                                <audio src={msg.audioUrl} controls preload="metadata" className="h-8 flex-1 min-w-0" />
                                            </div>
                                        ) : (
                                            msg.text
                                        )}
                                    </div>
                                    {showMeta && (
                                        <p className="text-[10px] text-muted-foreground px-1">{formatTime(msg.createdAt)}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>

            {/* "New messages" pill — appears when the user has scrolled up and
                more messages have arrived. Click to jump to bottom. */}
            {unreadFromScrollUp > 0 && (
                <button
                    onClick={scrollToBottom}
                    className="absolute left-1/2 -translate-x-1/2 bottom-20 z-10 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-elevated hover:bg-primary/90 active:scale-95 transition-all"
                >
                    {unreadFromScrollUp} new message{unreadFromScrollUp !== 1 ? 's' : ''}
                    <ArrowDown className="h-3 w-3" />
                </button>
            )}

            {/* Error banner */}
            {error && (
                <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-xs text-red-600 font-medium text-center">
                    {error}
                </div>
            )}

            {/* Input */}
            <div className="px-4 py-3 border-t border-border bg-card shrink-0">
                {user ? (
                    <div className="flex items-center gap-2">
                        <Input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => { setInput(e.target.value); setError(null); }}
                            onKeyDown={handleKeyDown}
                            placeholder={t("Share something with teachers across Bharat…")}
                            className="flex-1 h-10 text-sm bg-muted/50 border-border rounded-xl focus-visible:ring-primary/30 placeholder:text-muted-foreground"
                            maxLength={500}
                            disabled={sending}
                        />
                        <VoiceRecorder onSend={handleVoiceSend} disabled={sending} />
                        <Button
                            size="sm"
                            onClick={() => handleSend()}
                            disabled={!input.trim() || sending}
                            className="h-10 w-10 p-0 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft shrink-0"
                        >
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </div>
                ) : (
                    <p className="text-center text-xs text-muted-foreground font-medium py-1">
                        Sign in to participate in community chat.
                    </p>
                )}
            </div>
        </div>
    );
}
