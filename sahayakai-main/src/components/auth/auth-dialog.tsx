"use client";

import { useAuth } from "@/context/auth-context";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    signInWithPopup,
    GoogleAuthProvider
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Mail, Sparkles, ShieldCheck, Zap } from "lucide-react";
import { Logo } from "@/components/logo";

export function AuthDialog() {
    const { isAuthModalOpen, closeAuthModal } = useAuth();
    const { toast } = useToast();

    const handleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        try {
            await signInWithPopup(auth, provider);
            toast({
                title: "Welcome to SahayakAI!",
                description: "You can now access all AI features.",
            });
            closeAuthModal();
        } catch (error: any) {
            console.error("Auth Error:", error);
            toast({
                title: "Sign-in Failed",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    return (
        <Dialog open={isAuthModalOpen} onOpenChange={closeAuthModal}>
            <DialogContent className="sm:max-w-[425px] overflow-hidden border-none p-0 bg-white/95 backdrop-blur-md">
                <div className="relative overflow-hidden pt-8 pb-6 px-6">
                    {/* Decorative Background Elements */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />

                    <DialogHeader className="relative z-10 flex flex-col items-center text-center space-y-4">
                        <div className="mb-2 scale-125">
                            <Logo />
                        </div>
                        <DialogTitle className="text-2xl font-headline font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600">
                            Unlock Your AI Assistant
                        </DialogTitle>
                        <DialogDescription className="text-base text-muted-foreground max-w-[300px]">
                            Join thousands of educators using SahayakAI to save time and transform their classrooms.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="relative z-10 mt-8 space-y-4">
                        <div className="grid gap-3">
                            <FeatureItem
                                icon={<Zap className="h-5 w-5 text-orange-500" />}
                                title="Fast AI Generation"
                                description="Lessons, quizzes, and worksheets in seconds."
                            />
                            <FeatureItem
                                icon={<ShieldCheck className="h-5 w-5 text-green-500" />}
                                title="Cloud Storage"
                                description="Your content is saved and accessible anywhere."
                            />
                            <FeatureItem
                                icon={<Sparkles className="h-5 w-5 text-indigo-500" />}
                                title="Smart Insights"
                                description="Get AI-powered teaching advice and support."
                            />
                        </div>

                        <div className="pt-6">
                            <Button
                                onClick={handleSignIn}
                                className="w-full h-12 text-lg font-bold gap-3 shadow-lg hover:shadow-primary/20 transition-all active:scale-[0.98]"
                            >
                                <Mail className="h-5 w-5" />
                                Sign in with Google
                            </Button>
                            <p className="text-center text-xs text-muted-foreground mt-4">
                                By signing in, you agree to our Terms of Service.
                            </p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="flex gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
            <div className="flex-shrink-0 mt-0.5">
                {icon}
            </div>
            <div>
                <h4 className="text-sm font-semibold text-foreground leading-tight">{title}</h4>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
        </div>
    );
}
