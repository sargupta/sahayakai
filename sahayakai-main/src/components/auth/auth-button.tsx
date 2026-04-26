"use client";

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/sign-in-with-google";
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
import { GoogleGIcon } from "./google-g-icon";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export function AuthButton() {
    const { user, loading } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();
    const { toast } = useToast();

    const handleSignIn = async () => {
        try {
            // signInWithGoogle picks popup vs redirect by platform.
            // On mobile/PWA/in-app browsers the page navigates away and the
            // result is consumed in auth-context's redirect handler — that
            // handler runs the same profile-check + onboarding redirect.
            // On desktop the popup completes here and we run the same flow
            // inline.
            const result = await signInWithGoogle({
                runProfileCheck: true,
                source: 'auth-button',
            });
            if (!result) return; // mobile redirect path — page is navigating away

            const user = result.user;

            // Prime the auth-token cookie synchronously (popup path only)
            try {
                const token = await user.getIdToken();
                const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
                document.cookie = `auth-token=${token}; path=/; max-age=3600; SameSite=Lax${secure}`;
            } catch {
                // onIdTokenChanged will retry.
            }

            let redirectToOnboarding = false;
            try {
                const response = await fetch(`/api/auth/profile-check?uid=${user.uid}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.exists === false) {
                        redirectToOnboarding = true;
                        toast({
                            title: "Almost there!",
                            description: "Complete your professional profile to join the community.",
                        });
                    }
                }
                if (!redirectToOnboarding) {
                    toast({ title: "Welcome back!", description: "You're all set!" });
                }
            } catch {
                toast({ title: "Welcome back!", description: "Logging you in..." });
            }

            if (redirectToOnboarding) {
                router.push('/onboarding');
            } else {
                router.refresh();
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
