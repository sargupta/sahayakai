"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { quickTemplates, type QuickTemplate } from "@/data/quick-templates";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickTemplatesProps {
    onTemplateSelect: (template: QuickTemplate) => void;
    className?: string;
}

export function QuickTemplates({ onTemplateSelect, className }: QuickTemplatesProps) {
    return (
        <div className={cn("space-y-4", className)}>
            <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                <h3 className="font-headline text-lg font-semibold">Quick Start Templates</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {quickTemplates.map((template) => (
                    <button
                        key={template.id}
                        onClick={() => onTemplateSelect(template)}
                        className={cn(
                            "flex flex-col items-center justify-center p-3 rounded-xl border transition-all hover:scale-105 hover:shadow-md text-center gap-2 h-full",
                            "bg-white/60 backdrop-blur-sm border-white/40 shadow-sm",
                            "hover:border-primary/30"
                        )}
                    >
                        <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-xl", template.color)}>
                            {template.icon}
                        </div>
                        <div className="space-y-0.5">
                            <div className="font-semibold text-sm leading-tight">{template.title}</div>
                            <div className="text-xs text-muted-foreground font-hindi">{template.titleHindi}</div>
                        </div>
                        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 bg-secondary/50 px-1.5 py-0.5 rounded-full">
                            {template.subject}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
