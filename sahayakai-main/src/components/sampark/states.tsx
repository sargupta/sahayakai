"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/context/language-context";
import { ApiError } from "@/lib/api/client";
import { serverErrorText, type Translate } from "./labels";

/**
 * Sampark routes answer `{ error: CODE, message }`. `apiFetch` puts the CODE in
 * `error.message`, so the readable sentence has to be taken from the body.
 */
function serverMessage(error: ApiError): string {
    const body = error.body as { message?: unknown } | undefined;
    return typeof body?.message === 'string' && body.message.length > 0 ? body.message : error.message;
}

/** A plain sentence for a failed request, by HTTP status. */
export function describeError(t: Translate, error: Error): { title: string; detail: string | null } {
    if (error instanceof ApiError) {
        // Known Sampark codes (400 TEST_PHONE_INVALID, 409 mode refusals) read as one plain sentence.
        if (error.status === 400 || error.status === 409) {
            const known = serverErrorText(t, error.message);
            if (known !== error.message) return { title: known, detail: null };
        }
        switch (error.status) {
            case 401:
                return { title: t("Please sign in again."), detail: null };
            case 403:
                return { title: t("Only administrators of this school can use school calls."), detail: null };
            case 404:
                return { title: t("Not found. School calls may not be switched on for this school yet."), detail: null };
            case 409:
                return { title: serverMessage(error), detail: null };
            default:
                return { title: t("Something went wrong"), detail: serverMessage(error) };
        }
    }
    return { title: t("Something went wrong"), detail: error.message || null };
}

export function ErrorPanel({ error, onRetry }: { error: Error; onRetry?: () => void }) {
    const { t } = useLanguage();
    const { title, detail } = describeError(t, error);
    return (
        <div role="alert" className="flex flex-col gap-3 rounded-surface-md border border-destructive/40 bg-destructive/10 p-4 sm:flex-row sm:items-start">
            <AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1 space-y-1">
                <p className="type-body font-semibold text-foreground">{title}</p>
                {detail && <p className="type-body text-muted-foreground break-words">{detail}</p>}
            </div>
            {onRetry && (
                <Button type="button" variant="outline" size="sm" onClick={onRetry} className="shrink-0">
                    {t("Try again")}
                </Button>
            )}
        </div>
    );
}

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
    const { t } = useLanguage();
    return (
        <div aria-busy="true" className="space-y-3">
            <span className="sr-only">{t("Loading...")}</span>
            {Array.from({ length: rows }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
            ))}
        </div>
    );
}

export function InlineSpinner({ label }: { label?: string }) {
    const { t } = useLanguage();
    return (
        <span className="inline-flex items-center gap-2 type-body text-muted-foreground">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            {label ?? t("Loading...")}
        </span>
    );
}

/** Pull a readable message out of an unknown thrown value, for toasts. */
export function errorMessage(t: Translate, err: unknown): string {
    if (err instanceof Error) {
        const { title, detail } = describeError(t, err);
        return detail ? `${title}: ${detail}` : title;
    }
    return t("Something went wrong");
}
