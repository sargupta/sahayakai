
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
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
import { auth } from "@/lib/firebase";
import {
    resolveTurnLanguage,
    langCodeToBCP47,
    langNameToCode,
    type LangCode,
} from "@/lib/detect-language";
import { useJarvisStore } from "@/store/jarvisStore";

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
    /** 2-letter ISO code of the language this turn was resolved to. */
    lang?: LangCode;
}

/**
 * One-shot greetings per language. Used by the mic component's first-open
 * greeting so the teacher hears VIDYA in their own language before saying
 * anything. English is the default for anyone without a `preferredLanguage`
 * set in Settings — greetings for other languages are only used when the
 * teacher explicitly picked that language at onboarding.
 */
const GREETINGS: Record<LangCode, { text: string; label: string }> = {
    en: { text: "Hello Teacher! How can I help you today?", label: "Listening..." },
    hi: { text: "नमस्ते शिक्षक! मैं आज आपकी कैसे मदद कर सकती हूँ?", label: "सुन रही हूँ..." },
    kn: { text: "ನಮಸ್ಕಾರ ಶಿಕ್ಷಕರೇ! ನಾನು ಇಂದು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?", label: "ಕೇಳುತ್ತಿದ್ದೇನೆ..." },
    ta: { text: "வணக்கம் ஆசிரியரே! இன்று உங்களுக்கு எப்படி உதவ முடியும்?", label: "கேட்கிறேன்..." },
    te: { text: "నమస్కారం ఉపాధ్యాయులారా! ఈ రోజు మీకు ఎలా సహాయం చేయగలను?", label: "వింటున్నాను..." },
    mr: { text: "नमस्कार शिक्षक! मी आज तुमची कशी मदत करू शकते?", label: "ऐकत आहे..." },
    bn: { text: "নমস্কার শিক্ষক! আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি?", label: "শুনছি..." },
    gu: { text: "નમસ્તે શિક્ષક! હું આજે તમારી કેવી રીતે મદદ કરી શકું?", label: "સાંભળી રહી છું..." },
    pa: { text: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਅਧਿਆਪਕ! ਮੈਂ ਅੱਜ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦੀ ਹਾਂ?", label: "ਸੁਣ ਰਹੀ ਹਾਂ..." },
    ml: { text: "നമസ്കാരം അധ്യാപകരേ! ഇന്ന് ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കും?", label: "കേൾക്കുന്നു..." },
    or: { text: "ନମସ୍କାର ଶିକ୍ଷକ! ଆଜି ମୁଁ ଆପଣଙ୍କୁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?", label: "ଶୁଣୁଛି..." },
};

interface VoiceAssistantProps {
    context: string;
}

// ─── Flow Config ─────────────────────────────────────────────────────────────

const FLOW_CONFIG: Record<string, { route: string; icon: React.ReactNode; color: string; label: string }> = {
    // Keys MUST match flow keys in soul.ts SAHAYAK_SOUL_PROMPT
    "lesson-plan": {
        route: "/lesson-plan",
        icon: <BookOpen className="w-4 h-4" />,
        color: "bg-primary/5 border-primary/20 text-primary",
        label: "Lesson Plan",
    },
    "quiz-generator": {
        route: "/quiz-generator",
        icon: <ClipboardList className="w-4 h-4" />,
        color: "bg-primary/5 border-primary/20 text-primary",
        label: "Quiz",
    },
    "worksheet-wizard": {
        route: "/worksheet-wizard",
        icon: <FileText className="w-4 h-4" />,
        color: "bg-primary/5 border-primary/20 text-primary",
        label: "Worksheet",
    },
    "visual-aid-designer": {
        route: "/visual-aid-designer",
        icon: <Lightbulb className="w-4 h-4" />,
        color: "bg-primary/5 border-primary/20 text-primary",
        label: "Visual Aid",
    },
    "video-storyteller": {
        route: "/video-storyteller",
        icon: <Video className="w-4 h-4" />,
        color: "bg-primary/5 border-primary/20 text-primary",
        label: "Videos",
    },
    "teacher-training": {
        route: "/teacher-training",
        icon: <GraduationCap className="w-4 h-4" />,
        color: "bg-primary/5 border-primary/20 text-primary",
        label: "Teacher Training",
    },
    "virtual-field-trip": {
        route: "/virtual-field-trip",
        icon: <Map className="w-4 h-4" />,
        color: "bg-primary/5 border-primary/20 text-primary",
        label: "Virtual Field Trip",
    },
    "rubric-generator": {
        route: "/rubric-generator",
        icon: <ClipboardList className="w-4 h-4" />,
        color: "bg-primary/5 border-primary/20 text-primary",
        label: "Rubric",
    },
    "instant-answer": {
        route: "/instant-answer",
        icon: <Lightbulb className="w-4 h-4" />,
        color: "bg-primary/5 border-primary/20 text-primary",
        label: "Instant Answer",
    },
    "exam-paper": {
        route: "/exam-paper",
        icon: <FileText className="w-4 h-4" />,
        color: "bg-primary/5 border-primary/20 text-primary",
        label: "Exam Paper",
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

    // Teacher profile — source of truth for initial greeting language and
    // for the last-resort fallback when neither STT nor script detection
    // yields a language for the current turn.
    const teacherProfile = useJarvisStore(s => s.teacherProfile);

    // Session-sticky language. Null until the first turn resolves a language.
    // Resets on: new conversation (resetSession), page reload (in-memory state
    // only, not persisted), sign-out (component unmounts with user flip),
    // and when a later turn's signal genuinely disagrees with the sticky
    // value (handled inside resolveTurnLanguage's short-utterance guard).
    const [sessionLanguage, setSessionLanguage] = useState<LangCode | null>(null);

    // Greeting config for MicrophoneInput — resolved from sessionLanguage
    // first (so a sticky language survives closing + reopening the assistant),
    // then teacherProfile.preferredLanguage if explicit, else English.
    const greetingConfig = useMemo(() => {
        const profileCode = langNameToCode(teacherProfile?.preferredLanguage);
        const code: LangCode = sessionLanguage || profileCode || 'en';
        const g = GREETINGS[code] || GREETINGS.en;
        return {
            greetingLang: langCodeToBCP47(code),
            greetingText: g.text,
            greetingLabel: g.label,
        };
    }, [sessionLanguage, teacherProfile?.preferredLanguage]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const sendMessage = async (text: string, detectedLang?: string) => {
        if (!text.trim()) return;

        // ─── Resolve the effective language for THIS turn ──────────────────
        // Precedence (highest → lowest): STT-detected → Unicode script
        // detection on typed text → session sticky → teacher profile → 'en'.
        // The helper also enforces the short-utterance guard so a one-word
        // reply ("haan", "ok") does NOT flip the sticky language.
        const effectiveLang = resolveTurnLanguage({
            sttLang: detectedLang,
            typedText: text,
            sessionLang: sessionLanguage,
            profileLangName: teacherProfile?.preferredLanguage,
        });

        // Update sticky ONLY if the resolution trusted a real signal for
        // this turn (STT or script detection succeeded). If the fallback
        // chain hit profile/'en', don't burn the sticky — it might already
        // hold a richer session-specific value.
        const turnHadRealSignal = Boolean(detectedLang) ||
            /[\u0900-\u0DFF]/.test(text); // any Indic script char
        if (turnHadRealSignal && effectiveLang !== sessionLanguage) {
            setSessionLanguage(effectiveLang);
        } else if (!sessionLanguage) {
            // First turn with no real signal — seed sticky so tool-calls
            // still get a language param. Uses profile or 'en'.
            setSessionLanguage(effectiveLang);
        }

        const userMsg: Message = { role: "user", content: text, lang: effectiveLang };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);
        setTextInput("");
        if (!isOpen) setIsOpen(true);

        try {
            // Build chat history — separate user and AI messages for the
            // backend and include per-turn language so the LLM can anchor
            // multi-turn responses to the right language when the current
            // utterance is too short to re-detect.
            const chatHistory = messages.flatMap(m => {
                if (m.role === "user") return [{ user: m.content, ai: "", lang: m.lang }];
                if (m.role === "ai") return [{ user: "", ai: m.content, lang: m.lang }];
                return [];
            }).filter(t => t.user.trim() || t.ai.trim());

            // Auth header required since /api/assistant is no longer a public route
            // (hotfix 4b24884dd). Token is from Firebase auth, falsy if not signed in.
            const token = await auth.currentUser?.getIdToken();
            const response = await fetch("/api/assistant", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    message: text,
                    chatHistory,
                    currentScreenContext: { path: context },
                    // Always send the resolved language — never null — so the
                    // assistant route can mandate action.params.language on
                    // every tool call without guessing from text.
                    detectedLanguage: effectiveLang,
                    teacherProfile,
                }),
            });

            if (!response.ok) throw new Error("VIDYA API error");
            const data = await response.json();

            setMessages(prev => [...prev, {
                role: "ai",
                content: data.response,
                action: data.action || null,
                lang: effectiveLang,
            }]);

        } catch (error) {
            setMessages(prev => [...prev, {
                role: "ai",
                content: "I'm having a small issue right now. Please try again in a moment!",
                action: null,
                lang: effectiveLang,
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
        // If the LLM omitted action.params.language (shouldn't happen under
        // the updated soul prompt, but belt-and-braces) fall back to the
        // session sticky so the destination flow still renders in the right
        // language.
        const lang = action.params.language || sessionLanguage;
        if (lang) params.set("language", lang);
        router.push(`${config.route}?${params.toString()}`);
        setIsOpen(false);
    };

    // Clears messages AND resets the sticky language — a new conversation
    // starts with a clean slate per the user's reset-trigger requirement.
    const resetSession = () => {
        setMessages([]);
        setSessionLanguage(null);
    };

    // ─── Closed State (FAB) ──────────────────────────────────────────────────
    if (!isOpen) {
        return (
            <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
                <button
                    onClick={() => setIsOpen(true)}
                    className="relative h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 hover:scale-110 transition-all pointer-events-auto border-2 border-background flex items-center justify-center group"
                    aria-label="Open VIDYA Mentor"
                >
                    <Brain className="h-6 w-6 text-white" />
                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-green-400 rounded-full border-2 border-background animate-pulse" />
                    {/* Tooltip */}
                    <div className="absolute right-16 bottom-1 bg-foreground text-background text-xs px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Ask VIDYA
                    </div>
                </button>
            </div>
        );
    }

    // ─── Open State ──────────────────────────────────────────────────────────
    return (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] md:w-[400px] animate-in slide-in-from-bottom-10 fade-in duration-300 pointer-events-none">
            <Card className="bg-card/95 backdrop-blur-sm border border-border shadow-elevated overflow-hidden pointer-events-auto rounded-2xl flex flex-col">
                {/* Saffron Top Bar */}
                <div className="h-1.5 w-full bg-primary" />

                {/* Header */}
                <div className="bg-card px-4 py-3 flex justify-between items-center border-b border-border shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                            <div className="p-1.5 rounded-xl bg-primary/10">
                                <Brain className="h-4 w-4 text-primary" />
                            </div>
                            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-green-400 rounded-full border border-background" />
                        </div>
                        <div className="min-w-0">
                            <p className="font-bold text-foreground tracking-tight text-sm leading-none">VIDYA</p>
                            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Your Learning Mentor · विद्या</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {messages.length > 0 && (
                            <Button variant="ghost" size="icon" onClick={resetSession} title="Reset Session"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full">
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}
                            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-full h-8 w-8">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Chat Area */}
                <CardContent className="p-0 flex flex-col bg-muted/30" style={{ height: "430px" }}>
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth" ref={scrollRef}>
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 px-4 animate-in fade-in zoom-in duration-500">
                                <div className="p-4 rounded-full bg-primary/5">
                                    <Brain className="h-10 w-10 text-primary/50" />
                                </div>
                                <div>
                                    <p className="font-bold text-foreground text-base">Hello! I'm VIDYA</p>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                        Your Senior Pedagogical Mentor. Ask me to create lesson plans, quizzes, worksheets, visual aids, and more — in any Indian language. Speak or type and I'll match your language automatically.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-2 w-full mt-2">
                                    {[
                                        { text: "Make a lesson plan", icon: <FileText className="w-3.5 h-3.5 inline-block shrink-0" /> },
                                        { text: "I need a quiz", icon: <ClipboardList className="w-3.5 h-3.5 inline-block shrink-0" /> },
                                        { text: "Create a visual aid", icon: <Lightbulb className="w-3.5 h-3.5 inline-block shrink-0" /> },
                                        { text: "Show me videos", icon: <Video className="w-3.5 h-3.5 inline-block shrink-0" /> },
                                    ].map(s => (
                                        <button key={s.text} onClick={() => sendMessage(s.text)}
                                            className="text-left text-xs p-2 rounded-xl border border-border bg-card hover:bg-primary/5 hover:border-primary/30 transition-all text-foreground font-medium flex items-center gap-1.5">
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
                                    "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm shadow-soft",
                                    msg.role === "user"
                                        ? "bg-primary text-white rounded-br-none"
                                        : "bg-card border border-border text-foreground rounded-bl-none"
                                )}>
                                    {msg.role === "ai" ? (
                                        <ReactMarkdown className="prose prose-sm max-w-none prose-p:leading-relaxed prose-p:my-0.5 prose-headings:text-primary prose-strong:text-foreground">
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
                                <div className="bg-card border border-border px-4 py-3 rounded-2xl rounded-bl-none shadow-soft flex items-center gap-2">
                                    <div className="flex gap-1">
                                        <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                                        <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.15s]" />
                                        <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.3s]" />
                                    </div>
                                    <span className="text-xs text-muted-foreground font-medium">VIDYA is thinking...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-card border-t border-border shrink-0">
                        {/* Text Input */}
                        <div className="flex items-center gap-2 mb-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={textInput}
                                onChange={e => setTextInput(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(textInput); } }}
                                placeholder="Type or speak to VIDYA..."
                                className="flex-1 text-sm bg-muted/50 border border-border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground"
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
                                onTranscriptChange={(text, lang) => sendMessage(text, lang)}
                                label="Or tap to speak..."
                                iconSize="sm"
                                className="scale-90"
                                greetingLang={greetingConfig.greetingLang}
                                greetingText={greetingConfig.greetingText}
                                greetingLabel={greetingConfig.greetingLabel}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
