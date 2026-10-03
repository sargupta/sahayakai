"use client";

import { useState } from "react";
import { Loader2, ScrollText } from "lucide-react";
import { SectionCard } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { adoptRule, listRules, withdrawRule, type RuleView } from "@/lib/api/sampark";
import { ErrorPanel, LoadingBlock, errorMessage } from "./states";
import { StatusPill } from "./status-pill";
import { useSamparkQuery } from "./use-sampark-query";
import { useSamparkFormat } from "./format";
import { fmt, purposeLabel, roleLabel, ruleDescription, thresholdLabel } from "./labels";

/** One rule: what it does, its thresholds, and the written adoption (or its withdrawal). */
function RuleCard({ orgId, rule, statement, onChanged }: { orgId: string; rule: RuleView; statement: string; onChanged: () => void }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const { toast } = useToast();
    const [values, setValues] = useState<Record<string, number | boolean>>(rule.thresholds);
    const [name, setName] = useState("");
    const [agreed, setAgreed] = useState(false);
    const [busy, setBusy] = useState<null | "adopt" | "withdraw">(null);
    const keys = Object.keys(rule.defaults);

    async function adopt() {
        setBusy("adopt");
        try {
            await adoptRule(orgId, rule.ruleId, { thresholds: values, adopterName: name.trim(), acknowledged: true });
            toast({ title: t("Rule adopted. It will now propose calls for a person to approve.") });
            setName("");
            setAgreed(false);
            onChanged();
        } catch (err) {
            toast({ title: t("Could not adopt the rule"), description: errorMessage(t, err), variant: "destructive" });
        } finally {
            setBusy(null);
        }
    }

    async function withdraw() {
        setBusy("withdraw");
        try {
            await withdrawRule(orgId, rule.ruleId);
            toast({ title: t("Rule withdrawn.") });
            onChanged();
        } catch (err) {
            toast({ title: t("Could not withdraw the rule"), description: errorMessage(t, err), variant: "destructive" });
        } finally {
            setBusy(null);
        }
    }

    return (
        <li className="space-y-3 rounded-surface-md border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                    <p className="type-body font-semibold text-foreground">{purposeLabel(t, rule.ruleId)}</p>
                    <p className="type-body text-muted-foreground">{fmt(t("Who approves this: {role}"), { role: roleLabel(t, rule.approver) })}</p>
                </div>
                <StatusPill tone={rule.adopted ? "success" : "neutral"}>{rule.adopted ? t("Adopted") : t("Off")}</StatusPill>
            </div>
            <p className="type-body text-foreground">{ruleDescription(t, rule.ruleId)}</p>

            <div className="grid gap-3 sm:grid-cols-2">
                {keys.map((key) => {
                    const v = values[key];
                    const id = `${rule.ruleId}-${key}`;
                    return typeof rule.defaults[key] === "boolean" ? (
                        <div key={key} className="flex items-start gap-3">
                            <Checkbox id={id} checked={v === true} onCheckedChange={(c) => setValues((s) => ({ ...s, [key]: c === true }))} disabled={rule.adopted} />
                            <Label htmlFor={id} className="leading-normal">{thresholdLabel(t, key)}</Label>
                        </div>
                    ) : (
                        <div key={key} className="space-y-2">
                            <Label htmlFor={id}>{thresholdLabel(t, key)}</Label>
                            <Input
                                id={id}
                                inputMode="numeric"
                                value={String(v)}
                                disabled={rule.adopted}
                                onChange={(e) => setValues((s) => ({ ...s, [key]: Number(e.target.value.replace(/\D/g, "")) }))}
                            />
                        </div>
                    );
                })}
            </div>

            {rule.adopted ? (
                <div className="space-y-2">
                    <p className="type-caption text-muted-foreground">
                        {fmt(t("Adopted by {name} on {when}"), { name: rule.adopterName ?? "", when: f.dateTime(rule.adoptedAt) })}
                    </p>
                    <Button type="button" variant="outline" onClick={withdraw} disabled={busy !== null} className="min-h-11">
                        {busy === "withdraw" && <Loader2 aria-hidden="true" className="animate-spin" />}
                        {t("Withdraw this rule")}
                    </Button>
                </div>
            ) : (
                <div className="space-y-3 rounded-surface-sm bg-muted/30 p-3">
                    <p className="type-body text-foreground">{statement}</p>
                    <div className="space-y-2">
                        <Label htmlFor={`${rule.ruleId}-name`}>{t("Type your name to adopt")}</Label>
                        <Input id={`${rule.ruleId}-name`} value={name} onChange={(e) => setName(e.target.value)} className="sm:w-80" />
                    </div>
                    <div className="flex items-start gap-3">
                        <Checkbox id={`${rule.ruleId}-agree`} checked={agreed} onCheckedChange={(c) => setAgreed(c === true)} />
                        <Label htmlFor={`${rule.ruleId}-agree`} className="leading-normal">{t("I agree on behalf of the school")}</Label>
                    </div>
                    <Button type="button" onClick={adopt} disabled={busy !== null || !agreed || name.trim() === ""} className="min-h-11">
                        {busy === "adopt" && <Loader2 aria-hidden="true" className="animate-spin" />}
                        {t("Adopt this rule")}
                    </Button>
                </div>
            )}
        </li>
    );
}

/** Every rule ships OFF; the school adopts each one, with its thresholds, in writing (plan §2A). */
export function RulesSection({ orgId }: { orgId: string }) {
    const { t } = useLanguage();
    const query = useSamparkQuery((signal) => listRules(orgId, { signal }), [orgId]);
    return (
        <SectionCard
            title={t("Rules")}
            description={t("Rules are off until the school adopts them. A rule only proposes a call; a person always approves it first.")}
            icon={ScrollText}
        >
            {!query.data && query.loading && <LoadingBlock rows={3} />}
            {query.error && <ErrorPanel error={query.error} onRetry={query.reload} />}
            {query.data && (
                <ul className="space-y-4">
                    {query.data.rules.map((rule) => (
                        <RuleCard key={`${rule.ruleId}-${rule.version ?? 0}`} orgId={orgId} rule={rule} statement={query.data!.statement} onChanged={query.reload} />
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}
