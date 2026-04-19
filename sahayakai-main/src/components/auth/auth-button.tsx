"use client";

import {
    signInWithPopup,
    GoogleAuthProvider,
    signOut
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
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
import { LogOut, User as UserIcon, ShieldCheck, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export function AuthButton() {
    const { user, loading } = useAuth();
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
                title: "Sign-in Failed",
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
                <Button variant="default" size="sm" onClick={handleSignIn} className="gap-2 shadow-sm font-bold">
                    <Mail className="h-4 w-4" />
                    <span>Google Sign-in</span>
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
