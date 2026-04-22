"use client";

import {
    signInWithPopup,
    GoogleAuthProvider,
    signOut
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { LogOut, User as UserIcon, ShieldCheck } from "lucide-react";

// Google "G" mark — renders the familiar multi-colour logo so teachers
// recognise the provider on a 375 px viewport without the "Sign-in" word taking
// ~150 px of header width.
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
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export function AuthButton() {
    const { user, loading } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();
    const { toast } = useToast();

    const handleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        // Prioritize institutional accounts if possible
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Check if profile exists — be resilient to API errors
            // IMPORTANT: Only redirect to onboarding on a DEFINITIVE false.
            // A failed API call should NOT send a returning teacher to onboarding.
            try {
                const response = await fetch(`/api/auth/profile-check?uid=${user.uid}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.exists === false) {
                        toast({
                            title: "Almost there!",
                            description: "Complete your professional profile to join the community.",
                        });
                        router.push('/onboarding');
                        return;
                    }
                }
                // If response is not ok OR exists is true/undefined, treat as returning user
                toast({
                    title: "Welcome back!",
                    description: "You're all set!",
                });
            } catch (profileCheckError) {
                // API error — don't block login with onboarding redirect
                toast({ title: "Welcome back!", description: "Logging you in..." });
            }
        } catch (error: any) {
            toast({
                title: t("Sign-in Failed"),
                description: `Firebase Error: ${error.code} (${error.message})`,
                variant: "destructive",
            });
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            toast({
                title: "Signed Out",
                description: "See you again soon!",
            });
        } catch (error: any) {
            toast({
                title: "Error signing out",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    if (loading) return <div className="h-8 w-8 animate-pulse bg-slate-200 rounded-full" />;

    if (!user) {
        return (
            <div className="flex items-center gap-2">
                <Button
                    variant="default"
                    size="sm"
                    onClick={handleSignIn}
                    aria-label={t("Sign in with Google")}
                    className="gap-2 shadow-sm font-bold"
                >
                    <GoogleGIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("Sign in with Google")}</span>
                </Button>
            </div>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full ring-2 ring-primary/10">
                    <Avatar className="h-8 w-8">
                        <AvatarImage
                            src={user.photoURL || ""}
                            alt={user.displayName || "User"}
                            referrerPolicy="no-referrer"
                        />
                        <AvatarFallback>{user.displayName?.[0] || "T"}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.displayName}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/my-profile')}>
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Profile & Library</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    <span>Certifications</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
