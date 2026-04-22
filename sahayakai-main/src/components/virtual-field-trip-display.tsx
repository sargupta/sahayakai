"use client";

import type { FC } from "react";
import type { VirtualFieldTripOutput } from "@/ai/flows/virtual-field-trip";
import Link from "next/link";
import { Button } from "./ui/button";
import { Save, Download, Globe2, MapPin, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { ResultShell } from "@/components/ui/result-shell";
import { exportElementToPdf } from "@/lib/export-pdf";
import { getResultShellDict } from "@/lib/result-shell-i18n";

type VirtualFieldTripDisplayProps = {
    trip: VirtualFieldTripOutput;
    topic: string;
    gradeLevel?: string;
    language?: string;
};

const PDF_ID = "field-trip-card";

export const VirtualFieldTripDisplay: FC<VirtualFieldTripDisplayProps> = ({
    trip,
    topic,
    gradeLevel,
    language,
}) => {
    const { toast } = useToast();
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
                id: crypto.randomUUID(),
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

    return (
        <ResultShell
            id={PDF_ID}
            title={trip.title}
            icon={<Globe2 />}
            className="max-w-2xl"
            actions={[
                { label: t.save, icon: <Save />, onClick: handleSave },
                { label: t.pdf, icon: <Download />, onClick: handleDownload },
            ]}
            footer={
                <FeedbackDialog
                    page="virtual-field-trip"
                    feature="virtual-field-trip-result"
                    context={{ title: trip.title }}
                />
            }
        >
            <div className="space-y-4">
                {trip.stops.map((stop, index) => (
                    <div
                        key={index}
                        className="flex gap-3 items-start p-3 sm:p-4 rounded-lg bg-accent/20 border border-primary/10"
                    >
                        <div className="flex-shrink-0">
                            <MapPin className="h-7 w-7 text-primary" />
                        </div>
                        <div className="flex-grow min-w-0 space-y-2">
                            <h3 className="font-bold text-base sm:text-lg break-words">
                                {stop.name}
                            </h3>
                            <p className="text-sm text-foreground/80">
                                {stop.description}
                            </p>

                            <div className="bg-white/60 p-3 rounded-lg text-xs space-y-2 border border-primary/5">
                                <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                                    <strong className="text-primary/80 flex-shrink-0">
                                        Context:
                                    </strong>
                                    <span>{stop.culturalAnalogy}</span>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 border-t border-primary/5 pt-2">
                                    <strong className="text-primary/80 flex-shrink-0">
                                        Pedagogy:
                                    </strong>
                                    <span>{stop.explanation}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="bg-white/50 p-2 rounded text-xs">
                                    <strong>Fact:</strong>{" "}
                                    {stop.educationalFact}
                                </div>
                                <div className="bg-white/50 p-2 rounded text-xs italic">
                                    <strong>Ask:</strong>{" "}
                                    {stop.reflectionPrompt}
                                </div>
                            </div>

                            <div className="pt-2">
                                <Button
                                    asChild
                                    size="sm"
                                    variant="outline"
                                    className="w-full sm:w-auto"
                                >
                                    <Link
                                        href={stop.googleEarthUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <Send className="mr-2 h-4 w-4" />
                                        Visit on Google Earth
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </ResultShell>
    );
};
