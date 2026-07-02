"use client";

import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/landing-footer";
import { ScriptMarks } from "@/components/landing/script-marks";
import { PageAudio } from "@/components/marketing/page-audio";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { LANGUAGE_TO_ISO } from "@/types";

// Component-local UI-chrome translations, resolved by uiLangCode (the app UI language).
const LAST_UPDATED: Record<string, string> = {
    en: "Last updated: April 2026. Governed by the laws of India.",
    hi: "अंतिम अद्यतन: अप्रैल 2026। भारत के कानूनों द्वारा शासित।",
    mr: "शेवटचे अद्यतन: एप्रिल 2026. भारताच्या कायद्यांद्वारे नियंत्रित.",
    bn: "সর্বশেষ হালনাগাদ: এপ্রিল 2026। ভারতের আইন দ্বারা পরিচালিত।",
    pa: "ਆਖਰੀ ਅੱਪਡੇਟ: ਅਪ੍ਰੈਲ 2026। ਭਾਰਤ ਦੇ ਕਾਨੂੰਨਾਂ ਅਨੁਸਾਰ ਨਿਯੰਤਰਿਤ।",
    gu: "છેલ્લે અપડેટ: એપ્રિલ 2026। ભારતના કાયદાઓ દ્વારા સંચાલિત।",
    or: "ଶେଷ ଅଦ୍ୟତନ: ଏପ୍ରିଲ 2026। ଭାରତର ଆଇନ ଦ୍ୱାରା ନିୟନ୍ତ୍ରିତ।",
    ta: "கடைசியாக புதுப்பிக்கப்பட்டது: ஏப்ரல் 2026. இந்திய சட்டங்களால் நிர்வகிக்கப்படுகிறது.",
    te: "చివరిగా నవీకరించబడింది: ఏప్రిల్ 2026. భారత చట్టాల ప్రకారం నిర్వహించబడుతుంది.",
    kn: "ಕೊನೆಯ ನವೀಕರಣ: ಏಪ್ರಿಲ್ 2026. ಭಾರತದ ಕಾನೂನುಗಳಿಂದ ನಿಯಂತ್ರಿಸಲಾಗಿದೆ.",
    ml: "അവസാനം പുതുക്കിയത്: ഏപ്രിൽ 2026. ഇന്ത്യൻ നിയമങ്ങൾ പ്രകാരം നിയന്ത്രിക്കപ്പെടുന്നു.",
};

// Notice shown above the full legal text, which is authoritative in English only.
const ENGLISH_LEGAL_NOTICE: Record<string, string> = {
    en: "The full legal terms below are provided in English, which is the authoritative version.",
    hi: "नीचे दी गई पूर्ण कानूनी शर्तें अंग्रेज़ी में प्रदान की गई हैं, जो प्रामाणिक संस्करण है।",
    mr: "खालील संपूर्ण कायदेशीर अटी इंग्रजीमध्ये दिल्या आहेत, जी अधिकृत आवृत्ती आहे.",
    bn: "নীচের সম্পূর্ণ আইনি শর্তাবলী ইংরেজিতে প্রদান করা হয়েছে, যা প্রামাণিক সংস্করণ।",
    pa: "ਹੇਠਾਂ ਦਿੱਤੀਆਂ ਪੂਰੀਆਂ ਕਾਨੂੰਨੀ ਸ਼ਰਤਾਂ ਅੰਗਰੇਜ਼ੀ ਵਿੱਚ ਦਿੱਤੀਆਂ ਗਈਆਂ ਹਨ, ਜੋ ਪ੍ਰਮਾਣਿਕ ਸੰਸਕਰਣ ਹੈ।",
    gu: "નીચે આપેલી સંપૂર્ણ કાનૂની શરતો અંગ્રેજીમાં આપવામાં આવી છે, જે અધિકૃત આવૃત્તિ છે।",
    or: "ତଳେ ଦିଆଯାଇଥିବା ସମ୍ପୂର୍ଣ୍ଣ ଆଇନଗତ ସର୍ତ୍ତାବଳୀ ଇଂରାଜୀରେ ପ୍ରଦାନ କରାଯାଇଛି, ଯାହା ପ୍ରାମାଣିକ ସଂସ୍କରଣ।",
    ta: "கீழே உள்ள முழு சட்டப்பூர்வ விதிமுறைகள் ஆங்கிலத்தில் வழங்கப்படுகின்றன, இதுவே அதிகாரப்பூர்வ பதிப்பு.",
    te: "క్రింద ఉన్న పూర్తి చట్టపరమైన నిబంధనలు ఆంగ్లంలో అందించబడ్డాయి, ఇదే అధికారిక సంస్కరణ.",
    kn: "ಕೆಳಗಿನ ಸಂಪೂರ್ಣ ಕಾನೂನು ನಿಯಮಗಳನ್ನು ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಒದಗಿಸಲಾಗಿದೆ, ಇದು ಅಧಿಕೃತ ಆವೃತ್ತಿಯಾಗಿದೆ.",
    ml: "ചുവടെയുള്ള പൂർണ്ണ നിയമ വ്യവസ്ഥകൾ ഇംഗ്ലീഷിൽ നൽകിയിരിക്കുന്നു, അതാണ് ആധികാരിക പതിപ്പ്.",
};

export function TermsClient() {
    const { openAuthModal } = useAuth();
    const { t, language } = useLanguage();
    const uiLangCode = LANGUAGE_TO_ISO[language] || "en";

    const tldr = [
        "Whatever you create with SahayakAI is yours.",
        "You can cancel anytime. 7-day refund on any paid plan.",
        "Your data is stored on Google Cloud in Singapore (Asia) and you control it.",
        "SahayakAI never asks for student personal data.",
        "If there is a problem, email grievance@sargvision.com. We respond within 7 days.",
    ];

    return (
        <div className="flex flex-col min-h-screen">
            <LandingNav onAuthClick={openAuthModal} />

            <div
                className="relative flex-1"
                style={{
                    background:
                        "radial-gradient(ellipse 90% 70% at 50% 40%, hsl(28 75% 94%) 0%, hsl(34 60% 97%) 32%, hsl(40 20% 99.5%) 64%, hsl(40 20% 99.5%) 100%)",
                }}
            >
                <ScriptMarks />

                <main>
                <section className="relative z-10 max-w-[720px] mx-auto px-6 sm:px-12 pt-[52px] pb-8">
                    <div className="inline-flex items-center gap-2 text-[12px] font-medium text-saffron-700 bg-saffron-50 border border-saffron-200 rounded-full px-[14px] py-[6px] mb-6">
                        <span className="w-1.5 h-1.5 rounded-full bg-saffron" />
                        {t("Legal")}
                    </div>

                    <h1 className="font-headline font-extrabold tracking-tight text-[40px] sm:text-[48px] leading-[1.05] text-foreground">
                        {t("Terms of Service")}
                    </h1>
                    <p className="font-body text-[15px] text-neutral-500 mt-3">
                        {LAST_UPDATED[uiLangCode] || LAST_UPDATED.en}
                    </p>
                </section>

                {/* Plain-language TL;DR — the only part most teachers need to read. */}
                <section className="relative z-10 max-w-[720px] mx-auto px-6 sm:px-12 pb-10">
                    <div className="rounded-[14px] bg-white border-l-4 border-saffron-200 px-7 py-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-saffron-700 mb-3">
                            {t("In plain words")}
                        </div>
                        <ul className="space-y-3">
                            {tldr.map((key) => (
                                <li key={key} className="flex gap-2.5 text-[15px] text-foreground leading-[1.55]">
                                    <span className="mt-[9px] w-1.5 h-1.5 rounded-full bg-saffron flex-none" />
                                    <span>{t(key)}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="mt-4 text-[12px] text-neutral-500 uppercase tracking-[0.08em] font-semibold">
                            {t("Full legal terms below")} ↓
                        </div>
                    </div>
                </section>

                <article className="relative z-10 max-w-[720px] mx-auto px-6 sm:px-12 pb-16 font-body text-[15px] text-neutral-700 leading-[1.7]">
                    <p className="mb-8 rounded-[12px] bg-neutral-50 border border-neutral-200 px-5 py-3 text-[13px] text-neutral-500">
                        {ENGLISH_LEGAL_NOTICE[uiLangCode] || ENGLISH_LEGAL_NOTICE.en}
                    </p>
                    <Section kicker="01" title="What SahayakAI does">
                        <p>
                            SahayakAI is an AI teaching assistant built by <strong>SARGVISION Intelligence Pvt. Ltd.</strong> for teachers, schools, and education administrators in India. It generates lesson plans, quizzes, worksheets, rubrics, visual aids, and voice-driven workflows aligned to NCERT, CBSE, ICSE, and 28 state board curricula across 11 Indian languages.
                        </p>
                        <p className="mt-3">
                            You can use SahayakAI on a free tier or on a paid subscription (Pro, School Gold, or School Premium). These terms apply regardless of which plan you are on.
                        </p>
                    </Section>

                    <Section kicker="02" title="Who can use SahayakAI">
                        <p>
                            SahayakAI is built for Indian K-12 teachers, school leaders, and administrative staff. You may use SahayakAI only if you are:
                        </p>
                        <ul className="mt-3 space-y-2">
                            <Bullet>At least 18 years old, or using the product under a school account where the school has confirmed your role</Bullet>
                            <Bullet>Using SahayakAI for your own teaching, administrative, or academic work, not to resell or rebadge the service</Bullet>
                            <Bullet>Accessing the service in compliance with the laws of India</Bullet>
                        </ul>
                    </Section>

                    <Section kicker="03" title="Your content, your ownership">
                        <p>
                            Any lesson plan, quiz, worksheet, rubric, or other material you create with SahayakAI is <strong>yours</strong>. You keep full ownership and may use it in your classroom, share it with colleagues, upload it to the community library, print it, or adapt it however you like.
                        </p>
                        <p className="mt-3">
                            You grant us a limited right to process your inputs (topics, class level, language preference, voice recordings) through our AI providers to generate your output, and to retain non-identifying usage patterns for product improvement.
                        </p>
                    </Section>

                    <Section kicker="04" title="Privacy and student data (DPDP)">
                        <p>
                            We comply with the Digital Personal Data Protection Act, 2023 (DPDP). SahayakAI does not require student personal data to function. When teachers enter minimal class-level information (class numbers, subject names, attendance markers), we process it under the grounds specified in your consent.
                        </p>
                        <p className="mt-3">
                            <strong>Your rights as a Data Principal under DPDP include:</strong>
                        </p>
                        <ul className="mt-2 space-y-2">
                            <Bullet>Access: request a summary of your personal data we process</Bullet>
                            <Bullet>Correction and erasure: update or delete inaccurate or no-longer-needed data</Bullet>
                            <Bullet>Nomination: nominate a person to exercise your rights in case of death or incapacity</Bullet>
                            <Bullet>Grievance redressal: raise concerns with our Grievance Officer</Bullet>
                            <Bullet>Withdraw consent at any time without penalty</Bullet>
                        </ul>
                        <p className="mt-3">
                            <strong>Data retention.</strong> Account data is retained while your subscription is active and for up to 180 days after cancellation for compliance and billing reconciliation, after which it is purged unless otherwise required by law.
                        </p>
                        <p className="mt-3">
                            <strong>Breach notification.</strong> In the event of a personal-data breach, we notify affected Data Principals and the Data Protection Board of India within the timelines prescribed by the DPDP Act.
                        </p>
                        <p className="mt-3">
                            <strong>Cross-border storage and processing.</strong> Your account data is stored and processed on Google Cloud infrastructure located in Singapore (the <em>asia-southeast1</em> region), not within India. By using SahayakAI you consent to this cross-border transfer of your personal data outside India. AI inference is additionally performed through third-party providers (Google Gemini, Sarvam); we process only the minimal prompt data needed to generate your output and do not retain personal data on these third-party systems beyond the request lifecycle.
                        </p>
                        <p className="mt-3">
                            <strong>Grievance Officer.</strong> Abhishek Gupta, SARGVISION Intelligence Pvt. Ltd., Bengaluru, Karnataka, India. Email:{" "}
                            <a href="mailto:grievance@sargvision.com" className="underline hover:text-foreground">
                                grievance@sargvision.com
                            </a>
                            . We respond to DPDP requests within 7 working days and resolve them within 30 days where possible.
                        </p>
                        <p className="mt-3">
                            Full privacy rules are available at{" "}
                            <a href="/privacy-for-teachers" className="underline hover:text-foreground">
                                /privacy-for-teachers
                            </a>
                            .
                        </p>
                    </Section>

                    <Section kicker="05" title="What we ask of you">
                        <ul className="mt-1 space-y-2">
                            <Bullet>Don&rsquo;t upload content that is defamatory, infringes copyright, or violates the rights of students or colleagues</Bullet>
                            <Bullet>Don&rsquo;t attempt to reverse-engineer the AI models, scrape the product, or run automated abuse</Bullet>
                            <Bullet>Don&rsquo;t use SahayakAI to generate discriminatory, hateful, or harmful material targeted at any community</Bullet>
                            <Bullet>Respect the plan limits that apply to your tier. Free-tier limits are documented on the pricing page and in the product</Bullet>
                        </ul>
                    </Section>

                    <Section kicker="06" title="Payments and subscriptions">
                        <p>
                            Paid plans are billed in Indian Rupees via Razorpay. Individual plans (Pro) include 18% GST. School plans (Gold, Premium) are billed exclusive of GST (ITC claimable). You can cancel anytime from your subscription settings; a 7-day refund is available from the first charge on any paid plan.
                        </p>
                        <p className="mt-3">
                            School Premium pricing is set by a signed Memorandum of Understanding with SARGVISION Intelligence. Terms for government tenders and chain contracts are governed by the executed MoU, which supersedes anything in this page that conflicts.
                        </p>
                    </Section>

                    <Section kicker="07" title="Availability and AI limitations">
                        <p>
                            SahayakAI uses third-party AI models (Google Gemini, Sarvam) as the generation engines. Occasionally the AI may produce incorrect, incomplete, or factually inaccurate content. Always review AI output before using it in the classroom.
                        </p>
                        <p className="mt-3">
                            We aim for high availability but do not guarantee uninterrupted service. Planned maintenance is communicated in advance where possible.
                        </p>
                    </Section>

                    <Section kicker="08" title="Liability">
                        <p>
                            SARGVISION&rsquo;s total liability to you under these terms is limited to the amount you have paid us in the twelve months preceding any claim, except where such limitation is prohibited by applicable law. We are not liable for indirect, incidental, or consequential losses, including loss of teaching time, reputational impact, or lost opportunities arising from AI errors.
                        </p>
                        <p className="mt-3">
                            Nothing in this clause limits liability for fraud, gross negligence, or any other liability that cannot be limited under Indian law (including the Consumer Protection Act, 2019).
                        </p>
                    </Section>

                    <Section kicker="09" title="Dispute resolution">
                        <p>
                            If a dispute arises, parties first attempt good-faith resolution through direct discussion for at least 30 days. Unresolved disputes are referred to arbitration under the Arbitration and Conciliation Act, 1996, seated in Bengaluru, Karnataka, conducted in English before a single arbitrator appointed by mutual agreement.
                        </p>
                        <p className="mt-3">
                            The courts of Bengaluru have exclusive jurisdiction for any matters that cannot be referred to arbitration.
                        </p>
                    </Section>

                    <Section kicker="10" title="Changes to these terms">
                        <p>
                            We may update these terms as the product evolves or as Indian law changes. Material changes are communicated via email (for paid users) or an in-product banner at least 14 days before they take effect.
                        </p>
                    </Section>

                    <Section kicker="11" title="Governing law and contact">
                        <p>
                            These terms are governed by the laws of the Republic of India.
                        </p>
                        <p className="mt-3">
                            Questions, grievances, or DPDP requests:{" "}
                            <a href="mailto:contact@sargvision.com" className="underline hover:text-foreground">
                                contact@sargvision.com
                            </a>
                            . For DPDP-specific matters, use{" "}
                            <a href="mailto:grievance@sargvision.com" className="underline hover:text-foreground">
                                grievance@sargvision.com
                            </a>
                            .
                        </p>
                    </Section>
                </article>
                </main>
            </div>

            <LandingFooter />
            <PageAudio />
        </div>
    );
}

function Section({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
    return (
        <section className="mt-10 first:mt-0">
            <div className="flex items-baseline gap-3 mb-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-saffron-700">{kicker}</span>
                <h2 className="font-headline font-semibold text-[20px] text-foreground leading-tight">{title}</h2>
            </div>
            <div>{children}</div>
        </section>
    );
}

function Bullet({ children }: { children: React.ReactNode }) {
    return (
        <li className="flex gap-2.5">
            <span className="mt-[9px] w-1.5 h-1.5 rounded-full bg-saffron flex-none" />
            <span>{children}</span>
        </li>
    );
}
