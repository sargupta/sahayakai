"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { getOrCreateDirectConversationAction } from "@/app/actions/messages";
import { ConversationList } from "@/components/messages/conversation-list";
import { ConversationThread } from "@/components/messages/conversation-thread";
import { Conversation } from "@/types/messages";
import { MessageCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Empty state (no conversation selected) ────────────────────────────────────

function NoConversationSelected() {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-4 bg-slate-50/30">
            <div className="p-6 bg-white rounded-full shadow-sm border border-slate-100">
                <MessageCircle className="h-12 w-12 text-orange-300" />
            </div>
            <div className="space-y-1 max-w-xs">
                <h3 className="text-base font-bold text-slate-700">Select a conversation</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                    Choose a conversation from the left, or go to the Community page to start one with a fellow teacher.
                </p>
            </div>
        </div>
    );
}

// ── MessagesPageContent (needs useSearchParams → wrapped in Suspense) ─────────

function MessagesPageContent() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const withUid = searchParams.get("with");   // auto-open DM with this teacher
    const openId  = searchParams.get("open");   // auto-open existing conversation by ID

    const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
    const [mobileView, setMobileView] = useState<"list" | "thread">("list");
    const [autoOpenLoading, setAutoOpenLoading] = useState(!!withUid);

    // Auto-create/open DM when `?with=uid` is in the URL
    useEffect(() => {
        if (!withUid || !user) return;
        setAutoOpenLoading(true);
        getOrCreateDirectConversationAction(user.uid, withUid)
            .then(({ conversationId }) => {
                // The real-time listener in ConversationList will pick up the conversation.
                // We set a stub so the thread panel opens immediately.
                setActiveConversation({
                    id: conversationId,
                    type: "direct",
                    participantIds: [user.uid, withUid],
                    participants: {},
                    lastMessage: "",
                    lastMessageAt: null,
                    lastMessageSenderId: "",
                    unreadCount: {},
                    createdAt: null,
                    updatedAt: null,
                });
                setMobileView("thread");
                // Clean up URL param
                router.replace("/messages");
            })
            .catch(console.error)
            .finally(() => setAutoOpenLoading(false));
    }, [withUid, user, router]);

    const handleSelectConversation = (conv: Conversation) => {
        setActiveConversation(conv);
        setMobileView("thread");
    };

    const handleNewDM = () => {
        router.push("/community?tab=teachers");
    };

    const handleBack = () => {
        setMobileView("list");
    };

    if (authLoading || autoOpenLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                <MessageCircle className="h-12 w-12 text-slate-300" />
                <p className="text-sm font-bold text-slate-600">Sign in to access your messages.</p>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-4rem)] bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
            {/* ── Conversation List (Inbox) ─────────────────────────── */}
            <div className={cn(
                "w-full lg:w-80 xl:w-96 shrink-0 lg:block",
                mobileView === "thread" ? "hidden lg:block" : "block"
            )}>
                <ConversationList
                    activeConversationId={activeConversation?.id ?? null}
                    onSelect={handleSelectConversation}
                    onNewDM={handleNewDM}
                />
            </div>

            {/* ── Conversation Thread ───────────────────────────────── */}
            <div className={cn(
                "flex-1 min-w-0 lg:block",
                mobileView === "list" ? "hidden lg:flex" : "flex",
                "flex-col"
            )}>
                {activeConversation ? (
                    <ConversationThread
                        conversation={activeConversation}
                        onBack={handleBack}
                    />
                ) : (
                    <NoConversationSelected />
                )}
            </div>
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
                <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
            </div>
        }>
            <MessagesPageContent />
        </Suspense>
    );
}
