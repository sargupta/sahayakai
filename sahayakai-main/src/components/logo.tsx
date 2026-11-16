import type { FC } from 'react';
import { cn } from '@/lib/utils';

/**
 * Logo is used both inside the sidebar (where a parent [data-collapsible]
 * group handles the collapse) AND outside it (e.g. inside AuthDialog on the
 * landing page where no SidebarProvider exists). It must therefore avoid
 * calling useSidebar() — the collapse behaviour is already pure CSS via the
 * group-data selectors below, no hook needed.
 *
 * `compact` is the phone app-header variant: below `sm` the mark shrinks,
 * the wordmark drops to text-base, the tagline hides, and under 360px only
 * the mark shows. text-base (not text-lg) because at 360px the header
 * leaves the wordmark ~92px, and text-lg measured 90px on macOS but ~95px
 * in CI's Linux Chromium. The wordmark truncates rather than push the
 * header wider than the screen. From `sm` up it is identical to the default.
 */
export const Logo: FC<{ compact?: boolean }> = ({ compact = false }) => {
  return (
    <div className={cn('flex items-center gap-2', compact && 'min-w-0')}>
      <img
        src="/icons/mark.png"
        alt="SahayakAI logo"
        className={cn('h-10 w-10 object-contain shrink-0', compact && 'max-sm:h-8 max-sm:w-8')}
      />
      <div
        className={cn(
          'flex flex-col transition-all group-data-[collapsible=icon]:-ml-12 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0',
          compact && 'min-w-0 max-[359px]:hidden max-sm:[&>span]:hidden',
        )}
      >
        <h1
          className={cn(
            'font-headline text-2xl font-bold text-foreground leading-none',
            // leading-tight with truncate: overflow:hidden at leading-none
            // would clip the descender of the "y".
            compact && 'max-sm:truncate max-sm:text-base max-sm:leading-tight',
          )}
        >
          SahayakAI
        </h1>
        <span className="text-[9px] font-medium tracking-[0.12em] uppercase text-muted-foreground mt-0.5">
          by SARGVISION Intelligence
        </span>
      </div>
    </div>
  );
};
