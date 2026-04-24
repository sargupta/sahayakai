'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import type { ComponentType } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    ArrowRight,
    Crown,
    Loader2,
    BookOpen,
    ClipboardList,
    Mic,
    Shield,
    Download,
    MessageCircle,
    BarChart3,
    Sparkles,
    Zap,
    Users,
    HeartHandshake,
    Building2,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useSubscription } from '@/hooks/use-subscription';
import { useSearchParams } from 'next/navigation';
import { PLAN_PRICING } from '@/lib/plan-config';
import { forceTokenRefresh } from '@/lib/get-auth-token';
import { LandingNav } from '@/components/landing/landing-nav';
import { LandingFooter } from '@/components/landing/landing-footer';
import { ScriptMarks } from '@/components/landing/script-marks';
import { PageAudio } from '@/components/marketing/page-audio';
import { useLanguage } from '@/context/language-context';

type Feature = { icon: ComponentType<{ className?: string }>; text: string };

// Feature copy uses plain verbs and specific numbers. Avoids jargon like
// "Copilot", "Gemini 2.0 Flash", "Sarvam cloud" — rural teacher should parse
// these at a glance without needing a tech background.
const FREE_FEATURES: Feature[] = [
    { icon: BookOpen, text: '10 lesson plans per month' },
    { icon: ClipboardList, text: '5 quizzes + 5 worksheets per month' },
    { icon: Zap, text: '20 instant answers per day' },
    { icon: Mic, text: 'Voice in 11 Indian languages' },
    { icon: Users, text: 'Community library access' },
    { icon: BarChart3, text: 'Basic impact dashboard' },
];

const PRO_FEATURES: Feature[] = [
    { icon: Sparkles, text: 'All 6 tools unlocked' },
    { icon: BookOpen, text: '25 lesson plans per month' },
    { icon: ClipboardList, text: 'Unlimited worksheets and rubrics' },
    { icon: Zap, text: 'Unlimited instant answers' },
    { icon: Mic, text: '300 voice cloud minutes per month' },
    { icon: Download, text: 'Download as PDF or Word (no watermark)' },
    { icon: MessageCircle, text: 'AI-powered parent messages' },
    { icon: BarChart3, text: 'Detailed impact dashboard' },
];

const GOLD_FEATURES: Feature[] = [
    { icon: Sparkles, text: 'Everything in Pro, unlimited' },
    { icon: Shield, text: 'Principal dashboard + teacher onboarding' },
    { icon: Mic, text: '1,500 voice cloud minutes per teacher' },
    { icon: MessageCircle, text: 'WhatsApp Business integration' },
    { icon: HeartHandshake, text: 'Priority support in your timezone' },
    { icon: Building2, text: 'Volume discount for 50+ teachers' },
    { icon: Users, text: 'One-time onboarding and training' },
];

const inr = (n: number) => n.toLocaleString('en-IN');

export default function PricingPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center">
                    <p className="text-neutral-500 text-sm">Loading pricing…</p>
                </div>
            }
        >
            <PricingContent />
        </Suspense>
    );
}

function PricingContent() {
    const { user, openAuthModal } = useAuth();
    const { plan, loading, refresh } = useSubscription();
    const { t } = useLanguage();
    const searchParams = useSearchParams();
    const status = searchParams.get('status');
    // Default to monthly — lower upfront commitment, easier conversion for B2C freemium.
    // The SAVE 2 MONTHS pill next to the toggle nudges toward annual.
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
    const [creating, setCreating] = useState(false);

    const [activating, setActivating] = useState(status === 'success' && plan === 'free');
    const [activationTimedOut, setActivationTimedOut] = useState(false);
    const pollRef = useRef<number | null>(null);

    useEffect(() => {
        if (status !== 'success') return;
        if (!user) return;
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, user?.uid]);

    useEffect(() => {
        if (activating && plan !== 'free') {
            setActivating(false);
            if (pollRef.current !== null) {
                window.clearInterval(pollRef.current);
                pollRef.current = null;
            }
        }
    }, [activating, plan]);

    const [emailDialogPlan, setEmailDialogPlan] = useState<string | null>(null);
    const [emailInput, setEmailInput] = useState('');
    const [emailError, setEmailError] = useState<string | null>(null);

    const handleSubscribe = async (planKey: string) => {
        if (!user) {
            setEmailDialogPlan(planKey);
            setEmailError(null);
            return;
        }

        setCreating(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/billing/create-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ planKey }),
            });

            const data = await res.json();
            if (data.shortUrl) {
                window.location.href = data.shortUrl;
            } else {
                alert('Failed to create subscription. Please try again.');
            }
        } catch {
            alert('Something went wrong. Please try again.');
        } finally {
            setCreating(false);
        }
    };

    const handlePublicCheckout = async () => {
        if (!emailDialogPlan) return;

        const email = emailInput.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setEmailError('Please enter a valid email address.');
            return;
        }

        setCreating(true);
        setEmailError(null);
        try {
            const res = await fetch('/api/billing/create-public-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, planKey: emailDialogPlan }),
            });

            const data = await res.json();
            if (res.ok && data.shortUrl) {
                window.location.href = data.shortUrl;
            } else {
                setEmailError(data.error || 'Could not start checkout. Please try again.');
            }
        } catch {
            setEmailError('Network error. Please check your connection and try again.');
        } finally {
            setCreating(false);
        }
    };

    const proPricing = billingPeriod === 'monthly' ? PLAN_PRICING.pro.monthly : PLAN_PRICING.pro.annual;
    const proPlanKey = billingPeriod === 'monthly' ? 'pro_monthly' : 'pro_annual';

    return (
        <div className="flex flex-col min-h-screen">
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
                {/* Status banners */}
                {status === 'success' && activating && (
                    <div className="relative z-10 mx-auto max-w-[720px] mt-8 px-6">
                        <div className="flex items-center justify-center gap-3 rounded-[12px] border border-saffron-200 bg-saffron-50 px-4 py-3 text-[13px] text-saffron-700">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Payment received. Activating your Pro plan… (up to 60 seconds)</span>
                        </div>
                    </div>
                )}
                {status === 'success' && !activating && !activationTimedOut && plan !== 'free' && (
                    <div className="relative z-10 mx-auto max-w-[720px] mt-8 px-6">
                        <div className="rounded-[12px] border border-saffron-200 bg-saffron-50 px-4 py-3 text-center text-[13px] text-saffron-700">
                            {plan === 'pro' && 'Pro plan activated. You can now use every feature. Welcome aboard.'}
                            {plan === 'gold' && 'School Gold activated. Your whole school now has access. Welcome aboard.'}
                            {plan === 'premium' && 'School Premium activated. Your custom plan is live. Welcome aboard.'}
                        </div>
                    </div>
                )}
                {status === 'success' && activationTimedOut && plan === 'free' && (
                    <div className="relative z-10 mx-auto max-w-[720px] mt-8 px-6">
                        <div className="rounded-[12px] border border-neutral-200 bg-white px-4 py-3 text-center text-[13px] text-neutral-700">
                            Activation is taking longer than usual. Please refresh the page in a minute. If the problem persists, contact{' '}
                            <a href="mailto:contact@sargvision.com" className="underline">
                                contact@sargvision.com
                            </a>
                            .
                        </div>
                    </div>
                )}
                {status === 'error' && (
                    <div className="relative z-10 mx-auto max-w-[720px] mt-8 px-6">
                        <div className="rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-center text-[13px] text-red-700">
                            Payment could not be verified. If you were charged, please contact{' '}
                            <a href="mailto:contact@sargvision.com" className="underline">
                                contact@sargvision.com
                            </a>
                            .
                        </div>
                    </div>
                )}

                {/* Hero */}
                <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 sm:px-12 pt-[52px] pb-8">
                    <div className="inline-flex items-center gap-2 text-[12px] font-medium text-saffron-700 bg-saffron-50 border border-saffron-200 rounded-full px-[14px] py-[6px] mb-7">
                        <span className="w-1.5 h-1.5 rounded-full bg-saffron" />
                        {t('Pricing, for Indian teachers')}
                    </div>

                    <h1 className="font-headline font-extrabold tracking-tight text-[42px] sm:text-[54px] leading-[1.05] max-w-[24ch] text-foreground">
                        {t('Less than a textbook.')}{' '}
                        <span className="italic font-normal text-saffron-700">{t('Yours to cancel anytime.')}</span>
                    </h1>

                    <p className="font-body text-[16px] sm:text-[17px] text-neutral-600 leading-[1.55] max-w-[58ch] mt-6 mx-auto">
                        {t('Every plan includes NCERT and 28 state boards, 11 Indian languages, and voice-first input on any Android phone.')}
                    </p>
                </section>

                {/* Billing toggle + prominent savings pill (conversion nudge toward annual). */}
                <div className="relative z-10 flex items-center justify-center gap-3 mt-2 flex-wrap">
                    <div
                        role="radiogroup"
                        aria-label={t('Monthly') + ' / ' + t('Annual')}
                        className="inline-flex items-center rounded-full border border-black/10 bg-white/70 backdrop-blur p-[3px]"
                    >
                        <BillingToggle
                            active={billingPeriod === 'monthly'}
                            onClick={() => setBillingPeriod('monthly')}
                            label={t('Monthly')}
                        />
                        <BillingToggle
                            active={billingPeriod === 'annual'}
                            onClick={() => setBillingPeriod('annual')}
                            label={t('Annual')}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setBillingPeriod('annual')}
                        aria-label={t('Save 2 months')}
                        className={`inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.1em] rounded-full px-[12px] py-[6px] transition-all cursor-pointer ${
                            billingPeriod === 'annual'
                                ? 'bg-saffron-50 text-saffron-700 border border-saffron-200'
                                : 'bg-saffron text-white shadow-[0_10px_22px_-8px_hsl(28_70%_45%/0.5)] hover:bg-saffron-600'
                        }`}
                    >
                        <Sparkles className="h-3 w-3" strokeWidth={2.4} />
                        {t('Save 2 months')}
                    </button>
                </div>

                {/* Tier columns */}
                <section className="relative z-10 px-6 sm:px-12 py-12 flex justify-center">
                    <div className="max-w-[960px] w-full grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-0 md:divide-x md:divide-black/10">
                        {/* Free */}
                        <TierColumn>
                            <TierName name={t('Free')} />
                            <TierPrice amount="₹0" unit={t('forever')} emphasis={false} />
                            {plan === 'free' ? (
                                <YourPlanChip />
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => (user ? undefined : openAuthModal())}
                                    className="mt-5 self-start text-[13px] font-medium text-neutral-600 hover:text-foreground transition-colors"
                                >
                                    {user ? t('Start here') : `${t('Start free')} →`}
                                </button>
                            )}
                            <FeatureList items={FREE_FEATURES} />
                        </TierColumn>

                        {/* Pro — emphasized */}
                        <TierColumn>
                            <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-saffron-700 mb-1">
                                {t('Most popular')}
                            </div>
                            <TierName name={t('Pro')} />
                            <TierPrice
                                amount={`₹${inr(proPricing.rupees)}`}
                                unit={billingPeriod === 'monthly' ? t('/month') : t('/year')}
                                sticker={`₹${inr(proPricing.stickerRupees)}`}
                                emphasis
                            />
                            <div className="mt-1 text-[12px] text-saffron-700 font-medium">
                                {t('Tax included')} · {t('7-day refund. Cancel anytime.')}
                            </div>
                            {plan === 'pro' ? (
                                <YourPlanChip />
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => handleSubscribe(proPlanKey)}
                                    disabled={creating || loading}
                                    className="mt-5 self-start inline-flex items-center justify-center gap-2 text-[13px] font-medium px-[18px] py-[11px] rounded-full bg-saffron text-white shadow-[0_14px_28px_-12px_hsl(28_70%_45%/0.45)] hover:bg-saffron-600 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {creating ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            {t('Start Pro')}…
                                        </>
                                    ) : (
                                        <>
                                            {t('Start Pro')}
                                            <ArrowRight className="h-3.5 w-3.5" />
                                        </>
                                    )}
                                </button>
                            )}
                            <FeatureList items={PRO_FEATURES} />
                        </TierColumn>

                        {/* School Gold */}
                        <TierColumn>
                            <TierName name={t('School Gold')} />
                            <TierPrice
                                amount={`₹${inr(PLAN_PRICING.gold.annual.rupees)}`}
                                unit={t('/teacher/year')}
                                sticker={`₹${inr(PLAN_PRICING.gold.annual.stickerRupees)}`}
                                emphasis={false}
                            />
                            <div className="mt-1 text-[12px] text-neutral-500">
                                Minimum 20 teachers · billed annually · {t('Tax included')} for GST-registered schools
                            </div>
                            {plan === 'gold' ? (
                                <YourPlanChip />
                            ) : (
                                <a
                                    href="https://calendly.com/contact-sargvision/30min"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-5 self-start inline-flex items-center justify-center gap-2 text-[13px] font-medium px-[18px] py-[11px] rounded-full bg-white border border-black/15 text-foreground hover:bg-black/5 transition-colors"
                                >
                                    {t('Book a school demo')}
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </a>
                            )}
                            <FeatureList items={GOLD_FEATURES} />
                        </TierColumn>
                    </div>
                </section>

                {/* School Premium — editorial rail */}
                <section className="relative z-10 px-6 sm:px-12 pb-16 flex justify-center">
                    <div className="max-w-[960px] w-full flex flex-col md:flex-row md:items-center md:justify-between gap-5 rounded-[14px] bg-white border border-black/5 px-6 sm:px-8 py-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-saffron-50 text-saffron-700">
                                <Crown className="h-4 w-4" />
                            </div>
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-saffron-700 mb-1">
                                    {t('School Premium')}
                                </div>
                                <div className="font-headline font-semibold text-[18px] text-foreground leading-tight">
                                    Chains, government &amp; 250+ schools
                                </div>
                                <div className="mt-1.5 text-[13px] text-neutral-600 leading-[1.55]">
                                    {PLAN_PRICING.premium.annual.label} · custom agreement · dedicated support · private deployment options.
                                </div>
                                <div className="mt-1.5 text-[12px] text-neutral-500">
                                    Engaging with state education stakeholders and Tier 2 school chains in Karnataka and Telangana.
                                </div>
                            </div>
                        </div>
                        <a
                            href="mailto:contact@sargvision.com?subject=SahayakAI%20School%20Premium%20Enquiry"
                            className="inline-flex items-center justify-center gap-2 text-[13px] font-medium px-[18px] py-[11px] rounded-full bg-saffron text-white shadow-[0_14px_28px_-12px_hsl(28_70%_45%/0.45)] hover:bg-saffron-600 transition-colors cursor-pointer shrink-0"
                        >
                            Contact SARGVISION
                            <ArrowRight className="h-3.5 w-3.5" />
                        </a>
                    </div>
                </section>

                <p className="relative z-10 pb-14 mx-auto max-w-[640px] px-6 text-center text-[12px] text-neutral-500 leading-[1.55]">
                    {t('7-day refund. Cancel anytime.')} Launch pricing valid through 2026 for the first 10,000 teachers.
                </p>
                </main>
            </div>

            <LandingFooter />
            <PageAudio />

            {/* Public checkout email dialog */}
            <Dialog
                open={emailDialogPlan !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setEmailDialogPlan(null);
                        setEmailError(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Just your email to continue</DialogTitle>
                        <DialogDescription>
                            We&apos;ll email you a one-click sign-in link after payment. No password to remember.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 py-2">
                        <Label htmlFor="checkout-email">Email address</Label>
                        <Input
                            id="checkout-email"
                            type="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !creating) {
                                    e.preventDefault();
                                    handlePublicCheckout();
                                }
                            }}
                            disabled={creating}
                            aria-invalid={!!emailError}
                        />
                        {emailError && (
                            <p className="text-sm text-red-600">{emailError}</p>
                        )}
                    </div>
                    <DialogFooter className="gap-2 sm:justify-end">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setEmailDialogPlan(null);
                                setEmailError(null);
                            }}
                            disabled={creating}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handlePublicCheckout}
                            disabled={creating || !emailInput.trim()}
                            className="bg-saffron hover:bg-saffron-600 text-white"
                        >
                            {creating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Starting…
                                </>
                            ) : (
                                <>
                                    Continue to payment
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ---- Editorial pricing sub-components ----

function BillingToggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            role="radio"
            aria-checked={active}
            aria-label={`Bill ${label.toLowerCase()}`}
            className={`text-[13px] font-medium px-[16px] py-[7px] rounded-full transition-colors cursor-pointer ${
                active
                    ? 'bg-saffron text-white shadow-[0_6px_14px_-6px_hsl(28_70%_45%/0.4)]'
                    : 'text-neutral-500 hover:text-foreground'
            }`}
        >
            {label}
        </button>
    );
}

function TierColumn({ children }: { children: React.ReactNode }) {
    return <div className="flex flex-col px-0 md:px-8 first:md:pl-0 last:md:pr-0">{children}</div>;
}

function TierName({ name }: { name: string }) {
    return <h2 className="font-headline font-semibold text-[16px] text-foreground">{name}</h2>;
}

function TierPrice({
    amount,
    unit,
    sticker,
    emphasis,
}: {
    amount: string;
    unit: string;
    sticker?: string;
    emphasis: boolean;
}) {
    return (
        <div className="mt-3">
            {sticker && (
                <div className="text-[12px] text-neutral-400 line-through mb-0.5">{sticker}</div>
            )}
            <div className="flex items-baseline gap-1.5">
                <span
                    className={`font-headline font-extrabold tracking-tight ${
                        emphasis ? 'text-[44px] text-saffron-700 leading-none' : 'text-[32px] text-foreground leading-none'
                    }`}
                >
                    {amount}
                </span>
                <span className="text-[13px] text-neutral-500">{unit}</span>
            </div>
        </div>
    );
}

function FeatureList({ items }: { items: readonly Feature[] }) {
    return (
        <ul className="mt-6 space-y-3">
            {items.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2.5 text-[13px] text-neutral-700 leading-[1.5]">
                    <span className="mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-saffron-50 text-saffron-700">
                        <Icon className="h-3 w-3" aria-hidden />
                    </span>
                    <span>{text}</span>
                </li>
            ))}
        </ul>
    );
}

function YourPlanChip() {
    const { t } = useLanguage();
    return (
        <div className="mt-5 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-saffron-700 self-start">
            <span className="w-1.5 h-1.5 rounded-full bg-saffron" />
            {t('Your plan')}
        </div>
    );
}
