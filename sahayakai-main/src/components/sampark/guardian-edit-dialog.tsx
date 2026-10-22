"use client";

import { useState } from "react";
import { Info, Loader2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { PARENT_LANGUAGE_INFO } from "@/lib/sampark/languages";
import { updateGuardianPreferences, type GuardianPreferencesPatch, type GuardianRow } from "@/lib/api/sampark";
import { PARENT_LANGUAGES, type ConsentGroup, type ConsentStatus, type ParentLanguage } from "@/types/sampark";
import { CONSENT_GROUPS, consentGroupLabel, consentStatusLabel, fmt, languageName } from "./labels";
import { errorMessage } from "./states";

const NO_LANGUAGE = "__none__";
const CONSENT_VALUES: ConsentStatus[] = ["granted", "denied", "unknown"];

/**
 * Edit one family's language and consent, as recorded by the school office.
 * Consent is something the family gives; the dialog says so before anyone
 * ticks "granted" on their behalf.
 */
export function GuardianEditDialog({
    orgId,
    guardian,
    open,
    onOpenChange,
    onSaved,
}: {
    orgId: string;
    guardian: GuardianRow | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
}) {
    const { t } = useLanguage();
    const { toast } = useToast();
    // The parent keys this dialog by guardian id, so initial state is always this guardian's.
    const [language, setLanguage] = useState<string>(() => guardian?.language ?? NO_LANGUAGE);
    const [consent, setConsent] = useState<Record<ConsentGroup, ConsentStatus> | null>(() =>
        guardian ? { ...guardian.consent } : null,
    );
    const [saving, setSaving] = useState(false);

    if (!guardian || !consent) return null;

    const nextLanguage: ParentLanguage | null = language === NO_LANGUAGE ? null : (language as ParentLanguage);
    const patch: GuardianPreferencesPatch = {};
    if (nextLanguage !== guardian.language) patch.language = nextLanguage;
    const consentChanges: Partial<Record<ConsentGroup, ConsentStatus>> = {};
    for (const g of CONSENT_GROUPS) {
        if (consent[g] !== guardian.consent[g]) consentChanges[g] = consent[g];
    }
    if (Object.keys(consentChanges).length > 0) patch.consent = consentChanges;
    const dirty = Object.keys(patch).length > 0;

    const save = async () => {
        setSaving(true);
        try {
            await updateGuardianPreferences(orgId, guardian.id, patch);
            toast({ title: t("Saved as recorded by the school office") });
            onSaved();
            onOpenChange(false);
        } catch (err) {
            toast({ title: t("Could not save"), description: errorMessage(t, err), variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
            <DialogContent className="rounded-surface-lg shadow-floating">
                <DialogHeader>
                    <DialogTitle>{fmt(t("Edit {name}"), { name: guardian.displayName })}</DialogTitle>
                    <DialogDescription>
                        {fmt(t("Phone ending {last4}"), { last4: guardian.phoneLast4 })}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex items-start gap-2 rounded-surface-md border border-info/30 bg-info/10 p-3">
                        <Info aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-info" />
                        <p className="type-body text-foreground">
                            {t("Record consent only after the family has told the school. Never assume it. Your change is saved as recorded by the school office.")}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="guardian-language">{t("Language for calls")}</Label>
                        <Select value={language} onValueChange={setLanguage}>
                            <SelectTrigger id="guardian-language">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NO_LANGUAGE}>{languageName(t, null)}</SelectItem>
                                {PARENT_LANGUAGES.map((l) => (
                                    <SelectItem key={l} value={l}>
                                        {languageName(t, l)} · <span lang={PARENT_LANGUAGE_INFO[l].code}>{PARENT_LANGUAGE_INFO[l].nativeLabel}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <fieldset className="space-y-3">
                        <legend className="type-body font-medium text-foreground">{t("Consent")}</legend>
                        {CONSENT_GROUPS.map((g) => (
                            <div key={g} className="grid gap-2 sm:grid-cols-2 sm:items-center">
                                <Label htmlFor={`consent-${g}`}>{consentGroupLabel(t, g)}</Label>
                                <Select
                                    value={consent[g]}
                                    onValueChange={(v) => setConsent((prev) => (prev ? { ...prev, [g]: v as ConsentStatus } : prev))}
                                >
                                    <SelectTrigger id={`consent-${g}`}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CONSENT_VALUES.map((v) => (
                                            <SelectItem key={v} value={v}>{consentStatusLabel(t, v)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ))}
                    </fieldset>
                </div>

                <DialogFooter className="gap-2">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        {t("Cancel")}
                    </Button>
                    <Button type="button" onClick={save} disabled={!dirty || saving}>
                        {saving && <Loader2 aria-hidden="true" className="animate-spin" />}
                        {t("Save")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
