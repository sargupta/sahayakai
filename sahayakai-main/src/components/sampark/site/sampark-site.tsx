"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Menu, X } from "lucide-react";
import { SamparkWordmark } from "@/components/shell/brand";
import { useSahayakHref, useSamparkHref } from "@/components/shell/product-paths";
import { useLanguage } from "@/context/language-context";
import { isExternalUrl } from "@/lib/products";
import { cn } from "@/lib/utils";

/**
 * SamparkAI public website: WebNav → WebHero → WebSections → CTABand →
 * WebFooter, per the design system's website guide (always light, 1220px
 * container, 28px side padding, 88–96px section rhythm, milk and band
 * sections alternating, one saffron CTA band above the footer).
 *
 * Every claim is something the product does today (see src/lib/sampark):
 * the three notice types marked `available` in the catalogue, the four
 * parent languages, Practice → Test → Live, calling hours, pause, opt-out
 * on every call, admin-only access. No metrics, customers or testimonials.
 */

const CONTAINER = "mx-auto w-full max-w-web px-4 sm:px-7";

function AnyLink({ href, className, children, onClick }: { href: string; className: string; children: ReactNode; onClick?: () => void }) {
    if (isExternalUrl(href)) {
        return (
            <a href={href} className={className} onClick={onClick}>
                {children}
            </a>
        );
    }
    return (
        <Link href={href} className={className} onClick={onClick}>
            {children}
        </Link>
    );
}

function Eyebrow({ children }: { children: ReactNode }) {
    return <p className="type-web-eyebrow text-saffron-600">{children}</p>;
}

function WebNav({ workspaceHref }: { workspaceHref: string }) {
    const { t } = useLanguage();
    const [open, setOpen] = useState(false);
    const home = useSamparkHref()("/");
    const links = [
        { href: "#how", label: t("How it works") },
        { href: "#safeguards", label: t("Safeguards") },
        { href: "#languages", label: t("Languages") },
    ];
    return (
        <header
            className="sticky top-0 z-50 border-b border-[color:var(--web-hairline)] bg-[color:var(--web-nav-glass)] backdrop-blur-[18px]"
        >
            <div className={cn(CONTAINER, "flex h-16 items-center justify-between gap-4")}>
                <Link href={home} className="focus-ring flex min-h-11 items-center rounded-pill">
                    <SamparkWordmark endorsed />
                </Link>
                <nav aria-label={t("SamparkAI")} className="hidden items-center gap-1 md:flex">
                    {links.map((l) => (
                        <a key={l.href} href={l.href} className="focus-ring rounded-pill px-3 py-2 text-value font-medium text-ink-600 transition-colors duration-small ease-standard hover:text-ink-900">
                            {l.label}
                        </a>
                    ))}
                </nav>
                <div className="flex items-center gap-2">
                    <Link
                        href={workspaceHref}
                        className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-pill bg-ink-900 px-5 font-display text-value font-semibold text-white transition-transform duration-small ease-standard active:scale-[.98]"
                    >
                        {t("Open workspace")}
                    </Link>
                    <button
                        type="button"
                        onClick={() => setOpen((o) => !o)}
                        aria-expanded={open}
                        aria-controls="sampark-site-menu"
                        aria-label={open ? t("Close menu") : t("Menu")}
                        className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-pill text-ink-600 hover:bg-milk-300 md:hidden"
                    >
                        {open ? <X aria-hidden="true" strokeWidth={1.7} className="h-5 w-5" /> : <Menu aria-hidden="true" strokeWidth={1.7} className="h-5 w-5" />}
                    </button>
                </div>
            </div>
            {open && (
                <nav id="sampark-site-menu" aria-label={t("SamparkAI")} className={cn(CONTAINER, "pb-4 md:hidden")}>
                    <ul className="space-y-1">
                        {links.map((l) => (
                            <li key={l.href}>
                                <a href={l.href} onClick={() => setOpen(false)} className="focus-ring flex min-h-11 items-center rounded-pill px-3 text-card-title font-medium text-ink-900 hover:bg-milk-300">
                                    {l.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>
            )}
        </header>
    );
}

/** An honest, labelled sample of the workspace's Calls view. Not live data. */
function WorkspacePreview() {
    const { t } = useLanguage();
    const rows = [
        { who: "Class 7 B · Roll 12", phone: "••••••0720", lang: "हिन्दी", reason: t("PTM invitation"), outcome: t("Confirmed"), tone: "leaf" },
        { who: "Class 7 B · Roll 18", phone: "••••••4412", lang: "English", reason: t("PTM invitation"), outcome: t("No answer · retrying"), tone: "amber" },
        { who: "Class 5 A · Roll 03", phone: "••••••1187", lang: "বাংলা", reason: t("Event invitation"), outcome: t("Heard the notice"), tone: "leaf" },
        { who: "Class 5 A · Roll 21", phone: "••••••9036", lang: "नेपाली", reason: t("Event invitation"), outcome: t("Asked not to be called"), tone: "stone" },
    ] as const;
    const langCode: Record<string, string> = { English: "en", "हिन्दी": "hi", "বাংলা": "bn", "नेपाली": "ne" };
    return (
        <figure className="relative">
            <div className="overflow-hidden rounded-web-metric border border-[color:var(--web-device-edge)] bg-milk-50 shadow-card">
                <div className="flex items-center gap-2 border-b border-line-hairline bg-milk-300 px-4 py-2.5">
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-pill bg-stone-100" />
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-pill bg-stone-100" />
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-pill bg-stone-100" />
                    <span className="ml-2 truncate text-xs text-ink-500">sampark.sahayakai.com</span>
                </div>
                <div className="flex">
                    <div aria-hidden="true" className="hidden w-44 shrink-0 space-y-2 border-r border-line-hairline bg-surface-chrome p-3 sm:block">
                        <div className="mb-3 flex items-center gap-2 px-1">
                            <SamparkWordmark />
                        </div>
                        {[t("Today"), t("Campaigns"), t("Calls"), t("Families")].map((label, i) => (
                            <div
                                key={label}
                                className={cn(
                                    "rounded-pill px-3 py-2 text-xs font-semibold",
                                    i === 2 ? "border border-line-glass bg-white text-ink-900" : "text-ink-500",
                                )}
                            >
                                {label}
                            </div>
                        ))}
                    </div>
                    <div className="min-w-0 flex-1 p-4 sm:p-6">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="font-display text-brand font-bold text-ink-900">{t("Calls")}</p>
                            <span className="rounded-pill bg-tint-info px-2.5 py-1 text-xs font-semibold text-indigo-500">{t("Practice — no real calls are made")}</span>
                        </div>
                        <ul className="mt-3 divide-y divide-[color:var(--border-hairline)]">
                            {rows.map((r) => (
                                <li key={r.phone} className="space-y-1 py-2.5">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <span className="min-w-0 text-tile font-semibold text-ink-900">{r.who}</span>
                                        <span className="shrink-0 text-xs tabular-nums text-ink-500">{r.phone}</span>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                        <span className="text-xs text-ink-600">
                                            {r.reason} · <span lang={langCode[r.lang]}>{r.lang}</span>
                                        </span>
                                        <span className="flex items-center gap-2 text-xs font-medium text-ink-600">
                                            <span
                                                aria-hidden="true"
                                                className={cn(
                                                    "h-2 w-2 rounded-pill",
                                                    r.tone === "leaf" ? "bg-leaf-500" : r.tone === "amber" ? "bg-warning" : "bg-stone-500",
                                                )}
                                            />
                                            {r.outcome}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
            <figcaption className="mt-3 text-center text-xs text-ink-500">{t("Sample screen. The families and numbers are illustrative, not real records.")}</figcaption>
        </figure>
    );
}

function Hero({ workspaceHref }: { workspaceHref: string }) {
    const { t } = useLanguage();
    return (
        <section className="relative overflow-hidden bg-milk-200">
            <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px]" style={{ background: "var(--glow-web-saffron)" }} />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -left-40 h-[480px] w-[480px]" style={{ background: "var(--glow-web-indigo)" }} />
            <div className={cn(CONTAINER, "relative grid items-center gap-12 py-16 md:py-24 lg:grid-cols-[1.05fr_1fr]")}>
                <div>
                    <span className="inline-flex items-center gap-2 rounded-pill border border-line-glass bg-[color:var(--web-glass)] px-3 py-1.5 text-xs font-semibold text-ink-600">
                        <span aria-hidden="true" className="h-2 w-2 rounded-pill bg-leaf-500" />
                        {t("School-to-parent calls · part of SahayakAI")}
                    </span>
                    <h1 className="mt-5 font-display text-web-h1 font-bold tracking-[-0.03em] text-ink-900">
                        {t("Reach every family.")} <span className="text-saffron-600">{t("In their own language.")}</span>
                    </h1>
                    <p className="mt-5 max-w-xl text-web-lead text-ink-600">
                        {t("SamparkAI calls parents with your school's notices: PTM invitations, event invitations and emergency closures. Parents hear your school's name, and press a key to answer. Nothing rings until your school switches calls on.")}
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <Link
                            href={workspaceHref}
                            className="focus-ring inline-flex min-h-[52px] items-center gap-2 rounded-pill bg-primary px-6 font-display text-card-title font-semibold text-white shadow-cta transition-transform duration-small ease-standard active:scale-[.98]"
                        >
                            {t("Open workspace")}
                            <ArrowRight aria-hidden="true" strokeWidth={1.7} className="h-4 w-4" />
                        </Link>
                        <a
                            href="#how"
                            className="focus-ring inline-flex min-h-[52px] items-center rounded-pill border border-line-glass bg-[color:var(--web-glass)] px-6 font-display text-card-title font-semibold text-ink-900 transition-colors duration-small ease-standard hover:bg-white"
                        >
                            {t("How it works")}
                        </a>
                    </div>
                    <dl className="mt-10 grid max-w-lg grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
                        {[
                            { value: "3", label: t("notice types ready to send") },
                            { value: "4", label: t("parent languages") },
                            { value: "1", label: t("tap pauses every call") },
                        ].map((m) => (
                            <div key={m.label} className="rounded-web-metric border border-line-glass bg-[color:var(--web-glass)] px-4 py-3">
                                <dt className="sr-only">{m.label}</dt>
                                <dd>
                                    <span className="block font-display text-metric font-bold tracking-[-0.02em] text-ink-900">{m.value}</span>
                                    <span className="mt-1 block text-xs leading-snug text-ink-600" aria-hidden="true">{m.label}</span>
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>
                <WorkspacePreview />
            </div>
        </section>
    );
}

function Section({ id, band = false, eyebrow, title, lead, children }: { id?: string; band?: boolean; eyebrow: string; title: ReactNode; lead?: string; children: ReactNode }) {
    return (
        <section id={id} className={cn("scroll-mt-20 py-[88px] md:py-24", band ? "bg-milk-400" : "bg-milk-200")}>
            <div className={CONTAINER}>
                <div className="max-w-2xl">
                    <Eyebrow>{eyebrow}</Eyebrow>
                    <h2 className="mt-3 font-display text-web-h2 font-bold tracking-[-0.025em] text-ink-900">{title}</h2>
                    {lead && <p className="mt-4 text-web-lead text-ink-600">{lead}</p>}
                </div>
                <div className="mt-12">{children}</div>
            </div>
        </section>
    );
}

function HowItWorks() {
    const { t } = useLanguage();
    const steps = [
        { title: t("Bring in your families"), body: t("Import parents and guardians from your school's records. Each family keeps its language and its calling preferences.") },
        { title: t("Choose the notice and who hears it"), body: t("A PTM invitation, an event invitation or an emergency closure, for the whole school, some classes or some sections.") },
        { title: t("Check what parents will hear"), body: t("Read and play the message in each family's language before anything is scheduled. The notice uses only the details you entered.") },
        { title: t("Start in Practice, then Test"), body: t("Practice makes no calls. Test rings only your school's test phone. Live, which rings parents, is switched on with your SahayakAI contact.") },
        { title: t("See every answer"), body: t("Confirmed, declined, heard, no answer, asked not to be called: each call's outcome in words, with retries and the families still to reach.") },
    ];
    return (
        <Section id="how" eyebrow={t("How it works")} title={<>{t("Five steps.")} {t("You approve each one.")}</>} lead={t("SamparkAI drafts the calls; the school decides who is called, what they hear and when.")}>
            <ol className="grid gap-x-8 gap-y-10 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                {steps.map((s, i) => (
                    <li key={s.title} className="relative">
                        <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-mark bg-tint-mark font-display text-card-title font-bold text-ink-900">
                            {i + 1}
                        </span>
                        <h3 className="mt-4 font-display text-web-h3 font-bold leading-[1.25] tracking-[-0.015em] text-ink-900">{s.title}</h3>
                        <p className="mt-2 text-value text-ink-600">{s.body}</p>
                    </li>
                ))}
            </ol>
        </Section>
    );
}

function Workspace() {
    const { t } = useLanguage();
    const parts = [
        { lead: t("Today."), body: t("What is scheduled, what is calling now and what needs a decision, for one school at a time.") },
        { lead: t("Campaigns."), body: t("Each notice as a campaign: its audience, its schedule, the families not called and why.") },
        { lead: t("Calls."), body: t("One list of every call the school placed, with the reason, the outcome in words, the duration and the time. Numbers show only their last four digits.") },
        { lead: t("Families."), body: t("Every parent and guardian, their language and whether they can be called. A family that asks not to be called is not called again.") },
        { lead: t("Settings."), body: t("School details, calling hours, the calling mode and the connection to your school's records.") },
    ];
    return (
        <Section band eyebrow={t("The workspace")} title={<>{t("One place for the school's calls.")} {t("Nothing hidden.")}</>} lead={t("SamparkAI is the school's own workspace, separate from the teacher's. School administrators sign in with their SahayakAI account.")}>
            <dl className="grid gap-x-12 gap-y-6 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
                {parts.map((p) => (
                    <div key={p.lead} className="border-t border-line-row pt-5">
                        <dt className="font-display text-brand font-bold text-ink-900">{p.lead}</dt>
                        <dd className="mt-1.5 text-value text-ink-600">{p.body}</dd>
                    </div>
                ))}
            </dl>
        </Section>
    );
}

function Safeguards() {
    const { t } = useLanguage();
    const items = [
        { lead: t("Practice first."), body: t("Every school starts in Practice mode, where no real calls are made.") },
        { lead: t("Test on your own phone."), body: t("In Test mode every call rings only the school's test phone.") },
        { lead: t("Calling hours."), body: t("Calls are placed only inside the school's calling hours. Nothing dials outside them.") },
        { lead: t("Pause in one tap."), body: t("Pause all calls for the school at once, and resume when you are ready.") },
        { lead: t("Parents can say no."), body: t("Every call lets the parent ask not to be called again, and that choice is kept.") },
        { lead: t("Administrators only."), body: t("Only a school's administrators can see its families and start its calls. Each request is checked on the server.") },
    ];
    return (
        <Section id="safeguards" eyebrow={t("Safeguards")} title={<>{t("Built to be careful.")} {t("Parents are never surprised.")}</>}>
            <ul className="grid gap-x-12 gap-y-6 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
                {items.map((i) => (
                    <li key={i.lead} className="text-card-title text-ink-600">
                        <strong className="font-semibold text-ink-900">{i.lead}</strong> {i.body}
                    </li>
                ))}
            </ul>
        </Section>
    );
}

function Languages() {
    const { t } = useLanguage();
    const langs = [
        { native: "English", lang: "en" },
        { native: "हिन्दी", lang: "hi" },
        { native: "বাংলা", lang: "bn" },
        { native: "नेपाली", lang: "ne" },
    ];
    return (
        <Section id="languages" band eyebrow={t("Languages")} title={<>{t("Each family hears its own language.")} {t("Set once per family.")}</>} lead={t("Calls are spoken today in four languages. Teachers keep working in all eleven of SahayakAI's languages.")}>
            <ul className="flex flex-wrap gap-3">
                {langs.map((l) => (
                    <li key={l.lang} lang={l.lang} className="rounded-pill border border-line-glass bg-[color:var(--web-glass)] px-5 py-3 font-display text-output-title font-semibold text-ink-900">
                        {l.native}
                    </li>
                ))}
            </ul>
        </Section>
    );
}

function CtaBand({ workspaceHref }: { workspaceHref: string }) {
    const { t } = useLanguage();
    return (
        <section className="bg-milk-200 py-[88px] md:py-24">
            <div className={CONTAINER}>
                <div className="relative overflow-hidden rounded-band px-6 py-14 text-center sm:px-12" style={{ background: "var(--band-cta)" }}>
                    <h2 className="mx-auto max-w-2xl font-display text-web-h2 font-bold tracking-[-0.025em] text-white">
                        {t("Start in Practice mode.")} {t("No family is called until you are ready.")}
                    </h2>
                    <div className="mt-8 flex justify-center">
                        <Link
                            href={workspaceHref}
                            className="inline-flex min-h-[52px] items-center gap-2 rounded-pill bg-white px-6 font-display text-card-title font-semibold text-saffron-700 transition-transform duration-small ease-standard focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[.98]"
                        >
                            {t("Open workspace")}
                            <ArrowRight aria-hidden="true" strokeWidth={1.7} className="h-4 w-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}

function Footer() {
    const { t } = useLanguage();
    const sahayakUrl = useSahayakHref();
    const links = [
        { href: sahayakUrl("/"), label: t("SahayakAI for teachers") },
        { href: sahayakUrl("/for-schools"), label: t("For schools") },
        { href: sahayakUrl("/privacy-for-teachers"), label: t("Privacy") },
        { href: sahayakUrl("/terms"), label: t("Terms") },
    ];
    return (
        <footer className="border-t border-[color:var(--web-hairline)] bg-milk-200">
            <div className={cn(CONTAINER, "flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between")}>
                <div className="space-y-1">
                    <SamparkWordmark />
                    <p className="text-tile text-ink-500">{t("SamparkAI is part of SahayakAI, by SARGVISION Intelligence.")}</p>
                </div>
                <ul className="flex flex-wrap gap-x-5 gap-y-2">
                    {links.map((l) => (
                        <li key={l.label}>
                            <AnyLink href={l.href} className="focus-ring inline-flex min-h-11 items-center gap-1 rounded-pill text-tile font-medium text-ink-500 hover:text-ink-900">
                                {l.label}
                                {isExternalUrl(l.href) && <ArrowUpRight aria-hidden="true" strokeWidth={1.7} className="h-3.5 w-3.5" />}
                            </AnyLink>
                        </li>
                    ))}
                </ul>
            </div>
        </footer>
    );
}

export function SamparkSite() {
    const workspaceHref = useSamparkHref()("/workspace");
    return (
        <div className="min-h-svh bg-milk-200 text-ink-900">
            <WebNav workspaceHref={workspaceHref} />
            <main>
                <Hero workspaceHref={workspaceHref} />
                <HowItWorks />
                <Workspace />
                <Safeguards />
                <Languages />
                <CtaBand workspaceHref={workspaceHref} />
            </main>
            <Footer />
        </div>
    );
}
