"use client";

/**
 * useVirtualFieldTrip — all virtual-field-trip logic, zero markup.
 * Composes the shared useGenerator spine; keeps trip-specific behavior:
 * VIDYA form sync + snapshot restore, restore-from-`?id`, VIDYA URL prefill
 * + 300ms auto-submit.
 *
 * The page used to hand-roll this state machine — a pre-spine copy that
 * predated the 202 branch, so the one route in the app that answers 202
 * was consumed by the one client that could not read it.
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
import { MalformedResponseError, useGenerator } from "@/features/generator";
import type { VirtualFieldTripOutput } from "@/ai/flows/virtual-field-trip";
import { virtualFieldTripTranslations } from "../i18n";
import { asVirtualFieldTrip, formSchema, type FormValues } from "../types";

export function useVirtualFieldTrip() {
    const { language: uiLanguage, t: translate } = useLanguage();
    const { toast } = useToast();
    const { canUseAI, aiUnavailableReason } = useNetworkAware();
    const { clearFormSnapshot } = useJarvisStore();
    const searchParams = useSearchParams();
    const [isRestoring, setIsRestoring] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            topic: "",
            language: LANGUAGE_TO_ISO[uiLanguage] ?? "en",
            gradeLevel: "Class 8",
            subject: "General",
        },
    });

    // UI chrome (taglines, placeholders, labels) follows the global UI language,
    // NOT the AI-output language form field. Without this, switching the app
    // language leaves chrome in the previous language until a hard refresh.
    const uiLangCode = LANGUAGE_TO_ISO[uiLanguage] || "en";
    const t = virtualFieldTripTranslations[uiLangCode] || virtualFieldTripTranslations.en;

    const generator = useGenerator<FormValues, VirtualFieldTripOutput>({
        feature: "virtual-field-trip",
        endpoint: "/api/ai/virtual-field-trip",
        // The page has never gated submit behind the auth modal — it posts and
        // lets the route's 401 open it. Preserved verbatim through the move.
        requireAuthOnSubmit: false,
        // NCERT-demo 2026-05-19 hardening (same pattern as use-lesson-plan.ts):
        // ALWAYS send a non-empty `language`; strip the "General" subject
        // placeholder so the model isn't misled by a meaningless default.
        buildRequest: (values) => ({
            topic: values.topic,
            language: values.language && values.language.trim() ? values.language : "en",
            gradeLevel: values.gradeLevel,
            subject: values.subject && values.subject !== "General" ? values.subject : undefined,
        }),
        // `stops` is the whole trip — VirtualFieldTripDisplay maps over it
        // unconditionally. A body without stops is a malformed response, not a
        // short trip, and must never reach the display.
        parseResponse: (json) => {
            const trip = asVirtualFieldTrip(json);
            if (!trip) {
                throw new MalformedResponseError(
                    translate("The AI returned an incomplete field trip. Please try again."),
                );
            }
            return trip;
        },
        authErrorMessage: translate("Please sign in to generate virtual field trips"),
        stillGeneratingMessage: translate(
            "Your field trip is still generating. Check My Library in a minute.",
        ),
        onSuccess: () => {
            clearFormSnapshot("virtual-field-trip");
        },
        onError: (error) => {
            // A 202 is not a failure — the trip is still being written. Saying
            // "Planning Failed" would send the teacher back to Generate and
            // charge them a second time for work already in flight.
            if (error.code === "STILL_GENERATING") {
                toast({
                    title: translate("Still Generating"),
                    description: error.message,
                });
                return;
            }
            toast({
                title: translate("Planning Failed"),
                description: translate(
                    "There was an error planning the virtual trip. Please try again.",
                ),
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
    const savedSnapshot = useVidyaFormSync("virtual-field-trip", {
        topic: watchedTopic,
        gradeLevel: watchedGrade,
        subject: watchedSubject,
        language: watchedLang,
    });

    const selectedLanguage = form.watch("language") || "en";

    // Restore snapshot on mount — only when no URL params are present
    useEffect(() => {
        const topicParam = searchParams.get("topic");
        const id = searchParams.get("id");
        if (topicParam || id || !savedSnapshot) return;
        if (savedSnapshot.topic) form.setValue("topic", savedSnapshot.topic);
        if (savedSnapshot.gradeLevel) form.setValue("gradeLevel", savedSnapshot.gradeLevel);
        if (savedSnapshot.subject) form.setValue("subject", savedSnapshot.subject);
        if (savedSnapshot.language) form.setValue("language", savedSnapshot.language);
    }, []); // runs once on mount only

    useEffect(() => {
        const id = searchParams.get("id");
        const topicParam = searchParams.get("topic");

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

                    const res = await fetch(`/api/content/get?id=${id}`, {
                        headers: headers,
                    });
                    if (res.ok) {
                        const content = await res.json();
                        if (content.data) {
                            // Saved records are not a safer source than the
                            // generator: a trip persisted before its stops were
                            // written reopens as the same crash. Narrow here too.
                            const saved = asVirtualFieldTrip(content.data);
                            if (saved) {
                                generator.setResult(saved);
                            } else {
                                toast({
                                    title: translate("Load Failed"),
                                    description: translate("Could not load the saved field trip."),
                                    variant: "destructive",
                                });
                            }
                            form.reset({
                                topic: content.topic || content.title,
                                gradeLevel: content.gradeLevel,
                                language: content.language,
                            });
                        }
                    }
                } catch (err) {
                    console.error("Failed to load saved field trip:", err);
                    toast({
                        title: translate("Load Failed"),
                        description: translate("Could not load the saved field trip."),
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
            setTimeout(() => {
                form.handleSubmit(onSubmit)();
            }, 300);
            // ────────────────────────────────────────────────────────────────────
        }
    }, [searchParams, form, toast]);

    const handlePromptClick = (prompt: string) => {
        form.setValue("topic", prompt);
        // form.trigger("topic"); // Removed to prevent premature interaction
    };

    return {
        form,
        onSubmit,
        t,
        uiLangCode,
        selectedLanguage,
        handlePromptClick,
        trip: generator.result,
        isGenerating: generator.isGenerating,
        isRestoring,
        limitState: generator.limitState,
        // A 202 keeps its own inline notice: a toast is gone in four seconds
        // and the teacher still needs to be told where the trip went.
        stillGenerating:
            generator.error?.code === "STILL_GENERATING" ? generator.error.message : null,
        canUseAI,
        aiUnavailableReason,
    };
}
