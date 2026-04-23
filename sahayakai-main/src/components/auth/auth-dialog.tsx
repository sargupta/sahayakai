"use client";

import { useAuth } from "@/context/auth-context";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    signInWithPopup,
    GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { GoogleGIcon } from "./google-g-icon";

/**
 * Auth dialog — signed-out modal for Google sign-in.
 *
 * Design language mirrors the B2B landing page: clean neutral surface,
 * single saffron accent, conservative typography, Google's official
 * Sign-In button styling (white surface + 1px neutral border + multi-colour
 * G mark + dark text). No gradients, no decorative blur blobs, no mixed
 * icon colours — enterprise buyers expect restraint.
 */
export function AuthDialog() {
    const { isAuthModalOpen, closeAuthModal } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const handleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });

        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Profile check — redirect new users to onboarding. Mirrors AuthButton.
            try {
                const response = await fetch(`/api/auth/profile-check?uid=${user.uid}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.exists === false) {
                        toast({
                            title: "Profile setup required",
                            description: "Finish your profile to continue.",
                        });
                        closeAuthModal();
                        router.push("/onboarding");
                        return;
                    }
                }
            } catch {
                // API error — don't block login
            }
        } catch (error: any) {
            toast({
                title: "Sign-in failed",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    return (
        <Dialog open={isAuthModalOpen} onOpenChange={closeAuthModal}>
            <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden">
                {/* Saffron top rail — same accent the landing nav uses.
                    Subtle brand anchor; no heavy colour wash. */}
                <div className="h-1 w-full bg-[hsl(var(--primary))]" />

                <div className="px-7 pt-7 pb-6">
                    {/* Wordmark only — single clean identifier, no gradient title. */}
                    <div className="flex items-center gap-2 mb-6">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[hsl(var(--primary))] text-white text-[12px] font-extrabold">
                            S
                        </span>
                        <span className="font-headline text-[17px] font-bold tracking-tight text-foreground">
                            SahayakAI
                        </span>
                    </div>

                    <DialogTitle className="text-[22px] font-headline font-bold tracking-tight text-foreground leading-snug">
                        Sign in to continue
                    </DialogTitle>
                    <DialogDescription className="mt-2 text-[14px] text-muted-foreground leading-relaxed">
                        Access your library, track your usage, and pick up where you left off — across every classroom tool.
                    </DialogDescription>

                    {/* Google Sign-In button — follows Google branding guidelines:
                        white surface, 1px neutral border, multi-colour G mark,
                        dark "Sign in with Google" label. Universally recognised
                        pattern on enterprise login screens. */}
                    <button
                        type="button"
                        onClick={handleSignIn}
                        className="mt-8 w-full h-11 inline-flex items-center justify-center gap-3 rounded-full bg-white border border-neutral-300 text-[14px] font-semibold text-neutral-800 hover:bg-neutral-50 hover:border-neutral-400 transition-colors shadow-sm"
                    >
                        <GoogleGIcon className="h-[18px] w-[18px]" />
                        Sign in with Google
                    </button>

                    <p className="mt-5 text-[11px] text-center text-muted-foreground leading-relaxed">
                        By signing in, you agree to the{" "}
                        <a href="/privacy-for-teachers" className="underline underline-offset-2 hover:text-foreground">
                            Privacy notice
                        </a>
                        {" "}and Terms.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
