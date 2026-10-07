"use client";

import { useLanguage } from "@/context/language-context";
import type { ImportRejectedRow } from "@/types/sampark";
import { entityLabel } from "./labels";

/**
 * Records the import refused, with the reason. Rows are quarantined, never
 * silently fixed, so the office can correct them in the school records.
 */
export function RejectedRowsTable({ rows }: { rows: ImportRejectedRow[] }) {
    const { t } = useLanguage();
    if (rows.length === 0) {
        return <p className="type-body text-muted-foreground">{t("No rows were rejected.")}</p>;
    }
    return (
        <div className="w-0 min-w-full overflow-x-auto rounded-surface-md border border-border">
            {/* w-0 min-w-full: scrolls here rather than widening the page (see campaign-detail.tsx). */}
            <table className="w-full text-left type-body">
                <caption className="sr-only">{t("Rejected rows")}</caption>
                <thead className="bg-muted/30">
                    <tr className="border-b border-border">
                        <th scope="col" className="px-3 py-2 text-xs font-medium leading-normal text-muted-foreground">{t("Record")}</th>
                        <th scope="col" className="px-3 py-2 text-xs font-medium leading-normal text-muted-foreground">{t("ID in school records")}</th>
                        <th scope="col" className="px-3 py-2 text-xs font-medium leading-normal text-muted-foreground">{t("Row")}</th>
                        <th scope="col" className="px-3 py-2 text-xs font-medium leading-normal text-muted-foreground">{t("Reason")}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={`${r.entity}-${r.crmId ?? "none"}-${r.row ?? i}-${i}`} className="border-b border-border last:border-b-0 align-top">
                            <td className="px-3 py-2 text-foreground">{entityLabel(t, r.entity)}</td>
                            <td className="px-3 py-2 font-mono text-foreground">{r.crmId ?? "—"}</td>
                            <td className="px-3 py-2 text-foreground">{r.row ?? "—"}</td>
                            <td className="px-3 py-2 text-foreground whitespace-normal">{r.reason}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
