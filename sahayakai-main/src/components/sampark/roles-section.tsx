"use client";

import { useState } from "react";
import { Loader2, UsersRound } from "lucide-react";
import { SectionCard } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { grantRoleAssignment, listRoleAssignments, revokeRoleAssignment } from "@/lib/api/sampark";
import { ErrorPanel, LoadingBlock, errorMessage } from "./states";
import { useSamparkQuery } from "./use-sampark-query";
import { ASSIGNABLE_ROLE_IDS, roleLabel } from "./labels";

/** "7B, 4A" → [{ grade: 7, section: "B" }, …]; null when any part is not a class. */
function parseSections(text: string): { grade: number; section: string }[] | null {
    const parts = text.split(/[,\s]+/).filter(Boolean);
    const out: { grade: number; section: string }[] = [];
    for (const p of parts) {
        const m = /^(1[0-2]|[1-9])([A-Za-z])$/.exec(p);
        if (!m) return null;
        out.push({ grade: Number(m[1]), section: m[2].toUpperCase() });
    }
    return out;
}

/** Who holds which role. The platform knows only "admin" and "teacher"; Sampark roles are granted here (plan §8). */
export function RolesSection({ orgId }: { orgId: string }) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const query = useSamparkQuery((signal) => listRoleAssignments(orgId, { signal }), [orgId]);
    const [uid, setUid] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [role, setRole] = useState<string>("class_teacher");
    const [sections, setSections] = useState("");
    const [busy, setBusy] = useState(false);
    const parsed = role === "class_teacher" ? parseSections(sections) : [];
    const valid = uid.trim() !== "" && parsed !== null && (role !== "class_teacher" || parsed.length > 0);

    async function grant() {
        if (!parsed) return;
        setBusy(true);
        try {
            await grantRoleAssignment(orgId, { uid: uid.trim(), role, sections: parsed, displayName: displayName.trim() });
            setUid("");
            setDisplayName("");
            setSections("");
            query.reload();
        } catch (err) {
            toast({ title: t("Could not save the role"), description: errorMessage(t, err), variant: "destructive" });
        } finally {
            setBusy(false);
        }
    }

    async function revoke(u: string, r: string) {
        try {
            await revokeRoleAssignment(orgId, { uid: u, role: r });
            query.reload();
        } catch (err) {
            toast({ title: t("Could not remove the role"), description: errorMessage(t, err), variant: "destructive" });
        }
    }

    return (
        <SectionCard
            title={t("Who approves")}
            description={t("Give each person their role. Class teachers approve for their own class, accounts for fees, the coordinator for conduct requests. The principal can approve anything.")}
            icon={UsersRound}
        >
            {!query.data && query.loading && <LoadingBlock rows={2} />}
            {query.error && <ErrorPanel error={query.error} onRetry={query.reload} />}
            {query.data && query.data.length > 0 && (
                <ul className="space-y-2">
                    {query.data.map((a) => (
                        <li key={`${a.uid}-${a.role}`} className="flex flex-wrap items-center justify-between gap-2 rounded-surface-md border border-border bg-card p-3">
                            <p className="type-body text-foreground break-words">
                                <span className="font-medium">{a.displayName}</span> · {roleLabel(t, a.role)}
                                {a.sections.length > 0 && <> · {a.sections.map((s) => `${s.grade}${s.section}`).join(", ")}</>}
                            </p>
                            <Button type="button" variant="ghost" size="sm" onClick={() => revoke(a.uid, a.role)} className="min-h-11">{t("Remove")}</Button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="role-uid">{t("Their sign-in id")}</Label>
                    <Input id="role-uid" value={uid} onChange={(e) => setUid(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="role-name">{t("Their name")}</Label>
                    <Input id="role-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="role-role">{t("Role")}</Label>
                    <Select value={role} onValueChange={setRole}>
                        <SelectTrigger id="role-role"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {ASSIGNABLE_ROLE_IDS.map((r) => (
                                <SelectItem key={r} value={r}>{roleLabel(t, r)}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {role === "class_teacher" && (
                    <div className="space-y-2">
                        <Label htmlFor="role-sections">{t("Classes, for example 7B, 4A")}</Label>
                        <Input id="role-sections" value={sections} onChange={(e) => setSections(e.target.value)} aria-invalid={parsed === null} />
                    </div>
                )}
            </div>
            <Button type="button" onClick={grant} disabled={!valid || busy} className="min-h-11">
                {busy && <Loader2 aria-hidden="true" className="animate-spin" />}
                {t("Save role")}
            </Button>
        </SectionCard>
    );
}
