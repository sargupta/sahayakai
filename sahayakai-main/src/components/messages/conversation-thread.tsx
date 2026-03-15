"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
    collection, query, orderBy, limitToLast, onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { Message, Conversation, SharedResource } from "@/types/messages";
import { sendMessageAction, markConversationReadAction } from "@/app/actions/messages";
import { MessageBubble } from "./message-bubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Send, Loader2, ArrowLeft, Paperclip, X, BookOpen,
    ClipboardCheck, FileSignature, Images, Globe2, GraduationCap, Wand2,
} from "lucide-react";
import { VoiceRecorder } from "./voice-recorder";
import { cn } from "@/lib/utils";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

// ── Resource type picker (what teacher can share) ─────────────────────────────

const SHAREABLE_TYPES: { type: SharedResource["type"]; label: string; icon: React.ElementType; route: string }[] = [
    { type: "lesson-plan",        label: "Lesson Plan",  icon: BookOpen,       route: "lesson-planner"      },
    { type: "quiz",               label: "Quiz",         icon: ClipboardCheck, route: "quiz-generator"      },
    { type: "worksheet",          label: "Worksheet",    icon: FileSignature,  route: "worksheet-wizard"    },
    { type: "visual-aid",         label: "Visual Aid",   icon: Images,         route: "visual-aid-designer" },
    { type: "virtual-field-trip", label: "Field Trip",   icon: Globe2,         route: "virtual-field-trip"  },
    { type: "rubric",             label: "Rubric",       icon: GraduationCap,  route: "rubric-generator"    },
    { type: "teacher-training",   label: "Training",     icon: Wand2,          route: "teacher-training"    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getConversationTitle(conv: Conversation, myUid: string): string {
    if (conv.type === "group") return conv.name ?? "Group";
    const otherId = conv.participantIds.find((id) => id !== myUid);
    return otherId ? (conv.participants[otherId]?.displayName ?? "Teacher") : "Chat";
}

function getConversationPhoto(conv: Conversation, myUid: string): string | null {
    if (conv.type === "group") return conv.groupPhotoURL ?? null;
    const otherId = conv.participantIds.find((id) => id !== myUid);
    return otherId ? (conv.participants[otherId]?.photoURL ?? null) : null;
}

function getInitials(name: string) {
    return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ── InlineResourcePicker ──────────────────────────────────────────────────────
// Lightweight: teacher picks type + enters topic/grade manually.
// Phase 2 can connect to actual saved library items.

interface ResourceDraft {
    type: SharedResource["type"];
    title: string;
    gradeLevel: string;
    subject: string;
    route: string;
}

function InlineResourcePicker({
    onShare,
    onClose,
}: {
    onShare: (resource: SharedResource, caption: string) => void;
    onClose: () => void;
}) {
    const [step, setStep] = useState<"pick-type" | "fill-details">("pick-type");
    const [draft, setDraft] = useState<ResourceDraft | null>(null);
    const [caption, setCaption] = useState("");

    const selectType = (t: typeof SHAREABLE_TYPES[number]) => {
        setDraft({ type: t.type, label: t.label, title: "", gradeLevel: "", subject: "", route: t.route } as any);
        setStep("fill-details");
    };

    const handleShare = () => {
        if (!draft || !draft.title.trim()) return;
        onShare({
            id: `manual_${Date.now()}`,
            type: draft.type,
            title: draft.title.trim(),
            gradeLevel: draft.gradeLevel.trim() || undefined,
            subject: draft.subject.trim() || undefined,
            route: draft.route,
        }, caption.trim());
        onClose();
    };

    return (
        <div className="w-[min(18rem,calc(100vw-2rem))] p-3 space-y-3">
            {step === "pick-type" ? (
                <>
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Share a resource</p>
                    <div className="grid grid-cols-2 gap-2">
                        {SHAREABLE_TYPES.map((t) => {
                            const Icon = t.icon;
                            return (
                                <button
                                    key={t.type}
                                    onClick={() => selectType(t)}
                                    className="flex items-center gap-2 p-2 rounded-xl border border-slate-100 bg-slate-50 hover:bg-orange-50 hover:border-orange-200 transition-all text-left"
                                >
                                    <Icon className="h-4 w-4 text-slate-500 shrink-0" />
                                    <span className="text-xs font-medium text-slate-700">{t.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </>
            ) : (
                <>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setStep("pick-type")} className="text-slate-400 hover:text-slate-600">
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                            {SHAREABLE_TYPES.find(t => t.type === draft?.type)?.label}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <input
                            autoFocus
                            placeholder="Topic / Title *"
                            value={draft?.title ?? ""}
                            onChange={(e) => setDraft((d) => d ? { ...d, title: e.target.value } : d)}
                            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
                        />
                        <input
                            placeholder="Class (optional)"
                            value={draft?.gradeLevel ?? ""}
                            onChange={(e) => setDraft((d) => d ? { ...d, gradeLevel: e.target.value } : d)}
                            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
                        />
                        <input
                            placeholder="Subject (optional)"
                            value={draft?.subject ?? ""}
                            onChange={(e) => setDraft((d) => d ? { ...d, subject: e.target.value } : d)}
                            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
                        />
                        <textarea
                            placeholder="Add a message (optional)"
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            rows={2}
                            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-orange-300"
                        />
                        <Button
                            size="sm"
                            onClick={handleShare}
                            disabled={!draft?.title.trim()}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                        >
                            Share Resource
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}

// ── ConversationThread ────────────────────────────────────────────────────────

interface ConversationThreadProps {
    conversation: Conversation;
    onBack?: () => void;  // mobile back button
}

export function ConversationThread({ conversation, onBack }: ConversationThreadProps) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const sendingRef = useRef(false);
    const [resourceOpen, setResourceOpen] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const title = user ? getConversationTitle(conversation, user.uid) : "Chat";
    const photo = user ? getConversationPhoto(conversation, user.uid) : null;

    // Real-time messages — drop any optimistic entries that the snapshot has confirmed
    useEffect(() => {
        const msgCol = collection(db, "conversations", conversation.id, "messages");
        const q = query(msgCol, orderBy("createdAt", "asc"), limitToLast(100));

        const unsub = onSnapshot(q, (snap) => {
            const real = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
            setMessages((prev) => {
                // Keep optimistic messages that haven't been confirmed yet
                const confirmedIds = new Set(real.map((m) => m.id));
                const pending = prev.filter((m) => m.id.startsWith("optimistic_") && !confirmedIds.has(m.id));
                return [...real, ...pending];
            });
            setOptimisticIds((prev) => {
                if (prev.size === 0) return prev;
                const confirmedIds = new Set(snap.docs.map((d) => d.id));
                const next = new Set([...prev].filter((id) => !confirmedIds.has(id)));
                return next.size === prev.size ? prev : next;
            });
            setLoading(false);
        });
        return () => unsub();
    }, [conversation.id]);

    // Auto-scroll on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Mark read when conversation opens
    useEffect(() => {
        if (!user) return;
        markConversationReadAction(conversation.id, user.uid).catch(() => {});
    }, [conversation.id, user]);

    const handleSend = useCallback(async (
        text: string,
        type: "text" | "resource" | "audio" = "text",
        resource?: SharedResource,
        audioUrl?: string,
        audioDuration?: number,
    ) => {
        if (!user || sendingRef.current) return;
        const trimmed = text.trim();
        if (!trimmed && type === "text") return;
        if (type === "audio" && !audioUrl) return;

        setInput("");
        sendingRef.current = true;

        // Optimistic insert — appears immediately, replaced by real snapshot
        const optimisticId = `optimistic_${Date.now()}`;
        const optimisticMsg: Message = {
            id: optimisticId,
            type,
            text: trimmed,
            senderId: user.uid,
            senderName: user.displayName ?? "Teacher",
            senderPhotoURL: user.photoURL ?? null,
            readBy: [user.uid],
            createdAt: { toDate: () => new Date(), seconds: Date.now() / 1000, nanoseconds: 0 } as any,
            ...(type === "resource" && resource ? { resource } : {}),
            ...(type === "audio" && audioUrl ? { audioUrl, audioDuration } : {}),
        };
        setMessages((prev) => [...prev, optimisticMsg]);
        setOptimisticIds((prev) => new Set([...prev, optimisticId]));
        setSending(true);

        try {
            await sendMessageAction({
                conversationId: conversation.id,
                text: trimmed,
                type,
                resource,
                audioUrl,
                audioDuration,
            });
        } catch {
            // Remove the optimistic message on failure
            setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
            setOptimisticIds((prev) => { const n = new Set(prev); n.delete(optimisticId); return n; });
        } finally {
            setSending(false);
            sendingRef.current = false;
            textareaRef.current?.focus();
        }
    }, [user, conversation.id]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend(input);
        }
    };

    const handleResourceShare = (resource: SharedResource, caption: string) => {
        handleSend(caption || `Check out this ${resource.type.replace("-", " ")}!`, "resource", resource);
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-white shrink-0 shadow-sm">
                {onBack && (
                    <button onClick={onBack} className="text-slate-400 hover:text-slate-700 transition-colors mr-1">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                )}
                <Avatar className="h-9 w-9 ring-2 ring-slate-100">
                    <AvatarImage src={photo ?? undefined} referrerPolicy="no-referrer" />
                    <AvatarFallback className="text-sm font-bold bg-gradient-to-br from-orange-400 to-amber-500 text-white">
                        {getInitials(title)}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{title}</p>
                    {conversation.type === "group" && (
                        <p className="text-[10px] text-slate-400">
                            {conversation.participantIds.length} members
                        </p>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 scrollbar-thin scrollbar-thumb-slate-200">
                {loading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                        <div className="p-4 bg-orange-50 rounded-full">
                            <Send className="h-8 w-8 text-orange-300" />
                        </div>
                        <p className="text-sm font-bold text-slate-700">Start the conversation</p>
                        <p className="text-xs text-slate-400">Send a message or share a teaching resource.</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => {
                        const isOwn = msg.senderId === user?.uid;
                        const prevMsg = messages[idx - 1];
                        const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId;
                        const isPending = optimisticIds.has(msg.id);
                        return (
                            <div key={msg.id} className={cn(isPending && "opacity-60")}>
                                <MessageBubble
                                    message={msg}
                                    isOwn={isOwn}
                                    showAvatar={showAvatar}
                                    participantIds={conversation.participantIds}
                                />
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div className="px-4 py-3 border-t border-slate-100 bg-white shrink-0">
                {user ? (
                    <div className="flex items-end gap-2">
                        {/* Resource share button */}
                        <Popover open={resourceOpen} onOpenChange={setResourceOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 rounded-xl text-slate-400 hover:text-orange-500 hover:bg-orange-50 shrink-0"
                                    title="Share a resource"
                                >
                                    <Paperclip className="h-4 w-4" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent side="top" align="start" className="p-0 rounded-2xl shadow-xl border-slate-200">
                                <div className="flex items-center justify-between px-3 pt-3">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Share</span>
                                    <button onClick={() => setResourceOpen(false)}>
                                        <X className="h-3.5 w-3.5 text-slate-400" />
                                    </button>
                                </div>
                                <InlineResourcePicker
                                    onShare={handleResourceShare}
                                    onClose={() => setResourceOpen(false)}
                                />
                            </PopoverContent>
                        </Popover>

                        {/* Text input */}
                        <Textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                            className="flex-1 min-h-[40px] max-h-32 text-sm bg-slate-50 border-slate-200 rounded-xl resize-none focus-visible:ring-orange-400/30 placeholder:text-slate-400 py-2.5"
                            rows={1}
                            maxLength={1000}
                            disabled={sending}
                        />

                        {/* Voice message */}
                        <VoiceRecorder
                            onSend={(audioUrl, duration) => handleSend("", "audio", undefined, audioUrl, duration)}
                            disabled={sending}
                        />

                        {/* Send */}
                        <Button
                            size="icon"
                            onClick={() => handleSend(input)}
                            disabled={!input.trim() || sending}
                            className="h-10 w-10 rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-sm shrink-0"
                        >
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </div>
                ) : (
                    <p className="text-center text-xs text-slate-400 font-medium py-1">Sign in to send messages.</p>
                )}
            </div>
        </div>
    );
}
