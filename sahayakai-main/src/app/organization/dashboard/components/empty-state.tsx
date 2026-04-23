import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Briefcase, Users, BookOpen, Eye, ArrowRight } from 'lucide-react';

type Reason = 'no-org' | 'too-few-teachers' | 'too-little-data';

interface Props {
    reason: Reason;
    principalName?: string;
    orgName?: string;
    isDemoData?: boolean;
}

/**
 * Empty-state dashboard for fresh-signup principals.
 *
 * Instead of showing blank metric cards with zeros (which reads as
 * broken), render three action cards that give the principal a real
 * next step. Dashboard metrics render automatically once the
 * organisation has >=3 teachers AND >=10 events in the window.
 */
export function EmptyStateDashboard({ reason, principalName, orgName, isDemoData }: Props) {
    const firstName = principalName?.split(' ')[0];

    return (
        <div className="min-h-[calc(100vh-4rem)] w-full max-w-5xl mx-auto px-4 py-6 sm:py-8">
            <div className="flex items-start justify-between gap-4 mb-8">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Briefcase className="h-4 w-4" />
                        <span>School Dashboard</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold font-headline tracking-tight">
                        {firstName ? `Welcome, ${firstName}` : 'Welcome to SahayakAI'}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {orgName
                            ? orgName
                            : reason === 'no-org'
                            ? 'Finish setting up your school to see your dashboard.'
                            : 'Your school-wide analytics will appear here once a few teachers are active.'}
                    </p>
                </div>
                {isDemoData && (
                    <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-900 bg-amber-100 border border-amber-300 rounded-full px-3 py-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Demo data
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="rounded-2xl border-primary/30">
                    <CardHeader>
                        <div className="bg-primary/10 p-2 rounded-lg w-fit mb-2">
                            <Users className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-base">Invite your teachers</CardTitle>
                        <CardDescription className="text-xs">
                            Real analytics start once 3 or more teachers are using SahayakAI. Most schools invite a pilot group of 5 first.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" size="sm" className="rounded-xl gap-1">
                            <Link href="/organization/invite">
                                Invite teachers
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl">
                    <CardHeader>
                        <div className="bg-primary/10 p-2 rounded-lg w-fit mb-2">
                            <BookOpen className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-base">Try the product yourself</CardTitle>
                        <CardDescription className="text-xs">
                            Generate a lesson plan, quiz, or worksheet the same way your teachers will. Every principal should know what the teacher experience feels like.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" size="sm" className="rounded-xl gap-1">
                            <Link href="/">
                                Open teacher tools
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl">
                    <CardHeader>
                        <div className="bg-primary/10 p-2 rounded-lg w-fit mb-2">
                            <Eye className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-base">Preview a full dashboard</CardTitle>
                        <CardDescription className="text-xs">
                            See what this page looks like once your school is active: weekly active teachers, content generated, time saved, feature adoption, at-risk alerts.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" size="sm" className="rounded-xl gap-1">
                            <Link href="/organization/dashboard?preview=demo">
                                See preview
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
