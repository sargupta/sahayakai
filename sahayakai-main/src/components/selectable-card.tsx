
"use client";

import type { FC } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type SelectableCardProps = {
  icon: LucideIcon;
  label: string;
  isSelected: boolean;
  onSelect: () => void;
  className?: string;
};

export const SelectableCard: FC<SelectableCardProps> = ({ icon: Icon, label, isSelected, onSelect, className }) => {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200",
        isSelected ? "ring-2 ring-primary/60 shadow-elevated bg-primary/5" : "border-border hover:border-primary/40 hover:shadow-soft hover:bg-muted/30",
        className
      )}
      onClick={onSelect}
    >
      <CardContent className="p-2 relative flex flex-col items-center justify-center gap-1">
        {isSelected && (
          <CheckCircle2 className="absolute top-1 right-1 h-4 w-4 text-primary" />
        )}
        <Icon className="h-6 w-6 text-primary" />
        <p className="text-[10px] font-medium text-center leading-tight text-foreground">{label}</p>
      </CardContent>
    </Card>
  );
};
