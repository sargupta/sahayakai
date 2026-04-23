import Link from 'next/link';
import { PrivacyConsentForm } from './consent-form';

export const metadata = {
    title: 'Privacy for teachers — SahayakAI',
    description:
        'How SahayakAI handles teacher data. Not for monitoring teachers. Not for inspector reports. Private by default, deletable anytime.',
};

type Commitment = {
    number: string;
    headline: string;
    body: string;
};

const COMMITMENTS: Commitment[] = [
    {
        number: '01',
        headline: 'We never share your data with inspectors or government officials',
        body:
            'Your lesson plans, quiz results, attendance records, parent call logs, and all other activity data will never be shared with any Block Education Officer, District Education Officer, DIET Principal, school inspector, or any other government official, unless you explicitly choose to share it yourself.',
    },
    {
        number: '02',
        headline: 'Your content is private by default',
        body:
            'Every lesson plan, quiz, worksheet, and visual aid you create is visible only to you. Nothing is shared publicly unless you explicitly tap Share to Community. You can remove shared content at any time.',
    },
    {
        number: '03',
        headline: 'No school dashboard tracks individual teachers',
        body:
            'SahayakAI does not provide any dashboard, report, or view that allows a principal, HM, or administrator to monitor individual teacher activity. If we ever build school-level features, they will show only aggregate, anonymised data, and will require your explicit opt-in.',
    },
    {
        number: '04',
        headline: 'Voice recordings are processed, not stored',
        body:
            'When you use voice input, your speech is converted to text to create your lesson plan or quiz. The voice recording itself is not permanently stored on our servers. Community voice messages you send are stored only for the conversation participants.',
    },
    {
        number: '05',
        headline: 'You can delete your data anytime',
        body:
            'You can delete individual lesson plans, quizzes, and other content from your library at any time. If you want to delete your entire account and all associated data, contact us and we will process it within 7 days.',
    },
];

export default function PrivacyForTeachersPage() {
    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background">
            <div
                className="relative"
                style={{
                    background:
                        'radial-gradient(ellipse 70% 40% at 50% 10%, hsl(28 75% 96%) 0%, hsl(40 20% 99.5%) 55%, transparent 100%)',
                }}
            >
                <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-20 pb-20 sm:pb-28">
                    {/* Masthead */}
                    <div className="pb-5 border-b border-black/[0.08] mb-10 sm:mb-14">
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary mb-3">
                            Privacy, for teachers
                        </div>
                        <h1 className="font-headline text-[34px] sm:text-[48px] md:text-[56px] font-extrabold leading-[1.05] tracking-tight text-foreground">
                            Your data,{' '}
                            <span className="text-primary">your control.</span>
                        </h1>
                        <p className="text-[15px] sm:text-[17px] text-muted-foreground leading-[1.6] mt-5 max-w-[52ch]">
                            SahayakAI is built for teachers, not for monitoring teachers. Here, in five
                            plain-English commitments, is exactly how we handle your data.
                        </p>
                    </div>

                    {/* Commitments as editorial list */}
                    <ol className="divide-y divide-black/[0.08]">
                        {COMMITMENTS.map(c => (
                            <li
                                key={c.number}
                                className="grid grid-cols-[auto_1fr] gap-5 sm:gap-8 py-8 sm:py-10 items-start"
                            >
                                <div className="font-headline font-bold text-[32px] sm:text-[42px] text-primary leading-none tabular-nums pt-1">
                                    {c.number}
                                </div>
                                <div>
                                    <h2 className="font-headline font-bold text-[18px] sm:text-[22px] text-foreground leading-[1.25] tracking-tight mb-3">
                                        {c.headline}
                                    </h2>
                                    <p className="text-[14px] sm:text-[15px] text-muted-foreground leading-[1.65] max-w-[62ch]">
                                        {c.body}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>

                    {/* Consent capture (client) */}
                    <PrivacyConsentForm />

                    {/* Footer */}
                    <div className="mt-12 sm:mt-16 pt-8 border-t border-black/[0.08]">
                        <p className="text-[14px] text-muted-foreground leading-[1.6] max-w-[52ch]">
                            Questions about your privacy, or something we missed? Write to us at{' '}
                            <a
                                href="mailto:support@sahayak.ai"
                                className="text-primary font-medium hover:underline"
                            >
                                support@sahayak.ai
                            </a>
                            .
                        </p>
                        <Link
                            href="/"
                            className="inline-block mt-5 text-[14px] font-medium text-primary hover:underline"
                        >
                            ← Back to home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
