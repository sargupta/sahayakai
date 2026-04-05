'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioWaveformProps {
    audioUrl: string;
    duration?: number;
    isOwn: boolean;
    uploadProgress?: number;  // 0-100, undefined = ready
}

const BAR_COUNT = 28;
const BAR_WIDTH = 2.5;
const BAR_GAP = 1.5;
const BAR_MIN_HEIGHT = 3;
const BAR_MAX_HEIGHT = 24;

export function AudioWaveform({ audioUrl, duration, isOwn, uploadProgress }: AudioWaveformProps) {
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [totalDuration, setTotalDuration] = useState(duration || 0);
    const [bars, setBars] = useState<number[]>(() =>
        Array.from({ length: BAR_COUNT }, () => BAR_MIN_HEIGHT + Math.random() * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT) * 0.3)
    );
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animFrameRef = useRef<number>(0);

    // Decode audio to generate waveform bars
    useEffect(() => {
        if (!audioUrl || uploadProgress !== undefined) return;

        let cancelled = false;
        (async () => {
            try {
                const response = await fetch(audioUrl);
                const arrayBuffer = await response.arrayBuffer();
                const audioCtx = new AudioContext();
                const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                audioCtx.close();

                if (cancelled) return;

                const rawData = audioBuffer.getChannelData(0);
                const samplesPerBar = Math.floor(rawData.length / BAR_COUNT);
                const newBars: number[] = [];

                for (let i = 0; i < BAR_COUNT; i++) {
                    let sum = 0;
                    const start = i * samplesPerBar;
                    for (let j = start; j < start + samplesPerBar && j < rawData.length; j++) {
                        sum += Math.abs(rawData[j]);
                    }
                    const avg = sum / samplesPerBar;
                    newBars.push(BAR_MIN_HEIGHT + avg * BAR_MAX_HEIGHT * 3);
                }

                // Normalize
                const maxBar = Math.max(...newBars, BAR_MIN_HEIGHT);
                const normalized = newBars.map(b => Math.max(BAR_MIN_HEIGHT, (b / maxBar) * BAR_MAX_HEIGHT));
                setBars(normalized);

                if (!duration) setTotalDuration(audioBuffer.duration);
            } catch {
                // Fallback: keep random bars
            }
        })();

        return () => { cancelled = true; };
    }, [audioUrl, duration, uploadProgress]);

    // Draw waveform on canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const width = BAR_COUNT * (BAR_WIDTH + BAR_GAP);
        const height = BAR_MAX_HEIGHT + 4;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);

        const progress = totalDuration > 0 ? currentTime / totalDuration : 0;
        const progressBar = Math.floor(progress * BAR_COUNT);

        bars.forEach((barHeight, i) => {
            const x = i * (BAR_WIDTH + BAR_GAP);
            const y = (height - barHeight) / 2;

            if (isOwn) {
                ctx.fillStyle = i <= progressBar ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)';
            } else {
                ctx.fillStyle = i <= progressBar ? '#f97316' : '#cbd5e1';
            }

            ctx.beginPath();
            ctx.roundRect(x, y, BAR_WIDTH, barHeight, 1);
            ctx.fill();
        });
    }, [bars, currentTime, totalDuration, isOwn]);

    const togglePlay = useCallback(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio(audioUrl);
            audioRef.current.addEventListener('ended', () => {
                setPlaying(false);
                setCurrentTime(0);
            });
            audioRef.current.addEventListener('loadedmetadata', () => {
                if (audioRef.current && !duration) {
                    setTotalDuration(audioRef.current.duration);
                }
            });
        }

        if (playing) {
            audioRef.current.pause();
            cancelAnimationFrame(animFrameRef.current);
            setPlaying(false);
        } else {
            audioRef.current.play();
            setPlaying(true);

            const update = () => {
                if (audioRef.current) {
                    setCurrentTime(audioRef.current.currentTime);
                }
                animFrameRef.current = requestAnimationFrame(update);
            };
            update();
        }
    }, [audioUrl, playing, duration]);

    // Cleanup
    useEffect(() => {
        return () => {
            audioRef.current?.pause();
            cancelAnimationFrame(animFrameRef.current);
        };
    }, []);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${String(sec).padStart(2, '0')}`;
    };

    const isUploading = uploadProgress !== undefined && uploadProgress < 100;

    return (
        <div className="flex items-center gap-2 min-w-[180px]">
            {/* Play/Pause button */}
            <button
                onClick={isUploading ? undefined : togglePlay}
                disabled={isUploading}
                className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-all',
                    isOwn
                        ? 'bg-white/20 hover:bg-white/30 text-white'
                        : 'bg-orange-100 hover:bg-orange-200 text-orange-600',
                    isUploading && 'opacity-50 cursor-not-allowed'
                )}
            >
                {playing
                    ? <Pause className="h-3.5 w-3.5" />
                    : <Play className="h-3.5 w-3.5 ml-0.5" />
                }
            </button>

            {/* Waveform */}
            <div className="flex-1 flex flex-col gap-0.5">
                {isUploading ? (
                    <div className="h-6 flex items-center">
                        <div className="w-full bg-white/20 rounded-full h-1.5">
                            <div
                                className="bg-white/70 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                    </div>
                ) : (
                    <canvas ref={canvasRef} className="block" />
                )}
                <span className={cn(
                    'text-[10px] font-medium tabular-nums',
                    isOwn ? 'text-white/60' : 'text-slate-400'
                )}>
                    {playing ? formatTime(currentTime) : formatTime(totalDuration)}
                </span>
            </div>
        </div>
    );
}
