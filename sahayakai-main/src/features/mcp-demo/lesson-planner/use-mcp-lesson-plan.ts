"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import type { NCERTChapter } from "@/data/ncert";
import type { ResourceLevel } from "@/components/resource-selector";
import type { DifficultyLevel } from "@/components/difficulty-selector";
import type { LessonPlanResult } from "@/lib/mcp/lesson-planner/schema";
import { mcpDemoFormSchema, prefillFromSearchParams, toMcpArguments, type McpDemoFormValues } from "./mapping";

/** Endpoint of the server-side MCP client (never the MCP server itself — that needs the API key). */
export const MCP_DEMO_ENDPOINT = "/api/mcp-demo/lesson-planner";

export type McpConnection =
    | { state: "checking" }
    | { state: "connected"; server: { name: string; version: string; tool: string; protocol: string } }
    | { state: "unavailable"; configured: boolean };

export interface McpGenerationInfo {
    server: string;
    version: string;
    tool: string;
    protocol: string;
    durationMs: number;
}

export interface McpDemoError {
    category: string;
    message: string;
    retryable: boolean;
}

async function authHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = await auth.currentUser?.getIdToken().catch(() => undefined);
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

export function useMcpLessonPlan() {
    const searchParams = useSearchParams();
    // URL prefill (same idea as the app page's ?topic=&grade= params). Read once and used as the
    // form's initial values; never auto-submits.
    const prefill = useMemo(() => prefillFromSearchParams(new URLSearchParams(searchParams?.toString() ?? "")), [searchParams]);
    const [resourceLevel, setResourceLevel] = useState<ResourceLevel>("low");
    const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>(prefill.difficulty ?? "standard");
    const [useLocalContext, setUseLocalContext] = useState(true);
    const [selectedChapter, setSelectedChapter] = useState<NCERTChapter | null>(null);
    const [connection, setConnection] = useState<McpConnection>({ state: "checking" });
    const [isLoading, setIsLoading] = useState(false);
    const [lessonPlan, setLessonPlan] = useState<LessonPlanResult | null>(null);
    const [generation, setGeneration] = useState<McpGenerationInfo | null>(null);
    const [error, setError] = useState<McpDemoError | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const lastValues = useRef<McpDemoFormValues | null>(null);

    const form = useForm<McpDemoFormValues>({
        resolver: zodResolver(mcpDemoFormSchema),
        defaultValues: {
            topic: prefill.topic ?? "",
            gradeLevels: prefill.gradeLevels ?? [],
            subject: prefill.subject,
            language: prefill.language ?? "English",
        },
    });

    const checkConnection = useCallback(async () => {
        setConnection({ state: "checking" });
        try {
            const res = await fetch(MCP_DEMO_ENDPOINT, { method: "GET", headers: await authHeaders() });
            const body = await res.json().catch(() => ({}));
            if (res.ok && body.connected && body.server) setConnection({ state: "connected", server: body.server });
            else setConnection({ state: "unavailable", configured: body.configured !== false });
        } catch {
            setConnection({ state: "unavailable", configured: true });
        }
    }, []);

    useEffect(() => { void checkConnection(); }, [checkConnection]);

    const generate = useCallback(async (values: McpDemoFormValues) => {
        lastValues.current = values;
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setIsLoading(true);
        setError(null);
        setLessonPlan(null);
        setGeneration(null);
        try {
            const args = toMcpArguments(values, { resourceLevel, difficultyLevel, useLocalContext, chapter: selectedChapter });
            const res = await fetch(MCP_DEMO_ENDPOINT, {
                method: "POST",
                headers: await authHeaders(),
                body: JSON.stringify(args),
                signal: controller.signal,
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body.plan) {
                setError({
                    category: body?.error?.category ?? "internal",
                    message: body?.error?.message ?? "The lesson plan could not be generated. Please try again.",
                    retryable: body?.error?.retryable ?? true,
                });
                return;
            }
            setLessonPlan(body.plan);
            setGeneration({ server: body.mcp.name, version: body.mcp.version, tool: body.mcp.tool, protocol: body.mcp.protocol, durationMs: body.mcp.durationMs });
            setConnection({ state: "connected", server: { name: body.mcp.name, version: body.mcp.version, tool: body.mcp.tool, protocol: body.mcp.protocol } });
        } catch (e) {
            if ((e as Error)?.name === "AbortError") return;
            setError({ category: "network", message: "Network error. Please try again.", retryable: true });
        } finally {
            if (abortRef.current === controller) {
                abortRef.current = null;
                setIsLoading(false);
            }
        }
    }, [resourceLevel, difficultyLevel, useLocalContext, selectedChapter]);

    const retry = useCallback(() => {
        if (lastValues.current) void generate(lastValues.current);
    }, [generate]);

    const cancel = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        setIsLoading(false);
    }, []);

    useEffect(() => () => abortRef.current?.abort(), []);

    const currentGrade = (() => {
        const label = form.watch("gradeLevels")?.[0];
        const m = /(\d{1,2})/.exec(label ?? "");
        return m ? Number(m[1]) : undefined;
    })();

    return {
        form,
        onSubmit: generate,
        retry,
        cancel,
        isLoading,
        lessonPlan,
        generation,
        error,
        connection,
        checkConnection,
        resourceLevel,
        setResourceLevel,
        difficultyLevel,
        setDifficultyLevel,
        useLocalContext,
        setUseLocalContext,
        selectedChapter,
        setSelectedChapter,
        currentGrade,
    };
}
