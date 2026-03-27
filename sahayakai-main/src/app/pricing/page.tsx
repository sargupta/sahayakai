'use client';

import { useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Sparkles, School, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useSubscription } from '@/hooks/use-subscription';
import { useSearchParams } from 'next/navigation';

const FREE_FEATURES = [
    '10 lesson plans/month',
    '5 quizzes/month',
    '5 worksheets/month',
    'Unlimited Instant Answer (20/day)',
    'Full community access',
    'Unlimited voice (TTS)',
    'Basic Impact Dashboard',
];

const PRO_FEATURES = [
    '25 lesson plans/month',
    '15 quizzes/month',
    'Unlimited worksheets & rubrics',
    'Unlimited Instant Answer',
    'Better AI quality (Pro model)',
    'PDF/DOCX export',
    'Student absence records',
    'AI parent messaging',
    'Detailed analytics',
];

export default function PricingPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading pricing...</p></div>}>
            <PricingContent />
        </Suspense>
    );
}

function PricingContent() {
    const { user } = useAuth();
    const { plan, loading } = useSubscription();
    const searchParams = useSearchParams();
    const status = searchParams.get('status');
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual');
    const [creating, setCreating] = useState(false);

    const handleSubscribe = async (planKey: string) => {
        if (!user) {
            // Redirect to login — for now just alert
            window.location.href = '/';
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

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 px-4 py-12">
            <div className="mx-auto max-w-4xl">
                {status === 'success' && (
                    <div className="mb-8 rounded-lg bg-green-50 p-4 text-center text-green-800 dark:bg-green-950 dark:text-green-200">
                        Payment successful! Your Pro plan is being activated. This may take a few seconds.
                    </div>
                )}
                {status === 'error' && (
                    <div className="mb-8 rounded-lg bg-red-50 p-4 text-center text-red-800 dark:bg-red-950 dark:text-red-200">
                        Payment could not be verified. If you were charged, please contact support.
                    </div>
                )}

                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold tracking-tight">Choose Your Plan</h1>
                    <p className="mt-2 text-muted-foreground">
                        All plans include full community access and unlimited voice
                    </p>
                </div>

                {/* Billing toggle */}
                <div className="mb-8 flex items-center justify-center gap-3">
                    <button
                        onClick={() => setBillingPeriod('monthly')}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${billingPeriod === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Monthly
                    </button>
                    <button
                        onClick={() => setBillingPeriod('annual')}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${billingPeriod === 'annual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Annual <span className="text-xs opacity-75">(2 months free)</span>
                    </button>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    {/* Free */}
                    <Card className={`relative ${plan === 'free' ? 'ring-2 ring-primary' : ''}`}>
                        <CardHeader>
                            <CardTitle className="text-lg">Free</CardTitle>
                            <div className="mt-2">
                                <span className="text-3xl font-bold">₹0</span>
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

                    {/* Pro */}
                    <Card className={`relative border-amber-300 shadow-lg ${plan === 'pro' ? 'ring-2 ring-amber-500' : ''}`}>
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-0.5 text-xs font-medium text-white">
                            Most Popular
                        </div>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Sparkles className="h-5 w-5 text-amber-500" />
                                Pro
                            </CardTitle>
                            <div className="mt-2">
                                <span className="text-3xl font-bold">
                                    ₹{billingPeriod === 'monthly' ? '149' : '1,399'}
                                </span>
                                <span className="text-muted-foreground">
                                    /{billingPeriod === 'monthly' ? 'month' : 'year'}
                                </span>
                                {billingPeriod === 'annual' && (
                                    <div className="text-xs text-amber-600">₹117/month — save ₹389</div>
                                )}
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
                                    className="mt-4 w-full bg-amber-600 hover:bg-amber-700"
                                    onClick={() => handleSubscribe(billingPeriod === 'monthly' ? 'pro_monthly' : 'pro_annual')}
                                    disabled={creating || loading}
                                >
                                    {creating ? 'Processing...' : 'Upgrade to Pro'}
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            )}
                        </CardContent>
                    </Card>

                    {/* Schools */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <School className="h-5 w-5" />
                                Schools
                            </CardTitle>
                            <div className="mt-2">
                                <span className="text-lg font-medium text-muted-foreground">
                                    Custom pricing
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Everything in Pro, plus school admin dashboard, bulk onboarding,
                                WhatsApp Business integration, and dedicated support.
                            </p>
                            <ul className="mt-3 space-y-2 text-sm">
                                <li className="flex items-start gap-2">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                                    Starts at ₹149/teacher/month
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                                    Volume discounts available
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                                    Free 45-day pilot
                                </li>
                            </ul>
                            <Button variant="outline" className="mt-4 w-full" asChild>
                                <a href="https://wa.me/916363740720?text=I'm%20interested%20in%20SahayakAI%20for%20my%20school" target="_blank" rel="noopener noreferrer">
                                    Talk to us
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <p className="mt-8 text-center text-xs text-muted-foreground">
                    All prices include 18% GST. Cancel anytime with 2 clicks. 7-day refund guarantee.
                </p>
            </div>
        </div>
    );
}
