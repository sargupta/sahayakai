"use client";

import { useEffect, useState } from "react";
import { Database, FileUp, Loader2, RefreshCw } from "lucide-react";
import { SectionCard } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { getLatestImport, startImport, updateSchool, type StartImportInput } from "@/lib/api/sampark";
import type { ImportRun } from "@/types/sampark";
import { useSamparkSchool } from "./school-context";
import { useSamparkQuery } from "./use-sampark-query";
import { useSamparkFormat } from "./format";
import { ImportStatusBadge } from "./status-pill";
import { RejectedRowsTable } from "./rejected-rows-table";
import { ErrorPanel, InlineSpinner, errorMessage } from "./states";
import { fmt } from "./labels";

/** Matches the server's per-file cap on CSV imports. */
const MAX_CSV_BYTES = 5 * 1024 * 1024;
/** Secret names are identifiers the server allow-lists (SAMPARK_CRM_*), not user copy — never translated. */
const SECRET_NAME_PREFIX = "SAMPARK_CRM_";

function LastImport({ run }: { run: ImportRun }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <ImportStatusBadge status={run.status} />
                <span className="type-body text-muted-foreground">
                    {run.source === "csv" ? t("From CSV files") : t("From the school records system")}
                    {" · "}
                    {f.dateTime(run.finishedAt ?? run.startedAt)}
                </span>
            </div>
            <p className="type-body text-foreground">
                {fmt(t("{students} students, {guardians} guardians, {rejected} rejected rows"), {
                    students: f.number(run.counts.students),
                    guardians: f.number(run.counts.guardians),
                    rejected: f.number(run.counts.rejected),
                })}
                {run.counts.tombstoned > 0 && (
                    <> · {fmt(t("{count} records no longer in the school records were retired"), { count: f.number(run.counts.tombstoned) })}</>
                )}
            </p>
            {run.error && (
                <p className="type-body text-destructive break-words">{run.error}</p>
            )}
            <div className="space-y-2">
                <p className="text-xs font-medium leading-normal text-muted-foreground">{t("Rejected rows")}</p>
                <p className="type-body text-muted-foreground">{t("These records were not imported. Correct them in the school records and import again.")}</p>
                <RejectedRowsTable rows={run.rejected} />
            </div>
        </div>
    );
}

export function CrmSection() {
    const { t } = useLanguage();
    const { toast } = useToast();
    const { orgId, school, setSchool, reloadSchool } = useSamparkSchool();

    const restSaved = school.crm?.kind === "rest" ? school.crm : null;
    // An MCP connection is set up with the school's tool team (tool names and field mapping), not typed here.
    const mcpSaved = school.crm?.kind === "mcp" ? school.crm : null;
    const [baseUrl, setBaseUrl] = useState(restSaved?.baseUrl ?? "");
    const [secretName, setSecretName] = useState(restSaved?.apiKeySecretName ?? "");
    const [savingConn, setSavingConn] = useState(false);
    const [importing, setImporting] = useState<"rest" | "mcp" | "csv" | null>(null);
    const [studentsFile, setStudentsFile] = useState<File | null>(null);
    const [guardiansFile, setGuardiansFile] = useState<File | null>(null);
    const [consentFile, setConsentFile] = useState<File | null>(null);
    const [fileKey, setFileKey] = useState(0);

    const [pollMs, setPollMs] = useState<number | null>(null);
    const latest = useSamparkQuery((signal) => getLatestImport(orgId, { signal }), [orgId], { pollMs });
    const running = latest.data?.status === "running";
    useEffect(() => setPollMs(running ? 3_000 : null), [running]);
    // When a running import finishes, refresh the header's "synced" line.
    const [wasRunning, setWasRunning] = useState(false);
    useEffect(() => {
        if (running) setWasRunning(true);
        else if (wasRunning) {
            setWasRunning(false);
            reloadSchool();
        }
    }, [running, wasRunning, reloadSchool]);

    const connDirty = baseUrl.trim() !== (restSaved?.baseUrl ?? "") || secretName.trim() !== (restSaved?.apiKeySecretName ?? "");
    const connValid = baseUrl.trim().length > 0 && secretName.trim().length > 0;

    const saveConnection = async () => {
        setSavingConn(true);
        try {
            setSchool(await updateSchool(orgId, { crm: { kind: "rest", baseUrl: baseUrl.trim(), apiKeySecretName: secretName.trim() } }));
            toast({ title: t("Connection saved") });
        } catch (err) {
            toast({ title: t("Could not save the connection"), description: errorMessage(t, err), variant: "destructive" });
        } finally {
            setSavingConn(false);
        }
    };

    const runImport = async (input: StartImportInput) => {
        setImporting(input.source);
        try {
            const run = await startImport(orgId, input);
            latest.setData(run);
            if (run.status === "succeeded") {
                toast({ title: fmt(t("Imported {students} students and {guardians} guardians"), { students: run.counts.students, guardians: run.counts.guardians }) });
            } else if (run.status === "failed") {
                toast({ title: t("Import failed"), description: run.error ?? undefined, variant: "destructive" });
            }
            reloadSchool();
            if (input.source === "csv") {
                setStudentsFile(null);
                setGuardiansFile(null);
                setConsentFile(null);
                setFileKey((k) => k + 1);
            }
        } catch (err) {
            toast({ title: t("Import failed"), description: errorMessage(t, err), variant: "destructive" });
        } finally {
            setImporting(null);
        }
    };

    const importCsv = async () => {
        if (!studentsFile || !guardiansFile) return;
        if (studentsFile.size > MAX_CSV_BYTES || guardiansFile.size > MAX_CSV_BYTES || (consentFile?.size ?? 0) > MAX_CSV_BYTES) {
            toast({ title: t("Each file must be 5 MB or smaller."), variant: "destructive" });
            return;
        }
        const [studentsCsv, guardiansCsv, consentCsv] = await Promise.all([studentsFile.text(), guardiansFile.text(), consentFile ? consentFile.text() : Promise.resolve("")]);
        await runImport({ source: "csv", studentsCsv, guardiansCsv, ...(consentCsv.trim() !== "" ? { consentCsv } : {}) });
    };

    const busy = importing !== null || running;

    return (
        <SectionCard title={t("School records")} icon={Database} description={t("Sampark reads classes, students and guardians from your school records. It never changes them.")}>
            <div className="space-y-6">
                {mcpSaved && (
                    <div className="space-y-3">
                        <h3 className="type-body font-semibold text-foreground">{t("Connected through MCP. The tool names and field mapping were set up with your SahayakAI contact.")}</h3>
                        <Button type="button" onClick={() => runImport({ source: "mcp" })} disabled={busy}>
                            {importing === "mcp" ? <Loader2 aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />}
                            {t("Import now")}
                        </Button>
                    </div>
                )}
                {!mcpSaved && (
                <div className="space-y-3">
                    <h3 className="type-body font-semibold text-foreground">{t("Connect to your school records system")}</h3>
                    <div className="space-y-2">
                        <Label htmlFor="crm-base-url">{t("Address (URL) of the records system")}</Label>
                        <Input
                            id="crm-base-url"
                            type="url"
                            inputMode="url"
                            autoComplete="off"
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            placeholder="https://"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="crm-secret-name">{t("Name of the stored key")}</Label>
                        <Input
                            id="crm-secret-name"
                            autoComplete="off"
                            spellCheck={false}
                            value={secretName}
                            onChange={(e) => setSecretName(e.target.value)}
                            placeholder={SECRET_NAME_PREFIX}
                            className="font-mono"
                        />
                        <p className="type-body text-muted-foreground">
                            {t("The name under which your SahayakAI contact stored the access key, for example SAMPARK_CRM_HILLVIEW. Never paste the key itself here.")}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Button type="button" variant="outline" onClick={saveConnection} disabled={!connValid || !connDirty || savingConn}>
                            {savingConn && <Loader2 aria-hidden="true" className="animate-spin" />}
                            {t("Save connection")}
                        </Button>
                        <Button type="button" onClick={() => runImport({ source: "rest" })} disabled={!restSaved || connDirty || busy}>
                            {importing === "rest" ? <Loader2 aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />}
                            {t("Import now")}
                        </Button>
                    </div>
                    {connDirty && restSaved && <p className="type-body text-muted-foreground">{t("Save the connection before importing.")}</p>}
                </div>
                )}

                <div className="space-y-3 border-t border-border pt-6">
                    <h3 className="type-body font-semibold text-foreground">{t("Or upload CSV files")}</h3>
                    <p className="type-body text-muted-foreground">{t("Export students and guardians from your records system as two CSV files. The files are read in your browser and sent to SahayakAI for this import only.")}</p>
                    <div key={fileKey} className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="csv-students">{t("Students file (students.csv)")}</Label>
                            <Input
                                id="csv-students"
                                type="file"
                                accept=".csv,text/csv"
                                onChange={(e) => setStudentsFile(e.target.files?.[0] ?? null)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="csv-guardians">{t("Guardians file (guardians.csv)")}</Label>
                            <Input
                                id="csv-guardians"
                                type="file"
                                accept=".csv,text/csv"
                                onChange={(e) => setGuardiansFile(e.target.files?.[0] ?? null)}
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="csv-consent">{t("Consent file (consent.csv), optional")}</Label>
                            <Input
                                id="csv-consent"
                                type="file"
                                accept=".csv,text/csv"
                                onChange={(e) => setConsentFile(e.target.files?.[0] ?? null)}
                            />
                            <p className="type-body text-muted-foreground">{t("One row per parent and kind of call: who agreed or declined, when, and how.")}</p>
                        </div>
                    </div>
                    <Button type="button" onClick={importCsv} disabled={!studentsFile || !guardiansFile || busy}>
                        {importing === "csv" ? <Loader2 aria-hidden="true" className="animate-spin" /> : <FileUp aria-hidden="true" />}
                        {t("Import files")}
                    </Button>
                </div>

                <div className="space-y-3 border-t border-border pt-6">
                    <h3 className="type-body font-semibold text-foreground">{t("Last import")}</h3>
                    {latest.loading && !latest.data && <InlineSpinner />}
                    {latest.error && <ErrorPanel error={latest.error} onRetry={latest.reload} />}
                    {!latest.loading && !latest.error && !latest.data && (
                        <p className="type-body text-muted-foreground">{t("No import yet.")}</p>
                    )}
                    {latest.data && <LastImport run={latest.data} />}
                </div>
            </div>
        </SectionCard>
    );
}
