
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
      <CardContent className="p-4 relative flex flex-col items-center justify-center gap-2">
        {isSelected && (
          <CheckCircle2 className="absolute top-2 right-2 h-5 w-5 text-blue-600" />
        )}
        <Icon className="h-8 w-8 text-primary" />
        <p className="text-sm font-medium text-center">{label}</p>
      </CardContent>
    </Card>
  );
};
