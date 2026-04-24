"use client";

import { Calendar, MessageCircle } from "lucide-react";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/landing-footer";
import { ScriptMarks } from "@/components/landing/script-marks";
import { useAuth } from "@/context/auth-context";

function getWhatsAppDeepLink(): string {
    const phone = process.env.NEXT_PUBLIC_FOUNDER_WHATSAPP?.replace(/\D/g, "");
    if (!phone) return "mailto:contact@sargvision.com";
    const message = encodeURIComponent(
        "Hi, I read the SahayakAI About page. I would like to connect."
    );
    return `https://wa.me/${phone}?text=${message}`;
}

export function AboutClient() {
    const { openAuthModal } = useAuth();
    const whatsAppLink = getWhatsAppDeepLink();

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

                {/* Hero */}
                <section className="relative z-10 max-w-[760px] mx-auto px-6 sm:px-12 pt-[52px] pb-10 text-center">
                    <div className="inline-flex items-center gap-2 text-[12px] font-medium text-saffron-700 bg-saffron-50 border border-saffron-200 rounded-full px-[14px] py-[6px] mb-7">
                        <span className="w-1.5 h-1.5 rounded-full bg-saffron" />
                        About SahayakAI
                    </div>

                    <h1 className="font-headline font-extrabold tracking-tight text-[44px] sm:text-[56px] leading-[1.05] max-w-[22ch] mx-auto text-foreground">
                        The operating system{' '}
                        <span className="italic font-normal text-saffron-700">for teaching in India.</span>
                    </h1>

                    <p className="font-body text-[17px] sm:text-[18px] text-neutral-600 leading-[1.55] max-w-[54ch] mt-6 mx-auto">
                        India has 1.01 crore school teachers and one of the most demanding pedagogies on the planet. SahayakAI gives every one of them back six hours a week, a professional instrument, and a network of peers, in 11 Indian languages, on any Android phone.
                    </p>
                </section>

                {/* Mission */}
                <section className="relative z-10 max-w-[720px] mx-auto px-6 sm:px-12 pb-10">
                    <div className="rounded-[14px] bg-white border-l-4 border-saffron-200 px-7 py-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-saffron-700 mb-2">
                            Our mission
                        </div>
                        <p className="font-headline font-medium italic text-[18px] leading-[1.55] text-foreground">
                            Give Indian teachers the same digital infrastructure lawyers, doctors, and bankers have had for decades. Built for our languages, our boards, our classrooms. Built in India, for Indian classrooms.
                        </p>
                    </div>
                </section>

                {/* Why now */}
                <Section kicker="01" title="Why we built it">
                    <p>
                        The Indian teacher&rsquo;s day has been mis-designed for a generation. Five periods, 150 pupils, three languages, four boards, a new NEP policy every two years, and a smartphone that was supposed to save time but mostly eats it.
                    </p>
                    <p className="mt-3">
                        Every existing tool was built for a teacher who isn&rsquo;t Indian. English-only interfaces. Desktop-first assumptions. Subscription tiers that cost more than a textbook. Zero grounding in NCERT or the twenty-eight state boards. Zero respect for voice as a primary input when most of India types with one thumb.
                    </p>
                    <p className="mt-3">
                        SahayakAI starts from the opposite corner. Voice-first. 11 Indian languages. NCERT and board-aligned. Designed for low-bandwidth Android phones. Priced less than a single textbook. Built so a teacher in Raichur and a principal in Bengaluru can use the same product on the same morning.
                    </p>
                </Section>

                {/* How it works */}
                <Section kicker="02" title="What you can do with SahayakAI">
                    <ul className="mt-1 space-y-2.5">
                        <Bullet>
                            <strong>Prep desk.</strong> Voice-first lesson prep across 7 AI tools: lesson plans, quizzes, worksheets, rubrics, visual aids, exam papers, and virtual field trips. NCERT and state-board aligned. 11 languages.
                        </Bullet>
                        <Bullet>
                            <strong>AI co-teacher.</strong> VIDYA, a persistent pedagogy coach that lives on every page and answers in your language.
                        </Bullet>
                        <Bullet>
                            <strong>Parent hotline.</strong> AI voice calls to parents in their own language when a student is absent or progress needs to be shared.
                        </Bullet>
                        <Bullet>
                            <strong>Staffroom.</strong> India&rsquo;s first structured professional teacher network. Share lesson plans, rubrics, and ideas.
                        </Bullet>
                        <Bullet>
                            <strong>Pro inbox.</strong> Purpose-built professional messaging for teachers. Searchable, structured, not WhatsApp.
                        </Bullet>
                        <Bullet>
                            <strong>Operating system.</strong> PWA that installs like an app. 28 state boards. Designed for cheap phones and slow networks.
                        </Bullet>
                    </ul>
                </Section>

                {/* Who builds it */}
                <Section kicker="03" title="Who builds it">
                    <p>
                        SahayakAI is a product of <strong>SARGVISION Intelligence Pvt. Ltd.</strong>, an education-AI company based in Bengaluru. A small team of engineers, designers, and pedagogy leads in active conversation with Indian school leaders, academic institutions, and state government education departments.
                    </p>
                    <p className="mt-3">
                        We build in India, for India. We ship on Indian infrastructure, staff on Indian timezones, and price in rupees. We reinvest aggressively into the product so every plan we sell makes SahayakAI a little better for the next teacher who installs it.
                    </p>
                </Section>

                {/* Reach */}
                <Section kicker="04" title="Where we are today">
                    <ul className="mt-1 space-y-2.5">
                        <Bullet>In active pilots with Karnataka teacher cohorts</Bullet>
                        <Bullet>Engaging with Karnataka state education stakeholders on state-wide rollout</Bullet>
                        <Bullet>Opening to Tier 2 CBSE mid-fee private schools in Karnataka and Telangana</Bullet>
                        <Bullet>Next lane: seven other states, starting with Kannada and Telugu because that is where our relationships are warmest</Bullet>
                    </ul>
                </Section>

                {/* CTA */}
                <section className="relative z-10 max-w-[640px] mx-auto px-6 sm:px-12 pt-6 pb-20 text-center">
                    <div className="bg-white border border-black/5 rounded-[14px] px-8 py-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                        <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-saffron-700 bg-saffron-50 border border-saffron-200 rounded-full px-[12px] py-[5px] mb-5">
                            Talk to the founder
                        </div>
                        <h2 className="font-headline font-extrabold tracking-tight text-[28px] sm:text-[32px] leading-tight text-foreground">
                            Build with us, or join us.
                        </h2>
                        <p className="mt-3 text-[15px] text-neutral-600 leading-[1.55] max-w-[46ch] mx-auto">
                            If you are a school leader, a government official, or a teacher who wants to pilot SahayakAI, come say hello.
                        </p>
                        <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
                            <a
                                href={whatsAppLink}
                                target={whatsAppLink.startsWith("http") ? "_blank" : undefined}
                                rel={whatsAppLink.startsWith("http") ? "noopener noreferrer" : undefined}
                                className="inline-flex items-center justify-center gap-2 text-[14px] font-medium px-[22px] py-[13px] rounded-full bg-saffron text-white shadow-[0_14px_28px_-12px_hsl(28_70%_45%/0.45)] hover:bg-saffron-600 transition-colors cursor-pointer"
                            >
                                <MessageCircle className="w-[15px] h-[15px]" strokeWidth={2.2} />
                                Message us
                            </a>
                            <a
                                href="https://calendly.com/contact-sargvision/30min"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-2 text-[14px] font-medium px-[22px] py-[13px] rounded-full bg-white/70 backdrop-blur border border-black/15 text-foreground hover:bg-white/90 transition-colors"
                            >
                                <Calendar className="w-[15px] h-[15px]" strokeWidth={2.2} />
                                Book a demo
                            </a>
                        </div>
                    </div>
                </section>
            </div>

            <LandingFooter />
        </div>
    );
}

function Section({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
    return (
        <section className="relative z-10 max-w-[720px] mx-auto px-6 sm:px-12 pb-8 font-body text-[15px] text-neutral-700 leading-[1.7]">
            <div className="flex items-baseline gap-3 mb-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-saffron-700">{kicker}</span>
                <h2 className="font-headline font-semibold text-[22px] text-foreground leading-tight">{title}</h2>
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
