'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import type { ComponentType } from 'react';
import Link from 'next/link';
import {
    ArrowRight,
    Calculator,
    Loader2,
    BookOpen,
    ClipboardList,
    Mic,
    Shield,
    MessageCircle,
    BarChart3,
    Building2,
    Crown,
    KeyRound,
    Server,
    FileCheck,
    Wrench,
    Headphones,
    Timer,
    Users,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useSubscription } from '@/hooks/use-subscription';
import { useSearchParams } from 'next/navigation';
import { forceTokenRefresh } from '@/lib/get-auth-token';
import { LandingNav } from '@/components/landing/landing-nav';
import { LandingFooter } from '@/components/landing/landing-footer';
import { ScriptMarks } from '@/components/landing/script-marks';
import { PageAudio } from '@/components/marketing/page-audio';
import { useLanguage } from '@/context/language-context';

type Feature = { icon: ComponentType<{ className?: string }>; text: string };

// What every plan includes — capabilities, no prices. Pricing itself is now
// custom (quoted per school), so this page sells the value and routes to the
// estimator + a demo, rather than publishing per-seat numbers.
const INCLUDED: Feature[] = [
    { icon: BookOpen, text: 'Lesson plans, quizzes, worksheets and rubrics' },
    { icon: Mic, text: 'Your language — voice-first in 11 Indian languages' },
    { icon: ClipboardList, text: 'Your board — NCERT, CBSE and 28 state boards' },
    { icon: MessageCircle, text: 'AI parent messages and parent calls' },
    { icon: BarChart3, text: 'Principal and chain-level impact dashboards' },
    { icon: Shield, text: 'Teacher onboarding, training and priority support' },
];

// What large deployments add on top — chains, government, 250+ teacher schools.
const ENTERPRISE_ADDITIONS: Feature[] = [
    { icon: KeyRound, text: 'SSO and SCIM provisioning (Okta, Azure AD, Google Workspace)' },
    { icon: Server, text: 'Private deployment on your own cloud (AWS, GCP, or on-prem)' },
    { icon: Timer, text: '99.9% uptime SLA with written commitments' },
    { icon: Headphones, text: 'Dedicated customer success manager' },
    { icon: FileCheck, text: 'Audit logs and DPDP compliance reports' },
    { icon: Wrench, text: 'Custom AI fine-tuning on your board and curriculum' },
    { icon: Shield, text: 'API access and ERP integration (Fedena, Campus, custom)' },
    { icon: Users, text: 'Volume pricing that steps down as your chain grows' },
];

const DEMO_URL = 'https://calendly.com/contact-sargvision/30min';
const CONTACT_MAILTO = 'mailto:contact@sargvision.com?subject=SahayakAI%20pricing%20enquiry';

export default function PricingPage() {
    const { t } = useLanguage();
    return (
        <Suspense
            fallback={
                <div className="force-light min-h-screen flex items-center justify-center bg-background">
                    <p className="text-muted-foreground text-sm">{t('Loading pricing…')}</p>
                </div>
            }
        >
            <PricingContent />
        </Suspense>
    );
}

function PricingContent() {
    const { openAuthModal } = useAuth();
    const { plan, refresh } = useSubscription();
    const { t } = useLanguage();
    const searchParams = useSearchParams();
    const status = searchParams.get('status');

    // Post-checkout provisioning can lag the Razorpay redirect, so we keep the
    // success/error banners and a short activation poll for any subscriber sent
    // back here after payment — even though the public purchase UI is hidden
    // while pricing is custom-quoted.
    const [activating, setActivating] = useState(status === 'success' && plan === 'free');
    const [activationTimedOut, setActivationTimedOut] = useState(false);
    const pollRef = useRef<number | null>(null);

    useEffect(() => {
        if (status !== 'success') return;
        if (plan !== 'free') {
            setActivating(false);
            return;
        }

        let attempts = 0;
        const maxAttempts = 20;

        const tick = async () => {
            attempts += 1;
            await forceTokenRefresh();
            await refresh();
            if (attempts >= maxAttempts) {
                setActivationTimedOut(true);
                setActivating(false);
                if (pollRef.current !== null) {
                    window.clearInterval(pollRef.current);
                    pollRef.current = null;
                }
            }
        };

        tick();
        pollRef.current = window.setInterval(tick, 3000);

        return () => {
            if (pollRef.current !== null) {
                window.clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    }, [status]);

    useEffect(() => {
        if (activating && plan !== 'free') {
            setActivating(false);
            if (pollRef.current !== null) {
                window.clearInterval(pollRef.current);
                pollRef.current = null;
            }
        }
    }, [activating, plan]);

    return (
        <div className="force-light flex flex-col min-h-screen bg-background text-foreground">
            <LandingNav onAuthClick={openAuthModal} />

            <div
                className="relative flex-1"
                style={{
                    background:
                        'radial-gradient(ellipse 90% 70% at 50% 40%, hsl(28 75% 94%) 0%, hsl(34 60% 97%) 32%, hsl(40 20% 99.5%) 64%, hsl(40 20% 99.5%) 100%)',
                }}
            >
                <ScriptMarks />

                <main>
                    {/* Post-payment status banners (kept for in-flight subscribers). */}
                    {status === 'success' && activating && (
                        <div className="relative z-10 mx-auto max-w-2xl mt-8 px-6">
                            <div className="flex items-center justify-center gap-3 rounded-surface-md border border-saffron-200 bg-saffron-50 px-4 py-3 text-sm text-saffron-700">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>{t('Payment received. Activating your plan… (up to 60 seconds)')}</span>
                            </div>
                        </div>
                    )}
                    {status === 'success' && !activating && !activationTimedOut && plan !== 'free' && (
                        <div className="relative z-10 mx-auto max-w-2xl mt-8 px-6">
                            <div className="rounded-surface-md border border-saffron-200 bg-saffron-50 px-4 py-3 text-center text-sm text-saffron-700">
                                {t('Your plan is active. You can now use every feature. Welcome aboard.')}
                            </div>
                        </div>
                    )}
                    {status === 'success' && activationTimedOut && plan === 'free' && (
                        <div className="relative z-10 mx-auto max-w-2xl mt-8 px-6">
                            <div className="rounded-surface-md border border-border bg-card px-4 py-3 text-center text-sm text-muted-foreground">
                                {t('Activation is taking longer than usual. Please refresh in a minute. If it persists, contact')}{' '}
                                <a href="mailto:contact@sargvision.com" className="underline">
                                    contact@sargvision.com
                                </a>
                                .
                            </div>
                        </div>
                    )}
                    {status === 'error' && (
                        <div className="relative z-10 mx-auto max-w-2xl mt-8 px-6">
                            <div className="rounded-surface-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
                                {t('Payment could not be verified. If you were charged, please contact')}{' '}
                                <a href="mailto:contact@sargvision.com" className="underline">
                                    contact@sargvision.com
                                </a>
                                .
                            </div>
                        </div>
                    )}

                    {/* Hero */}
                    <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 sm:px-12 pt-14 pb-8">
                        <div className="inline-flex items-center gap-2 text-xs font-medium text-saffron-700 bg-saffron-50 border border-saffron-200 rounded-full px-4 py-1.5 mb-7">
                            <span className="w-1.5 h-1.5 rounded-full bg-saffron" />
                            {t('Pricing, for Indian schools')}
                        </div>

                        <h1 className="font-headline font-extrabold tracking-tight text-4xl sm:text-5xl leading-tight max-w-[22ch] text-foreground">
                            {t('Simple pricing,')}{' '}
                            <span className="italic font-normal text-saffron-700">{t('per teacher.')}</span>
                        </h1>

                        <p className="font-body text-base sm:text-lg text-muted-foreground leading-[1.6] max-w-[56ch] mt-6 mx-auto">
                            {t('₹10,000 per teacher a year — about ₹833 a month, billed annually. Prefer month-to-month, no commitment? ₹1,600 per teacher a month. AI parent calls are billed only for the minutes you use, at ₹4 a minute. Chains and larger schools get a further discount, confirmed in a written quote.')}
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-center w-full sm:w-auto">
                            <Link
                                href="/school-pricing"
                                className="inline-flex items-center justify-center gap-2 text-sm font-medium px-6 py-3 rounded-full bg-saffron text-white shadow-elevated hover:bg-saffron-600 transition-colors cursor-pointer"
                            >
                                <Calculator className="h-4 w-4" strokeWidth={2.2} />
                                {t('Estimate your cost')}
                            </Link>
                            <a
                                href={DEMO_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-2 text-sm font-medium px-6 py-3 rounded-full bg-card border border-border text-foreground hover:bg-muted transition-colors"
                            >
                                {t('Book a school demo')}
                                <ArrowRight className="h-4 w-4" />
                            </a>
                        </div>
                        <p className="mt-4 text-sm font-medium text-muted-foreground">
                            {t('Individual teachers pay the same per-teacher rate. Talk to us to get started.')}
                        </p>
                    </section>

                    {/* What's included — capabilities, no prices. */}
                    <section className="relative z-10 px-6 sm:px-12 pb-8 flex justify-center">
                        <div className="max-w-5xl w-full rounded-surface-lg bg-card border border-border px-6 sm:px-8 py-7 shadow-soft">
                            <div className="text-xs font-bold uppercase tracking-[0.12em] text-saffron-700 mb-4">
                                {t('What every plan includes')}
                            </div>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                                {INCLUDED.map(({ icon: Icon, text }) => (
                                    <li key={text} className="flex items-start gap-3 text-sm text-muted-foreground leading-[1.5]">
                                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-surface-sm bg-saffron-50 text-saffron-700">
                                            <Icon className="h-3 w-3" aria-hidden />
                                        </span>
                                        <span>{t(text)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </section>

                    {/* Estimate rail — routes to the school/chain calculator. */}
                    <section className="relative z-10 px-6 sm:px-12 pb-8 flex justify-center">
                        <div className="max-w-5xl w-full flex flex-col md:flex-row md:items-center md:justify-between gap-5 rounded-surface-lg bg-saffron-50 border border-saffron-200 px-6 sm:px-8 py-6 shadow-soft">
                            <div className="flex items-start gap-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-surface-md bg-card text-saffron-700 border border-saffron-200">
                                    <Calculator className="h-4 w-4" />
                                </div>
                                <div>
                                    <div className="text-xs font-bold uppercase tracking-[0.1em] text-saffron-700 mb-1">
                                        {t('Schools and chains')}
                                    </div>
                                    <div className="font-headline font-semibold text-lg text-foreground leading-tight">
                                        {t('See your cost — and what your school gets back')}
                                    </div>
                                    <div className="mt-1.5 text-sm text-muted-foreground leading-[1.55]">
                                        {t('Enter your teacher count and average salary. The calculator shows your annual cost next to the far larger value your teachers get back in reclaimed time.')}
                                    </div>
                                </div>
                            </div>
                            <Link
                                href="/school-pricing"
                                className="inline-flex items-center justify-center gap-2 text-sm font-medium px-6 py-3 rounded-full bg-saffron text-white shadow-elevated hover:bg-saffron-600 transition-colors cursor-pointer shrink-0"
                            >
                                {t('Open the calculator')}
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </section>

                    {/* Enterprise / chains / government. */}
                    <section className="relative z-10 px-6 sm:px-12 pb-16 flex justify-center">
                        <div className="max-w-5xl w-full rounded-surface-lg bg-card border border-border px-6 sm:px-8 py-6 shadow-soft">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-surface-md bg-saffron-50 text-saffron-700">
                                        <Crown className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-[0.1em] text-saffron-700 mb-1">
                                            {t('For chains, government and large schools')}
                                        </div>
                                        <div className="font-headline font-semibold text-lg text-foreground leading-tight">
                                            {t('Custom agreement, enterprise security, private deployment')}
                                        </div>
                                        <div className="mt-1.5 text-sm text-muted-foreground leading-[1.55]">
                                            {t('For 250+ teacher schools, chains and government tenders. Pricing steps down with volume and is confirmed in writing.')}
                                        </div>
                                    </div>
                                </div>
                                <a
                                    href={CONTACT_MAILTO}
                                    className="inline-flex items-center justify-center gap-2 text-sm font-medium px-6 py-3 rounded-full bg-saffron text-white shadow-elevated hover:bg-saffron-600 transition-colors cursor-pointer shrink-0"
                                >
                                    {t('Contact SARGVISION')}
                                    <ArrowRight className="h-4 w-4" />
                                </a>
                            </div>

                            <div className="mt-6 pt-5 border-t border-border">
                                <div className="text-xs font-bold uppercase tracking-[0.12em] text-saffron-700 mb-3">
                                    {t('What large deployments add')}
                                </div>
                                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
                                    {ENTERPRISE_ADDITIONS.map(({ icon: Icon, text }) => (
                                        <li key={text} className="flex items-start gap-3 text-sm text-muted-foreground leading-[1.5]">
                                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-surface-sm bg-saffron-50 text-saffron-700">
                                                <Icon className="h-3 w-3" aria-hidden />
                                            </span>
                                            <span>{t(text)}</span>
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-4 text-sm text-muted-foreground leading-[1.55]">
                                    {t('Engaging with state education stakeholders and Tier 2 school chains in Karnataka and Telangana.')}
                                </p>
                            </div>
                        </div>
                    </section>

                    <p className="relative z-10 pb-14 mx-auto max-w-xl px-6 text-center text-sm text-muted-foreground leading-[1.55]">
                        {t('Every figure on the calculator is indicative. Your final rate is set in a written quote after a short call.')}
                    </p>
                </main>
            </div>

            <LandingFooter />
            <PageAudio />
        </div>
    );
}
