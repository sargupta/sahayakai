"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { quickTemplates, type QuickTemplate } from "@/data/quick-templates";
import { Slice, Triangle, Coins, Sprout, Droplets, Apple, Orbit, Map, Vote, FileEdit, type LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
    Slice, Triangle, Coins, Sprout, Droplets, Apple, Orbit, Map, Vote, FileEdit,
};
import { cn } from "@/lib/utils";

interface QuickTemplatesProps {
    onTemplateSelect: (template: QuickTemplate) => void;
    className?: string;
}

export function QuickTemplates({ onTemplateSelect, className }: QuickTemplatesProps) {
    return (
        <div className={cn("space-y-3", className)}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {quickTemplates.map((template) => (
                    <button
                        key={template.id}
                        onClick={() => onTemplateSelect(template)}
                        className={cn(
                            "flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 hover:shadow-elevated text-center h-full",
                            "bg-card border-border",
                            "hover:border-primary/60 hover:bg-primary/5 hover:text-primary"
                        )}
                    >
                        <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-lg mb-1", template.color)}>
                            {(() => { const Icon = iconMap[template.icon]; return Icon ? <Icon className="h-4 w-4" /> : null; })()}
                        </div>
                        <div className="font-medium text-xs leading-tight text-foreground">{template.title}</div>
                        <div className="text-[9px] uppercase tracking-widest font-medium text-muted-foreground mt-1">
                            {template.subject}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
