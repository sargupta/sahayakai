import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'சகாயக் AI (SahayakAI) — இந்திய ஆசிரியர்களுக்கான AI உதவியாளர் | Tamil',
    description:
        'சகாயக் AI (SahayakAI) இந்திய ஆசிரியர்களுக்கான AI-இயங்கும் கற்பித்தல் உதவியாளர். NCERT, CBSE, ICSE மற்றும் தமிழ்நாடு அரசு வாரியத்திற்கான பாடத் திட்டம், வினாடி வினா, பணித்தாள் உருவாக்குங்கள். 11 இந்திய மொழிகளில், குரல்-முதல்.',
    keywords: [
        'சகாயக் AI',
        'SahayakAI தமிழ்',
        'AI ஆசிரியர் உதவியாளர்',
        'NCERT பாடத் திட்டம் தமிழ்',
        'AI lesson plan Tamil',
        'ஆசிரியர்களுக்கான AI ஆப்',
        'தமிழ்நாடு வாரியம் AI',
        'sahayak ai tamil',
        'AI lesson plan Tamil Nadu',
    ],
    openGraph: {
        title: 'சகாயக் AI (SahayakAI) — இந்திய ஆசிரியர்களுக்கான AI உதவியாளர்',
        description:
            'NCERT, CBSE மற்றும் தமிழ்நாடு வாரியத்திற்கான AI பாடத் திட்டம், வினாடி வினா, பணித்தாள். 11 இந்திய மொழிகளில்.',
        type: 'website',
        locale: 'ta_IN',
    },
    alternates: {
        canonical: '/ta',
        languages: {
            'ta': '/ta',
            'hi': '/hi',
            'en': '/',
            'bn': '/bn',
            'kn': '/kn',
        },
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'சகாயக் AI (SahayakAI) — இந்திய ஆசிரியர்களுக்கான AI உதவியாளர்',
    description: 'இந்திய ஆசிரியர்களுக்கான AI-இயங்கும் கற்பித்தல் உதவியாளர். NCERT, CBSE, ICSE மற்றும் 28 மாநில வாரியங்கள்.',
    url: 'https://sahayakai.com/ta',
    inLanguage: 'ta',
    isPartOf: { '@type': 'WebSite', url: 'https://sahayakai.com' },
};

export default function TamilPage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <header className="mb-12 text-center">
                <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl mb-4">
                    சகாயக் AI (SahayakAI)
                </h1>
                <p className="text-xl text-orange-600 font-semibold mb-2">
                    இந்திய ஆசிரியர்களுக்கான AI-இயங்கும் கற்பித்தல் உதவியாளர்
                </p>
                <p className="text-gray-600 max-w-2xl mx-auto">
                    குரல்-முதல் | 11 இந்திய மொழிகள் | 30 அம்சங்கள் | குறைந்த அலைவரிசையில் இயங்கும்
                </p>
            </header>

            <section className="mb-10">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">சகாயக் AI என்றால் என்ன?</h2>
                <p className="text-gray-700 mb-4">
                    சகாயக் AI (SahayakAI) இந்திய K-12 ஆசிரியர்களுக்கான AI-இயங்கும் கற்பித்தல் தளம். 
                    இது பாடத் தயாரிப்பு நேரத்தை 90% குரைக்கிறது — 45 நிமிடத்திலிருந்து வெறும் 5 நிமிடத்திற்கு. 
                    NCERT, CBSE, ICSE மற்றும் தமிழ்நாடு அரசு வாரியம் உள்ளிட்ட 28 மாநில வாரியங்களின் 
                    பாடத்திட்டத்துடன் இணக்கமானது.
                </p>
                <p className="text-gray-700 mb-4">
                    சகாயக் AI தமிழ் உள்ளிட்ட 11 இந்திய மொழிகளில் இயங்குகிறது. நீங்கள் தமிழில் 
                    பேசலாம் அல்லது தட்டச்சு செய்யலாம், AI உடனடியாக பாடத் திட்டம், வினாடி வினா, 
                    பணித்தாள் உருவாக்கும்.
                </p>
            </section>

            <section className="mb-10">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">முக்கிய அம்சங்கள்</h2>
                <div className="space-y-4">
                    <div className="border-l-4 border-orange-500 pl-4">
                        <h3 className="font-semibold text-gray-900">AI பாடத் திட்டம்</h3>
                        <p className="text-gray-600">
                            NCERT மற்றும் தமிழ்நாடு அரசு வாரியப் பாடத்திட்டத்திற்கு ஏற்ப பாடத் திட்டம் உருவாக்குங்கள். 
                            50,000+ பாடத்திட்ட வரைபடங்கள்.
                        </p>
                    </div>
                    <div className="border-l-4 border-blue-500 pl-4">
                        <h3 className="font-semibold text-gray-900">வினாடி வினா ஜெனரேட்டர்</h3>
                        <p className="text-gray-600">
                            ப்ளூம்ஸ் டாக்சானமி படி MCQ, குறுகிய விடை மற்றும் நீண்ட விடை கேள்விகளை உருவாக்குங்கள்.
                        </p>
                    </div>
                    <div className="border-l-4 border-green-500 pl-4">
                        <h3 className="font-semibold text-gray-900">பணித்தாள் உருவாக்கம்</h3>
                        <p className="text-gray-600">
                            பாடவாரி பணித்தாள்கள் — கணிதம், அறிவியல், ஆங்கிலம், தமிழ் உள்ளிட்ட அனைத்து பாடங்களும்.
                        </p>
                    </div>
                    <div className="border-l-4 border-purple-500 pl-4">
                        <h3 className="font-semibold text-gray-900">குரல் உள்ளீடு</h3>
                        <p className="text-gray-600">
                            தமிழில் பேசுங்கள், AI புரிந்துகொள்ளும். தட்டச்சு செய்ய வேண்டாம் — என்ன வேண்டும் என்று சொல்லுங்கள்.
                        </p>
                    </div>
                </div>
            </section>

            <section className="mb-10 bg-orange-50 rounded-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-3">சகாயக் AI-ஐ இலவசமாகப் பயன்படுத்துங்கள்</h2>
                <p className="text-gray-700 mb-4">
                    மாதம் 50 இலவச கிரெடிட்கள் பெறுங்கள். அரசு மற்றும் தனியார் பள்ளி ஆசிரியர்களுக்கு 
                    Gold திட்டம் ₹149/மாதம் மற்றும் Premium திட்டம் ₹349/மாதம்.
                </p>
            </section>

            <section className="mb-10">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">தமிழ்நாட்டு ஆசிரியர்களுக்கு ஏன் சகாயக் AI?</h2>
                <p className="text-gray-700 mb-4">
                    தமிழ்நாடு அரசு வாரியத்தின் பாடத்திட்டத்துடன் நேரடியாக இணைக்கப்பட்டுள்ளது. 
                    தமிழ் வழிக் கல்வி ஆசிரியர்களுக்கு சகாயக் AI இயல்பான தமிழ் சொற்களில் 
                    பாடத் திட்டம், கேள்விகள், பணித்தாள்கள் உருவாக்குகிறது — இது ஆங்கிலத்திலிருந்து 
                    மொழிபெயர்ப்பு அல்ல, நேரடியாகத் தமிழில் உருவாக்கப்படுகிறது.
                </p>
            </section>

            <nav className="border-t pt-8 mt-8">
                <p className="text-sm text-gray-500 mb-4">மற்ற மொழிகளில் படிக்கவும்:</p>
                <div className="flex gap-4">
                    <Link href="/" className="text-orange-600 hover:underline">English</Link>
                    <Link href="/hi" className="text-orange-600 hover:underline">हिंदी</Link>
                    <Link href="/bn" className="text-orange-600 hover:underline">বাংলা</Link>
                    <Link href="/kn" className="text-orange-600 hover:underline">ಕನ್ನಡ</Link>
                </div>
            </nav>
        </>
    );
}
