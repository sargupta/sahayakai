/**
 * The full privacy policy shown under the five commitments on
 * /privacy-for-teachers. This page is the privacy-policy URL on the Google Play
 * listing, so it must match the app's Data safety form: every data type
 * declared there is named here, with who processes it and how long it is kept.
 *
 * What is deleted when an account is closed is described by /delete-account,
 * which is tied to the delete-account route by its own test. Keep the two in
 * step. Gate: src/__tests__/app/privacy-policy-page.test.tsx.
 */

export const POLICY_EFFECTIVE_DATE = '14 November 2026';
export const PRIVACY_CONTACT_EMAIL = 'grievance@sargvision.com';

type Section = {
    id: string;
    title: string;
    body: React.ReactNode;
};

const list = 'list-disc pl-5 space-y-2 marker:text-primary/60';

const SECTIONS: Section[] = [
    {
        id: 'who-we-are',
        title: 'Who we are',
        body: (
            <p>
                SahayakAI is an AI teaching assistant for school teachers in India, made by
                SargVision (&ldquo;we&rdquo;, &ldquo;us&rdquo;). This policy covers the SahayakAI
                Android app and the SahayakAI website. It explains what we collect, why, who
                processes it for us, how long we keep it, and the choices you have.
            </p>
        ),
    },
    {
        id: 'what-we-collect',
        title: 'What we collect',
        body: (
            <ul className={list}>
                <li>
                    <strong>Account details.</strong> Your name, email address and profile picture
                    from the Google account you sign in with, and an internal user ID.
                </li>
                <li>
                    <strong>Your teaching profile.</strong> What you tell us during setup: school,
                    district, state and PIN code, board, classes and subjects, role and
                    qualifications, preferred language, and optionally your phone number.
                </li>
                <li>
                    <strong>What you create and ask.</strong> The requests you type or speak, and
                    the lesson plans, quizzes, worksheets, visual aids and other work you save.
                </li>
                <li>
                    <strong>Photos.</strong> Pictures you choose to take or upload, for example
                    answer sheets for the assessment scanner or images for a community post.
                </li>
                <li>
                    <strong>Voice.</strong> When you speak to SahayakAI, your speech is turned into
                    text and the recording is not kept. Voice messages you send in the Community
                    are stored so the people in that conversation can play them.
                </li>
                <li>
                    <strong>Community activity.</strong> Your posts, comments, messages, likes,
                    connections with other teachers, and any reports or blocks you make.
                </li>
                <li>
                    <strong>Classroom and parent information you enter.</strong> Class lists,
                    student names, attendance, marks, parents&rsquo; phone numbers, the messages
                    you prepare for parents and the outcome of calls you start.
                </li>
                <li>
                    <strong>Usage and device information.</strong> Which features you use and how
                    often (for plan limits and to improve the app), a notification token and app
                    instance ID for your device, crash logs and diagnostics, and server logs
                    (such as IP address and request times) that keep the service secure.
                </li>
            </ul>
        ),
    },
    {
        id: 'how-we-use',
        title: 'How we use it',
        body: (
            <ul className={list}>
                <li>To sign you in and run the features you use, including generating content with AI.</li>
                <li>To personalise results to your board, classes, subjects and language.</li>
                <li>To run the Community: show your posts and messages to the teachers you share them with.</li>
                <li>To help you contact parents when you choose to send a message or start a call.</li>
                <li>To apply plan limits, prevent abuse, keep the service secure and fix crashes.</li>
                <li>To send notifications you can turn off in your phone&rsquo;s settings.</li>
            </ul>
        ),
    },
    {
        id: 'what-we-never-do',
        title: 'What we never do',
        body: (
            <ul className={list}>
                <li>We do not sell your data or the data of your students.</li>
                <li>We do not show ads, and we do not use your data for advertising.</li>
                <li>
                    We do not share your activity with inspectors, officials or your school
                    management. The only exception is a valid legal order, and then we disclose
                    only what the law requires.
                </li>
            </ul>
        ),
    },
    {
        id: 'service-providers',
        title: 'Who processes your data for us',
        body: (
            <>
                <p className="mb-3">
                    We use service providers that process data only on our instructions and only
                    for the feature that needs it:
                </p>
                <ul className={list}>
                    <li>
                        <strong>Google</strong> (Google Cloud and Firebase): sign-in, our database
                        and file storage, notifications, crash reporting and app security checks.
                        Google&rsquo;s Gemini models generate lesson plans, answers and other
                        content and turn speech into text. When we suggest YouTube videos, only the
                        lesson topic is sent to YouTube.
                    </li>
                    <li>
                        <strong>Telephony providers</strong> (Twilio, Vobiz): place calls to parents
                        when you start one. They receive the parent&rsquo;s phone number and the
                        message for that call.
                    </li>
                    <li>
                        <strong>Indian-language speech providers</strong> (Sarvam AI, Bhashini): may
                        convert speech and text in Indian languages for voice features.
                    </li>
                    <li>
                        <strong>Razorpay</strong>: processes subscription payments made on our
                        website. We never see or store your card or bank details. The Android app
                        does not sell anything.
                    </li>
                </ul>
            </>
        ),
    },
    {
        id: 'where-stored',
        title: 'Where your data is stored',
        body: (
            <p>
                Your account, profile, saved work and uploaded files are stored on Google Cloud in
                India (Mumbai). Requests to AI models may be processed by Google in other
                countries. Data is encrypted in transit (HTTPS) and at rest, and access is limited
                to the people who need it to run the service.
            </p>
        ),
    },
    {
        id: 'how-long',
        title: 'How long we keep it',
        body: (
            <ul className={list}>
                <li>Your account, profile and saved work: until you delete them or your account.</li>
                <li>Voice you speak to SahayakAI: not kept once it has been turned into text.</li>
                <li>Server logs: about 30 days. Crash reports: up to 90 days.</li>
                <li>
                    When you delete your account, most data is deleted straight away and your
                    profile is anonymised after 30 days. The details, including what stays in the
                    Community, are on our{' '}
                    <a href="/delete-account" className="text-foreground font-medium underline underline-offset-2">
                        account deletion page
                    </a>
                    .
                </li>
            </ul>
        ),
    },
    {
        id: 'your-choices',
        title: 'Your rights and choices',
        body: (
            <>
                <p className="mb-3">
                    Under India&rsquo;s Digital Personal Data Protection Act, 2023, you can:
                </p>
                <ul className={list}>
                    <li>see and correct your profile in the app at any time;</li>
                    <li>delete any piece of saved work from your library;</li>
                    <li>
                        delete your whole account in the app (Settings &rarr; Delete account) or
                        through our{' '}
                        <a href="/delete-account" className="text-foreground font-medium underline underline-offset-2">
                            account deletion page
                        </a>
                        ;
                    </li>
                    <li>ask us for a summary of the personal data we hold about you;</li>
                    <li>withdraw consent, nominate someone to act for you, and raise a grievance.</li>
                </ul>
                <p className="mt-3">
                    Email us at the address below. We aim to reply within 30 days.
                </p>
            </>
        ),
    },
    {
        id: 'children-and-students',
        title: 'Children and student information',
        body: (
            <p>
                SahayakAI is for teachers aged 18 and over and is not directed at children.
                Students do not use the app. When you enter student or parent information, you do
                so as their teacher, and you should only add what you need for your teaching. We
                use it only to provide SahayakAI to you, never for advertising, and we delete it
                when you delete it or your account.
            </p>
        ),
    },
    {
        id: 'changes',
        title: 'Changes to this policy',
        body: (
            <p>
                If we change this policy we will update this page and its effective date. If a
                change affects how we use data you have already given us, we will tell you in the
                app before it takes effect.
            </p>
        ),
    },
];

export function FullPrivacyPolicy() {
    return (
        <section aria-labelledby="full-policy-title" className="mt-14 sm:mt-20 pt-10 border-t border-black/[0.08]">
            <h2
                id="full-policy-title"
                className="font-headline text-[26px] sm:text-[32px] font-extrabold leading-[1.1] tracking-tight text-foreground"
            >
                Privacy policy
            </h2>
            <p className="text-[14px] text-muted-foreground mt-2">
                Effective {POLICY_EFFECTIVE_DATE}
            </p>

            <div className="mt-8 space-y-9">
                {SECTIONS.map(s => (
                    <div key={s.id} id={s.id}>
                        <h3 className="font-headline font-bold text-[18px] sm:text-[20px] text-foreground leading-[1.3] tracking-tight mb-3">
                            {s.title}
                        </h3>
                        <div className="text-[14px] sm:text-[15px] text-muted-foreground leading-[1.65] max-w-[68ch]">
                            {s.body}
                        </div>
                    </div>
                ))}

                <div id="contact">
                    <h3 className="font-headline font-bold text-[18px] sm:text-[20px] text-foreground leading-[1.3] tracking-tight mb-3">
                        Contact and grievance officer
                    </h3>
                    <p className="text-[14px] sm:text-[15px] text-muted-foreground leading-[1.65] max-w-[68ch]">
                        For any privacy question, request or complaint, write to SargVision&rsquo;s
                        grievance officer at{' '}
                        <a
                            href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
                            className="text-foreground font-medium underline underline-offset-2"
                        >
                            {PRIVACY_CONTACT_EMAIL}
                        </a>
                        .
                    </p>
                </div>
            </div>
        </section>
    );
}
