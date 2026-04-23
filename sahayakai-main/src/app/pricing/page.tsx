'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Sparkles, School, ArrowRight, Crown, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useSubscription } from '@/hooks/use-subscription';
import { useSearchParams } from 'next/navigation';
import { PLAN_PRICING } from '@/lib/plan-config';
import { forceTokenRefresh } from '@/lib/get-auth-token';

const FREE_FEATURES = [
    '10 lesson plans / month',
    '5 quizzes & worksheets / month',
    'Instant Answer (20/day)',
    'Voice in 11 Indian languages (browser)',
    'Community library access',
    'Basic Impact Dashboard',
];

const PRO_FEATURES = [
    'Full AI Teacher Copilot — all 6 pillars',
    '25 lesson plans / month',
    '15 quizzes / month',
    'Unlimited worksheets, rubrics & Instant Answer',
    'Premium AI model (Gemini 2.0 Flash)',
    'Voice cloud (Sarvam) — 300 minutes / month',
    'PDF / DOCX export without watermark',
    'Student absence records + AI parent messaging',
    'Detailed Impact Dashboard + analytics',
];

const GOLD_FEATURES = [
    'Everything in Pro — unlimited usage',
    'School admin dashboard + teacher onboarding',
    '1,500 voice cloud minutes / teacher / month',
    'WhatsApp Business integration',
    'Priority Indian-timezone support',
    'Volume pricing: 20-49 ₹2,999 · 50-99 ₹2,499 · 100-249 ₹1,999 · 250+ custom',
    '₹10,000 one-time onboarding + training',
];

// INR formatter for sticker display (₹29,988 etc).
const inr = (n: number) => n.toLocaleString('en-IN');

export default function PricingPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading pricing...</p></div>}>
            <PricingContent />
        </Suspense>
    );
}

function PricingContent() {
    const { user } = useAuth();
    const { plan, loading, refresh } = useSubscription();
    const searchParams = useSearchParams();
    const status = searchParams.get('status');
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual');
    const [creating, setCreating] = useState(false);

    // G2 + G3 — Post-payment activation flow.
    //
    // When Razorpay redirects us back to /pricing?status=success the server
    // webhook may still be writing the custom claim. Three things have to
    // happen before the dashboard will actually unlock Pro features:
    //   1. Razorpay webhook fires subscription.charged (5-30s typical)
    //   2. Webhook writes planType=pro to Firestore + Firebase custom claim
    //   3. Client force-refreshes its Firebase ID token so the new claim
    //      lands in middleware's x-user-plan header
    //
    // Until #3 the client is split-brain: useSubscription may already report
    // isPro=true (it reads Firestore via /api/usage) while gated API routes
    // still see a stale JWT and return 403. Force-refreshing fixes it.
    //
    // We poll every 3s for up to 60s: each tick force-refreshes the token
    // (so a newly-written claim lands ASAP) and re-fetches useSubscription.
    // Gives up after 20 attempts and shows a "please refresh" message.
    const [activating, setActivating] = useState(status === 'success' && plan === 'free');
    const [activationTimedOut, setActivationTimedOut] = useState(false);
    const pollRef = useRef<number | null>(null);

    useEffect(() => {
        if (status !== 'success') return;
        if (!user) return;
        if (plan !== 'free') {
            // Plan already upgraded — we're done
            setActivating(false);
            return;
        }

        let attempts = 0;
        const maxAttempts = 20; // 20 × 3s = 60s

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

        // Kick off an immediate first attempt, then every 3s
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

    // Close the activating overlay once useSubscription reports the paid plan.
    useEffect(() => {
        if (activating && plan !== 'free') {
            setActivating(false);
            if (pollRef.current !== null) {
                window.clearInterval(pollRef.current);
                pollRef.current = null;
            }
        }
    }, [activating, plan]);

    // --- Public checkout state (unauthed Start Pro flow) ---
    // When a visitor clicks "Start Pro" without being signed in we show an
    // email dialog instead of dumping them on the homepage. They pay on
    // Razorpay, then receive a passwordless sign-in link (sent by the
    // webhook after provisioning). See /api/billing/create-public-subscription.
    const [emailDialogPlan, setEmailDialogPlan] = useState<string | null>(null);
    const [emailInput, setEmailInput] = useState('');
    const [emailError, setEmailError] = useState<string | null>(null);

    const handleSubscribe = async (planKey: string) => {
        if (!user) {
            // Anonymous visitor — collect email and kick off public checkout
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
                // Redirect to Razorpay checkout
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

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 px-4 py-12">
            <div className="mx-auto max-w-4xl">
                {status === 'success' && activating && (
                    <div className="mb-8 flex items-center justify-center gap-3 rounded-lg bg-amber-50 p-4 text-center text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>
                            Payment received — activating your Pro plan… (up to 60 seconds)
                        </span>
                    </div>
                )}
                {status === 'success' && !activating && !activationTimedOut && plan !== 'free' && (
                    <div className="mb-8 rounded-lg bg-green-50 p-4 text-center text-green-800 dark:bg-green-950 dark:text-green-200">
                        Pro plan activated. You can now use every feature — welcome aboard.
                    </div>
                )}
                {status === 'success' && activationTimedOut && plan === 'free' && (
                    <div className="mb-8 rounded-lg bg-amber-50 p-4 text-center text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                        Activation is taking longer than usual. Please refresh the page in a minute.
                        If the problem persists, contact{' '}
                        <a href="mailto:contact@sargvision.com" className="underline">
                            contact@sargvision.com
                        </a>
                        .
                    </div>
                )}
                {status === 'error' && (
                    <div className="mb-8 rounded-lg bg-red-50 p-4 text-center text-red-800 dark:bg-red-950 dark:text-red-200">
                        Payment could not be verified. If you were charged, please contact{' '}
                        <a href="mailto:contact@sargvision.com" className="underline">
                            contact@sargvision.com
                        </a>
                        .
                    </div>
                )}

                <div className="mb-10 text-center">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
                        <Sparkles className="h-3 w-3" />
                        Launch pricing · First 10,000 teachers · Through 2026
                    </div>
                    <h1 className="font-headline text-3xl font-bold tracking-tight md:text-5xl">
                        The AI Teacher Copilot.
                        <br className="hidden md:block" />
                        <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                            {' '}Priced for Bharat.
                        </span>
                    </h1>
                    <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground md:text-base">
                        Full 6-pillar copilot. NCERT + state boards. 11 Indian languages.
                        <br className="hidden md:block" />
                        Save ₹389/year with annual — ₹167/month. Less than a textbook.
                    </p>
                </div>

                {/* Billing toggle */}
                <div className="mb-8 flex items-center justify-center gap-3">
                    <button
                        onClick={() => setBillingPeriod('monthly')}
                        className={`rounded-xl px-4 py-1.5 text-sm font-medium transition-colors ${billingPeriod === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Monthly
                    </button>
                    <button
                        onClick={() => setBillingPeriod('annual')}
                        className={`rounded-xl px-4 py-1.5 text-sm font-medium transition-colors ${billingPeriod === 'annual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Annual <span className="text-xs opacity-75">(save 30%)</span>
                    </button>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    {/* Free */}
                    <Card className={`relative ${plan === 'free' ? 'ring-2 ring-primary' : ''}`}>
                        <CardHeader>
                            <CardTitle className="font-headline text-lg">Free</CardTitle>
                            <div className="mt-2">
                                <span className="font-headline text-3xl font-bold">₹0</span>
                                <span className="text-muted-foreground">/month</span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2">
                                {FREE_FEATURES.map((f) => (
                                    <li key={f} className="flex items-start gap-2 text-sm">
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            {plan === 'free' && (
                                <div className="mt-4 rounded-md bg-muted p-2 text-center text-sm text-muted-foreground">
                                    Current plan
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Pro — the headline anchored card */}
                    <Card className={`relative ring-2 ring-amber-500/50 shadow-elevated ${plan === 'pro' ? 'ring-amber-500/80' : ''}`}>
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-0.5 text-xs font-semibold text-white shadow-sm">
                            Most Popular · {billingPeriod === 'monthly'
                                ? `${PLAN_PRICING.pro.monthly.discountPct}% OFF`
                                : `${PLAN_PRICING.pro.annual.discountPct}% OFF`}
                        </div>
                        <CardHeader>
                            <CardTitle className="font-headline flex items-center gap-2 text-lg">
                                <Sparkles className="h-5 w-5 text-amber-500" />
                                Pro — Individual Teacher
                            </CardTitle>
                            <div className="mt-3">
                                {/* Sticker (crossed-out anchor) */}
                                <div className="text-sm text-muted-foreground line-through">
                                    ₹{inr(
                                        billingPeriod === 'monthly'
                                            ? PLAN_PRICING.pro.monthly.stickerRupees
                                            : PLAN_PRICING.pro.annual.stickerRupees
                                    )}
                                    /{billingPeriod === 'monthly' ? 'month' : 'year'}
                                </div>
                                {/* Launch price */}
                                <div className="mt-0.5">
                                    <span className="font-headline text-4xl font-bold text-amber-600">
                                        ₹{inr(
                                            billingPeriod === 'monthly'
                                                ? PLAN_PRICING.pro.monthly.rupees
                                                : PLAN_PRICING.pro.annual.rupees
                                        )}
                                    </span>
                                    <span className="ml-1 text-muted-foreground">
                                        /{billingPeriod === 'monthly' ? 'month' : 'year'}
                                    </span>
                                </div>
                                {billingPeriod === 'annual' && (
                                    <div className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                                        ≈ ₹{PLAN_PRICING.pro.annual.effectivePerMonthRupees}/month
                                        · Save ₹{inr(PLAN_PRICING.pro.monthly.rupees * 12 - PLAN_PRICING.pro.annual.rupees)} vs monthly
                                    </div>
                                )}
                                <div className="mt-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                                    {billingPeriod === 'monthly'
                                        ? PLAN_PRICING.pro.monthly.badge
                                        : PLAN_PRICING.pro.annual.badge}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2">
                                {PRO_FEATURES.map((f) => (
                                    <li key={f} className="flex items-start gap-2 text-sm">
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            {plan === 'pro' ? (
                                <div className="mt-4 rounded-md bg-amber-50 p-2 text-center text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                                    Current plan
                                </div>
                            ) : (
                                <Button
                                    className="mt-4 w-full rounded-xl bg-amber-600 hover:bg-amber-700"
                                    onClick={() => handleSubscribe(billingPeriod === 'monthly' ? 'pro_monthly' : 'pro_annual')}
                                    disabled={creating || loading}
                                >
                                    {creating ? 'Processing…' : `Start Pro — ₹${inr(
                                        billingPeriod === 'monthly'
                                            ? PLAN_PRICING.pro.monthly.rupees
                                            : PLAN_PRICING.pro.annual.rupees
                                    )}`}
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            )}
                        </CardContent>
                    </Card>

                    {/* School Gold — the real B2B revenue play */}
                    <Card className="relative border-neutral-200">
                        <CardHeader>
                            <CardTitle className="font-headline flex items-center gap-2 text-lg">
                                <School className="h-5 w-5 text-orange-600" />
                                School Gold
                            </CardTitle>
                            <div className="mt-3">
                                <div className="text-sm text-muted-foreground line-through">
                                    ₹{inr(PLAN_PRICING.gold.annual.stickerRupees)}/teacher/year
                                </div>
                                <div className="mt-0.5">
                                    <span className="font-headline text-3xl font-bold">
                                        ₹{inr(PLAN_PRICING.gold.annual.rupees)}
                                    </span>
                                    <span className="ml-1 text-sm text-muted-foreground">
                                        /teacher/year
                                    </span>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    ≈ ₹{Math.round(PLAN_PRICING.gold.annual.rupees / 12)}/teacher/month · billed annually
                                </div>
                                <div className="mt-2 inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-800 dark:bg-orange-950/40 dark:text-orange-200">
                                    {PLAN_PRICING.gold.annual.badge}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2 text-sm">
                                {GOLD_FEATURES.map((f) => (
                                    <li key={f} className="flex items-start gap-2">
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <Button variant="outline" className="mt-4 w-full rounded-xl border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800" asChild>
                                <a
                                    href="https://calendly.com/contact-sargvision/30min"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Book a school demo
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* School Premium — full-width enterprise rail below the 3 cards */}
                <div className="mt-6">
                    <Card className="border-neutral-200 bg-gradient-to-br from-amber-50/50 via-white to-orange-50/50 dark:from-amber-950/20 dark:via-background dark:to-orange-950/20">
                        <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-start gap-4">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                                    <Crown className="h-5 w-5" />
                                </div>
                                <div>
                                    <div className="font-headline text-lg font-bold">
                                        School Premium — Chains, Govt & 250+ Schools
                                    </div>
                                    <div className="mt-1 text-sm text-muted-foreground">
                                        {PLAN_PRICING.premium.annual.label} · custom MoU for government &amp; chains · dedicated CSM · private deployment options.
                                    </div>
                                    <div className="mt-2 text-xs text-muted-foreground">
                                        Current pilots: Karnataka Govt · Chanakya University · Dr. Ramdas Pai Chair on Education
                                    </div>
                                </div>
                            </div>
                            <Button className="shrink-0 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-700 hover:to-orange-700" asChild>
                                <a
                                    href="mailto:contact@sargvision.com?subject=SahayakAI%20School%20Premium%20Enquiry"
                                >
                                    Contact SARGVISION
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <p className="mt-8 text-center text-xs text-muted-foreground">
                    Individual plans include 18% GST · School plans billed exclusive of GST (ITC claimable).
                    Cancel anytime. 7-day refund guarantee. Launch pricing valid through 2026 for the first 10,000 teachers.
                </p>
            </div>

            {/* Public checkout email dialog — shown when an unauthed visitor clicks Start Pro */}
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
                            <p className="text-sm text-red-600 dark:text-red-400">{emailError}</p>
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
                            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
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
