"use client";

import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/landing-footer";
import { ScriptMarks } from "@/components/landing/script-marks";
import { useAuth } from "@/context/auth-context";

export function TermsClient() {
    const { openAuthModal } = useAuth();

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

                <section className="relative z-10 max-w-[720px] mx-auto px-6 sm:px-12 pt-[52px] pb-8">
                    <div className="inline-flex items-center gap-2 text-[12px] font-medium text-saffron-700 bg-saffron-50 border border-saffron-200 rounded-full px-[14px] py-[6px] mb-6">
                        <span className="w-1.5 h-1.5 rounded-full bg-saffron" />
                        Legal
                    </div>

                    <h1 className="font-headline font-extrabold tracking-tight text-[40px] sm:text-[48px] leading-[1.05] text-foreground">
                        Terms of Service
                    </h1>
                    <p className="font-body text-[15px] text-neutral-500 mt-3">
                        Last updated: April 2026. Governed by the laws of India.
                    </p>
                </section>

                <article className="relative z-10 max-w-[720px] mx-auto px-6 sm:px-12 pb-16 font-body text-[15px] text-neutral-700 leading-[1.7]">
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
                            <Bullet>Using SahayakAI for your own teaching, administrative, or academic work — not to resell or rebadge the service</Bullet>
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
                            We are committed to the Digital Personal Data Protection Act, 2023 (DPDP). SahayakAI does not require student personal data to function. When teachers do enter minimal class-level information (class numbers, subject names, attendance markers), we process it under the grounds specified in your consent.
                        </p>
                        <p className="mt-3">
                            Full privacy rules, your rights as a Data Principal, and how to exercise them are available at{" "}
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
                            SARGVISION&rsquo;s total liability to you under these terms is limited to the amount you have paid us in the twelve months preceding any claim. We are not liable for indirect, incidental, or consequential losses, including loss of teaching time, reputational impact, or lost opportunities arising from AI errors.
                        </p>
                    </Section>

                    <Section kicker="09" title="Changes to these terms">
                        <p>
                            We may update these terms as the product evolves or as Indian law changes. Material changes are communicated via email (for paid users) or an in-product banner at least 14 days before they take effect.
                        </p>
                    </Section>

                    <Section kicker="10" title="Jurisdiction and contact">
                        <p>
                            These terms are governed by the laws of the Republic of India. Disputes are subject to the exclusive jurisdiction of the courts of Bengaluru, Karnataka.
                        </p>
                        <p className="mt-3">
                            Questions, grievances, or DPDP requests:{" "}
                            <a href="mailto:contact@sargvision.com" className="underline hover:text-foreground">
                                contact@sargvision.com
                            </a>
                        </p>
                    </Section>
                </article>
            </div>

            <LandingFooter />
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
