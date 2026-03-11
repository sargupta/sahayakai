"use client";

import { Message } from "@/types/messages";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Timestamp } from "firebase/firestore";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
    BookOpen, ClipboardCheck, FileSignature, Images,
    Globe2, GraduationCap, Wand2, ArrowRight, CheckCheck, Check,
} from "lucide-react";
import { useRouter } from "next/navigation";

// ── Resource card config (mirrors community page TYPE_CONFIG) ─────────────────

const RESOURCE_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
    "lesson-plan":        { color: "bg-orange-50 border-orange-200 text-orange-700",  icon: BookOpen,       label: "Lesson Plan"   },
    "quiz":               { color: "bg-blue-50 border-blue-200 text-blue-700",        icon: ClipboardCheck, label: "Quiz"          },
    "worksheet":          { color: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: FileSignature, label: "Worksheet"     },
    "visual-aid":         { color: "bg-pink-50 border-pink-200 text-pink-700",        icon: Images,         label: "Visual Aid"    },
    "virtual-field-trip": { color: "bg-teal-50 border-teal-200 text-teal-700",        icon: Globe2,         label: "Field Trip"    },
    "rubric":             { color: "bg-violet-50 border-violet-200 text-violet-700",  icon: GraduationCap,  label: "Rubric"        },
    "teacher-training":   { color: "bg-amber-50 border-amber-200 text-amber-700",     icon: Wand2,          label: "Training"      },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(ts: Timestamp | null): string {
    if (!ts) return "";
    try { return formatDistanceToNow(ts.toDate(), { addSuffix: true }); } catch { return ""; }
}

function getInitials(name: string): string {
    return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ── Resource Card (inside bubble) ─────────────────────────────────────────────

function ResourceCard({ resource, isOwn }: { resource: NonNullable<Message["resource"]>; isOwn: boolean }) {
    const router = useRouter();
    const cfg = RESOURCE_CONFIG[resource.type] ?? {
        color: "bg-slate-50 border-slate-200 text-slate-700",
        icon: BookOpen,
        label: "Resource",
    };
    const Icon = cfg.icon;

    const handleOpen = () => {
        const params = new URLSearchParams();
        if (resource.title)      params.set("topic", resource.title);
        if (resource.gradeLevel) params.set("gradeLevel", resource.gradeLevel);
        if (resource.subject)    params.set("subject", resource.subject);
        if (resource.language)   params.set("language", resource.language ?? "");
        router.push(`/${resource.route}?${params.toString()}`);
    };

    return (
        <div className={cn(
            "mt-2 rounded-xl border p-3 space-y-2 text-left",
            isOwn ? "border-orange-300/50 bg-orange-400/20" : cfg.color
        )}>
            <div className="flex items-center gap-2">
                <div className={cn("p-1.5 rounded-lg", isOwn ? "bg-white/30" : "bg-white/80")}>
                    <Icon className="h-3.5 w-3.5" />
                </div>
                <Badge className={cn("text-[9px] px-1.5 py-0 border-0 font-bold rounded-full",
                    isOwn ? "bg-white/30 text-white" : "bg-white/70"
                )}>
                    {cfg.label}
                </Badge>
            </div>
            <p className={cn("text-xs font-bold leading-snug", isOwn ? "text-white" : "text-slate-800")}>
                {resource.title}
            </p>
            {(resource.gradeLevel || resource.subject) && (
                <div className="flex gap-1 flex-wrap">
                    {resource.gradeLevel && (
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                            isOwn ? "bg-white/20 text-white" : "bg-white/70 text-slate-600"
                        )}>
                            {resource.gradeLevel}
                        </span>
                    )}
                    {resource.subject && (
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                            isOwn ? "bg-white/20 text-white" : "bg-white/70 text-slate-600"
                        )}>
                            {resource.subject}
                        </span>
                    )}
                </div>
            )}
            <Button
                size="sm"
                onClick={handleOpen}
                className={cn(
                    "h-7 w-full text-[11px] font-bold gap-1 rounded-lg",
                    isOwn
                        ? "bg-white/20 hover:bg-white/30 text-white border border-white/30"
                        : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
                )}
                variant="outline"
            >
                Open in Tool <ArrowRight className="h-3 w-3" />
            </Button>
        </div>
    );
}

// ── Read receipt icon ─────────────────────────────────────────────────────────

function ReadReceipt({ readBy, participantIds }: { readBy: string[]; participantIds: string[] }) {
    const allRead = participantIds.every((uid) => readBy.includes(uid));
    return allRead
        ? <CheckCheck className="h-3 w-3 text-blue-300 shrink-0" />
        : <Check className="h-3 w-3 text-white/50 shrink-0" />;
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

interface MessageBubbleProps {
    message: Message;
    isOwn: boolean;
    showAvatar: boolean;      // false when consecutive messages from same sender
    participantIds: string[]; // for read receipt logic
}

export function MessageBubble({ message, isOwn, showAvatar, participantIds }: MessageBubbleProps) {
    return (
        <div className={cn("flex items-end gap-2", isOwn && "flex-row-reverse")}>
            {/* Avatar — placeholder space when hidden to keep alignment */}
            <div className="w-7 shrink-0">
                {showAvatar && (
                    <Avatar className="h-7 w-7 ring-1 ring-white shadow-sm">
                        <AvatarImage src={message.senderPhotoURL ?? undefined} referrerPolicy="no-referrer" />
                        <AvatarFallback className={cn(
                            "text-[10px] font-bold text-white",
                            isOwn ? "bg-orange-500" : "bg-slate-400"
                        )}>
                            {getInitials(message.senderName)}
                        </AvatarFallback>
                    </Avatar>
                )}
            </div>

            {/* Bubble */}
            <div className={cn("max-w-[72%] space-y-0.5", isOwn && "items-end flex flex-col")}>
                {showAvatar && !isOwn && (
                    <p className="text-[10px] font-bold text-slate-500 px-1">{message.senderName}</p>
                )}

                <div className={cn(
                    "px-3.5 py-2.5 rounded-2xl",
                    isOwn
                        ? "bg-orange-500 text-white rounded-br-sm"
                        : "bg-slate-100 text-slate-800 rounded-bl-sm"
                )}>
                    {/* Text */}
                    {message.text && (
                        <p className="text-sm leading-relaxed font-medium break-words">{message.text}</p>
                    )}

                    {/* Resource card */}
                    {message.type === "resource" && message.resource && (
                        <ResourceCard resource={message.resource} isOwn={isOwn} />
                    )}
                </div>

                {/* Timestamp + read receipt */}
                <div className={cn("flex items-center gap-1 px-1", isOwn && "flex-row-reverse")}>
                    <p className="text-[10px] text-slate-400">{formatTime(message.createdAt)}</p>
                    {isOwn && <ReadReceipt readBy={message.readBy} participantIds={participantIds} />}
                </div>
            </div>
        </div>
    );
}
