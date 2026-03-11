"use client";

import { useState, useRef, useCallback } from "react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage, auth } from "@/lib/firebase";
import { Mic, Square, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceRecorderProps {
    onSend: (audioUrl: string, duration: number) => void;
    disabled?: boolean;
}

type RecorderState = "idle" | "recording" | "uploading";

export function VoiceRecorder({ onSend, disabled }: VoiceRecorderProps) {
    const [state, setState] = useState<RecorderState>("idle");
    const [elapsed, setElapsed] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);

    const stopTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const startRecording = useCallback(async () => {
        if (disabled) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : "audio/mp4";
            const recorder = new MediaRecorder(stream, { mimeType });
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                stream.getTracks().forEach((t) => t.stop());
                const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
                const blob = new Blob(chunksRef.current, { type: mimeType });
                await uploadAudio(blob, mimeType, duration);
            };

            recorder.start(250);
            mediaRecorderRef.current = recorder;
            startTimeRef.current = Date.now();
            setState("recording");
            setElapsed(0);

            timerRef.current = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 1000);
        } catch {
            // Microphone access denied or not available — fail silently
        }
    }, [disabled]);

    const stopRecording = useCallback(() => {
        stopTimer();
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            setState("uploading");
            mediaRecorderRef.current.stop();
        }
    }, []);

    const cancelRecording = useCallback(() => {
        stopTimer();
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
            // Cancel — discard chunks after stop
            recorder.ondataavailable = null;
            recorder.onstop = () => {
                recorder.stream?.getTracks().forEach((t) => t.stop());
            };
            recorder.stop();
        }
        chunksRef.current = [];
        setState("idle");
        setElapsed(0);
    }, []);

    const uploadAudio = async (blob: Blob, mimeType: string, duration: number) => {
        const user = auth.currentUser;
        if (!user) { setState("idle"); return; }

        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        const path = `voice-messages/${user.uid}/${Date.now()}.${ext}`;
        const storageRef = ref(storage, path);

        try {
            const task = uploadBytesResumable(storageRef, blob, { contentType: mimeType });
            await new Promise<void>((resolve, reject) => {
                task.on("state_changed", null, reject, resolve);
            });
            const url = await getDownloadURL(storageRef);
            onSend(url, duration);
        } catch {
            // Upload failed — reset silently
        } finally {
            setState("idle");
            setElapsed(0);
        }
    };

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

    if (state === "uploading") {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                <Loader2 className="h-4 w-4 animate-spin text-orange-500 shrink-0" />
                <span className="text-xs text-slate-500 font-medium">Sending…</span>
            </div>
        );
    }

    if (state === "recording") {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
                {/* Pulse dot */}
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                <span className="text-xs font-bold text-red-600 tabular-nums min-w-[36px]">
                    {formatTime(elapsed)}
                </span>
                {/* Cancel */}
                <button
                    onClick={cancelRecording}
                    className="ml-1 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Cancel"
                >
                    <X className="h-4 w-4" />
                </button>
                {/* Stop + send */}
                <button
                    onClick={stopRecording}
                    className="flex items-center gap-1 h-8 px-3 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all active:scale-95 shrink-0"
                >
                    <Square className="h-3 w-3 fill-white" />
                    Send
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={startRecording}
            disabled={disabled}
            className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center transition-all active:scale-95",
                "text-slate-400 hover:text-orange-500 hover:bg-orange-50",
                "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
            title="Record voice message"
        >
            <Mic className="h-4 w-4" />
        </button>
    );
}
