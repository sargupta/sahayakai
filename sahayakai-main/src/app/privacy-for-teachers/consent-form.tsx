'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { getProfileData, updateProfileAction } from '@/app/actions/profile';
import { useToast } from '@/hooks/use-toast';

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
    const [checked, setChecked] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [acceptedAt, setAcceptedAt] = useState<Date | undefined>();
    const [acceptedVersion, setAcceptedVersion] = useState<string | undefined>();
    const [profileLoaded, setProfileLoaded] = useState(false);

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
            toast({
                title: 'Thank you',
                description: 'Your acceptance has been recorded.',
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
        return (
            <div className="mt-12 pt-10 border-t border-black/[0.08]">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary mb-3">
                    Your acceptance
                </div>
                <p className="font-headline text-[18px] sm:text-[20px] font-semibold text-foreground leading-tight mb-2">
                    You accepted these commitments on {formatAcceptedDate(acceptedAt)}.
                </p>
                <p className="text-[13px] text-muted-foreground leading-[1.65] max-w-[58ch]">
                    Version {acceptedVersion}. We will prompt you again if we materially change this page,
                    so you always see what you agreed to.
                </p>
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
