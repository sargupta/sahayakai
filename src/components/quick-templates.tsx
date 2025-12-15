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
        <div className={cn("space-y-3", className)}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {quickTemplates.map((template) => (
                    <button
                        key={template.id}
                        onClick={() => onTemplateSelect(template)}
                        className={cn(
                            "flex flex-col items-center justify-center p-3 rounded-lg border transition-all hover:scale-105 hover:shadow-sm text-center h-full",
                            "bg-white border-slate-200",
                            "hover:border-primary hover:bg-primary/5"
                        )}
                    >
                        <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-lg mb-1", template.color)}>
                            {template.icon}
                        </div>
                        <div className="font-semibold text-xs leading-tight text-slate-700">{template.title}</div>
                        <div className="text-[9px] uppercase tracking-wide font-medium text-slate-400 mt-1">
                            {template.subject}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
