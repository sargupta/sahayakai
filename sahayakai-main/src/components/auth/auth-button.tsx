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
import { LANGUAGE_TO_ISO } from "@/types";

// Component-local translation tables keyed by ISO code (uiLangCode).
const PROFILE_LIBRARY_LABELS: Record<string, string> = {
    en: "Profile & Library",
    hi: "प्रोफ़ाइल और लाइब्रेरी",
    mr: "प्रोफाइल आणि लायब्ररी",
    bn: "প্রোফাইল ও লাইব্রেরি",
    pa: "ਪ੍ਰੋਫਾਈਲ ਅਤੇ ਲਾਇਬ੍ਰੇਰੀ",
    gu: "પ્રોફાઇલ અને લાઇબ્રેરી",
    or: "ପ୍ରୋଫାଇଲ୍ ଓ ଲାଇବ୍ରେରୀ",
    ta: "சுயவிவரம் & நூலகம்",
    te: "ప్రొఫైల్ & లైబ్రరీ",
    kn: "ಪ್ರೊಫೈಲ್ ಮತ್ತು ಲೈಬ್ರರಿ",
    ml: "പ്രൊഫൈൽ & ലൈബ്രറി",
};

const SIGN_IN_ERROR_LABELS: Record<string, string> = {
    en: "Something went wrong signing in. Please try again.",
    hi: "साइन इन करने में कुछ गड़बड़ हो गई। कृपया फिर से प्रयास करें।",
    mr: "साइन इन करताना काहीतरी चूक झाली. कृपया पुन्हा प्रयत्न करा.",
    bn: "সাইন ইন করতে কিছু সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।",
    pa: "ਸਾਈਨ ਇਨ ਕਰਨ ਵਿੱਚ ਕੁਝ ਗੜਬੜ ਹੋ ਗਈ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
    gu: "સાઇન ઇન કરવામાં કંઈક ખોટું થયું. કૃપા કરીને ફરી પ્રયાસ કરો.",
    or: "ସାଇନ୍ ଇନ୍ କରିବାରେ କିଛି ତ୍ରୁଟି ହୋଇଗଲା। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।",
    ta: "உள்நுழைவதில் ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.",
    te: "సైన్ ఇన్ చేయడంలో ఏదో తప్పు జరిగింది. దయచేసి మళ్ళీ ప్రయత్నించండి.",
    kn: "ಸೈನ್ ಇನ್ ಮಾಡುವಲ್ಲಿ ಏನೋ ತಪ್ಪಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    ml: "സൈൻ ഇൻ ചെയ്യുന്നതിൽ എന്തോ പിശക് സംഭവിച്ചു. വീണ്ടും ശ്രമിക്കുക.",
};

export function AuthButton() {
    const { user, loading } = useAuth();
    const { t, language } = useLanguage();
    const router = useRouter();
    const { toast } = useToast();

    const uiLangCode = LANGUAGE_TO_ISO[language] || "en";

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
                            title: t("Almost there!"),
                            description: t("Complete your professional profile to join the community."),
                        });
                    }
                }
                if (!redirectToOnboarding) {
                    toast({ title: t("Welcome back!"), description: t("You're all set!") });
                }
            } catch {
                toast({ title: t("Welcome back!"), description: t("Logging you in...") });
            }

            if (redirectToOnboarding) {
                router.push('/onboarding');
            } else {
                router.refresh();
            }
        } catch (error: any) {
            console.error(`Firebase Error: ${error?.code} (${error?.message})`);
            toast({
                title: t("Sign-in Failed"),
                description: SIGN_IN_ERROR_LABELS[uiLangCode] || SIGN_IN_ERROR_LABELS.en,
                variant: "destructive",
            });
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            toast({
                title: t("Signed Out"),
                description: t("See you again soon!"),
            });
        } catch (error: any) {
            toast({
                title: t("Error signing out"),
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
                    <span>{PROFILE_LIBRARY_LABELS[uiLangCode] || PROFILE_LIBRARY_LABELS.en}</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    <span>{t("Certifications")}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t("Sign out")}</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
