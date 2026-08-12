'use client';

import { PhoneCall, Languages, Smartphone } from 'lucide-react';
import { useLanguage } from '@/context/language-context';

/**
 * Client hero + feature cards for the public "Hear the Call" page.
 * Split out of page.tsx (a server component, which can't use the
 * client-side language context) so the copy localises into all 11 languages.
 */
export function TryCallHero() {
    const { t } = useLanguage();
    return (
        <section className="space-y-6 text-center">
            <p className="text-sm font-medium text-muted-foreground">
                {t('When did a parent last read the note you sent in the school diary?')}
                <br className="hidden sm:block" />
                {' '}{t('And how many chairs were filled at your last parent meeting?')}
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {t('Every parent picks up a phone call.')}
                <span className="block text-primary">{t('Hear it on your own phone in 30 seconds.')}</span>
            </h1>
            <p className="text-base text-muted-foreground">
                {t('SahayakAI calls parents for you, in their language, with the message you choose. Try it on yourself right now.')}
            </p>
        </section>
    );
}

export function TryCallFeatures() {
    const { t } = useLanguage();
    return (
        <section className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center">
                <Languages className="h-6 w-6 text-primary" aria-hidden />
                <p className="text-sm text-muted-foreground">
                    {t('Speaks 11 Indian languages, from Bengali to Tamil to Malayalam')}
                </p>
            </div>
            <div className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center">
                <Smartphone className="h-6 w-6 text-primary" aria-hidden />
                <p className="text-sm text-muted-foreground">
                    {t('Parents need no app, no smartphone, no reading. A ringing phone is enough')}
                </p>
            </div>
            <div className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center">
                <PhoneCall className="h-6 w-6 text-primary" aria-hidden />
                <p className="text-sm text-muted-foreground">
                    {t('One tap sends the call to every parent in your class')}
                </p>
            </div>
        </section>
    );
}
