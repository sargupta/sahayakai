"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { useSamparkQuery } from "@/components/sampark/use-sampark-query";
import { useSamparkHref } from "@/components/shell/product-paths";
import { useLanguage } from "@/context/language-context";
import { getProviderChoice } from "@/lib/api/sampark";
import { CHOOSER_SEGMENT, PROVIDER_LABEL, switchProviderHref } from "@/lib/sampark/provider-choice";

/**
 * Header pill inside SamparkAI: which calling provider this session uses, and the way back to
 * the provider choice ("Switch"). Returns to the same page afterwards. The choice itself lives
 * on the server (httpOnly cookie); this only shows it.
 */
export function ProviderSwitchPill() {
    const { t } = useLanguage();
    const pathname = usePathname() ?? "";
    const search = useSearchParams()?.toString() ?? "";
    const samparkHref = useSamparkHref();
    const state = useSamparkQuery((signal) => getProviderChoice({ signal }), []);
    const choice = state.data?.choice ?? null;
    const here = `${pathname}${search ? `?${search}` : ""}`;
    const href = switchProviderHref(samparkHref(`/${CHOOSER_SEGMENT}`), here);
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
