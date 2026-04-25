"use client";

import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { auth } from "@/lib/firebase";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface AuthGateProps {
    /** What renders when the user is signed in. */
    children: ReactNode;
    /** Lucide icon shown in the gate. */
    icon: LucideIcon;
    /** H1-sized heading. */
    title: string;
    /** Sub-text below the heading. */
    description: string;
    /** Optional override for the button label. */
    signInLabel?: string;
}

// Inline Google "G" — intentionally not sharing with auth-button.tsx yet
// because button there is a composed dropdown and lifting this out would
// force a wider refactor. Duplication is 15 lines, lift when a 3rd usage
// appears.
function GoogleGIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.28 1.47-1.13 2.71-2.4 3.54v2.94h3.87c2.26-2.09 3.55-5.17 3.55-8.72z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.91l-3.87-2.94c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.03C3.25 21.3 7.31 24 12 24z"/>
            <path fill="#FBBC05" d="M5.27 14.35a7.2 7.2 0 010-4.69V6.63H1.26a12 12 0 000 10.74l4.01-3.02z"/>
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.26 6.63l4.01 3.03C6.22 6.86 8.87 4.75 12 4.75z"/>
        </svg>
    );
}

/**
 * Shared auth gate used by every page that requires a signed-in user to
 * render its body. Previously each page had its own treatment — plain text,
 * icon + text, skeleton-forever, or a blank render — all of which left the
 * teacher with no clear path to sign in. This component standardises to:
 *   - spinner while auth state resolves
 *   - icon + heading + description + direct "Sign in with Google" button
 *     when the user is logged out
 *   - children when the user is signed in
 *
 * See outputs/ux_review_2026_04_21/BUGS.md P1-3 for the original finding.
 */
export function AuthGate({ children, icon: Icon, title, description, signInLabel }: AuthGateProps) {
    const { user, loading } = useAuth();
    const { t } = useLanguage();
    const { toast } = useToast();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="w-full max-w-md mx-auto px-4 py-20 text-center space-y-6">
                <div className="bg-primary/8 p-6 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                    <Icon className="h-10 w-10 text-primary" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold">{t(title)}</h1>
                    <p className="text-muted-foreground">{t(description)}</p>
                </div>
                <Button
                    onClick={async () => {
                        const provider = new GoogleAuthProvider();
                        provider.setCustomParameters({ prompt: "select_account" });
                        try {
                            await signInWithPopup(auth, provider);
                        } catch (err: any) {
                            toast({
                                title: t("Sign-in Failed"),
                                description: err?.message || t("Please try again."),
                                variant: "destructive",
                            });
                        }
                    }}
                    className="w-full gap-2"
                >
                    <GoogleGIcon className="h-4 w-4" />
                    {signInLabel ?? t("Sign in with Google")}
                </Button>
            </div>
        );
    }

    return <>{children}</>;
}
