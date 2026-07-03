"use client";

/**
 * useGenerator — the shared orchestration hook for every generator tool.
 *
 * Absorbs the state machine that was copy-pasted (with drift) across
 * quiz-generator, rubric-generator, worksheet-wizard, instant-answer and
 * exam-paper:
 *
 *   auth guard → Bearer headers → POST /api/ai/* → 401 / limit / 202 /
 *   malformed handling → result → done.
 *
 * Every hard-won production fix now lives here exactly once:
 *   - double-submit guard (submittingRef) — rapid clicks before React
 *     commits the loading state used to fire the API twice.
 *   - NCERT-demo 2026-05-19 malformed-response guard — a 200 with a
 *     garbage body must never render as "undefined undefined undefined".
 *   - 202 "still generating" branch — same demo, same day.
 *   - useLimitGuard wiring (403 PLAN_UPGRADE_REQUIRED / 429 limit / 503
 *     AI_SERVICE_BUSY) → UpgradePrompt instead of a generic toast.
 *   - abortable fetch — unmount or re-submit cancels the in-flight call.
 *
 * The hook is deliberately form-library agnostic: it takes plain `values`
 * so react-hook-form pages (quiz, rubric, worksheet, instant-answer) and
 * imperative-useState pages (exam-paper) share the same spine.
 *
 * See docs/design/proposals/05-frontend-arch.md §2a.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { useLimitGuard } from "@/hooks/use-limit-guard";
import {
    GeneratorError,
    GeneratorStatus,
    MalformedResponseError,
} from "../types";

export interface UseGeneratorConfig<TInput, TOutput> {
    /** Feature key — used for limit guard context + future analytics. */
    feature: string;
    /** API route, e.g. "/api/ai/quiz". */
    endpoint: string;
    /** Map validated form values to the POST body. */
    buildRequest: (values: TInput) => Record<string, unknown>;
    /**
     * Turn the raw 200 JSON body into the typed output. Throw
     * `MalformedResponseError` when the body is unusable — the hook maps it
     * to a MALFORMED_RESPONSE error instead of rendering garbage.
     */
    parseResponse: (json: unknown, values: TInput) => TOutput;
    /**
     * Optional pre-flight validation (beyond schema validation). Return an
     * error message to block the submit, or null to proceed.
     */
    validate?: (values: TInput) => string | null;
    /**
     * Whether to run the `requireAuth()` modal guard before submitting.
     * Default true. Exam-paper gates the whole page instead and sets false.
     */
    requireAuthOnSubmit?: boolean;
    /** Open the auth modal when the API answers 401. Default true. */
    openAuthModalOn401?: boolean;
    /** Message used for the AUTH_REQUIRED error (shown via onError). */
    authErrorMessage?: string;
    /** Fallback message when a 202 body carries no `message`. */
    stillGeneratingMessage?: string;
    /** Fallback message for generic request failures. */
    failureMessage?: string;
    /** Fired after a successful generation (checklist marks, snapshots…). */
    onSuccess?: (output: TOutput, values: TInput) => void;
    /**
     * Fired for user-visible errors (AUTH_REQUIRED / MALFORMED_RESPONSE /
     * STILL_GENERATING / VALIDATION / REQUEST_FAILED). Limit-guard errors
     * (PREMIUM_REQUIRED / LIMIT_REACHED / SERVICE_BUSY) do NOT fire it —
     * the UpgradePrompt renders from `limitState` instead, matching the
     * pre-migration behavior of quiz/worksheet.
     */
    onError?: (error: GeneratorError) => void;
}

export interface UseGeneratorReturn<TInput, TOutput> {
    status: GeneratorStatus;
    /** Convenience: status is "generating" or "streaming" or "validating". */
    isGenerating: boolean;
    result: TOutput | null;
    error: GeneratorError | null;
    /** Run one generation. Resolves when the run settles (any terminal state). */
    generate: (values: TInput) => Promise<void>;
    /** Abort the in-flight request, if any. */
    abort: () => void;
    /** Back to idle; clears result + error. */
    reset: () => void;
    /**
     * Escape hatch for restore-from-`?id` flows: pages fetch saved content
     * themselves and install it as the result (status becomes "done").
     */
    setResult: (result: TOutput | null) => void;
    limitState: ReturnType<typeof useLimitGuard>["limitState"];
    clearLimit: () => void;
}

export function useGenerator<TInput, TOutput>(
    config: UseGeneratorConfig<TInput, TOutput>,
): UseGeneratorReturn<TInput, TOutput> {
    const { requireAuth, openAuthModal } = useAuth();
    const { limitState, checkResponse, clearLimit } = useLimitGuard();

    const [status, setStatus] = useState<GeneratorStatus>("idle");
    const [result, setResultState] = useState<TOutput | null>(null);
    const [error, setError] = useState<GeneratorError | null>(null);

    // Double-submit guard: setState is async, so two clicks inside React's
    // batch window both pass an `if (isLoading)` check. A ref commits
    // synchronously and closes that window.
    const submittingRef = useRef(false);
    const abortRef = useRef<AbortController | null>(null);

    // Keep the latest config in a ref so `generate` stays referentially
    // stable without stale-closure bugs when callers pass inline lambdas.
    const configRef = useRef(config);
    configRef.current = config;

    useEffect(() => {
        return () => abortRef.current?.abort();
    }, []);

    const abort = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    const reset = useCallback(() => {
        setStatus("idle");
        setResultState(null);
        setError(null);
    }, []);

    const setResult = useCallback((next: TOutput | null) => {
        setResultState(next);
        setStatus(next ? "done" : "idle");
        setError(null);
    }, []);

    const fail = useCallback((err: GeneratorError, notify: boolean) => {
        setError(err);
        setStatus("error");
        if (notify) configRef.current.onError?.(err);
    }, []);

    const generate = useCallback(async (values: TInput) => {
        const cfg = configRef.current;
        if (submittingRef.current) return;
        submittingRef.current = true;

        try {
            if ((cfg.requireAuthOnSubmit ?? true) && !requireAuth()) {
                return;
            }

            setStatus("validating");
            setError(null);

            const validationMessage = cfg.validate?.(values) ?? null;
            if (validationMessage) {
                fail({ code: "VALIDATION", message: validationMessage }, true);
                return;
            }

            setStatus("generating");
            setResultState(null);

            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            const token = await auth.currentUser?.getIdToken();
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const res = await fetch(cfg.endpoint, {
                method: "POST",
                headers,
                body: JSON.stringify(cfg.buildRequest(values)),
                signal: controller.signal,
            });

            // 202 — the AI hit its timeout budget but is still working in the
            // background. Never render the in-progress envelope as a result.
            if (res.status === 202) {
                const body = await res.json().catch(() => ({} as Record<string, unknown>));
                fail({
                    code: "STILL_GENERATING",
                    message:
                        (body as { message?: string }).message ||
                        cfg.stillGeneratingMessage ||
                        "Still generating. Please check My Library in a minute, or try again.",
                }, true);
                return;
            }

            if (!res.ok) {
                if (res.status === 401) {
                    if (cfg.openAuthModalOn401 ?? true) openAuthModal();
                    fail({
                        code: "AUTH_REQUIRED",
                        message: cfg.authErrorMessage || "Please sign in to continue.",
                    }, true);
                    return;
                }

                const errorBody = await res.json().catch(() => ({} as Record<string, unknown>));

                // Plan/usage limits → UpgradePrompt via limitState; no toast.
                if (checkResponse(res.status, errorBody as Record<string, unknown>)) {
                    const body = errorBody as { error?: string; message?: string };
                    const code =
                        body.error === "PLAN_UPGRADE_REQUIRED"
                            ? "PREMIUM_REQUIRED"
                            : body.error === "AI_SERVICE_BUSY"
                                ? "SERVICE_BUSY"
                                : "LIMIT_REACHED";
                    fail({ code, message: body.message || "" }, false);
                    return;
                }

                const body = errorBody as { error?: string; message?: string };
                fail({
                    code: "REQUEST_FAILED",
                    message:
                        body.message ||
                        body.error ||
                        cfg.failureMessage ||
                        `Request failed (${res.status})`,
                }, true);
                return;
            }

            clearLimit();

            const json = await res.json();
            let output: TOutput;
            try {
                output = cfg.parseResponse(json, values);
            } catch (parseError) {
                if (parseError instanceof MalformedResponseError) {
                    fail({ code: "MALFORMED_RESPONSE", message: parseError.message }, true);
                    return;
                }
                throw parseError;
            }

            setResultState(output);
            setStatus("done");
            cfg.onSuccess?.(output, values);
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
                // Aborted runs settle silently back to idle — either the user
                // cancelled or the component unmounted mid-flight.
                setError({ code: "ABORTED", message: "" });
                setStatus("idle");
                return;
            }
            console.error(`[${configRef.current.feature}] generation failed:`, err);
            fail({
                code: "REQUEST_FAILED",
                message:
                    err instanceof Error
                        ? err.message
                        : configRef.current.failureMessage || "Something went wrong. Please try again.",
            }, true);
        } finally {
            submittingRef.current = false;
        }
    }, [requireAuth, openAuthModal, checkResponse, clearLimit, fail]);

    return {
        status,
        isGenerating:
            status === "validating" || status === "generating" || status === "streaming",
        result,
        error,
        generate,
        abort,
        reset,
        setResult,
        limitState,
        clearLimit,
    };
}
