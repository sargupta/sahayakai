"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { useSamparkQuery } from "@/components/sampark/use-sampark-query";
import { useSamparkHref } from "@/components/shell/product-paths";
import { useLanguage } from "@/context/language-context";
import { getProviderChoice } from "@/lib/api/sampark";
import { CHOOSER_SEGMENT, PROVIDER_LABEL, switchProviderHref } from "@/lib/sampark/provider-choice";

/**
 * Header pill inside SamparkAI — internal demo deployments only: which calling provider this
 * session uses, and the way back to the provider choice ("Switch"). Schools own their provider
 * (Settings → Calling provider), so off the demo chooser this renders nothing.
 *
 * The query string is read after mount (not useSearchParams), so every page that renders the
 * workspace frame can be prerendered without a Suspense boundary — useSearchParams here once
 * failed the production build of /sampark/workspace.
 */
export function ProviderSwitchPill() {
    // useSearchParams() needs a Suspense boundary, or `next build` cannot prerender any static
    // page whose frame shows this pill (/sampark/workspace, /sampark/demo/*): the build failed.
    return (
        <Suspense fallback={null}>
            <ProviderSwitchPillInner />
        </Suspense>
    );
}

function ProviderSwitchPillInner() {
    const { t } = useLanguage();
    const pathname = usePathname() ?? "";
    const [search, setSearch] = useState("");
    useEffect(() => setSearch(window.location.search.replace(/^\?/, "")), [pathname]);
    const demoChooser = process.env.NEXT_PUBLIC_SAMPARK_PROVIDER_CHOOSER === "true";
    const samparkHref = useSamparkHref();
    const state = useSamparkQuery(demoChooser ? (signal) => getProviderChoice({ signal }) : null, [demoChooser]);
    const choice = state.data?.choice ?? null;
    const here = `${pathname}${search ? `?${search}` : ""}`;
    const href = switchProviderHref(samparkHref(`/${CHOOSER_SEGMENT}`), here);
    if (!demoChooser) return null; // schools own their provider; nothing to switch here
    if (pathname.includes(`/${CHOOSER_SEGMENT}`)) return null; // already choosing
    return (
        <Link
            href={href}
            data-testid="provider-switch"
            className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-pill border border-line-hairline bg-surface-glass px-3 text-xs font-medium text-ink-700 hover:bg-milk-300"
            title={t("Choose the calling provider again")}
        >
            <ArrowLeftRight aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{choice ? `${t("Calls via")} ${PROVIDER_LABEL[choice]}` : t("Calling provider")}</span>
            <span className="text-primary">· {t("Switch")}</span>
        </Link>
    );
}
