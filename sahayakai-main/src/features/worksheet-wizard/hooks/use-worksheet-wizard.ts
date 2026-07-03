"use client";

/**
 * useWorksheetWizard — all worksheet-wizard logic, zero markup.
 * Composes the shared useGenerator spine; keeps worksheet-specific
 * behavior: VIDYA form sync + snapshot restore, restore-from-`?id`,
 * VIDYA URL prefill + 300ms auto-submit, markdown download.
 */

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useNetworkAware } from "@/hooks/use-network-aware";
import { useVidyaFormSync } from "@/hooks/use-vidya-form-sync";
import { useJarvisStore } from "@/store/jarvisStore";
import { useLanguage } from "@/context/language-context";
import { LANGUAGE_TO_ISO } from "@/types";
import { auth } from "@/lib/firebase";
import { normaliseVidyaLanguage, normaliseVidyaGradeLevel } from "@/lib/vidya-action-normalizer";
import { useGenerator } from "@/features/generator";
import { worksheetTranslations } from "../i18n";
import { formSchema, type FormValues, type WorksheetResult } from "../types";

export function useWorksheetWizard() {
    const { language: userLanguage, t: translate } = useLanguage();
    const { toast } = useToast();
    const { canUseAI, aiUnavailableReason } = useNetworkAware();
    const { clearFormSnapshot } = useJarvisStore();
    const searchParams = useSearchParams();
    const [isRestoring, setIsRestoring] = useState(false);

    // Default the Language field to the user's profile language, not
    // hardcoded 'en'. See use-lesson-plan.ts for the same pattern.
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            prompt: "",
            language: LANGUAGE_TO_ISO[userLanguage] ?? "en",
            gradeLevel: "Class 4",
            subject: "General",
        },
    });

    // UI chrome (taglines, placeholders, labels) follows the global UI language,
    // NOT the AI-output language form field. Without this, switching the app
    // language leaves chrome in the previous language until a hard refresh.
    const uiLangCode = LANGUAGE_TO_ISO[userLanguage] || "en";
    const t = worksheetTranslations[uiLangCode] || worksheetTranslations.en;

    const generator = useGenerator<FormValues, WorksheetResult>({
        feature: "worksheet",
        endpoint: "/api/ai/worksheet",
        // NCERT-demo 2026-05-19 hardening (same pattern as use-lesson-plan.ts):
        // ALWAYS send a non-empty `language`; strip the "General" subject
        // placeholder so the model isn't misled by a meaningless default.
        buildRequest: (values) => ({
            ...values,
            language: values.language && values.language.trim() ? values.language : "en",
            subject: values.subject && values.subject !== "General" ? values.subject : undefined,
        }),
        parseResponse: (json) => (json as { worksheetContent: string }).worksheetContent,
        authErrorMessage: translate("Please sign in to generate worksheets"),
        onSuccess: () => {
            clearFormSnapshot("worksheet-wizard");
        },
        onError: () => {
            toast({
                title: translate("Generation Failed"),
                description: translate("There was an error generating the worksheet. Please try again."),
                variant: "destructive",
            });
        },
    });

    const onSubmit = (values: FormValues) => generator.generate(values);

    // ── VIDYA Form Sync: live awareness + persisted snapshot ─────────────────
    const watchedPrompt = form.watch("prompt");
    const watchedGrade = form.watch("gradeLevel");
    const watchedSubject = form.watch("subject");
    const watchedLang = form.watch("language");
    const savedSnapshot = useVidyaFormSync("worksheet-wizard", {
        prompt: watchedPrompt,
        gradeLevel: watchedGrade,
        subject: watchedSubject,
        language: watchedLang,
    });

    const selectedLanguage = form.watch("language") || "en";

    // Restore snapshot on mount — only when no URL params are present
     
    useEffect(() => {
        const promptParam = searchParams.get("prompt");
        const id = searchParams.get("id");
        if (promptParam || id || !savedSnapshot) return;
        if (savedSnapshot.prompt) form.setValue("prompt", savedSnapshot.prompt);
        if (savedSnapshot.gradeLevel) form.setValue("gradeLevel", savedSnapshot.gradeLevel);
        if (savedSnapshot.subject) form.setValue("subject", savedSnapshot.subject);
        if (savedSnapshot.language) form.setValue("language", savedSnapshot.language);
    }, []); // empty array: runs once on mount only

    useEffect(() => {
        const id = searchParams.get("id");
        const promptParam = searchParams.get("prompt");

        if (id) {
            const fetchSavedContent = async () => {
                setIsRestoring(true);
                try {
                    const token = await auth.currentUser?.getIdToken();
                    const headers: Record<string, string> = {
                        "Content-Type": "application/json",
                    };

                    if (token) {
                        headers["Authorization"] = `Bearer ${token}`;
                    } else if (auth.currentUser?.uid === "dev-user") {
                        headers["x-user-id"] = "dev-user";
                    }

                    const res = await fetch(`/api/content/get?id=${id}`, { headers });
                    if (res.ok) {
                        const content = await res.json();
                        if (content.data) {
                            generator.setResult(content.data.worksheetContent || content.data);
                            form.reset({
                                prompt: content.topic || content.title,
                                gradeLevel: content.gradeLevel,
                                language: content.language,
                                imageDataUri: content.data.imageDataUri || "",
                                subject: content.subject || "General",
                            });
                        }
                    }
                } catch (err) {
                    console.error("Failed to load saved worksheet:", err);
                    toast({
                        title: translate("Load Failed"),
                        description: translate("Could not load the saved worksheet."),
                        variant: "destructive",
                    });
                } finally {
                    setIsRestoring(false);
                }
            };
            fetchSavedContent();
        } else if (promptParam) {
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

            form.setValue("prompt", promptParam, SET_OPTS);
            if (subjectParam) form.setValue("subject", subjectParam, SET_OPTS);
            const normalisedGrade = normaliseVidyaGradeLevel(gradeLevelParam);
            if (normalisedGrade) form.setValue("gradeLevel", normalisedGrade, SET_OPTS);
            const normalisedLang = normaliseVidyaLanguage(languageParam);
            if (normalisedLang) form.setValue("language", normalisedLang, SET_OPTS);
            // ── FIX: auto-generate when VIDYA navigates here with a pre-filled prompt
            setTimeout(() => form.handleSubmit(onSubmit)(), 300);
            // ────────────────────────────────────────────────────────────────────
        }
         
    }, [searchParams, form, toast]);

    const handlePromptClick = (prompt: string) => {
        form.setValue("prompt", prompt);
        // form.trigger("prompt"); // Removed to prevent premature interaction
    };

    const handleDownload = () => {
        const worksheet = generator.result;
        if (!worksheet) return;
        const blob = new Blob([worksheet], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "worksheet.md";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // NOTE: The page-level handleSave was previously a fake placeholder that
    // fired a toast claiming "Saved to Library" without ever persisting. The
    // real Save UI lives inside <WorksheetDisplay /> which calls
    // /api/content/save directly. The dead page-level handler has been
    // removed (2026-04-27) to prevent it from being mistakenly re-wired
    // to a button later.

    return {
        form,
        onSubmit,
        t,
        selectedLanguage,
        handlePromptClick,
        handleDownload,
        isRestoring,
        canUseAI,
        aiUnavailableReason,
        worksheet: generator.result,
        status: generator.status,
        isGenerating: generator.isGenerating,
        limitState: generator.limitState,
    };
}
