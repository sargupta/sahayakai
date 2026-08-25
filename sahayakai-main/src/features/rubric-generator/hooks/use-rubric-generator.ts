"use client";

/**
 * useRubricGenerator — all rubric-generator logic, zero markup.
 * Composes the shared useGenerator spine; keeps rubric-specific behavior:
 * VIDYA form sync + snapshot restore, restore-from-`?id` (user-gated, and
 * guarded per param set rather than per mount), VIDYA URL prefill + 300ms
 * auto-submit.
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
import {
    normaliseVidyaLanguage,
    normaliseVidyaGradeLevel,
    vidyaDeepLinkKey,
} from "@/lib/vidya-action-normalizer";
import { useGenerator } from "@/features/generator";
import { formSchema, type FormValues } from "../types";

/**
 * Every URL param the deep-link effect below reads. The guard is keyed over
 * this exact list, so a param added to the effect must be added here too or
 * a link that differs only in that param reads as already-handled.
 */
const DEEP_LINK_PARAMS = [
    "id",
    "assignmentDescription",
    "topic",
    "subject",
    "gradeLevel",
    "language",
] as const;

export function useRubricGenerator() {
    const { user } = useAuth();
    const { toast } = useToast();
    const { t: translate, language: uiLanguage } = useLanguage();
    const { canUseAI, aiUnavailableReason } = useNetworkAware();
    const searchParams = useSearchParams();
    // The deep link this hook has already acted on, not merely "some deep
    // link has been acted on". See vidyaDeepLinkKey().
    const handledDeepLink = useRef<string | null>(null);
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
        // `topic` is the param every VIDYA producer actually emits (see the
        // note on the pre-fill effect below); read it here too, or a deep
        // link would be treated as "no URL params" and get overwritten by
        // the last snapshot.
        const descParam =
            searchParams.get("assignmentDescription") || searchParams.get("topic");
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
        // `user` gates the whole effect, so test it BEFORE claiming anything:
        // the first render has no user yet, and claiming there would burn the
        // key for a run that never happened.
        if (!user) return;

        // Run the URL branch once PER PARAM SET. A guard keyed to the mount
        // drops a SECOND rubric request from a teacher already standing on
        // this page: VIDYA is mounted app-wide (app-shell.tsx) and pushes
        // client-side into this same route segment, and page.tsx does not key
        // its <Suspense>, so the query changes without a remount and a bare
        // boolean is still set from the first link. Claim the key, not the
        // mount. Claiming here rather than after the `?id=` fetch resolves
        // also keeps the round trip guarded — same reasoning as
        // use-worksheet-wizard.ts.
        const deepLinkKey = vidyaDeepLinkKey(searchParams, DEEP_LINK_PARAMS);
        if (handledDeepLink.current === deepLinkKey) return;
        handledDeepLink.current = deepLinkKey;

        const id = searchParams.get("id");
        // Every producer that can navigate here emits `topic`: the intent
        // route and the agent router build one shared query string for all
        // nine flows (src/app/api/ai/intent/route.ts, src/ai/flows/agent-router.ts),
        // the voice assistant's VidyaAction params have no other text field,
        // and the Gemini Live tool declaration only exposes topic/gradeLevel/
        // subject/language. Only the OmniOrb supervisor also emits the richer
        // `assignmentDescription`, which the SOUL prompt reserves for this one
        // flow — so prefer it when present and fall back to `topic`. Same
        // most-specific-first alias shape as use-instant-answer.ts
        // (`question || topic || prompt`) and visual-aid-designer
        // (`prompt || topic`).
        const descParam =
            searchParams.get("assignmentDescription") || searchParams.get("topic");

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
                            // `reset` REPLACES the whole form state — any key
                            // missing from the payload becomes undefined
                            // rather than being left alone. Seed it from the
                            // live values so a field the saved record has
                            // nothing to say about (or a field added to the
                            // schema later) survives the restore instead of
                            // being blanked.
                            const current = form.getValues();
                            form.reset({
                                ...current,
                                assignmentDescription:
                                    content.topic || content.title || current.assignmentDescription,
                                gradeLevel: content.gradeLevel || current.gradeLevel,
                                subject: content.subject || current.subject,
                                // Saved rubrics store the language DISPLAY name
                                // ("English", "Bengali"): generateRubric runs
                                // normalizeLanguage() before the flow persists,
                                // so the ISO code the form sent never reaches
                                // Firestore. <LanguageSelector> is driven by ISO
                                // codes, so writing the display name back matches
                                // no option and the control renders empty. Map it
                                // back through the shared normaliser.
                                language:
                                    normaliseVidyaLanguage(content.language) || current.language,
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
