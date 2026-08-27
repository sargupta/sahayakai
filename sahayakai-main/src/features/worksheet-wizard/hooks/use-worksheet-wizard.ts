"use client";

/**
 * useWorksheetWizard — all worksheet-wizard logic, zero markup.
 * Composes the shared useGenerator spine; keeps worksheet-specific
 * behavior: VIDYA form sync + snapshot restore, restore-from-`?id`
 * (guarded per param set, not per mount), VIDYA URL prefill + 300ms
 * auto-submit gated on the required image, markdown download.
 */

import { useEffect, useRef, useState } from "react";
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
import {
    normaliseVidyaLanguage,
    normaliseVidyaGradeLevel,
    vidyaDeepLinkKey,
} from "@/lib/vidya-action-normalizer";
import { MalformedResponseError, useGenerator } from "@/features/generator";
import { worksheetTranslations } from "../i18n";
import { formSchema, type FormValues, type WorksheetResult } from "../types";

/**
 * Every URL param the deep-link effect below reads. The guard is keyed over
 * this exact list, so a param added to the effect must be added here too or
 * a link that differs only in that param reads as already-handled.
 */
const DEEP_LINK_PARAMS = [
    "id",
    "prompt",
    "topic",
    "subject",
    "gradeLevel",
    "language",
] as const;

export function useWorksheetWizard() {
    const { language: userLanguage, t: translate } = useLanguage();
    const { toast } = useToast();
    const { canUseAI, aiUnavailableReason } = useNetworkAware();
    const { clearFormSnapshot } = useJarvisStore();
    const searchParams = useSearchParams();
    // The deep link this hook has already acted on, not merely "some deep
    // link has been acted on". See vidyaDeepLinkKey().
    const handledDeepLink = useRef<string | null>(null);
    /** Pending deep-link auto-submit, so a newer link can supersede it. */
    const autoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(autoSubmitTimerRef.current), []);
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
        // `worksheetContent` (Markdown) is the whole result — WorksheetDisplay
        // renders nothing without it. A 200 that omits it is a malformed
        // response, not an empty worksheet, so say so instead of showing the
        // teacher a blank page under a "done" state.
        parseResponse: (json) => {
            const content = (json as { worksheetContent?: string }).worksheetContent;
            if (typeof content !== "string" || !content.trim()) {
                throw new MalformedResponseError(
                    translate("The AI returned an incomplete worksheet. Please try again."),
                );
            }
            return content;
        },
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
        // Read `topic` as well — see the pre-fill effect below — or a VIDYA
        // deep link reads as "no URL params" and the snapshot overwrites it.
        const promptParam = searchParams.get("prompt") || searchParams.get("topic");
        const id = searchParams.get("id");
        if (promptParam || id || !savedSnapshot) return;
        if (savedSnapshot.prompt) form.setValue("prompt", savedSnapshot.prompt);
        if (savedSnapshot.gradeLevel) form.setValue("gradeLevel", savedSnapshot.gradeLevel);
        if (savedSnapshot.subject) form.setValue("subject", savedSnapshot.subject);
        if (savedSnapshot.language) form.setValue("language", savedSnapshot.language);
    }, []); // empty array: runs once on mount only

    useEffect(() => {
        // Run the URL branch once PER PARAM SET. Without a guard the effect
        // re-fires on every searchParams identity change and re-runs the
        // restore fetch (or the pre-fill) over whatever the teacher has since
        // typed. With a guard keyed to the mount instead of to the query, the
        // opposite failure: VIDYA is mounted app-wide and pushes client-side
        // into this same route segment, so a SECOND worksheet request from a
        // teacher already standing here would be dropped and the page would
        // keep answering the request before it. Claim the key, not the mount.
        const deepLinkKey = vidyaDeepLinkKey(searchParams, DEEP_LINK_PARAMS);
        if (handledDeepLink.current === deepLinkKey) return;
        // Claim BEFORE the branches: the `?id=` restore awaits a fetch, and
        // setting the claim after it resolves leaves the whole round trip
        // unguarded — any re-render in that window starts a second request.
        handledDeepLink.current = deepLinkKey;

        const id = searchParams.get("id");
        // The intent route, the agent router and the voice assistant all build
        // `/worksheet-wizard?topic=...`; the SOUL prompt reserves `prompt` for
        // visual-aid-designer, so nothing upstream ever emitted the name this
        // form used to read. Accept both, most specific first — same shape as
        // visual-aid-designer (`prompt || topic`).
        const promptParam = searchParams.get("prompt") || searchParams.get("topic");

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
                            // Records written by the sidecar path before the
                            // dispatcher filled worksheetContent have every
                            // structured field and no body. The old fallback
                            // installed that object AS the result, and the
                            // display then rendered an object as a React
                            // child. Restore only a real Markdown body, and
                            // say so when there isn't one rather than
                            // reopening the page silently blank.
                            const saved = content.data.worksheetContent;
                            if (typeof saved === "string" && saved.trim()) {
                                generator.setResult(saved);
                            } else {
                                toast({
                                    title: translate("Load Failed"),
                                    description: translate("Could not load the saved worksheet."),
                                    variant: "destructive",
                                });
                            }
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
            // ── Auto-generate when VIDYA navigates here with a pre-filled prompt,
            // but ONLY once the image the schema requires is actually present.
            // Worksheet is the one deep-link destination with a mandatory
            // upload (types.ts: imageDataUri, min 1, "Please upload an image."),
            // and no producer can put a photo of the teacher's textbook page in
            // a query string. Submitting regardless just runs handleSubmit into
            // the resolver and paints a red "Please upload an image." over a
            // form the teacher has not touched yet. Read the value inside the
            // timer rather than when scheduling it, so an upload that lands
            // during those 300 ms still gets the free run.
            // A second deep link arriving inside these 300 ms would otherwise
            // leave the first timer pending: both then fire against the form's
            // newer values, so the second request generates twice and the first
            // is dropped. Reachable because OmniOrb renders a compound request
            // as one-shot chips (omni-orb.tsx:738-744) and survives the
            // client-side navigation. Cancel any superseded timer here rather
            // than in an effect cleanup — the effect re-runs on `form`/`toast`
            // identity and the per-query guard then declines to reschedule, so
            // a blanket cleanup cancels the auto-submit outright.
            clearTimeout(autoSubmitTimerRef.current);
            autoSubmitTimerRef.current = setTimeout(() => {
                const image = form.getValues("imageDataUri");
                if (!image || !image.trim()) return;
                form.handleSubmit(onSubmit)();
            }, 300);
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
