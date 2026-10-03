"use client";

import { useState } from "react";
import { Check, Loader2, PhoneForwarded, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { approveProposalRequest, dismissProposalRequest, handleProposalRequest, type ProposalViewDto } from "@/lib/api/sampark";
import { PARENT_LANGUAGE_INFO } from "@/lib/sampark/languages";
import type { ParentLanguage } from "@/types/sampark";
import { LanguageSwitcher } from "./language-switcher";
import { StatusPill } from "./status-pill";
import { errorMessage } from "./states";
import { useSamparkFormat } from "./format";
import { fmt, proposalStatusLabel, proposalStatusTone, purposeLabel, roleLabel } from "./labels";

/**
 * One proposed call for an approver (plan §8 "My approvals"): who it is about, WHY (the evidence, in staff's own
 * words, for the approver only), what the parent will hear in each language, and three honest choices.
 */
export function ProposalCard({ orgId, view, onChanged }: { orgId: string; view: ProposalViewDto; onChanged: () => void }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const { toast } = useToast();
    const [language, setLanguage] = useState<ParentLanguage>("English");
    const [busy, setBusy] = useState<null | "approve" | "handle" | "dismiss">(null);
    const p = view.proposal;
    const pending = p.status === "pending";
    const preview = view.previews.find((x) => x.language === language) ?? view.previews[0];
    const info = PARENT_LANGUAGE_INFO[language];

    async function act(kind: "approve" | "handle" | "dismiss") {
        setBusy(kind);
        try {
            if (kind === "approve") {
                const out = await approveProposalRequest(orgId, p.id);
                if (out.needsAttention) toast({ title: t("No parent can be called automatically"), description: out.needsAttention, variant: "destructive" });
                else toast({ title: t("Approved. The call will be placed inside the calling window.") });
            } else if (kind === "handle") {
                await handleProposalRequest(orgId, p.id);
                toast({ title: t("Noted. The school will not call this family.") });
            } else {
                await dismissProposalRequest(orgId, p.id);
                toast({ title: t("Dismissed. It will not come back.") });
            }
            onChanged();
        } catch (err) {
            toast({ title: t("Could not save your decision"), description: errorMessage(t, err), variant: "destructive" });
        } finally {
            setBusy(null);
        }
    }

    return (
        <li className="space-y-4 rounded-surface-md border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                    <p className="type-body font-semibold text-foreground break-words">{view.studentName} · {view.section}</p>
                    <p className="type-body text-muted-foreground">{purposeLabel(t, p.purpose)}</p>
                </div>
                <StatusPill tone={proposalStatusTone(p.status)}>{proposalStatusLabel(t, p.status)}</StatusPill>
            </div>

            <p className="type-body text-foreground">{p.summary}</p>

            {p.alreadyKnown && (
                <p className="type-body text-muted-foreground">{t("A meeting request is already open for this child, so a teacher may already know.")}</p>
            )}
            {p.routingNote && <p className="type-body text-muted-foreground">{p.routingNote}</p>}

            <section aria-label={t("Why this was proposed")} className="space-y-2 rounded-surface-sm bg-muted/30 p-3">
                <p className="type-caption text-muted-foreground">{t("Why (for you only, never said to the parent)")}</p>
                <ul className="space-y-1">
                    {p.evidence.map((e, i) => (
                        <li key={i} className="type-body text-foreground break-words">
                            {e.date && <span className="text-muted-foreground">{f.day(e.date)} · </span>}
                            {e.text}
                        </li>
                    ))}
                </ul>
            </section>

            <section aria-label={t("What the parent will hear")} className="space-y-2">
                <p className="type-caption text-muted-foreground">{t("What the parent will hear")}</p>
                <LanguageSwitcher value={language} onChange={setLanguage} />
                {preview?.clips ? (
                    <ol className="space-y-2" lang={info.code}>
                        {preview.clips.map((c, i) => (
                            <li key={i} className="space-y-1">
                                <span className="block type-caption text-muted-foreground" lang="en">
                                    {c.kind === "listener_check" ? t("First: checks it is the child's parent") : t("Only after the parent presses 1")}
                                </span>
                                <span className="block type-body text-foreground break-words">{c.text}</span>
                            </li>
                        ))}
                    </ol>
                ) : (
                    <p className="type-body text-destructive">{preview?.problem ?? t("No preview available")}</p>
                )}
            </section>

            {pending ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" onClick={() => act("approve")} disabled={busy !== null} className="min-h-11">
                        {busy === "approve" ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Check aria-hidden="true" />}
                        {t("Approve")}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => act("handle")} disabled={busy !== null} className="min-h-11">
                        {busy === "handle" ? <Loader2 aria-hidden="true" className="animate-spin" /> : <PhoneForwarded aria-hidden="true" />}
                        {t("I'll call myself")}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => act("dismiss")} disabled={busy !== null} className="min-h-11">
                        {busy === "dismiss" ? <Loader2 aria-hidden="true" className="animate-spin" /> : <X aria-hidden="true" />}
                        {t("Not now")}
                    </Button>
                </div>
            ) : (
                p.decisionNote && <p className="type-body text-muted-foreground break-words">{p.decisionNote}</p>
            )}

            <p className="type-caption text-muted-foreground">
                {fmt(t("Who approves this: {role}"), { role: roleLabel(t, p.approverRole) })}
            </p>
        </li>
    );
}
