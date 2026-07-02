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
import { useToast } from "@/hooks/use-toast";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { LanguageSelector } from "@/components/language-selector";
import { ImageUploader } from "@/components/image-uploader";
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
    CheckCircle2,
    Info,
    Loader2,
    Plus,
    ScanLine,
    X,
} from "lucide-react";
import Image from "next/image";
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
import { LANGUAGE_TO_ISO } from "@/types";

// --- Component-local UI translations ---------------------------------------
// These three chrome strings have NO entry in the shared dictionary
// (src/context/language-context.tsx), so t() would fall back to English for
// every non-English UI language. We resolve them locally by uiLangCode
// (= LANGUAGE_TO_ISO[useLanguage().language]) per the codebase's local-table
// pattern (e.g. lesson-plan-view.tsx, example-prompts.tsx).
type LocalI18n = Record<string, string>;

const SCANNER_SUBTITLE: LocalI18n = {
    en: "Photograph a student's answer page. AI reads the work, scores it, and gives per-question feedback.",
    hi: "किसी छात्र के उत्तर पृष्ठ की फ़ोटो लें। AI उत्तर पढ़ता है, अंक देता है और हर प्रश्न पर प्रतिक्रिया देता है।",
    mr: "विद्यार्थ्याच्या उत्तरपत्रिकेचा फोटो काढा. AI उत्तर वाचतो, गुण देतो आणि प्रत्येक प्रश्नावर अभिप्राय देतो.",
    bn: "একজন শিক্ষার্থীর উত্তরপত্রের ছবি তুলুন। AI উত্তর পড়ে, নম্বর দেয় এবং প্রতিটি প্রশ্নে মতামত দেয়।",
    pa: "ਕਿਸੇ ਵਿਦਿਆਰਥੀ ਦੇ ਉੱਤਰ ਪੰਨੇ ਦੀ ਫ਼ੋਟੋ ਖਿੱਚੋ। AI ਉੱਤਰ ਪੜ੍ਹਦਾ ਹੈ, ਅੰਕ ਦਿੰਦਾ ਹੈ ਅਤੇ ਹਰ ਸਵਾਲ ਉੱਤੇ ਫੀਡਬੈਕ ਦਿੰਦਾ ਹੈ।",
    gu: "વિદ્યાર્થીના જવાબ પાનાનો ફોટો લો. AI જવાબ વાંચે છે, ગુણ આપે છે અને દરેક પ્રશ્ન પર પ્રતિસાદ આપે છે.",
    or: "ଜଣେ ଛାତ୍ରଙ୍କ ଉତ୍ତର ପୃଷ୍ଠାର ଫଟୋ ଉଠାନ୍ତୁ। AI ଉତ୍ତର ପଢ଼େ, ନମ୍ବର ଦିଏ ଏବଂ ପ୍ରତ୍ୟେକ ପ୍ରଶ୍ନ ପାଇଁ ମତାମତ ଦିଏ।",
    ta: "ஒரு மாணவரின் விடைத்தாளைப் புகைப்படம் எடுக்கவும். AI வேலையைப் படித்து, மதிப்பெண் வழங்கி, ஒவ்வொரு கேள்விக்கும் கருத்து அளிக்கிறது.",
    te: "ఒక విద్యార్థి సమాధాన పేజీని ఫోటో తీయండి. AI పనిని చదివి, మార్కులు వేసి, ప్రతి ప్రశ్నకు అభిప్రాయాన్ని ఇస్తుంది.",
    kn: "ವಿದ್ಯಾರ್ಥಿಯ ಉತ್ತರ ಪುಟದ ಫೋಟೋ ತೆಗೆಯಿರಿ. AI ಕೆಲಸವನ್ನು ಓದಿ, ಅಂಕಗಳನ್ನು ನೀಡಿ, ಪ್ರತಿ ಪ್ರಶ್ನೆಗೆ ಪ್ರತಿಕ್ರಿಯೆ ನೀಡುತ್ತದೆ.",
    ml: "ഒരു വിദ്യാർത്ഥിയുടെ ഉത്തരപ്പേജ് ഫോട്ടോ എടുക്കുക. AI ജോലി വായിച്ച്, സ്കോർ നൽകി, ഓരോ ചോദ്യത്തിനും പ്രതികരണം നൽകുന്നു.",
};

const SCANNER_MAX_PAGES: LocalI18n = {
    en: "Maximum pages reached for this scan. Remove a page to add another, or run a second scan.",
    hi: "इस स्कैन के लिए अधिकतम पृष्ठ संख्या पूरी हो गई है। दूसरा जोड़ने के लिए एक पृष्ठ हटाएँ, या दूसरा स्कैन चलाएँ।",
    mr: "या स्कॅनसाठी कमाल पृष्ठ संख्या पूर्ण झाली आहे. दुसरे जोडण्यासाठी एक पृष्ठ काढा, किंवा दुसरे स्कॅन करा.",
    bn: "এই স্ক্যানের জন্য সর্বাধিক পৃষ্ঠা সংখ্যায় পৌঁছে গেছে। আরেকটি যোগ করতে একটি পৃষ্ঠা সরান, অথবা দ্বিতীয় স্ক্যান চালান।",
    pa: "ਇਸ ਸਕੈਨ ਲਈ ਵੱਧ ਤੋਂ ਵੱਧ ਪੰਨੇ ਪੂਰੇ ਹੋ ਗਏ ਹਨ। ਹੋਰ ਜੋੜਨ ਲਈ ਇੱਕ ਪੰਨਾ ਹਟਾਓ, ਜਾਂ ਦੂਜਾ ਸਕੈਨ ਚਲਾਓ।",
    gu: "આ સ્કેન માટે મહત્તમ પાનાં સંખ્યા પૂરી થઈ ગઈ છે. બીજું ઉમેરવા માટે એક પાનું દૂર કરો, અથવા બીજું સ્કેન ચલાવો.",
    or: "ଏହି ସ୍କାନ ପାଇଁ ସର୍ବାଧିକ ପୃଷ୍ଠା ସଂଖ୍ୟାରେ ପହଞ୍ଚିଗଲା। ଅନ୍ୟ ଗୋଟିଏ ଯୋଡ଼ିବାକୁ ଗୋଟିଏ ପୃଷ୍ଠା ବାହାର କରନ୍ତୁ, କିମ୍ବା ଦ୍ୱିତୀୟ ସ୍କାନ ଚଲାନ୍ତୁ।",
    ta: "இந்த ஸ்கேனுக்கான அதிகபட்ச பக்கங்கள் எட்டப்பட்டன. மற்றொன்றைச் சேர்க்க ஒரு பக்கத்தை அகற்றவும், அல்லது இரண்டாவது ஸ்கேனை இயக்கவும்.",
    te: "ఈ స్కాన్ కోసం గరిష్ట పేజీల సంఖ్యకు చేరుకుంది. మరొకటి జోడించడానికి ఒక పేజీని తీసివేయండి, లేదా రెండవ స్కాన్ అమలు చేయండి.",
    kn: "ಈ ಸ್ಕ್ಯಾನ್‌ಗೆ ಗರಿಷ್ಠ ಪುಟಗಳ ಸಂಖ್ಯೆ ತಲುಪಿದೆ. ಇನ್ನೊಂದನ್ನು ಸೇರಿಸಲು ಒಂದು ಪುಟವನ್ನು ತೆಗೆದುಹಾಕಿ, ಅಥವಾ ಎರಡನೇ ಸ್ಕ್ಯಾನ್ ಅನ್ನು ಚಲಾಯಿಸಿ.",
    ml: "ഈ സ്കാനിനായി പരമാവധി പേജുകളിൽ എത്തി. മറ്റൊന്ന് ചേർക്കാൻ ഒരു പേജ് നീക്കം ചെയ്യുക, അല്ലെങ്കിൽ രണ്ടാമത്തെ സ്കാൻ പ്രവർത്തിപ്പിക്കുക.",
};

const SUBJECT_OTHER: LocalI18n = {
    en: "Other",
    hi: "अन्य",
    mr: "इतर",
    bn: "অন্যান্য",
    pa: "ਹੋਰ",
    gu: "અન્ય",
    or: "ଅନ୍ୟ",
    ta: "மற்றவை",
    te: "ఇతరం",
    kn: "ಇತರೆ",
    ml: "മറ്റുള്ളവ",
};

function localT(table: LocalI18n, uiLangCode: string): string {
    return table[uiLangCode] ?? table.en;
}

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
    const { user, requireAuth, openAuthModal } = useAuth();
    const { t, language: uiLanguage } = useLanguage();
    const uiLangCode = LANGUAGE_TO_ISO[uiLanguage] ?? "en";
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const savedAssessmentId = searchParams?.get("id") ?? null;

    const [result, setResult] = useState<AssessmentScannerOutput | null>(null);
    const [resultMeta, setResultMeta] = useState<{ subject?: string; gradeLevel?: string }>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingSaved, setIsLoadingSaved] = useState(Boolean(savedAssessmentId));
    const submittingRef = useRef(false);

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
        if (!savedAssessmentId || !user) return;
        setIsLoadingSaved(true);
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
                setResult(payload);
                setResultMeta({
                    subject: typeof json.subject === "string" ? json.subject : undefined,
                    gradeLevel:
                        typeof json.gradeLevel === "string" ? json.gradeLevel : undefined,
                });
            } catch (err) {
                console.error("[AssessmentScanner] failed to load saved", err);
                if (!cancelled) {
                    toast({
                        title: t("Could not open assessment"),
                        description: t("Please try again from My Library."),
                        variant: "destructive",
                    });
                }
            } finally {
                if (!cancelled) setIsLoadingSaved(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [savedAssessmentId, user, toast, t]);

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
                throw new Error(errorData.message || errorData.error || t("Failed to grade assessment"));
            }

            const data = (await res.json()) as AssessmentScannerOutput;
            setResult(data);
            setResultMeta({ subject: values.subject, gradeLevel: values.gradeLevel });
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
                        {localT(SCANNER_SUBTITLE, uiLangCode)}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert className="mb-6 border-primary/30 bg-primary/5">
                        <Info className="h-4 w-4" />
                        <AlertTitle>{t("Now supporting six subject families, up to 3 pages per scan")}</AlertTitle>
                        <AlertDescription>
                            {t(
                                "Mathematics, Science, EVS, Social Science (History / Geography / Civics), Hindi, and English. Mathematics is best-in-class — other subjects are in pilot, so please review the AI's grades carefully.",
                            )}
                        </AlertDescription>
                    </Alert>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="pageUrls"
                                render={() => (
                                    <FormItem>
                                        <FormLabel className="font-headline flex items-center justify-between">
                                            <span>{t("Student answer pages")}</span>
                                            <span className="text-xs font-normal text-muted-foreground">
                                                {pageUrls.length} / {ASSESSMENT_DEMO_PAGE_CAP}
                                            </span>
                                        </FormLabel>

                                        {pageUrls.length > 0 && (
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                                                {pageUrls.map((url, i) => (
                                                    <div
                                                        key={`${url}-${i}`}
                                                        className="relative group rounded-lg border border-border overflow-hidden bg-muted/20"
                                                    >
                                                        <Image
                                                            src={url}
                                                            alt={t("Page") + ` ${i + 1}`}
                                                            width={200}
                                                            height={200}
                                                            className="w-full h-32 object-cover"
                                                            unoptimized
                                                        />
                                                        <Badge
                                                            variant="secondary"
                                                            className="absolute top-1 left-1 text-[10px]"
                                                        >
                                                            {t("Page")} {i + 1}
                                                        </Badge>
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="icon"
                                                            className="absolute top-1 right-1 h-7 w-7"
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
                                                    language={selectedLanguage.slice(0, 2).toLowerCase()}
                                                />
                                            </FormControl>
                                        ) : (
                                            <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
                                                <Info className="h-4 w-4" />
                                                <AlertDescription>
                                                    {localT(SCANNER_MAX_PAGES, uiLangCode)}
                                                </AlertDescription>
                                            </Alert>
                                        )}

                                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                            <Plus className="h-3 w-3" />
                                            {t("Add up to") + " " + ASSESSMENT_DEMO_PAGE_CAP + " " + t("pages — front + back, or 3 sides of a worksheet.")}
                                        </p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 border-t border-border/30 pt-4 mt-2">
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
                                                                    <span>{s === "Other" ? localT(SUBJECT_OTHER, uiLangCode) : t(s)}</span>
                                                                    {s === "Mathematics" && (
                                                                        <Badge
                                                                            variant="secondary"
                                                                            className="text-[9px] px-1"
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
                                    </FormLabel>
                                    <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-xs text-muted-foreground">
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

                            <Button
                                type="submit"
                                className="w-full"
                                size="lg"
                                disabled={isLoading || pageUrls.length === 0}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t("Grading...")}
                                    </>
                                ) : (
                                    <>
                                        <ScanLine className="mr-2 h-4 w-4" />
                                        {pageUrls.length > 1
                                            ? `${t("Grade")} ${pageUrls.length} ${t("pages")}`
                                            : t("Grade this page")}
                                    </>
                                )}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {(isLoading || isLoadingSaved) && (
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

            {result && !isLoadingSaved && (
                <AssessmentResultCard
                    result={result}
                    subject={resultMeta.subject}
                    gradeLevel={resultMeta.gradeLevel}
                    onResultUpdated={(next) => setResult(next)}
                />
            )}
        </div>
    );
}
