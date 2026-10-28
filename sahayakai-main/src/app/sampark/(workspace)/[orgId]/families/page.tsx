"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Pencil, PhoneOff, Search, Users } from "lucide-react";
import { SectionCard, EmptyState } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/context/language-context";
import { listGuardians, listSuppressions, type GuardianRow, type ListGuardiansQuery } from "@/lib/api/sampark";
import { PARENT_LANGUAGE_INFO } from "@/lib/sampark/languages";
import { PARENT_LANGUAGES, type ParentLanguage } from "@/types/sampark";
import { GuardianEditDialog } from "@/components/sampark/guardian-edit-dialog";
import { StatusPill } from "@/components/sampark/status-pill";
import { ErrorPanel, LoadingBlock } from "@/components/sampark/states";
import { useSamparkQuery } from "@/components/sampark/use-sampark-query";
import { useSamparkSchool } from "@/components/sampark/school-context";
import { useSamparkFormat } from "@/components/sampark/format";
import {
    CONSENT_GROUPS,
    consentGroupLabel,
    consentStatusLabel,
    consentTone,
    fmt,
    languageName,
    phoneClassLabel,
    relationLabel,
    suppressionScopeLabel,
    suppressionSourceLabel,
    suppressionVerificationLabel,
} from "@/components/sampark/labels";

const ALL = "__all__";
const FAMILY_LIMIT = 200;
type LanguageFilter = ParentLanguage | "unknown" | typeof ALL;

function parseLanguage(v: string | null): LanguageFilter {
    if (v === "unknown") return "unknown";
    if (v && (PARENT_LANGUAGES as readonly string[]).includes(v)) return v as ParentLanguage;
    return ALL;
}

function useDebounced<T>(value: T, ms: number): T {
    const [v, setV] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setV(value), ms);
        return () => clearTimeout(id);
    }, [value, ms]);
    return v;
}

function FamilyRow({ g, onEdit }: { g: GuardianRow; onEdit: () => void }) {
    const { t } = useLanguage();
    const info = g.language ? PARENT_LANGUAGE_INFO[g.language] : null;
    return (
        <li className="rounded-surface-md border border-border bg-card p-4 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                    <p className="type-body-lg text-foreground break-words">
                        {g.displayName} <span className="type-body text-muted-foreground">· {relationLabel(t, g.relation)}</span>
                    </p>
                    <p className="type-body text-muted-foreground">
                        {fmt(t("Phone ending {last4}"), { last4: g.phoneLast4 })}
                        {g.phoneClass !== "mobile" && <> · {phoneClassLabel(t, g.phoneClass)}</>}
                    </p>
                    {g.students.length > 0 && (
                        <p className="type-body text-foreground break-words">
                            {g.students
                                .map((s) => `${s.displayName} (${fmt(t("Class {grade}{section}"), { grade: s.grade, section: s.section })})`)
                                .join(", ")}
                        </p>
                    )}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={onEdit} className="shrink-0" aria-label={fmt(t("Edit {name}"), { name: g.displayName })}>
                    <Pencil aria-hidden="true" />
                    {t("Edit")}
                </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={info ? "neutral" : "warning"}>
                    {t("Language")}: {info ? <span lang={info.code}>{info.nativeLabel}</span> : languageName(t, null)}
                </StatusPill>
                {CONSENT_GROUPS.map((group) => (
                    <StatusPill key={group} tone={consentTone(g.consent[group])}>
                        {consentGroupLabel(t, group)}: {consentStatusLabel(t, g.consent[group])}
                    </StatusPill>
                ))}
                {g.suppressed && <StatusPill tone="warning">{t("Calls stopped")}</StatusPill>}
            </div>
        </li>
    );
}

function Suppressions() {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const { orgId } = useSamparkSchool();
    const query = useSamparkQuery((signal) => listSuppressions(orgId, { signal }), [orgId]);
    const rows = query.data ? [...query.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : undefined;

    return (
        <SectionCard
            title={t("Families who asked to stop calls")}
            icon={PhoneOff}
            description={t("A family that presses 9 twice is not called again for routine notices. The office should confirm with the family within two school days.")}
        >
            {!rows && query.loading && <LoadingBlock rows={2} />}
            {query.error && <ErrorPanel error={query.error} onRetry={query.reload} />}
            {rows && rows.length === 0 && <p className="type-body text-muted-foreground">{t("No family has asked to stop calls.")}</p>}
            {rows && rows.length > 0 && (
                <ul className="divide-y divide-border rounded-surface-md border border-border">
                    {rows.map((s) => (
                        <li key={s.phoneHash} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                                <p className="type-body text-foreground">
                                    {fmt(t("Phone ending {last4}"), { last4: s.phoneLast4 })} · {suppressionScopeLabel(t, s.scope)}
                                </p>
                                <p className="type-body text-muted-foreground">
                                    {suppressionSourceLabel(t, s.source)} · {f.dateTime(s.createdAt)}
                                </p>
                            </div>
                            <StatusPill tone={s.officeVerification === "pending" ? "warning" : "neutral"}>
                                {suppressionVerificationLabel(t, s.officeVerification)}
                            </StatusPill>
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}

function FamiliesContent() {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const searchParams = useSearchParams();
    const { orgId } = useSamparkSchool();

    const [language, setLanguage] = useState<LanguageFilter>(() => parseLanguage(searchParams?.get("language") ?? null));
    const [q, setQ] = useState("");
    const debouncedQ = useDebounced(q, 300);
    const [editing, setEditing] = useState<GuardianRow | null>(null);

    const query = useSamparkQuery(
        (signal) => {
            const params: ListGuardiansQuery = { limit: FAMILY_LIMIT };
            if (language !== ALL) params.language = language;
            if (debouncedQ.trim()) params.q = debouncedQ.trim();
            return listGuardians(orgId, params, { signal });
        },
        [orgId, language, debouncedQ],
    );
    const rows = query.data;

    return (
        <div className="space-y-6">
            <SectionCard
                title={t("Families")}
                icon={Users}
                description={t("Families come from your school records. Here you record the language each family wants and the consent they have given.")}
            >
                <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="families-search">{t("Search")}</Label>
                        <div className="relative">
                            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="families-search"
                                type="search"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder={t("Parent or child name, or last 4 digits of the phone")}
                                className="pl-10"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="families-language">{t("Language")}</Label>
                        <Select value={language} onValueChange={(v) => setLanguage(v as LanguageFilter)}>
                            <SelectTrigger id="families-language">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>{t("All languages")}</SelectItem>
                                {PARENT_LANGUAGES.map((l) => (
                                    <SelectItem key={l} value={l}>{languageName(t, l)}</SelectItem>
                                ))}
                                <SelectItem value="unknown">{languageName(t, "unknown")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {!rows && query.loading && <LoadingBlock rows={4} />}
                {query.error && <ErrorPanel error={query.error} onRetry={query.reload} />}
                {rows && rows.length === 0 && (
                    <EmptyState
                        icon={Users}
                        title={q || language !== ALL ? t("No families match") : t("No families yet")}
                        description={q || language !== ALL ? t("Try a different search or language.") : t("Import your school data from Settings to see families here.")}
                    />
                )}
                {rows && rows.length > 0 && (
                    <>
                        <p className="type-body text-muted-foreground" aria-live="polite">
                            {rows.length >= FAMILY_LIMIT
                                ? fmt(t("Showing the first {count} families. Search to narrow down."), { count: f.number(rows.length) })
                                : fmt(t("{count} families"), { count: f.number(rows.length) })}
                        </p>
                        <ul className="space-y-3">
                            {rows.map((g) => (
                                <FamilyRow key={g.id} g={g} onEdit={() => setEditing(g)} />
                            ))}
                        </ul>
                    </>
                )}
            </SectionCard>

            <Suppressions />

            <GuardianEditDialog
                key={editing?.id ?? "none"}
                orgId={orgId}
                guardian={editing}
                open={editing !== null}
                onOpenChange={(o) => !o && setEditing(null)}
                onSaved={query.reload}
            />
        </div>
    );
}

export default function SamparkFamiliesPage() {
    return (
        <Suspense fallback={<LoadingBlock rows={4} />}>
            <FamiliesContent />
        </Suspense>
    );
}
