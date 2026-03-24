"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { getOrCreateDirectConversationAction } from "@/app/actions/messages";
import { ConversationList } from "@/components/messages/conversation-list";
import { ConversationThread } from "@/components/messages/conversation-thread";
import { NewConversationPicker } from "@/components/messages/new-conversation-picker";
import { Conversation } from "@/types/messages";
import { MessageCircle, Loader2 } from "lucide-react";
import { PushPermissionBanner } from "@/components/notifications/push-permission-banner";
import { cn } from "@/lib/utils";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ── Empty state (no conversation selected) ────────────────────────────────────

function NoConversationSelected() {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-4 bg-slate-50/30">
            <div className="p-6 bg-white rounded-full shadow-sm border border-slate-100">
                <MessageCircle className="h-12 w-12 text-orange-300" />
            </div>
            <div className="space-y-1 max-w-xs">
                <h3 className="text-base font-bold text-slate-700">Select a conversation</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
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
    const [showPicker, setShowPicker] = useState(false);
    const [mobileView, setMobileView] = useState<"list" | "thread">("list");
    const [autoOpenLoading, setAutoOpenLoading] = useState(!!(withUid || openId));

    // Helper: fetch a conversation doc from Firestore and open it
    const openConversationById = useCallback(async (conversationId: string) => {
        const snap = await getDoc(doc(db, "conversations", conversationId));
        if (snap.exists()) {
            setActiveConversation({ id: snap.id, ...snap.data() } as Conversation);
            setMobileView("thread");
        }
    }, []);

    // Auto-open conversation from URL params (`?with=` or `?open=`)
    useEffect(() => {
        if (!user || (!withUid && !openId)) {
            return;
        }

        let actionPromise: Promise<any> | undefined;

        if (withUid) {
            actionPromise = getOrCreateDirectConversationAction(user.uid, withUid)
                .then(({ conversationId }) => openConversationById(conversationId));
        } else if (openId) {
            actionPromise = openConversationById(openId);
        }

        if (actionPromise) {
            setAutoOpenLoading(true);
            actionPromise
                .catch(() => {
                    // Handle or log error if necessary
                })
                .finally(() => {
                    router.replace("/messages", { scroll: false });
                    setAutoOpenLoading(false);
                });
        }
    }, [user, withUid, openId, router, openConversationById]);

    const handleSelectConversation = (conv: Conversation) => {
        setActiveConversation(conv);
        setShowPicker(false);
        setMobileView("thread");
    };

    const handleNewDM = () => {
        setActiveConversation(null);
        setShowPicker(true);
        setMobileView("thread"); // on mobile, show right panel
    };

    const handlePickerReady = (conversationId: string) => {
        setShowPicker(false);
        openConversationById(conversationId);
    };

    const handleBack = () => {
        setShowPicker(false);
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
        <div className="w-full space-y-0">
        <PushPermissionBanner />
        <div className="flex w-full h-[calc(100dvh-6rem)] sm:h-[calc(100dvh-4rem)] bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
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

            {/* ── Right panel: picker → thread → empty state ───────── */}
            <div className={cn(
                "flex-1 min-w-0 lg:block",
                mobileView === "list" ? "hidden lg:flex" : "flex",
                "flex-col"
            )}>
                {showPicker ? (
                    <NewConversationPicker onConversationReady={handlePickerReady} />
                ) : activeConversation ? (
                    <ConversationThread
                        conversation={activeConversation}
                        onBack={handleBack}
                    />
                ) : (
                    <NoConversationSelected />
                )}
            </div>
        </div>
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-[calc(100dvh-6rem)] sm:h-[calc(100dvh-4rem)]">
                <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
            </div>
        }>
            <MessagesPageContent />
        </Suspense>
    );
}
