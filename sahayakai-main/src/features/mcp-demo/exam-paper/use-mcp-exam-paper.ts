"use client";

import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/context/auth-context';
import type { ExamPaperResult } from '@/lib/mcp/exam-paper/schema';
import { toMcpArguments, type ExamPaperFormValues } from './mapping';

const ENDPOINT = '/api/mcp-demo/exam-paper';
export type McpConnection =
    | { state: 'checking' }
    | { state: 'connected'; server: { name: string; version: string; tool: string; protocol: string } }
    | { state: 'unavailable'; configured: boolean };
export interface McpError { category: string; message: string; retryable: boolean }
export interface McpGenerationInfo { tool: string; protocol: string; durationMs: number }

async function authHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = await auth.currentUser?.getIdToken().catch(() => undefined);
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

export function useMcpExamPaper() {
    const { user, loading: authLoading } = useAuth();
    // null until Firebase has restored the session: the demo API needs the ID token.
    const signedIn = authLoading ? null : !!user;
    const [connection, setConnection] = useState<McpConnection>({ state: 'checking' });
    const [paper, setPaper] = useState<ExamPaperResult | null>(null);
    const [generation, setGeneration] = useState<McpGenerationInfo | null>(null);
    const [error, setError] = useState<McpError | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const checkConnection = useCallback(async () => {
        setConnection({ state: 'checking' });
        try {
            const response = await fetch(ENDPOINT, { headers: await authHeaders(), cache: 'no-store' });
            const body = await response.json().catch(() => ({}));
            if (response.ok && body.connected && body.server) setConnection({ state: 'connected', server: body.server });
            else setConnection({ state: 'unavailable', configured: body.configured !== false });
        } catch {
            setConnection({ state: 'unavailable', configured: true });
        }
    }, []);

    useEffect(() => {
        if (signedIn === true) void checkConnection();
        else if (signedIn === false) setConnection({ state: 'unavailable', configured: true });
    }, [signedIn, checkConnection]);

    const generate = useCallback(async (values: ExamPaperFormValues) => {
        setIsLoading(true);
        setError(null);
        setPaper(null);
        setGeneration(null);
        try {
            const response = await fetch(ENDPOINT, {
                method: 'POST',
                headers: await authHeaders(),
                body: JSON.stringify(toMcpArguments(values)),
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok || !body.paper) {
                setError({
                    category: body?.error?.category ?? 'internal',
                    message: body?.error?.message ?? 'The exam paper could not be generated. Please try again.',
                    retryable: body?.error?.retryable ?? true,
                });
                return;
            }
            setPaper(body.paper as ExamPaperResult);
            setGeneration({ tool: body.mcp.tool, protocol: body.mcp.protocol, durationMs: body.mcp.durationMs });
            setConnection({ state: 'connected', server: { name: body.mcp.name, version: body.mcp.version, tool: body.mcp.tool, protocol: body.mcp.protocol } });
        } catch {
            setError({ category: 'network', message: 'Network error. Please try again.', retryable: true });
        } finally {
            setIsLoading(false);
        }
    }, []);

    return { signedIn, connection, checkConnection, paper, generation, error, isLoading, generate };
}
