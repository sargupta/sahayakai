"use client";

import Link from "next/link";
import { signOut } from "firebase/auth";
import { LogOut } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";

/**
 * Chrome shared by the access-flow pages (/access, /request-access,
 * /join/[code]). These pages are reachable by accounts that are not entitled
 * to the product, so they deliberately carry none of the app shell.
 */
export function AccessShell({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const { t } = useLanguage();

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <header className="flex items-center justify-between border-b border-border px-6 py-4 sm:px-10">
                <Link href="/" className="flex items-center gap-2 font-headline text-lg font-bold tracking-tight text-foreground">
                    <img src="/icons/mark.png" alt={t("SahayakAI logo")} className="h-8 w-8 object-contain" />
                    SahayakAI
                </Link>
                <div className="flex items-center gap-3">
                    <LanguageSwitcher />
                    {user ? (
                        <button
                            type="button"
                            onClick={() => { void signOut(auth); }}
                            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <LogOut className="h-4 w-4" aria-hidden />
                            {t("Sign out")}
                        </button>
                    ) : null}
                </div>
            </header>
            <main className="flex flex-1 justify-center px-6 py-10 sm:px-10 sm:py-14">
                <div className="w-full max-w-xl">{children}</div>
            </main>
            <footer className="border-t border-border px-6 py-5 text-center text-xs text-muted-foreground sm:px-10">
                <Link href="/terms" className="underline-offset-2 hover:underline">{t("Terms of Service")}</Link>
                <span className="mx-2" aria-hidden>·</span>
                <a href="mailto:contact@sargvision.com" className="underline-offset-2 hover:underline">contact@sargvision.com</a>
            </footer>
        </div>
    );
}

export function AccessCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <h1 className="font-headline text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground">{children}</div>
        </section>
    );
}

export function InlineError({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {message}
        </p>
    );
}
