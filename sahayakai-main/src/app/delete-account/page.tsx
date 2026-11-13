import Link from 'next/link';

/**
 * Public account-deletion page.
 *
 * Google Play requires every app that lets people create an account to give a
 * web link where they can ask for that account and its data to be deleted,
 * without having the app installed. This is that link.
 *
 * Every sentence here describes what POST /api/user/delete-account actually
 * does (src/app/api/user/delete-account/route.ts). If that route changes what
 * it removes or keeps, change this page in the same commit.
 */

export const metadata = {
    title: 'Delete your account — SahayakAI',
    description:
        'How to delete your SahayakAI account and data, what is removed, what is kept, and for how long.',
};

const CONTACT_EMAIL = 'grievance@sargvision.com';

type Section = {
    number: string;
    headline: string;
    body: React.ReactNode;
};

const SECTIONS: Section[] = [
    {
        number: '01',
        headline: 'Delete it in the app',
        body: (
            <>
                Open SahayakAI, go to <strong>Settings</strong>, and tap{' '}
                <strong>Delete account</strong>. For your security you may be asked to sign in
                again first. Your sign-in is closed straight away, and the app offers you a copy
                of your work to download.
            </>
        ),
    },
    {
        number: '02',
        headline: 'Or ask us by email',
        body: (
            <>
                No longer have the app? Email{' '}
                <a
                    href={`mailto:${CONTACT_EMAIL}?subject=Delete%20my%20SahayakAI%20account`}
                    className="text-foreground font-medium underline underline-offset-2"
                >
                    {CONTACT_EMAIL}
                </a>{' '}
                from the Google account you sign in with, with the subject &ldquo;Delete my
                SahayakAI account&rdquo;. We confirm it is you and complete the deletion within
                7 days.
            </>
        ),
    },
    {
        number: '03',
        headline: 'What is deleted straight away',
        body: (
            <>
                Your sign-in account; every lesson plan, quiz, worksheet and other piece of work
                saved in your library; your connections with other teachers; your VIDYA assistant
                sessions; your usage counts and activity statistics; and your membership of any
                school organisation. Any paid subscription is cancelled.
            </>
        ),
    },
    {
        number: '04',
        headline: 'What is removed after 30 days',
        body: (
            <>
                Your profile (name, email, school, classes and subjects) is kept for 30 days so you
                can still request a copy of your work, then it is anonymised and your personal
                details are erased.
            </>
        ),
    },
    {
        number: '05',
        headline: 'What is not removed automatically',
        body: (
            <>
                Posts, comments and messages you shared in the Community, and voice messages or
                files you uploaded there, stay visible to the teachers you shared them with,
                because their conversations depend on them. You can delete your own posts before
                closing your account, or email us and we will remove them.
            </>
        ),
    },
];

export default function DeleteAccountPage() {
    return (
        <div className="force-light min-h-screen bg-background text-foreground">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-20 pb-20 sm:pb-28">
                <div className="pb-5 border-b border-border mb-10 sm:mb-14">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-3">
                        SahayakAI by Sargvision
                    </div>
                    <h1 className="font-headline text-[34px] sm:text-[48px] font-extrabold leading-[1.05] tracking-tight text-foreground">
                        Delete your account
                    </h1>
                    <p className="text-[15px] sm:text-[17px] text-muted-foreground leading-[1.6] mt-5 max-w-[52ch]">
                        You can close your SahayakAI account and remove your data at any time. Here is
                        how, and exactly what happens to each kind of data.
                    </p>
                </div>

                <ol className="divide-y divide-border">
                    {SECTIONS.map(s => (
                        <li
                            key={s.number}
                            className="grid grid-cols-[auto_1fr] gap-5 sm:gap-8 py-8 sm:py-10 items-start"
                        >
                            <div className="font-headline font-bold text-[32px] sm:text-[42px] text-primary leading-none tabular-nums pt-1">
                                {s.number}
                            </div>
                            <div>
                                <h2 className="font-headline font-bold text-[18px] sm:text-[22px] text-foreground leading-[1.25] tracking-tight mb-3">
                                    {s.headline}
                                </h2>
                                <p className="text-[14px] sm:text-[15px] text-muted-foreground leading-[1.65] max-w-[62ch]">
                                    {s.body}
                                </p>
                            </div>
                        </li>
                    ))}
                </ol>

                <div className="mt-12 sm:mt-16 pt-8 border-t border-border">
                    <Link
                        href="/privacy-for-teachers"
                        className="inline-block text-[14px] font-medium text-foreground underline underline-offset-2"
                    >
                        How we handle your data →
                    </Link>
                </div>
            </div>
        </div>
    );
}
