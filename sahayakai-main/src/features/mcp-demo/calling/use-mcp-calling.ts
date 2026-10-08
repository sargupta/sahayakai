"use client";

import { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import type { OutreachReason } from "@/types/attendance";
import type { ParentCallResult, ParentContactsResult } from "@/lib/mcp/calling/schema";
import type { McpConnection } from "@/features/mcp-demo/lesson-planner/use-mcp-lesson-plan";

/** The server-side MCP client. The browser never talks to /api/mcp/calling (that needs the API key). */
export const MCP_CALLING_DEMO_ENDPOINT = "/api/mcp-demo/calling";

export type ContactClass = ParentContactsResult["classes"][number];
export type ContactStudent = ContactClass["students"][number];
export interface CallingError { category: string; message: string; retryable: boolean; retry_after_seconds?: number }
export interface CallInfo { tool: string; protocol: string; durationMs: number }

async function headers(): Promise<Record<string, string>> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    const token = await auth.currentUser?.getIdToken().catch(() => undefined);
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
}

async function post(body: unknown): Promise<{ ok: boolean; data: any }> {
    try {
        const res = await fetch(MCP_CALLING_DEMO_ENDPOINT, { method: "POST", headers: await headers(), body: JSON.stringify(body) });
        return { ok: res.ok, data: await res.json().catch(() => ({})) };
    } catch {
        return { ok: false, data: { error: { category: "network", message: "Network error. Please try again.", retryable: true } } };
    }
}

export function useMcpCalling() {
    const { user, loading: authLoading } = useAuth();
    // null until Firebase has restored the session: the demo API needs the ID token.
    const signedIn = authLoading ? null : !!user;
    const [connection, setConnection] = useState<McpConnection>({ state: "checking" });
    const [classes, setClasses] = useState<ContactClass[] | null>(null);
    const [listError, setListError] = useState<CallingError | null>(null);
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [activeStudent, setActiveStudent] = useState<ContactStudent | null>(null);
    const [calling, setCalling] = useState(false);
    const [callResult, setCallResult] = useState<ParentCallResult | null>(null);
    const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
    const [callError, setCallError] = useState<CallingError | null>(null);

    const checkConnection = useCallback(async () => {
        setConnection({ state: "checking" });
        try {
            const res = await fetch(MCP_CALLING_DEMO_ENDPOINT, { method: "GET", headers: await headers() });
            const body = await res.json().catch(() => ({}));
            setConnection(res.ok && body.connected && body.server ? { state: "connected", server: body.server } : { state: "unavailable", configured: body.configured !== false });
        } catch {
            setConnection({ state: "unavailable", configured: true });
        }
    }, []);

    const loadContacts = useCallback(async () => {
        setListError(null);
        const { ok, data } = await post({ action: "list" });
        if (ok && data.result) {
            setClasses(data.result.classes);
            setSelectedClassId((cur) => cur ?? data.result.classes[0]?.class_id ?? null);
        } else {
            setClasses([]);
            setListError(data.error ?? { category: "internal", message: "Could not load classes.", retryable: true });
        }
    }, []);

    useEffect(() => {
        if (signedIn === true) {
            void checkConnection();
            void loadContacts();
        } else if (signedIn === false) {
            setConnection({ state: "unavailable", configured: true });
            setClasses([]);
            setListError({ category: "authentication", message: "Sign in to Sahayak to use this demo.", retryable: false });
        }
    }, [signedIn, checkConnection, loadContacts]);

    const openContact = (student: ContactStudent) => {
        setActiveStudent(student);
        setCallResult(null);
        setCallInfo(null);
        setCallError(null);
    };
    const closeContact = () => { if (!calling) setActiveStudent(null); };

    const placeCall = useCallback(async (reason: OutreachReason, note: string) => {
        if (!activeStudent || !selectedClassId) return;
        setCalling(true);
        setCallError(null);
        const { ok, data } = await post({
            action: "call",
            class_id: selectedClassId,
            student_id: activeStudent.student_id,
            reason,
            ...(note.trim() ? { teacher_note: note.trim() } : {}),
        });
        if (ok && data.result) {
            setCallResult(data.result);
            setCallInfo({ tool: data.mcp.tool, protocol: data.mcp.protocol, durationMs: data.mcp.durationMs });
        } else {
            setCallError(data.error ?? { category: "internal", message: "The call could not be started.", retryable: true });
        }
        setCalling(false);
    }, [activeStudent, selectedClassId]);

    const selectedClass = classes?.find((c) => c.class_id === selectedClassId) ?? null;

    return {
        connection, checkConnection, classes, listError, loadContacts, selectedClass, setSelectedClassId,
        activeStudent, openContact, closeContact, placeCall, calling, callResult, callInfo, callError,
    };
}
