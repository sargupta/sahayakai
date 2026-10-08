"use client";

import { CheckCircle2, Loader2, PlugZap, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import type { McpConnection } from "./use-mcp-lesson-plan";

/** Small, production-looking MCP status pill (replaces the usage badge of the app page). */
export function McpStatusBadge({ connection, onRetry }: { connection: McpConnection; onRetry: () => void }) {
    const { t } = useLanguage();
    const connected = connection.state === "connected";
    return (
        <div
            role="status"
            aria-live="polite"
            data-testid="mcp-status"
            className={cn(
                "inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border px-3 py-1 text-xs",
                connected ? "border-primary/30 bg-primary/5 text-foreground" : "border-border bg-muted/40 text-muted-foreground",
            )}
        >
            <PlugZap className="h-3.5 w-3.5 text-primary" aria-hidden />
            <span className="font-semibold">{t("Sahayak MCP")}</span>
            {connection.state === "checking" && (
                <span className="inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    {t("Connecting…")}
                </span>
            )}
            {connected && (
                <>
                    <span className="inline-flex items-center gap-1 text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        {t("Connected")}
                    </span>
                    <span className="text-muted-foreground" aria-hidden>·</span>
                    <span>
                        {t("Tool")}: <code className="font-mono">{connection.server.tool}</code>
                    </span>
                    <span className="hidden sm:inline text-muted-foreground" aria-hidden>·</span>
                    <span className="hidden sm:inline text-muted-foreground">{connection.server.protocol}</span>
                </>
            )}
            {connection.state === "unavailable" && (
                <>
                    <span>{connection.configured ? t("Not connected") : t("Not configured")}</span>
                    {connection.configured && (
                        <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 text-primary hover:underline">
                            <RefreshCw className="h-3 w-3" aria-hidden />
                            {t("Retry")}
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
