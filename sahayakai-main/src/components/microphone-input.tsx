
"use client";

import { voiceToText } from "@/ai/flows/voice-to-text";
import { Button, ButtonProps } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn, logger } from "@/lib/utils";
import { Mic, StopCircle, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FC } from "react";

type MicrophoneInputProps = {
  onTranscriptChange: (transcript: string) => void;
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
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const { toast } = useToast();

  const maxVolumeRef = useRef<number>(0);
  const sustainedSpeechFramesRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null); // Added for stream management
  const failsafeTimerRef = useRef<NodeJS.Timeout | null>(null); // Added for failsafe timer
  const recordedMimeTypeRef = useRef<string>(""); // Added to track actual mime type used

  // VAD State Refs
  const isSpeakingRef = useRef<boolean>(false);
  const silenceStartTimeRef = useRef<number | null>(null);
  const speechStartTimeRef = useRef<number | null>(null);

  const SPEECH_THRESHOLD = 5; // Balanced threshold for reliable silence detection
  const SUSTAINED_FRAMES_THRESHOLD = 5;
  const SILENCE_DURATION_MS = 5000;
  const MIN_SPEECH_DURATION_MS = 500;
  const MAX_RECORDING_TIME_MS = 30000; // Failsafe: 30 second max

  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    const canvasCtx = canvas.getContext("2d");
    if (!canvasCtx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    // Calculate Volume for Silence Detection
    let maxVal = 0;
    for (let i = 0; i < bufferLength; i++) {
      const amplitude = Math.abs(dataArray[i] - 128);
      if (amplitude > maxVal) maxVal = amplitude;
    }
    if (maxVal > maxVolumeRef.current) {
      maxVolumeRef.current = maxVal;
    }

    // VAD Logic: Check Volume against Threshold
    if (maxVal > SPEECH_THRESHOLD) {
      // SPEECH DETECTED
      sustainedSpeechFramesRef.current += 1;

      if (!isSpeakingRef.current) {
        isSpeakingRef.current = true;
        speechStartTimeRef.current = Date.now();
        console.log("🎤 VAD: Speech started! Volume:", maxVal);
        logger.info("VAD: Speech started", { volume: maxVal });
      }

      silenceStartTimeRef.current = null; // Reset silence timer
    } else {
      // SILENCE DETECTED
      if (isSpeakingRef.current) {
        // User WAS speaking, now silent
        if (!silenceStartTimeRef.current) {
          silenceStartTimeRef.current = Date.now();
          console.log("🔇 VAD: Silence started");
        }

        // Check if silence has exceeded duration
        const silenceDuration = Date.now() - silenceStartTimeRef.current;
        if (silenceDuration > SILENCE_DURATION_MS) {
          console.log("⏹️ VAD: Auto-stopping due to silence", silenceDuration);
          logger.info("VAD: Auto-stopping due to silence", { duration: silenceDuration });
          handleStopRecording();
          return; // Exit loop, stopRecording will clear animation frame
        }
      }
    }

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = `hsl(var(--primary))`;
    canvasCtx.beginPath();

    const sliceWidth = (canvas.width * 1.0) / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
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

  // Extract stop logic to reusable function for VAD
  const handleStopRecording = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
    if (failsafeTimerRef.current) {
      clearTimeout(failsafeTimerRef.current);
      failsafeTimerRef.current = null;
    }

    // Idempotent Stop
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      logger.info("VAD: Stopping MediaRecorder");
      mediaRecorderRef.current.stop();
    }
  };

  const startRecording = async () => {
    try {
      setIsRecording(true);
      audioChunksRef.current = [];

      // Reset VAD Metrics
      maxVolumeRef.current = 0;
      sustainedSpeechFramesRef.current = 0;
      isSpeakingRef.current = false;
      silenceStartTimeRef.current = null;
      speechStartTimeRef.current = null;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream; // Store stream for cleanup

      // Gemini supports audio/ogg, audio/wav, audio/mp3, audio/flac.
      // WebM is often not explicitly supported in all Gemini interfaces.
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

      // FAILSAFE: Force stop after MAX time
      failsafeTimerRef.current = setTimeout(() => {
        console.warn("⚠️ FAILSAFE: Max recording time reached");
        handleStopRecording();
      }, MAX_RECORDING_TIME_MS);

      // Setup audio visualization
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new window.AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
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
        // Robust Noise Filtering Logic
        // We only error if the user NEVER spoke during the entire session.
        // If they spoke and then went silent (triggering auto-stop), that is SUCCESS, not error.

        // REMOVED: Client-side "No Speech" block.
        // We now pass EVERYTHING to the backend as requested by the user.
        // The AI model will decide if the audio is valid.

        /* 
        const hasSpoken = isSpeakingRef.current;
        const isTooQuiet = maxVolumeRef.current < SPEECH_THRESHOLD;
 
        if (!hasSpoken && isTooQuiet) {
           // ... logic removed ...
           return;
        }
        */

        // Guard: Prevent sending empty or tiny recordings
        if (!audioChunksRef.current || audioChunksRef.current.length === 0) {
          console.warn("⏹️ MicrophoneInput: No audio chunks captured. Skipping transcription.");
          setIsTranscribing(false);
          setIsRecording(false);
          return;
        }

        setIsTranscribing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: recordedMimeTypeRef.current || "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          try {
            const { text } = await voiceToText({ audioDataUri: base64Audio });
            // Secondary Check: If text is extremely short or just punctuation/noise
            if (!text || text.length < 2) {
              toast({
                title: "No Speech Detected",
                description: "We couldn't hear you clearly.",
                variant: "default",
              });
              return;
            }
            onTranscriptChange(text);
          } catch (error) {
            console.error("Transcription error:", error);
            logger.error("Voice-to-text transcription failed", error, {
              apiEndpoint: "/api/voice-to-text",
              audioSize: audioBlob.size
            });

            toast({
              title: "Error",
              description: "Failed to transcribe audio. Please try again.",
              variant: "destructive",
            });
          } finally {
            // Delay slightly to allow UI to settle? No, just reset.
            setIsTranscribing(false);
            setIsRecording(false); // Ensure we are reset
          }
        };
        // Note: tracks are stopped in startRecording or cleanup, but good to be sure
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
    } catch (err) {
      console.error("Microphone access denied:", err);
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone access in your browser settings.",
        variant: "destructive",
      });
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().then(() => {
          audioContextRef.current = null;
        });
      }
    }
  };

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    }
  }, []);

  const getIconSize = () => {
    switch (iconSize) {
      case "sm": return "h-5 w-5"; // 20px (Slightly larger than 16px)
      case "lg": return "h-14 w-14"; // 56px (Better fill for 80px button)
      case "xl": return "h-32 w-32"; // 128px (Homepage Hero)
      default: return "h-6 w-6"; // 24px (Standard)
    }
  };

  const getButtonSize = () => {
    if (isFloating) return "h-20 w-20 md:h-24 md:w-24";
    if (iconSize === 'xl') return "h-32 w-32";
    if (iconSize === 'lg') return "h-20 w-20";
    return ""; // use default size
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative flex items-center justify-center">
        {/* Concentric Rings - Idle State (Inviting) */}
        {!isRecording && !isTranscribing && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-[-8px] rounded-full bg-primary/20 animate-ping [animation-duration:3s]" />
            <div className="absolute inset-[-16px] rounded-full bg-primary/10 animate-ping [animation-duration:4s]" />
          </div>
        )}

        {/* Pulsating Orb - Recording State (Active) */}
        {isRecording && (
          <div className="absolute inset-[-12px] rounded-full bg-destructive/20 animate-pulse" />
        )}

        <Button
          variant={isRecording ? "destructive" : variant}
          size={isFloating || iconSize === 'lg' || iconSize === 'xl' ? "icon" : size}
          className={cn(
            "relative transition-all duration-500 flex items-center justify-center overflow-hidden z-20 shadow-2xl",
            isRecording
              ? "bg-gradient-to-br from-destructive to-red-600 border-2 border-white/20 scale-110"
              : "bg-gradient-to-br from-primary to-orange-600 hover:scale-110",
            isTranscribing && "cursor-wait opacity-80",
            isFloating && "fixed bottom-8 right-8 z-50 border-4 border-white dark:border-slate-900",
            getButtonSize(),
            className,
            "rounded-full transition-all duration-300 ease-in-out border-4 border-white",
            !isRecording && "!bg-primary !text-primary-foreground hover:!bg-primary/95"
          )}
          onClick={isRecording ? handleStopRecording : startRecording}
          disabled={isTranscribing}
          data-microphone="true"
          aria-label={isRecording ? "Stop recording" : "Start recording"}
        >
          {/* Internal Glow for recording */}
          {isRecording && (
            <div className="absolute inset-0 bg-white/10 animate-pulse" />
          )}

          {isTranscribing ? (
            <div className="relative h-10 w-10">
              <div className="absolute inset-0 rounded-full border-4 border-white/20" />
              <div className="absolute inset-0 rounded-full border-4 border-white border-t-transparent animate-spin" />
              <Sparkles className="absolute inset-0 m-auto h-4 w-4 text-white animate-pulse" />
            </div>
          ) : isRecording ? (
            <StopCircle className={cn(getIconSize(), "relative z-30 text-white")} />
          ) : (
            <Mic className={cn(getIconSize(), "relative z-30 text-white")} />
          )}
        </Button>
      </div>

      {/* Volume Visualizer Label - More elegant bubble */}
      {(label || isRecording || isTranscribing) && (
        <div className={cn(
          "px-5 py-2.5 rounded-2xl backdrop-blur-xl shadow-lg border transition-all duration-500 scale-in-center",
          isRecording
            ? "bg-destructive/10 text-destructive border-destructive/20"
            : isTranscribing
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-white/90 text-slate-700 border-slate-200"
        )}>
          <div className="flex items-center gap-3">
            {isRecording && (
              <div className="flex gap-1 items-end h-4">
                <div className="w-1 bg-destructive rounded-full animate-[pulse_1s_infinite] h-[50%]" />
                <div className="w-1 bg-destructive rounded-full animate-[pulse_1s_infinite_0.2s] h-[100%]" />
                <div className="w-1 bg-destructive rounded-full animate-[pulse_1s_infinite_0.4s] h-[60%]" />
                <div className="w-1 bg-destructive rounded-full animate-[pulse_1s_infinite_0.6s] h-[30%]" />
              </div>
            )}
            <span className="text-sm font-bold tracking-tight whitespace-nowrap">
              {isTranscribing ? "Sahayak is thinking..." : isRecording ? "I'm listening..." : label}
            </span>
          </div>
        </div>
      )}

      {/* Waveform Visualization - Elegant glassmorphic container */}
      {isRecording && (
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
