
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MicrophoneInput } from "@/components/microphone-input";
import { Loader2, X, MessageCircle, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

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

    // Safe Container: pointer-events-none ensures clicks pass through the invisible overlay
    if (!isOpen) {
        return (
            <div className="fixed bottom-6 right-6 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-300">
                <Button
                    onClick={() => setIsOpen(true)}
                    className="h-14 w-14 rounded-full shadow-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:scale-105 transition-transform pointer-events-auto"
                >
                    <Sparkles className="h-6 w-6 text-white animate-pulse" />
                </Button>
            </div>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 w-[350px] md:w-[400px] animate-in slide-in-from-bottom-10 fade-in duration-300 pointer-events-none">
            <Card className="border-0 shadow-2xl overflow-hidden glass-premium pointer-events-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 flex justify-between items-center text-white">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        <span className="font-bold">Sahayak Assistant</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-white/80 hover:bg-white/20 hover:text-white rounded-full h-8 w-8">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Chat Area */}
                <CardContent className="p-0 h-[400px] flex flex-col bg-white/90 backdrop-blur-md">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                        {messages.length === 0 && (
                            <div className="text-center text-slate-500 mt-20 px-6">
                                <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">Hi! I'm here to help with the advice on screen.</p>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`
                            max-w-[85%] rounded-2xl px-4 py-2 text-xs md:text-sm shadow-sm
                            ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-br-none'
                                        : 'bg-white border border-slate-100 text-slate-700 rounded-bl-none'}
                        `}>
                                    {msg.role === 'ai' ? (
                                        <ReactMarkdown className="prose prose-xs dark:prose-invert">{msg.content}</ReactMarkdown>
                                    ) : (
                                        msg.content
                                    )}
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                                    <span className="text-xs text-slate-400">Thinking...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Input */}
                    <div className="p-4 bg-slate-50 border-t border-slate-100">
                        <MicrophoneInput
                            onTranscriptChange={handleTranscript}
                            label="Ask follow-up..."
                            iconSize="sm"
                            className="w-full justify-start pl-3 pr-10 py-6 bg-white border-slate-200 shadow-sm focus-within:ring-2 ring-indigo-100"
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
