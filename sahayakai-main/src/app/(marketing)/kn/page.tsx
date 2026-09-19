import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'ಸಹಾಯಕ AI (SahayakAI) — ಭಾರತೀಯ ಶಿಕ್ಷಕರಿಗಾಗಿ AI ಸಹಾಯಕ | Kannada',
    description:
        'ಸಹಾಯಕ AI (SahayakAI) ಭಾರತೀಯ ಶಿಕ್ಷಕರಿಗಾಗಿ AI-ಚಾಲಿತ ಬೋಧನಾ ಸಹಾಯಕ. NCERT, CBSE, ICSE ಮತ್ತು ಕರ್ನಾಟಕ ರಾಜ್ಯ ಬೋರ್ಡ್ ಪಠ್ಯಕ್ರಮಕ್ಕೆ ಅನುಗುಣವಾಗಿ ಪಾಠ ಯೋಜನೆ, ಕ್ವಿಜ್, ವರ್ಕ್‌ಶೀಟ್ ರಚಿಸಿ. ೧೧ ಭಾರತೀಯ ಭಾಷೆಗಳಲ್ಲಿ, ವಾಯ್ಸ್-ಫರ್ಸ್ಟ್.',
    keywords: [
        'ಸಹಾಯಕ AI',
        'SahayakAI ಕನ್ನಡ',
        'AI ಶಿಕ್ಷಕ ಸಹಾಯಕ',
        'NCERT ಪಾಠ ಯೋಜನೆ ಕನ್ನಡ',
        'AI lesson plan Kannada',
        'ಶಿಕ್ಷಕರಿಗಾಗಿ AI ಅಪ್ಲಿಕೇಶನ್',
        'ಕರ್ನಾಟಕ ರಾಜ್ಯ ಬೋರ್ಡ್ AI',
        'sahayak ai kannada',
        'AI lesson plan Karnataka',
    ],
    openGraph: {
        title: 'ಸಹಾಯಕ AI (SahayakAI) — ಭಾರತೀಯ ಶಿಕ್ಷಕರಿಗಾಗಿ AI ಸಹಾಯಕ',
        description:
            'NCERT, CBSE ಮತ್ತು ಕರ್ನಾಟಕ ರಾಜ್ಯ ಬೋರ್ಡ್‌ಗಾಗಿ AI ಪಾಠ ಯೋಜನೆ, ಕ್ವಿಜ್, ವರ್ಕ್‌ಶೀಟ್. ೧೧ ಭಾರತೀಯ ಭಾಷೆಗಳಲ್ಲಿ.',
        type: 'website',
        locale: 'kn_IN',
    },
    alternates: {
        canonical: '/kn',
        languages: {
            'kn': '/kn',
            'hi': '/hi',
            'en': '/',
            'bn': '/bn',
            'ta': '/ta',
        },
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'ಸಹಾಯಕ AI (SahayakAI) — ಭಾರತೀಯ ಶಿಕ್ಷಕರಿಗಾಗಿ AI ಸಹಾಯಕ',
    description: 'ಭಾರತೀಯ ಶಿಕ್ಷಕರಿಗಾಗಿ AI-ಚಾಲಿತ ಬೋಧನಾ ಸಹಾಯಕ. NCERT, CBSE, ICSE ಮತ್ತು ೨೮ ರಾಜ್ಯ ಬೋರ್ಡ್‌ಗಳು.',
    url: 'https://sahayakai.com/kn',
    inLanguage: 'kn',
    isPartOf: { '@type': 'WebSite', url: 'https://sahayakai.com' },
};

export default function KannadaPage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <header className="mb-12 text-center">
                <h1 className="text-3xl font-bold text-foreground sm:text-4xl mb-4">
                    ಸಹಾಯಕ AI (SahayakAI)
                </h1>
                <p className="text-xl text-primary font-semibold mb-2">
                    ಭಾರತೀಯ ಶಿಕ್ಷಕರಿಗಾಗಿ AI-ಚಾಲಿತ ಬೋಧನಾ ಸಹಾಯಕ
                </p>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                    ವಾಯ್ಸ್-ಫರ್ಸ್ಟ್ | ೧೧ ಭಾರತೀಯ ಭಾಷೆಗಳು | ೩೦ ವೈಶಿಷ್ಟ್ಯಗಳು | ಕಡಿಮೆ ಬ್ಯಾಂಡ್‌ವಿಡ್ತ್‌ನಲ್ಲಿ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ
                </p>
            </header>

            <section className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">ಸಹಾಯಕ AI ಎಂದರೇನು?</h2>
                <p className="text-foreground mb-4">
                    ಸಹಾಯಕ AI (SahayakAI) ಭಾರತೀಯ K-12 ಶಿಕ್ಷಕರಿಗಾಗಿ AI-ಚಾಲಿತ ಬೋಧನಾ ವೇದಿಕೆ. 
                    ಇದು ಪಾಠ ತಯಾರಿಯ ಸಮಯವನ್ನು ೯೦% ಕಡಿಮೆ ಮಾಡುತ್ತದೆ — ೪೫ ನಿಮಿಷದಿಂದ ಕೇವಲ ೫ ನಿಮಿಷಕ್ಕೆ. 
                    NCERT, CBSE, ICSE ಮತ್ತು ಕರ್ನಾಟಕ ರಾಜ್ಯ ಬೋರ್ಡ್ ಸೇರಿದಂತೆ ೨೮ ರಾಜ್ಯ ಬೋರ್ಡ್‌ಗಳ 
                    ಪಠ್ಯಕ್ರಮಕ್ಕೆ ಹೊಂದಿಕೊಂಡಿದೆ.
                </p>
                <p className="text-foreground mb-4">
                    ಕರ್ನಾಟಕದ ೧೫೦ ಶಿಕ್ಷಕರ ಪೈಲಟ್ ಕಾರ್ಯಕ್ರಮದಲ್ಲಿ ೭೮% ಧಾರಣ ದರ ಸಾಧಿಸಲಾಗಿದೆ. 
                    ಸಹಾಯಕ AI ಕನ್ನಡ ಸೇರಿದಂತೆ ೧೧ ಭಾರತೀಯ ಭಾಷೆಗಳಲ್ಲಿ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ. 
                    ನೀವು ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಬಹುದು ಅಥವಾ ಟೈಪ್ ಮಾಡಬಹುದು ಮತ್ತು AI ತಕ್ಷಣವೇ 
                    ಪಾಠ ಯೋಜನೆ, ಕ್ವಿಜ್, ವರ್ಕ್‌ಶೀಟ್ ರಚಿಸುತ್ತದೆ.
                </p>
            </section>

            <section className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">ಪ್ರಮುಖ ವೈಶಿಷ್ಟ್ಯಗಳು</h2>
                <div className="space-y-4">
                    <div className="border-l-4 border-primary pl-4">
                        <h3 className="font-semibold text-foreground">AI ಪಾಠ ಯೋಜನೆ</h3>
                        <p className="text-muted-foreground">
                            NCERT ಮತ್ತು ಕರ್ನಾಟಕ ರಾಜ್ಯ ಬೋರ್ಡ್ ಪಠ್ಯಕ್ರಮಕ್ಕೆ ಅನುಗುಣವಾಗಿ ಪಾಠ ಯೋಜನೆ ರಚಿಸಿ. 
                            ೫೦,೦೦೦+ ಪಠ್ಯಕ್ರಮ ಮ್ಯಾಪಿಂಗ್‌ಗಳು.
                        </p>
                    </div>
                    <div className="border-l-4 border-info pl-4">
                        <h3 className="font-semibold text-foreground">ಕ್ವಿಜ್ ಜನರೇಟರ್</h3>
                        <p className="text-muted-foreground">
                            ಬ್ಲೂಮ್ಸ್ ಟ್ಯಾಕ್ಸಾನಮಿ ಪ್ರಕಾರ MCQ, ಸಣ್ಣ ಉತ್ತರ ಮತ್ತು ದೀರ್ಘ ಉತ್ತರ ಪ್ರಶ್ನೆಗಳನ್ನು ರಚಿಸಿ.
                        </p>
                    </div>
                    <div className="border-l-4 border-success pl-4">
                        <h3 className="font-semibold text-foreground">ವರ್ಕ್‌ಶೀಟ್ ರಚನೆ</h3>
                        <p className="text-muted-foreground">
                            ವಿಷಯಾಧಾರಿತ ವರ್ಕ್‌ಶೀಟ್‌ಗಳು — ಗಣಿತ, ವಿಜ್ಞಾನ, ಇಂಗ್ಲಿಷ್, ಕನ್ನಡ ಸೇರಿದಂತೆ ಎಲ್ಲಾ ವಿಷಯಗಳು.
                        </p>
                    </div>
                    <div className="border-l-4 border-accent pl-4">
                        <h3 className="font-semibold text-foreground">ವಾಯ್ಸ್ ಇನ್‌ಪುಟ್</h3>
                        <p className="text-muted-foreground">
                            ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಾ, AI ಅರ್ಥಮಾಡಿಕೊಳ್ಳುತ್ತದೆ. ಟೈಪ್ ಮಾಡುವ ಅಗತ್ಯವಿಲ್ಲ — ನಿಮಗೆ ಏನು ಬೇಕು ಎಂದು ಹೇಳಿ.
                        </p>
                    </div>
                </div>
            </section>

            <section className="mb-10 bg-saffron-50 rounded-lg p-6">
                <h2 className="text-xl font-bold text-foreground mb-3">ಸಹಾಯಕ AI ಉಚಿತವಾಗಿ ಬಳಸಿ</h2>
                <p className="text-foreground mb-4">
                    ಪ್ರತಿ ತಿಂಗಳು ೫೦ ಉಚಿತ ಕ್ರೆಡಿಟ್‌ಗಳನ್ನು ಪಡೆಯಿರಿ. ಸರ್ಕಾರಿ ಮತ್ತು ಖಾಸಗಿ ಶಾಲೆಗಳ 
                    ಶಿಕ್ಷಕರಿಗೆ Gold ಯೋಜನೆ ₹೧೪೯/ತಿಂಗಳು ಮತ್ತು Premium ಯೋಜನೆ ₹೩೪೯/ತಿಂಗಳು.
                </p>
            </section>

            <section className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">ಕರ್ನಾಟಕ ಪೈಲಟ್ ಫಲಿತಾಂಶಗಳು</h2>
                <p className="text-foreground mb-4">
                    ಕರ್ನಾಟಕದಲ್ಲಿ ೧೫೦ ಶಿಕ್ಷಕರೊಂದಿಗೆ ನಡೆಸಿದ ಪೈಲಟ್ ಕಾರ್ಯಕ್ರಮದಲ್ಲಿ ೭೮% ಧಾರಣ ದರ 
                    ದಾಖಲಾಗಿದೆ. ಶಿಕ್ಷಕರು ತಮ್ಮ ಪಾಠ ತಯಾರಿ ಸಮಯವನ್ನು ೯೦% ಕಡಿಮೆ ಮಾಡಿದ್ದಾರೆ. 
                    ೩೦ ವೈಶಿಷ್ಟ್ಯಗಳು ಪ್ರಸ್ತುತ ಉತ್ಪಾದನೆಯಲ್ಲಿವೆ, NPS ೭೧+.
                </p>
            </section>

            <nav className="border-t pt-8 mt-8">
                <p className="text-sm text-muted-foreground mb-4">ಇತರ ಭಾಷೆಗಳಲ್ಲಿ ಓದಿ:</p>
                <div className="flex gap-4">
                    <Link href="/" className="text-primary hover:underline">English</Link>
                    <Link href="/hi" className="text-primary hover:underline">हिंदी</Link>
                    <Link href="/bn" className="text-primary hover:underline">বাংলা</Link>
                    <Link href="/ta" className="text-primary hover:underline">தமிழ்</Link>
                </div>
            </nav>
        </>
    );
}
