"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePaginatedMessages } from "@/hooks/use-paginated-messages";
import { useAuth } from "@/context/auth-context";
import { Message, Conversation, SharedResource } from "@/types/messages";
import { markConversationReadAction } from "@/app/actions/messages";
import { MessageBubble } from "./message-bubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Send, Loader2, ArrowLeft, Paperclip, X, BookOpen,
    ClipboardCheck, FileSignature, Images, Globe2, GraduationCap, Wand2,
    Library,
} from "lucide-react";
import { VoiceRecorder } from "./voice-recorder";
import { LibraryPickerDialog } from "./library-picker-dialog";
import { useMessageOutbox } from "@/hooks/use-message-outbox";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";
import { TypingIndicator } from "./typing-indicator";
import { PresenceDot } from "./presence-dot";
import { cn } from "@/lib/utils";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useLanguage } from "@/context/language-context";
import { LANGUAGE_TO_ISO } from "@/types";
import { BackButton } from "@/components/ui/back-button";

// ── Component-local chrome strings (resolved by uiLangCode) ───────────────────
// "Loading..." already lives in the shared dictionary (use t()); only
// "Load older messages" is missing there, so it gets a local table here.
const LOAD_OLDER_LABEL: Record<string, string> = {
    en: "Load older messages",
    hi: "पुराने संदेश लोड करें",
    mr: "जुने संदेश लोड करा",
    bn: "পুরোনো বার্তা লোড করুন",
    pa: "ਪੁਰਾਣੇ ਸੁਨੇਹੇ ਲੋਡ ਕਰੋ",
    gu: "જૂના સંદેશા લોડ કરો",
    or: "ପୁରୁଣା ସନ୍ଦେଶ ଲୋଡ୍ କରନ୍ତୁ",
    ta: "பழைய செய்திகளை ஏற்று",
    te: "పాత సందేశాలను లోడ్ చేయండి",
    kn: "ಹಳೆಯ ಸಂದೇಶಗಳನ್ನು ಲೋಡ್ ಮಾಡಿ",
    ml: "പഴയ സന്ദേശങ്ങൾ ലോഡ് ചെയ്യുക",
};

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

function getConversationTitle(conv: Conversation, myUid: string, t: (k: string) => string): string {
    if (conv.type === "group") return conv.name ?? t("Group");
    const otherId = conv.participantIds.find((id) => id !== myUid);
    return otherId ? (conv.participants[otherId]?.displayName ?? t("Teacher")) : t("Chat");
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
    const { t } = useLanguage();
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
                    <p className="text-xs font-bold text-foreground uppercase tracking-wide">{t("Share a resource")}</p>
                    <div className="grid grid-cols-2 gap-2">
                        {SHAREABLE_TYPES.map((st) => {
                            const Icon = st.icon;
                            return (
                                <button
                                    key={st.type}
                                    onClick={() => selectType(st)}
                                    className="flex items-center gap-2 p-2 rounded-xl border border-border bg-muted/40 hover:bg-primary/5 hover:border-primary/20 transition-all text-left"
                                >
                                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span className="text-xs font-medium text-foreground">{t(st.label)}</span>
                                </button>
                            );
                        })}
                    </div>
                </>
            ) : (
                <>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setStep("pick-type")} className="text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                        <p className="text-xs font-bold text-foreground uppercase tracking-wide">
                            {(() => {
                                const lbl = SHAREABLE_TYPES.find(st => st.type === draft?.type)?.label;
                                return lbl ? t(lbl) : "";
                            })()}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <input
                            autoFocus
                            placeholder={t("Topic / Title *")}
                            value={draft?.title ?? ""}
                            onChange={(e) => setDraft((d) => d ? { ...d, title: e.target.value } : d)}
                            className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <input
                            placeholder={t("Class (optional)")}
                            value={draft?.gradeLevel ?? ""}
                            onChange={(e) => setDraft((d) => d ? { ...d, gradeLevel: e.target.value } : d)}
                            className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <input
                            placeholder={t("Subject (optional)")}
                            value={draft?.subject ?? ""}
                            onChange={(e) => setDraft((d) => d ? { ...d, subject: e.target.value } : d)}
                            className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <textarea
                            placeholder={t("Add a message (optional)")}
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            rows={2}
                            className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-card resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <Button
                            size="sm"
                            onClick={handleShare}
                            disabled={!draft?.title.trim()}
                            className="w-full bg-primary hover:bg-primary/90 text-white"
                        >
                            {t("Share Resource")}
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
    const { t, language } = useLanguage();
    const uiLangCode = LANGUAGE_TO_ISO[language] || "en";
    const { messages, loading, loadingMore, hasMore, loadMore } = usePaginatedMessages(conversation.id);
    const [input, setInput] = useState("");
    const [resourceOpen, setResourceOpen] = useState(false);
    const [libraryOpen, setLibraryOpen] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { outboxMessages, sendWithOutbox, retryMessage, mergeWithFirestore } = useMessageOutbox(conversation.id);
    const { isOtherTyping, setTyping } = useTypingIndicator(conversation.id, user?.uid);

    const title = user ? getConversationTitle(conversation, user.uid, t) : t("Chat");
    const photo = user ? getConversationPhoto(conversation, user.uid) : null;
    const otherUid = conversation.type === 'direct'
        ? conversation.participantIds.find(id => id !== user?.uid)
        : undefined;

    const displayMessages = mergeWithFirestore(messages);

    // Auto-scroll on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [displayMessages]);

    // Mark read when conversation opens. We swallow errors but log them at
    // debug level so DevTools shows whether the action actually ran on the
    // QA's click-thread-from-list path. This clears both the per-conversation
    // unreadCount AND the sidebar Bell badge ("N messages").
    useEffect(() => {
        if (!user) return;
        console.debug('[ConversationThread] marking read', { conversationId: conversation.id, uid: user.uid });
        markConversationReadAction(conversation.id, user.uid)
            .then(() => console.debug('[ConversationThread] mark read OK', conversation.id))
            .catch((err) => console.error('[ConversationThread] mark read failed', err));
    }, [conversation.id, user]);

    const handleSend = useCallback(async (
        text: string,
        type: "text" | "resource" | "audio" = "text",
        resource?: SharedResource,
        audioUrl?: string,
        audioDuration?: number,
    ) => {
        if (!user) return;
        const trimmed = text.trim();
        if (!trimmed && type === "text") return;
        if (type === "audio" && !audioUrl) return;

        setInput("");
        await sendWithOutbox({
            conversationId: conversation.id,
            text: trimmed,
            type,
            resource,
            audioUrl,
            audioDuration,
        });
        textareaRef.current?.focus();
    }, [user, conversation.id, sendWithOutbox]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend(input);
        }
    };

    const handleResourceShare = (resource: SharedResource, caption: string) => {
        handleSend(caption || `Check out this ${resource.type.replace("-", " ")}!`, "resource", resource);
    };

    const handleLibraryAttach = (resource: SharedResource) => {
        handleResourceShare(resource, "");
    };

    return (
        <div className="flex flex-col h-full bg-card">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0 shadow-soft">
                {onBack && (
                    <BackButton onBack={onBack} className="mr-1" />
                )}
                <div className="relative">
                    <Avatar className="h-9 w-9 ring-2 ring-border">
                        <AvatarImage src={photo ?? undefined} referrerPolicy="no-referrer" />
                        <AvatarFallback className="text-sm font-bold bg-gradient-to-br from-primary to-primary/70 text-white">
                            {getInitials(title)}
                        </AvatarFallback>
                    </Avatar>
                    {otherUid && (
                        <PresenceDot uid={otherUid} className="absolute bottom-0 right-0" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{title}</p>
                    {conversation.type === "group" && (
                        <p className="text-[10px] text-muted-foreground">
                            {conversation.participantIds.length} members
                        </p>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 scrollbar-thin scrollbar-thumb-border">
                {/* Load older messages */}
                {hasMore && !loading && (
                    <div className="flex justify-center py-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={loadMore}
                            disabled={loadingMore}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            {loadingMore ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                            {loadingMore ? t('Loading...') : (LOAD_OLDER_LABEL[uiLangCode] || LOAD_OLDER_LABEL.en)}
                        </Button>
                    </div>
                )}
                {loading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
                    </div>
                ) : displayMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                        <div className="p-4 bg-primary/5 rounded-full">
                            <Send className="h-8 w-8 text-primary/40" />
                        </div>
                        <p className="text-sm font-bold text-foreground">{t("Start the conversation")}</p>
                        <p className="text-xs text-muted-foreground">{t("Send a message or share a teaching resource.")}</p>
                    </div>
                ) : (
                    displayMessages.map((msg, idx) => {
                        const isOwn = msg.senderId === user?.uid;
                        const prevMsg = displayMessages[idx - 1];
                        const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId;
                        return (
                            <MessageBubble
                                key={msg.id}
                                message={msg}
                                isOwn={isOwn}
                                showAvatar={showAvatar}
                                participantIds={conversation.participantIds}
                            />
                        );
                    })
                )}
                <TypingIndicator isTyping={isOtherTyping} />
                <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div className="px-4 py-3 border-t border-border bg-card shrink-0">
                {user ? (
                    <div className="flex items-end gap-2">
                        {/* Resource share button */}
                        <Popover open={resourceOpen} onOpenChange={setResourceOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5 shrink-0"
                                    title={t("Share a resource")}
                                >
                                    <Paperclip className="h-4 w-4" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent side="top" align="start" className="p-0 rounded-2xl shadow-xl border-border">
                                <div className="flex items-center justify-between px-3 pt-3">
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{t("Share")}</span>
                                    <button onClick={() => setResourceOpen(false)}>
                                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                                    </button>
                                </div>
                                <InlineResourcePicker
                                    onShare={handleResourceShare}
                                    onClose={() => setResourceOpen(false)}
                                />
                            </PopoverContent>
                        </Popover>

                        {/* Attach from My Library */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLibraryOpen(true)}
                            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5 shrink-0"
                            title={t("Attach from My Library")}
                        >
                            <Library className="h-4 w-4" />
                        </Button>

                        {/* Text input */}
                        <Textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => { setInput(e.target.value); setTyping(); }}
                            onKeyDown={handleKeyDown}
                            placeholder={t("Type a message…")}
                            className="flex-1 min-h-[40px] max-h-32 text-sm bg-muted/40 border-border rounded-xl resize-none focus-visible:ring-primary/30 placeholder:text-muted-foreground py-2.5"
                            rows={1}
                            maxLength={1000}
                        />

                        {/* Voice message */}
                        <VoiceRecorder
                            onSend={(audioUrl, duration) => handleSend("", "audio", undefined, audioUrl, duration)}
                        />

                        {/* Send */}
                        <Button
                            size="icon"
                            onClick={() => handleSend(input)}
                            disabled={!input.trim()}
                            className="h-10 w-10 rounded-xl bg-primary hover:bg-primary/90 text-white shadow-soft shrink-0"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <p className="text-center text-xs text-muted-foreground font-medium py-1">{t("Sign in to send messages.")}</p>
                )}
            </div>

            {/* Attach-from-library picker */}
            <LibraryPickerDialog
                open={libraryOpen}
                onOpenChange={setLibraryOpen}
                onSelect={handleLibraryAttach}
            />
        </div>
    );
}
