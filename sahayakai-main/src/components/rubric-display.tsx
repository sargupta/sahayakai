"use client";

import type { FC } from "react";
import type { RubricGeneratorOutput } from "@/ai/flows/rubric-generator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Download, Save, Copy, ClipboardCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { ResultShell } from "@/components/ui/result-shell";
import { exportElementToPdf } from "@/lib/export-pdf";
import { getResultShellDict } from "@/lib/result-shell-i18n";

type RubricDisplayProps = {
    rubric: RubricGeneratorOutput;
    selectedLanguage?: string;
};

const PDF_ID = "rubric-pdf";

export const RubricDisplay: FC<RubricDisplayProps> = ({
    rubric,
    selectedLanguage,
}) => {
    const { toast } = useToast();
    const t = getResultShellDict(selectedLanguage);

    if (!rubric || !rubric.criteria || rubric.criteria.length === 0) {
        return null;
    }

    const handleDownload = async () => {
        toast({ title: t.pdfPreparingTitle, description: t.pdfPreparingDesc });
        const res = await exportElementToPdf({
            elementId: PDF_ID,
            filename: `Sahayak_Rubric_${rubric.title || "Rubric"}.pdf`,
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
                type: "rubric",
                title: rubric.title,
                gradeLevel: rubric.gradeLevel || "Class 5",
                subject: rubric.subject || "General",
                topic: rubric.title,
                language: selectedLanguage || "en",
                isPublic: false,
                isDraft: false,
                data: rubric,
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

    const handleCopy = () => {
        const rubricText = `
${rubric.title}
${rubric.description}

${rubric.criteria
    .map(
        (criterion, idx) => `
${idx + 1}. ${criterion.name}
   ${criterion.description}

   Performance Levels:
${criterion.levels
    .map(
        (level) =>
            `   • ${level.name} (${level.points} pts): ${level.description}`,
    )
    .join("\n")}
`,
    )
    .join("\n")}
        `.trim();
        navigator.clipboard.writeText(rubricText);
        toast({ title: t.copiedTitle, description: t.copiedDesc });
    };

    const performanceLevels =
        rubric.criteria[0]?.levels.map((level) => ({
            name: level.name.replace(/\s*\(\d+\s*pts\)/, ""),
            points: level.points,
        })) || [];

    return (
        <ResultShell
            id={PDF_ID}
            title={rubric.title}
            description={rubric.description}
            icon={<ClipboardCheck />}
            actions={[
                { label: t.copy, icon: <Copy />, onClick: handleCopy },
                { label: t.save, icon: <Save />, onClick: handleSave },
                { label: t.pdf, icon: <Download />, onClick: handleDownload },
            ]}
            footer={
                <FeedbackDialog
                    page="rubric"
                    feature="rubric-result"
                    context={{ title: rubric.title }}
                />
            }
        >
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                <Table className="min-w-full border-collapse border border-primary/20">
                    <TableHeader className="bg-primary/10">
                        <TableRow>
                            <TableHead className="w-[25%] border border-primary/20 p-2 font-headline text-primary-foreground bg-primary">
                                {t.criteria}
                            </TableHead>
                            {performanceLevels.map((level) => (
                                <TableHead
                                    key={level.name}
                                    className="w-[18.75%] border border-primary/20 p-2 text-center font-headline text-primary-foreground bg-primary"
                                >
                                    {level.name} ({level.points} pts)
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rubric.criteria.map((criterion, ci) => (
                            <TableRow key={ci} className="bg-white/50">
                                <TableCell className="border border-primary/20 p-2 align-top">
                                    <p className="font-bold">
                                        {criterion.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {criterion.description}
                                    </p>
                                </TableCell>
                                {criterion.levels.map((level, li) => (
                                    <TableCell
                                        key={li}
                                        className="border border-primary/20 p-2 text-sm align-top"
                                    >
                                        {level.description}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </ResultShell>
    );
};
