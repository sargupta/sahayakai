"use client";

import { useState } from "react";
import { Loader2, PhoneOutgoing } from "lucide-react";
import { SectionCard } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { updateSchool } from "@/lib/api/sampark";
import type { CarrierProvider } from "@/types/sampark";
import { useSamparkSchool } from "./school-context";
import { errorMessage } from "./states";

/** Shape check only (the server validates with the repo phone utilities); phone.ts itself is server-side (node:crypto). */
const isValidCallerId = (v: string) => /^\+\d{10,15}$/.test(v);

/** Provider names are product names, not user copy: never translated. */
const REAL_PROVIDERS: { id: Exclude<CarrierProvider, "simulated">; name: string }[] = [
    { id: "vobiz", name: "Vobiz" },
    { id: "knowlarity", name: "Knowlarity" },
];

/**
 * The school's dedicated calling number (R2-6): what parents see when the school
 * calls, whether it is registered to the school, and which service would place
 * real calls. Saving it never starts a real call: the gate still needs the
 * deployment's live-dialling flag and a non-practice mode, and re-checks all of
 * it at dispatch.
 */
export function CarrierSection() {
    const { t } = useLanguage();
    const { toast } = useToast();
    const { orgId, school, setSchool } = useSamparkSchool();
    const saved = school.carrier ?? null;
    const [callerId, setCallerId] = useState(saved?.callerId ?? "");
    const [registered, setRegistered] = useState(saved?.registeredToSchool ?? false);
    const [provider, setProvider] = useState<CarrierProvider>(saved?.provider ?? "simulated");
    const [saving, setSaving] = useState(false);

    const trimmed = callerId.trim();
    const numberValid = trimmed === "" || isValidCallerId(trimmed);
    const dirty =
        trimmed !== (saved?.callerId ?? "") || registered !== (saved?.registeredToSchool ?? false) || provider !== (saved?.provider ?? "simulated");

    const save = async () => {
        setSaving(true);
        try {
            setSchool(await updateSchool(orgId, { carrier: { callerId: trimmed === "" ? null : trimmed, registeredToSchool: registered, provider } }));
            toast({ title: t("Settings saved") });
        } catch (err) {
            toast({ title: t("Could not save"), description: errorMessage(t, err), variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <SectionCard
            title={t("Calling number")}
            icon={PhoneOutgoing}
            description={t("The number parents see when the school calls. It must be a number registered to the school. Saving it does not start real calls: real calls also need the phase 2 approvals.")}
        >
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="carrier-caller-id">{t("Number parents will see (with country code)")}</Label>
                    <Input
                        id="carrier-caller-id"
                        type="tel"
                        inputMode="tel"
                        autoComplete="off"
                        value={callerId}
                        onChange={(e) => setCallerId(e.target.value)}
                        placeholder="+91"
                        aria-invalid={!numberValid}
                        aria-describedby={numberValid ? undefined : "carrier-caller-id-error"}
                        className="font-mono"
                    />
                    {!numberValid && (
                        <p id="carrier-caller-id-error" className="type-body text-destructive">
                            {t("Enter the full number with country code, for example +919876543210.")}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox id="carrier-registered" checked={registered} onCheckedChange={(c) => setRegistered(c === true)} />
                    <Label htmlFor="carrier-registered" className="font-normal">{t("This number is registered to the school")}</Label>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="carrier-provider">{t("Calling service")}</Label>
                    <Select value={provider} onValueChange={(v) => setProvider(v as CarrierProvider)}>
                        <SelectTrigger id="carrier-provider" className="w-full md:w-72">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="simulated">{t("Practice only (no real calls)")}</SelectItem>
                            {REAL_PROVIDERS.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <p className="type-body text-muted-foreground">
                    {t("Real calls stay blocked until a number is set, confirmed as registered to the school, and live calling is approved.")}
                </p>
                <Button type="button" onClick={save} disabled={!dirty || !numberValid || saving}>
                    {saving && <Loader2 aria-hidden="true" className="animate-spin" />}
                    {t("Save calling number")}
                </Button>
            </div>
        </SectionCard>
    );
}
