"use client";

import { useState } from "react";
import { BellRing, CheckCheck, ClipboardList } from "lucide-react";
import { EmptyState, SectionCard } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import {
    acknowledgePageRequest,
    confirmClassAbsencesRequest,
    listPageTasks,
    listProposalViews,
    type ProposalStatusDto,
} from "@/lib/api/sampark";
import { ProposalCard } from "@/components/sampark/proposal-card";
import { ErrorPanel, LoadingBlock, errorMessage } from "@/components/sampark/states";
import { useSamparkQuery } from "@/components/sampark/use-sampark-query";
import { useSamparkSchool } from "@/components/sampark/school-context";
import { useSamparkFormat } from "@/components/sampark/format";
import { pageReasonLabel } from "@/components/sampark/labels";


function ConfirmAbsences({ orgId, onDone }: { orgId: string; onDone: () => void }) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const [grade, setGrade] = useState("");
    const [section, setSection] = useState("");
    const [busy, setBusy] = useState(false);
    const valid = /^([1-9]|1[0-2])$/.test(grade) && /^[A-Za-z]$/.test(section);

    async function confirm() {
        setBusy(true);
        try {
            const out = await confirmClassAbsencesRequest(orgId, { grade: Number(grade), section: section.toUpperCase() });
            toast({ title: out.confirmed ? t("Confirmed. Families of absent children will be called today.") : t("Already confirmed for this class today.") });
            onDone();
        } catch (err) {
            toast({ title: t("Could not confirm"), description: errorMessage(t, err), variant: "destructive" });
        } finally {
            setBusy(false);
        }
    }

    return (
        <SectionCard
            title={t("Same-day absences")}
            description={t("Once a day, confirm for your class that no message about today's absences came through the diary or the class group. Only then are families of absent children called.")}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="space-y-2">
                    <Label htmlFor="abs-grade">{t("Class")}</Label>
                    <Input id="abs-grade" inputMode="numeric" value={grade} onChange={(e) => setGrade(e.target.value.trim())} className="sm:w-24" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="abs-section">{t("Section")}</Label>
                    <Input id="abs-section" maxLength={1} value={section} onChange={(e) => setSection(e.target.value.trim())} className="sm:w-24" />
                </div>
                <Button type="button" onClick={confirm} disabled={!valid || busy} className="min-h-11">
                    <CheckCheck aria-hidden="true" />
                    {t("No message came through")}
                </Button>
            </div>
        </SectionCard>
    );
}

function Pages({ orgId }: { orgId: string }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const { toast } = useToast();
    const query = useSamparkQuery((signal) => listPageTasks(orgId, { signal }), [orgId], { pollMs: 60_000 });
    const pages = query.data ?? [];
    if (!query.data || pages.length === 0) return null;

    async function ack(id: string) {
        try {
            await acknowledgePageRequest(orgId, id);
            query.reload();
        } catch (err) {
            toast({ title: t("Could not save"), description: errorMessage(t, err), variant: "destructive" });
        }
    }

    return (
        <SectionCard title={t("Pages")} description={t("A child may be missing. Phone the family now.")} icon={BellRing}>
            <ul className="space-y-3">
                {pages.map((p) => (
                    <li key={p.id} className="flex flex-col gap-3 rounded-surface-md border border-destructive/40 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-1">
                            <p className="type-body font-semibold text-foreground">{pageReasonLabel(t, p.reason)}</p>
                            <p className="type-body text-muted-foreground">{f.dateTime(p.createdAt)}</p>
                        </div>
                        <Button type="button" variant="outline" onClick={() => ack(p.id)} className="min-h-11">{t("I have phoned the family")}</Button>
                    </li>
                ))}
            </ul>
        </SectionCard>
    );
}

export default function SamparkApprovalsPage() {
    const { t } = useLanguage();
    const { orgId } = useSamparkSchool();
    const [status, setStatus] = useState<ProposalStatusDto>("pending");
    const query = useSamparkQuery((signal) => listProposalViews(orgId, status, { signal }), [orgId, status], { pollMs: 60_000 });

    const options: { value: ProposalStatusDto; label: string }[] = [
        { value: "pending", label: t("Waiting for you") },
        { value: "needs_attention", label: t("Needs a person") },
        { value: "approved", label: t("Approved") },
        { value: "handled_by_person", label: t("A person is calling") },
        { value: "dismissed", label: t("Not now") },
    ];

    return (
        <div className="space-y-6">
            <Pages orgId={orgId} />

            <SectionCard
                title={t("Approvals")}
                description={t("Calls the school's rules propose, for a person to approve. Nothing is called until someone approves.")}
                icon={ClipboardList}
            >
                <div className="space-y-2">
                    <Label htmlFor="proposal-status">{t("Show")}</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as ProposalStatusDto)}>
                        <SelectTrigger id="proposal-status" className="md:w-72">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {options.map((o) => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {!query.data && query.loading && <LoadingBlock rows={3} />}
                {query.error && <ErrorPanel error={query.error} onRetry={query.reload} />}
                {query.data && query.data.length === 0 && (
                    <EmptyState
                        icon={ClipboardList}
                        title={t("Nothing to approve")}
                        description={t("When a rule the school has adopted finds a child to call about, it appears here with the reason.")}
                    />
                )}
                {query.data && query.data.length > 0 && (
                    <ul className="space-y-4">
                        {query.data.map((view) => (
                            <ProposalCard key={view.proposal.id} orgId={orgId} view={view} onChanged={query.reload} />
                        ))}
                    </ul>
                )}
            </SectionCard>

            <ConfirmAbsences orgId={orgId} onDone={query.reload} />
        </div>
    );
}
