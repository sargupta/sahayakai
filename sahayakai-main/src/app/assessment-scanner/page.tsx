"use client";

/**
 * Assessment Scanner — Phase 2.
 *
 * Teacher photographs / uploads up to ASSESSMENT_DEMO_PAGE_CAP pages of a
 * student's answer sheet, picks subject + grade + language, then the AI
 * extracts questions + handwritten answers, scores them subject-aware, and
 * surfaces per-question feedback.
 *
 * Scope:
 *   - Subjects: Mathematics (best-in-class), Science, EVS, Social Science
 *     (History / Geography / Civics), Hindi, English, plus "Other".
 *   - Pages: up to ASSESSMENT_DEMO_PAGE_CAP per scan (currently 3); schema
 *     ceiling is 15.
 *   - Multi-student rosters + class analytics land in Phase 3.
 */

import { AssessmentResultCard } from "@/components/assessment-scanner/assessment-result-card";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
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
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { LanguageSelector } from "@/components/language-selector";
import { ImageUploader } from "@/components/image-uploader";
import { renderPdfToImages, PdfRenderError } from "./pdf-to-images";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    AlertCircle,
    CheckCircle2,
    Info,
    Loader2,
    Plus,
    RefreshCw,
    ScanLine,
    Sparkles,
    X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import type { AssessmentScannerOutput } from "@/ai/schemas/assessment-scanner-schemas";
import {
    ASSESSMENT_DEMO_PAGE_CAP,
    ASSESSMENT_SUPPORTED_SUBJECTS,
} from "@/ai/schemas/assessment-scanner-constants";

const formSchema = z.object({
    pageUrls: z
        .array(z.string().min(1))
        .min(1, { message: "Upload at least one page." })
        .max(ASSESSMENT_DEMO_PAGE_CAP, {
            message: `Up to ${ASSESSMENT_DEMO_PAGE_CAP} pages per scan.`,
        }),
    subject: z.string().min(1, { message: "Pick a subject." }),
    gradeLevel: z.string().min(1, { message: "Pick a class." }),
    language: z.string().min(1),
});

type FormValues = z.infer<typeof formSchema>;

/**
 * Single source of truth for the scan request lifecycle. Replaces the old
 * result / isLoading / isLoadingSaved booleans so impossible combinations
 * (e.g. loading with a stale result still on screen) can't occur. The
 * react-hook-form field state stays separate — this models only the
 * network/result phase.
 *   - `origin` distinguishes a fresh scan (retryable in place) from opening a
 *     saved assessment via My Library (offer a link back, not a retry).
 */
type ScanState =
    | { kind: "idle" }
    | { kind: "loading"; origin: "scan" | "saved" }
    | { kind: "error"; origin: "scan" | "saved"; message: string }
    | {
          kind: "ready";
          result: AssessmentScannerOutput;
          meta: { subject?: string; gradeLevel?: string };
      };

export default function AssessmentScannerPage() {
    // useSearchParams (called by the inner component) needs a Suspense
    // boundary in Next 15 — otherwise prerendering of the page bails out.
    return (
        <Suspense fallback={null}>
            <AssessmentScannerPageInner />
        </Suspense>
    );
}

function AssessmentScannerPageInner() {
    const { user, loading: authLoading, requireAuth, openAuthModal } = useAuth();
    const { t, language: uiLanguage } = useLanguage();
    const searchParams = useSearchParams();
    const savedAssessmentId = searchParams?.get("id") ?? null;

    const [scan, setScan] = useState<ScanState>(
        savedAssessmentId
            ? { kind: "loading", origin: "saved" }
            : { kind: "idle" },
    );
    const submittingRef = useRef(false);

    // PDF upload: convert client-side to page images, then feed the normal
    // image pipeline. `pdfBusy` gates the control; `pdfNotice` surfaces a
    // page-cap / empty / error message.
    const [pdfBusy, setPdfBusy] = useState(false);
    const [pdfNotice, setPdfNotice] = useState<string | null>(null);

    // Derived flag for the submit control — the form owns its own field state;
    // this only reflects the request phase.
    const isLoading = scan.kind === "loading";

    // Time-of-day greeting, resolved client-side so the server/client clock
    // difference can't cause a hydration mismatch.
    const [greeting, setGreeting] = useState(() => t("Welcome"));
    useEffect(() => {
        const h = new Date().getHours();
        setGreeting(
            h >= 5 && h < 12
                ? t("Good morning")
                : h >= 12 && h < 17
                  ? t("Good afternoon")
                  : h >= 17 && h < 21
                    ? t("Good evening")
                    : t("Good night"),
        );
    }, [t]);
    const firstName = user?.displayName?.trim().split(/\s+/)[0] || t("Teacher");

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            pageUrls: [],
            subject: "Mathematics",
            gradeLevel: "Class 10",
            language: uiLanguage,
        },
    });

    // Re-open a previously-graded assessment when arriving via My Library.
    useEffect(() => {
        let cancelled = false;
        if (!savedAssessmentId) return;
        // Auth still resolving — keep the loading skeleton until it settles.
        if (authLoading) return;
        // Auth resolved but signed out: a saved link needs its owner. Surface an
        // actionable error + sign-in prompt instead of an endless skeleton.
        if (!user) {
            setScan({
                kind: "error",
                origin: "saved",
                message: t("Please sign in to open this saved assessment."),
            });
            openAuthModal();
            return;
        }
        setScan({ kind: "loading", origin: "saved" });
        (async () => {
            try {
                const token = await user.getIdToken();
                const res = await fetch(
                    `/api/content/get?id=${encodeURIComponent(savedAssessmentId)}`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    },
                );
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const json = await res.json();
                if (cancelled) return;
                const payload = json?.data as AssessmentScannerOutput | undefined;
                if (!payload || !Array.isArray(payload.questions)) {
                    throw new Error("malformed-assessment");
                }
                setScan({
                    kind: "ready",
                    result: payload,
                    meta: {
                        subject:
                            typeof json.subject === "string" ? json.subject : undefined,
                        gradeLevel:
                            typeof json.gradeLevel === "string"
                                ? json.gradeLevel
                                : undefined,
                    },
                });
            } catch (err) {
                console.error("[AssessmentScanner] failed to load saved", err);
                if (!cancelled) {
                    setScan({
                        kind: "error",
                        origin: "saved",
                        message: t(
                            "We couldn't open this assessment. It may have been deleted, or the link is out of date.",
                        ),
                    });
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [savedAssessmentId, user, authLoading, t, openAuthModal]);

    const selectedLanguage = form.watch("language") || "English";
    const pageUrls = form.watch("pageUrls") || [];
    const subject = form.watch("subject") || "Mathematics";
    const canAddMorePages = pageUrls.length < ASSESSMENT_DEMO_PAGE_CAP;

    const handleAddPage = (url: string) => {
        if (!url) return;
        const current = form.getValues("pageUrls") ?? [];
        if (current.length >= ASSESSMENT_DEMO_PAGE_CAP) return;
        form.setValue("pageUrls", [...current, url], {
            shouldValidate: true,
            shouldDirty: true,
        });
    };

    const handleRemovePage = (index: number) => {
        const current = form.getValues("pageUrls") ?? [];
        const next = current.filter((_, i) => i !== index);
        form.setValue("pageUrls", next, {
            shouldValidate: true,
            shouldDirty: true,
        });
    };

    const handlePdfUpload = async (file: File | null) => {
        if (!file) return;
        setPdfNotice(null);
        const current = form.getValues("pageUrls") ?? [];
        const remaining = ASSESSMENT_DEMO_PAGE_CAP - current.length;
        if (remaining <= 0) {
            setPdfNotice(
                t("Maximum pages reached — remove a page before adding PDF pages."),
            );
            return;
        }
        setPdfBusy(true);
        try {
            const { images, totalPages } = await renderPdfToImages(file, {
                maxPages: remaining,
            });
            if (images.length === 0) {
                setPdfNotice(t("This PDF has no readable pages to add."));
                return;
            }
            form.setValue("pageUrls", [...current, ...images], {
                shouldValidate: true,
                shouldDirty: true,
            });
            if (totalPages > images.length) {
                // Single parameterised string (not concatenated t() fragments) so
                // translations control word order. Placeholders filled via the
                // repo's {{token}} .replace() convention (t has no interpolation).
                setPdfNotice(
                    t(
                        "Added the first {{count}} of {{total}} PDF pages — the scan limit is {{cap}}. Run a second scan for the rest.",
                    )
                        .replace("{{count}}", String(images.length))
                        .replace("{{total}}", String(totalPages))
                        .replace("{{cap}}", String(ASSESSMENT_DEMO_PAGE_CAP)),
                );
            }
        } catch (err) {
            setPdfNotice(
                err instanceof PdfRenderError ? err.message : t("Could not read that PDF."),
            );
        } finally {
            setPdfBusy(false);
        }
    };

    const onSubmit = async (values: FormValues) => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        if (!requireAuth()) {
            submittingRef.current = false;
            return;
        }
        setScan({ kind: "loading", origin: "scan" });

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
                    subject: values.subject,
                    gradeLevel: values.gradeLevel,
                    language: values.language,
                    pageUrls: values.pageUrls,
                }),
            });

            if (!res.ok) {
                if (res.status === 401) {
                    openAuthModal();
                    throw new Error(t("Please sign in to grade assessments"));
                }
                const errorData = await res.json().catch(() => ({}));
                throw new Error(
                    errorData.message ||
                        errorData.error ||
                        t("Failed to grade assessment"),
                );
            }

            const data = (await res.json()) as AssessmentScannerOutput;
            setScan({
                kind: "ready",
                result: data,
                meta: { subject: values.subject, gradeLevel: values.gradeLevel },
            });
        } catch (error) {
            console.error("Assessment scan failed:", error);
            setScan({
                kind: "error",
                origin: "scan",
                message:
                    error instanceof Error ? error.message : t("Please try again"),
            });
        } finally {
            submittingRef.current = false;
        }
    };

    // "Try again" from the inline error re-submits the last form values. The
    // form still holds the uploaded pages + selections, so retry is one click.
    const handleRetry = () => {
        void form.handleSubmit(onSubmit)();
    };

    return (
        <div className="flex flex-col items-center gap-8 w-full max-w-4xl mx-auto pb-16">
            {/* Greeting header */}
            <div className="w-full flex items-center gap-3">
                <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <ScanLine className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                    <h1 className="font-headline text-2xl sm:text-3xl font-bold leading-tight">
                        {greeting}, {firstName} 👋
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t("Upload student answer pages and let AI do the grading for you.")}
                    </p>
                </div>
            </div>

            {/* Coverage notice — subjects supported + page cap */}
            <Alert className="w-full border-primary/30 bg-primary/5">
                <Info className="h-4 w-4" />
                <AlertTitle>
                    {t("Now supporting six subject families, up to 3 pages per scan")}
                </AlertTitle>
                <AlertDescription>
                    {t(
                        "Mathematics, Science, EVS, Social Science (History / Geography / Civics), Hindi, and English. Mathematics is best-in-class — other subjects are in pilot, so please review the AI's grades carefully.",
                    )}
                </AlertDescription>
            </Alert>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-5">
                    {/* Step 1 — upload */}
                    <Card className="w-full bg-card border border-border shadow-soft rounded-surface-lg overflow-hidden">
                        <div className="card-accent-bar" />
                        <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3 md:pb-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                                1
                            </span>
                            <CardTitle className="font-headline text-lg">
                                {t("Upload answer pages")}
                            </CardTitle>
                            <span className="ml-auto text-xs font-normal text-muted-foreground tabular-nums">
                                {pageUrls.length} / {ASSESSMENT_DEMO_PAGE_CAP}
                            </span>
                        </CardHeader>
                        <CardContent>
                            <FormField
                                control={form.control}
                                name="pageUrls"
                                render={() => (
                                    <FormItem>
                                        {pageUrls.length > 0 && (
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                                                {pageUrls.map((url, i) => (
                                                    <div
                                                        key={`${url}-${i}`}
                                                        className="relative group rounded-lg border border-border overflow-hidden bg-muted/20"
                                                    >
                                                        {/* Click to enlarge — object-contain so the whole
                                                            page is legible, not cropped. */}
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <button
                                                                    type="button"
                                                                    className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                                    aria-label={t("Enlarge page") + ` ${i + 1}`}
                                                                >
                                                                    <Image
                                                                        src={url}
                                                                        alt={t("Page") + ` ${i + 1}`}
                                                                        width={200}
                                                                        height={200}
                                                                        className="w-full h-32 object-contain"
                                                                        unoptimized
                                                                    />
                                                                </button>
                                                            </DialogTrigger>
                                                            <DialogContent className="max-w-3xl">
                                                                <DialogTitle className="sr-only">
                                                                    {t("Page")} {i + 1}
                                                                </DialogTitle>
                                                                <Image
                                                                    src={url}
                                                                    alt={t("Page") + ` ${i + 1}`}
                                                                    width={1200}
                                                                    height={1600}
                                                                    className="w-full h-auto max-h-[80vh] object-contain rounded-md"
                                                                    unoptimized
                                                                />
                                                            </DialogContent>
                                                        </Dialog>
                                                        <Badge
                                                            variant="secondary"
                                                            className="absolute top-1 left-1 text-xs z-10 pointer-events-none"
                                                        >
                                                            {t("Page")} {i + 1}
                                                        </Badge>
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="icon"
                                                            className="absolute top-1 right-1 h-7 w-7 z-10"
                                                            onClick={() => handleRemovePage(i)}
                                                            aria-label={t("Remove page") + ` ${i + 1}`}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {canAddMorePages ? (
                                            <FormControl>
                                                <ImageUploader
                                                    // key forces a fresh upload widget after each successful add so
                                                    // the preview thumbnail in ImageUploader resets to "drop a file"
                                                    key={`uploader-${pageUrls.length}`}
                                                    onImageUpload={handleAddPage}
                                                    // Same drop zone accepts a PDF — rendered to page images
                                                    // client-side, then fed into the normal image pipeline.
                                                    onPdfSelected={handlePdfUpload}
                                                    onAuthRequired={openAuthModal}
                                                    // Cap the longest edge at 2048px before grading: keeps
                                                    // handwriting legible for OCR but stops a full-res phone
                                                    // photo from making Pass 1 crawl (60-100s+ observed).
                                                    maxImageDimension={2048}
                                                />
                                            </FormControl>
                                        ) : (
                                            <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
                                                <Info className="h-4 w-4" />
                                                <AlertDescription>
                                                    {t(
                                                        "Maximum pages reached for this scan. Remove a page to add another, or run a second scan.",
                                                    )}
                                                </AlertDescription>
                                            </Alert>
                                        )}

                                        {pdfBusy && (
                                            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                {t("Reading PDF pages…")}
                                            </p>
                                        )}

                                        {pdfNotice && (
                                            <Alert
                                                variant="default"
                                                className="mt-3 border-amber-500/40 bg-amber-500/5"
                                            >
                                                <Info className="h-4 w-4" />
                                                <AlertDescription>{pdfNotice}</AlertDescription>
                                            </Alert>
                                        )}

                                        <p className="text-xs text-muted-foreground mt-2">
                                            {t("Supports JPG, PNG, WEBP, PDF")} · {t("Max")}{" "}
                                            {ASSESSMENT_DEMO_PAGE_CAP} {t("pages per scan")}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                            <Plus className="h-3 w-3" />
                                            {t("Add up to") + " " + ASSESSMENT_DEMO_PAGE_CAP + " " + t("pages — front + back, or 3 sides of a worksheet.")}
                                        </p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    {/* Step 2 — details */}
                    <Card className="w-full bg-card border border-border shadow-soft rounded-surface-lg overflow-hidden">
                        <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3 md:pb-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                                2
                            </span>
                            <CardTitle className="font-headline text-lg">
                                {t("Assessment details")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start">
                                <FormField
                                    control={form.control}
                                    name="subject"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-headline text-xs font-semibold text-muted-foreground">
                                                {t("Subject")}
                                            </FormLabel>
                                            <FormControl>
                                                <Select
                                                    value={field.value}
                                                    onValueChange={field.onChange}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={t("Select subject")} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {ASSESSMENT_SUPPORTED_SUBJECTS.map((s) => (
                                                            <SelectItem key={s} value={s}>
                                                                <span className="flex items-center justify-between gap-3 w-full">
                                                                    <span>{t(s)}</span>
                                                                    {s === "Mathematics" && (
                                                                        <Badge
                                                                            variant="secondary"
                                                                            className="text-xs px-1"
                                                                        >
                                                                            {t("Best")}
                                                                        </Badge>
                                                                    )}
                                                                </span>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
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
                                <FormItem>
                                    <FormLabel className="font-headline text-xs font-semibold text-muted-foreground">
                                        {t("Quality")}
                                        <Info
                                            aria-label={t("How reliable AI grading is for the selected subject. This is a status, not a setting.")}
                                            className="ml-1 inline h-3 w-3 align-text-top text-muted-foreground/70"
                                        />
                                    </FormLabel>
                                    <div
                                        role="status"
                                        className="flex h-10 items-center rounded-md bg-muted/40 px-3 text-xs text-muted-foreground"
                                    >
                                        {subject === "Mathematics" ? (
                                            <span className="flex items-center gap-1">
                                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                                                {t("Best-in-class")}
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1">
                                                <Info className="h-3 w-3 text-amber-600" />
                                                {t("Pilot — review grades")}
                                            </span>
                                        )}
                                    </div>
                                </FormItem>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Primary CTA */}
                    <div className="space-y-2">
                        <Button
                            type="submit"
                            size="lg"
                            disabled={isLoading || pageUrls.length === 0}
                            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-elevated hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-60 disabled:shadow-none"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    {t("Grading...")}
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2 h-5 w-5" />
                                    {t("Grade this assessment")}
                                </>
                            )}
                        </Button>
                        <p className="text-center text-xs text-muted-foreground">
                            {t("AI will review the work, score it, and provide feedback.")}
                        </p>
                    </div>
                </form>
            </Form>

            {scan.kind === "loading" && (
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

            {/* Scan failure — persistent, with one-click retry (pages preserved). */}
            {scan.kind === "error" && scan.origin === "scan" && (
                <Alert variant="destructive" className="w-full">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t("Scan failed")}</AlertTitle>
                    <AlertDescription className="space-y-3">
                        <p>{scan.message}</p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleRetry}
                        >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            {t("Try again")}
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {/* Saved-load failure — link back to the library, not a bare page. */}
            {scan.kind === "error" && scan.origin === "saved" && (
                <Alert className="w-full border-amber-500/40 bg-amber-500/5">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t("Couldn't open this assessment")}</AlertTitle>
                    <AlertDescription className="space-y-3">
                        <p>{scan.message}</p>
                        <Button asChild variant="outline" size="sm">
                            <Link href="/my-library">{t("Back to My Library")}</Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {scan.kind === "ready" && (
                <AssessmentResultCard
                    result={scan.result}
                    subject={scan.meta.subject}
                    gradeLevel={scan.meta.gradeLevel}
                    onResultUpdated={(next) =>
                        setScan((s) =>
                            s.kind === "ready" ? { ...s, result: next } : s,
                        )
                    }
                />
            )}

            {/* First-run empty state — what to photograph, before any scan. */}
            {scan.kind === "idle" && pageUrls.length === 0 && (
                <Alert className="w-full border-border bg-muted/30">
                    <Info className="h-4 w-4" />
                    <AlertTitle>{t("Tips for a clean scan")}</AlertTitle>
                    <AlertDescription>
                        <ul className="list-disc pl-4 space-y-1 text-xs">
                            <li>
                                {t("Shoot in good light with the page flat — avoid shadows and glare.")}
                            </li>
                            <li>{t("Fit the whole page in frame, right-side up.")}</li>
                            <li>
                                {t("One student's answers per scan; add front and back as separate pages.")}
                            </li>
                        </ul>
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
