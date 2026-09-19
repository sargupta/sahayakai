import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'সহায়ক AI (SahayakAI) — ভারতীয় শিক্ষকদের জন্ট AI সহায়ক | Bengali',
    description:
        'সহায়ক AI (SahayakAI) হল ভারতীয় শিক্ষকদের জন্য AI-চালিত শিক্ষণ সহকারী। NCERT, CBSE, ICSE এবং পশ্চিমবঙ্গ বোর্ডের জন্ট পাঠ পরিকল্পনা, কুইজ, ওয়ার্কশীট তৈরি করুন। ১১ট ভারতীয় ভাষায়, ভয়েস-ফার্স্ট',
    keywords: [
        'সহায়ক AI',
        'SahayakAI বাংলা',
        'AI শিক্ষক সহায়ক',
        'NCERT পাঠ পরিকল্পনা বাংলা',
        'AI lesson plan Bengali',
        'শিক্ষকদের জন্ট AI অ্যাপ',
        'পশ্চিমবঙ্গ বোর্ড AI',
        'sahayak ai bangla',
        'AI diye lesson plan',
    ],
    openGraph: {
        title: 'সহায়ক AI (SahayakAI) — ভারতীয় শিক্ষকদের জন্য AI সহায়ক',
        description:
            'NCERT, CBSE এবং পশ্চিমবঙ্গ বোর্ডের জন্ট AI পাঠ পরিকল্পনা, কুইজ, ওয়ার্কশীট। ১১টি ভারতীয় ভাষায়।',
        type: 'website',
        locale: 'bn_IN',
    },
    alternates: {
        canonical: '/bn',
        languages: {
            'bn': '/bn',
            'hi': '/hi',
            'en': '/',
            'kn': '/kn',
            'ta': '/ta',
        },
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'সহায়ক AI (SahayakAI) — ভারতীয় শিক্ষকদের জন্য AI সহায়ক',
    description: 'ভারতীয় শিক্ষকদের জন্য AI-চালিত শিক্ষণ সহকারী। NCERT, CBSE, ICSE এবং ২৮টি রাজ্য বোর্ড।',
    url: 'https://sahayakai.com/bn',
    inLanguage: 'bn',
    isPartOf: { '@type': 'WebSite', url: 'https://sahayakai.com' },
};

export default function BengaliPage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <header className="mb-12 text-center">
                <h1 className="text-3xl font-bold text-foreground sm:text-4xl mb-4">
                    সহায়ক AI (SahayakAI)
                </h1>
                <p className="text-xl text-primary font-semibold mb-2">
                    ভারতীয় শিক্ষকদের জন্ট AI-চালিত শিক্ষণ সহকারী
                </p>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                    ভয়েস-ফার্স্ট | ১১টি ভারতীয় ভাষা | ৩০টি ফিচার | কম-ব্যান্ডুইথে কাজ করে
                </p>
            </header>

            <section className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">সহায়ক AI কী?</h2>
                <p className="text-foreground mb-4">
                    সহায়ক AI (SahayakAI) হল ভারতীয় K-12 শিক্ষকদের জন্য একটি AI-চালিত শিক্ষণ প্ল্যাটফর্ম। 
                    এটি পাঠ প্রস্তুতির সময় ৯০% কমিয়ে দেয় — ৪৫ মিনিট থেকে মাত্র ৫ মিনিটে। NCERT, CBSE, 
                    ICSE এবং পশ্চিমবঙ্গ বোর্ড সহ ২৮টি রাজ্য বোর্ডের পাঠ্যক্রমের সাথে সামঞ্জস্যপূর্ণ।
                </p>
                <p className="text-foreground mb-4">
                    সহায়ক AI বাংলা সহ ১১টি ভারতীয় ভাষায় কাজ করে। আপনি বাংলায় বলতে বা টাইপ করতে পারেন 
                    এবং AI তৎক্ষণাৎ পাঠ পরিকল্পনা, কুইজ, ওয়ার্কশীট তৈরি করে দেবে।
                </p>
            </section>

            <section className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">প্রধান ফিচারসমূহ</h2>
                <div className="space-y-4">
                    <div className="border-l-4 border-primary pl-4">
                        <h3 className="font-semibold text-foreground">AI পাঠ পরিকল্পনা</h3>
                        <p className="text-muted-foreground">
                            NCERT ও পশ্চিমবঙ্গ বোর্ডের পাঠ্যক্রম অনুযায়ী পাঠ পরিকল্পনা তৈরি করুন। 
                            ৫০,০০০+ পাঠ্যক্রম ম্যাপিং।
                        </p>
                    </div>
                    <div className="border-l-4 border-info pl-4">
                        <h3 className="font-semibold text-foreground">কুইজ জেনারেটর</h3>
                        <p className="text-muted-foreground">
                            ব্লুমের ট্যাক্সোনমি অনুযায়ী MCQ, সংক্ষিপ্ত উত্তর এবং দীর্ঘ উত্তর প্রশ্ন তৈরি করুন।
                        </p>
                    </div>
                    <div className="border-l-4 border-success pl-4">
                        <h3 className="font-semibold text-foreground">ওয়ার্কশীট তৈরি</h3>
                        <p className="text-muted-foreground">
                            বিষয়ভিত্তিক ওয়ার্কশীট — গণিত, বিজ্ঞান, ইংরেজি, বাংলা সহ সকল বিষয়।
                        </p>
                    </div>
                    <div className="border-l-4 border-accent pl-4">
                        <h3 className="font-semibold text-foreground">ভয়েস ইনপুট</h3>
                        <p className="text-muted-foreground">
                            বাংলায় বলুন, AI বুঝবে। টাইপ করার দরকার নেই — শুধু বলুন কী চান।
                        </p>
                    </div>
                </div>
            </section>

            <section className="mb-10 bg-saffron-50 rounded-lg p-6">
                <h2 className="text-xl font-bold text-foreground mb-3">সহায়ক AI বিনামূল্যে ব্যবহার করুন</h2>
                <p className="text-foreground mb-4">
                    প্রতি মাসে ৫০টি ফ্রি ক্রেডিট পান। সরকারি ও বেসরকারি স্কুলের শিক্ষকদের জন্য 
                    Gold প্ল্যান মাত্র ₹১৪৯/মাস এবং Premium প্ল্যান ₹৩৪৯/মাস।
                </p>
            </section>

            <nav className="border-t pt-8 mt-8">
                <p className="text-sm text-muted-foreground mb-4">অন্যান্য ভাষায় পড়ুন:</p>
                <div className="flex gap-4">
                    <Link href="/" className="text-primary hover:underline">English</Link>
                    <Link href="/hi" className="text-primary hover:underline">हिंदी</Link>
                    <Link href="/kn" className="text-primary hover:underline">ಕನ್ನಡ</Link>
                    <Link href="/ta" className="text-primary hover:underline">தமிழ்</Link>
                </div>
            </nav>
        </>
    );
}
