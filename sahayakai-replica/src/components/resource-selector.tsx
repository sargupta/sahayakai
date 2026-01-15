"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
        icon: School,
        color: "text-orange-600",
    },
    {
        id: "medium",
        title: "Basic Resources",
        icon: BookOpen,
        color: "text-blue-600",
    },
    {
        id: "high",
        title: "Tech-Enabled",
        icon: Monitor,
        color: "text-purple-600",
    },
];

export function ResourceSelector({ value, onValueChange, className }: ResourceSelectorProps) {
    return (
        <div className={cn("space-y-1.5", className)}>
            <Select value={value} onValueChange={(val) => onValueChange(val as ResourceLevel)}>
                <SelectTrigger className="w-full bg-white border-slate-200">
                    <SelectValue placeholder="Select resources" />
                </SelectTrigger>
                <SelectContent>
                    {resources.map((resource) => {
                        const Icon = resource.icon;
                        return (
                            <SelectItem key={resource.id} value={resource.id}>
                                <div className="flex items-center gap-2">
                                    <Icon className={cn("h-4 w-4", resource.color)} />
                                    <span>{resource.title}</span>
                                </div>
                            </SelectItem>
                        );
                    })}
                </SelectContent>
            </Select>
        </div>
    );
}
