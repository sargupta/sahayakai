"use client";

import type { FC } from "react";
import { useLibraryId } from "@/hooks/use-library-id";
import type { VirtualFieldTripOutput } from "@/ai/flows/virtual-field-trip";
import Link from "next/link";
import { Button } from "./ui/button";
import { Globe2, Lightbulb, MessageCircleQuestion, Landmark, GraduationCap, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { ResultShell } from "@/components/ui/result-shell";
import { QuickShareButton } from "@/components/quick-share-button";
import { exportElementToPdf } from "@/lib/export-pdf";
import { getResultShellDict } from "@/lib/result-shell-i18n";
import { buildArtifactActions, omit, OMIT_REASONS } from "@/lib/artifact-actions";

type VirtualFieldTripDisplayProps = {
    trip: VirtualFieldTripOutput;
    topic: string;
    gradeLevel?: string;
    language?: string;
    /** Library id of this artifact (useGenerator().contentId); Save upserts it. */
    contentId?: string | null;
    /** Re-run the generator with the same inputs; absent when viewing a saved artifact. */
    onRegenerate?: () => void;
};

const PDF_ID = "field-trip-card";

/**
 * The trip reads as an itinerary: a route strip (stop 1 → 2 → 3 …) for the
 * whole journey at a glance, then a numbered timeline — one card per stop with
 * its context and teaching purpose, a fact to share, a question to ask, and the
 * Google Earth link as the stop's main action. Token colours only.
 */
export const VirtualFieldTripDisplay: FC<VirtualFieldTripDisplayProps> = ({
    trip,
    contentId,
    topic,
    gradeLevel,
    language,
    onRegenerate,
}) => {
    const { toast } = useToast();
    const libraryId = useLibraryId(contentId, trip);
    const t = getResultShellDict(language);

    const handleSave = async () => {
        try {
            const { auth } = await import("@/lib/firebase");
            const user = auth.currentUser;
            if (!user) {
                toast({
                    title: t.loginRequiredTitle,
                    description: t.loginRequiredDesc,
                    variant: "destructive",
                });
                return;
            }
            const token = await user.getIdToken();
            const payload = {
                id: libraryId,
                type: "virtual-field-trip",
                title: trip.title,
                gradeLevel: trip.gradeLevel || gradeLevel || "Class 5",
                subject: trip.subject || "Geography",
                topic,
                language: language || "English",
                isPublic: false,
                isDraft: false,
                data: trip,
            };
            const response = await fetch("/api/content/save", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error("Server rejected save");
            toast({ title: t.savedTitle, description: t.savedDesc });
        } catch {
            toast({
                title: t.saveFailedTitle,
                description: t.saveFailedDesc,
                variant: "destructive",
            });
        }
    };

    const handleDownload = async () => {
        toast({ title: t.pdfPreparingTitle, description: t.pdfPreparingDesc });
        const res = await exportElementToPdf({
            elementId: PDF_ID,
            filename: `Sahayak_FieldTrip_${(trip.title || topic).substring(0, 20)}.pdf`,
        });
        toast(
            res.ok
                ? { title: t.pdfDoneTitle, description: t.pdfDoneDesc }
                : {
                      title: t.pdfFailedTitle,
                      description: t.pdfFailedDesc,
                      variant: "destructive",
                  },
        );
    };

    const meta = [trip.gradeLevel || gradeLevel, trip.subject].filter(Boolean) as string[];

    return (
        <ResultShell
            id={PDF_ID}
            title={trip.title}
            icon={<Globe2 />}
            size="compact"
            variant="glass"
            actions={buildArtifactActions(
                {
                    copy: omit(OMIT_REASONS.TODO_NEEDS_SERIALISER),
                    save: { onClick: handleSave },
                    download: { onClick: handleDownload },
                    share: omit(OMIT_REASONS.VIA_QUICK_SHARE),
                    regenerate: onRegenerate
                        ? { onClick: onRegenerate }
                        : omit(OMIT_REASONS.NO_GENERATOR),
                    edit: omit(OMIT_REASONS.NOT_EDITABLE),
                },
                t,
            )}
            extraActions={
                <QuickShareButton
                    contentType="virtual-field-trip"
                    onSave={handleSave}
                />
            }
            footer={
                <FeedbackDialog
                    page="virtual-field-trip"
                    feature="virtual-field-trip-result"
                    context={{ title: trip.title }}
                />
            }
        >
            <div className="space-y-6">
                {/* The whole journey at a glance. */}
                <div className="rounded-xl border border-primary/15 bg-gradient-to-r from-primary/10 to-transparent p-4">
                    {meta.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                            {meta.map((m) => (
                                <span
                                    key={m}
                                    className="inline-flex items-center rounded-full border border-primary/20 bg-card px-3 py-1 text-xs font-medium text-primary"
                                >
                                    {m}
                                </span>
                            ))}
                        </div>
                    )}
                    <ol className="flex items-center gap-2 overflow-x-auto pb-1" data-testid="vft-route">
                        {trip.stops.map((stop, index) => (
                            <li key={index} className="flex shrink-0 items-center gap-2">
                                <a
                                    href={`#vft-stop-${index + 1}`}
                                    className="inline-flex max-w-48 items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-soft transition-colors hover:border-primary/40 hover:text-primary"
                                >
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                        {index + 1}
                                    </span>
                                    <span className="truncate">{stop.name}</span>
                                </a>
                                {index < trip.stops.length - 1 && (
                                    <span aria-hidden="true" className="h-0 w-6 border-t-2 border-dashed border-primary/30" />
                                )}
                            </li>
                        ))}
                    </ol>
                </div>

                {/* Itinerary timeline. */}
                <ol className="relative space-y-6">
                    {trip.stops.map((stop, index) => (
                        <li
                            key={index}
                            id={`vft-stop-${index + 1}`}
                            className="relative scroll-mt-24 pl-12 sm:pl-14"
                        >
                            {/* Connector to the next stop. */}
                            {index < trip.stops.length - 1 && (
                                <span
                                    aria-hidden="true"
                                    className="absolute left-4 top-10 -bottom-6 border-l-2 border-dashed border-primary/25 sm:left-5"
                                />
                            )}
                            <span className="absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-elevated ring-4 ring-primary/10 sm:h-10 sm:w-10">
                                {index + 1}
                            </span>

                            <article className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
                                <div className="space-y-2 border-b border-border/60 bg-gradient-to-r from-primary/5 to-transparent p-4 sm:p-6">
                                    <h3 className="font-headline text-lg font-bold leading-snug break-words sm:text-xl">
                                        {stop.name}
                                    </h3>
                                    <p className="text-sm leading-relaxed text-foreground/80">
                                        {stop.description}
                                    </p>
                                </div>

                                <div className="space-y-4 p-4 sm:p-6">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-lg border border-border bg-muted/30 p-3">
                                            <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                                                <Landmark className="h-4 w-4" />
                                                {t.contextLabel}
                                            </p>
                                            <p className="text-sm leading-relaxed">{stop.culturalAnalogy}</p>
                                        </div>
                                        <div className="rounded-lg border border-border bg-muted/30 p-3">
                                            <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                                                <GraduationCap className="h-4 w-4" />
                                                {t.pedagogyLabel}
                                            </p>
                                            <p className="text-sm leading-relaxed">{stop.explanation}</p>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
                                            <Lightbulb className="mt-1 h-4 w-4 shrink-0 text-warning" />
                                            <p className="text-sm leading-relaxed">
                                                <strong className="font-semibold">{t.factLabel}:</strong>{" "}
                                                {stop.educationalFact}
                                            </p>
                                        </div>
                                        <div className="flex gap-3 rounded-lg border border-info/30 bg-info/10 p-3">
                                            <MessageCircleQuestion className="mt-1 h-4 w-4 shrink-0 text-info" />
                                            <p className="text-sm italic leading-relaxed">
                                                <strong className="font-semibold not-italic">{t.askLabel}:</strong>{" "}
                                                {stop.reflectionPrompt}
                                            </p>
                                        </div>
                                    </div>

                                    <Button asChild size="sm" className="w-full rounded-full sm:w-auto">
                                        <Link
                                            href={stop.googleEarthUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <Globe2 className="mr-2 h-4 w-4" />
                                            {t.visitOnGoogleEarth}
                                            <ExternalLink className="ml-2 h-3 w-3 opacity-70" />
                                        </Link>
                                    </Button>
                                </div>
                            </article>
                        </li>
                    ))}
                </ol>
            </div>
        </ResultShell>
    );
};
