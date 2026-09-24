/**
 * @fileOverview Reusable collapsible card shell used by both the answer-key
 * and marking-scheme panels. Owns only its open/closed UI state; content is
 * passed as children.
 */
"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface CollapsiblePanelProps {
  title: string;
  icon: ReactNode;
  /** Card content class (matches the per-panel spacing of the originals). */
  contentClassName?: string;
  children: ReactNode;
}

export function CollapsiblePanel({ title, icon, contentClassName, children }: CollapsiblePanelProps) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <button
        type="button"
        className="w-full flex items-center justify-between p-4 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="font-headline font-semibold flex items-center gap-2">
          {icon}
          {title}
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <CardContent className={contentClassName}>
          {children}
        </CardContent>
      )}
    </Card>
  );
}
