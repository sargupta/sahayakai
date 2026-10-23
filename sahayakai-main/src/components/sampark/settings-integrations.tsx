"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, Loader2, Plus } from "lucide-react";
import { SectionCard } from "@/components/layout";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api/sampark";
import type { IntegrationApiKey, IntegrationScope } from "@/types/sampark";
import { useSamparkSchool } from "./school-context";
import { useSamparkQuery } from "./use-sampark-query";
import { useSamparkFormat } from "./format";
import { StatusPill } from "./status-pill";
import { ErrorPanel, InlineSpinner, errorMessage } from "./states";
import { fmt } from "./labels";

/** Matches the server's CreateApiKeySchema. `calling` is not offered (integration brief, decision 1). */
const SCOPES: IntegrationScope[] = ["lesson-planner", "exam-paper", "quiz"];
const MAX_LABEL = 80;

type Translate = (key: string) => string;

function scopeLabel(t: Translate, scope: string): string {
    switch (scope) {
        case "lesson-planner":
            return t("Lesson Planner");
        case "exam-paper":
            return t("Exam Paper");
        case "quiz":
            return t("Quiz");
        default:
            return scope;
    }
}

/** Shows a freshly created key once. The key lives only in this dialog's state and is dropped on close. */
function NewKeyDialog({ apiKey, label, onClose }: { apiKey: string; label: string; onClose: () => void }) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(apiKey);
            setCopied(true);
        } catch {
            toast({ title: t("Could not copy. Select the key and copy it yourself."), variant: "destructive" });
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{fmt(t("Key created: {label}"), { label })}</DialogTitle>
                    <DialogDescription>{t("You will not see this key again.")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <p className="type-body text-muted-foreground">
                        {t("Copy it now and store it in the system that will use it. If it is lost, revoke it and create a new one.")}
                    </p>
                    <Input readOnly value={apiKey} aria-label={t("API key")} className="font-mono" onFocus={(e) => e.currentTarget.select()} />
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={copy}>
                        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                        {copied ? t("Copied") : t("Copy key")}
                    </Button>
                    <Button type="button" onClick={onClose}>{t("Done")}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function KeyRow({ k, onRevoke }: { k: IntegrationApiKey; onRevoke: (k: IntegrationApiKey) => void }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const { user } = useAuth();
    const creator = k.createdBy && user?.uid === k.createdBy ? t("You") : t("A school administrator");
    return (
        <li className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="type-body font-semibold text-foreground break-words">{k.label}</span>
                    <StatusPill tone={k.status === "active" ? "success" : "neutral"}>
                        {k.status === "active" ? t("Active") : t("Revoked")}
                    </StatusPill>
                </div>
                <p className="font-mono text-xs text-muted-foreground break-all">{k.displayKey}</p>
                <p className="type-body text-muted-foreground">
                    {k.scopes.map((s) => scopeLabel(t, s)).join(", ")}
                </p>
                <p className="type-body text-muted-foreground">
                    {fmt(t("Created by {who} on {when}"), { who: creator, when: k.createdAt ? f.dateTime(k.createdAt) : "—" })}
                    {" · "}
                    {k.lastUsedAt ? fmt(t("Last used {when}"), { when: f.relative(k.lastUsedAt) }) : t("Never used")}
                    {k.revokedAt && <> · {fmt(t("Revoked on {when}"), { when: f.dateTime(k.revokedAt) })}</>}
                </p>
            </div>
            {k.status === "active" && (
                <Button type="button" variant="outline" className="shrink-0" onClick={() => onRevoke(k)}>
                    {t("Revoke")}
                </Button>
            )}
        </li>
    );
}

/**
 * Settings → Integrations: a school admin creates, lists and revokes the API keys the
 * school's own systems use to reach SahayakAI's MCP servers (brief Step 1A).
 */
export function IntegrationsSection() {
    const { t } = useLanguage();
    const { toast } = useToast();
    const { orgId } = useSamparkSchool();
    const keys = useSamparkQuery((signal) => listApiKeys(orgId, { signal }), [orgId]);

    const [label, setLabel] = useState("");
    const [scopes, setScopes] = useState<IntegrationScope[]>([]);
    const [creating, setCreating] = useState(false);
    const [created, setCreated] = useState<{ apiKey: string; label: string } | null>(null);
    const [revoking, setRevoking] = useState<IntegrationApiKey | null>(null);
    const [revokeBusy, setRevokeBusy] = useState(false);

    const toggleScope = (scope: IntegrationScope, on: boolean) =>
        setScopes((prev) => (on ? [...new Set([...prev, scope])] : prev.filter((s) => s !== scope)));
    const valid = label.trim().length > 0 && label.trim().length <= MAX_LABEL && scopes.length > 0;

    const create = async () => {
        setCreating(true);
        try {
            const res = await createApiKey(orgId, { label: label.trim(), scopes });
            setCreated({ apiKey: res.apiKey, label: res.key.label });
            setLabel("");
            setScopes([]);
            keys.reload();
        } catch (err) {
            toast({ title: t("Could not create the key"), description: errorMessage(t, err), variant: "destructive" });
        } finally {
            setCreating(false);
        }
    };

    const confirmRevoke = async () => {
        if (!revoking) return;
        setRevokeBusy(true);
        try {
            await revokeApiKey(orgId, revoking.keyId);
            toast({ title: fmt(t("Key revoked: {label}"), { label: revoking.label }) });
            setRevoking(null);
            keys.reload();
        } catch (err) {
            toast({ title: t("Could not revoke the key"), description: errorMessage(t, err), variant: "destructive" });
        } finally {
            setRevokeBusy(false);
        }
    };

    return (
        <SectionCard
            title={t("Integrations")}
            icon={KeyRound}
            description={t("API keys let your school's own systems use SahayakAI's lesson planner, exam paper and quiz tools. Any school administrator can create or revoke them.")}
        >
            <div className="space-y-6">
                <div className="space-y-3">
                    <h3 className="type-body font-semibold text-foreground">{t("Create a key")}</h3>
                    <div className="space-y-2">
                        <Label htmlFor="api-key-label">{t("Name of the key")}</Label>
                        <Input
                            id="api-key-label"
                            autoComplete="off"
                            maxLength={MAX_LABEL}
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder={t("For example, School LMS")}
                        />
                    </div>
                    <fieldset className="space-y-2">
                        <legend className="text-sm font-medium leading-none">{t("What the key may use")}</legend>
                        <div className="flex flex-wrap gap-4 pt-1">
                            {SCOPES.map((scope) => (
                                <div key={scope} className="flex items-center gap-2">
                                    <Checkbox
                                        id={`api-key-scope-${scope}`}
                                        checked={scopes.includes(scope)}
                                        onCheckedChange={(v) => toggleScope(scope, v === true)}
                                    />
                                    <Label htmlFor={`api-key-scope-${scope}`}>{scopeLabel(t, scope)}</Label>
                                </div>
                            ))}
                        </div>
                    </fieldset>
                    <Button type="button" onClick={create} disabled={!valid || creating}>
                        {creating ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Plus aria-hidden="true" />}
                        {t("Create key")}
                    </Button>
                </div>

                <div className="space-y-3 border-t border-border pt-6">
                    <h3 className="type-body font-semibold text-foreground">{t("Keys")}</h3>
                    {keys.loading && !keys.data && <InlineSpinner />}
                    {keys.error && <ErrorPanel error={keys.error} onRetry={keys.reload} />}
                    {keys.data && keys.data.length === 0 && (
                        <p className="type-body text-muted-foreground">{t("No keys yet.")}</p>
                    )}
                    {keys.data && keys.data.length > 0 && (
                        <ul className="divide-y divide-border">
                            {keys.data.map((k) => <KeyRow key={k.keyId} k={k} onRevoke={setRevoking} />)}
                        </ul>
                    )}
                </div>
            </div>

            {created && <NewKeyDialog apiKey={created.apiKey} label={created.label} onClose={() => setCreated(null)} />}

            <AlertDialog open={revoking !== null} onOpenChange={(open) => !open && !revokeBusy && setRevoking(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{fmt(t("Revoke {label}?"), { label: revoking?.label ?? "" })}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("Any system using this key stops working on its next request. This cannot be undone.")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={revokeBusy}>{t("Cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                void confirmRevoke();
                            }}
                            disabled={revokeBusy}
                        >
                            {revokeBusy && <Loader2 aria-hidden="true" className="animate-spin" />}
                            {t("Revoke key")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </SectionCard>
    );
}
