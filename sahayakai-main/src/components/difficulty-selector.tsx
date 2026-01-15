"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Signal, SignalLow, SignalMedium, SignalHigh } from "lucide-react";
import { cn } from "@/lib/utils";

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
        icon: SignalLow,
        color: "text-green-600",
    },
    {
        id: "standard",
        title: "Standard (Grade Level)",
        icon: SignalMedium,
        color: "text-blue-600",
    },
    {
        id: "advanced",
        title: "Advanced (Extension)",
        icon: SignalHigh,
        color: "text-purple-600",
    },
];

export function DifficultySelector({ value, onValueChange, className }: DifficultySelectorProps) {
    return (
        <div className={cn("space-y-1.5", className)}>
            <div className="flex items-center gap-2 mb-1">
                <Signal className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-semibold text-slate-600">Difficulty Level</span>
            </div>
            <Select value={value} onValueChange={(val) => onValueChange(val as DifficultyLevel)}>
                <SelectTrigger className="w-full bg-white border-slate-200">
                    <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                    {levels.map((level) => {
                        const Icon = level.icon;
                        return (
                            <SelectItem key={level.id} value={level.id}>
                                <div className="flex items-center gap-2">
                                    <Icon className={cn("h-4 w-4", level.color)} />
                                    <span>{level.title}</span>
                                </div>
                            </SelectItem>
                        );
                    })}
                </SelectContent>
            </Select>
        </div>
    );
}
