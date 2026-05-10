import type { Metadata } from 'next';
import Link from 'next/link';

const publishedTime = '2026-05-10T08:00:00+05:30';
const modifiedTime = '2026-05-10T08:00:00+05:30';

export const metadata: Metadata = {
    title: 'SahayakAI Kya Hai? AI Se Lesson Plan Kaise Banaye | Teacher Ke Liye AI App',
    description:
        'SahayakAI ek AI-powered teaching assistant hai jo Indian teachers ke liye lesson plan, quiz, worksheet banata hai. Hindi, Bengali, Tamil mein kaam karta hai. NCERT, CBSE, ICSE aur sabhi state boards.',
    keywords: [
        'sahayak ai kya hai',
        'AI se lesson plan kaise banaye',
        'teacher ke liye AI app',
        'NCERT lesson plan AI hindi',
        'AI teaching app India',
        'lesson plan banane ka tarika',
        'AI se quiz kaise banaye',
        'SahayakAI app download',
        'free AI teacher app India',
        'AI se padhai kaise karaye',
        'best AI app for Indian teachers',
        'government school teacher AI app',
    ],
    alternates: {
        canonical: '/blog/sahayak-ai-kya-hai',
        languages: {
            'en': '/blog/ai-lesson-plan-generator-india',
            'hi': '/hi/ai-se-lesson-plan-kaise-banaye',
        },
    },
    openGraph: {
        title: 'SahayakAI Kya Hai? AI Se Lesson Plan Kaise Banaye',
        description:
            'SahayakAI ek free AI app hai jo teachers ke liye lesson plan, quiz, worksheet banata hai. Hindi mein voice se use karo.',
        type: 'article',
        publishedTime,
        modifiedTime,
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'Article',
            headline: 'SahayakAI Kya Hai? AI Se Lesson Plan Kaise Banaye',
            description:
                'SahayakAI ek AI teaching assistant hai Indian teachers ke liye. Lesson plan, quiz, worksheet Hindi mein banao.',
            datePublished: publishedTime,
            dateModified: modifiedTime,
            author: { '@type': 'Organization', name: 'SARGVISION Intelligence' },
            publisher: {
                '@type': 'Organization',
                name: 'SARGVISION Intelligence',
                url: 'https://sahayakai.com',
            },
            mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': 'https://sahayakai.com/blog/sahayak-ai-kya-hai',
            },
            inLanguage: 'hi-Latn',
        },
        {
            '@type': 'FAQPage',
            mainEntity: [
                {
                    '@type': 'Question',
                    name: 'SahayakAI kya hai?',
                    acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'SahayakAI ek AI-powered teaching assistant hai jo Indian K-12 teachers ke liye bana hai. Ye lesson plan, quiz, worksheet, rubric, visual aid aur bahut kuch banata hai. 11 Indian languages mein kaam karta hai â Hindi, Bengali, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Odia, Punjabi aur English. NCERT, CBSE, ICSE aur 28 state boards ke curriculum ke saath aligned hai.',
                    },
                },
                {
                    '@type': 'Question',
                    name: 'AI se lesson plan kaise banaye?',
                    acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'SahayakAI mein lesson plan banana bohot aasan hai. App kholo, apna board (CBSE, ICSE ya state board) chuno, class aur subject select karo, chapter chuno aur generate button dabao. 5 minute mein pura lesson plan ready ho jayega with learning objectives, activities, assessment questions aur homework. Aap Hindi mein bol ke bhi bata sakte ho ki kya chahiye.',
                    },
                },
                {
                    '@type': 'Question',
                    name: 'Kya SahayakAI free hai?',
                    acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'Haan, SahayakAI ka free plan hai jismein har mahine 50 credits milte hain. Isse aap kai lesson plans, quizzes aur worksheets bana sakte ho. Zyada use ke liye Gold plan Rs 149 per month (500 credits) aur Premium plan Rs 349 per month (2000 credits) hai.',
                    },
                },
                {
                    '@type': 'Question',
                    name: 'Kya main Hindi mein bol ke use kar sakta hoon?',
                    acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'Haan bilkul. SahayakAI voice-first app hai. Aap microphone icon dabao aur Hindi mein bolo ki kya chahiye â jaise "Class 8 Science ka Chapter 4 ka lesson plan banao" â aur AI turant bana dega. Type karne ki zaroorat nahi hai.',
                    },
                },
                {
                    '@type': 'Question',
                    name: 'SahayakAI aur ChatGPT mein kya fark hai?',
                    acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'ChatGPT ek general AI hai jisko Indian curriculum ki koi samajh nahi hai. SahayakAI specifically Indian teachers ke liye bana hai â isme 50,000+ curriculum mappings hain NCERT, CBSE, ICSE aur 28 state boards ke liye. Hindi mein voice input le sakta hai, offline kaam karta hai, aur lesson plan format mein direct output deta hai. ChatGPT mein ye sab manually karna padta hai.',
                    },
                },
            ],
        },
    ],
};

export default function SahayakAIKyaHaiPage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <article className="prose prose-gray max-w-none">
                <header>
                    <time dateTime="2026-05-10" className="text-sm text-gray-500 not-prose">
                        10 May 2026
                    </time>
                    <h1 className="mt-2">
                        SahayakAI Kya Hai? AI Se Lesson Plan Kaise Banaye
                    </h1>
                </header>

                <div className="rounded-lg border-l-4 border-indigo-500 bg-indigo-50 p-4 not-prose my-6">
                    <p className="text-base font-medium text-gray-800">
                        SahayakAI ek AI-powered teaching assistant hai jo specifically Indian
                        teachers ke liye bana hai. Isme aap apna board, class aur chapter select
                        karke 5 minute mein complete lesson plan bana sakte ho â Hindi mein bol ke
                        bhi. NCERT, CBSE, ICSE aur 28 state boards ke saath aligned hai. Free
                        plan mein har mahine 50 credits milte hain.
                    </p>
                </div>

                <h2>SahayakAI Kya Hai?</h2>
                <p>
                    SahayakAI (Sahayak AI) ek AI-powered teaching app hai jo India ke 1.01 crore
                    K-12 teachers ke liye bani hai. Ye app lesson plan banana, quiz generate karna,
                    worksheet create karna, rubric banana, visual aids design karna â ye sab kaam
                    karta hai. Sabse khaas baat ye hai ki ye app Hindi, Bengali, Tamil, Telugu,
                    Kannada aur 6 aur Indian languages mein kaam karta hai. Aapko English mein
                    type karne ki zaroorat nahi â seedha Hindi mein bol sakte ho.
                </p>
                <p>
                    SahayakAI NCERT, CBSE, ICSE aur sabhi 28 state boards ke curriculum ko samajhta
                    hai. Isme 50,000 se zyada curriculum mappings hain, matlab har chapter ke liye
                    sahi learning objectives, activities aur assessment questions automatically aa
                    jaate hain. Ek government school teacher ho ya private school mein â SahayakAI
                    dono ke liye kaam karta hai.
                </p>

                <h2>AI Se Lesson Plan Kaise Banaye â Step by Step</h2>
                <p>
                    SahayakAI mein <Link href="/lesson-plan">lesson plan</Link> banana bohot simple
                    hai. Pehle app kholo (sahayakai.com). Phir apna board select karo â jaise CBSE.
                    Phir class chuno (jaise Class 7), subject chuno (Mathematics), aur chapter
                    chuno (jaise Integers). Generate button dabao. Bas 5 minute mein aapka pura
                    lesson plan ready ho jayega.
                </p>
                <p>
                    Har lesson plan mein ye sab included hota hai: learning objectives jo board
                    syllabus se aligned hain, lesson flow with time allocation, student activities
                    aur discussion questions, assessment questions (easy, medium, hard), aur
                    homework suggestions. Aap baad mein koi bhi section edit kar sakte ho â difficulty
                    badal sakte ho, local examples jod sakte ho, ya language switch kar sakte ho.
                </p>

                <h2>Hindi Mein Voice Se Use Karo</h2>
                <p>
                    Bahut se Indian teachers ko typing se zyada bolna aasan lagta hai, khaas kar
                    ke regional language mein. SahayakAI voice-first app hai â microphone icon
                    dabao aur Hindi mein bolo. Jaise bolo &ldquo;Class 9 Science ka Light chapter
                    ka lesson plan banao&rdquo; â aur AI turant generate kar dega. Ye feature
                    11 languages mein kaam karta hai. Details ke liye{' '}
                    <Link href="/blog/teaching-assistant-app-indian-languages">
                        Indian languages support
                    </Link>{' '}
                    article padho.
                </p>

                <h2>SahayakAI vs ChatGPT â Fark Kya Hai?</h2>
                <p>
                    ChatGPT ek general-purpose AI hai. Agar aap isse NCERT Class 10 Chapter 4 ka
                    lesson plan maangoge, toh use pata hi nahi ki Chapter 4 mein kya hai. SahayakAI
                    mein 50,000+ curriculum mappings hain â har chapter ka har learning outcome
                    mapped hai. ChatGPT mein Hindi voice input nahi hai, offline nahi chalta, aur
                    lesson plan format mein output nahi deta. SahayakAI ye sab karta hai, aur free
                    bhi hai. Aur padho:{' '}
                    <Link href="/blog/ai-lesson-plan-generator-india">
                        AI Lesson Plan Generator India
                    </Link>.
                </p>

                <h2>Offline Bhi Chalta Hai</h2>
                <p>
                    India mein bahut se schools mein internet connectivity reliable nahi hai.
                    SahayakAI ek Progressive Web App (PWA) hai jo offline bhi kaam karta hai. Jab
                    internet ho tab content generate karo, baad mein classroom mein bina internet
                    ke use karo. Plans ko PDF mein export karke print bhi kar sakte ho.
                </p>

                <h2>Pricing â Teachers Ke Liye Sasta</h2>
                <p>
                    SahayakAI ka free plan hai jismein har mahine 50 credits milte hain. Ye enough
                    hai kai lesson plans banane ke liye. Zyada chahiye toh Gold plan sirf Rs 149
                    per month hai (500 credits), aur Premium plan Rs 349 per month (2000 credits).
                    Schools ke liye institutional rates available hain â{' '}
                    <Link href="/for-schools">schools page</Link> dekho.
                </p>

                <hr className="my-10" />

                <section className="not-prose">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">
                        Aksar Puchhe Jaane Wale Sawaal (FAQ)
                    </h2>
                    <dl className="space-y-6">
                        <div>
                            <dt className="font-semibold text-gray-900">
                                SahayakAI kya hai?
                            </dt>
                            <dd className="mt-2 text-gray-600">
                                SahayakAI ek AI-powered teaching assistant hai jo Indian K-12
                                teachers ke liye bana hai. Ye lesson plan, quiz, worksheet, rubric
                                aur 30 se zyada features deta hai. 11 Indian languages mein kaam
                                karta hai aur NCERT, CBSE, ICSE aur 28 state boards ke curriculum
                                ke saath aligned hai.
                            </dd>
                        </div>
                        <div>
                            <dt className="font-semibold text-gray-900">
                                AI se lesson plan kaise banaye?
                            </dt>
                            <dd className="mt-2 text-gray-600">
                                SahayakAI kholo, board select karo, class aur subject chuno,
                                chapter chuno aur generate button dabao. 5 minute mein complete
                                lesson plan ready. Hindi mein bol ke bhi bata sakte ho.
                            </dd>
                        </div>
                        <div>
                            <dt className="font-semibold text-gray-900">
                                Kya SahayakAI free hai?
                            </dt>
                            <dd className="mt-2 text-gray-600">
                                Haan, free plan mein 50 credits milte hain har mahine. Gold plan
                                Rs 149/month aur Premium Rs 349/month hai.
                            </dd>
                        </div>
                        <div>
                            <dt className="font-semibold text-gray-900">
                                SahayakAI aur ChatGPT mein kya fark hai?
                            </dt>
                            <dd className="mt-2 text-gray-600">
                                ChatGPT ko Indian curriculum ki samajh nahi hai. SahayakAI mein
                                50,000+ curriculum mappings hain, Hindi voice input hai, offline
                                chalta hai, aur direct lesson plan format mein output deta hai.
                            </dd>
                        </div>
                    </dl>
                </section>

                <nav className="mt-12 border-t border-gray-200 pt-8 not-prose">
                    <Link
                        href="/blog"
                        className="text-sm font-medium text-indigo-600 hover:underline"
                    >
                        &larr; Back to all articles
                    </Link>
                </nav>
            </article>
        </>
    );
}

