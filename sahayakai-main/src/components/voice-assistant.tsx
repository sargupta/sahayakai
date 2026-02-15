
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MicrophoneInput } from "@/components/microphone-input";
import { Loader2, X, MessageCircle, Sparkles, RefreshCcw, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface VoiceAssistantProps {
    context: string;
}

export function VoiceAssistant({ context }: VoiceAssistantProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleTranscript = async (text: string) => {
        if (!text.trim()) return;

        const userMsg = { role: "user" as const, content: text };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        if (!isOpen) setIsOpen(true);

        try {
            const response = await fetch("/api/assistant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: text,
                    context: context,
                    history: messages.map(m => ({
                        user: m.role === 'user' ? m.content : '',
                        ai: m.role === 'ai' ? m.content : ''
                    })).filter(t => t.user || t.ai)
                }),
            });

            if (!response.ok) throw new Error("Assistant error");

            const data = await response.json();
            setMessages(prev => [...prev, { role: "ai", content: data.response }]);

        } catch (error) {
            console.error("Assistant Error:", error);
            setMessages(prev => [...prev, { role: "ai", content: "I'm having a bit of trouble connecting right now. Let's try again in a moment." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const resetSession = () => {
        setMessages([]);
    };

    // Safe Container: pointer-events-none ensures clicks pass through the invisible overlay
    if (!isOpen) {
        return (
            <div className="fixed bottom-6 right-6 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-300">
                <Button
                    onClick={() => setIsOpen(true)}
                    className="h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 hover:scale-110 transition-all pointer-events-auto border-2 border-white"
                >
                    <Sparkles className="h-6 w-6 text-white animate-pulse" />
                </Button>
            </div>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 w-[350px] md:w-[400px] animate-in slide-in-from-bottom-10 fade-in duration-300 pointer-events-none">
            <Card className="border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden bg-white/95 backdrop-blur-xl pointer-events-auto rounded-2xl">
                {/* Premium Saffron Top Bar */}
                <div className="h-1.5 w-full bg-primary" />

                {/* Header */}
                <div className="bg-white px-4 py-3 flex justify-between items-center border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary/10">
                            <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-semibold text-slate-800 tracking-tight">Sahayak AI Assistant</span>
                    </div>
                    <div className="flex items-center gap-1">
                        {messages.length > 0 && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={resetSession}
                                title="Reset Session"
                                className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsOpen(false)}
                            className="text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full h-8 w-8"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Chat Area */}
                <CardContent className="p-0 h-[450px] flex flex-col bg-slate-50/30">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth" ref={scrollRef}>
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-6 animate-in fade-in zoom-in duration-500">
                                <div className="p-4 rounded-full bg-primary/5">
                                    <MessageCircle className="h-10 w-10 text-primary/40" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-700">Namaste! I'm your Sahayak.</p>
                                    <p className="text-sm text-slate-500">I can help you understand the content on your screen or answer any pedagogical questions.</p>
                                </div>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <div key={idx} className={cn(
                                "flex animate-in fade-in slide-in-from-bottom-2 duration-300",
                                msg.role === 'user' ? 'justify-end' : 'justify-start'
                            )}>
                                <div className={cn(
                                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                                    msg.role === 'user'
                                        ? 'bg-primary text-white rounded-br-none'
                                        : 'bg-white border border-slate-100 text-slate-700 rounded-bl-none'
                                )}>
                                    {msg.role === 'ai' ? (
                                        <ReactMarkdown className="prose prose-sm max-w-none prose-p:leading-relaxed prose-p:my-1 prose-headings:text-primary">
                                            {msg.content}
                                        </ReactMarkdown>
                                    ) : (
                                        msg.content
                                    )}
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start animate-pulse">
                                <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-3">
                                    <div className="flex gap-1">
                                        <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                                        <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                                        <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.4s]" />
                                    </div>
                                    <span className="text-xs font-medium text-slate-400">Processing...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Input - Redesigned for premium feel */}
                    <div className="p-6 bg-white border-t border-slate-100 flex justify-center">
                        <div className="w-full max-w-[280px]">
                            <MicrophoneInput
                                onTranscriptChange={handleTranscript}
                                label="Tap to ask Sahayak..."
                                iconSize="md"
                                className="w-full"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
