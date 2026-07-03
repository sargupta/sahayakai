"use client";

/**
 * ExamPaperView — composes the auth gate, GeneratorPage shell, config
 * form and paper preview. Decomposed from the 900-line pre-migration
 * src/app/exam-paper/page.tsx.
 */

import { AlertCircle, FileText, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareToCommunityCTA } from "@/components/share-to-community-cta";
import { useLanguage } from "@/context/language-context";
import { GeneratorPage } from "@/features/generator";
import { useExamPaper } from "../hooks/use-exam-paper";
import { ExamPaperForm } from "./exam-paper-form";
import { ExamPaperPreview } from "./exam-paper-preview";

type ExamPaperViewProps = ReturnType<typeof useExamPaper>;

/** Shape-matched loading skeleton shown under the progress hint. */
function PaperSkeleton() {
    return (
        <div className="space-y-4 text-left">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <div className="space-y-3 pt-4">
                {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                ))}
            </div>
        </div>
    );
}

export function ExamPaperView(props: ExamPaperViewProps) {
    const { t } = useLanguage();
    const {
        authed,
        authLoading,
        status,
        paper,
        limitState,
        includeAnswerKey,
        includeMarkingScheme,
        handleSave,
        saving,
        saved,
    } = props;

    // ── Auth loading / gate ────────────────────────────────────────────────
    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!authed) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4">
                <AlertCircle className="w-12 h-12 text-muted-foreground" />
                <p className="text-muted-foreground text-center">
                    {t("Please log in to generate exam papers.")}
                </p>
            </div>
        );
    }

    return (
        <GeneratorPage
            icon={FileText}
            title={t("Board Exam Paper Generator")}
            description={t("Generate board-pattern question papers with answer keys")}
            feature="exam-paper"
            limitState={limitState}
            width="default"
            status={status}
            progressMessages={[t("Generating your exam paper...")]}
            progressSkeleton={<PaperSkeleton />}
            result={
                paper && (
                    <ExamPaperPreview
                        paper={paper}
                        includeAnswerKey={includeAnswerKey}
                        includeMarkingScheme={includeMarkingScheme}
                        onSave={handleSave}
                        saving={saving}
                        saved={saved}
                    />
                )
            }
            afterResult={<ShareToCommunityCTA contentType="exam-paper" className="mt-3" />}
            form={<ExamPaperForm {...props} />}
        />
    );
}
