
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MicrophoneInput } from "@/components/microphone-input";
import {
    Loader2, X, BookOpen, Trash2, GraduationCap,
    ClipboardList, Video, FileText, Map, Lightbulb, ArrowRight, Send, Brain
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface VidyaAction {
    type: "NAVIGATE_AND_FILL";
    flow: string;
    label: string;
    params: {
        topic?: string | null;
        subject?: string | null;
        gradeLevel?: string | null;
        language?: string | null;
    };
}

interface Message {
    role: "user" | "ai";
    content: string;
    action?: VidyaAction | null;
}

interface VoiceAssistantProps {
    context: string;
}

// ─── Flow Config ─────────────────────────────────────────────────────────────

const FLOW_CONFIG: Record<string, { route: string; icon: React.ReactNode; color: string; label: string }> = {
    "lesson-plan": {
        route: "/lesson-plan",
        icon: <BookOpen className="w-4 h-4" />,
        color: "bg-blue-50 border-blue-200 text-blue-700",
        label: "Lesson Plan",
    },
    "quiz": {
        route: "/quiz-generator",
        icon: <ClipboardList className="w-4 h-4" />,
        color: "bg-green-50 border-green-200 text-green-700",
        label: "Quiz",
    },
    "worksheet": {
        route: "/worksheet-wizard",
        icon: <FileText className="w-4 h-4" />,
        color: "bg-purple-50 border-purple-200 text-purple-700",
        label: "Worksheet",
    },
    "visual-aid": {
        route: "/visual-aid-designer",
        icon: <Lightbulb className="w-4 h-4" />,
        color: "bg-yellow-50 border-yellow-200 text-yellow-700",
        label: "Visual Aid",
    },
    "video-storyteller": {
        route: "/video-storyteller",
        icon: <Video className="w-4 h-4" />,
        color: "bg-red-50 border-red-200 text-red-700",
        label: "Videos",
    },
    "teacher-training": {
        route: "/teacher-training",
        icon: <GraduationCap className="w-4 h-4" />,
        color: "bg-orange-50 border-orange-200 text-orange-700",
        label: "Teacher Training",
    },
    "virtual-field-trip": {
        route: "/virtual-field-trip",
        icon: <Map className="w-4 h-4" />,
        color: "bg-teal-50 border-teal-200 text-teal-700",
        label: "Virtual Field Trip",
    },
};

// ─── Action Card ─────────────────────────────────────────────────────────────

function ActionCard({ action, onNavigate }: { action: VidyaAction; onNavigate: () => void }) {
    const config = FLOW_CONFIG[action.flow];
    if (!config) return null;

    return (
        <div className={cn("mt-2 rounded-xl border p-3 flex items-start justify-between gap-3", config.color)}>
            <div className="flex items-start gap-2 min-w-0">
                <div className="mt-0.5 shrink-0">{config.icon}</div>
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide opacity-70">{config.label}</p>
                    <p className="text-sm font-semibold truncate">{action.label}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {action.params.gradeLevel && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 font-medium">{action.params.gradeLevel}</span>
                        )}
                        {action.params.subject && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 font-medium">{action.params.subject}</span>
                        )}
                        {action.params.topic && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 font-medium truncate max-w-[120px]">{action.params.topic}</span>
                        )}
                    </div>
                </div>
            </div>
            <Button
                size="sm"
                onClick={onNavigate}
                className="shrink-0 h-8 px-3 text-xs font-bold rounded-lg bg-primary text-white hover:bg-primary/90 gap-1"
            >
                Go <ArrowRight className="w-3 h-3" />
            </Button>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function VoiceAssistant({ context }: VoiceAssistantProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [textInput, setTextInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const sendMessage = async (text: string) => {
        if (!text.trim()) return;

        const userMsg: Message = { role: "user", content: text };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);
        setTextInput("");
        if (!isOpen) setIsOpen(true);

        try {
            const response = await fetch("/api/assistant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: text,
                    context,
                    history: messages.map(m => ({
                        user: m.role === "user" ? m.content : "",
                        ai: m.role === "ai" ? m.content : "",
                    })).filter(t => t.user || t.ai),
                }),
            });

            if (!response.ok) throw new Error("VIDYA API error");
            const data = await response.json();

            setMessages(prev => [...prev, {
                role: "ai",
                content: data.response,
                action: data.action || null,
            }]);

        } catch (error) {
            setMessages(prev => [...prev, {
                role: "ai",
                content: "Main abhi ek chhoti mushkil se guzar rahi hoon. Thodi der mein dobara try karein! 🙏",
                action: null,
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNavigate = (action: VidyaAction) => {
        const config = FLOW_CONFIG[action.flow];
        if (!config) return;
        const params = new URLSearchParams();
        if (action.params.topic) params.set("topic", action.params.topic);
        if (action.params.subject) params.set("subject", action.params.subject);
        if (action.params.gradeLevel) params.set("gradeLevel", action.params.gradeLevel);
        if (action.params.language) params.set("language", action.params.language);
        router.push(`${config.route}?${params.toString()}`);
        setIsOpen(false);
    };

    const resetSession = () => setMessages([]);

    // ─── Closed State (FAB) ──────────────────────────────────────────────────
    if (!isOpen) {
        return (
            <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
                <button
                    onClick={() => setIsOpen(true)}
                    className="relative h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 hover:scale-110 transition-all pointer-events-auto border-2 border-white flex items-center justify-center group"
                    aria-label="Open VIDYA Mentor"
                >
                    <Brain className="h-6 w-6 text-white" />
                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-green-400 rounded-full border-2 border-white animate-pulse" />
                    {/* Tooltip */}
                    <div className="absolute right-16 bottom-1 bg-slate-800 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Ask VIDYA
                    </div>
                </button>
            </div>
        );
    }

    // ─── Open State ──────────────────────────────────────────────────────────
    return (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] md:w-[400px] animate-in slide-in-from-bottom-10 fade-in duration-300 pointer-events-none">
            <Card className="border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden bg-white/98 backdrop-blur-xl pointer-events-auto rounded-2xl flex flex-col">
                {/* Saffron Top Bar */}
                <div className="h-1.5 w-full bg-primary" />

                {/* Header */}
                <div className="bg-white px-4 py-3 flex justify-between items-center border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                            <div className="p-1.5 rounded-xl bg-primary/10">
                                <Brain className="h-4 w-4 text-primary" />
                            </div>
                            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-green-400 rounded-full border border-white" />
                        </div>
                        <div className="min-w-0">
                            <p className="font-bold text-slate-800 tracking-tight text-sm leading-none">VIDYA</p>
                            <p className="text-[10px] text-slate-400 leading-none mt-0.5">Your Learning Mentor · विद्या</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {messages.length > 0 && (
                            <Button variant="ghost" size="icon" onClick={resetSession} title="Reset Session"
                                className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-full">
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}
                            className="text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full h-8 w-8">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Chat Area */}
                <CardContent className="p-0 flex flex-col bg-slate-50/30" style={{ height: "430px" }}>
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth" ref={scrollRef}>
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 px-4 animate-in fade-in zoom-in duration-500">
                                <div className="p-4 rounded-full bg-primary/5">
                                    <Brain className="h-10 w-10 text-primary/50" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-base">Namaste! Main VIDYA hoon 🙏</p>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                        Your Senior Pedagogical Mentor. Ask me to create lesson plans, quizzes, worksheets, visual aids, and more — I'll take you right there!
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-2 w-full mt-2">
                                    {[
                                        { text: "Lesson plan banana hai", icon: "📝" },
                                        { text: "Quiz chahiye mujhe", icon: "📋" },
                                        { text: "Visual aid banao", icon: "🖼️" },
                                        { text: "Videos dikhao", icon: "🎬" },
                                    ].map(s => (
                                        <button key={s.text} onClick={() => sendMessage(s.text)}
                                            className="text-left text-xs p-2 rounded-xl border border-slate-200 bg-white hover:bg-primary/5 hover:border-primary/30 transition-all text-slate-600 font-medium">
                                            {s.icon} {s.text}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <div key={idx} className={cn(
                                "flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300",
                                msg.role === "user" ? "items-end" : "items-start"
                            )}>
                                <div className={cn(
                                    "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                                    msg.role === "user"
                                        ? "bg-primary text-white rounded-br-none"
                                        : "bg-white border border-slate-100 text-slate-700 rounded-bl-none"
                                )}>
                                    {msg.role === "ai" ? (
                                        <ReactMarkdown className="prose prose-sm max-w-none prose-p:leading-relaxed prose-p:my-0.5 prose-headings:text-primary prose-strong:text-slate-800">
                                            {msg.content}
                                        </ReactMarkdown>
                                    ) : msg.content}
                                </div>
                                {/* Action Card */}
                                {msg.role === "ai" && msg.action && (
                                    <div className="max-w-[88%] w-full mt-1">
                                        <ActionCard action={msg.action} onNavigate={() => handleNavigate(msg.action!)} />
                                    </div>
                                )}
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start animate-pulse">
                                <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                                    <div className="flex gap-1">
                                        <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                                        <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.15s]" />
                                        <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.3s]" />
                                    </div>
                                    <span className="text-xs text-slate-400 font-medium">VIDYA is thinking...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white border-t border-slate-100 shrink-0">
                        {/* Text Input */}
                        <div className="flex items-center gap-2 mb-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={textInput}
                                onChange={e => setTextInput(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(textInput)}
                                placeholder="Type or speak to VIDYA..."
                                className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-slate-400"
                            />
                            <Button
                                size="icon"
                                onClick={() => sendMessage(textInput)}
                                disabled={!textInput.trim() || isLoading}
                                className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 shrink-0"
                            >
                                <Send className="h-3.5 w-3.5 text-white" />
                            </Button>
                        </div>
                        {/* Mic */}
                        <div className="flex justify-center">
                            <MicrophoneInput
                                onTranscriptChange={sendMessage}
                                label="Or tap to speak..."
                                iconSize="sm"
                                className="scale-90"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
