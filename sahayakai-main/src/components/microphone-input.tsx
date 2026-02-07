
"use client";

import { voiceToText } from "@/ai/flows/voice-to-text";
import { Button, ButtonProps } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Mic, StopCircle } from "lucide-react";
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
  const SPEECH_THRESHOLD = 5; // Volume threshold (out of 128)
  const SUSTAINED_FRAMES_THRESHOLD = 9; // Approx 150ms at 60fps (9 * 16.6ms ~= 150ms)
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

    // Track Sustained Speech (Count frames where volume is significant)
    if (maxVal > SPEECH_THRESHOLD) {
      sustainedSpeechFramesRef.current += 1;
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRecording(true);
      audioChunksRef.current = [];
      maxVolumeRef.current = 0; // Reset metrics
      sustainedSpeechFramesRef.current = 0;
      mediaRecorderRef.current = new MediaRecorder(stream);

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
        // Robust Noise Filtering:
        // 1. Max Volume Check (is it too quiet?)
        // 2. Sustained Speech Check (is it just a brief click/cough?)

        const isTooQuiet = maxVolumeRef.current < SPEECH_THRESHOLD;
        const isShortNoise = sustainedSpeechFramesRef.current < SUSTAINED_FRAMES_THRESHOLD;

        if (isTooQuiet || isShortNoise) {
          setIsRecording(false);
          const message = isTooQuiet
            ? "Please speak closer to the microphone."
            : "No meaningful speech detected.";

          toast({
            title: "No Speech Detected",
            description: message,
            variant: "destructive",
          });
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        setIsTranscribing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
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
            console.error("Transcription failed:", error);
            toast({
              title: "Transcription Error",
              description: "Could not transcribe audio. Please try again.",
              variant: "destructive",
            });
          } finally {
            setIsTranscribing(false);
          }
        };
        stream.getTracks().forEach((track) => track.stop()); // Stop microphone access
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
      case "sm": return "h-4 w-4";
      case "lg": return "h-10 w-10";
      case "xl": return "h-16 w-16";
      default: return "h-6 w-6";
    }
  };

  const getButtonSize = () => {
    if (isFloating) return "h-20 w-20 md:h-24 md:w-24";
    if (iconSize === 'xl') return "h-32 w-32";
    if (iconSize === 'lg') return "h-20 w-20";
    return ""; // use size prop
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3",
        isFloating && "fixed bottom-8 right-8 z-[100] animate-bounce-subtle",
        className
      )}
    >
      <Button
        type="button"
        onClick={handleMicClick}
        disabled={isTranscribing}
        variant={isRecording ? "destructive" : variant}
        size={isFloating || iconSize === 'lg' || iconSize === 'xl' ? "icon" : size}
        className={cn(
          "transition-all duration-300 ease-in-out shadow-xl",
          getButtonSize(),
          isRecording && "animate-pulse scale-110",
          !isRecording && variant === 'default' && "rounded-full hover:scale-110",
          isFloating && "bg-primary text-primary-foreground hover:bg-primary/90 border-4 border-white dark:border-slate-900"
        )}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
      >
        {isTranscribing ? (
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-current border-t-transparent" />
        ) : isRecording ? (
          <StopCircle className={getIconSize()} />
        ) : (
          <Mic className={getIconSize()} />
        )}
      </Button>

      {(label || isRecording) && (
        <div className={cn(
          "px-4 py-2 rounded-full backdrop-blur-md shadow-sm border transition-all duration-300",
          isRecording ? "bg-destructive/10 text-destructive border-destructive/20 animate-pulse" : "bg-white/80 text-slate-700 border-slate-200"
        )}>
          <span className="text-sm font-bold whitespace-nowrap">
            {isTranscribing ? "Transcribing..." : isRecording ? "Speaking..." : label}
          </span>
        </div>
      )}

      {isRecording && (
        <div className={cn(
          "overflow-hidden rounded-xl bg-slate-100/50 backdrop-blur-sm border border-slate-200",
          isFloating ? "fixed bottom-40 right-8 w-64 h-24" : "h-16 w-full"
        )}>
          <canvas ref={canvasRef} width="300" height="80" className="h-full w-full" />
        </div>
      )}
    </div>
  );
};
