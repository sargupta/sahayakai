"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MicrophoneInput } from "@/components/microphone-input";
import { Loader2, X, MessageCircle, Sparkles, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { SahayakAvatar } from "@/components/sahayak-avatar";

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
            setMessages(prev => [...prev, { role: "ai", content: "Sorry, I'm having trouble. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Trigger Button (Closed State)
    if (!isOpen) {
        return (
            <div className="fixed bottom-6 right-6 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Button
                    onClick={() => setIsOpen(true)}
                    className="h-20 w-20 rounded-full shadow-2xl bg-white hover:bg-white/90 hover:scale-110 active:scale-95 transition-all duration-300 pointer-events-auto ring-4 ring-primary/20 backdrop-blur-sm p-0 overflow-hidden"
                >
                    <SahayakAvatar size="lg" className="h-full w-full" />
                </Button>
            </div>
        );
    }

    // Open Chat Interface
    return (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] md:w-[420px] animate-in slide-in-from-bottom-10 fade-in duration-300 pointer-events-none origin-bottom-right">
            <Card className="border-0 shadow-2xl overflow-hidden bg-white/80 backdrop-blur-xl pointer-events-auto rounded-3xl ring-1 ring-white/50">

                {/* Premium Header - BRAND PRIMARY */}
                <div className="bg-primary p-5 flex justify-between items-center text-primary-foreground relative overflow-hidden">
                    {/* Decorative Background Glow using Secondary Color */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

                    <div className="flex items-center gap-3 relative z-10">
                        <div className="rounded-full bg-white/20 backdrop-blur-sm p-1">
                            <SahayakAvatar size="md" showGlow={false} />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight">Sahayak AI</h3>
                            <p className="text-[11px] text-primary-foreground/80 font-medium tracking-wide uppercase">Assistant</p>
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsOpen(false)}
                        className="text-primary-foreground/70 hover:bg-white/20 hover:text-primary-foreground rounded-full h-9 w-9 transition-colors relative z-10"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Chat Area */}
                <CardContent className="p-0 h-[450px] flex flex-col relative">
                    <div className="flex-1 overflow-y-auto p-5 space-y-5 scroll-smooth" ref={scrollRef}>
                        {messages.length === 0 && (
                            <div className="text-center text-slate-400 mt-24 px-8 flex flex-col items-center animate-in fade-in duration-700">
                                <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                                    <MessageCircle className="h-8 w-8 text-primary" />
                                </div>
                                <p className="text-sm font-medium text-slate-600">How can I help you teach today?</p>
                                <p className="text-xs text-slate-400 mt-1">Ask about the lesson, activities, or student needs.</p>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 fade-in duration-300`}>
                                <div className={cn(
                                    "max-w-[85%] rounded-2xl px-5 py-3 text-sm shadow-sm",
                                    msg.role === 'user'
                                        ? "bg-primary text-primary-foreground rounded-tr-none shadow-md"
                                        : "bg-white border border-slate-100 text-slate-700 rounded-tl-none shadow-sm"
                                )}>
                                    {msg.role === 'ai' ? (
                                        <ReactMarkdown className="prose prose-sm prose-p:leading-relaxed prose-p:my-1 dark:prose-invert text-slate-700">
                                            {msg.content}
                                        </ReactMarkdown>
                                    ) : (
                                        <p className="leading-relaxed">{msg.content}</p>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start animate-in fade-in duration-300">
                                <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
                                    <div className="flex space-x-1">
                                        <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="h-2 w-2 bg-primary/70 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="h-2 w-2 bg-primary/40 rounded-full animate-bounce"></div>
                                    </div>
                                    <span className="text-xs font-medium text-slate-500">Thinking...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Floating Input Area */}
                    <div className="p-4 bg-gradient-to-t from-white via-white to-transparent/0 relative z-20">
                        <div className="bg-white/80 backdrop-blur-md border border-white/50 shadow-lg rounded-[2rem] p-1.5 pl-4 flex items-center gap-2 ring-1 ring-slate-900/5">
                            <MicrophoneInput
                                onTranscriptChange={handleTranscript}
                                label=""
                                iconSize="sm"
                                className="h-10 w-10 shrink-0 bg-transparent hover:bg-slate-100 text-slate-500 hover:text-primary transition-colors"
                            />

                            <div className="h-8 w-[1px] bg-slate-200 mx-1"></div>

                            <input
                                type="text"
                                placeholder="Type a message..."
                                className="flex-1 bg-transparent border-none text-sm focus:ring-0 placeholder:text-slate-400 text-slate-700"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleTranscript(e.currentTarget.value);
                                        e.currentTarget.value = '';
                                    }
                                }}
                            />

                            <Button
                                size="icon"
                                className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 shadow-md transition-transform active:scale-95"
                                onClick={(e) => {
                                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                    handleTranscript(input.value);
                                    input.value = '';
                                }}
                            >
                                <Send className="h-4 w-4 ml-0.5" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
