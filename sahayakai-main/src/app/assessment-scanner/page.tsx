"use client";

/**
 * Assessment Scanner — Phase 1 MVP page.
 *
 * Teacher photographs / uploads ONE page of a student's MATH answer sheet,
 * picks subject (locked to Mathematics in Phase 1), grade, and language, then
 * the AI extracts questions + handwritten answers, scores them, and surfaces
 * per-question feedback.
 *
 * Phase-1 scope: 1 page, Mathematics only, no student/class roster yet.
 * Multi-page + non-math + roster integration land in Phase 2 (see plan file
 * at .claude/plans/intending-to-build-a-modular-naur.md).
 */

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { LanguageSelector } from "@/components/language-selector";
import { ImageUploader } from "@/components/image-uploader";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { auth } from "@/lib/firebase";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    AlertCircle,
    CheckCircle2,
    Info,
    Loader2,
    ScanLine,
    XCircle,
} from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import type { AssessmentScannerOutput } from "@/ai/schemas/assessment-scanner-schemas";

const formSchema = z.object({
    pageUrl: z.string().min(1, { message: "Upload a photo of the answer page first." }),
    gradeLevel: z.string().min(1, { message: "Pick a class." }),
    language: z.string().min(1),
});

type FormValues = z.infer<typeof formSchema>;

// PHASE-1 SCOPE: locked to Mathematics. Lifting this in Phase 2.
const PHASE_1_SUBJECT = "Mathematics";

export default function AssessmentScannerPage() {
    const { user, requireAuth, openAuthModal } = useAuth();
    const { t } = useLanguage();
    const { toast } = useToast();

    const [result, setResult] = useState<AssessmentScannerOutput | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const submittingRef = useRef(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            pageUrl: "",
            gradeLevel: "Class 10",
            language: "English",
        },
    });

    const selectedLanguage = form.watch("language") || "English";

    const onSubmit = async (values: FormValues) => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        if (!requireAuth()) {
            submittingRef.current = false;
            return;
        }
        setIsLoading(true);
        setResult(null);

        try {
            const token = await user?.getIdToken();
            const res = await fetch("/api/ai/assessment-scanner", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    assessmentId: uuidv4(),
                    subject: PHASE_1_SUBJECT,
                    gradeLevel: values.gradeLevel,
                    language: values.language,
                    pageUrls: [values.pageUrl],
                }),
            });

            if (!res.ok) {
                if (res.status === 401) {
                    openAuthModal();
                    throw new Error(t("Please sign in to grade assessments"));
                }
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || errorData.error || t("Failed to grade assessment"));
            }

            const data = (await res.json()) as AssessmentScannerOutput;
            setResult(data);
        } catch (error) {
            console.error("Assessment scan failed:", error);
            toast({
                title: t("Scan Failed"),
                description: error instanceof Error ? error.message : t("Please try again"),
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
            submittingRef.current = false;
        }
    };

    return (
        <div className="flex flex-col items-center gap-8 w-full max-w-4xl mx-auto pb-16">
            <Card className="w-full bg-card border border-border shadow-soft rounded-2xl overflow-hidden">
                <div className="card-accent-bar" />
                <CardHeader className="text-center">
                    <div className="flex justify-center items-center mb-4">
                        <ScanLine className="w-12 h-12 text-primary" />
                    </div>
                    <CardTitle className="font-headline text-2xl sm:text-3xl">
                        {t("Assessment Scanner")}
                    </CardTitle>
                    <CardDescription>
                        {t("Photograph a student's answer page. AI reads the work, scores it, and gives per-question feedback.")}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert className="mb-6 border-primary/30 bg-primary/5">
                        <Info className="h-4 w-4" />
                        <AlertTitle>{t("Phase 1 Preview")}</AlertTitle>
                        <AlertDescription>
                            {t("This is the first version. Currently supports: Mathematics, single page. Multi-page and other subjects ship in Phase 2.")}
                        </AlertDescription>
                    </Alert>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="pageUrl"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-headline">
                                            {t("Student answer page")}
                                        </FormLabel>
                                        <FormControl>
                                            <ImageUploader
                                                onImageUpload={field.onChange}
                                                language={selectedLanguage.slice(0, 2).toLowerCase()}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-border/30 pt-4 mt-2">
                                <FormItem>
                                    <FormLabel className="font-headline text-xs font-semibold text-muted-foreground">
                                        {t("Subject")}
                                    </FormLabel>
                                    <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
                                        {PHASE_1_SUBJECT}
                                        <Badge variant="secondary" className="ml-auto text-[10px]">
                                            {t("Phase 1")}
                                        </Badge>
                                    </div>
                                </FormItem>
                                <FormField
                                    control={form.control}
                                    name="gradeLevel"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-headline text-xs font-semibold text-muted-foreground">
                                                {t("Class")}
                                            </FormLabel>
                                            <FormControl>
                                                <GradeLevelSelector
                                                    value={field.value ? [field.value] : []}
                                                    onValueChange={(values) => field.onChange(values?.[0])}
                                                    language={selectedLanguage}
                                                    isMulti={false}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="language"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-headline text-xs font-semibold text-muted-foreground">
                                                {t("Feedback language")}
                                            </FormLabel>
                                            <FormControl>
                                                <LanguageSelector
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                size="lg"
                                disabled={isLoading || !form.watch("pageUrl")}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t("Grading...")}
                                    </>
                                ) : (
                                    <>
                                        <ScanLine className="mr-2 h-4 w-4" />
                                        {t("Grade this page")}
                                    </>
                                )}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {isLoading && (
                <Card className="w-full">
                    <CardHeader>
                        <Skeleton className="h-6 w-1/3" />
                        <Skeleton className="h-4 w-2/3" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </CardContent>
                </Card>
            )}

            {result && <AssessmentResult result={result} />}
        </div>
    );
}

function AssessmentResult({ result }: { result: AssessmentScannerOutput }) {
    const { t } = useLanguage();
    const isFailed = result.status === "failed";
    const isPartial = result.status === "partial";

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <CardTitle className="font-headline text-xl flex items-center gap-2">
                            {t("Result")}
                            {result.status === "graded" && (
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                            )}
                            {isPartial && <AlertCircle className="w-5 h-5 text-amber-600" />}
                            {isFailed && <XCircle className="w-5 h-5 text-destructive" />}
                        </CardTitle>
                        <CardDescription>
                            {result.questions.length}{" "}
                            {result.questions.length === 1 ? t("question") : t("questions")} ·{" "}
                            {result.pageCount}{" "}
                            {result.pageCount === 1 ? t("page") : t("pages")}
                        </CardDescription>
                    </div>
                    {!isFailed && (
                        <div className="text-right">
                            <div className="text-3xl font-bold tabular-nums">
                                {result.scorePct.toFixed(0)}%
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {result.totalAwardedMarks.toFixed(1)} / {result.totalMaxMarks}{" "}
                                {t("marks")} · {result.letterGrade}
                            </div>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {result.imageQualityWarnings.length > 0 && (
                    <Alert variant="default" className="border-amber-500/50 bg-amber-500/5">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>{t("Image quality")}</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-4 space-y-1 text-xs">
                                {result.imageQualityWarnings.map((w, i) => (
                                    <li key={i}>{w}</li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}

                {result.needsReviewCount > 0 && (
                    <Alert variant="default" className="border-amber-500/50 bg-amber-500/5">
                        <Info className="h-4 w-4" />
                        <AlertTitle>{t("Teacher review suggested")}</AlertTitle>
                        <AlertDescription>
                            {result.needsReviewCount === 1
                                ? t("1 question is uncertain. Please verify.")
                                : `${result.needsReviewCount} ${t("questions are uncertain. Please verify.")}`}
                        </AlertDescription>
                    </Alert>
                )}

                {result.questions.length > 0 && (
                    <Accordion type="multiple" className="w-full">
                        {result.questions.map((q, i) => {
                            const pct = q.marksMax > 0 ? (q.marksAwarded / q.marksMax) * 100 : 0;
                            const tone =
                                pct >= 80
                                    ? "text-green-600"
                                    : pct >= 50
                                      ? "text-amber-600"
                                      : "text-destructive";
                            return (
                                <AccordionItem key={q.questionId} value={q.questionId}>
                                    <AccordionTrigger className="hover:no-underline">
                                        <div className="flex items-start justify-between w-full pr-4 gap-4 text-left">
                                            <span className="font-medium text-sm flex-1 line-clamp-2">
                                                Q{i + 1}. {q.questionText}
                                            </span>
                                            <span className={`tabular-nums text-sm font-semibold ${tone}`}>
                                                {q.marksAwarded.toFixed(1)} / {q.marksMax}
                                            </span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-3 text-sm">
                                        {q.needsTeacherReview && (
                                            <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
                                                {t("Needs review")}
                                            </Badge>
                                        )}
                                        <div>
                                            <div className="text-xs font-semibold text-muted-foreground mb-1">
                                                {t("Student wrote")}
                                            </div>
                                            <div className="rounded-md bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap">
                                                {q.studentAnswer || `(${t("no answer written")})`}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs font-semibold text-muted-foreground mb-1">
                                                {t("Expected")}
                                            </div>
                                            <div className="rounded-md bg-muted/20 p-3 font-mono text-xs whitespace-pre-wrap">
                                                {q.expectedAnswer}
                                            </div>
                                        </div>
                                        {q.partialCreditBreakdown.length > 0 && (
                                            <div>
                                                <div className="text-xs font-semibold text-muted-foreground mb-1">
                                                    {t("Marks breakdown")}
                                                </div>
                                                <ul className="text-xs space-y-1">
                                                    {q.partialCreditBreakdown.map((s, j) => (
                                                        <li key={j} className="flex justify-between gap-4">
                                                            <span>{s.step}</span>
                                                            <span className="tabular-nums font-medium">
                                                                {s.earned} / {s.max}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        <div>
                                            <div className="text-xs font-semibold text-muted-foreground mb-1">
                                                {t("Feedback")}
                                            </div>
                                            <p className="text-sm">{q.feedback}</p>
                                        </div>
                                        {q.studentFacingFeedback && (
                                            <div>
                                                <div className="text-xs font-semibold text-muted-foreground mb-1">
                                                    {t("For the student")}
                                                </div>
                                                <p className="text-sm italic">{q.studentFacingFeedback}</p>
                                            </div>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                )}

                {result.recommendedNextSteps.length > 0 && (
                    <div className="border-t border-border/30 pt-4">
                        <h3 className="font-headline text-sm font-semibold mb-2">
                            {t("Next steps for the teacher")}
                        </h3>
                        <ul className="list-disc pl-5 text-sm space-y-1">
                            {result.recommendedNextSteps.map((step, i) => (
                                <li key={i}>{step}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {result.studentRecommendations.length > 0 && (
                    <div className="border-t border-border/30 pt-4">
                        <h3 className="font-headline text-sm font-semibold mb-2">
                            {t("For the student")}
                        </h3>
                        <ul className="list-disc pl-5 text-sm space-y-1">
                            {result.studentRecommendations.map((step, i) => (
                                <li key={i}>{step}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
