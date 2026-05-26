"use client";

import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Clock, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/context/language-context";

export function SampleOutputSection() {
    const { t } = useLanguage();
    return (
        <div className="w-full max-w-2xl">
            <p className="text-center text-sm text-muted-foreground mb-3">
                {t("Here is what SahayakAI generates in seconds")}
            </p>
            <Card className="border border-border/60 shadow-soft bg-card/80">
                <CardContent className="p-4 md:p-6 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-primary" />
                            <span className="font-headline font-semibold text-sm">{t("Lesson Plan: Photosynthesis")}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{t("Generated in 30s")}</span>
                        </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                        {t("Class 8 Science | CBSE | 40 minutes")}
                    </div>

                    <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                            <div>
                                <span className="font-medium">{t("Engage (5 min):")}</span>{" "}
                                <span className="text-muted-foreground">{t("Show a wilting plant vs healthy plant. Ask: What does the healthy plant have that the wilting one doesn't?")}</span>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                            <div>
                                <span className="font-medium">{t("Explore (10 min):")}</span>{" "}
                                <span className="text-muted-foreground">{t("Students test starch presence in leaves kept in dark vs sunlight using iodine...")}</span>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                            <div>
                                <span className="font-medium">{t("Explain (15 min):")}</span>{" "}
                                <span className="text-muted-foreground">{t("Board diagram of light reaction. Key vocabulary: chlorophyll, stomata, glucose...")}</span>
                            </div>
                        </div>
                    </div>

                    <div className="border-t pt-2 text-xs text-muted-foreground italic">
                        {t("Complete with assessment rubric, homework, and NCERT alignment")}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
