"use client";

/**
 * OmniOrbLive — Phase S spike, NOT for production traffic.
 *
 * Companion to the existing `<OmniOrb />` (typed pipeline). This
 * component connects the browser directly to Gemini Live over a
 * WebSocket and streams microphone audio in / TTS audio + tool calls
 * out, end-to-end ~500ms first-byte (vs ~3-8s on the typed pipeline).
 *
 * Flow:
 *   1. POST /api/vidya-voice/start-session  (Next.js → sidecar)
 *      → response: { sessionToken, wssUrl, sessionConfig, tools }
 *   2. open WebSocket to Live with the ephemeral token
 *   3. send `setup` frame with tools array
 *   4. push mic frames, play response audio, dispatch tool events
 *
 * What this spike DOES prove:
 *   - The session-token mint round-trip works end-to-end
 *   - Audio bytes never traverse the sidecar (browser ↔ Live direct)
 *   - Tool calls map 1:1 to existing `NAVIGATE_AND_FILL` flows
 *
 * What this spike does NOT do (intentionally):
 *   - Behavioural guard on partial transcripts (Phase 2 spike covers this)
 *   - Reconnect / resume on network drop (Phase 2 §2.3)
 *   - Quality-parity vs Cloud TTS Neural2 (needs blind A/B per SPIKE.md §6)
 *
 * Untested in CI. Gated behind a feature flag `voice_mode === "live"`
 * once Phase S.2 ships. Until then this file is opted out of the
 * production bundle by NOT being imported anywhere.
 */

import React, { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

// ─── Wire types (mirror sahayakai-agents/.../vidya_voice/schemas.py) ──────

type LiveAllowedFlow =
    | "lesson-plan"
    | "quiz-generator"
    | "visual-aid-designer"
    | "worksheet-wizard"
    | "virtual-field-trip"
    | "teacher-training"
    | "rubric-generator"
    | "exam-paper"
    | "video-storyteller";

interface LiveToolDefinition {
    name: string;
    description: string;
    flow: LiveAllowedFlow;
}

interface LiveSessionConfig {
    model: string;
    voice: string;
    responseModalities: ("AUDIO" | "TEXT")[];
    languageCode: string | null;
}

interface SessionStartResponse {
    sessionToken: string;
    wssUrl: string;
    expiresInSeconds: number;
    sessionConfig: LiveSessionConfig;
    tools: LiveToolDefinition[];
    sidecarVersion: string;
    spike: boolean;
}

// ─── Authenticated POST to the sidecar via the Next.js proxy ──────────────

async function startLiveSession(
    teacherProfile: SessionStartRequestBody["teacherProfile"],
    screenPath: string,
    detectedLanguage: string | null,
): Promise<SessionStartResponse | null> {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return null;
    const res = await fetch("/api/vidya-voice/start-session", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
            teacherProfile,
            currentScreenContext: { path: screenPath, uiState: null },
            detectedLanguage,
        } satisfies SessionStartRequestBody),
    });
    if (!res.ok) return null;
    return (await res.json()) as SessionStartResponse;
}

interface SessionStartRequestBody {
    teacherProfile: {
        preferredGrade: string | null;
        preferredSubject: string | null;
        preferredLanguage: string | null;
        schoolContext: string | null;
    };
    currentScreenContext: { path: string; uiState: Record<string, string> | null };
    detectedLanguage: string | null;
}

// ─── The component ────────────────────────────────────────────────────────

interface OmniOrbLiveProps {
    teacherProfile: SessionStartRequestBody["teacherProfile"];
    screenPath: string;
    detectedLanguage: string | null;
}

export function OmniOrbLive({
    teacherProfile,
    screenPath,
    detectedLanguage,
}: OmniOrbLiveProps): React.ReactElement {
    const router = useRouter();
    const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
    const [error, setError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    const handleToolCall = useCallback(
        (toolName: string, params: Record<string, unknown>) => {
            // Map Live tool names back to NAVIGATE_AND_FILL flows.
            // Same shape as the existing dispatcher so client-side
            // routing logic doesn't fork.
            const flow = toolName.replace(/^open_/, "").replace(/_/g, "-");
            const query = new URLSearchParams();
            for (const [k, v] of Object.entries(params)) {
                if (v != null) query.set(k, String(v));
            }
            router.push(`/${flow}?${query.toString()}`);
        },
        [router],
    );

    const start = useCallback(async () => {
        setStatus("connecting");
        setError(null);
        try {
            const session = await startLiveSession(
                teacherProfile,
                screenPath,
                detectedLanguage,
            );
            if (!session) {
                throw new Error("start-session returned null (auth or sidecar issue)");
            }

            // Open the WSS connection to Live with the ephemeral token.
            const url = `${session.wssUrl}?access_token=${encodeURIComponent(session.sessionToken)}`;
            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                // Send the `setup` frame Gemini Live expects on first message.
                // Tools array surfaces the 9 NAVIGATE_AND_FILL flows.
                ws.send(
                    JSON.stringify({
                        setup: {
                            model: session.sessionConfig.model,
                            generationConfig: {
                                responseModalities: session.sessionConfig.responseModalities,
                                speechConfig: {
                                    voiceConfig: {
                                        prebuiltVoiceConfig: {
                                            voiceName: session.sessionConfig.voice,
                                        },
                                    },
                                },
                            },
                            tools: [
                                {
                                    functionDeclarations: session.tools.map(t => ({
                                        name: t.name,
                                        description: t.description,
                                        parameters: {
                                            type: "OBJECT",
                                            properties: {
                                                topic: { type: "STRING" },
                                                gradeLevel: { type: "STRING" },
                                                subject: { type: "STRING" },
                                                language: { type: "STRING" },
                                            },
                                        },
                                    })),
                                },
                            ],
                        },
                    }),
                );
                setStatus("live");
            };

            ws.onmessage = async (evt) => {
                // Live sends JSON frames OR binary audio chunks. The
                // browser API delivers both as `MessageEvent.data`.
                if (typeof evt.data === "string") {
                    const frame = JSON.parse(evt.data) as Record<string, unknown>;
                    // Tool call: dispatch to NAVIGATE_AND_FILL.
                    const toolCall = frame.toolCall as
                        | { functionCalls: { name: string; args: Record<string, unknown> }[] }
                        | undefined;
                    if (toolCall?.functionCalls) {
                        for (const call of toolCall.functionCalls) {
                            handleToolCall(call.name, call.args);
                        }
                    }
                    return;
                }
                // Binary audio chunk — decode + play.
                const ctx = audioContextRef.current ?? new AudioContext({ sampleRate: 24000 });
                audioContextRef.current = ctx;
                const buf = await evt.data.arrayBuffer();
                const audioBuf = await ctx.decodeAudioData(buf.slice(0));
                const src = ctx.createBufferSource();
                src.buffer = audioBuf;
                src.connect(ctx.destination);
                src.start();
            };

            ws.onerror = (e) => {
                setError(`WebSocket error: ${String(e)}`);
                setStatus("error");
            };

            ws.onclose = () => {
                setStatus("idle");
                wsRef.current = null;
            };

            // Mic capture — push audio chunks as binary frames.
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
            mediaRecorderRef.current = recorder;
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                    ws.send(e.data);
                }
            };
            recorder.start(100); // 100ms chunks ≈ Live's expected frame cadence
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setStatus("error");
        }
    }, [teacherProfile, screenPath, detectedLanguage, handleToolCall]);

    const stop = useCallback(() => {
        mediaRecorderRef.current?.stop();
        mediaRecorderRef.current = null;
        wsRef.current?.close();
        wsRef.current = null;
        audioContextRef.current?.close();
        audioContextRef.current = null;
        setStatus("idle");
    }, []);

    // NOTE: this component renders a spike-only UI used by the
    // developer running it locally — it is NOT imported into the
    // production bundle and is NEVER shown to teachers. All user-
    // facing text on the production OmniOrb is t()-wrapped via
    // language-context. When this spike graduates to a feature-
    // flagged surface (Phase S.2), every visible string here MUST
    // be re-wired through t() and added to language-context for
    // all 11 supported languages — see AGENTS.md gate 1.
    return (
        <div className="omni-orb-live-spike" data-status={status}>
            {status === "idle" && (
                <button
                    onClick={start}
                    type="button"
                    aria-label="start-live-spike"
                />
            )}
            {status === "connecting" && (
                <span aria-busy="true" aria-label="connecting-live-spike" />
            )}
            {status === "live" && (
                <button
                    onClick={stop}
                    type="button"
                    aria-label="stop-live-spike"
                />
            )}
            {status === "error" && (
                <span
                    role="alert"
                    data-error={error ?? "unknown"}
                    aria-label="error-live-spike"
                />
            )}
        </div>
    );
}
