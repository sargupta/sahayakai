"use client";

import { BookOpenCheck } from 'lucide-react';
import type { FC } from 'react';
import { useSidebar } from '@/components/ui/sidebar';

export const Logo: FC = () => {
  const { state } = useSidebar();
  return (
    <div className="flex items-center gap-2">
      <div className="rounded-lg bg-primary/20 p-2 text-primary">
        <BookOpenCheck className="h-6 w-6" />
      </div>
      <h1 className="font-headline text-2xl font-bold text-foreground transition-all group-data-[collapsible=icon]:-ml-12 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
        SahayakAI
      </h1>
    </div>
  );
};