"use client";

import { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, limitToLast, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { sendChatMessageAction } from "@/app/actions/community";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

type ChatMessage = {
    id: string;
    text: string;
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

export function CommunityChat() {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Real-time listener — limitToLast(100) gives the most recent 100 messages
    useEffect(() => {
        const q = query(
            collection(db, "community_chat"),
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
    }, []);

    // Auto-scroll on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        const text = input.trim();
        if (!text || !user || sending) return;

        // Optimistic update
        const optimisticId = `optimistic_${Date.now()}`;
        const optimisticMsg: ChatMessage = {
            id: optimisticId,
            text,
            authorId: user.uid,
            authorName: user.displayName || "Teacher",
            authorPhotoURL: user.photoURL,
            createdAt: null,
        };
        setMessages((prev) => [...prev, optimisticMsg]);
        setInput("");
        setError(null);
        setSending(true);

        try {
            await sendChatMessageAction(text);
        } catch (err: any) {
            // Rollback optimistic message and show error
            setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
            setInput(text);
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

    return (
        <div className="flex flex-col min-h-[400px] h-[600px] bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm mt-4">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 shrink-0">
                <div className="p-1.5 bg-orange-100 rounded-lg">
                    <MessageCircle className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-900">Community Chat</p>
                    <p className="text-[10px] text-slate-400 font-medium">Live discussion with teachers across Bharat</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Live</span>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-200">
                {loading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                        <div className="p-4 bg-orange-50 rounded-full">
                            <MessageCircle className="h-8 w-8 text-orange-300" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-700">Start the conversation</p>
                            <p className="text-xs text-slate-400 mt-1">Be the first to share something with fellow teachers.</p>
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
                                        <Avatar className="h-7 w-7 ring-1 ring-white shadow-sm">
                                            <AvatarImage src={msg.authorPhotoURL ?? undefined} referrerPolicy="no-referrer" />
                                            <AvatarFallback className="text-[10px] font-bold bg-gradient-to-br from-orange-400 to-amber-500 text-white">
                                                {getInitials(msg.authorName)}
                                            </AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>

                                <div className={cn("max-w-[72%] space-y-0.5", isOwn && "items-end flex flex-col")}>
                                    {showMeta && !isOwn && (
                                        <p className="text-[10px] font-bold text-slate-500 px-1">{msg.authorName}</p>
                                    )}
                                    <div className={cn(
                                        "px-3.5 py-2 rounded-2xl text-sm leading-relaxed font-medium break-words",
                                        isOwn
                                            ? "bg-orange-500 text-white rounded-br-sm"
                                            : "bg-slate-100 text-slate-800 rounded-bl-sm",
                                        isOptimistic && "opacity-60",
                                    )}>
                                        {msg.text}
                                    </div>
                                    {showMeta && (
                                        <p className="text-[10px] text-slate-400 px-1">{formatTime(msg.createdAt)}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>

            {/* Error banner */}
            {error && (
                <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-xs text-red-600 font-medium text-center">
                    {error}
                </div>
            )}

            {/* Input */}
            <div className="px-4 py-3 border-t border-slate-100 bg-white shrink-0">
                {user ? (
                    <div className="flex items-center gap-2">
                        <Input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => { setInput(e.target.value); setError(null); }}
                            onKeyDown={handleKeyDown}
                            placeholder="Share something with teachers across Bharat…"
                            className="flex-1 h-10 text-sm bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-orange-400/30 placeholder:text-slate-400"
                            maxLength={500}
                            disabled={sending}
                        />
                        <Button
                            size="sm"
                            onClick={handleSend}
                            disabled={!input.trim() || sending}
                            className="h-10 w-10 p-0 rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-sm shrink-0"
                        >
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </div>
                ) : (
                    <p className="text-center text-xs text-slate-400 font-medium py-1">
                        Sign in to participate in community chat.
                    </p>
                )}
            </div>
        </div>
    );
}
