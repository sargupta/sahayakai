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
import { AuthGate } from "@/components/auth/auth-gate";
import { PushPermissionBanner } from "@/components/notifications/push-permission-banner";
import { cn } from "@/lib/utils";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ── Empty state (no conversation selected) ────────────────────────────────────

function NoConversationSelected() {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-4 bg-muted/20">
            <div className="p-6 bg-primary/10 rounded-full shadow-soft border border-border/50">
                <MessageCircle className="h-12 w-12 text-primary" />
            </div>
            <div className="space-y-2 max-w-xs">
                <h3 className="text-base font-bold font-headline text-foreground">Your Messages</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Connect with teachers in the Community to start messaging. When someone accepts your connection request, you can chat here.
                </p>
                <a
                    href="/community"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors mt-2"
                >
                    Find Teachers
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </a>
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
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        return (
            <AuthGate
                icon={MessageCircle}
                title="Sign in to see your messages"
                description="Sign in with Google to chat with other teachers and get notified of new replies."
            >
                {null}
            </AuthGate>
        );
    }

    return (
        <div className="w-full space-y-0">
        <PushPermissionBanner />
        <div className="flex w-full h-[calc(100dvh-6rem)] sm:h-[calc(100dvh-4rem)] bg-white rounded-2xl overflow-hidden border border-border/50 shadow-soft">
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
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <MessagesPageContent />
        </Suspense>
    );
}
