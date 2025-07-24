"use client";

import { voiceToText } from "@/ai/flows/voice-to-text";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Mic, StopCircle } from "lucide-react";
import { useEffect, useRef, useState, type FC } from "react";

type MicrophoneInputProps = {
  onTranscriptChange: (transcript: string) => void;
  className?: string;
};

export const MicrophoneInput: FC<MicrophoneInputProps> = ({ onTranscriptChange, className }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const { toast } = useToast();

  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current || !isRecording) return;
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    const canvasCtx = canvas.getContext("2d");
    if (!canvasCtx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);
    
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
    }

    canvasCtx.fillStyle = "hsla(var(--card))";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
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
      audioChunksRef.current = [];
      mediaRecorderRef.current = new MediaRecorder(stream);
      setIsRecording(true);

      // Setup audio visualization
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new window.AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
      }
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      requestAnimationFrame(drawWaveform);

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        setIsTranscribing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          try {
            const { text } = await voiceToText({ audioDataUri: base64Audio });
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
  
  useEffect(() => {
    if (isRecording) {
      const handleResize = () => drawWaveform();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [isRecording])

  return (
    <div className={cn("flex flex-col items-center justify-center w-20", className)}>
      <div className="relative flex items-center justify-center w-full">
         <div className={cn("absolute inset-0 -z-10 rounded-full transition-opacity duration-300 ease-in-out", isRecording ? "opacity-100" : "opacity-0")}>
            <canvas ref={canvasRef} className="h-full w-full rounded-full" />
        </div>
        <Button
            type="button"
            onClick={handleMicClick}
            disabled={isTranscribing}
            className={cn("h-16 w-16 rounded-full shadow-lg transition-all duration-300 ease-in-out hover:scale-110", isRecording && "bg-destructive hover:bg-destructive/90")}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
        >
            {isTranscribing ? (
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/50 border-t-white" />
            ) : isRecording ? (
            <StopCircle className="h-10 w-10" />
            ) : (
            <Mic className="h-10 w-10" />
            )}
        </Button>
      </div>
    </div>
  );
};
