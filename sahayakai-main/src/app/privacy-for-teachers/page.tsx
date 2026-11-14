import Link from 'next/link';
import { PrivacyConsentForm } from './consent-form';
import { FullPrivacyPolicy, PRIVACY_CONTACT_EMAIL } from './full-policy';

export const metadata = {
    title: 'Privacy policy — SahayakAI',
    description:
        'How SahayakAI collects, uses, stores and deletes teacher data: what we collect, who processes it, how long we keep it, and your rights.',
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
            'Your lesson plans, quiz results, attendance records, parent call logs, and all other activity data will never be shared with any Block Education Officer, District Education Officer, DIET Principal, school inspector, or any other government official, unless you explicitly choose to share it yourself. The only exception is a valid legal order, and then we disclose only what the law requires.',
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
            'You can delete individual lesson plans, quizzes, and other content from your library at any time. You can also delete your entire account in the app (Settings → Delete account) or from our account deletion page, which explains exactly what is removed and when.',
    },
];

export default function PrivacyForTeachersPage() {
    return (
        <div className="force-light min-h-[calc(100vh-4rem)] bg-background text-foreground">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-20 pb-20 sm:pb-28">
                {/* Masthead */}
                <div className="pb-5 border-b border-border mb-10 sm:mb-14">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-3">
                        Privacy, for teachers
                    </div>
                    <h1 className="font-headline text-[34px] sm:text-[48px] md:text-[56px] font-extrabold leading-[1.05] tracking-tight text-foreground">
                        Your data,{' '}
                        <span className="text-primary">your control.</span>
                    </h1>
                    <p className="text-[15px] sm:text-[17px] text-muted-foreground leading-[1.6] mt-5 max-w-[52ch]">
                        SahayakAI is built for teachers, not for monitoring teachers. Here are our five
                        plain-English commitments, followed by our full privacy policy.
                    </p>
                </div>

                {/* Commitments as editorial list */}
                <ol className="divide-y divide-border">
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

                {/* Full policy: the Play Store privacy-policy URL points here. */}
                <FullPrivacyPolicy />

                {/* Consent capture (client) */}
                <PrivacyConsentForm />

                {/* Footer */}
                <div className="mt-12 sm:mt-16 pt-8 border-t border-border">
                    <p className="text-[14px] text-muted-foreground leading-[1.6] max-w-[52ch]">
                        Questions about your privacy, or something we missed? Write to us at{' '}
                        <a
                            href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
                            className="text-foreground font-medium underline underline-offset-2"
                        >
                            {PRIVACY_CONTACT_EMAIL}
                        </a>
                        .
                    </p>
                    <Link
                        href="/"
                        className="inline-block mt-5 text-[14px] font-medium text-foreground underline underline-offset-2"
                    >
                        ← Back to home
                    </Link>
                </div>
            </div>
        </div>
    );
}
