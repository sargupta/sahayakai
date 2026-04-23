import { BookOpenCheck } from 'lucide-react';
import type { FC } from 'react';

/**
 * Logo is used both inside the sidebar (where a parent [data-collapsible]
 * group handles the collapse) AND outside it (e.g. inside AuthDialog on the
 * landing page where no SidebarProvider exists). It must therefore avoid
 * calling useSidebar() — the collapse behaviour is already pure CSS via the
 * group-data selectors below, no hook needed.
 */
export const Logo: FC = () => {
  return (
    <div className="flex items-center gap-2">
      <div className="rounded-lg bg-primary/20 p-2 text-primary">
        <BookOpenCheck className="h-6 w-6" />
      </div>
      <div className="flex flex-col transition-all group-data-[collapsible=icon]:-ml-12 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
        <h1 className="font-headline text-2xl font-bold text-foreground leading-none">
          SahayakAI
        </h1>
        <span className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground mt-0.5">
          by SARGVISION
        </span>
      </div>
    </div>
  );
};
