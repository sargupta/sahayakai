
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
        isSelected ? "border-blue-600 ring-2 ring-blue-600/50" : "border-border hover:border-primary/50",
        className
      )}
      onClick={onSelect}
    >
      <CardContent className="p-2 relative flex flex-col items-center justify-center gap-1">
        {isSelected && (
          <CheckCircle2 className="absolute top-1 right-1 h-4 w-4 text-blue-600" />
        )}
        <Icon className="h-6 w-6 text-primary" />
        <p className="text-[10px] font-medium text-center leading-tight">{label}</p>
      </CardContent>
    </Card>
  );
};
