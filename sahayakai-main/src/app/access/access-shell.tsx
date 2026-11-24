"use client";

import Link from "next/link";
import { signOut } from "firebase/auth";
import { LogOut } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import { cn } from "@/lib/utils";

/**
 * Chrome and building blocks shared by the access-flow pages (/access,
 * /request-access, /join/[code]). These pages are reachable by accounts that
 * are not entitled to the product, so they deliberately carry none of the app
 * shell. They are drawn with the design system's own surface: the wash and
 * saffron glow, glass panels, field cards, pills and the orb.
 */

/** What the orb, and so the page, is saying. */
export type AccessTone = "rest" | "working" | "ready" | "ended";

const ORB_FILL: Record<AccessTone, string> = {
    rest: "var(--orb-live)",
    working: "var(--orb-live-working)",
    ready: "var(--orb-live-speaking)",
    // The app has no separate offline fill: the resting orb, drained of colour.
    ended: "var(--orb-live)",
};

const ORB_SHADOW: Record<AccessTone, string> = {
    rest: "var(--shadow-orb-live-listening)",
    working: "var(--shadow-orb-live-working)",
    ready: "var(--shadow-orb-live-speaking)",
    ended: "var(--shadow-orb-live-failed)",
};

const ORB_SIZE = { sm: "h-6 w-6", md: "h-14 w-14", lg: "h-24 w-24" } as const;

/** The orb, as a still mark. Decorative: the text beside it carries the meaning. */
export function AccessOrb({
    tone = "rest", size = "lg", className,
}: {
    tone?: AccessTone;
    size?: keyof typeof ORB_SIZE;
    className?: string;
}) {
    return (
        <span
            aria-hidden
            className={cn(
                "block shrink-0 rounded-pill",
                ORB_SIZE[size],
                size === "sm" ? "" : "motion-safe:animate-[vidya-rest_5.5s_ease-in-out_infinite]",
                className,
            )}
            style={{
                backgroundImage: ORB_FILL[tone],
                boxShadow: size === "sm" ? undefined : ORB_SHADOW[tone],
                filter: tone === "ended" ? "saturate(.32) brightness(1.04)" : undefined,
            }}
        />
    );
}

type PillTone = "accent" | "info" | "success" | "warning" | "quiet";

const PILL_TONE: Record<PillTone, string> = {
    accent: "bg-tint-accent text-saffron-700",
    info: "bg-tint-info text-indigo-500",
    success: "bg-tint-success text-leaf-700",
    warning: "bg-tint-warning text-saffron-800",
    quiet: "bg-tint-quiet text-ink-600",
};

export function AccessPill({ tone = "quiet", children }: { tone?: PillTone; children: React.ReactNode }) {
    return (
        <span className={cn("inline-flex min-h-7 items-center rounded-pill px-3 text-xs font-semibold", PILL_TONE[tone])}>
            {children}
        </span>
    );
}

export function AccessShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
    const { user } = useAuth();
    const { t } = useLanguage();

    return (
        <div className="flex min-h-screen flex-col bg-wash-screen text-ink-900">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-hairline bg-surface-chrome px-5 py-3 sm:px-8">
                <Link href="/" className="focus-ring flex min-h-11 items-center gap-2 rounded-row font-display text-lg font-semibold tracking-tight text-ink-900">
                    <img src="/icons/mark.png" alt={t("SahayakAI logo")} className="h-8 w-8 object-contain" />
                    SahayakAI
                </Link>
                <div className="flex items-center gap-2">
                    <LanguageSwitcher />
                    {user ? (
                        <button
                            type="button"
                            onClick={() => { void signOut(auth); }}
                            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-pill border border-line-control bg-surface-glass-soft px-4 text-sm font-semibold text-ink-900 transition-colors duration-200 ease-standard hover:bg-surface-glass-strong"
                        >
                            <LogOut className="h-4 w-4" aria-hidden />
                            {t("Sign out")}
                        </button>
                    ) : null}
                </div>
            </header>
            <main className="flex flex-1 justify-center px-5 py-10 sm:px-8 sm:py-16">
                <div className={cn("w-full", wide ? "max-w-web" : "max-w-2xl")}>{children}</div>
            </main>
            <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line-hairline px-5 py-6 text-sm text-ink-600 sm:px-8">
                <span className="font-display text-sm font-semibold text-ink-900">SahayakAI</span>
                <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <Link href="/terms" className="focus-ring rounded-xs underline-offset-2 hover:underline">{t("Terms of Service")}</Link>
                    <a href="mailto:contact@sargvision.com" className="focus-ring rounded-xs underline-offset-2 hover:underline">contact@sargvision.com</a>
                </span>
            </footer>
        </div>
    );
}

/** A glass panel: the one raised surface on these pages. */
export function AccessPanel({ className, children }: { className?: string; children: React.ReactNode }) {
    return (
        <section className={cn("rounded-panel border border-line-glass bg-surface-glass p-4 shadow-card sm:p-6", className)}>
            {children}
        </section>
    );
}

/**
 * One status screen: the orb in the colour of the state, the heading, then a
 * glass panel holding the detail and the actions.
 */
export function AccessCard({
    title, tone = "rest", pill, children,
}: {
    title: string;
    tone?: AccessTone;
    /** A short state label shown above the heading. */
    pill?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col items-center gap-6 text-center">
            <AccessOrb tone={tone} />
            {pill ? <div className="flex flex-wrap justify-center gap-2">{pill}</div> : null}
            <h1 className="font-display text-web-h2 font-semibold tracking-tight text-ink-900">{title}</h1>
            <AccessPanel className="w-full text-left">
                <div className="space-y-4 text-web-body text-ink-600">{children}</div>
            </AccessPanel>
        </div>
    );
}

/** Loading state for a whole access page. */
export function AccessLoading({ label }: { label: string }) {
    return (
        <div className="flex flex-col items-center gap-5 py-16 text-sm font-medium text-ink-600" role="status">
            <AccessOrb tone="working" size="md" />
            {label}
        </div>
    );
}

export function InlineError({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <p role="alert" className="rounded-tile border border-destructive/30 bg-tint-danger px-4 py-3 text-sm font-medium text-destructive">
            {message}
        </p>
    );
}

/** Class for the primary action: the single saffron pill on a screen. */
export const ACCESS_PRIMARY =
    "focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-pill bg-saffron-600 px-7 font-display text-base font-semibold text-white shadow-cta transition-colors duration-200 ease-standard hover:bg-saffron-700 disabled:cursor-not-allowed disabled:opacity-60";

/** Class for a secondary action: a glass pill. */
export const ACCESS_SECONDARY =
    "focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-pill border border-line-glass bg-surface-glass px-6 font-display text-sm font-semibold text-ink-900 transition-colors duration-200 ease-standard hover:bg-surface-glass-strong";

/**
 * A field card: the label sits inside the card, above the value. Pass the
 * control as children and give it FIELD_CONTROL.
 */
export function FieldCard({
    id, label, optional, invalid, hint, help, children,
}: {
    id: string;
    label: string;
    /** Translated word for "Optional"; shown beside the label. */
    optional?: string;
    invalid?: boolean;
    /** Shown only when the field is invalid. */
    hint?: string;
    /** Always shown. */
    help?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <div
                className={cn(
                    "rounded-tile border bg-surface-glass-strong px-4 pb-2 pt-3 transition-shadow duration-200 ease-standard focus-within:border-saffron-500 focus-within:shadow-current",
                    invalid ? "border-destructive" : "border-line-glass",
                )}
            >
                <label htmlFor={id} className="type-eyebrow block text-saffron-600">
                    {label}
                    {optional ? <span className="ml-1.5 font-medium normal-case tracking-normal text-ink-500">· {optional}</span> : null}
                </label>
                {children}
            </div>
            {help ? <p id={`${id}-help`} className="mt-1 px-1 text-xs text-ink-500">{help}</p> : null}
            {invalid && hint ? <p className="mt-1 px-1 text-sm font-medium text-destructive">{hint}</p> : null}
        </div>
    );
}

/** The control inside a FieldCard: no box of its own. */
export const FIELD_CONTROL =
    "mt-1 block min-h-8 w-full border-0 bg-transparent p-0 font-display text-base font-semibold text-ink-900 placeholder:font-normal placeholder:text-ink-400 focus:outline-none focus:ring-0 disabled:opacity-60";
