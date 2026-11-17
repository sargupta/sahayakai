"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2, PhoneCall } from "lucide-react";
import { PageShell, SectionCard } from "@/components/layout";
import { SamparkAuthGate } from "@/components/sampark/sampark-auth-gate";
import { ErrorPanel, LoadingBlock, errorMessage } from "@/components/sampark/states";
import { StatusPill } from "@/components/sampark/status-pill";
import { useSamparkQuery } from "@/components/sampark/use-sampark-query";
import { SamparkFrame } from "@/components/sampark/workspace-frame";
import { useSamparkHref } from "@/components/shell/product-paths";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { chooseProvider, getProviderChoice } from "@/lib/api/sampark";
import { samparkEntryPath } from "@/lib/products";
import { PROVIDER_LABEL, safeNext, type ProviderChoice } from "@/lib/sampark/provider-choice";
import { cn } from "@/lib/utils";

/**
 * The SahayakAI → SamparkAI boundary: choose the calling provider, then enter the ONE SamparkAI.
 * Nothing is pre-selected and nothing happens until a card is clicked. The choice is stored by
 * the server for this browser session and decides which backend places Riya's calls; the
 * SamparkAI screens are the same either way.
 */
function ChooserContent() {
    const { t } = useLanguage();
    const { toast } = useToast();
    const router = useRouter();
    const params = useSearchParams();
    const samparkHref = useSamparkHref();
    const next = safeNext(params.get("next"), samparkHref(samparkEntryPath()));
    const state = useSamparkQuery((signal) => getProviderChoice({ signal }), []);
    const [busy, setBusy] = useState<ProviderChoice | null>(null);

    const pick = async (provider: ProviderChoice) => {
        setBusy(provider);
        try {
            await chooseProvider(provider);
            router.replace(next);
        } catch (err) {
            toast({ title: t("Could not choose the calling provider"), description: errorMessage(t, err), variant: "destructive" });
            setBusy(null);
        }
    };

    const description: Record<ProviderChoice, string> = {
        elevenlabs: t("Calls run on the existing ElevenLabs voice agent."),
        vobiz: t("Calls run on SahayakAI's own voice bridge: Vobiz phone line with Gemini Live."),
    };

    return (
        <PageShell
            title={t("Choose how SamparkAI places calls")}
            description={t("Pick the calling provider for this visit. SamparkAI looks and works the same with either; only the service that holds Riya's calls changes. You can switch at any time from inside SamparkAI.")}
        >
            {state.error && <ErrorPanel error={state.error} onRetry={state.reload} />}
            {!state.data && !state.error && <LoadingBlock rows={2} />}
            {state.data && (
                <SectionCard icon={PhoneCall} title={t("Calling provider")}>
                    <ul aria-label={t("Calling provider")} className="grid gap-4 md:grid-cols-2">
                        {state.data.options.map((o) => {
                            const last = state.data?.choice === o.id;
                            return (
                                <li key={o.id}>
                                    <button
                                        type="button"
                                        disabled={!o.available || busy !== null}
                                        onClick={() => void pick(o.id)}
                                        data-testid={`choose-${o.id}`}
                                        className={cn(
                                            "focus-ring flex h-full w-full flex-col items-start gap-2 rounded-surface-md border p-5 text-left transition-colors",
                                            o.available ? "border-border bg-card hover:border-primary hover:bg-primary/5" : "cursor-not-allowed border-border bg-muted/30 opacity-70",
                                        )}
                                    >
                                        <span className="flex w-full flex-wrap items-center gap-2">
                                            <span className="type-body font-semibold text-foreground">{PROVIDER_LABEL[o.id]}</span>
                                            {last && <StatusPill tone="neutral">{t("Used last")}</StatusPill>}
                                            {!o.available && <StatusPill tone="neutral">{t("Not set up on this deployment")}</StatusPill>}
                                        </span>
                                        <span className="type-body text-muted-foreground">{description[o.id]}</span>
                                        <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-medium text-primary">
                                            {busy === o.id ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Check aria-hidden="true" className="h-4 w-4" />}
                                            {o.available ? `${t("Continue with")} ${PROVIDER_LABEL[o.id]}` : t("Unavailable")}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </SectionCard>
            )}
        </PageShell>
    );
}

export default function ChooseProviderPage() {
    const { t } = useLanguage();
    return (
        <SamparkFrame>
            <SamparkAuthGate
                icon={PhoneCall}
                title={t("School calls")}
                description={t("Sign in with your school administrator account to manage calls to parents.")}
            >
                <Suspense fallback={<LoadingBlock rows={2} />}>
                    <ChooserContent />
                </Suspense>
            </SamparkAuthGate>
        </SamparkFrame>
    );
}
