'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Link2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/context/language-context';
import {
    createJoinLink,
    listJoinLinks,
    MAX_JOIN_LINK_DAYS,
    revokeJoinLink,
    type CreatedJoinLink,
    type JoinLink,
} from '@/lib/api/access';

/**
 * "Invite teachers" for the school admin: create a join link (seat-capped,
 * expiring), copy it once, and revoke existing links.
 * API: /api/organizations/{orgId}/join-links (docs/ACCESS_GATE_DESIGN.md).
 * The link's code is returned only at creation; the server stores its hash.
 */
export function InviteTeachers({ orgId }: { orgId: string }) {
    const { t } = useLanguage();
    const [links, setLinks] = useState<JoinLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [maxUses, setMaxUses] = useState('10');
    const [days, setDays] = useState('14');
    const [creating, setCreating] = useState(false);
    const [created, setCreated] = useState<CreatedJoinLink | null>(null);
    const [copied, setCopied] = useState(false);
    /** The server lowered the requested number to the free seats. */
    const [reduced, setReduced] = useState(false);
    const [revoking, setRevoking] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await listJoinLinks(orgId);
            setLinks(res.links);
            setError(null);
        } catch {
            setError(t('Could not load invitation links.'));
        } finally {
            setLoading(false);
        }
    }, [orgId, t]);

    useEffect(() => { void load(); }, [load]);

    async function onCreate(e: React.FormEvent) {
        e.preventDefault();
        const uses = Number(maxUses);
        const expiresInDays = Number(days);
        if (!Number.isInteger(uses) || uses < 1 || !Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > MAX_JOIN_LINK_DAYS) {
            setError(t('Enter a number of teachers, and a validity between 1 and 60 days.'));
            return;
        }
        setCreating(true);
        setError(null);
        setCopied(false);
        try {
            const link = await createJoinLink(orgId, { maxUses: uses, expiresInDays });
            setCreated(link);
            setReduced(link.maxUses < uses);
            await load();
        } catch {
            setError(t('Could not create the invitation link. Check that seats are available.'));
        } finally {
            setCreating(false);
        }
    }

    async function onCopy() {
        if (!created) return;
        try {
            await navigator.clipboard.writeText(created.url);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    }

    async function onRevoke(id: string) {
        if (!window.confirm(t('Revoke this invitation link? Teachers who have already joined keep their access.'))) return;
        setRevoking(id);
        try {
            await revokeJoinLink(orgId, id);
            await load();
        } catch {
            setError(t('Could not revoke the invitation link.'));
        } finally {
            setRevoking(null);
        }
    }

    const fmt = (iso: string) => {
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    };

    return (
        <section aria-labelledby="invite-teachers-heading" className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-primary" aria-hidden />
                    <h2 id="invite-teachers-heading" className="font-headline text-lg font-semibold text-foreground">
                        {t('Invite teachers')}
                    </h2>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                    {t('Create a link and share it with your teachers. Each teacher who joins uses one seat. Do not share the link outside your school.')}
                </p>

                <form onSubmit={onCreate} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
                    <div className="space-y-2">
                        <Label htmlFor="invite-uses">{t('Number of teachers')}</Label>
                        <Input id="invite-uses" type="number" inputMode="numeric" min={1} className="sm:w-36"
                            value={maxUses} onChange={(e) => setMaxUses(e.target.value)} disabled={creating} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="invite-days">{t('Valid for (days)')}</Label>
                        <Input id="invite-days" type="number" inputMode="numeric" min={1} max={MAX_JOIN_LINK_DAYS} className="sm:w-36"
                            value={days} onChange={(e) => setDays(e.target.value)} disabled={creating} />
                    </div>
                    <Button type="submit" disabled={creating}>
                        {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                        {t('Create invitation link')}
                    </Button>
                </form>

                <p className="mt-2 text-xs text-muted-foreground">
                    {t('A link cannot admit more teachers than your free seats. A higher number is reduced to the seats available.')}
                </p>

                {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}

                {created ? (
                    <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-4" role="status">
                        <p className="text-sm font-medium text-foreground">
                            {t('Copy this link now. It will not be shown again.')}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {(reduced
                                ? t('This link admits {max} teachers, the number of free seats.')
                                : t('This link admits {max} teachers.')
                            ).replace('{max}', String(created.maxUses))}
                        </p>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                            <Input readOnly value={created.url} aria-label={t('Invitation link')} onFocus={(e) => e.currentTarget.select()} />
                            <Button type="button" variant="outline" onClick={() => { void onCopy(); }}>
                                {copied ? <Check className="mr-2 h-4 w-4" aria-hidden /> : <Copy className="mr-2 h-4 w-4" aria-hidden />}
                                {copied ? t('Copied') : t('Copy')}
                            </Button>
                        </div>
                    </div>
                ) : null}

                <div className="mt-6">
                    <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{t('Existing links')}</h3>
                    {loading ? (
                        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground" role="status">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            {t('Loading...')}
                        </p>
                    ) : links.length === 0 ? (
                        <p className="mt-2 text-sm text-muted-foreground">{t('No invitation links yet.')}</p>
                    ) : (
                        <ul className="mt-2 divide-y divide-border">
                            {links.map((link) => {
                                const expired = new Date(link.expiresAt).getTime() <= Date.now();
                                const status = link.revoked ? t('Revoked') : expired ? t('Expired') : t('Active');
                                return (
                                    <li key={link.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                                        <div className="text-muted-foreground">
                                            <span className="font-medium text-foreground">{status}</span>
                                            {' · '}
                                            {t('{used} of {max} used').replace('{used}', String(link.uses)).replace('{max}', String(link.maxUses))}
                                            {' · '}
                                            {t('Expires {date}').replace('{date}', fmt(link.expiresAt))}
                                        </div>
                                        {!link.revoked && !expired ? (
                                            <Button type="button" variant="outline" size="sm" disabled={revoking === link.id}
                                                onClick={() => { void onRevoke(link.id); }}>
                                                {revoking === link.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                                                {t('Revoke')}
                                            </Button>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </section>
    );
}
