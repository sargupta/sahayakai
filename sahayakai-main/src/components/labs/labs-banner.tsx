"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { isLabsRoute } from "@/lib/labs";
import { useLanguage } from "@/context/language-context";

/**
 * Renders a slim notice above any parked (Labs) tool page. Mounted once in
 * AppShell's <main>; self-hides on non-Labs routes so pages need no changes.
 */
export function LabsBanner() {
    const pathname = usePathname();
    const { t } = useLanguage();

    if (!isLabsRoute(pathname)) return null;

    return (
        <div
            role="note"
            className="w-full max-w-4xl mb-4 flex items-start gap-3 rounded-surface-sm border border-border bg-muted/50 px-4 py-3"
        >
            <FlaskConical className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
                {t("This is a Labs tool. It works, but we are still improving it.")}{" "}
                <Link href="/labs" className="underline underline-offset-2 hover:text-foreground">
                    {t("See all Labs tools")}
                </Link>
            </p>
        </div>
    );
}
