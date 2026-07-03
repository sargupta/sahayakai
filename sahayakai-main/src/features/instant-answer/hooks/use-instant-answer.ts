"use client";

/**
 * useInstantAnswer — all instant-answer logic, zero markup.
 * Composes the shared useGenerator spine; keeps instant-answer-specific
 * behavior: VIDYA form sync + snapshot restore, restore-from-`?id`,
 * URL prefill (question|topic|prompt) + 300ms auto-submit, and the real
 * Save-to-Library flow (added 2026-04-27 to replace the fake toast-only
 * save).
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
import { saveToLibrary } from "@/lib/api/content";
import { useGenerator } from "@/features/generator";
import { instantAnswerTranslations } from "../i18n";
import { formSchema, type FormValues, type Answer } from "../types";

export function useInstantAnswer() {
    const { toast } = useToast();
    const { t: translate, language: uiLanguage } = useLanguage();
    const { canUseAI, aiUnavailableReason } = useNetworkAware();
    const { clearFormSnapshot } = useJarvisStore();
    const searchParams = useSearchParams();
    const [isRestoring, setIsRestoring] = useState(false);

    // Save-to-Library state — added 2026-04-27 alongside fix for the
    // previously-broken handleSave() which only fired a toast and never
    // actually persisted the answer.
    const [isSaving, setIsSaving] = useState(false);
    const [savedToLib, setSavedToLib] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            question: "",
            language: LANGUAGE_TO_ISO[uiLanguage] ?? "en",
            gradeLevel: "Class 6",
            subject: "General",
        },
    });

    const selectedLanguage = form.watch("language") || "en";
    // UI chrome (taglines, placeholders, labels) follows the global UI language,
    // NOT the AI-output language form field. Without this, switching the app
    // language leaves chrome in the previous language until a hard refresh.
    const uiLangCode = LANGUAGE_TO_ISO[uiLanguage] || "en";
    const t = instantAnswerTranslations[uiLangCode] || instantAnswerTranslations.en;

    const generator = useGenerator<FormValues, Answer>({
        feature: "instant-answer",
        endpoint: "/api/ai/instant-answer",
        buildRequest: (values) => ({
            question: values.question,
            language: values.language || selectedLanguage,
            gradeLevel: values.gradeLevel,
            subject: values.subject,
        }),
        parseResponse: (json, values) => ({ ...values, ...(json as object) }) as Answer,
        authErrorMessage: translate("Please sign in to get instant answers"),
        onSuccess: () => {
            clearFormSnapshot("instant-answer");
        },
        onError: (error) => {
            toast({
                title: translate("Answer Generation Failed"),
                description:
                    error.message || translate("There was an error getting an answer. Please try again."),
                variant: "destructive",
            });
        },
    });

    const onSubmit = (values: FormValues) => generator.generate(values);

    // ── VIDYA Form Sync ───────────────────────────────────────────────────────
    const watchedQuestion = form.watch("question");
    const watchedGrade = form.watch("gradeLevel");
    const watchedSubject = form.watch("subject");
    const watchedLang = form.watch("language");
    const savedSnapshot = useVidyaFormSync("instant-answer", {
        question: watchedQuestion,
        gradeLevel: watchedGrade,
        subject: watchedSubject,
        language: watchedLang,
    });

    // Restore snapshot on mount — only when no URL params are present
     
    useEffect(() => {
        const questionParam =
            searchParams.get("question") || searchParams.get("topic") || searchParams.get("prompt");
        if (questionParam || !savedSnapshot) return;
        if (savedSnapshot.question) form.setValue("question", savedSnapshot.question);
        if (savedSnapshot.gradeLevel) form.setValue("gradeLevel", savedSnapshot.gradeLevel);
        if (savedSnapshot.subject) form.setValue("subject", savedSnapshot.subject);
        if (savedSnapshot.language) form.setValue("language", savedSnapshot.language);
    }, []); // runs once on mount only

    useEffect(() => {
        const id = searchParams.get("id");
        const questionParam =
            searchParams.get("question") || searchParams.get("topic") || searchParams.get("prompt");

        if (id) {
            // ── Library: load saved instant-answer by id ──────────────────────
            const fetchSaved = async () => {
                setIsRestoring(true);
                try {
                    const token = await auth.currentUser?.getIdToken();
                    const headers: Record<string, string> = { "Content-Type": "application/json" };
                    if (token) headers["Authorization"] = `Bearer ${token}`;
                    const res = await fetch(`/api/content/get?id=${id}`, { headers });
                    if (res.ok) {
                        const content = await res.json();
                        if (content.topic) form.setValue("question", content.topic);
                        if (content.language) form.setValue("language", content.language);
                        if (content.gradeLevel) form.setValue("gradeLevel", content.gradeLevel);
                        if (content.subject) form.setValue("subject", content.subject);
                        if (content.data?.answer) {
                            generator.setResult({
                                question: content.topic,
                                answer: content.data.answer,
                                videoSuggestionUrl: content.data.videoSuggestionUrl,
                            } as Answer);
                        }
                    }
                } catch (err) {
                    console.error("Failed to load saved instant answer:", err);
                } finally {
                    setIsRestoring(false);
                }
            };
            fetchSaved();
        } else if (questionParam) {
            // ── VIDYA Action: Pre-fill all fields from URL params ──────────────
            const subjectParam = searchParams.get("subject");
            const gradeLevelParam = searchParams.get("gradeLevel");
            const languageParam = searchParams.get("language");

            form.setValue("question", questionParam);
            if (subjectParam) form.setValue("subject", subjectParam);
            if (gradeLevelParam) form.setValue("gradeLevel", gradeLevelParam);
            if (languageParam) form.setValue("language", languageParam);
            // ───────────────────────────────────────────────────────────────────
            setTimeout(() => {
                form.handleSubmit(onSubmit)();
            }, 300);
        }
         
    }, [searchParams, form]);

    const handlePromptClick = (prompt: string) => {
        form.setValue("question", prompt);
        // form.trigger("question"); // Removed to prevent premature validation messaging
    };

    const handleSave = async () => {
        const answer = generator.result;
        if (!answer || !auth.currentUser) return;
        if (savedToLib) return; // already saved — prevent duplicate writes
        setIsSaving(true);
        try {
            // Title = the question, capped at 80 chars (matches teacher-training pattern)
            const title = (answer.question || form.getValues("question")).slice(0, 80);
            const result = await saveToLibrary(
                auth.currentUser.uid,
                "instant-answer",
                title,
                {
                    answer: answer.answer,
                    videoSuggestionUrl: answer.videoSuggestionUrl,
                    // Preserve form context so a re-open shows the same params
                    language: form.getValues("language"),
                    gradeLevel: form.getValues("gradeLevel"),
                    subject: form.getValues("subject"),
                },
            );
            if (result.success) {
                setSavedToLib(true);
                toast({
                    title: translate("Saved to Library"),
                    description: translate("Your answer has been saved to your personal library."),
                });
            } else {
                throw new Error(result.error || "Save failed");
            }
        } catch (err: any) {
            toast({
                title: translate("Could not save"),
                description: err?.message ?? "",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return {
        form,
        onSubmit,
        t,
        selectedLanguage,
        handlePromptClick,
        handleSave,
        isSaving,
        savedToLib,
        isRestoring,
        canUseAI,
        aiUnavailableReason,
        answer: generator.result,
        status: generator.status,
        isGenerating: generator.isGenerating,
        limitState: generator.limitState,
    };
}
