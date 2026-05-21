"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface CommunityFeedSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * CommunityFeedSkeleton — mirrors the shape of a unified-feed item
 * (avatar + author + content + actions row). Used while the parallel
 * Promise.allSettled for groups + feed + connections + suggestions
 * is in flight.
 *
 * NCERT demo polish (2026-05-19): the original page rendered nothing
 * while `loading=true`, which on the demo Wi-Fi gives a 600-1200ms
 * blank-page window that founders interpret as "broken". Skeleton
 * proves the page is alive and previews the eventual layout.
 */
export function CommunityFeedSkeleton({
  count = 3,
  className,
}: CommunityFeedSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-surface-md border border-border bg-card p-4 md:p-6 space-y-3"
        >
          {/* Author row */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-pill shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-6 w-20 rounded-pill shrink-0" />
          </div>
          {/* Content */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
          {/* Actions row */}
          <div className="flex items-center gap-4 pt-2 border-t border-border/60">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-16 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}
