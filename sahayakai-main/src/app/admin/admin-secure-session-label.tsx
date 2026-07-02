'use client';

import { useLanguage } from '@/context/language-context';
import { LANGUAGE_TO_ISO } from '@/types';

// Component-LOCAL translation table for the admin banner label.
// Keyed by the 11 supported ISO codes, resolved by the UI language (uiLangCode).
const ADMIN_SECURE_SESSION: Record<string, string> = {
    en: 'Admin Secure Session',
    hi: 'व्यवस्थापक सुरक्षित सत्र',
    mr: 'प्रशासक सुरक्षित सत्र',
    bn: 'অ্যাডমিন সুরক্ষিত সেশন',
    pa: 'ਐਡਮਿਨ ਸੁਰੱਖਿਅਤ ਸੈਸ਼ਨ',
    gu: 'એડમિન સુરક્ષિત સત્ર',
    or: 'ଆଡମିନ୍ ସୁରକ୍ଷିତ ସେସନ୍',
    ta: 'நிர்வாகி பாதுகாப்பான அமர்வு',
    te: 'అడ్మిన్ సురక్షిత సెషన్',
    kn: 'ನಿರ್ವಾಹಕ ಸುರಕ್ಷಿತ ಅವಧಿ',
    ml: 'അഡ്മിൻ സുരക്ഷിത സെഷൻ',
};

export function AdminSecureSessionLabel({ className }: { className?: string }) {
    const { language } = useLanguage();
    const uiLangCode = LANGUAGE_TO_ISO[language] || 'en';
    const label = ADMIN_SECURE_SESSION[uiLangCode] || ADMIN_SECURE_SESSION.en;
    return <span className={className}>{label}</span>;
}
