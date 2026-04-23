import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Briefcase,
    Check,
    Clock,
    GraduationCap,
    MessageCircle,
    Sparkles,
    TrendingUp,
    Users,
} from 'lucide-react';

export const metadata = {
    title: 'SahayakAI for Schools: AI teaching assistant with principal dashboard',
    description:
        'The AI tool your teachers actually use. And the dashboard you actually need. Built for Indian schools in 11 languages, voice-first, on any Android phone.',
};

/**
 * Cold-principal landing page. Public surface (no auth required).
 * WhatsApp deep-link pulls from NEXT_PUBLIC_FOUNDER_WHATSAPP env var at build time;
 * falls back to the #book-demo anchor if the env var is unset.
 */
function getWhatsAppDeepLink(): string {
    const phone = process.env.NEXT_PUBLIC_FOUNDER_WHATSAPP?.replace(/\D/g, '');
    if (!phone) return '#book-demo';
    const message = encodeURIComponent(
        'Hi, I saw the SahayakAI for Schools page. I would like a 30-minute demo for our school.',
    );
    return `https://wa.me/${phone}?text=${message}`;
}

export default function ForSchoolsPage() {
    const whatsAppLink = getWhatsAppDeepLink();

    return (
        <div className="min-h-screen bg-background">
            {/* Hero */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-10">
                <div className="space-y-3 max-w-3xl">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
                        <Sparkles className="h-4 w-4" />
                        <span>SahayakAI for Schools</span>
                    </div>
                    <h1 className="text-3xl sm:text-5xl font-extrabold font-headline tracking-tight leading-tight">
                        The AI tool your teachers actually use. And the dashboard you actually need.
                    </h1>
                    <p className="text-base sm:text-lg text-muted-foreground pt-2">
                        SahayakAI returns 6 hours per teacher per week. Lesson plans, quizzes, worksheets, rubrics, all in 11 Indian languages. Voice-first. Works on a basic Android phone.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-6">
                    <Button asChild size="lg" className="rounded-xl">
                        <Link href={whatsAppLink}>
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Book a 30-minute demo
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg" className="rounded-xl">
                        <Link href="/">See the teacher view</Link>
                    </Button>
                </div>

                <p className="text-xs text-muted-foreground pt-4">
                    Live with 150 Karnataka teachers since Q4 2025. Now opening to Tier 2 CBSE private schools.
                </p>
            </section>

            {/* Three panels */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Panel 1 */}
                    <Card className="rounded-2xl border-border shadow-soft">
                        <CardHeader>
                            <div className="bg-primary/10 p-2 rounded-lg w-fit mb-2">
                                <GraduationCap className="h-5 w-5 text-primary" />
                            </div>
                            <CardTitle className="text-lg">What your teachers get</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2.5 text-sm">
                                <li className="flex gap-2">
                                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                    <span>5-minute 5E lesson plans in 11 Indian languages</span>
                                </li>
                                <li className="flex gap-2">
                                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                    <span>NCERT and state-board aligned, NEP 2020 and CCE ready</span>
                                </li>
                                <li className="flex gap-2">
                                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                    <span>Voice-first input, no typing required</span>
                                </li>
                                <li className="flex gap-2">
                                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                    <span>Quizzes and worksheets in three difficulty levels</span>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>

                    {/* Panel 2 (principal, highlighted) */}
                    <Card className="rounded-2xl border-primary/40 shadow-soft bg-primary/5">
                        <CardHeader>
                            <div className="bg-primary/15 p-2 rounded-lg w-fit mb-2">
                                <Briefcase className="h-5 w-5 text-primary" />
                            </div>
                            <CardTitle className="text-lg">What you see as principal</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2.5 text-sm">
                                <li className="flex gap-2">
                                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                    <span>Weekly active teachers and content generated per week</span>
                                </li>
                                <li className="flex gap-2">
                                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                    <span>Estimated time saved across your whole school</span>
                                </li>
                                <li className="flex gap-2">
                                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                    <span>Feature adoption and at-risk teacher alerts</span>
                                </li>
                                <li className="flex gap-2">
                                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                    <span>One dashboard. No spreadsheets, no WhatsApp scrolling.</span>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>

                    {/* Panel 3 (pricing) */}
                    <Card className="rounded-2xl border-border shadow-soft">
                        <CardHeader>
                            <div className="bg-primary/10 p-2 rounded-lg w-fit mb-2">
                                <TrendingUp className="h-5 w-5 text-primary" />
                            </div>
                            <CardTitle className="text-lg">Simple pricing</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2.5 text-sm">
                                <li className="flex gap-2">
                                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                    <span>From ₹1,000 per teacher per year, billed annually</span>
                                </li>
                                <li className="flex gap-2">
                                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                    <span>3-month paid pilot, cancel anytime</span>
                                </li>
                                <li className="flex gap-2">
                                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                    <span>No setup fees, no per-seat platform charges</span>
                                </li>
                                <li className="flex gap-2">
                                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                    <span>Minimum 10 teachers per school</span>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Dashboard sample */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
                <div className="text-center space-y-2 mb-8">
                    <h2 className="text-2xl sm:text-3xl font-extrabold font-headline">
                        What you will see, week one
                    </h2>
                    <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
                        A principal view of their school, the day after teachers start using SahayakAI.
                    </p>
                </div>
                <Card className="rounded-2xl border-border shadow-soft">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <Metric icon={Users} label="Weekly active teachers" value="22 / 25" note="+4 vs last week" />
                            <Metric icon={Sparkles} label="Content generated" value="147" note="lessons, quizzes, worksheets" />
                            <Metric icon={Clock} label="Time saved" value="138 hrs" note="across all teachers this week" />
                            <Metric icon={TrendingUp} label="Feature adoption" value="4.2 / 6" note="average features per teacher" />
                        </div>
                    </CardContent>
                </Card>
                <p className="text-xs text-muted-foreground text-center mt-4">
                    Illustrative sample based on a Karnataka pilot school (25 teachers, week 8). Your actual numbers will appear here after week one.
                </p>
            </section>

            {/* CTA footer */}
            <section id="book-demo" className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
                <Card className="rounded-2xl border-primary/60 shadow-soft bg-primary/5">
                    <CardContent className="p-8 sm:p-12 text-center space-y-5">
                        <div className="space-y-2">
                            <h2 className="text-2xl sm:text-3xl font-extrabold font-headline">
                                Book a 30-minute demo
                            </h2>
                            <p className="text-muted-foreground text-sm max-w-xl mx-auto">
                                We come to you. We bring the data. We do not send a sales deck; we show you one of your own teachers using the product.
                            </p>
                        </div>
                        <Button asChild size="lg" className="rounded-xl">
                            <Link href={whatsAppLink}>
                                <MessageCircle className="h-4 w-4 mr-2" />
                                WhatsApp us
                            </Link>
                        </Button>
                        <p className="text-xs text-muted-foreground pt-1">
                            Currently booking demos in Karnataka: Mysuru, Hubballi, Mangaluru, Belagavi, Shivamogga.
                        </p>
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}

function Metric({
    icon: Icon,
    label,
    value,
    note,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    note: string;
}) {
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="h-3 w-3" />
                <span className="uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-headline text-primary">
                {value}
            </div>
            <div className="text-xs text-muted-foreground">{note}</div>
        </div>
    );
}
