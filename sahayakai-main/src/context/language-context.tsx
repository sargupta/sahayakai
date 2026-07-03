"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, LANGUAGES } from '@/types';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getProfileData, updateProfileAction } from '@/app/actions/profile';

type LanguageContextType = {
    language: Language;
    setLanguage: (lang: Language, persist?: boolean) => Promise<void>;
    t: (key: string) => string;
    isLoaded: boolean;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * Per-locale dictionaries (tranche 3, 2026-07-03).
 *
 * The dictionary used to live inline here as a single ~7,400-line object —
 * every page shipped all 11 languages (~1.6 MB of translation data) to every
 * user. Locales now live in src/locales/<language>.json and are code-split:
 * a session downloads at most ONE locale chunk, and English sessions download
 * none (keys are the English strings, so the no-dictionary fallback IS
 * English).
 *
 * Keys remain the English source strings for now; the stable-slug key
 * migration is tracked in docs/EXECUTION_PLAN_2026-07.md.
 */
type Dict = Record<string, string>;

const LOCALE_LOADERS: Partial<Record<Language, () => Promise<{ default: Dict }>>> = {
    Hindi: () => import('@/locales/hindi.json'),
    Kannada: () => import('@/locales/kannada.json'),
    Tamil: () => import('@/locales/tamil.json'),
    Telugu: () => import('@/locales/telugu.json'),
    Marathi: () => import('@/locales/marathi.json'),
    Bengali: () => import('@/locales/bengali.json'),
    Gujarati: () => import('@/locales/gujarati.json'),
    Punjabi: () => import('@/locales/punjabi.json'),
    Malayalam: () => import('@/locales/malayalam.json'),
    Odia: () => import('@/locales/odia.json'),
};

// Session-lifetime cache so switching back to an already-visited language
// never refetches its chunk.
const loadedDicts = new Map<Language, Dict>();

// BCP-47 language tags for each Language. Used for:
//   - <html lang> attribute (screen readers, hyphenation, Chrome auto-translate)
//   - Web Speech API's SpeechRecognition.lang (transcription in the right language)
//   - Google Cloud TTS voice selection (already mapped separately in tts/route.ts)
// Kept here (alongside the dictionary loaders) so one edit covers both surfaces.
export const BCP47_MAP: Record<Language, string> = {
    English: 'en-IN',
    Hindi: 'hi-IN',
    Kannada: 'kn-IN',
    Tamil: 'ta-IN',
    Telugu: 'te-IN',
    Marathi: 'mr-IN',
    Bengali: 'bn-IN',
    Gujarati: 'gu-IN',
    Punjabi: 'pa-IN',
    Malayalam: 'ml-IN',
    Odia: 'or-IN',
};

// Sync <html lang> so screen readers pronounce correctly, browsers hyphenate
// in the right script, and Chrome's auto-translate doesn't offer a pointless
// "translate to English" on a Hindi page that is already Hindi.
function syncHtmlLang(lang: Language) {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = BCP47_MAP[lang];
}

// Google Fonts families for each Indic script. English uses Inter already
// loaded in layout.tsx — no extra fetch needed. When the user picks a
// non-English language we inject the matching Noto Sans family so
// Devanagari/Tamil/etc. render with real glyph metrics instead of a jagged
// OEM fallback on low-end Androids.
const INDIC_FONT_URL: Partial<Record<Language, string>> = {
    Hindi: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap',
    Marathi: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap',
    Kannada: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Kannada:wght@400;500;600;700&display=swap',
    Tamil: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700&display=swap',
    Telugu: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;500;600;700&display=swap',
    Bengali: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap',
    Gujarati: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Gujarati:wght@400;500;600;700&display=swap',
    Punjabi: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Gurmukhi:wght@400;500;600;700&display=swap',
    Malayalam: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Malayalam:wght@400;500;600;700&display=swap',
    Odia: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Oriya:wght@400;500;600;700&display=swap',
};

// Inject the Noto Sans family for the active language if not already loaded.
// English-only sessions pay nothing. Each non-English session downloads ~30 KB
// for its script. Idempotent: re-injecting the same URL is a no-op.
function ensureIndicFontLoaded(lang: Language) {
    if (typeof document === 'undefined') return;
    const url = INDIC_FONT_URL[lang];
    if (!url) return;
    if (document.querySelector(`link[data-indic-font="${lang}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.dataset.indicFont = lang;
    document.head.appendChild(link);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>('English');
    const [authResolved, setAuthResolved] = useState(false);
    // The dictionary currently applied, and which language it belongs to.
    // English needs no dictionary: t() falls back to the key, which IS the
    // English string.
    const [dict, setDict] = useState<Dict | null>(null);
    const [dictLang, setDictLang] = useState<Language>('English');

    // Load (or reuse) the locale chunk whenever the language changes.
    useEffect(() => {
        let cancelled = false;
        const loader = LOCALE_LOADERS[language];
        if (!loader) {
            // English (or unknown): key-fallback is the correct rendering.
            setDict(null);
            setDictLang(language);
            return;
        }
        const cached = loadedDicts.get(language);
        if (cached) {
            setDict(cached);
            setDictLang(language);
            return;
        }
        loader()
            .then((mod) => {
                if (cancelled) return;
                loadedDicts.set(language, mod.default);
                setDict(mod.default);
                setDictLang(language);
            })
            .catch((err) => {
                // Chunk fetch failed (offline / flaky 3G): render English
                // rather than blocking the UI forever. The next language
                // switch or reload retries naturally.
                console.warn('[i18n] locale chunk failed to load, falling back to English', err);
                if (cancelled) return;
                setDict(null);
                setDictLang(language);
            });
        return () => { cancelled = true; };
    }, [language]);

    useEffect(() => {
        // Restore from localStorage immediately (fast, before Firebase)
        try {
            const cached = localStorage.getItem('sahayakai-lang');
            if (cached && LANGUAGES.includes(cached as Language)) {
                setLanguageState(cached as Language);
                syncHtmlLang(cached as Language);
                ensureIndicFontLoaded(cached as Language);
            }
        } catch { /* localStorage unavailable (restricted WebView) */ }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const { profile } = await getProfileData(user.uid);
                if (profile?.preferredLanguage) {
                    setLanguageState(profile.preferredLanguage as Language);
                    syncHtmlLang(profile.preferredLanguage as Language);
                    ensureIndicFontLoaded(profile.preferredLanguage as Language);
                    try { localStorage.setItem('sahayakai-lang', profile.preferredLanguage); } catch {}
                }
            }
            setAuthResolved(true);
        });
        return () => unsubscribe();
    }, []);

    const setLanguage = async (lang: Language, persist: boolean = true) => {
        setLanguageState(lang);
        syncHtmlLang(lang);
        ensureIndicFontLoaded(lang);
        try { localStorage.setItem('sahayakai-lang', lang); } catch {}
        if (!persist) return;

        const user = auth.currentUser;
        if (user) {
            await updateProfileAction(user.uid, { preferredLanguage: lang });

            // Keep VIDYA's jarvis.preferredLanguage in sync (fire-and-forget)
            user.getIdToken().then((idToken) =>
                fetch('/api/vidya/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                    body: JSON.stringify({ profile: { preferredLanguage: lang } }),
                })
            ).catch(console.warn);
        }
    };

    const t = (key: string): string => {
        if (dict && dictLang === language) {
            return dict[key] ?? key;
        }
        return key;
    };

    // isLoaded preserves its historical contract (auth resolved → safe to
    // render language-dependent UI) and now also waits for the active
    // locale's dictionary so consumers gating on it never flash English.
    const isLoaded = authResolved && dictLang === language;

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, isLoaded }}>
            {children}
        </LanguageContext.Provider>
    );
}

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
