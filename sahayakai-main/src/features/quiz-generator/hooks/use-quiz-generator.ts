"use client";

/**
 * useQuizGenerator — all quiz-generator logic, zero markup.
 *
 * Composes the shared useGenerator spine (auth guard, limit guard,
 * abortable fetch, 202/401/malformed taxonomy) with quiz-specific
 * behavior: VIDYA form sync + snapshot restore, restore-from-`?id`
 * (with old-style → variant-shape backward compatibility), VIDYA URL
 * prefill + 300ms auto-submit, and the `first-quiz` checklist mark.
 */

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import type { QuizVariantsOutput } from "@/ai/schemas/quiz-generator-schemas";
import { useToast } from "@/hooks/use-toast";
import { useNetworkAware } from "@/hooks/use-network-aware";
import { useVidyaFormSync } from "@/hooks/use-vidya-form-sync";
import { useJarvisStore } from "@/store/jarvisStore";
import { useLanguage } from "@/context/language-context";
import { LANGUAGE_TO_ISO } from "@/types";
import { auth } from "@/lib/firebase";
import { normaliseVidyaLanguage, normaliseVidyaGradeLevel } from "@/lib/vidya-action-normalizer";
import { useGenerator } from "@/features/generator";
import { formSchema, type FormValues } from "../types";

export function useQuizGenerator() {
    const { language: userLanguage, t: translate } = useLanguage();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const { clearFormSnapshot } = useJarvisStore();
    const { canUseAI, aiUnavailableReason } = useNetworkAware();
    const [isRestoring, setIsRestoring] = useState(false);

    // Default the Language field to the user's profile language, not
    // hardcoded 'en'. See use-lesson-plan.ts for the same pattern.
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            topic: "",
            language: LANGUAGE_TO_ISO[userLanguage] ?? "en",
            gradeLevel: undefined,
            numQuestions: 5,
            questionTypes: ["multiple_choice", "short_answer"],
            bloomsTaxonomyLevels: ["Remember", "Understand"],
            subject: "General",
        },
    });

    const generator = useGenerator<FormValues, QuizVariantsOutput>({
        feature: "quiz",
        endpoint: "/api/ai/quiz",
        // NCERT-demo 2026-05-19 hardening (same pattern as use-lesson-plan.ts):
        // ALWAYS send a non-empty `language`; strip the "General" subject
        // placeholder so the model isn't misled by a meaningless default.
        buildRequest: (values) => ({
            ...values,
            language: values.language && values.language.trim() ? values.language : "en",
            subject: values.subject && values.subject !== "General" ? values.subject : undefined,
            useRuralContext: true,
        }),
        parseResponse: (json) => json as QuizVariantsOutput,
        authErrorMessage: translate("Please sign in to generate quizzes"),
        onSuccess: () => {
            clearFormSnapshot("quiz-generator");
            // Mark onboarding checklist item
            if (auth.currentUser) {
                import("@/lib/api/profile")
                    .then(({ markChecklistItemAction }) =>
                        markChecklistItemAction(auth.currentUser!.uid, "first-quiz"),
                    )
                    .catch(() => {});
            }
        },
        onError: () => {
            toast({
                title: translate("Generation Failed"),
                description: translate("There was an error generating the quiz. Please try again."),
                variant: "destructive",
            });
        },
    });

    const onSubmit = (values: FormValues) => generator.generate(values);

    // ── VIDYA Form Sync: live awareness + persisted snapshot ─────────────────
    const watchedTopic = form.watch("topic");
    const watchedGrade = form.watch("gradeLevel");
    const watchedSubject = form.watch("subject");
    const watchedLang = form.watch("language");
    const watchedNum = form.watch("numQuestions");
    const savedSnapshot = useVidyaFormSync("quiz-generator", {
        topic: watchedTopic,
        gradeLevel: watchedGrade,
        subject: watchedSubject,
        language: watchedLang,
        numQuestions: watchedNum,
    });

    // Restore snapshot on mount if no URL params are present
     
    useEffect(() => {
        const topicParam = searchParams.get("topic");
        const id = searchParams.get("id");
        if (topicParam || id || !savedSnapshot) return;
        if (savedSnapshot.topic) form.setValue("topic", savedSnapshot.topic);
        if (savedSnapshot.gradeLevel) form.setValue("gradeLevel", savedSnapshot.gradeLevel);
        if (savedSnapshot.subject) form.setValue("subject", savedSnapshot.subject);
        if (savedSnapshot.language) form.setValue("language", savedSnapshot.language);
        if (savedSnapshot.numQuestions) form.setValue("numQuestions", Number(savedSnapshot.numQuestions));
    }, []); // empty array: runs once on mount only

    useEffect(() => {
        const id = searchParams.get("id");
        const topicParam = searchParams.get("topic");

        if (id) {
            const fetchSavedContent = async () => {
                setIsRestoring(true);
                try {
                    // Use auth helper if available, otherwise fallback
                    const userId = auth.currentUser?.uid || "dev-user";
                    const res = await fetch(`/api/content/get?id=${id}`, {
                        headers: { "x-user-id": userId },
                    });
                    if (res.ok) {
                        const content = await res.json();
                        if (content.data) {
                            const loadedData = content.data;

                            // Backward Compatibility: If loaded data is "old style"
                            // (has questions array directly), wrap it
                            if (Array.isArray(loadedData.questions)) {
                                generator.setResult({
                                    easy: null,
                                    medium: loadedData,
                                    hard: null,
                                    id: id,
                                    isSaved: true,
                                    gradeLevel: content.gradeLevel,
                                    subject: content.subject,
                                    topic: content.topic || content.title,
                                } as unknown as QuizVariantsOutput);
                            } else {
                                // New style (easy, medium, hard)
                                generator.setResult({
                                    ...loadedData,
                                    id: id,
                                    isSaved: true,
                                } as QuizVariantsOutput);
                            }

                            // Set form values to match saved content
                            // (prioritize medium, then any available)
                            const primaryVariant =
                                loadedData.medium || loadedData.easy || loadedData.hard || loadedData;

                            form.reset({
                                topic: content.topic || content.title,
                                gradeLevel: content.gradeLevel,
                                language: content.language,
                                numQuestions: primaryVariant?.questions?.length || 5,
                                // Default to standard types if not structured in base metadata
                                questionTypes: ["multiple_choice", "short_answer"],
                                bloomsTaxonomyLevels: ["Remember", "Understand"],
                                subject: content.subject || "General",
                            });
                        }
                    }
                } catch (err) {
                    console.error("Failed to load saved quiz:", err);
                    toast({
                        title: translate("Load Failed"),
                        description: translate("Could not load the saved quiz."),
                        variant: "destructive",
                    });
                } finally {
                    setIsRestoring(false);
                }
            };
            fetchSavedContent();
        } else if (topicParam) {
            // ── VIDYA Action: Pre-fill all fields from URL params ──────────────
            // NCERT-demo 2026-05-19 pattern (see use-lesson-plan.ts):
            //   - SET_OPTS forces controlled selectors to re-render with the
            //     incoming value before the 300ms auto-submit fires.
            //   - VIDYA emits language/grade in display-name form; normalise
            //     to ISO ("en") / "Class N" before writing.
            const subjectParam = searchParams.get("subject");
            const gradeLevelParam = searchParams.get("gradeLevel");
            const languageParam = searchParams.get("language");

            const SET_OPTS = { shouldDirty: true, shouldTouch: true, shouldValidate: true } as const;

            form.setValue("topic", topicParam, SET_OPTS);
            if (subjectParam) form.setValue("subject", subjectParam, SET_OPTS);
            const normalisedGrade = normaliseVidyaGradeLevel(gradeLevelParam);
            if (normalisedGrade) form.setValue("gradeLevel", normalisedGrade, SET_OPTS);
            const normalisedLang = normaliseVidyaLanguage(languageParam);
            if (normalisedLang) form.setValue("language", normalisedLang, SET_OPTS);
            // ────────────────────────────────────────────────────────────────────
            setTimeout(() => {
                form.handleSubmit(onSubmit)();
            }, 300);
        }
         
    }, [searchParams, form, toast]);

    const selectedLanguage = form.watch("language") || "en";

    const handlePromptClick = (prompt: string) => {
        form.setValue("topic", prompt);
        form.trigger("topic");
    };

    const handleTranscript = (transcript: string, language?: string) => {
        form.setValue("topic", transcript);
        if (language) {
            form.setValue("language", language);
        }
        form.trigger("topic");
        // Auto-submit after voice transcript to improve UX
        setTimeout(() => {
            form.handleSubmit(onSubmit)();
        }, 100);
    };

    return {
        form,
        onSubmit,
        selectedLanguage,
        handlePromptClick,
        handleTranscript,
        isRestoring,
        canUseAI,
        aiUnavailableReason,
        quiz: generator.result,
        status: generator.status,
        isGenerating: generator.isGenerating,
        limitState: generator.limitState,
    };
}
