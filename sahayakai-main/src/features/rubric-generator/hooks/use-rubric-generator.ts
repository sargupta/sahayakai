"use client";

/**
 * useRubricGenerator — all rubric-generator logic, zero markup.
 * Composes the shared useGenerator spine; keeps rubric-specific behavior:
 * VIDYA form sync + snapshot restore, restore-from-`?id` (user-gated with
 * a hasLoaded ref), VIDYA URL prefill + 300ms auto-submit.
 */

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import type { RubricGeneratorOutput } from "@/ai/flows/rubric-generator";
import { useToast } from "@/hooks/use-toast";
import { useNetworkAware } from "@/hooks/use-network-aware";
import { useVidyaFormSync } from "@/hooks/use-vidya-form-sync";
import { useJarvisStore } from "@/store/jarvisStore";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { LANGUAGE_TO_ISO } from "@/types";
import { normaliseVidyaLanguage, normaliseVidyaGradeLevel } from "@/lib/vidya-action-normalizer";
import { useGenerator } from "@/features/generator";
import { formSchema, type FormValues } from "../types";

export function useRubricGenerator() {
    const { user } = useAuth();
    const { toast } = useToast();
    const { t: translate, language: uiLanguage } = useLanguage();
    const { canUseAI, aiUnavailableReason } = useNetworkAware();
    const searchParams = useSearchParams();
    const hasLoaded = useRef(false);
    const { clearFormSnapshot } = useJarvisStore();
    const [isRestoring, setIsRestoring] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            assignmentDescription: "",
            language: LANGUAGE_TO_ISO[uiLanguage] ?? "en",
            gradeLevel: "Class 7",
            subject: "General",
        },
    });

    const generator = useGenerator<FormValues, RubricGeneratorOutput>({
        feature: "rubric",
        endpoint: "/api/ai/rubric",
        // NCERT-demo 2026-05-19 hardening (same pattern as use-lesson-plan.ts):
        // ALWAYS send a non-empty `language`; strip the "General" subject
        // placeholder so the model isn't misled by a meaningless default.
        buildRequest: (values) => ({
            ...values,
            language: values.language && values.language.trim() ? values.language : "en",
            subject: values.subject && values.subject !== "General" ? values.subject : undefined,
        }),
        parseResponse: (json) => json as RubricGeneratorOutput,
        authErrorMessage: "Please sign in to generate rubrics",
        onSuccess: () => {
            clearFormSnapshot("rubric-generator");
        },
        onError: () => {
            toast({
                title: translate("Generation Failed"),
                description: translate("There was an error generating the rubric. Please try again."),
                variant: "destructive",
            });
        },
    });

    const onSubmit = (values: FormValues) => generator.generate(values);

    // ── VIDYA Form Sync ───────────────────────────────────────────────────────
    const watchedDesc = form.watch("assignmentDescription");
    const watchedGrade = form.watch("gradeLevel");
    const watchedSubject = form.watch("subject");
    const watchedLang = form.watch("language");
    const savedSnapshot = useVidyaFormSync("rubric-generator", {
        assignmentDescription: watchedDesc,
        gradeLevel: watchedGrade,
        subject: watchedSubject,
        language: watchedLang,
    });

    // Restore snapshot on mount — only when no URL params are present
     
    useEffect(() => {
        const descParam = searchParams.get("assignmentDescription");
        const id = searchParams.get("id");
        if (descParam || id || !savedSnapshot) return;
        if (savedSnapshot.assignmentDescription) form.setValue("assignmentDescription", savedSnapshot.assignmentDescription);
        if (savedSnapshot.gradeLevel) form.setValue("gradeLevel", savedSnapshot.gradeLevel);
        if (savedSnapshot.subject) form.setValue("subject", savedSnapshot.subject);
        if (savedSnapshot.language) form.setValue("language", savedSnapshot.language);
    }, []); // runs once on mount only

    const selectedLanguage = form.watch("language") || "en";
    // Example queries should follow the UI language, not the (possibly stale)
    // output-language form field. On first render the form default can lock to
    // 'en' before the UI language hydrates from storage, which left the sample
    // prompts in English even in Tamil mode.
    const uiLangCode = LANGUAGE_TO_ISO[uiLanguage] || "en";

    useEffect(() => {
        if (!user || hasLoaded.current) return;

        const id = searchParams.get("id");
        const descParam = searchParams.get("assignmentDescription");

        if (id) {
            const fetchSavedContent = async () => {
                setIsRestoring(true);
                try {
                    const token = await user.getIdToken();
                    const res = await fetch(`/api/content/get?id=${id}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (res.ok) {
                        const content = await res.json();
                        if (content.data) {
                            generator.setResult(content.data);
                            form.reset({
                                assignmentDescription: content.topic || content.title,
                                gradeLevel: content.gradeLevel,
                                language: content.language,
                            });
                        }
                    }
                } catch (err) {
                    console.error("Failed to load saved rubric:", err);
                    toast({
                        title: translate("Load Failed"),
                        description: translate("Could not load the saved rubric."),
                        variant: "destructive",
                    });
                } finally {
                    setIsRestoring(false);
                    hasLoaded.current = true;
                }
            };
            fetchSavedContent();
        } else if (descParam) {
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

            form.setValue("assignmentDescription", descParam, SET_OPTS);
            if (subjectParam) form.setValue("subject", subjectParam, SET_OPTS);
            const normalisedGrade = normaliseVidyaGradeLevel(gradeLevelParam);
            if (normalisedGrade) form.setValue("gradeLevel", normalisedGrade, SET_OPTS);
            const normalisedLang = normaliseVidyaLanguage(languageParam);
            if (normalisedLang) form.setValue("language", normalisedLang, SET_OPTS);
            // ────────────────────────────────────────────────────────────────────
            hasLoaded.current = true;
            setTimeout(() => {
                form.handleSubmit(onSubmit)();
            }, 300);
        }
         
    }, [user, searchParams, form, toast]);

    const handlePromptClick = (prompt: string) => {
        form.setValue("assignmentDescription", prompt);
        form.trigger("assignmentDescription");
    };

    return {
        form,
        onSubmit,
        selectedLanguage,
        uiLangCode,
        handlePromptClick,
        isRestoring,
        canUseAI,
        aiUnavailableReason,
        rubric: generator.result,
        status: generator.status,
        isGenerating: generator.isGenerating,
        limitState: generator.limitState,
    };
}
