"use client";

import { auth } from "@/lib/firebase";
import { Button, ButtonProps } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/client-logger";
import { tts } from "@/lib/tts";
import { Mic, StopCircle, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FC } from "react";

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

type MicStatus = 'idle' | 'greeting' | 'initializing' | 'recording' | 'processing';

type MicrophoneInputProps = {
  onTranscriptChange: (transcript: string, language?: string) => void;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  isFloating?: boolean;
  label?: string;
  iconSize?: "sm" | "md" | "lg" | "xl";
};

export const MicrophoneInput: FC<MicrophoneInputProps> = ({
  onTranscriptChange,
  className,
  variant = "default",
  size = "default",
  isFloating = false,
  label,
  iconSize = "md"
}) => {
  const [status, setStatus] = useState<MicStatus>('idle');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const { toast } = useToast();

  const maxVolumeRef = useRef<number>(0);
  const sustainedSpeechFramesRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const failsafeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordedMimeTypeRef = useRef<string>("");
  const abortControllerRef = useRef<AbortController | null>(null);

  // VAD State Refs
  const isSpeakingRef = useRef<boolean>(false);
  const silenceStartTimeRef = useRef<number | null>(null);
  const speechStartTimeRef = useRef<number | null>(null);

  // Greeting Ref
  const hasGreetedRef = useRef<boolean>(false);

  // Web Speech Fallback Ref
  const fallbackTranscriptRef = useRef<string>("");
  const recognitionRef = useRef<any>(null);

  const SPEECH_THRESHOLD = 25; // Slightly increased threshold to reject fan/AC noise
  const SILENCE_DURATION_MS = 2500;
  const INITIAL_SILENCE_TIMEOUT_MS = 5000; // Time allowed before speaking starts
  const MAX_RECORDING_TIME_MS = 30000;
  const MAX_RETRIES = 3;
  // Minimum consecutive frames above threshold before we consider it real speech
  // (avoids a single loud frame — cough, door slam — triggering the short silence window)
  const MIN_SPEECH_FRAMES = 3;

  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current || !audioContextRef.current) return;
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    const canvasCtx = canvas.getContext("2d");
    if (!canvasCtx) return;

    const bufferLength = analyser.frequencyBinCount;
    // VAD: Use Frequency Data instead of Time Domain for noise rejection
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    // Calculate Volume for Silence Detection (VAD) within human vocal range
    // Human voice: Approx 300Hz to 3000Hz.
    let voiceEnergy = 0;
    const startIndex = Math.floor(300 / (audioContextRef.current.sampleRate / 2 / bufferLength));
    const endIndex = Math.floor(3000 / (audioContextRef.current.sampleRate / 2 / bufferLength));

    for (let i = Math.max(0, startIndex); i < Math.min(bufferLength, endIndex); i++) {
      voiceEnergy += dataArray[i];
    }
    const maxVal = voiceEnergy / Math.max(1, (endIndex - startIndex));

    if (maxVal > maxVolumeRef.current) {
      maxVolumeRef.current = maxVal;
    }

    // VAD Logic: Check Volume against Threshold
    if (maxVal > SPEECH_THRESHOLD) {
      // SPEECH DETECTED
      sustainedSpeechFramesRef.current += 1;

      // Only flip isSpeakingRef after MIN_SPEECH_FRAMES consecutive frames —
      // prevents a single loud transient (cough, door slam) from shortening the silence window.
      if (!isSpeakingRef.current && sustainedSpeechFramesRef.current >= MIN_SPEECH_FRAMES) {
        isSpeakingRef.current = true;
        speechStartTimeRef.current = Date.now();
        logger.info("VAD: Speech started", 'VOICE', { volume: maxVal });
      }

      silenceStartTimeRef.current = null; // Reset silence timer
    } else {
      sustainedSpeechFramesRef.current = 0; // Reset frame counter on any silence
      // SILENCE DETECTED
      if (!silenceStartTimeRef.current) {
        silenceStartTimeRef.current = Date.now();
      }

      const silenceDuration = Date.now() - silenceStartTimeRef.current;
      // If they haven't spoken yet, give them 5 seconds. If they have spoken, cut off after 2.5s of silence.
      const maxAllowedSilence = isSpeakingRef.current ? SILENCE_DURATION_MS : INITIAL_SILENCE_TIMEOUT_MS;

      if (silenceDuration > maxAllowedSilence) {
        logger.info("VAD: Auto-stopping due to silence", 'VOICE', { duration: silenceDuration });
        handleStopRecording();
        return;
      }
    }

    // Render Waveform (Fallback to time domain for purely visual rendering so it looks wavy)
    const renderArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(renderArray);

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = `hsl(var(--primary))`;
    canvasCtx.beginPath();

    const sliceWidth = (canvas.width * 1.0) / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = renderArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }
      x += sliceWidth;
    }
    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
    animationFrameRef.current = requestAnimationFrame(drawWaveform);
  };

  const forceReset = () => {
    // Nuclear cancel — abort any in-flight transcription and reset to idle immediately
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
    if (failsafeTimerRef.current) {
      clearTimeout(failsafeTimerRef.current);
      failsafeTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().then(() => {
        audioContextRef.current = null;
        analyserRef.current = null;
      });
    }
    void stopFallbackRecognition();
    setStatus('idle');
  };

  const handleStopRecording = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
    // NOTE: failsafeTimerRef is intentionally NOT cleared here.
    // Clearing it inside handleStopRecording would remove the last safety net if the
    // MediaRecorder somehow stays open (e.g. race condition, browser quirk).
    // The failsafe is self-clearing when it fires, and is reset at the start of each
    // new recording session.

    // Always release the AudioContext so the mic hardware isn't kept active
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().then(() => {
        audioContextRef.current = null;
        analyserRef.current = null;
      });
    }
    // Release the mic hardware immediately — don't wait for onstop to do it
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      logger.info("VAD: Stopping MediaRecorder");
      mediaRecorderRef.current.stop();
    }
  };

  const startFallbackRecognition = () => {
    fallbackTranscriptRef.current = "";
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            fallbackTranscriptRef.current += finalTranscript + " ";
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (e) {
        logger.error("OS Web Speech API failed to start", e);
      }
    }
  };

  const stopFallbackRecognition = (): Promise<void> => {
    return new Promise((resolve) => {
      if (!recognitionRef.current) { resolve(); return; }
      const recognition = recognitionRef.current;
      recognitionRef.current = null;

      // Allow up to 800ms for the final onresult to arrive after stop()
      const timeout = setTimeout(resolve, 800);

      const originalOnEnd = recognition.onend;
      recognition.onend = () => {
        clearTimeout(timeout);
        if (originalOnEnd) originalOnEnd.call(recognition);
        resolve();
      };

      try { recognition.stop(); } catch (e) { clearTimeout(timeout); resolve(); }
    });
  };

  const transcribeWithRetry = async (formData: FormData, attempt = 1): Promise<{ text: string, language?: string }> => {
    try {
      const headers: Record<string, string> = {};
      const token = await auth.currentUser?.getIdToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/ai/voice-to-text', { method: 'POST', headers, body: formData, signal: abortControllerRef.current?.signal });
      if (!res.ok) throw new Error((await res.json()).error || 'Transcription failed');
      const result = await res.json();
      return { text: result.text, language: result.language };
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        logger.warn(`[VoiceToText] Attempt ${attempt} failed, retrying in ${attempt * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        return transcribeWithRetry(formData, attempt + 1);
      }
      throw err;
    }
  };

  const startRecording = async () => {
    try {
      if (!hasGreetedRef.current) {
        hasGreetedRef.current = true;
        setStatus('greeting');
        const hour = new Date().getHours();
        const greetingText = hour < 12 ? 'नमस्ते! Good morning Teacher. How can I help you today?'
          : hour < 17 ? 'नमस्ते! Good afternoon Teacher. How can I help you today?'
            : 'नमस्ते! Good evening Teacher. How can I help you today?';

        try {
          await tts.speak(greetingText, "hi-IN");
        } catch (e) {
          logger.warn("Greeting interrupted or failed");
        }
      }

      setStatus('initializing');

      audioChunksRef.current = [];
      maxVolumeRef.current = 0;
      sustainedSpeechFramesRef.current = 0;
      isSpeakingRef.current = false;
      silenceStartTimeRef.current = null;
      speechStartTimeRef.current = null;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,    // WebRTC DSP: reduces background noise (fans, AC, traffic)
          echoCancellation: true,    // Prevents mic from picking up speaker output
          // autoGainControl intentionally OFF — AGC boosts ambient noise above the VAD
          // threshold and prevents silence from ever being detected.
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      let mimeType = "";
      if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
        mimeType = "audio/ogg;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      }

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recordedMimeTypeRef.current = mimeType || mediaRecorder.mimeType;
      mediaRecorderRef.current = mediaRecorder;

      // Clear any leftover failsafe from a previous session before setting a new one
      if (failsafeTimerRef.current) {
        clearTimeout(failsafeTimerRef.current);
      }
      failsafeTimerRef.current = setTimeout(() => {
        failsafeTimerRef.current = null; // self-clear so the ref is clean
        if (mediaRecorderRef.current?.state === 'recording') {
          logger.warn("FAILSAFE: Max recording time reached, forcing stop");
          handleStopRecording();
        }
      }, MAX_RECORDING_TIME_MS);

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new window.AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
      } else if (audioContextRef.current.state === 'suspended') {
        // Browser may suspend the AudioContext after inactivity; resume so VAD works correctly
        await audioContextRef.current.resume();
      }
      const source = audioContextRef.current.createMediaStreamSource(stream);
      if (analyserRef.current) {
        source.connect(analyserRef.current);
        drawWaveform();
      }

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        setStatus('processing');
        abortControllerRef.current = new AbortController();
        await stopFallbackRecognition(); // Wait for final onresult before reading the transcript

        if (!audioChunksRef.current || audioChunksRef.current.length === 0) {
          logger.warn("MicrophoneInput: No audio chunks captured.");
          stream.getTracks().forEach(track => track.stop());
          setStatus('idle');
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: recordedMimeTypeRef.current || "audio/webm" });
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        try {
          // COST OPTIMIZATION: Use browser SpeechRecognition first (free).
          // Only fall back to cloud (₹1-2/call) if browser didn't capture anything.
          const browserTranscript = fallbackTranscriptRef.current?.trim();

          if (browserTranscript && browserTranscript.length >= 2) {
            logger.info("Using browser SpeechRecognition (free, no cloud call)");
            onTranscriptChange(browserTranscript);
            return;
          }

          // Browser didn't capture — use cloud transcription
          const { text, language } = await transcribeWithRetry(formData);

          if (!text || text.length < 2) {
            toast({
              title: "No Speech Detected",
              description: "We couldn't hear you clearly.",
              variant: "default",
            });
            return;
          }
          onTranscriptChange(text, language);
        } catch (error) {
          logger.error("Voice-to-text transcription failed", error);

          toast({
            title: "Error",
            description: "Failed to transcribe audio. Please try again.",
            variant: "destructive",
          });
        } finally {
          setStatus('idle');
          // Always release stream tracks — the mic-in-use indicator must turn off
          // regardless of whether transcription succeeded, failed, or returned empty.
          // handleStopRecording already stops streamRef; this is a safety net for the
          // closure-captured stream in case streamRef was already nulled.
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorderRef.current.start();
      setStatus('recording');

      // Concurrently start offline fallback
      startFallbackRecognition();

    } catch (err) {
      logger.error("Microphone access denied", err);
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone access in your browser settings.",
        variant: "destructive",
      });
      setStatus('idle');
    }
  };

  const stopRecording = () => {
    // Delegate to the shared handler so all cleanup (RAF, failsafe, AudioContext) is centralised
    handleStopRecording();
  };

  const handleMicClick = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (status === 'processing' || status === 'initializing') {
      // User wants to cancel — force-reset everything immediately
      forceReset();
    } else if (status === 'recording') {
      stopRecording();
    } else if (status === 'greeting') {
      import('@/lib/tts').then(({ tts }) => tts.cancel());
      setStatus('idle');
    } else {
      startRecording();
    }
  };

  useEffect(() => {
    return () => {
      // Best-effort cleanup on unmount — stop everything, ignore async results
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (failsafeTimerRef.current) {
        clearTimeout(failsafeTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      // stopFallbackRecognition returns a Promise; void it explicitly to avoid
      // unhandled-rejection warnings in the React cleanup (can't await here)
      void stopFallbackRecognition();
    };
  }, []);

  const getIconSize = () => {
    switch (iconSize) {
      case "sm": return "h-5 w-5";
      case "lg": return "h-14 w-14";
      case "xl": return "h-32 w-32";
      default: return "h-6 w-6";
    }
  };

  const getButtonSize = () => {
    if (isFloating) return "h-20 w-20 md:h-24 md:w-24";
    if (iconSize === 'xl') return "h-32 w-32";
    if (iconSize === 'lg') return "h-20 w-20";
    return "";
  };

  // Status mapping for the visual label badge
  const getLabelString = () => {
    switch (status) {
      case 'greeting': return "नमस्ते! I'm listening..."; // Native Unicode Script overriding English parameter
      case 'initializing': return "Getting ready… tap to cancel";
      case 'recording': return "I'm listening...";
      case 'processing': return "Thinking… tap to cancel";
      default: return label || "Tap to speak";
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative flex items-center justify-center">
        {/* Concentric Rings - Idle State (Inviting) */}
        {status === 'idle' && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-[-8px] rounded-full bg-primary/20 animate-ping [animation-duration:3s]" />
            <div className="absolute inset-[-16px] rounded-full bg-primary/10 animate-ping [animation-duration:4s]" />
          </div>
        )}

        {/* Pulsating Orb - Recording State (Active) */}
        {status === 'recording' && (
          <div className="absolute inset-[-12px] rounded-full bg-destructive/20 animate-pulse" />
        )}

        <Button
          type="button"
          variant={status === 'recording' ? "destructive" : variant}
          size={isFloating || iconSize === 'lg' || iconSize === 'xl' ? "icon" : size}
          className={cn(
            "relative transition-all duration-500 flex items-center justify-center overflow-hidden z-20 shadow-2xl",
            status === 'recording'
              ? "bg-gradient-to-br from-destructive to-red-600 border-2 border-white/20 scale-110"
              : "bg-gradient-to-br from-primary to-primary/80",
            status === 'processing' && "opacity-90",
            isFloating && "fixed bottom-8 right-8 z-50 border-4 border-white dark:border-background",
            getButtonSize(),
            className,
            "rounded-full transition-all duration-300 ease-in-out border-4 border-white",
            status !== 'recording' && "!bg-gradient-to-br !from-primary !to-primary/80 !text-primary-foreground hover:!from-primary/95 hover:!to-primary/75 animate-pulse [animation-duration:3s]"
          )}
          onClick={handleMicClick}
          data-microphone="true"
          aria-label={status === 'recording' || status === 'processing' || status === 'initializing' ? "Stop recording" : "Start recording"}
        >
          {/* Internal Glow for recording */}
          {status === 'recording' && (
            <div className="absolute inset-0 bg-white/10 animate-pulse" />
          )}

          {status === 'processing' || status === 'initializing' ? (
            <div className="relative h-10 w-10">
              <div className="absolute inset-0 rounded-full border-4 border-white/20" />
              <div className="absolute inset-0 rounded-full border-4 border-white border-t-transparent animate-spin" />
              <StopCircle className="absolute inset-0 m-auto h-4 w-4 text-white" />
            </div>
          ) : status === 'recording' ? (
            <StopCircle className={cn(getIconSize(), "relative z-30 text-white")} />
          ) : (
            <Mic className={cn(getIconSize(), "relative z-30 text-white")} />
          )}
        </Button>
      </div>

      {/* Volume Visualizer Label - More elegant bubble */}
      {(label || status !== 'idle') && (
        <div className={cn(
          "px-5 py-2.5 rounded-2xl backdrop-blur-xl shadow-lg border transition-all duration-500 scale-in-center",
          status === 'recording'
            ? "bg-destructive/10 text-destructive border-destructive/20"
            : status === 'processing' || status === 'initializing'
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-background/90 text-foreground border-border"
        )}>
          <div className="flex items-center gap-3">
            {status === 'recording' && (
              <div className="flex gap-1 items-end h-4">
                <div className="w-1 bg-destructive rounded-full animate-[pulse_1s_infinite] h-[50%]" />
                <div className="w-1 bg-destructive rounded-full animate-[pulse_1s_infinite_0.2s] h-[100%]" />
                <div className="w-1 bg-destructive rounded-full animate-[pulse_1s_infinite_0.4s] h-[60%]" />
                <div className="w-1 bg-destructive rounded-full animate-[pulse_1s_infinite_0.6s] h-[30%]" />
              </div>
            )}
            <span className="text-sm font-bold tracking-tight whitespace-nowrap">
              {getLabelString()}
            </span>
          </div>
        </div>
      )}

      {/* Waveform Visualization - Elegant glassmorphic container */}
      {status === 'recording' && (
        <div className={cn(
          "overflow-hidden rounded-3xl bg-white/40 backdrop-blur-md border border-white/40 transition-all duration-500 shadow-xl",
          isFloating ? "fixed bottom-44 right-8 w-72 h-32" : "h-20 w-full"
        )}>
          <canvas ref={canvasRef} width="300" height="100" className="h-full w-full opacity-80" />
        </div>
      )}
    </div>
  );
};
