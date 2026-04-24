'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { getProfileData, updateProfileAction } from '@/app/actions/profile';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';

/**
 * Version tag for the current privacy commitments copy. Bump this when the
 * page changes materially so signed-in teachers are re-prompted to re-confirm
 * the new version (even if they accepted an older one). Format: YYYY-MM-DD-vN.
 */
const PRIVACY_VERSION = '2026-04-24-v1';

function formatAcceptedDate(d: Date | undefined): string {
    if (!d) return 'earlier';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function toDate(value: unknown): Date | undefined {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    if (typeof value === 'object' && value !== null && 'toDate' in value) {
        const maybeToDate = (value as { toDate?: () => Date }).toDate;
        if (typeof maybeToDate === 'function') return maybeToDate.call(value);
    }
    if (typeof value === 'object' && value !== null && 'seconds' in value) {
        const s = (value as { seconds: number }).seconds;
        if (typeof s === 'number') return new Date(s * 1000);
    }
    return undefined;
}

export function PrivacyConsentForm() {
    const { user, openAuthModal } = useAuth();
    const { toast } = useToast();
    const { t } = useLanguage();
    const router = useRouter();
    const [checked, setChecked] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [acceptedAt, setAcceptedAt] = useState<Date | undefined>();
    const [acceptedVersion, setAcceptedVersion] = useState<string | undefined>();
    const [profileLoaded, setProfileLoaded] = useState(false);
    const [justAccepted, setJustAccepted] = useState(false);
    const [redirectSeconds, setRedirectSeconds] = useState(5);

    // Auto-redirect countdown after a fresh acceptance. Gives rural non-tech
    // teachers a clear next step without forcing them to find the tiny
    // "Back to home" link in the footer.
    useEffect(() => {
        if (!justAccepted) return;
        if (redirectSeconds <= 0) {
            router.push('/');
            return;
        }
        const tick = setTimeout(() => setRedirectSeconds((s) => s - 1), 1000);
        return () => clearTimeout(tick);
    }, [justAccepted, redirectSeconds, router]);

    useEffect(() => {
        if (!user) {
            setAcceptedAt(undefined);
            setAcceptedVersion(undefined);
            setProfileLoaded(true);
            return;
        }
        let cancelled = false;
        (async () => {
            setProfileLoaded(false);
            try {
                const { profile } = await getProfileData(user.uid);
                if (cancelled) return;
                const p = profile as { privacyAcceptedAt?: unknown; privacyVersion?: string } | null;
                setAcceptedAt(toDate(p?.privacyAcceptedAt));
                setAcceptedVersion(p?.privacyVersion);
            } catch {
                // Fail open: show the accept form even if we cannot load profile.
            } finally {
                if (!cancelled) setProfileLoaded(true);
            }
        })();
        return () => { cancelled = true; };
    }, [user]);

    async function handleAccept() {
        if (!user || !checked) return;
        setSubmitting(true);
        try {
            const now = new Date();
            await updateProfileAction(user.uid, {
                privacyAcceptedAt: now,
                privacyVersion: PRIVACY_VERSION,
            });
            setAcceptedAt(now);
            setAcceptedVersion(PRIVACY_VERSION);
            setChecked(false);
            setJustAccepted(true);
            toast({
                title: t('Thank you!'),
                description: t('Taking you to your dashboard…'),
            });
        } catch {
            toast({
                title: 'Could not save',
                description: 'Something went wrong recording your acceptance. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    }

    // Render signed-out state immediately; don't gate on auth-context loading
    // (the auth observer may take time to resolve). If a user is authenticated
    // the useEffect above will transition us to the signed-in form.
    if (user && !profileLoaded) {
        return (
            <div className="mt-12 pt-10 border-t border-black/[0.08]">
                <div className="h-24 animate-pulse bg-muted/40 rounded-xl" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="mt-12 pt-10 border-t border-black/[0.08]">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary mb-3">
                    Record your acceptance
                </div>
                <h3 className="font-headline text-[22px] sm:text-[26px] font-bold tracking-tight text-foreground mb-3">
                    Sign in to acknowledge these commitments.
                </h3>
                <p className="text-[14px] sm:text-[15px] text-muted-foreground leading-[1.65] max-w-[58ch] mb-6">
                    We record your acceptance against your account so we can show you the exact version of
                    this page you agreed to, and re-prompt you if we change anything material.
                </p>
                <Button
                    onClick={() => openAuthModal()}
                    size="lg"
                    className="rounded-full px-6 font-medium"
                >
                    Sign in to continue
                </Button>
            </div>
        );
    }

    const alreadyAccepted = !!acceptedAt;
    const acceptedCurrentVersion = alreadyAccepted && acceptedVersion === PRIVACY_VERSION;

    if (acceptedCurrentVersion) {
        // Warm confirmation + prominent next-step CTA + auto-redirect countdown.
        // For a rural non-tech teacher, landing on a static "YOUR ACCEPTANCE"
        // legal block after clicking Accept is confusing — they expect to move
        // forward. We show a big green check, a friendly thank-you headline,
        // the primary "Go to my dashboard" button, and auto-redirect in 5s as
        // fallback. The legal version stamp stays as a small muted line.
        return (
            <div className="mt-12 pt-10 border-t border-black/[0.08]">
                <div className="rounded-[16px] bg-saffron-50 border border-saffron-200 px-6 py-8 sm:p-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <div className="flex items-start gap-4 mb-5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-saffron text-white">
                            <CheckCircle2 className="h-6 w-6" strokeWidth={2.2} />
                        </div>
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-saffron-700 mb-1">
                                {t('All set')}
                            </div>
                            <h3 className="font-headline text-[22px] sm:text-[26px] font-bold tracking-tight text-foreground leading-tight">
                                {justAccepted
                                    ? t('Thank you! Your privacy choices are saved.')
                                    : t('You agreed to these privacy terms.')}
                            </h3>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                        <Button
                            onClick={() => router.push('/')}
                            size="lg"
                            className="rounded-full px-6 font-medium bg-saffron text-white hover:bg-saffron-600 shadow-[0_14px_28px_-12px_hsl(28_70%_45%/0.45)]"
                        >
                            {t('Go to my dashboard')}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                        {justAccepted && redirectSeconds > 0 && (
                            <span className="text-[13px] text-neutral-600">
                                {t('Taking you there in')} {redirectSeconds}…
                            </span>
                        )}
                    </div>

                    <p className="mt-6 text-[12px] text-neutral-500 leading-[1.55] max-w-[58ch]">
                        {t('Saved on')} {formatAcceptedDate(acceptedAt)}.
                        {' '}
                        {t('We will ask you again only if we change anything important.')}
                        {' '}
                        <span className="opacity-70">(v{acceptedVersion})</span>
                    </p>
                </div>
            </div>
        );
    }

    // Signed-in, not yet accepted (or accepted an older version)
    return (
        <div className="mt-12 pt-10 border-t border-black/[0.08]">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary mb-3">
                {alreadyAccepted ? 'Re-confirm these commitments' : 'Record your acceptance'}
            </div>
            <h3 className="font-headline text-[22px] sm:text-[26px] font-bold tracking-tight text-foreground mb-3">
                {alreadyAccepted
                    ? 'We updated these commitments. Please re-confirm.'
                    : 'Accept these commitments to continue.'}
            </h3>
            <p className="text-[14px] sm:text-[15px] text-muted-foreground leading-[1.65] max-w-[58ch] mb-6">
                {alreadyAccepted
                    ? `You accepted version ${acceptedVersion} on ${formatAcceptedDate(acceptedAt)}. This is version ${PRIVACY_VERSION}.`
                    : 'We will record the date and version you accept against your account. You can revisit this page anytime, and we will re-prompt you if we materially change anything.'}
            </p>
            <div className="flex items-start gap-3 mb-6">
                <Checkbox
                    id="privacy-agree"
                    checked={checked}
                    onCheckedChange={value => setChecked(value === true)}
                    className="mt-1"
                />
                <Label htmlFor="privacy-agree" className="text-[14px] sm:text-[15px] text-foreground leading-[1.55] cursor-pointer max-w-[56ch]">
                    I have read and agree to SahayakAI&rsquo;s privacy commitments above, including that
                    my data will not be shared with inspectors, principals, or government officials
                    without my explicit consent.
                </Label>
            </div>
            <Button
                onClick={handleAccept}
                disabled={!checked || submitting}
                size="lg"
                className="rounded-full px-6 font-medium"
            >
                {submitting ? 'Saving…' : alreadyAccepted ? 'Re-confirm' : 'I accept'}
            </Button>
        </div>
    );
}
