"use client";

import { useEffect, useState } from "react";
import {
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    User,
    signOut
} from "firebase/auth";
import { auth } from "@/lib/firebase";
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
import { useToast } from "@/hooks/use-toast";

export function AuthButton() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        // Prioritize institutional accounts if possible
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        try {
            await signInWithPopup(auth, provider);
            toast({
                title: "Welcome to SahayakAI",
                description: "You have successfully signed in.",
            });
        } catch (error: any) {
            console.error("Auth Error:", error);
            toast({
                title: "Sign-in Failed",
                description: error.message,
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
                        <AvatarImage src={user.photoURL || ""} alt={user.displayName || "User"} />
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
                <DropdownMenuItem onClick={() => window.location.href = '/my-profile'}>
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
