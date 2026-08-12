'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { Loader2, PhoneCall, PhoneIncoming, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LANGUAGES, type Language } from '@/types';
import { useLanguage } from '@/context/language-context';

/**
 * "Hear the Call" demo form. POSTs to the public /api/demo-call endpoint,
 * then polls /api/demo-call/[id] until the call reaches a terminal state.
 *
 * Turnstile is optional: the widget renders only when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is provisioned (server side enforces the
 * matching secret; without keys the other server gates still apply).
 */

type Phase = 'idle' | 'submitting' | 'calling' | 'done' | 'error';

const TERMINAL_OK = new Set(['completed']);
const TERMINAL_FAIL = new Set(['busy', 'failed', 'no-answer', 'canceled']);
const POLL_MS = 2500;
const POLL_TIMEOUT_MS = 120_000;

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

declare global {
    interface Window {
        turnstile?: {
            render: (el: HTMLElement, opts: {
                sitekey: string;
                callback: (token: string) => void;
                'expired-callback'?: () => void;
            }) => string;
        };
    }
}

export function TryCallForm() {
    const { t } = useLanguage();
    const [phone, setPhone] = useState('');
    const [language, setLanguage] = useState<Language>('Hindi');
    const [consent, setConsent] = useState(false);
    const [phase, setPhase] = useState<Phase>('idle');
    const [message, setMessage] = useState<string | null>(null);
    const turnstileToken = useRef<string | null>(null);
    const turnstileEl = useRef<HTMLDivElement | null>(null);
    const pollAbort = useRef<boolean>(false);

    useEffect(() => () => { pollAbort.current = true; }, []);

    const renderTurnstile = useCallback(() => {
        if (TURNSTILE_SITE_KEY && window.turnstile && turnstileEl.current && turnstileEl.current.childElementCount === 0) {
            window.turnstile.render(turnstileEl.current, {
                sitekey: TURNSTILE_SITE_KEY,
                callback: (token) => { turnstileToken.current = token; },
                'expired-callback': () => { turnstileToken.current = null; },
            });
        }
    }, []);

    async function poll(id: string) {
        const startedAt = Date.now();
        while (!pollAbort.current && Date.now() - startedAt < POLL_TIMEOUT_MS) {
            await new Promise((r) => setTimeout(r, POLL_MS));
            try {
                const res = await fetch(`/api/demo-call/${id}`);
                if (!res.ok) continue;
                const data = (await res.json()) as { status?: string };
                const status = data.status ?? '';
                if (TERMINAL_OK.has(status)) { setPhase('done'); return; }
                if (TERMINAL_FAIL.has(status)) {
                    setPhase('error');
                    setMessage(
                        status === 'no-answer' || status === 'busy'
                            ? t('We could not reach your phone. Please check the number and try again tomorrow.')
                            : t('The call could not be completed. Please try again later.'),
                    );
                    return;
                }
            } catch {
                // transient network error while polling — keep trying until timeout
            }
        }
        if (!pollAbort.current) {
            // Ringing often outlives the poll window on slow networks; treat as soft success.
            setPhase('done');
        }
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMessage(null);
        setPhase('submitting');
        try {
            const res = await fetch('/api/demo-call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: phone.trim(),
                    language,
                    consent,
                    turnstileToken: turnstileToken.current ?? undefined,
                }),
            });
            const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
            if (!res.ok || !data.id) {
                setPhase('error');
                setMessage(data.error ?? t('Something went wrong. Please try again.'));
                return;
            }
            setPhase('calling');
            void poll(data.id);
        } catch {
            setPhase('error');
            setMessage(t('Network problem. Please check your connection and try again.'));
        }
    }

    if (phase === 'done') {
        return (
            <section className="space-y-4 rounded-xl border bg-card p-6 text-center shadow-sm">
                <CheckCircle2 className="mx-auto h-10 w-10 text-primary" aria-hidden />
                <h2 className="text-xl font-semibold">{t('What just happened')}</h2>
                <p className="text-sm text-muted-foreground">
                    {t('That voice you heard was SahayakAI making a parent call. The same call can go to every parent in your register: absence alerts, meeting invitations, exam reminders, even a praise call for a child who did something good this week.')}
                </p>
                <p className="text-sm text-muted-foreground">
                    {t("You choose the message once. SahayakAI makes every call, in each parent's own language, and tells you who picked up.")}
                </p>
                <Button asChild size="lg" className="w-full sm:w-auto">
                    <Link href="/signup?ref=try-call">{t('Send your first 10 parent calls free')}</Link>
                </Button>
                <p className="text-xs text-muted-foreground">
                    {t('Works with your existing class register. Setup takes less time than one parent call used to.')}
                </p>
            </section>
        );
    }

    return (
        <section className="rounded-xl border bg-card p-6 shadow-sm">
            {TURNSTILE_SITE_KEY ? (
                <Script
                    src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                    onLoad={renderTurnstile}
                />
            ) : null}
            <form onSubmit={onSubmit} className="space-y-4" aria-busy={phase === 'submitting'}>
                <div className="space-y-2">
                    <Label htmlFor="demo-phone">{t('Your mobile number')}</Label>
                    <Input
                        id="demo-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        placeholder={t('98XXXXXXXX')}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        disabled={phase !== 'idle' && phase !== 'error'}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="demo-language">{t('Language for the call')}</Label>
                    <select
                        id="demo-language"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as Language)}
                        disabled={phase !== 'idle' && phase !== 'error'}
                    >
                        {LANGUAGES.map((l) => (
                            <option key={l} value={l}>{l}</option>
                        ))}
                    </select>
                </div>
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                    <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        required
                    />
                    <span>
                        {t('I am requesting a one-time demo call to my own number. SahayakAI will call this number once and send one WhatsApp follow-up. No spam, ever.')}
                    </span>
                </label>
                {TURNSTILE_SITE_KEY ? <div ref={turnstileEl} /> : null}

                {phase === 'calling' ? (
                    <div className="flex items-center justify-center gap-2 rounded-md bg-muted p-4 text-sm font-medium">
                        <PhoneIncoming className="h-5 w-5 animate-pulse text-primary" aria-hidden />
                        {t('Your phone will ring in a few seconds. Pick up and listen.')}
                    </div>
                ) : (
                    <Button
                        type="submit"
                        size="lg"
                        className="w-full"
                        disabled={phase === 'submitting' || !consent}
                    >
                        {phase === 'submitting' ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                                {t('Placing your call…')}
                            </>
                        ) : (
                            <>
                                <PhoneCall className="mr-2 h-4 w-4" aria-hidden />
                                {t('Call me in 30 seconds')}
                            </>
                        )}
                    </Button>
                )}

                {message ? (
                    <p className="flex items-start gap-2 text-sm text-destructive" role="alert">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        {message}
                    </p>
                ) : null}

                <p className="text-center text-xs text-muted-foreground">
                    {t('Free. No signup needed to hear the call.')}
                </p>
            </form>
        </section>
    );
}
