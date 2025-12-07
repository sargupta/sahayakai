"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Check, School, BookOpen, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

export type ResourceLevel = 'low' | 'medium' | 'high';

interface ResourceSelectorProps {
    value: ResourceLevel;
    onValueChange: (value: ResourceLevel) => void;
    className?: string;
}

const resources = [
    {
        id: "low",
        title: "Minimal (Chalk & Talk)",
        description: "Blackboard, chalk, textbook only. No extra materials.",
        icon: School,
        color: "text-orange-600",
        bg: "bg-orange-50",
        border: "border-orange-200",
    },
    {
        id: "medium",
        title: "Basic Resources",
        description: "Plus: Chart paper, sketch pens, local objects (stones, leaves).",
        icon: BookOpen,
        color: "text-blue-600",
        bg: "bg-blue-50",
        border: "border-blue-200",
    },
    {
        id: "high",
        title: "Tech-Enabled",
        description: "Plus: Projector, computer, internet access.",
        icon: Monitor,
        color: "text-purple-600",
        bg: "bg-purple-50",
        border: "border-purple-200",
    },
];

export function ResourceSelector({ value, onValueChange, className }: ResourceSelectorProps) {
    return (
        <div className={cn("space-y-3", className)}>
            <Label className="font-headline text-base">Available Resources</Label>
            <RadioGroup
                value={value}
                onValueChange={(val) => onValueChange(val as ResourceLevel)}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
                {resources.map((resource) => {
                    const isSelected = value === resource.id;
                    const Icon = resource.icon;

                    return (
                        <Label
                            key={resource.id}
                            htmlFor={resource.id}
                            className={cn(
                                "cursor-pointer relative flex flex-col gap-2 p-4 rounded-lg border-2 transition-all hover:bg-accent/50",
                                isSelected ? `${resource.bg} ${resource.border} ring-1 ring-primary/20` : "bg-white/50 border-transparent hover:border-primary/20",
                            )}
                        >
                            <RadioGroupItem value={resource.id} id={resource.id} className="sr-only" />
                            <div className="flex justify-between items-start">
                                <Icon className={cn("h-5 w-5", resource.color)} />
                                {isSelected && (
                                    <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                        <Check className="h-3 w-3" />
                                    </div>
                                )}
                            </div>
                            <div>
                                <div className="font-semibold text-sm">{resource.title}</div>
                                <div className="text-xs text-muted-foreground mt-1 leading-snug">
                                    {resource.description}
                                </div>
                            </div>
                        </Label>
                    );
                })}
            </RadioGroup>
        </div>
    );
}
