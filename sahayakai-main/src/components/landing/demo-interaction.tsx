"use client";

import { useState, useEffect, useRef } from 'react';
import { Mic, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const DEMO_TRANSCRIPT = "Make a quiz on photosynthesis for Class 8";

const DEMO_RESULT = [
    { q: "What is the primary pigment responsible for photosynthesis?", a: "Chlorophyll" },
    { q: "Which gas is released as a byproduct of photosynthesis?", a: "Oxygen" },
    { q: "Where does the light reaction of photosynthesis take place?", a: "Thylakoid membrane" },
];

type Phase = 'idle' | 'listening' | 'typing' | 'thinking' | 'result';

export function DemoInteraction() {
    const [phase, setPhase] = useState<Phase>('idle');
    const [displayedText, setDisplayedText] = useState('');
    const [hasPlayed, setHasPlayed] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const clearAllTimers = () => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    // Auto-play once when scrolled into view
    useEffect(() => {
        if (hasPlayed) return;
        const el = containerRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setHasPlayed(true);
                    startDemo();
                    observer.disconnect();
                }
            },
            { threshold: 0.3 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasPlayed]);

    // Cleanup all timers on unmount
    useEffect(() => {
        return () => clearAllTimers();
    }, []);

    const startDemo = () => {
        clearAllTimers();
        setPhase('listening');
        setDisplayedText('');

        // Phase 1: "Listening" pulse for 1.2s
        timersRef.current.push(setTimeout(() => {
            setPhase('typing');
            // Phase 2: Type out transcript character by character
            let i = 0;
            intervalRef.current = setInterval(() => {
                i++;
                setDisplayedText(DEMO_TRANSCRIPT.slice(0, i));
                if (i >= DEMO_TRANSCRIPT.length) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    intervalRef.current = null;
                    // Phase 3: "Thinking" for 1.5s
                    timersRef.current.push(setTimeout(() => setPhase('thinking'), 300));
                    timersRef.current.push(setTimeout(() => setPhase('result'), 1800));
                }
            }, 40);
        }, 1200));
    };

    const handleReplay = () => {
        clearAllTimers();
        setPhase('idle');
        setDisplayedText('');
        timersRef.current.push(setTimeout(startDemo, 200));
    };

    return (
        <div ref={containerRef} className="w-full max-w-md mx-auto">
            <p className="text-center text-xs text-muted-foreground mb-3">
                See how it works
            </p>
            <Card className="border border-border/60 shadow-soft overflow-hidden">
                <CardContent className="p-4 space-y-3">
                    {/* Mic + transcript area */}
                    <div className="flex items-center gap-3">
                        <div
                            className={`p-2.5 rounded-full shrink-0 transition-all duration-300 ${
                                phase === 'listening'
                                    ? 'bg-red-100 text-red-500 animate-pulse'
                                    : 'bg-primary/10 text-primary'
                            }`}
                        >
                            <Mic className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            {phase === 'idle' && (
                                <p className="text-sm text-muted-foreground italic">Voice-first AI for teachers</p>
                            )}
                            {phase === 'listening' && (
                                <p className="text-sm text-red-500 font-medium">Listening...</p>
                            )}
                            {(phase === 'typing' || phase === 'thinking' || phase === 'result') && (
                                <p className="text-sm text-foreground">
                                    {displayedText}
                                    {phase === 'typing' && <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse" />}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Thinking indicator */}
                    {phase === 'thinking' && (
                        <div className="flex items-center gap-2 text-primary text-xs font-medium animate-in fade-in duration-300">
                            <span className="flex gap-0.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                            </span>
                            Generating quiz...
                        </div>
                    )}

                    {/* Result */}
                    {phase === 'result' && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                                <Sparkles className="h-3 w-3" />
                                Quiz: Photosynthesis (Class 8)
                            </div>
                            {DEMO_RESULT.map((item, i) => (
                                <div key={i} className="text-xs text-muted-foreground pl-2 border-l-2 border-primary/20">
                                    <span className="font-medium text-foreground">Q{i + 1}.</span> {item.q}
                                </div>
                            ))}
                            <button
                                onClick={handleReplay}
                                className="text-[10px] text-primary hover:text-primary/80 font-medium mt-1 transition-colors"
                            >
                                Replay demo
                            </button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
