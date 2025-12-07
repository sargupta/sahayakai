"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { Signal, SignalLow, SignalMedium, SignalHigh } from "lucide-react";

export type DifficultyLevel = 'remedial' | 'standard' | 'advanced';

interface DifficultySelectorProps {
    value: DifficultyLevel;
    onValueChange: (value: DifficultyLevel) => void;
    className?: string;
}

const levels = [
    {
        id: "remedial",
        title: "Remedial (Support)",
        description: "Simplified concepts, more examples, slower pace.",
        icon: SignalLow,
        color: "text-green-600",
        bg: "bg-green-50",
        border: "border-green-200",
    },
    {
        id: "standard",
        title: "Standard (Grade Level)",
        description: "Aligned with regular curriculum expectations.",
        icon: SignalMedium,
        color: "text-blue-600",
        bg: "bg-blue-50",
        border: "border-blue-200",
    },
    {
        id: "advanced",
        title: "Advanced (Extension)",
        description: "Challenging problems, deeper analysis, critical thinking.",
        icon: SignalHigh,
        color: "text-purple-600",
        bg: "bg-purple-50",
        border: "border-purple-200",
    },
];

export function DifficultySelector({ value, onValueChange, className }: DifficultySelectorProps) {
    return (
        <div className={cn("space-y-3", className)}>
            <Label className="font-headline text-base flex items-center gap-2">
                <Signal className="h-4 w-4" />
                Difficulty Level
            </Label>
            <RadioGroup
                value={value}
                onValueChange={(val) => onValueChange(val as DifficultyLevel)}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
                {levels.map((level) => {
                    const isSelected = value === level.id;
                    const Icon = level.icon;

                    return (
                        <Label
                            key={level.id}
                            htmlFor={`diff-${level.id}`}
                            className={cn(
                                "cursor-pointer relative flex flex-col gap-2 p-3 rounded-lg border-2 transition-all hover:bg-accent/50",
                                isSelected ? `${level.bg} ${level.border} ring-1 ring-primary/20` : "bg-white/50 border-transparent hover:border-primary/20",
                            )}
                        >
                            <RadioGroupItem value={level.id} id={`diff-${level.id}`} className="sr-only" />
                            <div className="flex items-center gap-2">
                                <Icon className={cn("h-4 w-4", level.color)} />
                                <span className="font-semibold text-sm">{level.title}</span>
                            </div>
                            <div className="text-xs text-muted-foreground leading-snug pl-6">
                                {level.description}
                            </div>
                        </Label>
                    );
                })}
            </RadioGroup>
        </div>
    );
}
