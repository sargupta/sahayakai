"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, BookOpen, BrainCircuit, FolderOpen, UserCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface OnboardingChecklistProps {
    items: Record<string, boolean>;
    onDismiss?: () => void;
    className?: string;
}

const CHECKLIST_CONFIG = [
    { id: 'first-lesson-plan', label: 'Create a lesson plan', icon: BookOpen, href: '/lesson-plan' },
    { id: 'first-quiz', label: 'Generate a quiz', icon: BrainCircuit, href: '/quiz-generator' },
    { id: 'save-to-library', label: 'Save to your library', icon: FolderOpen, href: '/my-library' },
    { id: 'complete-profile', label: 'Complete your profile', icon: UserCircle, href: '/my-profile' },
] as const;

export function OnboardingChecklist({ items, onDismiss, className }: OnboardingChecklistProps) {
    const [collapsed, setCollapsed] = useState(false);

    const completedCount = CHECKLIST_CONFIG.filter(c => items[c.id]).length;
    const totalCount = CHECKLIST_CONFIG.length;
    const progress = completedCount / totalCount;

    // Don't render if all complete
    if (completedCount === totalCount) return null;

    if (collapsed) {
        return (
            <button
                onClick={() => setCollapsed(false)}
                className={cn(
                    "fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full",
                    "bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all",
                    "active:scale-95",
                    className
                )}
            >
                <svg className="h-6 w-6 -rotate-90" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                    <circle
                        cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeDasharray={`${progress * 62.8} 62.8`}
                        strokeLinecap="round"
                    />
                </svg>
                <span className="text-sm font-medium">{completedCount}/{totalCount}</span>
                <ChevronUp className="h-4 w-4" />
            </button>
        );
    }

    return (
        <Card className={cn(
            "fixed bottom-6 right-6 z-40 w-72 rounded-2xl shadow-xl border border-border",
            "animate-in slide-in-from-bottom-4 duration-300",
            className
        )}>
            <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-headline text-sm font-bold text-foreground">Getting Started</h3>
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={() => setCollapsed(true)}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1"
                        >
                            <ChevronDown className="h-4 w-4" />
                        </button>
                        {onDismiss && (
                            <button
                                onClick={onDismiss}
                                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                                aria-label="Dismiss checklist"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${progress * 100}%` }}
                    />
                </div>

                <div className="space-y-1">
                    {CHECKLIST_CONFIG.map((item) => {
                        const done = items[item.id];
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.id}
                                href={done ? '#' : item.href}
                                className={cn(
                                    "flex items-center gap-3 p-2 rounded-lg transition-colors text-sm",
                                    done
                                        ? "text-muted-foreground"
                                        : "text-foreground hover:bg-primary/5"
                                )}
                            >
                                {done ? (
                                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                                ) : (
                                    <Circle className="h-4 w-4 text-border shrink-0" />
                                )}
                                <Icon className="h-4 w-4 shrink-0 opacity-60" />
                                <span className={cn(done && "line-through text-muted-foreground")}>{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
