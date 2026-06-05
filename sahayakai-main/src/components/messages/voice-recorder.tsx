"use client";

import { useState, useRef, useCallback } from "react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage, auth } from "@/lib/firebase";
import { Mic, Square, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";

interface VoiceRecorderProps {
    onSend: (audioUrl: string, duration: number) => void;
    disabled?: boolean;
}

type RecorderState = "idle" | "recording" | "uploading";

export function VoiceRecorder({ onSend, disabled }: VoiceRecorderProps) {
    const { t } = useLanguage();
    const { toast } = useToast();
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
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
            toast({
                title: t("Recording not supported"),
                description: t("Your browser does not support voice recording."),
                variant: "destructive",
            });
            return;
        }
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            // getUserMedia rejects on permission-denied or no mic — surface it instead of swallowing.
            toast({
                title: t("Microphone unavailable"),
                description: t("Please allow microphone access to record a voice message."),
                variant: "destructive",
            });
            return;
        }
        try {
            // Pick the first MIME the browser actually supports. Chrome/Android → webm/opus,
            // Safari/iOS → mp4. Falling back to "" lets the browser choose its own default.
            const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
            const mimeType = candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? "";
            const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            // The actual container the browser writes (may differ from our requested mimeType).
            const effectiveMime = recorder.mimeType || mimeType || "audio/webm";
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                stream.getTracks().forEach((tr) => tr.stop());
                const duration = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
                const blob = new Blob(chunksRef.current, { type: effectiveMime });
                if (blob.size === 0) {
                    // No audio captured — don't upload an empty file or send a broken message.
                    setState("idle");
                    setElapsed(0);
                    toast({
                        title: t("Nothing recorded"),
                        description: t("No audio was captured. Please try again."),
                        variant: "destructive",
                    });
                    return;
                }
                await uploadAudio(blob, effectiveMime, duration);
            };

            recorder.onerror = () => {
                stream.getTracks().forEach((tr) => tr.stop());
                stopTimer();
                setState("idle");
                setElapsed(0);
                toast({
                    title: t("Recording failed"),
                    description: t("Something went wrong while recording. Please try again."),
                    variant: "destructive",
                });
            };

            // Timeslice fires ondataavailable periodically so the blob is never empty
            // even if stop() is called immediately on a very short clip.
            recorder.start(250);
            mediaRecorderRef.current = recorder;
            startTimeRef.current = Date.now();
            setState("recording");
            setElapsed(0);

            timerRef.current = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 1000);
        } catch {
            stream.getTracks().forEach((tr) => tr.stop());
            toast({
                title: t("Recording failed"),
                description: t("Could not start recording. Please try again."),
                variant: "destructive",
            });
        }
    }, [disabled, t, toast]);

    const stopRecording = useCallback(() => {
        stopTimer();
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
            setState("uploading");
            // Flush any buffered data before stopping so the final chunk isn't lost
            // on browsers that only emit on the timeslice boundary.
            try { if (recorder.state === "recording") recorder.requestData(); } catch { /* not all browsers support requestData */ }
            recorder.stop();
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
        if (!user) {
            setState("idle");
            toast({
                title: t("Sign in required"),
                description: t("Please sign in to send a voice message."),
                variant: "destructive",
            });
            return;
        }

        const ext = mimeType.includes("mp4") || mimeType.includes("mpeg") || mimeType.includes("aac")
            ? "m4a"
            : "webm";
        // Firestore storage expects a content type without the codecs= suffix.
        const contentType = mimeType.split(";")[0] || "audio/webm";
        const path = `voice-messages/${user.uid}/${Date.now()}.${ext}`;
        const storageRef = ref(storage, path);

        try {
            const task = uploadBytesResumable(storageRef, blob, { contentType });
            await new Promise<void>((resolve, reject) => {
                task.on("state_changed", null, reject, resolve);
            });
            const url = await getDownloadURL(storageRef);
            onSend(url, duration);
        } catch (err: any) {
            // Surface upload failures (most commonly Storage rules denying the
            // voice-messages/{uid}/ path, or a network error) instead of failing silently.
            // QA #13 (2026-06-02): split the permission-denied case so we tell
            // the user it's a server-side config issue, not their connection —
            // before storage.rules landed, every upload returned this code and
            // we were misattributing it to flaky internet.
            const code = err?.code ?? '';
            const isPermissionDenied =
                code === 'storage/unauthorized' ||
                code === 'storage/unauthenticated' ||
                /unauthorized|permission|denied/i.test(err?.message ?? '');
            console.error('[voice-recorder] upload failed', { code, message: err?.message });
            toast({
                title: t("Could not send voice message"),
                description: isPermissionDenied
                    ? t("Voice messages are not enabled on this account yet. Please try again later or contact support.")
                    : t("Upload failed. Please check your connection and try again."),
                variant: "destructive",
            });
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
                <span className="text-xs text-slate-500 font-medium">{t("Sending…")}</span>
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
                    title={t("Cancel")}
                >
                    <X className="h-4 w-4" />
                </button>
                {/* Stop + send */}
                <button
                    onClick={stopRecording}
                    className="flex items-center gap-1 h-8 px-3 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all active:scale-95 shrink-0"
                >
                    <Square className="h-3 w-3 fill-white" />
                    {t("Send")}
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
            title={t("Record voice message")}
        >
            <Mic className="h-4 w-4" />
        </button>
    );
}
